import { ClockEditForm } from './clock-edit.js';
import { FolderForm } from './folders.js';
import { ClocksSidebarTab } from './sidebar.js';

Hooks.once('init', async () => {

    // I realized only later that these keys do not match the module id. I have to fix that in the future.
    game.settings.register('fvtt-clock-works', 'clockList', {
        data: {},
        scope: 'world',
        config: false,
        default: {},
        type: Object,
    });

    game.settings.register('fvtt-clock-works', 'folders', {
        data: {},
        scope: 'world',
        config: false,
        default: {},
        type: Object,
    });

    game.settings.register('fvtt-clock-works', 'toplevelSort', {
        scope: 'client',
        config: false,
        default: 'm',
        type: String,
    });

    game.settings.register('clock-works', 'defaultOwnership', {
        name: 'clock-works.settings.default-ownership.name',
        hint: 'clock-works.settings.default-ownership.hint',
        scope: 'world',
        config: true,
        type: Number,
        default: 0,
        choices: Object.fromEntries(
            Object.entries(CONST.DOCUMENT_OWNERSHIP_LEVELS)
                .filter(([key, val]) => val >= 0)
                .map(([key, val]) => [val, `OWNERSHIP.${key}`])
        ),
    });


    loadTemplates([
        'modules/clock-works/templates/partials/clock-partial.hbs',
        'modules/clock-works/templates/partials/folder-partial.hbs',
    ]);

    ClockEditForm.init();
    ClocksSidebarTab.init();
});


Hooks.once('ready', async () => {
    window.ClockWorks = {
        edit: ClockEditForm.open
    };
});

Hooks.on("i18nInit", () => {
    // translate fields for folders
    Object.values(FolderForm.FIELDS).forEach(field => {
        if (field.label)
            field.label = game.i18n.localize(field.label);
    });
});
