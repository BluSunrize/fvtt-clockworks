import { ClockEditForm, defaultClockValues } from './clock-edit.js';
import { ClockDisplay, renderClockImage } from './clock-display.js';
import { deleteClock, generateClockId, getAllClocks, getClock, setClock, shockClockToAll, getAllFolders, setFolder, deleteFolder } from './settings.js';
import { FolderForm, getFolderStructure, getFolderSubtree } from './folders.js';
import { ClockPermissionForm, checkClockPermission } from './permissions.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { AbstractSidebarTab } = foundry.applications.sidebar;

export class ClocksSidebarTab extends HandlebarsApplicationMixin(AbstractSidebarTab) {
    constructor(options = {}) {
        super(options);
    }

    static init() {
        CONFIG.ui.clocks = ClocksSidebarTab;
        Sidebar.TABS.clocks = {
            tooltip: "clock-works.clocks",
            icon: "fa-solid fa-chart-pie"
        }
    }

    static #expandedFolders = {}

    /** @override */
    static tabName = "clocks";

    /** @override */
    static PARTS = {
        settings: {
            template: "modules/clock-works/templates/sidebar.hbs",
            templates: ["modules/clock-works/templates/partials/folder-partial.hbs", "modules/clock-works/templates/partials/clock-partial.hbs"],
            root: true
        }
    };

    /** @override */
    static DEFAULT_OPTIONS = {
        classes: ['directory', 'flexcol'],
        window: {
            title: "clock-works.clocks"
        },
        actions: {
            createClock: async evt => {
                const newClock = defaultClockValues();
                // Set owner of the clock
                newClock.ownership[game.user.id] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
                // Set folder of the clock
                const parentFolderId = $(evt.target).parents('li.folder').first().data('folderId');
                newClock.folder = parentFolderId;
                // Save clock and open edit form
                await setClock(newClock.id, newClock);
                ClockEditForm.open(newClock.id);
            },
            createFolder: evt => {
                const parentFolderId = $(evt.target).parents('li.folder').first().data('folderId');
                new FolderForm(null, parentFolderId).render(true);
            },
            toggleSort: ClocksSidebarTab.#toggleSort,
            collapseFolders: ClocksSidebarTab.#collapseFolders,
            folderClick: ClocksSidebarTab.#toggleFolder,
            editClock: evt => {
                const display = new ClockDisplay($(evt.target).parents('li').data('clockId'));
                display.render(true);
            },
            increment: evt => ClocksSidebarTab.#changeClock(evt, +1),
            decrement: evt => ClocksSidebarTab.#changeClock(evt, -1),
        }
    };

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);

        // Get filtered list of clocks for visibility, "Limited" allows viewing them but without name, "Observer" allows seeing the name, "Owner" is required to change them
        const clockList = Object.values(getAllClocks()).filter(clock => checkClockPermission(clock, CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED));
        clockList.forEach(clock => {
            clock.showName = checkClockPermission(clock, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER);
            clock.showButtons = checkClockPermission(clock, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
        });
        // Get list of folders that clocks are contained in
        const clockFolders = clockList.map(clock => clock.folder);
        const folderVisible = f => game.user.isGM || getFolderSubtree(f).some(sub => clockFolders.includes(sub.id));

        // Get list of folders, filtered by them containing any of the visible clocks
        let folders = getFolderStructure().filter(folderVisible);

        // Mark expanded folders & filter children
        folders.forEach(folder => {
            folder.expanded = ClocksSidebarTab.#expandedFolders[folder.id];
            folder.children = folder.children.filter(folderVisible);
        });

        const sortA = (elem1, elem2) => elem1.name?.localeCompare(elem2.name);
        const sortM = (elem1, elem2) => elem1.sort - elem2.sort;

        // build tree structure
        const createNode = (root, folder, depth) => {
            const sorter = folder?.sorting === 'a' ? sortA : sortM;
            return {
                root, folder, depth, visible: false,
                name: folder?.name ?? '',
                sort: folder?.sort ?? 0,
                children: (folder?.children?.map(c => createNode(false, c, -1)) ?? []).sort(sorter),
                entries: clockList.filter(clock => folder ? folder.id === clock.folder : !clock.folder).sort(sorter),
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

        const toplevelSort = game.settings.get('fvtt-clock-works', 'toplevelSort');

        // Create root node & sort
        const tree = createNode(true, null, 0);
        tree.children = nodes.sort(toplevelSort === 'a' ? sortA : sortM);
        tree.entries.sort(toplevelSort === 'a' ? sortA : sortM);

        return Object.assign(context, {
            tree: tree,
            sortIcon: toplevelSort === 'a' ? 'fa-arrow-down-a-z' : 'fa-arrow-down-short-wide',
            sortTooltip: toplevelSort === 'a' ? 'SIDEBAR.SortModeAlpha' : 'SIDEBAR.SortModeManual',
            canCreateEntry: game.user.isGM,
            canCreateFolder: game.user.isGM,
        });
    }

    // Toggle between alphabetic or manual sort
    static #toggleSort() {
        const toplevelSort = game.settings.get('fvtt-clock-works', 'toplevelSort');
        game.settings.set('fvtt-clock-works', 'toplevelSort', toplevelSort === 'a' ? 'm' : 'a');
        this.render();
    }

    // Collapse all folders
    static #collapseFolders() {
        $(this.element).find('li.folder').removeClass('expanded');
        Object.keys(ClocksSidebarTab.#expandedFolders).forEach(key => ClocksSidebarTab.#expandedFolders[key] = false);
        if (this.popOut)
            this.setPosition();
    }

    // Open or close folder
    static #toggleFolder(evt) {
        const folder = $(evt.target).closest('li.directory-item.folder');
        folder.toggleClass('expanded');
        const expanded = folder.hasClass('expanded');
        const folderId = folder.data('folderId');
        if (expanded) ClocksSidebarTab.#expandedFolders[folderId] = true;
        else ClocksSidebarTab.#expandedFolders[folderId] = false;
        if (!expanded) {
            const subs = folder.find('.folder').removeClass('expanded');
            subs.each((i, f) => ClocksSidebarTab.#expandedFolders[folderId] = false);
        }
        if (this.popOut)
            this.setPosition();
    }

    // Increment or decrement clock
    static #changeClock(evt, change) {
        const clockId = $(evt.target).parents('li').data('clockId');
        const clock = getClock(clockId);
        const newValue = Math.max(0, Math.min(clock.filled + change, clock.size));
        if (newValue !== clock.filled) {
            clock.filled = newValue;
            setClock(clockId, clock);
        }
    }

    /** @inheritDoc */
    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);

        this._createContextMenu(this._getFolderContextOptions, ".directory-item.folder .folder-header", {
            fixed: true,
            hookName: "getFolderContextOptions",
            parentClassHooks: false
        });
        this._createContextMenu(this._getEntryContextOptions, ".directory-item.clock");
    }

    /** @inheritDoc */
    async _onRender(context, options) {
        await super._onRender(context, options);
        $(this.element).find('li.clock').each(renderClockImage);

        // Drag + drop handling
        new foundry.applications.ux.DragDrop.implementation({
            dragSelector: '.directory-item',
            dropSelector: '.directory-list',
            permissions: {
                dragstart: this._canDragStart.bind(this),
                drop: this._canDragDrop.bind(this)
            },
            callbacks: {
                dragstart: this._onDragStart.bind(this),
                drop: this._onDragDrop.bind(this)
            }
        }).bind(this.element);
        this.element.querySelectorAll('.directory-item.folder').forEach(folder => {
            folder.addEventListener('dragenter', this._onDragHighlight.bind(this));
            folder.addEventListener('dragleave', this._onDragHighlight.bind(this));
        });

        // Handle search input
        new foundry.applications.ux.SearchFilter({
            inputSelector: '.header-search input[name="search"]',
            contentSelector: '.directory-list',
            callback: this._onSearchFilter.bind(this),
            initial: this.element.querySelector('.header-search input[name="search"]').value
        }).bind(this.element);
    }


    async _onSearchFilter(event, query, rgx, html) {
        let entryIds = new Set();
        const folderIds = new Set();

        if (query) {
            const regex = new RegExp(RegExp.escape(query), 'i');
            const allFolders = getFolderStructure();
            const allClocks = Object.values(await getAllClocks());

            const includeFolder = (folder) => {
                if (!folder) return;
                if (typeof folder === 'string') folder = allFolders.get(folder);
                if (!folder) return;
                folderIds.add(folder.id);
                if (folder.folder)
                    includeFolder(folder);
            };

            // First search folders by name
            allFolders
                .filter(f => regex.test(SearchFilter.cleanQuery(f.name)))
                .forEach(includeFolder);

            // Then search for clocks, either by name or found in previously selected folders
            allClocks
                .filter(c => regex.test(SearchFilter.cleanQuery(c.name)) || folderIds.has(c.folder))
                .forEach(c => {
                    entryIds.add(c.id);
                    includeFolder(c.folder);
                });
        }

        // Hide / show entries in the list
        $(html).find('li').not('.hidden').each((_, el) => {
            if (el.classList.contains('folder')) {
                let match = query && folderIds.has(el.dataset.folderId);
                el.style.display = (!query || match) ? 'flex' : 'none';
                if (query && match)
                    el.classList.add('expanded');
                else
                    el.classList.toggle('expaned', ClocksSidebarTab.#expandedFolders[el.dataset.folderId]);
            }
            else
                el.style.display = (!query || entryIds.has(el.dataset.clockId)) ? 'flex' : 'none';
        });

    }

    _getFolderContextOptions() {
        const getFolderId = header => $(header).closest('li').data('folderId');
        return [
            {
                name: 'clock-works.sidebar.edit-folder',
                icon: '<i class="fas fa-edit"></i>',
                condition: () => game.user.isGM,
                callback: header => new FolderForm(getFolderId(header)).render(true),
            },
            {
                name: 'OWNERSHIP.Configure',
                icon: '<i class="fas fa-lock"></i>',
                condition: () => game.user.isGM,
                callback: header => {
                    return new ClockPermissionForm(true, getFolderId(header)).render(true);
                }
            },
            {
                name: 'clock-works.sidebar.delete-folder',
                icon: '<i class="fas fa-dumpster"></i>',
                condition: () => game.user.isGM,
                callback: header => {
                    const folder = getFolderStructure().get(getFolderId(header));
                    const subtreeIDs = getFolderSubtree(folder)
                        .map(f => f.id);
                    const clockIDs = Object.values(getAllClocks())
                        .filter(clock => subtreeIDs.includes(clock.folder))
                        .map(clock => clock.id);
                    Dialog.confirm({
                        title: `${game.i18n.localize('FOLDER.Delete')} ${folder.name}`,
                        content: `<h4>${game.i18n.localize('AreYouSure')}</h4><p>${game.i18n.localize('FOLDER.DeleteWarning')}</p>`,
                        yes: () => Promise.all([
                            ...subtreeIDs.map(folderId => deleteFolder(folderId)),
                            ...clockIDs.map(clockId => deleteClock(clockId))
                        ]),
                        no: () => { },
                        defaultYes: false
                    })
                },
            },
        ];
    }

    _getEntryContextOptions() {
        const getClockId = li => $(li).data('clockId');
        return [
            {
                name: 'clock-works.sidebar.show',
                icon: '<i class="fas fa-eye"></i>',
                condition: () => game.user.isGM,
                callback: li => {
                    const clockId = getClockId(li);
                    return shockClockToAll(clockId);
                }
            },
            {
                name: 'clock-works.sidebar.edit',
                icon: '<i class="fas fa-edit"></i>',
                condition: li => checkClockPermission(getClockId(li), CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER),
                callback: li => {
                    const clockId = getClockId(li);
                    return ClockEditForm.open(clockId);
                }
            },
            {
                name: 'OWNERSHIP.Configure',
                icon: '<i class="fas fa-lock"></i>',
                condition: () => game.user.isGM,
                callback: li => {
                    const clockId = getClockId(li);
                    return new ClockPermissionForm(false, clockId).render(true);
                }
            },
            {
                name: 'clock-works.sidebar.duplicate',
                icon: '<i class="fas fa-copy"></i>',
                condition: li => checkClockPermission(getClockId(li), CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER),
                callback: li => {
                    const clockId = getClockId(li);
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
                name: 'clock-works.sidebar.delete',
                icon: '<i class="fas fa-trash"></i>',
                condition: li => checkClockPermission(getClockId(li), CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER),
                callback: li => {
                    const clockId = getClockId(li);
                    return deleteClock(clockId);
                }
            }
        ];
    }

    _canDragStart(selector) {
        return true;
    }

    _canDragDrop(selector) {
        return true;
    }

    _onDragStart(event) {
        if (ui.context) ui.context.close({ animate: false });
        const li = event.currentTarget.closest('.directory-item');
        const isFolder = li.classList.contains('folder');
        const dragData = isFolder ? { type: 'Folder', id: li.dataset.folderId } : { type: 'Clock', id: li.dataset.clockId };
        event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
    }

    _onDragDrop(event) {
        const data = TextEditor.getDragEventData(event);
        if (!data.type) return;
        const target = event.target.closest('.directory-item') || null;
        if (data.type == 'Folder')
            return this._handleDroppedFolder(target, data);
        else
            return this._handleDroppedEntry(target, data);
    }

    async _handleDroppedFolder(target, data) {
        const allFolders = getFolderStructure();
        const folder = allFolders.get(data.id);
        if (!folder)
            return;

        // Determine the closest Folder
        const closestFolder = target ? target.closest('.folder') : null;
        if (closestFolder)
            closestFolder.classList.remove('droptarget');
        let closestFolderId = closestFolder ? closestFolder.dataset.folderId : null;

        // Sort into another Folder
        const sortData = { sortKey: 'sort', sortBefore: true };
        const isRelative = target && target.dataset.folderId;
        if (isRelative) {
            const targetFolder = allFolders.get(target.dataset.folderId);
            // Sort relative to a collapsed Folder
            if (!target.classList.contains('expanded')) {
                sortData.target = targetFolder;
                sortData.parentId = targetFolder.folder;
            }
            // Drop into an expanded Folder
            else {
                sortData.target = null;
                sortData.parentId = targetFolder.id;
            }
        }
        // Sort relative to existing Folder contents
        else {
            sortData.parentId = closestFolderId;
            sortData.target = closestFolder && !closestFolder.classList.contains('expanded') ? closestFolder : null;
        }

        if (sortData.parentId) {
            // Prevent assigning a folder as its own parent.
            if (sortData.parentId === data.id)
                return;
            // Prevent creating a loop
            if (getFolderSubtree(folder).map(f => f.id).includes(sortData.parentId))
                return;
        } else
            sortData.parentId = '';

        // Determine siblings & get new sorting
        sortData.siblings = allFolders.filter(sibling => sibling.folder === sortData.parentId && sibling.id !== folder.id);
        const sorting = SortingHelpers.performIntegerSort(folder, sortData);

        // Prepare updates
        let updateData = { folder: sortData.parentId };
        const updates = sorting.map(s => {
            const update = foundry.utils.mergeObject(updateData, s.update, { inplace: false });
            update.id = s.target.id;
            return update;
        });

        // Perform updates
        const folderList = await getAllFolders();
        return Promise.all(updates.map(
            update => setFolder(update.id, foundry.utils.mergeObject(folderList[update.id], update))
        ));
    }

    async _handleDroppedEntry(target, data) {
        const entry = getClock(data.id);
        if (!entry)
            return;

        // Determine the closest Folder
        const closestFolder = target ? target.closest('.folder') : null;
        if (closestFolder)
            closestFolder.classList.remove('droptarget');
        let folderId = closestFolder ? closestFolder.dataset.folderId : null;

        // Sort relative to another clock
        const sortData = { sortKey: 'sort' };
        const isRelative = target && target.dataset.clockId;
        if (isRelative) {
            // Don't drop on yourself
            if (entry.id === target.dataset.clockId)
                return;
            const targetClock = getClock(target.dataset.clockId);
            sortData.target = targetClock;
            folderId = targetClock?.folder;
        }
        // Sort within the closest Folder
        else
            sortData.target = null;

        // Determine siblings & get new sorting
        sortData.siblings = Object.values(getAllClocks()).filter(clock => clock.folder === folderId && clock.id !== entry.id);
        const sorting = SortingHelpers.performIntegerSort(entry, sortData);

        // Prepare updates
        let updateData = { folder: folderId || null };
        const updates = sorting.map(s => {
            const update = foundry.utils.mergeObject(updateData, s.update, { inplace: false });
            update.id = s.target.id;
            return update;
        });

        // Perform updates
        const allClocks = await getAllClocks();
        return Promise.all(updates.map(
            update => setClock(update.id, foundry.utils.mergeObject(allClocks[update.id], update))
        ));
    }

    _onDragHighlight(event) {
        event.stopPropagation();
        if (event.type === "dragenter") {
            for (const el of this.element.querySelectorAll(".droptarget")) el.classList.remove("droptarget");
        }
        else if (event.type === "dragleave") {
            // Look up the hovered element (event.target is the element that was left)
            const el = document.elementFromPoint(event.clientX, event.clientY);
            const parent = el.closest(".folder");
            if (parent === event.currentTarget) return;
        }
        event.currentTarget.classList.toggle("droptarget", event.type === "dragenter");
    }
}
