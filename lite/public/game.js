// The game: the starting meadow, your pony, other players.
// Everything is drawn on a 2d canvas in "native" pixels (one pixel of a Pony Town sprite) and then scaled up by the zoom.

import { loadSkin, pickStrip, pickFrame, drawStrip, boopDuration } from './skins.js';

const ZOOMS = [1, 2, 3, 4, 5, 6, 8];
const SPEED = 60; // native pixels per second
const SEND_INTERVAL = 0.1; // seconds between position updates
const TILE_W = 32;
const TILE_H = 24;
const WORLD = { w: 640, h: 480 };

// scenery: [sprite, x, y], x/y is the point where the object touches the ground
const DECALS = [
	['flowers-1', 210, 300], ['flowers-3', 400, 340], ['flowers-5', 120, 200], ['flowers-2', 470, 170],
	['flowers-6', 300, 400], ['clovers-3', 250, 220], ['clovers-5', 380, 260], ['clovers-7', 160, 360],
	['clovers-4', 520, 300], ['flower-1', 340, 150], ['flower-2', 280, 330], ['flower-3', 440, 400],
];
const OBJECTS = [
	['tree', 70, 120], ['tree-b', 560, 110], ['tree', 600, 330], ['tree-b', 60, 420],
	['tree-medium', 190, 70], ['tree-medium', 470, 470], ['tree-small', 410, 60], ['tree-small', 250, 470],
	['sapling', 130, 270], ['sapling', 520, 230],
	['well', 320, 230],
	['bench', 240, 300], ['bench', 410, 300],
	['bush-1', 150, 150], ['bush-2', 500, 400], ['bush-3', 360, 420], ['bush-4', 110, 330], ['bush-1', 600, 210],
	['rock-1', 460, 200], ['rock-2', 200, 400], ['rock-3', 560, 440], ['barrel', 360, 205],
];
// collision circles around the ground point: [radius x, radius y]
const COLLIDERS = {
	'tree': [12, 6], 'tree-b': [12, 6], 'tree-medium': [9, 5], 'tree-small': [6, 4], 'sapling': [3, 2],
	'well': [28, 12], 'bench': [36, 4], 'bush-1': [14, 7], 'bush-2': [14, 7], 'bush-3': [10, 5], 'bush-4': [10, 5],
	'rock-1': [14, 7], 'rock-2': [9, 5], 'rock-3': [9, 5], 'barrel': [10, 5],
};
const SPAWN = { x: 320, y: 270 };

function loadImage(src) {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = reject;
		image.src = src;
	});
}

async function loadScenery() {
	const meta = await (await fetch('assets/scenery/scenery.json')).json();
	const names = new Set([...DECALS, ...OBJECTS].map(([name]) => name));
	const sprites = {};

	await Promise.all([...names].map(async name => {
		sprites[name] = { ...meta[name], image: await loadImage(`assets/scenery/${name}.png`) };
	}));

	return { sprites, grass: await loadImage('assets/grass.png') };
}

// which of the 4 grass tiles goes to a cell, the same for everyone
function grassVariant(column, row) {
	const h = Math.imul(column * 374761393 + row * 668265263, 1274126177) >>> 0;
	return (h >>> 13) % 4;
}

function createPony(info) {
	return {
		id: info.id, name: info.name, skinId: info.skin, skin: null,
		x: info.x, y: info.y, tx: info.x, ty: info.y, // tx, ty: where a remote pony is going
		face: info.f || -1, anim: info.a || 'stand', animTime: 0,
	};
}

export async function startGame(profile, actions) {
	const canvas = document.getElementById('game');
	const context = canvas.getContext('2d');
	const status = document.getElementById('status');
	const { sprites, grass } = await loadScenery();
	const me = createPony({ id: 0, name: profile.name, skin: profile.skin, x: SPAWN.x, y: SPAWN.y });
	const ponies = new Map(); // other players by id
	const keys = new Set();
	let zoomIndex = window.innerWidth < 600 ? 1 : 2;
	let dpr = 1;
	let camera = { x: 0, y: 0 };
	let target = null; // click-to-move point
	let flying = false;
	let pose = 'stand'; // stand, sit or lie when not moving
	let boopUntil = 0;
	let time = 0;

	function setStatus(text) {
		status.textContent = text || '';
		status.hidden = !text;
	}

	function attachSkin(pony) {
		loadSkin(pony.skinId)
			.then(skin => {
				pony.skin = skin;

				if (pony === me) {
					document.getElementById('fly-button').disabled = !skin.fly;
				}
			})
			.catch(e => console.error(e));
	}

	attachSkin(me);

	// controls

	function zoom() {
		return ZOOMS[zoomIndex];
	}

	function setZoom(index) {
		zoomIndex = Math.max(0, Math.min(ZOOMS.length - 1, index));
		document.getElementById('zoom-value').textContent = `${zoom()}x`;
	}

	function resize() {
		dpr = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		canvas.width = Math.round(rect.width * dpr);
		canvas.height = Math.round(rect.height * dpr);
	}

	function action(name) {
		if (name === 'sit' || name === 'lie') {
			flying = false;
			pose = pose === name ? 'stand' : name;
		} else if (name === 'fly' && me.skin && me.skin.fly) {
			flying = !flying;
			pose = 'stand';
		} else if (name === 'boop') {
			boopUntil = time + boopDuration(me.skin || {});
			me.animTime = 0;
		}
	}

	const KEY_ACTIONS = { c: 'sit', x: 'lie', e: 'boop', f: 'fly' };
	const MOVE_KEYS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'];

	addEventListener('resize', resize);
	addEventListener('keydown', event => {
		if (document.getElementById('game-screen').hidden || event.target.tagName === 'INPUT') {
			return;
		}

		const key = event.key.toLowerCase();

		if (key === '+' || key === '=') {
			setZoom(zoomIndex + 1);
		} else if (key === '-' || key === '_') {
			setZoom(zoomIndex - 1);
		} else if (MOVE_KEYS.includes(key)) {
			keys.add(key);
			target = null;
			event.preventDefault();
		} else if (KEY_ACTIONS[key] && !event.repeat) {
			action(KEY_ACTIONS[key]);
		}
	});
	addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
	addEventListener('blur', () => keys.clear());
	canvas.addEventListener('wheel', event => {
		event.preventDefault();
		setZoom(zoomIndex + (event.deltaY < 0 ? 1 : -1));
	}, { passive: false });
	canvas.addEventListener('pointerdown', event => {
		const rect = canvas.getBoundingClientRect();
		const z = zoom() * dpr;
		target = { x: camera.x + (event.clientX - rect.left) * dpr / z, y: camera.y + (event.clientY - rect.top) * dpr / z };
	});
	document.querySelectorAll('[data-action]').forEach(button =>
		button.addEventListener('click', () => action(button.dataset.action)));
	document.getElementById('zoom-in').addEventListener('click', () => setZoom(zoomIndex + 1));
	document.getElementById('zoom-out').addEventListener('click', () => setZoom(zoomIndex - 1));
	document.getElementById('change-pony').addEventListener('click', actions.changePony);
	resize();
	setZoom(zoomIndex);

	// network

	let socket = null;
	let sendTimer = 0;
	let lastSent = '';

	function updateOnline() {
		document.getElementById('online').textContent = socket && socket.readyState === 1 ? `онлайн: ${ponies.size + 1}` : '';
	}

	function connect() {
		const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
		socket = new WebSocket(`${protocol}//${location.host}/ws`);

		socket.onopen = () => {
			setStatus('');
			lastSent = '';
			socket.send(JSON.stringify({ t: 'hello', name: profile.name, skin: profile.skin }));
		};

		socket.onmessage = event => {
			const message = JSON.parse(event.data);

			if (message.t === 'welcome') {
				ponies.clear();

				for (const info of message.players) {
					const pony = createPony(info);
					ponies.set(pony.id, pony);
					attachSkin(pony);
				}
			} else if (message.t === 'join') {
				const pony = createPony(message.p);
				ponies.set(pony.id, pony);
				attachSkin(pony);
			} else if (message.t === 'leave') {
				ponies.delete(message.id);
			} else if (message.t === 's') {
				const pony = ponies.get(message.id);

				if (pony) {
					pony.tx = message.x;
					pony.ty = message.y;
					pony.face = message.f;

					if (pony.anim !== message.a) {
						pony.anim = message.a;
						pony.animTime = 0;
					}
				}
			}

			updateOnline();
		};

		socket.onclose = () => {
			ponies.clear();
			updateOnline();
			setStatus('Нет связи с сервером, переподключаюсь…');
			setTimeout(connect, 3000);
		};
	}

	connect();

	function sendState(dt) {
		sendTimer -= dt;

		if (!socket || socket.readyState !== 1 || sendTimer > 0) {
			return;
		}

		const state = { t: 's', x: Math.round(me.x), y: Math.round(me.y), f: me.face, a: me.anim };
		const json = JSON.stringify(state);

		if (json !== lastSent) {
			socket.send(json);
			lastSent = json;
			sendTimer = SEND_INTERVAL;
		}
	}

	// movement

	function collide(x, y) {
		for (const [name, ox, oy] of OBJECTS) {
			const [rx, ry] = COLLIDERS[name] || [0, 0];
			const dx = (x - ox) / rx;
			const dy = (y - oy) / ry;
			const d = Math.hypot(dx, dy);

			if (rx && d < 1) {
				// push the pony out to the edge of the ellipse
				const k = d === 0 ? 1 : 1 / d;
				x = ox + dx * k * rx;
				y = oy + dy * k * ry + (d === 0 ? ry : 0);
			}
		}

		return { x: Math.max(16, Math.min(WORLD.w - 16, x)), y: Math.max(30, Math.min(WORLD.h - 4, y)) };
	}

	function updateMe(dt) {
		let dx = 0;
		let dy = 0;

		if (keys.has('arrowleft') || keys.has('a')) dx--;
		if (keys.has('arrowright') || keys.has('d')) dx++;
		if (keys.has('arrowup') || keys.has('w')) dy--;
		if (keys.has('arrowdown') || keys.has('s')) dy++;

		if (!dx && !dy && target) {
			const tx = target.x - me.x;
			const ty = target.y - me.y;
			const distance = Math.hypot(tx, ty);

			if (distance < 1.5) {
				target = null;
			} else {
				dx = tx / distance;
				dy = ty / distance;
			}
		}

		const length = Math.hypot(dx, dy);
		const moving = length > 0;

		if (moving) {
			const moved = collide(me.x + dx / length * SPEED * dt, me.y + dy / length * SPEED * dt * 0.75);
			me.x = moved.x;
			me.y = moved.y;

			if (Math.abs(dx) > 0.1) {
				me.face = dx < 0 ? -1 : 1;
			}

			pose = 'stand';
			boopUntil = 0;
		}

		let anim;

		if (time < boopUntil) {
			anim = 'boop';
		} else if (flying) {
			anim = 'fly';
		} else if (moving) {
			anim = 'walk';
		} else {
			anim = pose;
		}

		if (anim !== me.anim) {
			me.anim = anim;
			me.animTime = 0;
		}
	}

	function updateOther(pony, dt) {
		const k = Math.min(1, dt * 10);
		pony.x += (pony.tx - pony.x) * k;
		pony.y += (pony.ty - pony.y) * k;
	}

	// drawing

	function drawPony(pony) {
		if (!pony.skin) {
			return;
		}

		const { name, strip } = pickStrip(pony.skin, pony.anim);
		const frame = pickFrame(name, strip, pony.animTime, pony.id * 1.7);
		drawStrip(context, strip, frame, Math.round(pony.x), Math.round(pony.y), pony.face > 0);
	}

	function draw() {
		const z = zoom() * dpr;
		context.setTransform(1, 0, 0, 1, 0, 0);
		context.imageSmoothingEnabled = false;
		context.fillStyle = '#0f1a24';
		context.fillRect(0, 0, canvas.width, canvas.height);

		const viewW = canvas.width / z;
		const viewH = canvas.height / z;
		camera.x = Math.round(Math.max(Math.min(me.x - viewW / 2, WORLD.w - viewW), 0));
		camera.y = Math.round(Math.max(Math.min(me.y - viewH / 2 - 20, WORLD.h - viewH), 0));

		if (viewW > WORLD.w) camera.x = Math.round((WORLD.w - viewW) / 2);
		if (viewH > WORLD.h) camera.y = Math.round((WORLD.h - viewH) / 2);

		context.setTransform(z, 0, 0, z, -camera.x * z, -camera.y * z);
		context.imageSmoothingEnabled = false;

		// ground: grass covers the whole screen, the meadow just has no visible border
		for (let row = Math.floor(camera.y / TILE_H); row * TILE_H < camera.y + viewH; row++) {
			for (let column = Math.floor(camera.x / TILE_W); column * TILE_W < camera.x + viewW; column++) {
				const tile = grassVariant(column, row);
				context.drawImage(grass, tile * TILE_W, 0, TILE_W, TILE_H, column * TILE_W, row * TILE_H, TILE_W, TILE_H);
			}
		}

		for (const [name, x, y] of DECALS) {
			const sprite = sprites[name];
			context.drawImage(sprite.image, x - sprite.ax, y - sprite.ay);
		}

		// objects and ponies, the ones closer to the bottom are drawn last
		const drawables = OBJECTS.map(([name, x, y]) => ({ y, draw: () => {
			const sprite = sprites[name];
			context.drawImage(sprite.image, x - sprite.ax, y - sprite.ay);
		} }));

		for (const pony of [me, ...ponies.values()]) {
			drawables.push({ y: pony.y, draw: () => drawPony(pony) });
		}

		drawables.sort((a, b) => a.y - b.y).forEach(d => d.draw());

		// name tags in screen pixels so the text stays sharp
		context.setTransform(1, 0, 0, 1, 0, 0);
		context.font = `${Math.round(12 * dpr)}px system-ui, sans-serif`;
		context.textAlign = 'center';

		for (const pony of [me, ...ponies.values()]) {
			const height = pony.skin && pony.skin.stand ? pony.skin.stand.ay : 50;
			const x = (Math.round(pony.x) - camera.x) * z;
			const y = (Math.round(pony.y) - camera.y - height - 4) * z;
			const width = context.measureText(pony.name).width + 10 * dpr;
			context.fillStyle = 'rgba(15, 26, 36, .75)';
			context.fillRect(x - width / 2, y - 14 * dpr, width, 18 * dpr);
			context.fillStyle = pony === me ? '#6cdcf9' : '#e3f4fb';
			context.fillText(pony.name, x, y);
		}
	}

	let last = performance.now();

	function loop(now) {
		const dt = Math.min((now - last) / 1000, 0.05);
		last = now;
		time += dt;
		updateMe(dt);
		me.animTime += dt;

		for (const pony of ponies.values()) {
			updateOther(pony, dt);
			pony.animTime += dt;
		}

		sendState(dt);
		draw();
		requestAnimationFrame(loop);
	}

	requestAnimationFrame(loop);
}
