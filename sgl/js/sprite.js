// Рисование персонажа пикселями.
// Персонаж не хранится картинкой: код раскрашивает сетку 28×46 точек слой за слоем
// (тело, лицо, волосы, одежда фракции), а потом обводит силуэт розовой линией.
// Так любой цвет кожи и волос сочетается с любой одеждой без рисования сотен картинок.
(function () {
	'use strict';

	const W = 28;
	const H = 46;
	const OUTLINE = '#d2386a';

	// цвета

	function toRgb(hex) {
		const n = parseInt(hex.slice(1), 16);
		return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	}

	function toHex(rgb) {
		return '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
	}

	// k < 1 темнее, k > 1 светлее
	function shade(hex, k) {
		const c = toRgb(hex);
		if (k <= 1) return toHex(c.map(v => v * k));
		return toHex(c.map(v => v + (255 - v) * (k - 1)));
	}

	// холст из точек

	class Pixels {
		constructor() {
			this.data = new Array(W * H).fill(null);
		}
		px(x, y, c) {
			if (!c || x < 0 || y < 0 || x >= W || y >= H) return;
			this.data[y * W + x] = c;
		}
		rect(x, y, w, h, c) {
			for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
		}
		// прямоугольник и его зеркальная копия относительно середины персонажа
		sym(x, y, w, h, c) {
			this.rect(x, y, w, h, c);
			this.rect(W - x - w, y, w, h, c);
		}
		dots(list, c) {
			for (const [x, y] of list) this.px(x, y, c);
		}
		symDots(list, c) {
			for (const [x, y] of list) {
				this.px(x, y, c);
				this.px(W - 1 - x, y, c);
			}
		}
		// закрасить часть прямоугольников между строками y0 и y1
		band(rects, y0, y1, c) {
			for (const r of rects) {
				const a = Math.max(r.y0, y0);
				const b = Math.min(r.y1, y1);
				if (a <= b) this.rect(r.x, a, r.w, b - a + 1, c);
			}
		}
		fill(rects, c) {
			this.band(rects, 0, H, c);
		}
	}

	// где у персонажа руки и ноги в каждом направлении и кадре шага
	// dir: 'down' (лицом к нам), 'up' (спиной), 'side' (вправо); frame: 0 стоит, 1 и 2 шаг

	function geometry(dir, frame) {
		const R = (x, w, y0, y1) => ({ x, w, y0, y1 });

		if (dir === 'side') {
			const g = { torso: [R(11, 6, 22, 32)], legs: [], feet: [], arms: [], hands: [] };
			if (frame === 0) {
				g.legs = [R(12, 4, 33, 42)];
				g.feet = [R(12, 6, 43, 44)];
				g.arms = [R(13, 3, 22, 30)];
				g.hands = [R(13, 3, 31, 32)];
			} else {
				g.legs = [R(12, 3, 33, 37), R(11, 3, 38, 42), R(13, 3, 33, 37), R(14, 3, 38, 42)];
				g.feet = [R(10, 4, 43, 44), R(14, 5, 43, 44)];
				if (frame === 1) {
					g.arms = [R(13, 3, 22, 26), R(14, 3, 27, 29)];
					g.hands = [R(15, 3, 30, 31)];
				} else {
					g.arms = [R(13, 3, 22, 26), R(12, 3, 27, 29)];
					g.hands = [R(11, 3, 30, 31)];
				}
			}
			return g;
		}

		const g = {
			torso: [R(10, 8, 22, 32)],
			legs: [R(10, 3, 33, 42), R(15, 3, 33, 42)],
			feet: [R(9, 4, 43, 44), R(15, 4, 43, 44)],
			arms: [R(8, 2, 22, 30), R(18, 2, 22, 30)],
			hands: [R(8, 2, 31, 32), R(18, 2, 31, 32)],
		};
		// в шаге одна нога приподнята, а рука с той же стороны чуть поднята
		const side = frame === 1 ? 0 : frame === 2 ? 1 : -1;
		if (side >= 0) {
			g.legs[side].y1 = 41;
			g.feet[side].y0 = 42;
			g.feet[side].y1 = 43;
			const other = 1 - side;
			g.arms[other].y1 = 29;
			g.hands[other].y0 = 30;
			g.hands[other].y1 = 31;
		}
		return g;
	}

	// тело

	function drawBody(p, g, dir, c) {
		p.fill(g.legs, c.skin);
		p.fill(g.feet, c.skinShade);
		p.fill(g.torso, c.skin);
		p.fill(g.arms, c.skin);
		p.fill(g.hands, c.skin);

		if (dir === 'side') {
			p.rect(12, 21, 3, 1, c.skinShade);
			p.rect(11, 10, 7, 1, c.skin);
			p.rect(10, 11, 9, 8, c.skin);
			p.rect(11, 19, 7, 1, c.skin);
			p.rect(13, 20, 4, 1, c.skin);
			p.px(18, 16, c.skin);
		} else {
			p.sym(12, 21, 2, 1, c.skinShade);
			p.sym(10, 10, 4, 1, c.skin);
			p.sym(9, 11, 5, 8, c.skin);
			p.sym(10, 19, 4, 1, c.skin);
			p.sym(11, 20, 3, 1, c.skin);
		}
	}

	function drawFace(p, dir, c) {
		const dark = '#1c1222';
		const white = '#f4efe0';
		const red = '#d8323e';
		if (dir === 'down') {
			p.sym(13, 13, 1, 1, c.skinShade);   // метка на лбу
			p.sym(10, 14, 3, 1, dark);          // ресницы
			p.sym(9, 15, 1, 1, dark);
			p.sym(10, 15, 1, 2, white);
			p.sym(11, 15, 2, 2, c.eyes);
			p.px(11, 15, shade(c.eyes, 1.5));   // блик
			p.px(15, 15, shade(c.eyes, 1.5));
			p.sym(11, 17, 1, 1, red);           // красные чёрточки под глазами
			p.sym(13, 19, 1, 1, c.skinShade);   // рот
		} else if (dir === 'side') {
			p.rect(15, 14, 3, 1, dark);
			p.px(18, 15, dark);
			p.px(15, 15, white);
			p.px(15, 16, white);
			p.rect(16, 15, 2, 2, c.eyes);
			p.px(16, 15, shade(c.eyes, 1.5));
			p.px(16, 17, red);
			p.px(17, 19, c.skinShade);
		}
	}

	// волосы

	function drawHairBack(p, dir, style, c) {
		if (style !== 'long') return;
		if (dir === 'down') {
			p.sym(7, 12, 3, 17, c.hairShade);
			p.sym(6, 16, 1, 8, c.hairShade);
			p.sym(7, 29, 1, 2, c.hairShade);
			p.sym(9, 29, 1, 1, c.hairShade);
		} else if (dir === 'side') {
			p.rect(8, 12, 5, 17, c.hairShade);
			p.rect(7, 15, 1, 10, c.hairShade);
			p.dots([[8, 29], [8, 30], [10, 29], [12, 29]], c.hairShade);
		}
	}

	function drawHairFront(p, dir, style, c) {
		const hi = c.hairLight;
		if (dir === 'down') {
			p.sym(11, 8, 3, 1, c.hair);
			p.sym(9, 9, 5, 1, c.hair);
			p.sym(8, 10, 6, 2, c.hair);
			p.sym(8, 12, 5, 1, c.hair);
			p.sym(8, 13, 2, 1, c.hair);
			p.px(12, 13, c.hair);
			p.sym(8, 14, 1, style === 'short' ? 4 : 8, c.hair);
			p.dots([[11, 9], [12, 9], [10, 10], [16, 9]], hi);
			if (style === 'bun') {
				p.sym(12, 5, 2, 3, c.hair);
				p.sym(11, 6, 1, 2, c.hair);
				p.px(13, 5, hi);
			}
		} else if (dir === 'side') {
			p.rect(11, 8, 6, 1, c.hair);
			p.rect(9, 9, 9, 1, c.hair);
			p.rect(9, 10, 10, 2, c.hair);
			p.rect(9, 12, 4, 6, c.hair);
			p.rect(15, 12, 4, 1, c.hair);
			p.px(18, 13, c.hair);
			p.rect(12, 13, 2, 4, c.hairShade);
			if (style !== 'short') p.rect(9, 18, 3, 3, c.hair);
			p.dots([[12, 9], [13, 9], [14, 10]], hi);
			if (style === 'bun') {
				p.rect(9, 6, 3, 3, c.hair);
				p.px(10, 6, hi);
			}
		} else {
			p.sym(11, 8, 3, 1, c.hair);
			p.sym(9, 9, 5, 1, c.hair);
			p.sym(8, 10, 6, 11, c.hair);
			if (style === 'long') {
				p.sym(9, 21, 5, 8, c.hair);
				p.sym(8, 23, 1, 5, c.hair);
				p.symDots([[9, 29], [11, 29], [13, 29]], c.hair);
			} else {
				p.sym(10, 21, 4, 1, c.hair);
			}
			p.symDots([[12, 10], [11, 12], [12, 16]], c.hairShade);
			p.dots([[11, 9], [12, 9], [15, 10]], hi);
			if (style === 'bun') {
				p.sym(12, 5, 2, 3, c.hair);
				p.sym(11, 6, 1, 2, c.hair);
			}
		}
	}

	// одежда фракций

	const FACTIONS = {};

	// Порождённые: рога, рваное тёмное платье с бусами, полосатые гетры
	FACTIONS.spawn = {
		name: 'Порождённые',
		color: '#9b7bc4',
		about: 'Рога, рваное тёмное платье с бусами, полосатые гетры.',
		behind(p, g, dir) {
			const cape = '#2c2434';
			if (dir === 'down') {
				p.rect(8, 23, 12, 16, cape);
				p.dots([[8, 39], [8, 40], [9, 39], [11, 39], [17, 39], [18, 39], [19, 39], [19, 40], [19, 41]], cape);
			} else if (dir === 'side') {
				p.rect(8, 22, 4, 17, cape);
				p.dots([[7, 30], [7, 33], [7, 34], [8, 39], [8, 40], [10, 39], [11, 39]], cape);
			}
		},
		body(p, g, dir, c) {
			const dress = '#433650';
			const dressDark = '#30273c';
			const olive = '#5f6c3c';
			const stripeA = '#2e2230';
			const stripeB = '#b4466f';
			const warmer = '#5b3d2e';
			const beads = '#f2c2d0';

			// полосатые гетры до колена
			for (let y = 35; y <= 44; y++) {
				p.band(g.legs, y, y, y % 2 ? stripeA : stripeB);
				p.band(g.feet, y, y, y % 2 ? stripeA : stripeB);
			}
			p.band(g.feet, 44, 44, c.skinShade);

			// руки: голые плечи, тёмные нарукавники
			p.band(g.arms, 26, 30, warmer);
			p.band(g.arms, 26, 26, shade(warmer, 1.3));

			// платье
			p.fill(g.torso, dress);
			const skirt = dir === 'side' ? [[10, 8, 33], [10, 8, 34], [9, 9, 35], [9, 9, 36]] : [[9, 10, 33], [9, 10, 34], [8, 12, 35], [8, 12, 36]];
			for (const [x, w, y] of skirt) p.rect(x, y, w, 1, dress);
			const hemY = 37;
			const hem = dir === 'side' ? [9, 11, 13, 15, 17] : [8, 10, 12, 15, 17, 19];
			for (const x of hem) p.px(x, hemY, dress);
			p.band(g.torso, 29, 29, '#2a1f1c');      // пояс
			if (dir === 'side') {
				p.rect(11, 30, 2, 6, olive);
				p.rect(12, 22, 3, 1, dressDark);
				p.dots([[16, 21], [17, 22]], dressDark);
			} else {
				p.rect(9, 30, 3, 6, olive);
				p.rect(16, 31, 2, 5, dressDark);
				// рваный воротник
				p.symDots([[9, 21], [10, 21], [8, 20], [9, 22]], dressDark);
				if (dir === 'down') {
					p.symDots([[10, 22], [11, 24], [12, 25], [13, 26]], beads);
					p.dots([[13, 27], [14, 27]], '#ffffff');
					p.sym(13, 29, 1, 1, '#6a5a50');
				}
			}
			if (dir !== 'side') p.band(g.torso, 22, 22, dressDark);
		},
		head(p, dir) {
			const horn = '#5a3d2a';
			const tip = '#7a5a40';
			const left = [[10, 9], [11, 9], [10, 8], [11, 8], [9, 7], [10, 7], [9, 6], [10, 6], [8, 5], [9, 5], [8, 4], [9, 4],
				[7, 3], [8, 3], [7, 2], [10, 5], [11, 4], [11, 3], [12, 3], [8, 6], [7, 6], [7, 5], [6, 5], [6, 4], [5, 4]];
			const tips = [[7, 1], [12, 2], [5, 3]];
			if (dir === 'side') {
				const shift = ([x, y]) => [x + 3, y];
				p.dots(left.map(shift), horn);
				p.dots(tips.map(shift), tip);
			} else {
				p.symDots(left, horn);
				p.symDots(tips, tip);
			}
		},
	};

	// Зиккурат: шляпа с пером, тёмный двубортный камзол с розовыми пуговицами, штаны с заплатками, сапоги
	FACTIONS.zig = {
		name: 'Зиккурат',
		color: '#e07aa0',
		about: 'Шляпа с пером, тёмный камзол с розовыми пуговицами, штаны с заплатками, сапоги.',
		behind() {},
		body(p, g, dir) {
			const coat = '#3a2a22';
			const coatDark = '#2a1d18';
			const lapel = '#5a4234';
			const button = '#e98bb0';
			const pants = '#2e2320';
			const patch = '#6f9a72';
			const boot = '#3b2820';
			const bootTop = '#5b4030';
			const buckle = '#d9d0bc';
			const glove = '#4a2e22';

			p.fill(g.legs, pants);
			p.band(g.legs, 38, 44, boot);
			p.fill(g.feet, boot);
			p.band(g.legs, 38, 38, bootTop);
			p.band(g.legs, 40, 40, buckle);
			if (dir === 'down') {
				p.dots([[10, 35], [11, 35], [10, 36], [11, 36]], patch);
				p.dots([[16, 34], [17, 35]], patch);
			} else if (dir === 'side') {
				p.dots([[13, 34], [14, 35], [13, 35]], patch);
			} else {
				p.dots([[15, 35], [16, 35], [16, 36]], patch);
			}

			p.fill(g.arms, coat);
			p.band(g.arms, 29, 30, lapel);
			p.fill(g.hands, glove);

			p.fill(g.torso, coat);
			if (dir === 'side') {
				p.rect(10, 31, 8, 3, coat);
				p.rect(15, 22, 2, 1, '#c8c2b0');
				p.dots([[16, 24], [16, 26], [16, 28]], button);
				p.rect(11, 30, 6, 1, coatDark);
			} else {
				p.rect(9, 31, 10, 3, coat);
				p.band(g.torso, 30, 30, coatDark);
				if (dir === 'down') {
					p.sym(13, 22, 1, 2, '#c8c2b0');   // ворот рубашки
					p.symDots([[11, 22], [12, 23], [12, 24], [11, 25]], lapel);
					p.symDots([[11, 24], [11, 26], [11, 28], [12, 32]], button);
					p.sym(13, 31, 1, 3, coatDark);
				} else {
					p.sym(13, 22, 1, 11, coatDark);
				}
			}
		},
		head(p, dir) {
			const hat = '#4a3226';
			const band = '#2b1c16';
			const brim = '#3c281e';
			const feather = '#e8e4d8';
			if (dir === 'side') {
				p.rect(10, 4, 8, 4, hat);
				p.rect(11, 3, 6, 1, hat);
				p.rect(10, 8, 8, 1, band);
				p.rect(6, 9, 16, 1, brim);
				p.rect(15, 10, 6, 1, brim);
				p.dots([[9, 6], [8, 5], [7, 5], [6, 4], [5, 4], [4, 3], [8, 6], [7, 6]], feather);
			} else {
				p.sym(9, 4, 5, 4, hat);
				p.sym(10, 3, 4, 1, hat);
				p.px(13, 3, band);
				p.px(14, 3, band);
				p.sym(9, 8, 5, 1, band);
				p.sym(5, 9, 9, 1, brim);
				p.sym(6, 10, 3, 1, brim);
				p.px(4, 10, brim);
				p.dots([[19, 7], [20, 6], [21, 6], [22, 5], [23, 5], [24, 4], [25, 4], [20, 7], [21, 7], [22, 6]], feather);
			}
		},
	};

	// Мракоборцы: светлый плащ с капюшоном, длинное светлое одеяние, перчатки
	FACTIONS.bane = {
		name: 'Мракоборцы',
		color: '#9fd0d8',
		about: 'Светлый плащ с капюшоном, длинное светлое одеяние, перчатки.',
		behind(p, g, dir) {
			const cloak = '#a9bcbd';
			if (dir === 'down') p.rect(7, 22, 14, 20, cloak);
			if (dir === 'side') p.rect(8, 21, 5, 20, cloak);
		},
		body(p, g, dir) {
			const robe = '#d3dfdc';
			const fold = '#a9bcbd';
			const belt = '#5a3a28';
			const buckle = '#a37a50';
			const glove = '#5b3a2a';
			const boot = '#4a2e2a';

			p.fill(g.feet, boot);
			p.fill(g.arms, robe);
			p.band(g.arms, 22, 23, fold);
			p.band(g.arms, 28, 30, glove);
			p.fill(g.hands, glove);

			p.fill(g.torso, robe);
			// длинный подол расширяется книзу
			for (let y = 33; y <= 43; y++) {
				const grow = Math.floor((y - 33) / 3);
				if (dir === 'side') p.rect(11 - grow, y, 7 + grow * 2, 1, robe);
				else p.rect(10 - grow, y, 8 + grow * 2, 1, robe);
			}
			if (dir === 'side') {
				p.dots([[12, 36], [11, 39], [10, 42]], fold);
				p.rect(11, 28, 6, 2, belt);
				p.px(16, 28, buckle);
			} else {
				p.dots([[11, 35], [10, 38], [9, 41], [16, 35], [17, 38], [18, 41], [13, 34], [13, 38], [13, 42]], fold);
				p.band(g.torso, 28, 29, belt);
				if (dir === 'down') {
					p.sym(13, 28, 1, 2, buckle);
					p.symDots([[12, 22], [13, 23]], fold);
				}
			}
		},
		head(p, dir) {
			const hood = '#c9d6d4';
			const inner = '#8fa4a6';
			if (dir === 'side') {
				p.rect(10, 6, 7, 1, hood);
				p.rect(9, 7, 9, 4, hood);
				p.rect(8, 11, 6, 10, hood);
				p.rect(8, 21, 8, 2, hood);
				p.rect(14, 11, 1, 1, inner);
				p.dots([[11, 5], [10, 4], [9, 4]], hood);
			} else if (dir === 'down') {
				p.sym(10, 6, 4, 1, hood);
				p.sym(8, 7, 6, 3, hood);
				p.sym(7, 10, 2, 11, hood);
				p.sym(7, 21, 5, 2, hood);
				p.sym(9, 10, 5, 1, inner);
				p.sym(9, 11, 1, 9, inner);
				p.dots([[18, 5], [19, 4], [20, 3]], hood);
			} else {
				p.sym(10, 6, 4, 1, hood);
				p.sym(8, 7, 6, 16, hood);
				p.sym(7, 10, 1, 11, hood);
				p.symDots([[12, 12], [11, 16]], '#a9bcbd');
				p.dots([[9, 5], [8, 4], [7, 3]], hood);
			}
			// маленький светящийся шарик рядом
			p.rect(23, 1, 2, 2, '#c8f0ff');
			p.px(23, 1, '#ffffff');
		},
	};

	// сборка

	const cache = new Map();

	function colorsOf(look) {
		return {
			skin: look.skin,
			skinShade: shade(look.skin, 0.8),
			hair: look.hair,
			hairShade: shade(look.hair, 0.78),
			hairLight: shade(look.hair, 1.4),
			eyes: look.eyes,
		};
	}

	function render(look, dir, frame) {
		const faction = FACTIONS[look.faction] || FACTIONS.spawn;
		const c = colorsOf(look);
		const base = dir === 'left' || dir === 'right' ? 'side' : dir;
		const g = geometry(base, frame);
		const p = new Pixels();

		if (base !== 'up') faction.behind(p, g, base, c);
		drawHairBack(p, base, look.hairStyle, c);
		drawBody(p, g, base, c);
		faction.body(p, g, base, c);
		if (base !== 'side') {
			// тень на внутренней стороне рук, чтобы рукав не сливался с телом
			for (let y = 23; y <= 30; y++) {
				for (const x of [9, 18]) {
					const v = p.data[y * W + x];
					if (v) p.data[y * W + x] = shade(v, 0.78);
				}
			}
		}
		drawFace(p, base, c);
		drawHairFront(p, base, look.hairStyle, c);
		if (base === 'up' && look.faction === 'spawn') {
			// в виде со спины рваный плащ поверх
			const cape = '#2c2434';
			p.rect(9, 23, 10, 15, cape);
			p.dots([[9, 38], [11, 38], [12, 39], [16, 38], [18, 38], [18, 39]], cape);
		}
		if (base === 'up' && look.faction === 'bane') {
			p.rect(9, 23, 10, 18, '#c2d0ce');
			p.dots([[13, 26], [13, 30], [14, 34]], '#a9bcbd');
		}
		faction.head(p, base, c);

		// обводка
		const out = p.data.slice();
		for (let y = 0; y < H; y++) {
			for (let x = 0; x < W; x++) {
				if (p.data[y * W + x]) continue;
				const near = (x > 0 && p.data[y * W + x - 1]) || (x < W - 1 && p.data[y * W + x + 1]) ||
					(y > 0 && p.data[(y - 1) * W + x]) || (y < H - 1 && p.data[(y + 1) * W + x]);
				if (near) out[y * W + x] = OUTLINE;
			}
		}

		const canvas = document.createElement('canvas');
		canvas.width = W;
		canvas.height = H;
		const ctx = canvas.getContext('2d');
		const image = ctx.createImageData(W, H);
		for (let i = 0; i < out.length; i++) {
			if (!out[i]) continue;
			let x = i % W;
			const y = (i / W) | 0;
			if (dir === 'left') x = W - 1 - x;
			const [r, gg, b] = toRgb(out[i]);
			const k = (y * W + x) * 4;
			image.data[k] = r;
			image.data[k + 1] = gg;
			image.data[k + 2] = b;
			image.data[k + 3] = 255;
		}
		ctx.putImageData(image, 0, 0);
		return canvas;
	}

	function get(look, dir, frame) {
		const key = [look.faction, look.skin, look.hair, look.hairStyle, look.eyes, dir, frame].join('|');
		let canvas = cache.get(key);
		if (!canvas) {
			canvas = render(look, dir, frame);
			cache.set(key, canvas);
		}
		return canvas;
	}

	window.SGLSprite = {
		W, H,
		FOOT_X: 14,
		FOOT_Y: 44,
		FACTIONS,
		get,
		shade,
		// по кругу шага: шаг, стоя, другой шаг, стоя
		walkFrame(t) {
			return [1, 0, 2, 0][Math.floor(t * 8) % 4];
		},
	};
})();
