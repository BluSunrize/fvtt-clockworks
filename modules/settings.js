import { ClockDisplay } from "./clock-display.js";

let socket;

Hooks.once("socketlib.ready", () => {
	socket = socketlib.registerModule("clock-works");
	socket.register('setClock', setClock);
    socket.register('deleteClock', deleteClock);
    socket.register('updateRender', updateRender);
});

export function generateClockId() {
    return `clock-works-${Math.random().toString(16).slice(2)}`;
}

export function getAllClocks(clockId) {
    const clockList = game.settings.get('fvtt-clock-works', 'clockList');
    return clockList;
}

export function getClock(clockId) {
    const clockList = game.settings.get('fvtt-clock-works', 'clockList');
    return clockList[clockId];
}

export async function setClock(clockId, value) {
    if (!game.user.isGM)
        await socket.executeAsGM('setClock', clockId, value);
    else {
        const clockList = game.settings.get('fvtt-clock-works', 'clockList');
        clockList[clockId] = value;
        await game.settings.set('fvtt-clock-works', 'clockList', clockList);
    }
    return await socket.executeForEveryone('updateRender');
}

export async function deleteClock(clockId) {
    if (!game.user.isGM)
        await socket.executeAsGM('deleteClock', clockId);
    else {
        const clockList = game.settings.get('fvtt-clock-works', 'clockList');
        delete clockList[clockId];
        await game.settings.set('fvtt-clock-works', 'clockList', clockList);
    }
    return await socket.executeForEveryone('updateRender');
}

function updateRender() {
    // re-render sidebar and any opened clock displays
    ui.sidebar.tabs.clocks.render();
    Object.values(ui.windows).forEach(app => {
        if(app instanceof ClockDisplay)
            app.render();
    });
}