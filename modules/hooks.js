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

