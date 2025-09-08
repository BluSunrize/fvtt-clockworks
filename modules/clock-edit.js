import { generateClockId, getAllClocks, getClock, setClock } from './settings.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ClockEditForm extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(clockId) {
        super();
        this.clockId = clockId;
    }

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        tag: 'form',
        id: 'clock-works-edit-form',
        classes: ['clock-works', 'ownership'],
        template: 'modules/clock-works/templates/edit.hbs',
        window: {
            title: 'clock-works.edit-form.title',
            contentClasses: ['clock-works-edit-form', 'standard-form'],
            icon: "fa-solid fa-file-lock"
        },
        position: { width: 400 },
        form: {
            handler: ClockEditForm._onSubmit,
            closeOnSubmit: true
        },
        sheetConfig: false
    };

    /** @override */
    static PARTS = {
        edit: {
            template: 'modules/clock-works/templates/edit.hbs',
            root: true,
            scrollable: ['menu.scrollable']
        },
        footer: {
            template: 'templates/generic/form-footer.hbs'
        }
    };

    /** @override */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const clockData = this.clockId ? getClock(this.clockId) : defaultClockValues();
        return Object.assign(context, {
            ...clockData,
            colorPickerField: new game.colorPicker.ColorPickerField(),
            buttons: [{ type: "submit", icon: "fa-solid fa-floppy-disk", label: "clock-works.edit-form.save" }]
        });
    }

    static async open(clockId) {
        return new ClockEditForm(clockId).render(true);
    }

    static async _onSubmit(_event, _form, formData) {
        const clockId = this.clockId;
        const existing = getClock(clockId);
        let newValue;
        if (existing) {
            newValue = foundry.utils.mergeObject(existing, formData.object);
        } else {
            const name = formData.object.name ?? game.i18n.localize('clock-works.edit-form.default-name');
            const persist = true;
            const id = clockId;
            const listPosition = (getAllClocks().length || 0) + 1;
            newValue = foundry.utils.mergeObject(formData.object, { id, listPosition, persist, name });
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
        imagebg: '',
        imagefg: '',
        ownership: {
            default: game.settings.get('clock-works', 'defaultOwnership')
        }
    };
}
