import { ClockEditForm, defaultClockValues } from './clock-edit.js';
import { ClockDisplay, renderClockImage } from './clock-display.js';
import { deleteClock, generateClockId, getAllClocks, getClock, setClock } from './settings.js';

export class ClocksSidebarTab extends SidebarTab {
    constructor(options = {}) {
        super(options);
        if (ui.sidebar) ui.sidebar.tabs.clocks = this;
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

    /** @override */
    async getData(options = {}) {
        const context = await super.getData(options);

        // Filter packs for visibility
        const clockList = Object.values(getAllClocks());

        // Return data to the sidebar
        return foundry.utils.mergeObject(context, {
            clocks: clockList,
        });
    }


    /** @inheritDoc */
    activateListeners(html) {
        super.activateListeners(html);

        // Adding a new clock
        html.find('.create-document').click(async evt => {
            const newClock = defaultClockValues();
            await setClock(newClock.id, newClock);
            ClockEditForm.open(newClock.id);
        });

        // Editing an existing clock
        html.find('li.directory-item a').click(evt => {
            const display =  new ClockDisplay($(evt.target).parents('li').data('clockId'));
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
        ContextMenu.create(this, html, ".directory-item", this._getEntryContextOptions());
    }

    _getEntryContextOptions() {
        return [
            {
                name: "clock-works.sidebar.edit",
                icon: '<i class="fas fa-edit"></i>',
                callback: li => {
                    const clockId = li.data('clockId');
                    return ClockEditForm.open(clockId);
                }
            },
            {
                name: "clock-works.sidebar.duplicate",
                icon: '<i class="fas fa-copy"></i>',
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
        $(this._element).find('li').each(renderClockImage);
        return ret;
    }

}
