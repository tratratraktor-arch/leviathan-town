import { Pony, PaletteSpriteBatch, Palette, SkinAnimations, SkinAnimationName } from '../common/interfaces';
import { colorFromRGBA } from '../common/color';
import { WHITE } from '../common/colors';
import { Texture2D, createTexture, bindTexture, disposeTexture } from '../graphics/webgl/texture2d';
import { BaseSpriteBatch } from '../graphics/baseSpriteBatch';
import { paletteSpriteSheet } from '../generated/sprites';

// Leviathan Town: draws ponies that have a skin made from sprite strips instead of the regular pony sprites.
// A strip is turned into a palette sprite (red channel = color index) so it goes through the same shader
// as the rest of the game and gets the same lighting.

const FPS = 24;
const BLINK_INTERVAL = 4; // seconds between blinks in the standing strip
const MAX_COLORS = 128; // the palette shader is only exact for low color indices
const SPRITE_TYPE = 3; // sprite type that reads the color index from the red channel, without shading

interface LoadedAnimation {
	frames: number;
	width: number; // frame width
	height: number;
	y: number; // row in the skin texture
	ax: number;
	ay: number;
}

interface LoadedSkin {
	pixels: ImageData;
	colors: Uint32Array;
	anims: { [K in SkinAnimationName]?: LoadedAnimation };
	gl?: WebGLRenderingContext;
	texture?: Texture2D;
	palette?: Palette;
}

const skins = new Map<string, LoadedSkin | null>();

function loadImage(src: string) {
	return new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error('Failed to load skin image'));
		image.src = src;
	});
}

function getImageData(image: HTMLImageElement) {
	const canvas = document.createElement('canvas');
	canvas.width = image.width;
	canvas.height = image.height;
	const context = canvas.getContext('2d')!;
	context.drawImage(image, 0, 0);
	return context.getImageData(0, 0, image.width, image.height);
}

function colorDistance(a: number, b: number) {
	const dr = ((a >>> 24) & 0xff) - ((b >>> 24) & 0xff);
	const dg = ((a >>> 16) & 0xff) - ((b >>> 16) & 0xff);
	const db = ((a >>> 8) & 0xff) - ((b >>> 8) & 0xff);
	const da = (a & 0xff) - (b & 0xff);
	return dr * dr + dg * dg + db * db + da * da;
}

// picks up to MAX_COLORS colors, index 0 is transparent, rare extra colors go to the closest kept color
function createPalette(images: ImageData[]) {
	const counts = new Map<number, number>();

	for (const { data } of images) {
		for (let i = 0; i < data.length; i += 4) {
			if (data[i + 3] !== 0) {
				const color = colorFromRGBA(data[i], data[i + 1], data[i + 2], data[i + 3]);
				counts.set(color, (counts.get(color) || 0) + 1);
			}
		}
	}

	const sorted = Array.from(counts.keys()).sort((a, b) => counts.get(b)! - counts.get(a)!);
	const kept = sorted.slice(0, MAX_COLORS - 1);
	const indices = new Map<number, number>();
	kept.forEach((color, i) => indices.set(color, i + 1));

	for (const color of sorted.slice(MAX_COLORS - 1)) {
		let best = 0;
		let bestDistance = Infinity;

		kept.forEach((other, i) => {
			const distance = colorDistance(color, other);

			if (distance < bestDistance) {
				bestDistance = distance;
				best = i + 1;
			}
		});

		indices.set(color, best);
	}

	return { colors: new Uint32Array([0, ...kept]), indices };
}

async function loadSkin(id: string): Promise<LoadedSkin> {
	const response = await fetch(`/api/skin/${id}`, { credentials: 'same-origin' });

	if (!response.ok) {
		throw new Error(`Failed to load skin (${response.status})`);
	}

	const data: SkinAnimations = await response.json();
	const names = Object.keys(data) as SkinAnimationName[];
	const images = await Promise.all(names.map(name => loadImage(data[name]!.src).then(getImageData)));
	const width = Math.max(...images.map(i => i.width));
	const height = images.reduce((sum, i) => sum + i.height, 0);
	const { colors, indices } = createPalette(images);
	const pixels = new ImageData(width, height);
	const anims: LoadedSkin['anims'] = {};
	let y = 0;

	for (let i = 0; i < pixels.data.length; i += 4) {
		pixels.data[i + 1] = 255;
		pixels.data[i + 3] = 255;
	}

	names.forEach((name, n) => {
		const image = images[n];
		const anim = data[name]!;
		const src = image.data;

		for (let py = 0; py < image.height; py++) {
			for (let px = 0; px < image.width; px++) {
				const i = (py * image.width + px) * 4;

				if (src[i + 3] !== 0) {
					const color = colorFromRGBA(src[i], src[i + 1], src[i + 2], src[i + 3]);
					pixels.data[((y + py) * width + px) * 4] = indices.get(color)!;
				}
			}
		}

		const frames = Math.max(1, anim.frames | 0);
		anims[name] = { frames, width: Math.floor(image.width / frames), height: image.height, y, ax: anim.ax, ay: anim.ay };
		y += image.height;
	});

	return { pixels, colors, anims };
}

function getSkin(pony: Pony, gl: WebGLRenderingContext): LoadedSkin | undefined {
	const id = pony.skin!;

	if (!skins.has(id)) {
		skins.set(id, null);
		loadSkin(id)
			.then(skin => skins.set(id, skin))
			.catch(e => console.error(e));
	}

	const skin = skins.get(id);

	if (!skin) {
		return undefined;
	}

	if (skin.gl !== gl) { // first draw or the WebGL context was recreated
		skin.texture = createTexture(gl, skin.pixels);
		skin.gl = gl;
	}

	if (!skin.palette || skin.palette.refs <= 0) {
		skin.palette = pony.paletteManager.addArray(skin.colors);
	}

	return skin;
}

export function releaseSkins() {
	skins.forEach(skin => {
		if (skin) {
			skin.texture = disposeTexture(skin.gl, skin.texture);
			skin.gl = undefined;
		}
	});
}

function pickAnimation(name: string): SkinAnimationName[] {
	if (/-to-trot/.test(name)) {
		return ['walk', 'stand'];
	} else if (/fly/.test(name)) {
		return ['fly', 'walk', 'stand'];
	} else if (/^lie/.test(name)) {
		return ['lie', 'sit', 'stand'];
	} else if (/^sit/.test(name)) {
		return ['sit', 'stand'];
	} else if (/trot|swim/.test(name)) {
		return ['walk', 'stand'];
	} else if (name === 'boop') {
		return ['boop', 'stand'];
	} else {
		return ['stand'];
	}
}

function getFrame(skin: LoadedSkin, pony: Pony, time: number) {
	const animation = pony.ponyState.animation;
	const name = pickAnimation(animation.name).find(name => !!skin.anims[name])!;
	const anim = skin.anims[name]!;
	let frame: number;

	if (name === 'boop') {
		const progress = pony.ponyState.animationFrame / Math.max(1, animation.frames.length);
		frame = Math.min(anim.frames - 1, Math.floor(progress * anim.frames));
	} else if (name === 'stand') {
		// first frame is the idle pose, the rest is a blink
		const t = (time + pony.id * 1.7) % BLINK_INTERVAL;
		frame = Math.floor(t * FPS) + 1;
		frame = frame < anim.frames ? frame : 0;
	} else {
		frame = Math.floor((time + pony.id * 0.37) * FPS) % anim.frames;
	}

	return { anim, frame };
}

// returns false while the skin is still loading, the regular pony is drawn then
export function drawSkinPony(batch: PaletteSpriteBatch, pony: Pony, gameTime: number): boolean {
	// only the WebGL batch can switch textures, previews drawn on a 2d canvas keep the regular pony
	const webglBatch = batch as unknown as BaseSpriteBatch;
	const gl = typeof webglBatch.flush === 'function' ? webglBatch.gl : undefined;
	const skin = gl && getSkin(pony, gl);

	if (!gl || !skin || !skin.anims.stand || !skin.texture || !paletteSpriteSheet.texture) {
		return false;
	}

	const { anim, frame } = getFrame(skin, pony, gameTime / 1000);
	// the shader divides texture coordinates by the size of the main sprite sheet, scale them to the skin texture
	const textureSize = paletteSpriteSheet.texture.width;
	const kx = textureSize / skin.texture.width;
	const ky = textureSize / skin.texture.height;

	webglBatch.flush();
	bindTexture(gl, 0, skin.texture);
	batch.drawImage(
		SPRITE_TYPE, WHITE, skin.palette, frame * anim.width * kx, anim.y * ky, anim.width * kx, anim.height * ky,
		-anim.ax, -anim.ay, anim.width, anim.height);
	webglBatch.flush();
	bindTexture(gl, 0, paletteSpriteSheet.texture);
	return true;
}
