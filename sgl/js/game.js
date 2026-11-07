// Игра: персонаж ходит по локации.
// Каждый кадр (примерно 60 раз в секунду) код двигает персонажа по нажатым клавишам,
// двигает «камеру» за ним и заново рисует землю, предметы и персонажа.
(function () {
	'use strict';

	const SPEED = 62;      // точек в секунду
	const RUN = 1.7;       // во сколько раз быстрее с Shift

	let world = null;
	let canvas, ctx;
	let running = false;
	let last = 0;
	let player = null;
	const keys = new Set();
	let target = null;     // точка, куда идти после клика

	function zoom() {
		return Math.max(2, Math.round(Math.min(window.innerWidth / 380, window.innerHeight / 260)));
	}

	function resize() {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
		ctx.imageSmoothingEnabled = false;
	}

	function camera(z) {
		const vw = canvas.width / z, vh = canvas.height / z;
		let x = player.x - vw / 2;
		let y = player.y - 20 - vh / 2;
		x = vw >= world.width ? (world.width - vw) / 2 : Math.max(0, Math.min(world.width - vw, x));
		y = vh >= world.height ? (world.height - vh) / 2 : Math.max(0, Math.min(world.height - vh, y));
		return { x: Math.round(x), y: Math.round(y), vw, vh };
	}

	function update(dt) {
		let dx = 0, dy = 0;
		if (keys.has('ArrowLeft') || keys.has('KeyA')) dx -= 1;
		if (keys.has('ArrowRight') || keys.has('KeyD')) dx += 1;
		if (keys.has('ArrowUp') || keys.has('KeyW')) dy -= 1;
		if (keys.has('ArrowDown') || keys.has('KeyS')) dy += 1;
		if (dx || dy) target = null;

		if (target) {
			const tx = target.x - player.x, ty = target.y - player.y;
			const d = Math.hypot(tx, ty);
			if (d < 2) target = null;
			else { dx = tx / d; dy = ty / d; }
		}

		const len = Math.hypot(dx, dy);
		player.moving = len > 0;
		if (!player.moving) return;
		dx /= len; dy /= len;

		if (Math.abs(dx) > Math.abs(dy) + 0.01) player.dir = dx > 0 ? 'right' : 'left';
		else player.dir = dy > 0 ? 'down' : 'up';

		const step = SPEED * (keys.has('ShiftLeft') || keys.has('ShiftRight') ? RUN : 1) * dt;
		const nx = player.x + dx * step;
		const ny = player.y + dy * step;
		// упёрлись в стену по одной оси, но можем скользить по другой
		let moved = false;
		if (world.walkable(nx, ny)) { player.x = nx; player.y = ny; moved = true; }
		else if (dx && world.walkable(nx, player.y)) { player.x = nx; moved = true; }
		else if (dy && world.walkable(player.x, ny)) { player.y = ny; moved = true; }
		if (!moved) { player.moving = false; target = null; }
		if (player.moving) player.walkTime += dt * (step / (SPEED * dt));
	}

	function draw(time) {
		const z = zoom();
		const cam = camera(z);
		ctx.fillStyle = '#1d2a1a';
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		ctx.drawImage(world.ground, cam.x, cam.y, Math.ceil(cam.vw) + 1, Math.ceil(cam.vh) + 1,
			-0, -0, (Math.ceil(cam.vw) + 1) * z, (Math.ceil(cam.vh) + 1) * z);

		// блики на воде
		const tick = Math.floor(time / 450);
		ctx.fillStyle = '#d8f0ff';
		for (let i = 0; i < world.water.length; i++) {
			if (((i * 7919 + tick * 104729) % 11) !== 0) continue;
			const [wx, wy] = world.water[i];
			const ox = (i * 37 + tick * 13) % 12, oy = (i * 53 + tick * 7) % 12;
			ctx.fillRect((wx + ox + 2 - cam.x) * z, (wy + oy + 2 - cam.y) * z, 2 * z, z);
		}

		// предметы и персонаж по порядку сверху вниз, чтобы ближний закрывал дальнего
		const sprite = SGLSprite.get(player.look, player.dir, player.moving ? SGLSprite.walkFrame(player.walkTime) : 0);
		const list = world.objects.filter(o => o.x > cam.x - 60 && o.x < cam.x + cam.vw + 60 && o.y > cam.y - 10 && o.y < cam.y + cam.vh + 80);
		list.push({ y: player.y, player: true });
		list.sort((a, b) => a.y - b.y);

		for (const o of list) {
			if (o.player) {
				const sx = Math.round(player.x) - SGLSprite.FOOT_X;
				const sy = Math.round(player.y) - SGLSprite.FOOT_Y;
				ctx.fillStyle = 'rgba(0,0,0,0.25)';
				ctx.fillRect((sx + 8 - cam.x) * z, (sy + 44 - cam.y) * z, 12 * z, 2 * z);
				ctx.fillRect((sx + 9 - cam.x) * z, (sy + 43 - cam.y) * z, 10 * z, 4 * z);
				ctx.drawImage(sprite, (sx - cam.x) * z, (sy - cam.y) * z, sprite.width * z, sprite.height * z);
			} else {
				const w = o.img.width, h = o.img.height;
				ctx.drawImage(o.img, (Math.round(o.x - w / 2) - cam.x) * z, (o.y - h + 2 - cam.y) * z, w * z, h * z);
			}
		}

		// имя над головой
		const faction = SGLSprite.FACTIONS[player.look.faction];
		const nameX = (player.x - cam.x) * z;
		const nameY = (player.y - 50 - cam.y) * z;
		ctx.font = `${Math.max(12, 5 * z)}px "Pixelify Sans", monospace`;
		ctx.textAlign = 'center';
		ctx.lineJoin = 'round';
		ctx.lineWidth = 4;
		ctx.strokeStyle = 'rgba(12,8,16,0.85)';
		ctx.strokeText(player.look.name, nameX, nameY);
		ctx.fillStyle = faction.color;
		ctx.fillText(player.look.name, nameX, nameY);

		if (target) {
			ctx.strokeStyle = 'rgba(255,255,255,0.7)';
			ctx.lineWidth = Math.max(1, z / 2);
			ctx.strokeRect((target.x - 3 - cam.x) * z, (target.y - 2 - cam.y) * z, 6 * z, 4 * z);
		}
	}

	function loop(time) {
		if (!running) return;
		const dt = Math.min(0.05, (time - last) / 1000 || 0);
		last = time;
		update(dt);
		draw(time);
		requestAnimationFrame(loop);
	}

	function onKey(e) {
		if (!running) return;
		if (e.target && e.target.tagName === 'INPUT') return;
		const watched = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'ShiftLeft', 'ShiftRight'];
		if (!watched.includes(e.code)) return;
		e.preventDefault();
		if (e.type === 'keydown') keys.add(e.code);
		else keys.delete(e.code);
	}

	function onPointer(e) {
		if (!running) return;
		const z = zoom();
		const cam = camera(z);
		const rect = canvas.getBoundingClientRect();
		target = { x: (e.clientX - rect.left) / z + cam.x, y: (e.clientY - rect.top) / z + cam.y };
	}

	window.SGLGame = {
		init(el) {
			canvas = el;
			ctx = canvas.getContext('2d');
			world = SGLWorld.build();
			resize();
			window.addEventListener('resize', resize);
			window.addEventListener('keydown', onKey);
			window.addEventListener('keyup', onKey);
			window.addEventListener('blur', () => keys.clear());
			canvas.addEventListener('pointerdown', onPointer);
			return world;
		},
		start(look) {
			if (!player) player = { x: world.spawn.x, y: world.spawn.y, dir: 'down', moving: false, walkTime: 0 };
			player.look = look;
			running = true;
			last = performance.now();
			requestAnimationFrame(loop);
		},
		stop() {
			running = false;
			keys.clear();
			target = null;
		},
	};
})();
