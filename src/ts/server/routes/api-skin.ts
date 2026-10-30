import { Router } from 'express';
import { offline as createOffline, validAccount as createValidAccount, hash, wrap } from '../requestUtils';
import { findCharacter, IAccount, Skin } from '../db';
import { UserError } from '../userError';
import { Settings, ServerConfig } from '../../common/adminInterfaces';
import { SkinAnimations, SkinAnimation } from '../../common/interfaces';

// Leviathan Town: skins imported from sprite strips instead of the character editor

export const SKIN_ANIMATIONS = ['stand', 'walk', 'sit', 'lie', 'fly', 'boop'];
export const SKIN_MAX_BYTES = 2 * 1024 * 1024;
const MAX_STRIP_LENGTH = 400 * 1024;
const MAX_FRAMES = 64;
const MAX_ANCHOR = 512;

function isInt(value: any, min: number, max: number) {
	return typeof value === 'number' && (value | 0) === value && value >= min && value <= max;
}

export function validateSkin(anims: any): SkinAnimations {
	if (!anims || typeof anims !== 'object') {
		throw new UserError('Invalid skin');
	}

	const result: SkinAnimations = {};

	for (const key of Object.keys(anims)) {
		const anim = anims[key] as SkinAnimation;

		if (SKIN_ANIMATIONS.indexOf(key) === -1 || !anim) {
			throw new UserError(`Invalid animation (${key})`);
		}

		if (
			typeof anim.src !== 'string' || anim.src.length > MAX_STRIP_LENGTH ||
			!/^data:image\/png;base64,[a-zA-Z0-9+/]+=*$/.test(anim.src)
		) {
			throw new UserError(`Invalid image (${key})`);
		}

		if (!isInt(anim.frames, 1, MAX_FRAMES) || !isInt(anim.ax, 0, MAX_ANCHOR) || !isInt(anim.ay, 0, MAX_ANCHOR)) {
			throw new UserError(`Invalid frames (${key})`);
		}

		result[key as keyof SkinAnimations] = { src: anim.src, frames: anim.frames, ax: anim.ax, ay: anim.ay };
	}

	if (!result.stand) {
		throw new UserError('Standing animation is required');
	}

	return result;
}

export default function (server: ServerConfig, settings: Settings) {
	const offline = createOffline(settings);
	const validAccount = createValidAccount(server);
	const app = Router();

	app.post('/skin/save', offline, hash, validAccount, wrap(server, async req => {
		const account = req.user as IAccount;
		const character = await findCharacter(req.body.pony, account._id);

		if (!character) {
			throw new UserError('Character not found');
		}

		const anims = validateSkin(req.body.anims);
		const skin = await Skin.create({ account: account._id, character: character._id, anims });
		const oldSkin = character.skin;

		character.skin = skin._id.toString();
		await character.save();

		if (oldSkin) {
			await Skin.deleteOne({ _id: oldSkin, account: account._id }).exec();
		}

		return { skin: character.skin };
	}));

	// skins are never changed, a new upload gets a new id, so they can be cached forever
	app.get('/skin/:id', (req, res) => {
		const id = req.params.id;

		if (!/^[a-f0-9]{24}$/.test(id)) {
			res.sendStatus(404);
			return;
		}

		Skin.findById(id, 'anims').lean().exec()
			.then((skin: any) => {
				if (skin) {
					res.header('Cache-Control', 'private, max-age=31536000, immutable');
					res.json(skin.anims);
				} else {
					res.sendStatus(404);
				}
			})
			.catch(() => res.sendStatus(500));
	});

	return app;
}
