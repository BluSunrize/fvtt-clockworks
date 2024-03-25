import { generateClockId, getAllFolders, getFolder, setFolder } from "./settings.js";

export class FolderForm extends FormApplication {
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

    static get defaultOptions() {
        const defaults = super.defaultOptions;
        const overrides = {
            width: 360,
            id: 'clock-works-permission-form',
            template: 'templates/sidebar/folder-edit.html',
        };
        const mergedOptions = foundry.utils.mergeObject(defaults, overrides);
        return mergedOptions;
    }

    async getData(options = {}) {
        const folder = await this._getFolder();
        return {
            folder: folder,
            name: this.folderId ? folder.name : "",
            newName: game.i18n.localize('clock-works.folders.default-name'),
            safeColor: folder.color,
            sortingModes: { a: "FOLDER.SortAlphabetical", m: "FOLDER.SortManual" },
            submitText: game.i18n.localize(this.folderId ? "FOLDER.Update" : "FOLDER.Create")
        };
    }

    async _updateObject(event, formData) {
        const folder = await this._getFolder();
        let newValue = await foundry.utils.mergeObject(folder, formData);
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
    folders.get = function(id) {
        return this.find(f => f.id === id);
    };
    return folders;
}

export function getFolderSubtree(folder, accumulator = []) {
    accumulator.push(folder);
    folder.children?.forEach(child => getFolderSubtree(child, accumulator));
    return accumulator;
}