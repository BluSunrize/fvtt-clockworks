import { getFolderStructure, getFolderSubtree } from "./folders.js";
import { getAllClocks, getClock, getFolder, setClock, setFolder } from "./settings.js";

export function checkClockPermission(clock, permission, user = game.user) {
    const clockData = (typeof clock === "string") ? getClock(clock) : clock;
    const perms = CONST.DOCUMENT_OWNERSHIP_LEVELS;
    const ownership = clockData.ownership ?? { default: 0 };
    const level = user.isGM ? perms.OWNER : ownership[user.id] || ownership.default;
    const target = (typeof permission === "string") ? (perms[permission] ?? perms.OWNER) : permission;
    return level >= target;
}

export class ClockPermissionForm extends FormApplication {
    constructor(isFolder, targetId) {
        super();
        this.isFolder = isFolder;
        this.targetId = targetId;
    }

    static get defaultOptions() {
        const defaults = super.defaultOptions;
        const overrides = {
            width: 400,
            id: 'clock-works-permission-form',
            template: 'templates/apps/ownership.html',
        };
        const mergedOptions = foundry.utils.mergeObject(defaults, overrides);
        return mergedOptions;
    }

    getData(options) {
        let ownership = null;
        if (!this.isFolder) {
            const clockData = this.targetId ? getClock(this.targetId) : {};
            ownership = clockData.ownership || { default: 0 };
        }

        // User permission levels
        const playerLevels = Object.entries(CONST.DOCUMENT_META_OWNERSHIP_LEVELS).map(([name, level]) => {
            return { level, label: game.i18n.localize(`OWNERSHIP.${name}`) };
        });
        // Remove "No Change"
        if (!this.isFolder)
            playerLevels.pop();
        for (let [name, level] of Object.entries(CONST.DOCUMENT_OWNERSHIP_LEVELS)) {
            if (level < 0) continue;
            playerLevels.push({ level, label: game.i18n.localize(`OWNERSHIP.${name}`) });
        }

        // Default permission levels is player levels without "Default"
        const defaultLevels = foundry.utils.deepClone(playerLevels);
        defaultLevels.shift();

        // Current player dama
        const users = game.users.map(user => {
            return {
                user,
                level: this.isFolder ? CONST.DOCUMENT_META_OWNERSHIP_LEVELS.NOCHANGE : ownership[user.id],
            };
        });

        return {
            currentDefault: ownership?.default ?? playerLevels[0],
            instructions: game.i18n.localize(this.isFolder ? 'OWNERSHIP.HintFolder' : 'clock-works.edit-form.permission-hint'),
            defaultLevels,
            playerLevels,
            isFolder: this.isFolder,
            users
        };
    }

    async _updateObject(event, formData) {
        const newOwnership = {};
        const metaLevels = CONST.DOCUMENT_META_OWNERSHIP_LEVELS;
        const omit = this.isFolder ? metaLevels.NOCHANGE : metaLevels.DEFAULT;
        for (let [user, level] of Object.entries(formData)) {
            if (level === omit) {
                delete newOwnership[user];
                continue;
            }
            newOwnership[user] = level;
        }
        let updates = [];
        if (!this.isFolder) {
            // Set ownership for a single clock
            const existing = await getClock(this.targetId);
            existing.ownership = newOwnership;
            updates.push(existing);
        } else {
            // Acquire all subfolders
            const allFolders = getFolderStructure();
            const subtreeIDs = getFolderSubtree(allFolders.get(this.targetId)).map(f => f.id);
            // Set ownership for all clocks in those folders
            Object.values(getAllClocks())
                .filter(clock => subtreeIDs.includes(clock.folder))
                .forEach(async clock => {
                    const ownership = foundry.utils.deepClone(clock.ownership);
                    for (let [k, v] of Object.entries(newOwnership)) {
                        if (v === metaLevels.DEFAULT) delete ownership[k];
                        else ownership[k] = v;
                    }
                    clock.ownership = ownership;
                    updates.push(clock);
                });
        }
        return Promise.all(updates.map(update => setClock(update.id, update)));
    }
}