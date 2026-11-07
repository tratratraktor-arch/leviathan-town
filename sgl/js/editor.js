// Редактор персонажа: имя, фракция, кожа, волосы, глаза.
// Выбор фракции сам надевает её одежду. Готовый персонаж сохраняется в браузере
// (localStorage), поэтому при следующем заходе он уже на месте.
(function () {
	'use strict';

	const STORAGE_KEY = 'sgl.character';

	const SKINS = ['#a9e3c4', '#f2d3b3', '#e0b48e', '#b07a52', '#6e4a34', '#c9c3e6', '#9ec9e8', '#e4e6dc'];
	const HAIRS = ['#b8f5c8', '#f4f0e0', '#e2c05a', '#c8743a', '#6a3a22', '#2a2230', '#d65a7a', '#7a9cf0', '#9a6ad0'];
	const EYES = ['#2a1a14', '#7a2a2a', '#c02040', '#2a6a4a', '#2a4a8a', '#d0a030', '#6a3a9a'];
	const STYLES = [['long', 'Длинные'], ['short', 'Короткие'], ['bun', 'Пучок']];
	const ORDER = ['spawn', 'zig', 'bane'];
	const DIRS = ['down', 'left', 'up', 'right'];

	const look = {
		name: 'Левиафанец',
		faction: 'spawn',
		skin: SKINS[0],
		hair: HAIRS[0],
		hairStyle: 'long',
		eyes: EYES[0],
	};

	function load() {
		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
			if (saved && typeof saved === 'object') {
				if (typeof saved.name === 'string') look.name = saved.name.slice(0, 20);
				if (ORDER.includes(saved.faction)) look.faction = saved.faction;
				if (SKINS.includes(saved.skin)) look.skin = saved.skin;
				if (HAIRS.includes(saved.hair)) look.hair = saved.hair;
				if (EYES.includes(saved.eyes)) look.eyes = saved.eyes;
				if (STYLES.some(s => s[0] === saved.hairStyle)) look.hairStyle = saved.hairStyle;
				return true;
			}
		} catch (e) { /* браузер не даёт хранить: просто начинаем с начала */ }
		return false;
	}

	function save() {
		try { localStorage.setItem(STORAGE_KEY, JSON.stringify(look)); } catch (e) { /* не страшно */ }
	}

	let dirIndex = 0;
	let walking = true;
	let previewCtx;
	let cards = [];
	let open = false;

	function drawSprite(ctx, l, dir, frame) {
		const s = SGLSprite.get(l, dir, frame);
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		ctx.drawImage(s, 0, 0);
	}

	function refreshCards() {
		for (const card of cards) {
			const l = Object.assign({}, look, { faction: card.faction });
			drawSprite(card.ctx, l, 'down', 0);
			card.el.classList.toggle('selected', card.faction === look.faction);
			card.el.setAttribute('aria-pressed', card.faction === look.faction ? 'true' : 'false');
		}
		const f = SGLSprite.FACTIONS[look.faction];
		document.getElementById('faction-about').textContent = f.about;
		document.documentElement.style.setProperty('--faction', f.color);
	}

	function swatches(id, list, key) {
		const box = document.getElementById(id);
		box.innerHTML = '';
		for (const color of list) {
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'swatch';
			b.style.background = color;
			b.title = color;
			b.setAttribute('aria-label', color);
			b.addEventListener('click', () => {
				look[key] = color;
				mark();
				refreshCards();
			});
			b.dataset.value = color;
			box.appendChild(b);
		}
	}

	function mark() {
		for (const [id, key] of [['skin', 'skin'], ['hair', 'hair'], ['eyes', 'eyes'], ['hair-style', 'hairStyle']]) {
			for (const b of document.getElementById(id).children) b.classList.toggle('selected', b.dataset.value === look[key]);
		}
	}

	function previewLoop(time) {
		if (!open) return;
		const frame = walking ? SGLSprite.walkFrame(time / 1000) : 0;
		drawSprite(previewCtx, look, DIRS[dirIndex], frame);
		requestAnimationFrame(previewLoop);
	}

	window.SGLEditor = {
		look,
		hasSaved: load,
		init(onPlay) {
			previewCtx = document.getElementById('preview').getContext('2d');

			const box = document.getElementById('factions');
			for (const key of ORDER) {
				const f = SGLSprite.FACTIONS[key];
				const el = document.createElement('button');
				el.type = 'button';
				el.className = 'faction';
				el.style.setProperty('--c', f.color);
				const c = document.createElement('canvas');
				c.width = SGLSprite.W;
				c.height = SGLSprite.H;
				const label = document.createElement('span');
				label.textContent = f.name;
				el.append(c, label);
				el.addEventListener('click', () => {
					look.faction = key;
					refreshCards();
				});
				box.appendChild(el);
				cards.push({ faction: key, el, ctx: c.getContext('2d') });
			}

			swatches('skin', SKINS, 'skin');
			swatches('hair', HAIRS, 'hair');
			swatches('eyes', EYES, 'eyes');

			const styles = document.getElementById('hair-style');
			for (const [value, text] of STYLES) {
				const b = document.createElement('button');
				b.type = 'button';
				b.className = 'chip';
				b.textContent = text;
				b.dataset.value = value;
				b.addEventListener('click', () => {
					look.hairStyle = value;
					mark();
					refreshCards();
				});
				styles.appendChild(b);
			}

			const name = document.getElementById('name');
			name.value = look.name;
			name.addEventListener('input', () => { look.name = name.value.slice(0, 20); });

			document.getElementById('turn-left').addEventListener('click', () => { dirIndex = (dirIndex + 3) % 4; });
			document.getElementById('turn-right').addEventListener('click', () => { dirIndex = (dirIndex + 1) % 4; });
			const walkBtn = document.getElementById('walk-toggle');
			walkBtn.addEventListener('click', () => {
				walking = !walking;
				walkBtn.textContent = walking ? 'Стоять' : 'Шагать';
			});

			document.getElementById('random').addEventListener('click', () => {
				const pick = list => list[Math.floor(Math.random() * list.length)];
				look.skin = pick(SKINS);
				look.hair = pick(HAIRS);
				look.eyes = pick(EYES);
				look.hairStyle = pick(STYLES)[0];
				mark();
				refreshCards();
			});

			document.getElementById('play').addEventListener('click', () => {
				look.name = name.value.trim().slice(0, 20) || 'Левиафанец';
				name.value = look.name;
				save();
				onPlay(Object.assign({}, look));
			});

			mark();
			refreshCards();
		},
		show() {
			open = true;
			refreshCards();
			requestAnimationFrame(previewLoop);
		},
		hide() {
			open = false;
		},
	};
})();
