// Loading skins and picking the frame to draw.
// A skin is up to six strips: stand, walk, sit, lie, fly, boop. Each strip has its frames side by side
// and an anchor (ax, ay): the point under the hooves that is placed on the pony position.

export const FPS = 24;
const BLINK_INTERVAL = 4; // seconds between blinks in the standing strip

const cache = new Map(); // skin id -> Promise of the loaded skin

function loadImage(src) {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error('Не получилось загрузить картинку скина'));
		image.src = src;
	});
}

// anims: { stand: { src, frames, ax, ay }, ... } -> same with loaded images and frame width
export async function prepareSkin(anims) {
	const skin = {};

	for (const name of Object.keys(anims)) {
		const anim = anims[name];
		const image = await loadImage(anim.src);
		skin[name] = { ...anim, image, width: Math.floor(image.width / anim.frames), height: image.height };
	}

	return skin;
}

export function loadSkin(id) {
	if (!cache.has(id)) {
		cache.set(id, fetch(`/skins/${id}.json`)
			.then(response => {
				if (!response.ok) {
					throw new Error(`Скин не найден (${response.status})`);
				}

				return response.json();
			})
			.then(prepareSkin));
	}

	return cache.get(id);
}

// when a strip is missing the closest one is used instead
const FALLBACKS = {
	stand: ['stand'],
	walk: ['walk', 'stand'],
	sit: ['sit', 'stand'],
	lie: ['lie', 'sit', 'stand'],
	fly: ['fly', 'walk', 'stand'],
	boop: ['boop', 'stand'],
};

export function pickStrip(skin, anim) {
	const name = (FALLBACKS[anim] || FALLBACKS.stand).find(name => skin[name]);
	return { name, strip: skin[name] };
}

// time: seconds since the animation started (boop plays once, stand blinks now and then, the rest loops)
export function pickFrame(name, strip, time, seed = 0) {
	if (name === 'boop') {
		return Math.min(strip.frames - 1, Math.floor(time * FPS));
	} else if (name === 'stand') {
		const t = (time + seed) % BLINK_INTERVAL;
		const frame = Math.floor(t * FPS) + 1;
		return frame < strip.frames ? frame : 0;
	} else {
		return Math.floor(time * FPS) % strip.frames;
	}
}

export function boopDuration(skin) {
	return skin.boop ? skin.boop.frames / FPS : 0.5;
}

// draws a frame with the anchor at (x, y), facing right flips the strip (Pony Town strips face left)
export function drawStrip(context, strip, frame, x, y, facingRight) {
	context.save();
	context.translate(x, y);

	if (facingRight) {
		context.scale(-1, 1);
	}

	context.drawImage(strip.image, frame * strip.width, 0, strip.width, strip.height, -strip.ax, -strip.ay, strip.width, strip.height);
	context.restore();
}
