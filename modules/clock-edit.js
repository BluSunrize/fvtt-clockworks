import { generateClockId, getAllClocks, getClock, setClock } from "./settings.js";

export class ClockEditForm extends FormApplication {
    constructor(clockId) {
        super();
        this.clockId = clockId;
    }

    static get defaultOptions() {
        const defaults = super.defaultOptions;

        const overrides = {
            height: 'auto',
            width: '400px',
            id: 'clock-works-edit-form',
            template: '/modules/clock-works/templates/edit.html',
            title: game.i18n.localize('clock-works.edit-form.title'),
            userId: game.userId,
            closeOnSubmit: true
        };

        const mergedOptions = foundry.utils.mergeObject(defaults, overrides);

        return mergedOptions;
    }

    getData(options) {
        if (this.clockId) {
            return getClock(this.clockId);
        } else {
            return defaultClockValues();
        }
    }

    static init() {
        this.form = new ClockEditForm();
    }

    static async open(clockId) {
        ClockEditForm.form.clockId = clockId;
        ClockEditForm.form.render(true, { width: '400px', height: 'auto' });
    }

    activateListeners(html) {
        super.activateListeners(html);
        ColorPicker.install();
    }

    /**
    * Merge options with flag and, if open, redraw the Challenge Tracker
    * @param {string} ownerId User that owns the flag
    * @param {string} [challengeTrackerId=null] Unique identifier for the Challenge Tracker
    **/
    async _updateObject(event, formData) {
        const clockId = event.currentTarget.dataset.clockId;
        const existing = getClock(clockId);
        let newValue;
        if (existing) {
            newValue = foundry.utils.mergeObject(existing, formData);
        } else {
            const name = formData.name ?? game.i18n.localize('clock-works.edit-form.default-name');
            const persist = true;
            const id = clockId;
            const listPosition = (getAllClocks().length || 0) + 1;
            newValue = foundry.utils.mergeObject(formData, { id, listPosition, persist, name });
        }
        await setClock(clockId, newValue);
    }
}

export function defaultClockValues() {
    return {
        id: generateClockId(),
        name: game.i18n.localize('clock-works.edit-form.default-name'),
        size: 4,
        filled: 0,
        colorempty: '#808080',
        colorfilled: '#00ff22',
        colorframe: '#444',
        imagebg: "",
        imagefg: "",
    };
}