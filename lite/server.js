// Leviathan Town Lite: a tiny game server.
// Serves the files from public/, stores skins as files in data/skins/ and relays player positions over WebSocket.
// No database: a player is a nickname and a skin id kept in their browser.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT) || 8090;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const SKINS_DIR = path.join(DATA_DIR, 'skins');

const MAX_SKIN_BYTES = 2 * 1024 * 1024;
const MAX_STRIP_LENGTH = 400 * 1024;
const SKIN_ANIMATIONS = ['stand', 'walk', 'sit', 'lie', 'fly', 'boop'];
const MAX_NAME_LENGTH = 20;
const MAX_PLAYERS = 100;
const UPLOADS_PER_HOUR = 30;

fs.mkdirSync(SKINS_DIR, { recursive: true });

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json',
	'.png': 'image/png',
	'.ico': 'image/x-icon',
};

// skins

function isInt(value, min, max) {
	return Number.isInteger(value) && value >= min && value <= max;
}

function validateSkin(anims) {
	if (!anims || typeof anims !== 'object' || Array.isArray(anims)) {
		throw new Error('Неверный скин');
	}

	const result = {};

	for (const key of Object.keys(anims)) {
		const anim = anims[key];

		if (!SKIN_ANIMATIONS.includes(key) || !anim) {
			throw new Error(`Неизвестная анимация: ${key}`);
		}

		if (
			typeof anim.src !== 'string' || anim.src.length > MAX_STRIP_LENGTH ||
			!/^data:image\/png;base64,[a-zA-Z0-9+/]+=*$/.test(anim.src)
		) {
			throw new Error(`Неверная картинка: ${key}`);
		}

		if (!isInt(anim.frames, 1, 64) || !isInt(anim.ax, 0, 512) || !isInt(anim.ay, 0, 512)) {
			throw new Error(`Неверные кадры: ${key}`);
		}

		result[key] = { src: anim.src, frames: anim.frames, ax: anim.ax, ay: anim.ay };
	}

	if (!result.stand) {
		throw new Error('Нужна анимация стояния');
	}

	return result;
}

// the id is a hash of the content, so the same skin is stored once and a skin file never changes
function saveSkin(anims) {
	const json = JSON.stringify(anims);
	const id = crypto.createHash('sha256').update(json).digest('hex').slice(0, 24);
	const file = path.join(SKINS_DIR, `${id}.json`);

	if (!fs.existsSync(file)) {
		fs.writeFileSync(file, json);
	}

	return id;
}

const uploads = new Map(); // ip -> timestamps of recent uploads

function canUpload(ip) {
	const now = Date.now();
	const recent = (uploads.get(ip) || []).filter(t => now - t < 3600 * 1000);
	uploads.set(ip, recent);

	if (recent.length >= UPLOADS_PER_HOUR) {
		return false;
	}

	recent.push(now);
	return true;
}

// http

function send(res, status, body, type = 'application/json', headers = {}) {
	res.writeHead(status, { 'Content-Type': type, ...headers });
	res.end(body);
}

function readBody(req, limit) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;

		req.on('data', chunk => {
			size += chunk.length;

			if (size > limit) {
				reject(new Error('Слишком большой файл'));
				req.destroy();
			} else {
				chunks.push(chunk);
			}
		});
		req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
		req.on('error', reject);
	});
}

async function handleSkinUpload(req, res) {
	try {
		// behind Caddy every request comes from 127.0.0.1, the real address is in X-Forwarded-For
		const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();

		if (!canUpload(ip)) {
			throw new Error('Слишком много загрузок, попробуй через час');
		}

		const anims = validateSkin(JSON.parse(await readBody(req, MAX_SKIN_BYTES)));
		send(res, 200, JSON.stringify({ id: saveSkin(anims) }));
	} catch (e) {
		send(res, 400, JSON.stringify({ error: e.message }));
	}
}

function serveFile(res, file, cache) {
	fs.readFile(file, (error, data) => {
		if (error) {
			send(res, 404, 'Not found', 'text/plain');
		} else {
			send(res, 200, data, MIME[path.extname(file)] || 'application/octet-stream', { 'Cache-Control': cache });
		}
	});
}

const server = http.createServer((req, res) => {
	const url = new URL(req.url, 'http://localhost');
	const skin = /^\/skins\/([a-f0-9]{24})\.json$/.exec(url.pathname);

	if (req.method === 'POST' && url.pathname === '/api/skin') {
		handleSkinUpload(req, res);
	} else if (req.method === 'GET' && skin) {
		serveFile(res, path.join(SKINS_DIR, `${skin[1]}.json`), 'public, max-age=31536000, immutable');
	} else if (req.method === 'GET') {
		const file = path.normalize(path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname));

		if (!file.startsWith(PUBLIC_DIR + path.sep)) {
			send(res, 404, 'Not found', 'text/plain');
		} else {
			serveFile(res, file, 'no-cache');
		}
	} else {
		send(res, 405, 'Method not allowed', 'text/plain');
	}
});

// players

const players = new Map(); // id -> { id, name, skin, x, y, f, a, socket }
let lastId = 0;

function publicInfo({ id, name, skin, x, y, f, a }) {
	return { id, name, skin, x, y, f, a };
}

function broadcast(message, except) {
	const data = JSON.stringify(message);

	for (const player of players.values()) {
		if (player !== except && player.socket.readyState === 1) {
			player.socket.send(data);
		}
	}
}

function cleanName(name) {
	return String(name || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

function isNumber(value) {
	return typeof value === 'number' && Number.isFinite(value);
}

const ANIMS = ['stand', 'walk', 'sit', 'lie', 'fly', 'boop'];

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });

wss.on('connection', socket => {
	let player;

	socket.on('message', raw => {
		let message;

		try {
			message = JSON.parse(raw);
		} catch {
			return;
		}

		if (!player && message.t === 'hello') {
			const name = cleanName(message.name);

			if (!name || !/^[a-f0-9]{24}$/.test(message.skin || '') || players.size >= MAX_PLAYERS) {
				socket.close(1008, 'bad hello');
				return;
			}

			player = { id: ++lastId, name, skin: message.skin, x: 320, y: 260, f: -1, a: 'stand', socket };
			socket.send(JSON.stringify({ t: 'welcome', id: player.id, players: [...players.values()].map(publicInfo) }));
			players.set(player.id, player);
			broadcast({ t: 'join', p: publicInfo(player) }, player);
		} else if (player && message.t === 's') {
			if (isNumber(message.x) && isNumber(message.y)) {
				player.x = Math.round(message.x);
				player.y = Math.round(message.y);
			}

			player.f = message.f === 1 ? 1 : -1;
			player.a = ANIMS.includes(message.a) ? message.a : 'stand';
			broadcast({ t: 's', id: player.id, x: player.x, y: player.y, f: player.f, a: player.a }, player);
		}
	});

	socket.on('close', () => {
		if (player) {
			players.delete(player.id);
			broadcast({ t: 'leave', id: player.id });
		}
	});
});

server.listen(PORT, () => console.log(`Leviathan Town Lite on port ${PORT}`));
