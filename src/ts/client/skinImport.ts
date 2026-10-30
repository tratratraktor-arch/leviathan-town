import { SkinAnimation, SkinAnimationName } from '../common/interfaces';

// Leviathan Town: turns a sprite strip exported from Pony Town (for example
// "pony-town-Nukie-trot-16-frames-shadow-padded-16x.png") into a strip at the native game scale.

export interface SkinAnimationInfo {
	name: SkinAnimationName;
	label: string;
	frames: number; // used when the file name does not say
	required?: boolean;
}

export const SKIN_ANIMATION_INFOS: SkinAnimationInfo[] = [
	{ name: 'stand', label: 'Анимация стояния', frames: 6, required: true },
	{ name: 'walk', label: 'Анимация ходьбы', frames: 16 },
	{ name: 'sit', label: 'Анимация сидения', frames: 1 },
	{ name: 'lie', label: 'Анимация лежания', frames: 1 },
	{ name: 'fly', label: 'Анимация полёта', frames: 12 },
	{ name: 'boop', label: 'Буп', frames: 12 },
];

const MAX_NATIVE_HEIGHT = 160;

export interface ImportedStrip extends SkinAnimation {
	width: number; // frame width
	height: number;
	scale: number;
}

function loadFile(file: File) {
	return new Promise<HTMLImageElement>((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const image = new Image();
		image.onload = () => {
			URL.revokeObjectURL(url);
			resolve(image);
		};
		image.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Не получилось открыть картинку'));
		};
		image.src = url;
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

function pixelAt({ data, width }: ImageData, x: number, y: number) {
	const i = (y * width + x) * 4;
	return (data[i + 3] === 0) ? 0 : ((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]) >>> 0;
}

function gcd(a: number, b: number): number {
	return b === 0 ? a : gcd(b, a % b);
}

// an upscaled pixel art image is made of runs of the same color, all multiples of the scale
function detectIntegerScale(image: ImageData) {
	let result = 0;

	for (let y = 0; y < image.height; y += 7) {
		let run = 1;

		for (let x = 1; x <= image.width; x++) {
			if (x < image.width && pixelAt(image, x, y) === pixelAt(image, x - 1, y)) {
				run++;
			} else {
				result = gcd(result, run);
				run = 1;

				if (result === 1) {
					return 1;
				}
			}
		}
	}

	return result || 1;
}

// how many pixels differ from the center of their scaled pixel, lower is better
function scaleError(image: ImageData, scale: number) {
	let errors = 0;
	let total = 0;
	const step = Math.max(1, Math.floor(image.width * image.height / 40000));

	for (let i = 0; i < image.width * image.height; i += step) {
		const x = i % image.width;
		const y = (i / image.width) | 0;
		const cx = Math.min(image.width - 1, Math.floor((Math.floor(x / scale) + 0.5) * scale));
		const cy = Math.min(image.height - 1, Math.floor((Math.floor(y / scale) + 0.5) * scale));
		const a = pixelAt(image, x, y);

		if (a !== 0 || pixelAt(image, cx, cy) !== 0) {
			total++;
			errors += a === pixelAt(image, cx, cy) ? 0 : 1;
		}
	}

	return total ? errors / total : 1;
}

// for images that were resized after export the scale is not a whole number, try every native height
function detectScale(image: ImageData, frames: number) {
	const integerScale = detectIntegerScale(image);

	if (integerScale > 1 || image.height <= MAX_NATIVE_HEIGHT) {
		return integerScale;
	}

	let best = 1;
	let bestError = Infinity;

	for (let height = Math.ceil(image.height / 32); height <= MAX_NATIVE_HEIGHT; height++) {
		const scale = image.height / height;
		const frameWidth = image.width / scale / frames;

		if (scale < 1.5 || Math.abs(frameWidth - Math.round(frameWidth)) > 0.2) {
			continue;
		}

		const error = scaleError(image, scale);

		if (error < bestError - 0.01) {
			bestError = error;
			best = scale;
		}
	}

	return best;
}

function findAnchor(strip: ImageData, frameWidth: number) {
	for (let y = strip.height - 1; y >= 0; y--) {
		let minX = -1;
		let maxX = -1;

		for (let x = 0; x < frameWidth; x++) {
			if (pixelAt(strip, x, y) !== 0) {
				minX = minX === -1 ? x : minX;
				maxX = x;
			}
		}

		if (minX !== -1) {
			return { ax: Math.floor((minX + maxX) / 2), ay: y };
		}
	}

	return { ax: Math.floor(frameWidth / 2), ay: strip.height - 1 };
}

export function framesFromFileName(fileName: string): number | undefined {
	const match = /(\d+)[-_ ]?frames?/i.exec(fileName);
	return match ? parseInt(match[1], 10) : undefined;
}

export function scaleFromFileName(fileName: string): number | undefined {
	const match = /[-_ ](\d+)x\.png$/i.exec(fileName);
	return match ? parseInt(match[1], 10) : undefined;
}

export async function importStrip(file: File, frames: number): Promise<ImportedStrip> {
	const image = getImageData(await loadFile(file));
	const scale = scaleFromFileName(file.name) || detectScale(image, frames);
	const frameWidth = Math.max(1, Math.round(image.width / scale / frames));
	const height = Math.max(1, Math.round(image.height / scale));
	const width = frameWidth * frames;
	const scaleX = image.width / width;
	const scaleY = image.height / height;

	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext('2d')!;
	const strip = context.createImageData(width, height);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const sx = Math.min(image.width - 1, Math.floor((x + 0.5) * scaleX));
			const sy = Math.min(image.height - 1, Math.floor((y + 0.5) * scaleY));
			const s = (sy * image.width + sx) * 4;
			const d = (y * width + x) * 4;
			strip.data[d] = image.data[s];
			strip.data[d + 1] = image.data[s + 1];
			strip.data[d + 2] = image.data[s + 2];
			strip.data[d + 3] = image.data[s + 3];
		}
	}

	context.putImageData(strip, 0, 0);
	const { ax, ay } = findAnchor(strip, frameWidth);

	return { src: canvas.toDataURL('image/png'), frames, ax, ay, width: frameWidth, height, scale };
}
