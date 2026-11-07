// Локация «Площадь Левиафана».
// Карта состоит из клеток 16×16 точек (трава, тропинка, камень, вода),
// а деревья, кусты, фонтан и зиккурат стоят поверх неё как отдельные предметы.
// Всё рисуется кодом, поэтому картинки не нужны. Случайность «с зерном»:
// при каждом запуске получается одна и та же карта.
(function () {
	'use strict';

	const TILE = 16;
	const COLS = 48;
	const ROWS = 36;
	const GRASS = 0, PATH = 1, STONE = 2, WATER = 3;

	function rng(seed) {
		return function () {
			seed |= 0;
			seed = (seed + 0x6D2B79F5) | 0;
			let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	function canvas(w, h) {
		const c = document.createElement('canvas');
		c.width = w;
		c.height = h;
		const ctx = c.getContext('2d');
		ctx.imageSmoothingEnabled = false;
		return [c, ctx];
	}

	// тёмная обводка вокруг нарисованного предмета
	function outline(c, color) {
		const ctx = c.getContext('2d');
		const img = ctx.getImageData(0, 0, c.width, c.height);
		const d = img.data;
		const w = c.width, h = c.height;
		const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
		const marks = [];
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) marks.push([x, y]);
			}
		}
		ctx.fillStyle = color;
		for (const [x, y] of marks) ctx.fillRect(x, y, 1, 1);
		return c;
	}

	function disc(ctx, cx, cy, r, color) {
		ctx.fillStyle = color;
		for (let y = -r; y <= r; y++) {
			const half = Math.floor(Math.sqrt(r * r - y * y + r * 0.6));
			ctx.fillRect(cx - half, cy + y, half * 2 + 1, 1);
		}
	}

	// предметы

	function makeTree(variant, rand) {
		const [c, ctx] = canvas(36, 48);
		ctx.fillStyle = '#5a3b26';
		ctx.fillRect(15, 30, 6, 15);
		ctx.fillStyle = '#704a30';
		ctx.fillRect(16, 30, 2, 15);
		ctx.fillStyle = '#4a2f1e';
		ctx.fillRect(13, 43, 10, 2);
		const greens = variant === 0 ? ['#2f5f2c', '#3f7a35', '#58964a', '#7ab45e'] : ['#2a4a3a', '#36604a', '#4a7c5c', '#6a9c76'];
		disc(ctx, 18, 20, 15, greens[0]);
		disc(ctx, 11, 22, 9, greens[0]);
		disc(ctx, 25, 23, 9, greens[0]);
		disc(ctx, 17, 17, 12, greens[1]);
		disc(ctx, 12, 20, 7, greens[1]);
		disc(ctx, 15, 13, 7, greens[2]);
		disc(ctx, 24, 18, 5, greens[2]);
		ctx.fillStyle = greens[3];
		for (let i = 0; i < 14; i++) ctx.fillRect(8 + Math.floor(rand() * 18), 7 + Math.floor(rand() * 16), 1, 1);
		if (variant === 0 && rand() < 0.5) {
			ctx.fillStyle = '#e86a8a';
			for (let i = 0; i < 5; i++) ctx.fillRect(7 + Math.floor(rand() * 22), 10 + Math.floor(rand() * 18), 2, 2);
		}
		return outline(c, '#16221a');
	}

	function makePine(rand) {
		const [c, ctx] = canvas(30, 52);
		ctx.fillStyle = '#4f3423';
		ctx.fillRect(13, 40, 4, 9);
		const layers = [[15, 2, 5], [15, 12, 8], [15, 22, 11], [15, 31, 13]];
		for (const [cx, y, r] of layers) {
			for (let i = 0; i < 12; i++) {
				const half = Math.round(r * (i / 11));
				ctx.fillStyle = i < 3 ? '#3a6a48' : '#24483a';
				ctx.fillRect(cx - half, y + i, half * 2 + 1, 1);
				ctx.fillStyle = '#3a6a48';
				ctx.fillRect(cx - half, y + i, Math.max(1, half - 1), 1);
			}
		}
		ctx.fillStyle = '#e8f0e0';
		if (rand() < 0.3) ctx.fillRect(15, 1, 1, 1);
		return outline(c, '#12201a');
	}

	function makeBush(rand) {
		const [c, ctx] = canvas(20, 14);
		disc(ctx, 10, 8, 6, '#3a6e32');
		disc(ctx, 6, 9, 4, '#3a6e32');
		disc(ctx, 14, 9, 4, '#3a6e32');
		disc(ctx, 9, 6, 3, '#58964a');
		if (rand() < 0.5) {
			ctx.fillStyle = rand() < 0.5 ? '#f2d24a' : '#f0f0ff';
			ctx.fillRect(5, 7, 1, 1);
			ctx.fillRect(12, 5, 1, 1);
			ctx.fillRect(15, 9, 1, 1);
		}
		return outline(c, '#16221a');
	}

	function makeRock() {
		const [c, ctx] = canvas(16, 12);
		disc(ctx, 8, 7, 5, '#7c7f86');
		disc(ctx, 7, 6, 3, '#9a9ea6');
		ctx.fillStyle = '#5f626a';
		ctx.fillRect(3, 10, 11, 1);
		return outline(c, '#22242a');
	}

	function makeLamp() {
		const [c, ctx] = canvas(12, 34);
		ctx.fillStyle = '#2c2a32';
		ctx.fillRect(5, 8, 2, 24);
		ctx.fillRect(3, 30, 6, 2);
		ctx.fillRect(2, 2, 8, 2);
		ctx.fillRect(3, 9, 6, 1);
		ctx.fillStyle = '#ffe9a0';
		ctx.fillRect(3, 4, 6, 5);
		ctx.fillStyle = '#fff8d8';
		ctx.fillRect(4, 5, 2, 2);
		return outline(c, '#121016');
	}

	function makeBench() {
		const [c, ctx] = canvas(28, 14);
		ctx.fillStyle = '#7a5234';
		ctx.fillRect(1, 2, 26, 3);
		ctx.fillRect(1, 7, 26, 3);
		ctx.fillStyle = '#946642';
		ctx.fillRect(1, 7, 26, 1);
		ctx.fillStyle = '#3a2a22';
		ctx.fillRect(3, 10, 2, 3);
		ctx.fillRect(23, 10, 2, 3);
		ctx.fillRect(3, 5, 2, 2);
		ctx.fillRect(23, 5, 2, 2);
		return outline(c, '#1a120e');
	}

	function makeFountain() {
		const [c, ctx] = canvas(56, 46);
		// чаша
		ctx.fillStyle = '#8c877c';
		ctx.fillRect(2, 24, 52, 16);
		ctx.fillStyle = '#a8a294';
		ctx.fillRect(2, 22, 52, 4);
		ctx.fillStyle = '#6f6a60';
		ctx.fillRect(2, 38, 52, 3);
		ctx.fillStyle = '#3d6fa8';
		ctx.fillRect(5, 25, 46, 9);
		ctx.fillStyle = '#5a8cc4';
		ctx.fillRect(8, 27, 12, 1);
		ctx.fillRect(30, 30, 14, 1);
		// столб и верхняя чаша
		ctx.fillStyle = '#a8a294';
		ctx.fillRect(25, 10, 6, 18);
		ctx.fillRect(17, 9, 22, 3);
		ctx.fillStyle = '#8c877c';
		ctx.fillRect(17, 12, 22, 2);
		// струи воды
		ctx.fillStyle = '#9fd0f0';
		ctx.fillRect(27, 2, 2, 8);
		ctx.fillRect(18, 14, 1, 10);
		ctx.fillRect(37, 14, 1, 10);
		ctx.fillStyle = '#e0f4ff';
		ctx.fillRect(27, 1, 2, 2);
		// розовый камень Левиафана
		ctx.fillStyle = '#d2386a';
		ctx.fillRect(26, 17, 4, 4);
		ctx.fillStyle = '#f08ab0';
		ctx.fillRect(26, 17, 2, 2);
		return outline(c, '#24221e');
	}

	function makeZiggurat() {
		const [c, ctx] = canvas(96, 70);
		const steps = [[4, 52, 88, 14], [14, 38, 68, 14], [24, 24, 48, 14], [34, 12, 28, 12]];
		for (const [x, y, w, h] of steps) {
			ctx.fillStyle = '#b89a6a';
			ctx.fillRect(x, y, w, h);
			ctx.fillStyle = '#d4b884';
			ctx.fillRect(x, y, w, 2);
			ctx.fillStyle = '#9a7e54';
			ctx.fillRect(x, y + h - 2, w, 2);
			ctx.fillStyle = '#a88c5e';
			for (let bx = x + 4; bx < x + w - 2; bx += 8) ctx.fillRect(bx, y + 4 + ((bx / 8) % 2) * 4, 1, 4);
		}
		// лестница посередине
		ctx.fillStyle = '#8a6e48';
		ctx.fillRect(42, 12, 12, 54);
		ctx.fillStyle = '#c8aa78';
		for (let y = 14; y < 66; y += 3) ctx.fillRect(42, y, 12, 1);
		// розовые знамёна
		ctx.fillStyle = '#d2386a';
		ctx.fillRect(16, 40, 6, 10);
		ctx.fillRect(74, 40, 6, 10);
		ctx.fillStyle = '#f08ab0';
		ctx.fillRect(18, 43, 2, 2);
		ctx.fillRect(76, 43, 2, 2);
		// огонь наверху
		ctx.fillStyle = '#f2a03a';
		ctx.fillRect(44, 4, 8, 8);
		ctx.fillStyle = '#ffe08a';
		ctx.fillRect(46, 2, 4, 7);
		return outline(c, '#2a2014');
	}

	function makeSign() {
		const [c, ctx] = canvas(22, 22);
		ctx.fillStyle = '#5a3b26';
		ctx.fillRect(10, 10, 2, 11);
		ctx.fillStyle = '#946642';
		ctx.fillRect(1, 2, 20, 9);
		ctx.fillStyle = '#b8845a';
		ctx.fillRect(1, 2, 20, 1);
		ctx.fillStyle = '#3a2a22';
		ctx.fillRect(4, 5, 14, 1);
		ctx.fillRect(4, 8, 10, 1);
		return outline(c, '#1a120e');
	}

	// карта

	function build() {
		const rand = rng(20261107);
		const tiles = new Uint8Array(COLS * ROWS);
		const at = (x, y) => tiles[y * COLS + x];
		const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < COLS && y < ROWS) tiles[y * COLS + x] = v; };

		const cx = 24, cy = 19;
		for (let y = 0; y < ROWS; y++) {
			for (let x = 0; x < COLS; x++) {
				const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
				if (dx * dx + dy * dy < 6.5 * 6.5) set(x, y, STONE);
				if ((x === 23 || x === 24) && at(x, y) !== STONE) set(x, y, PATH);
				if ((y === 18 || y === 19) && at(x, y) !== STONE) set(x, y, PATH);
				const px = (x + 0.5 - 9) / 5.5, py = (y + 0.5 - 28) / 3.6;
				if (px * px + py * py < 1) set(x, y, WATER);
			}
		}
		// тропинка к зиккурату
		for (let x = 25; x <= 37; x++) set(x, 11, PATH), set(x, 12, PATH);
		for (let y = 12; y <= 14; y++) set(25, y, PATH), set(26, y, PATH);

		// земля одной большой картинкой
		const [ground, g] = canvas(COLS * TILE, ROWS * TILE);
		const water = [];
		for (let y = 0; y < ROWS; y++) {
			for (let x = 0; x < COLS; x++) {
				const t = at(x, y);
				const X = x * TILE, Y = y * TILE;
				if (t === GRASS) {
					g.fillStyle = '#5f8f3e';
					g.fillRect(X, Y, TILE, TILE);
					for (let i = 0; i < 9; i++) {
						g.fillStyle = rand() < 0.5 ? '#6fa24a' : '#517e35';
						const sx = X + Math.floor(rand() * 15), sy = Y + Math.floor(rand() * 14);
						g.fillRect(sx, sy, 1, 2);
					}
					if (rand() < 0.07) {
						g.fillStyle = ['#f0f0ff', '#f2d24a', '#e86a8a', '#b48ae8'][Math.floor(rand() * 4)];
						const fx = X + 3 + Math.floor(rand() * 9), fy = Y + 3 + Math.floor(rand() * 9);
						g.fillRect(fx, fy, 2, 2);
						g.fillRect(fx + 4, fy + 3, 1, 1);
					}
				} else if (t === PATH) {
					g.fillStyle = '#b08a5a';
					g.fillRect(X, Y, TILE, TILE);
					for (let i = 0; i < 6; i++) {
						g.fillStyle = rand() < 0.5 ? '#9c7748' : '#c49c6a';
						g.fillRect(X + Math.floor(rand() * 15), Y + Math.floor(rand() * 15), 2, 1);
					}
				} else if (t === STONE) {
					g.fillStyle = '#a8a294';
					g.fillRect(X, Y, TILE, TILE);
					g.fillStyle = '#8f897c';
					g.fillRect(X, Y + 7, TILE, 1);
					g.fillRect(X, Y + 15, TILE, 1);
					g.fillRect(X + (y % 2 ? 4 : 12), Y, 1, 7);
					g.fillRect(X + (y % 2 ? 12 : 4), Y + 8, 1, 7);
					if (rand() < 0.3) {
						g.fillStyle = '#b8b2a4';
						g.fillRect(X + 2, Y + 2, 3, 1);
					}
				} else {
					g.fillStyle = '#3d6fa8';
					g.fillRect(X, Y, TILE, TILE);
					g.fillStyle = '#4a7cb4';
					g.fillRect(X + Math.floor(rand() * 8), Y + 4 + Math.floor(rand() * 8), 6, 1);
					water.push([X, Y]);
				}
			}
		}
		// мягкие края: трава заходит на тропинку, берег у воды
		for (let y = 0; y < ROWS; y++) {
			for (let x = 0; x < COLS; x++) {
				const t = at(x, y);
				const X = x * TILE, Y = y * TILE;
				const n = [[0, -1], [0, 1], [-1, 0], [1, 0]];
				for (const [dx, dy] of n) {
					const nx = x + dx, ny = y + dy;
					if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
					const o = at(nx, ny);
					if (t === PATH && o === GRASS) {
						g.fillStyle = '#5f8f3e';
						for (let i = 0; i < TILE; i += 2) {
							const len = 1 + Math.floor(rand() * 2);
							if (dy === -1) g.fillRect(X + i, Y, 2, len);
							if (dy === 1) g.fillRect(X + i, Y + TILE - len, 2, len);
							if (dx === -1) g.fillRect(X, Y + i, len, 2);
							if (dx === 1) g.fillRect(X + TILE - len, Y + i, len, 2);
						}
					}
					if (t === WATER && o !== WATER) {
						g.fillStyle = '#9fd0e8';
						if (dy === -1) g.fillRect(X, Y, TILE, 2);
						if (dy === 1) g.fillRect(X, Y + TILE - 2, TILE, 2);
						if (dx === -1) g.fillRect(X, Y, 2, TILE);
						if (dx === 1) g.fillRect(X + TILE - 2, Y, 2, TILE);
					}
					if (t === STONE && o !== STONE) {
						g.fillStyle = '#7c776c';
						if (dy === -1) g.fillRect(X, Y, TILE, 1);
						if (dy === 1) g.fillRect(X, Y + TILE - 1, TILE, 1);
						if (dx === -1) g.fillRect(X, Y, 1, TILE);
						if (dx === 1) g.fillRect(X + TILE - 1, Y, 1, TILE);
					}
				}
			}
		}

		// предметы: x, y это точка, где предмет касается земли (низ, середина)
		const objects = [];
		const add = (img, x, y, box) => objects.push({ img, x, y, box });
		const boxFree = (x, y, r) => objects.every(o => Math.abs(o.x - x) > r + 10 || Math.abs(o.y - y) > r + 6);

		add(makeFountain(), cx * TILE, cy * TILE + 12, { w: 50, h: 18 });
		add(makeZiggurat(), 38 * TILE, 10 * TILE, { w: 90, h: 50 });
		add(makeSign(), 27 * TILE + 4, 15 * TILE, { w: 4, h: 3 });
		for (const [lx, ly] of [[19, 14], [30, 14], [19, 25], [30, 25]]) add(makeLamp(), lx * TILE, ly * TILE, { w: 4, h: 3 });
		add(makeBench(), 20 * TILE, 21 * TILE, { w: 24, h: 6 });
		add(makeBench(), 28 * TILE + 8, 21 * TILE, { w: 24, h: 6 });

		const blocked = (x, y) => {
			if (x < 1 || y < 1 || x > COLS - 2 || y > ROWS - 2) return true;
			const t = at(x, y);
			if (t !== GRASS) return true;
			for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
				const nx = x + i, ny = y + j;
				if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS && at(nx, ny) !== GRASS) return true;
			}
			const zx = x - 38, zy = y - 7;
			if (Math.abs(zx) < 7 && zy > -6 && zy < 5) return true;
			return false;
		};

		// лес по краям и рощи
		for (let y = 0; y < ROWS; y++) {
			for (let x = 0; x < COLS; x++) {
				const edge = Math.min(x, y, COLS - 1 - x, ROWS - 1 - y);
				const onPath = at(x, y) !== GRASS;
				let chance = edge <= 1 ? 0.75 : edge <= 3 ? 0.3 : 0.05;
				if (onPath) continue;
				if (edge > 1 && blocked(x, y)) continue;
				if (rand() < chance) {
					const ox = x * TILE + 8 + Math.floor(rand() * 6) - 3;
					const oy = y * TILE + 14;
					if (!boxFree(ox, oy, 10)) continue;
					const kind = rand();
					if (kind < 0.55) add(makeTree(rand() < 0.7 ? 0 : 1, rand), ox, oy, { w: 10, h: 6 });
					else if (kind < 0.8) add(makePine(rand), ox, oy, { w: 8, h: 6 });
					else add(makeBush(rand), ox, oy, { w: 14, h: 6 });
				}
			}
		}
		for (let i = 0; i < 40; i++) {
			const x = 2 + Math.floor(rand() * (COLS - 4));
			const y = 2 + Math.floor(rand() * (ROWS - 4));
			if (blocked(x, y)) continue;
			const ox = x * TILE + 8, oy = y * TILE + 10;
			if (!boxFree(ox, oy, 8)) continue;
			if (rand() < 0.6) add(makeBush(rand), ox, oy, { w: 14, h: 6 });
			else add(makeRock(), ox, oy, { w: 12, h: 5 });
		}

		// можно ли встать в точку (x, y): не вода, не край, не предмет
		function walkable(x, y) {
			if (x < 4 || y < 4 || x > COLS * TILE - 4 || y > ROWS * TILE - 2) return false;
			const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
			if (at(tx, ty) === WATER) return false;
			for (const o of objects) {
				if (Math.abs(x - o.x) < o.box.w / 2 + 4 && y > o.y - o.box.h - 1 && y < o.y + 3) return false;
			}
			return true;
		}

		return {
			name: 'Площадь Левиафана',
			width: COLS * TILE,
			height: ROWS * TILE,
			ground,
			water,
			objects,
			walkable,
			spawn: { x: cx * TILE, y: (cy + 4) * TILE },
		};
	}

	window.SGLWorld = { build };
})();
