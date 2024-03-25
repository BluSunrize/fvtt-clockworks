import { ClockEditForm } from "./clock-edit.js";
import { ClocksSidebarTab } from "./sidebar.js";

Hooks.once('init', async () => {

    game.settings.register('fvtt-clock-works', 'clockList', {
        data: {},
        scope: "world",
        config: false,
        default: {},
        type: Object,
    });

    game.settings.register('fvtt-clock-works', 'folders', {
        data: {},
        scope: "world",
        config: false,
        default: {},
        type: Object,
    });

    game.settings.register('fvtt-clock-works', 'toplevelSort', {
        scope: "client",
        config: false,
        default: "m",
        type: String,
    });

    loadTemplates([
        "modules/clock-works/templates/partials/clock-partial.html",
        "modules/clock-works/templates/partials/folder-partial.html",
    ]);

    ClockEditForm.init();
    ClocksSidebarTab.init();
});


Hooks.once('ready', async () => {
    window.ClockWorks = {
        edit: ClockEditForm.open
    };
});

Hooks.on('renderSidebar', (_app, html) => {
    ClocksSidebarTab.addSidebarElements();
});

