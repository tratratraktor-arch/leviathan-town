import { Component, Input, ElementRef, ViewChild, OnDestroy, OnChanges, NgZone, AfterViewInit } from '@angular/core';
import { SkinAnimation } from '../../../common/interfaces';

// Leviathan Town: animated preview of one sprite strip of a skin
@Component({
	selector: 'skin-preview',
	template: '<canvas #canvas class="pixelart"></canvas>',
	styles: [':host { display: inline-block; line-height: 0; } canvas { image-rendering: pixelated; }'],
})
export class SkinPreview implements AfterViewInit, OnChanges, OnDestroy {
	@Input() anim: SkinAnimation | undefined = undefined;
	@Input() scale = 2;
	@Input() size = 64; // frame box size in native pixels
	@ViewChild('canvas', { static: true }) canvas!: ElementRef;
	private image: HTMLImageElement | undefined = undefined;
	private frame = 0;
	private timer: any = undefined;
	constructor(private zone: NgZone) {
	}
	ngAfterViewInit() {
		this.zone.runOutsideAngular(() => this.timer = setInterval(() => this.tick(), 1000 / 24));
	}
	ngOnChanges() {
		this.image = undefined;
		this.frame = 0;

		if (this.anim) {
			const image = new Image();
			image.onload = () => {
				this.image = image;
				this.draw();
			};
			image.src = this.anim.src;
		}

		this.draw();
	}
	ngOnDestroy() {
		clearInterval(this.timer);
	}
	private tick() {
		if (this.image && this.anim && this.anim.frames > 1) {
			this.frame = (this.frame + 1) % this.anim.frames;
			this.draw();
		}
	}
	private draw() {
		const canvas = this.canvas.nativeElement as HTMLCanvasElement;
		const size = this.size * this.scale;

		if (canvas.width !== size) {
			canvas.width = size;
			canvas.height = size;
		}

		const context = canvas.getContext('2d')!;
		context.clearRect(0, 0, size, size);

		if (this.image && this.anim) {
			const { frames, ax, ay } = this.anim;
			const width = Math.floor(this.image.width / frames);
			const height = this.image.height;
			const s = this.scale;
			// anchor (bottom center of the shadow) goes to the bottom center of the box
			const x = Math.round(this.size / 2 - ax);
			const y = this.size - 2 - ay;
			context.imageSmoothingEnabled = false;
			context.drawImage(this.image, this.frame * width, 0, width, height, x * s, y * s, width * s, height * s);
		}
	}
}
