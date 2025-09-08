import { generateClockId, getAllFolders, getFolder, setFolder } from './settings.js';

const { StringField, ColorField } = foundry.data.fields;
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class FolderForm extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(folderId, parentId) {
        super();
        this.folderId = folderId;
        this.parentId = parentId;
    }

    async _getFolder() {
        const folder = this.folderId ? await getFolder(this.folderId) : defaultFolderValues();
        if (this.parentId)
            folder.folder = this.parentId;
        return folder;
    }

    static DEFAULT_OPTIONS = {
        tag: 'form',
        classes: ['clock-works'],
        canCreate: true,
        form: {
            handler: FolderForm._onSubmit,
            submitOnChange: false,
            closeOnSubmit: true
        },
        window: {
            icon: 'fa-solid fa-folder',
            contentClasses: ['standard-form']
        },
        id: 'clock-works-permission-form',
        position: {
            width: 480,
        }
    };

    /** @override */
    static PARTS = {
        body: { template: 'templates/sheets/folder-config.hbs' },
        footer: { template: 'templates/generic/form-footer.hbs' }
    };

    // We don't have a schema since we're not using a proper document, so we keep our fields here
    static FIELDS = {
        name: new StringField({ label: 'clock-works.folders.name', required: true, blank: false, textSearch: true }, { name: 'name' }),
        color: new ColorField({ label: 'clock-works.folders.color' }, { name: 'color' }),
        sorting: new StringField({ required: true, initial: 'a', choices: ['a', 'm'] }, { name: 'sorting' }),
    }

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        // add fields so the form knows what to do
        context.fields = FolderForm.FIELDS;
        // add folder values
        const folder = await this._getFolder();
        context.name = this.folderId ? folder.name : '';
        context.namePlaceholder = game.i18n.localize('clock-works.folders.default-name');
        context.source = {
            color: folder.color,
            sorting: folder.sorting,
        };
        // define submit button
        context.buttons = [{
            type: 'submit',
            icon: 'fa-solid fa-floppy-disk',
            label: game.i18n.localize(this.folderId ? 'FOLDER.Update' : 'SIDEBAR.ACTIONS.CREATE.Folder')
        }];
        return context;
    }

    static async _onSubmit(event, form, formData, options) {
        const folder = await this._getFolder();
        let newValue = await foundry.utils.mergeObject(folder, formData.object);
        return setFolder(newValue.id, newValue);
    }
}

export function defaultFolderValues() {
    return {
        id: generateClockId(),
        persist: true,
        name: game.i18n.localize('clock-works.folders.default-name'),
        type: '',
        folder: '',
        color: '#000000',
        sorting: 'a'
    };
}

export function getFolderStructure() {
    const folders = foundry.utils.deepClone(Object.values(getAllFolders()));
    // update folders to mark expanded ones and collect children
    folders.forEach(folder => folder.children = folders.filter(child => child.folder === folder.id));
    folders.get = function (id) {
        return this.find(f => f.id === id);
    };
    return folders;
}

export function getFolderSubtree(folder, accumulator = []) {
    accumulator.push(folder);
    folder.children?.forEach(child => getFolderSubtree(child, accumulator));
    return accumulator;
}