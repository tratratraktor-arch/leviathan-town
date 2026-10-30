// Menus: nickname first, then the skin import, then the game.
// The nickname and the skin id are kept in this browser (localStorage), there are no accounts yet.

import { SKIN_ANIMATIONS, importStrip, framesFromFileName } from './skin-import.js';
import { prepareSkin, pickFrame, drawStrip } from './skins.js';
import { startGame } from './game.js';

const PROFILE_KEY = 'leviathan-profile';

function loadProfile() {
	try {
		return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {};
	} catch {
		return {};
	}
}

function saveProfile(profile) {
	try {
		localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
	} catch {
		// private mode: the profile lives until the tab is closed
	}
}

const profile = loadProfile();
const $ = id => document.getElementById(id);

function show(screen) {
	for (const id of ['name-screen', 'skin-screen', 'game-screen']) {
		$(id).hidden = id !== screen;
	}
}

// nickname

function showName() {
	show('name-screen');
	$('name-input').value = profile.name || '';
	$('name-input').focus();
}

$('name-form').addEventListener('submit', event => {
	event.preventDefault();
	const name = $('name-input').value.replace(/\s+/g, ' ').trim();

	if (!name) {
		$('name-error').textContent = 'Введи ник';
		$('name-error').hidden = false;
		return;
	}

	$('name-error').hidden = true;
	profile.name = name;
	saveProfile(profile);

	if (profile.skin) {
		location.reload(); // join again with the new name
	} else {
		showSkin();
	}
});

// skin import

const slots = SKIN_ANIMATIONS.map(info => ({ info, frames: info.frames, file: null, strip: null, loading: false }));
let previewTimer = 0;

function renderSlots() {
	const container = $('slots');
	container.textContent = '';

	for (const slot of slots) {
		const row = document.createElement('div');
		row.className = 'slot';
		row.innerHTML = `
			<canvas width="64" height="64"></canvas>
			<div class="slot-info">
				<b>${slot.info.label}${slot.info.required ? '<span class="req"> *</span>' : ''}</b>
				<div class="slot-file"></div>
			</div>
			<div><label class="small">кадров</label><input type="number" min="1" max="64"></div>
			<label class="file-button">Файл<input type="file" accept="image/png"></label>`;

		const status = row.querySelector('.slot-file');
		const framesInput = row.querySelector('input[type=number]');
		const fileInput = row.querySelector('input[type=file]');

		if (slot.error) {
			status.textContent = slot.error;
			status.classList.add('error');
		} else if (slot.loading) {
			status.textContent = 'обрабатываю…';
		} else if (slot.strip) {
			status.textContent = `${slot.file.name} · ${slot.strip.width}×${slot.strip.height}`;
		} else {
			status.textContent = 'не загружено';
		}

		framesInput.value = slot.frames;
		framesInput.addEventListener('change', () => {
			const frames = parseInt(framesInput.value, 10);

			if (frames >= 1 && frames <= 64 && frames !== slot.frames) {
				slot.frames = frames;
				slot.file && importSlot(slot);
			}
		});

		fileInput.addEventListener('change', () => {
			const file = fileInput.files[0];

			if (file) {
				slot.file = file;
				slot.frames = framesFromFileName(file.name) || slot.frames;
				importSlot(slot);
			}
		});

		slot.canvas = row.querySelector('canvas');
		container.appendChild(row);
	}

	$('skin-save').disabled = !slots[0].strip || slots.some(s => s.loading);
}

async function importSlot(slot) {
	const file = slot.file;
	slot.loading = true;
	slot.error = null;
	renderSlots();

	try {
		const strip = await importStrip(file, slot.frames);
		const prepared = await prepareSkin({ [slot.info.name]: strip });

		if (slot.file === file) {
			slot.strip = strip;
			slot.preview = prepared[slot.info.name];
		}
	} catch (e) {
		slot.error = e.message;
	}

	slot.loading = false;
	renderSlots();
}

function drawPreviews() {
	const time = performance.now() / 1000;

	for (const slot of slots) {
		const context = slot.canvas && slot.canvas.getContext('2d');

		if (context) {
			context.clearRect(0, 0, 64, 64);

			if (slot.preview) {
				const frame = Math.floor(time * 24) % slot.preview.frames;
				drawStrip(context, slot.preview, frame, 32, 60, false);
			}
		}
	}
}

function showSkin() {
	show('skin-screen');
	renderSlots();
	clearInterval(previewTimer);
	previewTimer = setInterval(drawPreviews, 1000 / 24);
}

$('skin-back').addEventListener('click', showName);

$('skin-save').addEventListener('click', async () => {
	const anims = {};

	for (const slot of slots) {
		if (slot.strip) {
			const { src, frames, ax, ay } = slot.strip;
			anims[slot.info.name] = { src, frames, ax, ay };
		}
	}

	$('skin-save').disabled = true;
	$('skin-error').hidden = true;

	try {
		const response = await fetch('/api/skin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(anims),
		});
		const result = await response.json();

		if (!response.ok) {
			throw new Error(result.error || 'Не получилось сохранить');
		}

		profile.skin = result.id;
		saveProfile(profile);
		location.reload(); // start the game with the new skin
	} catch (e) {
		$('skin-error').textContent = e.message;
		$('skin-error').hidden = false;
		$('skin-save').disabled = false;
	}
});

// start

if (!profile.name) {
	showName();
} else if (!profile.skin) {
	showSkin();
} else {
	show('game-screen');
	startGame(profile, {
		changePony: showSkin,
		changeName: showName,
	});
}
