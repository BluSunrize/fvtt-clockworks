import { getClock, setClock } from "./settings.js";

export function checkClockPermission(clock, permission, user = game.user) {
    const clockData = (typeof clock === "string") ? getClock(clock) : clock;
    const perms = CONST.DOCUMENT_OWNERSHIP_LEVELS;
    const ownership = clockData.ownership ?? { default: 0 };
    const level = user.isGM ? perms.OWNER : ownership[user.id] || ownership.default;
    const target = (typeof permission === "string") ? (perms[permission] ?? perms.OWNER) : permission;
    return level >= target;
}

export class ClockPermissionForm extends FormApplication {
    constructor(clockId) {
        super();
        this.clockId = clockId;
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
        const clockData = this.clockId ? getClock(this.clockId) : {};
        const ownership = clockData.ownership || { default: 0 };

        // User permission levels
        const playerLevels = Object.entries(CONST.DOCUMENT_META_OWNERSHIP_LEVELS).map(([name, level]) => {
            return { level, label: game.i18n.localize(`OWNERSHIP.${name}`) };
        });
        // Remove "No Change"
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
                level: ownership[user.id],
            };
        });

        return {
            currentDefault: ownership?.default ?? playerLevels[0],
            instructions: game.i18n.localize('clock-works.edit-form.permission-hint'),
            defaultLevels,
            playerLevels,
            isFolder: false,
            users
        };
    }

    async _updateObject(event, formData) {
        const newOwnership = {};
        for (let [user, level] of Object.entries(formData)) {
            if (level === CONST.DOCUMENT_META_OWNERSHIP_LEVELS.DEFAULT) {
                delete newOwnership[user];
                continue;
            }
            newOwnership[user] = level;
        }
        const existing = getClock(this.clockId);
        const newValue = foundry.utils.mergeObject(existing, { ownership: newOwnership });
        await setClock(this.clockId, newValue);
    }
}