import { defaultClockValues } from './clock-edit.js';
import { getClock } from './settings.js';

export class ClockDisplay extends Application {
    constructor(clockId) {
        super({
            id: `${clockId}`,
            title: getClock(clockId).name,
        });
        this.clockId = clockId;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ['clock-works-display'],
            height: 'auto',
            width: '200px',
            template: '/modules/clock-works/templates/display.html',
            userId: game.userId,
            closeOnSubmit: true
        });
    }

    getData(options) {
        if (this.clockId) {
            return getClock(this.clockId);
        } else {
            return defaultClockValues();
        }
    }

    /** @inheritDoc */
    async _render(force, options) {
        const ret = await super._render(force, options);
        $(this._element).find('div').each(renderClockImage);
        return ret;
    }
}

export function renderClockImage() {
    const element = $(this);
    const clock = getClock(element.data('clockId'));
    const canvas = element.find('canvas')[0];
    const context = canvas.getContext('2d');
    // clear existing data
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.translate(0.5, 0.5);

    // centre or center for US :) the drawing
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(cx, cy) * 0.875;
    // -90° to make sure we start at the top
    const angleOffset = -Math.PI / 2;

    // promise function for rendering images
    function drawMaskedImage(context, url, angle = 2 * Math.PI) {
        // early exit for missing url
        if (!url)
            return Promise.resolve();

        // otherwise await the image fully loading
        return new Promise((fulfill, reject) => {
            let image = new Image();
            image.onload = () => {
                context.save();
                context.beginPath();
                context.moveTo(cx, cy);
                context.arc(cx, cy, radius, angleOffset, angleOffset + angle);
                context.clip();
                context.drawImage(image, cx - radius, cy - radius, radius * 2, radius * 2);
                context.restore();
                return fulfill(image);
            };
            image.src = url;
        });
    }
    // calculate fill
    const size = clock.size;
    const filled = clock.filled;
    // calculate angle for segments
    const angle = 2 * Math.PI / size;
    const filledAngle = angle * filled;

    // draw images where appropiate, then draw the clock overlay
    Promise.all([
        drawMaskedImage(context, clock.imagebg),
        drawMaskedImage(context, clock.imagefg, filledAngle),
    ]).then(() => {
        const lineWidth = 0.06 * radius;
        const colorEmpty = clock.colorempty ?? '#808080';
        const colorFill = clock.colorfilled ?? '#00ff22';
        const colorFrame = clock.colorframe ?? '#444';
        // draw full
        if (filled > 0) {
            context.beginPath();
            context.moveTo(cx, cy);
            context.arc(cx, cy, radius, angleOffset, angleOffset + filledAngle);
            context.fillStyle = colorFill;
            context.fill();
        }
        // draw empty
        if (filled < size) {
            context.beginPath();
            context.moveTo(cx, cy);
            context.arc(cx, cy, radius, angleOffset + filledAngle, angleOffset + 2 * Math.PI);
            context.fillStyle = colorEmpty;
            context.fill();
        }
        // draw frame
        context.strokeStyle = colorFrame;
        context.lineWidth = lineWidth;
        for (var i = 0; i < size; i++) {
            context.beginPath();
            context.moveTo(cx, cy);
            context.arc(cx, cy, radius, angleOffset + i * angle, angleOffset + (i + 1) * angle, false);
            context.stroke();
        }
    });
}