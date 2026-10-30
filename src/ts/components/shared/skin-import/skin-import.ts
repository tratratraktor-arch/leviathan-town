import { Component, OnInit } from '@angular/core';
import { SkinAnimations, SkinAnimationName } from '../../../common/interfaces';
import { PLAYER_NAME_MAX_LENGTH } from '../../../common/constants';
import { Model } from '../../services/model';
import { GameService } from '../../services/gameService';
import { cleanName, validatePonyName } from '../../../client/clientUtils';
import { createDefaultPony } from '../../../common/ponyInfo';
import {
	SKIN_ANIMATION_INFOS, SkinAnimationInfo, ImportedStrip, importStrip, framesFromFileName
} from '../../../client/skinImport';

// Leviathan Town: instead of the character editor the player enters a nickname and
// attaches sprite strips exported from Pony Town, the game makes the skin out of them.

export type SkinImportStep = 'name' | 'skin' | 'ready';

interface SlotState {
	info: SkinAnimationInfo;
	frames: number;
	file?: File;
	strip?: ImportedStrip;
	error?: string;
	loading?: boolean;
}

@Component({
	selector: 'skin-import',
	templateUrl: 'skin-import.pug',
	styleUrls: ['skin-import.scss'],
})
export class SkinImport implements OnInit {
	readonly maxNameLength = PLAYER_NAME_MAX_LENGTH;
	step: SkinImportStep = 'name';
	slots: SlotState[] = SKIN_ANIMATION_INFOS.map(info => ({ info, frames: info.frames }));
	saved: SkinAnimations | undefined = undefined;
	error?: string;
	saving = false;
	constructor(private model: Model, private gameService: GameService) {
	}
	get pony() {
		return this.model.pony;
	}
	get joining() {
		return this.gameService.joining;
	}
	get canSave() {
		const stand = this.slots[0];
		return !this.saving && !!stand.strip && this.slots.every(s => !s.loading);
	}
	get previewStand() {
		return this.saved && this.saved.stand;
	}
	ngOnInit() {
		if (this.pony.skin) {
			this.setStep('ready');
			this.loadSaved(this.pony.skin);
		} else {
			this.setStep(this.pony.id ? 'skin' : 'name');
		}
	}
	setStep(step: SkinImportStep) {
		this.error = undefined;
		this.step = step;
	}
	next() {
		const name = cleanName(this.pony.name);

		if (!validatePonyName(name)) {
			this.error = 'Введи ник (до ' + PLAYER_NAME_MAX_LENGTH + ' символов)';
			return;
		}

		this.pony.name = name;

		if (this.pony.skin) {
			// only the name changed, save it and go back
			this.saving = true;
			this.model.savePony(this.pony)
				.then(() => this.setStep('ready'))
				.catch((e: Error) => this.error = e.message)
				.finally(() => this.saving = false);
		} else {
			this.setStep('skin');
		}
	}
	selectFile(slot: SlotState, event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files && input.files[0];
		input.value = '';

		if (file) {
			slot.file = file;
			slot.frames = framesFromFileName(file.name) || slot.frames;
			this.importSlot(slot);
		}
	}
	changeFrames(slot: SlotState, event: Event) {
		const frames = parseInt((event.target as HTMLInputElement).value, 10);

		if (frames >= 1 && frames <= 64 && frames !== slot.frames) {
			slot.frames = frames;
			slot.file && this.importSlot(slot);
		}
	}
	clear(slot: SlotState) {
		slot.file = undefined;
		slot.strip = undefined;
		slot.error = undefined;
	}
	save() {
		if (!this.canSave) {
			return;
		}

		const anims: SkinAnimations = {};

		for (const slot of this.slots) {
			if (slot.strip) {
				const { src, frames, ax, ay } = slot.strip;
				anims[slot.info.name] = { src, frames, ax, ay };
			}
		}

		// the pony underneath only decides what the pony can do, flying needs wings
		const ponyInfo = this.pony.ponyInfo || createDefaultPony();
		ponyInfo.wings = { ...ponyInfo.wings, type: anims.fly ? 1 : 0 };
		this.pony.ponyInfo = ponyInfo;

		this.saving = true;
		this.error = undefined;

		this.model.savePony(this.pony)
			.then(() => this.model.saveSkin(this.model.pony, anims))
			.then(() => {
				this.saved = anims;
				this.setStep('ready');
			})
			.catch((e: Error) => this.error = e.message)
			.finally(() => this.saving = false);
	}
	trackSlot(_: number, slot: SlotState) {
		return slot.info.name;
	}
	slotOf(name: SkinAnimationName) {
		return this.slots.find(s => s.info.name === name)!;
	}
	private importSlot(slot: SlotState) {
		const file = slot.file!;
		slot.loading = true;
		slot.error = undefined;

		importStrip(file, slot.frames)
			.then(strip => {
				if (slot.file === file) {
					slot.strip = strip;
				}
			})
			.catch((e: Error) => slot.error = e.message)
			.finally(() => slot.loading = false);
	}
	private loadSaved(id: string) {
		fetch(`/api/skin/${id}`, { credentials: 'same-origin' })
			.then(response => response.ok ? response.json() : undefined)
			.then((anims: SkinAnimations | undefined) => this.saved = anims)
			.catch(e => console.error(e));
	}
}
