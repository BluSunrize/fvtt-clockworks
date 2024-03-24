import { ClockEditForm, defaultClockValues, checkClockPermission, ClockPermissionForm } from './clock-edit.js';
import { ClockDisplay, renderClockImage } from './clock-display.js';
import { deleteClock, generateClockId, getAllClocks, getClock, setClock, shockClockToAll, getAllFolders, getFolder } from './settings.js';
import { FolderForm } from './folders.js';

export class ClocksSidebarTab extends SidebarTab {
    constructor(options = {}) {
        super(options);
        if (ui.sidebar) ui.sidebar.tabs.clocks = this;

        this._expandedFolders = {}
    }

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "clocks",
            template: "/modules/clock-works/templates/sidebar.html",
            title: "clock-works.clocks"
        });
    }

    static init() {
        CONFIG.ui.clocks = ClocksSidebarTab;
    }

    static addSidebarElements() {
        // Set new width for tabs
        const tabs = $('#sidebar-tabs');
        const width = Math.floor(parseInt(tabs.css('--sidebar-width')) / (tabs.children().length + 1));
        tabs.css('--sidebar-tab-width', `${width}px`);

        // Create tab icon
        const tab = $('<a data-tab="clocks" data-tooltip="clock-works.clocks">')
            .addClass('item')
            .append($('<i>').addClass('fas fa-chart-pie'));
        // Add to sidebar before cards
        if (!$('#sidebar-tabs [data-tab="clocks"]').length)
            $('#sidebar-tabs [data-tab="cards"]').before(tab);

        // Add dummy section which will be replaced by template later
        if (!$('#sidebar section[data-tab="clocks"]').length)
            $('#sidebar #cards').before($('<section id="clocks" data-tab="clocks"> class="tab"'));
    }

    _getFolderStructure() {
        const folders = foundry.utils.deepClone(Object.values(getAllFolders()));
        // update folders to mark expanded ones and collect children
        folders.forEach(folder => {
            folder.expanded = this._expandedFolders[folder.id];
            folder.children = folders.filter(child => child.folder === folder.id);
            folder.collectFolderTree = () => {
                return children.reduce(
                    (accumulator, currentValue) => accumulator + currentValue,
                    initialValue,
                );
            }
        });
        return folders;
    }

    _getFolderSubtree(folder, accumulator = []) {
        accumulator.push(folder);
        folder.children?.forEach(child => this._getFolderSubtree(child, accumulator));
        return accumulator;
    }

    /** @override */
    async getData(options = {}) {
        const context = await super.getData(options);

        // Get filtered list of clocks for visibility, "Limited" allows viewing them, "Observer" allows pressing the buttons
        const clockList = Object.values(getAllClocks()).filter(clock => checkClockPermission(clock, CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED));
        clockList.forEach(clock => {
            clock.showButtons = checkClockPermission(clock, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER);
        });

        // Get dictionary of folders
        const folders = this._getFolderStructure();

        // build tree structure
        const createNode = (root, folder, depth) => {
            return {
                root, folder, depth, visible: false,
                children: folder?.children?.map(c => createNode(false, c, -1)) ?? [],
                entries: clockList.filter(clock => folder ? folder.id === clock.folder : !clock.folder)
            };
        };
        const nodes = folders
            .filter(folder => !Boolean(folder.folder))
            .map(folder => createNode(false, folder, -1));

        // update depth values in tree
        const setDepth = (children, givenDepth) => children.forEach(node => {
            node.depth = givenDepth;
            if (node.children)
                setDepth(node.children, givenDepth + 1);
        });
        setDepth(nodes, 1)

        console.log(nodes);
        const tree = createNode(true, null, 0);
        tree.children = nodes;
        console.log(tree);


        // Return data to the sidebar
        const data = foundry.utils.mergeObject(context, {
            root: "templates/sidebar",
            tree: tree,
            canCreateEntry: game.user.isGM,
            canCreateFolder: game.user.isGM,
        });
        console.log("sidebar data", data);
        return data;
    }


    /** @inheritDoc */
    activateListeners(html) {
        super.activateListeners(html);

        // Adding a new clock
        html.find('.create-clock').click(async evt => {
            const newClock = defaultClockValues();
            // Set owner of the clock
            newClock.ownership[game.user.id] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
            // Set folder of the clock
            const parentFolderId = $(evt.target).parents('li.folder').first().data('folderId');
            newClock.folder = parentFolderId;
            // Save clock and open edit form
            await setClock(newClock.id, newClock);
            ClockEditForm.open(newClock.id);
        });

        // Adding a new folder
        html.find('.create-folder').click(async evt => {
            const parentFolderId = $(evt.target).parents('li.folder').first().data('folderId');
            new FolderForm(null, parentFolderId).render(true);
            evt.stopPropagation();
        });

        // Handle folder expansion
        html.on("click", ".folder-header", evt => {
            let folder = $(evt.currentTarget.parentElement);
            let collapsed = folder.hasClass("collapsed");
            const folderId = folder.data('folderId');
            this._expandedFolders[folderId] = collapsed;
            // Expand
            if (collapsed)
                folder.removeClass("collapsed");
            // Collapse
            else {
                folder.addClass("collapsed");
                const subs = folder.find(".folder").addClass("collapsed");
                subs.each((i, f) => this._expandedFolders[folderId] = false);
            }
        });

        // Editing an existing clock
        html.find('li.directory-item.clock a').click(evt => {
            const display = new ClockDisplay($(evt.target).parents('li').data('clockId'));
            display.render(true);
        });

        // Increment or decrement clock
        function changeClock(evt, change) {
            const clockId = $(evt.target).parents('li').data('clockId');
            const clock = getClock(clockId);
            const newValue = Math.max(0, Math.min(clock.filled + change, clock.size));
            if (newValue !== clock.filled) {
                clock.filled = newValue;
                setClock(clockId, clock);
            }
        }
        html.find('.increment').click(evt => changeClock(evt, +1));
        html.find('.decrement').click(evt => changeClock(evt, -1));


        // Context menu
        ContextMenu.create(this, html, ".directory-item.folder", this._getFolderContextOptions());
        ContextMenu.create(this, html, ".directory-item.clock", this._getEntryContextOptions());
    }

    _getFolderContextOptions() {
        return [
            {
                name: "clock-works.sidebar.edit-folder",
                icon: '<i class="fas fa-edit"></i>',
                condition: () => game.user.isGM,
                callback: li => new FolderForm(li.data('folderId')).render(true),
            },
            {
                name: "clock-works.sidebar.delete-folder",
                icon: '<i class="fas fa-dumpster"></i>',
                condition: () => game.user.isGM,
                callback: li => {
                    const folder = this._getFolderStructure().find(f => f.id === li.data('folderId'));
                    const subtreeIDs = this._getFolderSubtree(folder)
                        .map(f => f.id);
                    const clockIDs = Object.values(getAllClocks())
                        .filter(clock => subtreeIDs.includes(clock.folder))
                        .map(clock => clock.id);
                    console.log("Delete all:", subtreeIDs, clockIDs);

                    Dialog.confirm({
                        title: `${game.i18n.localize("FOLDER.Delete")} ${folder.name}`,
                        content: `<h4>${game.i18n.localize("AreYouSure")}</h4><p>${game.i18n.localize("FOLDER.DeleteWarning")}</p>`,
                        yes: () => Promise.all(
                            ...subtreeIDs.map(folderId => deleteFolder(folderId)),
                            ...clockIDs.map(clockId => deleteClock(clockId))
                        ),
                        no: () => { },
                        defaultYes: false
                    })
                },
            },
        ];
    }

    _getEntryContextOptions() {
        return [
            {
                name: "OWNERSHIP.Configure",
                icon: '<i class="fas fa-lock"></i>',
                condition: () => game.user.isGM,
                callback: li => {
                    const clockId = li.data('clockId');
                    return new ClockPermissionForm(clockId).render(true);
                }
            },
            {
                name: "clock-works.sidebar.show",
                icon: '<i class="fas fa-eye"></i>',
                condition: () => game.user.isGM,
                callback: li => {
                    const clockId = li.data('clockId');
                    return shockClockToAll(clockId);
                }
            },
            {
                name: "clock-works.sidebar.edit",
                icon: '<i class="fas fa-edit"></i>',
                condition: li => checkClockPermission(li.data('clockId'), CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER),
                callback: li => {
                    const clockId = li.data('clockId');
                    return ClockEditForm.open(clockId);
                }
            },
            {
                name: "clock-works.sidebar.duplicate",
                icon: '<i class="fas fa-copy"></i>',
                condition: li => checkClockPermission(li.data('clockId'), CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER),
                callback: li => {
                    const clockId = li.data('clockId');
                    const original = getClock(clockId);
                    const newId = generateClockId();
                    return setClock(newId, foundry.utils.mergeObject(
                        { id: newId, name: original['name'] + game.i18n.localize('clock-works.sidebar.postfix-copy') },
                        original,
                        { overwrite: false }
                    ));
                }
            },
            {
                name: "clock-works.sidebar.delete",
                icon: '<i class="fas fa-trash"></i>',
                condition: li => checkClockPermission(li.data('clockId'), CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER),
                callback: li => {
                    const clockId = li.data('clockId');
                    return deleteClock(clockId);
                }
            }
        ];
    }


    /** @inheritDoc */
    async _render(force, options) {
        const ret = await super._render(force, options);
        // $(this._element).find('li').each(renderClockImage);
        return ret;
    }

}
