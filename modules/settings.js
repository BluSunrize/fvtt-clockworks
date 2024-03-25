import { ClockDisplay } from "./clock-display.js";

let socket;

Hooks.once("socketlib.ready", () => {
	socket = socketlib.registerModule("clock-works");
	socket.register('setClock', setClock);
    socket.register('deleteClock', deleteClock);
    socket.register('updateRender', updateRender);
    socket.register('showClock', showClock);
    socket.register('setFolder', setFolder);
});

export function generateClockId() {
    return `clock-works-${Math.random().toString(16).slice(2)}`;
}

export function getAllClocks() {
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

export async function shockClockToAll(clockId) {
    if (game.user.isGM)
        return await socket.executeForOthers('showClock', clockId);
    return Promise.resolve();
}

function updateRender() {
    // re-render sidebar and any opened clock displays
    ui.sidebar.tabs.clocks.render();
    Object.values(ui.windows).forEach(app => {
        if(app instanceof ClockDisplay)
            app.render();
    });
}

function showClock(clockId) {
    // if window exists already, ignore
    if(Object.values(ui.windows).find(app => app instanceof ClockDisplay && app.id == clockId))
        return;
    // show clock to all players
    const display = new ClockDisplay(clockId);
    display.render(true);
}

export function getAllFolders() {
    return game.settings.get('fvtt-clock-works', 'folders');
}

export async function getFolder(folderId) {
    return getAllFolders()[folderId];
}

export async function setFolder(folderId, value) {
    if (!game.user.isGM)
        await socket.executeAsGM('setFolder', folderId, value);
    else {
        const folders = game.settings.get('fvtt-clock-works', 'folders');
        folders[folderId] = value;
        await game.settings.set('fvtt-clock-works', 'folders', folders);
    }
    return await socket.executeForEveryone('updateRender');
}

export async function deleteFolder(folderId) {
    if (!game.user.isGM)
        await socket.executeAsGM('deleteFolder', folderId);
    else {
        const folders = game.settings.get('fvtt-clock-works', 'folders');
        delete folders[folderId];
        await game.settings.set('fvtt-clock-works', 'folders', folders);
    }
    return await socket.executeForEveryone('updateRender');
}

