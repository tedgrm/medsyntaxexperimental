// The WORKSPACE: a list of items, each an EDITOR (../index.html?ws=<id>) in an iframe.
//
// An item's id stays the same while the page is open; its position is its place in `items`.
// The link holds each item as <position, 9 digits>iframequery=<compressed EDITOR query string>.

const padLength = 9;
const itemKeyPattern = new RegExp('^[0-9]{' + padLength + '}iframequery');

// 1-4: the textarea borders of https://tedgrm.github.io/picomedsyntax/; then blue, cyan, orange, brown,
// slate and dark green. They repeat after the last one.
const itemColors = ['#E12A39', '#FFB407', '#89CA26', '#7527A1', '#1F6FD1', '#17B8C9', '#F2760C', '#7A4A2B',
    '#5B6B7B', '#14613B'];

// true while a title, query box or scope edit has the focus
let editMode = false;

const titlePlaceholder = 'Please input a title for your query here...';

// The titles and queries of the demo in https://tedgrm.github.io/picomedsyntax/, with the query of O nested
// (brackets in brackets in brackets)
const picoExample = [
    ['P (Population/Problem)', 'handover OR "Patient Handoff"[Mesh] OR handoff OR "patient transfer"'],
    ['I (Intervention)', 'SBAR OR ISBAR OR SBAR-R OR ISBARR OR ISOBAR'],
    ['C (Comparison/Control)', ''],
    ['O (Outcome)', 'teamwork OR "inter-professional communication" OR ("communication"[Mesh] OR communication'
        + ' OR ("Interdisciplinary Communication"[Mesh] AND ("Patient Safety"[Mesh] OR "patient safety"'
        + ' OR "safety culture")))'],
];

// A search line by line; the last two lines combine the others, the last one with nested brackets.
const multilineExample = [
    ['Population: MeSH terms', '"Patient Handoff"[Mesh]'],
    ['Population: free text', 'handover OR handoff OR "patient transfer"'],
    ['Population', '#1 OR #2'],
    ['Intervention', 'SBAR OR ISBAR OR SBAR-R OR ISBARR OR ISOBAR'],
    ['Outcome: MeSH terms', '"Communication"[Mesh] OR "Interdisciplinary Communication"[Mesh] OR "Patient Safety"[Mesh]'],
    ['Outcome: free text', 'teamwork OR communication OR "patient safety" OR "safety culture"'],
    ['Outcome', '#5 OR #6'],
    ['Full search', '#3 AND #4 AND #7'],
    ['Full search, nested', '(#1 OR #2) AND (#4 AND (#5 OR (#6 AND #2)))'],
];

let items = [];
let nextItemId = 0;
let removedItem = null; // the last removed item, while Undo is available

// --- The query string of an item

function decompress(value) {
    return (value && LZString.decompressFromEncodedURIComponent(value)) || '';
}

function storedTitle(item) {
    return decompress(new URLSearchParams(item.queryString).get('querytitle'));
}

function itemTitle(item) {
    return storedTitle(item).trim();
}

function itemQuery(item) {
    return decompress(new URLSearchParams(item.queryString).get('query')).trim();
}

// No title and no query.
function isClear(item) {
    return itemTitle(item) === '' && itemQuery(item) === '';
}

// The newest state, including a change whose message has not arrived yet.
function currentQueryString(item) {
    const itemWindow = item.frame.contentWindow;
    if (itemWindow && typeof itemWindow.itemQueryString === 'string') {
        setQueryString(item, itemWindow.itemQueryString);
    }
    return item.queryString;
}

// The title field is in the card header, so what an item says about its title may be outdated.
function setQueryString(item, queryString) {
    item.queryString = queryString;
    const title = part(item, 'title').value;
    if (storedTitle(item) !== title) {
        const params = new URLSearchParams(queryString);
        params.set('querytitle', LZString.compressToEncodedURIComponent(title));
        item.queryString = params.toString();
    }
}

// --- References to other items (#3) in queries: ../references.js

function renumberedQueryString(queryString, mapping) {
    const params = new URLSearchParams(queryString);
    const query = decompress(params.get('query'));
    const renumbered = renumberText(query, mapping).text;
    if (renumbered === query) {
        return queryString;
    }
    params.set('query', LZString.compressToEncodedURIComponent(renumbered));
    return params.toString();
}

function renumberItem(item, mapping, willReload) {
    const itemWindow = item.frame.contentWindow;
    if (!willReload && itemWindow && itemWindow.itemIsReady) {
        // Also for a query without these references: an open scope edit can have them.
        itemWindow.renumberItemReferences(mapping);
        currentQueryString(item);
        return;
    }
    const queryString = renumberedQueryString(item.queryString, mapping);
    if (queryString === item.queryString) {
        return;
    }
    item.queryString = queryString;
    const place = item.frame.parentNode;
    if (willReload || !item.frame.isConnected) {
        setFrameSource(item);
    } else {
        // It is loading the old numbers. Out of the page and back: what the old one still sends is ignored.
        item.frame.remove();
        setFrameSource(item);
        place.append(item.frame);
    }
}

// Every change to the order or number of items goes through this: references follow their item. The numbers change
// first, so that an iframe that loads because of the change has the new ones.
//  - newItems: the items after the change; change() makes it
//  - more: changes to the mapping; moved: the item whose iframe loads again; except: one that has the right numbers
function changeItems(newItems, change, {more = {}, moved = null, except = null} = {}) {
    items.forEach(currentQueryString);
    const mapping = {};
    items.forEach((item, position) => {
        const newPosition = newItems.indexOf(item);
        if (newPosition !== position) {
            mapping[position + 1] = newPosition === -1 ? (position + 1) + '?' : String(newPosition + 1);
        }
    });
    Object.assign(mapping, more);
    if (Object.keys(mapping).length) {
        newItems.filter((item) => item !== except).forEach((item) => renumberItem(item, mapping, item === moved));
    }
    change();
}

function withItemAt(list, position, item) {
    return [...list.slice(0, position), item, ...list.slice(position)];
}

function resolvedItems() {
    return resolveQueries(items.map(itemQuery));
}

// Tells each item about its references, and shows what can be copied.
function refreshReferences() {
    const resolved = resolvedItems();
    items.forEach((item, position) => {
        const {references, full, problem: ownProblem} = resolved[position];
        const hasReferences = Object.keys(references).length > 0;
        item.element.classList.toggle('has-references', hasReferences);
        part(item, 'copy-full').hidden = !hasReferences;
        part(item, 'copy-full').disabled = full === '';
        const payload = {};
        Object.entries(references).forEach(([key, problem]) => {
            payload[key] = problem ? {problem} : {
                problem: '',
                color: itemColor(key - 1),
                ink: inkOn(itemColor(key - 1)) === '#ffffff' ? '#ffffff' : '#1c2525',
                title: key + '. ' + [itemTitle(items[key - 1]), resolved[key - 1].full.slice(0, 500)]
                    .filter((text) => text).join(': '),
            };
        });
        // The other problems already have a warning or a red chip.
        const tooLong = hasReferences && ownProblem.includes('too long') ? 'The query ' + ownProblem + '.' : '';
        const message = {references: payload, warning: tooLong};
        const sent = JSON.stringify(message);
        if (item.loaded && item.sentReferences !== sent) {
            item.sentReferences = sent;
            sendToItem(item, 'references', message);
        }
    });
}

// --- The link

function pad(num, size) {
    return num.toString().padStart(size, '0');
}

let linkRetry = null;

function writeLink() {
    const queryParams = new URLSearchParams(window.location.search);
    [...queryParams.keys()].filter((key) => key.includes('iframequery')).forEach((key) => queryParams.delete(key));
    items.forEach((item, position) => {
        queryParams.set(pad(position, padLength) + 'iframequery',
            LZString.compressToEncodedURIComponent(item.queryString));
    });
    queryParams.sort();
    clearTimeout(linkRetry);
    try {
        history.replaceState(null, null, '?' + queryParams.toString());
    } catch (error) {
        // Safari allows 100 changes in 10 seconds.
        linkRetry = setTimeout(writeLink, 1000);
    }
}

// The query strings in the link, in order.
function queryStringsFromLink() {
    return [...new URLSearchParams(window.location.search).entries()]
        .filter(([key]) => itemKeyPattern.test(key))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, value]) => decompress(value).replace(/^&/, ''));
}

// --- Building items

function createItem(queryString) {
    const id = nextItemId++;
    const element = document.createElement('li');
    element.className = 'item';
    element.id = 'li_item_' + id;
    element.innerHTML = `
        <div class="card">
            <div class="item-head">
                <span class="badge" data-part="badge"></span>
                <input class="item-title" data-part="title" type="text">
                <div class="actions">
                    <button class="btn" data-part="collapse" data-label="Collapse" aria-controls="item_editor_${id}"></button>
                    <button class="btn" data-part="up" data-label="Move up">↑</button>
                    <button class="btn" data-part="down" data-label="Move down">↓</button>
                    <div class="more">
                        <button class="btn" data-part="more" data-label="More actions for" aria-expanded="false" aria-controls="item_menu_${id}">More ▾</button>
                        <div class="more-menu" id="item_menu_${id}">
                            <button class="btn" data-part="duplicate" data-label="Duplicate">Duplicate</button>
                            <button class="btn" data-part="edit">Edit query</button>
                            <button class="btn" data-part="copy">Copy query</button>
                            <button class="btn" data-part="copy-full" hidden>Copy full query</button>
                            <button class="btn" data-part="clear">Clear query</button>
                        </div>
                    </div>
                    <button class="btn primary" data-part="add" data-label="+ Add query after">+<span class="add-words"> Add query</span></button>
                    <button class="btn danger" data-part="remove" data-label="Remove">Remove</button>
                </div>
            </div>
            <div class="item-editor" id="item_editor_${id}"></div>
        </div>`;

    const frame = document.createElement('iframe');
    frame.id = 'page_is_fresh_' + id;
    frame.name = 'iframe' + id;
    // allow-modals: the EDITOR uses alerts, for example for an invalid scope edit.
    frame.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-top-navigation allow-modals');

    const item = {id, element, frame, queryString: queryString || '', loaded: false, focusOnLoad: null,
        clearOnLoad: false, repairs: 0};
    frame.addEventListener('load', () => {
        item.loaded = true;
        item.sentReferences = null;
        setTimeout(() => repairItem(item), repairTime);
        frame.contentWindow.addEventListener('wheel', stopCentering, {passive: true});
        sendItemState(item);
        sendToItem(item, 'setTitle', part(item, 'title').value);
        refreshReferences();
        if (item.clearOnLoad) {
            clearItem(item);
        }
        if (item.focusOnLoad) {
            focusItem(item, item.focusOnLoad);
        }
    });
    setUpTitle(item);
    setFrameSource(item);
    element.querySelector('.item-editor').append(frame);
    return item;
}

// During quick changes, WebKit can stop loading an item's scripts. Then it loads again, at most three times.
const repairTime = 1500;

function repairItem(item) {
    if (items.includes(item) && item.loaded && !item.frame.contentWindow.itemIsReady && item.repairs < 3) {
        item.repairs++;
        setFrameSource(item);
    }
}

function setUpTitle(item) {
    const title = part(item, 'title');
    title.value = storedTitle(item);
    title.addEventListener('input', () => {
        currentQueryString(item);
        setQueryString(item, item.queryString);
        sendToItem(item, 'setTitle', title.value);
        refreshItem(item);
        refreshReferences();
        writeLink();
    });
    title.addEventListener('focus', () => {
        editMode = true;
    });
    title.addEventListener('blur', () => {
        editMode = false;
    });
    title.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !event.isComposing) {
            event.preventDefault(); // Safari: stay in full screen
            selectItem(item);
        }
    });
}

function setFrameSource(item) {
    item.loaded = false;
    item.frame.setAttribute('src', '../index.html?ws=' + item.id + '&' + item.queryString);
}

function part(item, name) {
    return item.element.querySelector('[data-part="' + name + '"]');
}

function itemOf(element) {
    return items.find((item) => item.element.contains(element));
}

// Put an item in the list at this position. This (re)loads its iframe, and no other.
function placeItem(item, position) {
    const next = items[position];
    items.splice(position, 0, item);
    document.getElementById('myList').insertBefore(item.element, next ? next.element : null);
    if (!item.frame.iFrameResizer) {
        iframeResize({license: 'GPLv3', log: false, onResized: () => fitItem(item)}, item.frame);
    }
}

function takeItem(item) {
    const position = items.indexOf(item);
    items.splice(position, 1);
    item.element.remove();
    return position;
}

// --- Showing the state of the list

function luminance(hex) {
    const [red, green, blue] = [1, 3, 5].map((start) => {
        const value = parseInt(hex.slice(start, start + 2), 16) / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

// White if it has at least 4.5:1 contrast on the colour, otherwise dark.
function inkOn(hex) {
    return 1.05 / (luminance(hex) + 0.05) >= 4.5 ? '#ffffff' : 'var(--badge-dark-ink)';
}

function itemColor(position) {
    return itemColors[position % itemColors.length];
}

function refreshList() {
    items.forEach((item, position) => {
        const number = position + 1;
        const color = itemColor(position);
        item.element.style.setProperty('--item-color', color);
        item.element.style.setProperty('--item-ink', inkOn(color));
        // Not the title: iframe-resizer sets that to the title of the page inside.
        item.frame.setAttribute('aria-label', 'Editor of query ' + number);
        part(item, 'badge').textContent = number;
        part(item, 'title').setAttribute('aria-label', 'Title of query ' + number);
        item.element.querySelectorAll('[data-label]').forEach((button) => {
            // The accessible name starts with the visible text (WCAG 2.5.3).
            button.setAttribute('aria-label', button.dataset.label
                + (button.dataset.part === 'add' ? ' ' : ' query ') + number);
        });
        part(item, 'up').disabled = position === 0;
        part(item, 'down').disabled = position === items.length - 1;
        refreshCollapse(item);
        refreshItem(item);
        sendItemState(item);
    });
    refreshReferences();
    writeLink();
}

// The item's title, or its number if it has none
function itemName(item) {
    return itemTitle(item) || String(items.indexOf(item) + 1);
}

function refreshItem(item) {
    ['edit', 'copy', 'copy-full', 'clear'].forEach((name) => {
        const label = {edit: 'Edit', copy: 'Copy', 'copy-full': 'Copy full', clear: 'Clear'}[name];
        part(item, name).setAttribute('aria-label', label + ' query ' + itemName(item));
    });
    part(item, 'copy').disabled = itemQuery(item) === '';
    // Collapsed and without a title, the start of the query shows which item it is.
    part(item, 'title').placeholder = item.element.classList.contains('is-collapsed')
        ? itemQuery(item) || 'Empty query' : titlePlaceholder;
    part(item, 'remove').disabled = items.length === 1 && isClear(item);
    ['show-example', 'show-multiline-example'].forEach((id) => {
        document.getElementById(id).hidden = !items.every(isClear);
    });
}

function refreshCollapse(item) {
    const collapsed = item.element.classList.contains('is-collapsed');
    const button = part(item, 'collapse');
    button.textContent = collapsed ? 'Expand' : 'Collapse';
    button.dataset.label = button.textContent;
    button.setAttribute('aria-label', button.textContent + ' query ' + (items.indexOf(item) + 1));
    button.setAttribute('aria-expanded', String(!collapsed));
}

function setCollapsed(item, collapsed) {
    item.element.classList.toggle('is-collapsed', collapsed);
    refreshCollapse(item);
    refreshItem(item);
    if (!collapsed) {
        // It had no size while hidden.
        item.frame.iFrameResizer.resize();
    }
}

// iframe-resizer can miss a change, such as while this page is hidden, and then keeps a wrong height. So the
// item reports changes too, and its real height decides.
function fitItem(item) {
    const body = item.frame.contentDocument && item.frame.contentDocument.body;
    const height = body ? body.getBoundingClientRect().height : 0;
    if (height > 0) { // 0 while collapsed
        item.frame.style.height = height + 'px';
    }
    if (centeredItem) {
        scrollToCenter(centeredItem);
    }
}

// --- Centering the selected item. Its height, or that of one above it, can still change just after it was
// selected (expanding, loading, a query box that hides): it is centered again, unless the user scrolls.

const centeringTime = 500;
let centeredItem = null;
let centeringTimer = null;

function stopCentering() {
    clearTimeout(centeringTimer);
    centeredItem = null;
}

function scrollToCenter(item) {
    const card = item.element.querySelector('.card');
    // Too tall: its title and the start of its query.
    card.scrollIntoView({block: card.offsetHeight > window.innerHeight ? 'start' : 'center'});
}

function centerItem(item) {
    stopCentering();
    scrollToCenter(item);
    centeredItem = item;
    centeringTimer = setTimeout(stopCentering, centeringTime);
}

document.addEventListener('wheel', stopCentering, {passive: true});

function announce(text) {
    document.getElementById('workspace-status').textContent = text;
}

// --- Messages to the items

function sendToItem(item, type, payload) {
    if (item.loaded) {
        item.frame.contentWindow.postMessage({status: 'success', type, payload}, window.location.origin);
    }
}

function sendItemState(item) {
    const position = items.indexOf(item);
    sendToItem(item, 'itemState', {
        color: itemColor(position), number: position + 1, theme: currentTheme(),
    });
}

document.addEventListener('medsyntax:theme', () => items.forEach(sendItemState));

// message: 'focusItem' for the item itself, in its tree, or 'editQuery' for its query box. Waits until the
// item has loaded.
function focusItem(item, message = 'focusItem') {
    if (!item.loaded) {
        item.focusOnLoad = message;
        return;
    }
    item.focusOnLoad = null;
    item.frame.focus({preventScroll: true});
    item.frame.contentWindow.focus();
    sendToItem(item, message, null);
}

// A pending focus of another item must not take the focus away again.
function clearPendingFocus() {
    items.forEach((item) => {
        item.focusOnLoad = null;
    });
}

// Make the item itself current in navigation mode.
function selectItem(item) {
    clearPendingFocus();
    setCollapsed(item, false);
    focusItem(item);
}

function focusPart(item, name) {
    stopCentering();
    clearPendingFocus();
    // Not shown: in the closed More menu.
    const button = part(item, name).offsetParent ? part(item, name) : part(item, 'more');
    button.focus({preventScroll: true});
    item.element.scrollIntoView({block: 'nearest'});
}

// --- The More menu, on narrow screens (see style.css)

let itemWithMenu = null;

function closeMenu() {
    if (itemWithMenu) {
        itemWithMenu.element.classList.remove('menu-open');
        part(itemWithMenu, 'more').setAttribute('aria-expanded', 'false');
        itemWithMenu = null;
    }
}

function toggleMenu(item) {
    const open = itemWithMenu !== item;
    closeMenu();
    if (open) {
        itemWithMenu = item;
        item.element.classList.add('menu-open');
        part(item, 'more').setAttribute('aria-expanded', 'true');
    }
}

function isOutsideMenu(element) {
    return itemWithMenu && !itemWithMenu.element.querySelector('.more').contains(element);
}

document.addEventListener('pointerdown', (event) => {
    if (isOutsideMenu(event.target)) {
        closeMenu();
    }
}, true);
document.addEventListener('focusin', (event) => {
    if (isOutsideMenu(event.target)) {
        closeMenu();
    }
});
// The focus goes into an item.
window.addEventListener('blur', closeMenu);
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && itemWithMenu && !wipNoticeIsOpen()) {
        event.preventDefault(); // Safari: stay in full screen
        const item = itemWithMenu;
        closeMenu();
        part(item, 'more').focus();
    }
});

// --- Number keys: a digit selects the item with that number. A digit soon after it extends the number, if
// there is such an item. The focus goes to another iframe in between, so the number is kept here.

const numberPause = 1000;
let typedNumber = '';
let typedNumberTimer = null;

function clearTypedNumber() {
    clearTimeout(typedNumberTimer);
    typedNumber = '';
}

function selectByDigit(digit) {
    const number = [typedNumber + digit, digit].find((candidate) => items[candidate - 1]);
    clearTypedNumber();
    if (!number) {
        announce('No query ' + digit);
        return;
    }
    closeMenu();
    typedNumber = number;
    typedNumberTimer = setTimeout(clearTypedNumber, numberPause);
    selectItem(items[number - 1]);
}

// The switch. Off: only in navigation mode (WCAG 2.1.4).
const numberKeysStorageKey = 'medsyntaxqa-number-keys';
const numberKeysSwitch = document.getElementById('number-keys');

function numberKeysEverywhere() {
    return numberKeysSwitch.checked;
}

try {
    numberKeysSwitch.checked = localStorage.getItem(numberKeysStorageKey) !== 'off';
} catch (error) {
    numberKeysSwitch.checked = true; // storage is blocked
}
numberKeysSwitch.addEventListener('change', () => {
    try {
        localStorage.setItem(numberKeysStorageKey, numberKeysSwitch.checked ? 'on' : 'off');
    } catch (error) {
        // storage is blocked: the choice lasts until the page closes
    }
});

document.addEventListener('keydown', (event) => {
    if (!/^[0-9]$/.test(event.key) || event.ctrlKey || event.altKey || event.metaKey || event.repeat
        || event.isComposing || event.target.matches('textarea, input:not([type=radio], [type=checkbox])')
        || !numberKeysEverywhere() || wipNoticeIsOpen()) { // not behind the work-in-progress warning
        return;
    }
    event.preventDefault();
    selectByDigit(event.key);
});

// --- Actions

function clearUndo() {
    removedItem = null;
    document.getElementById('undo-toast').hidden = true;
}

function addItem(position, queryString, message) {
    clearUndo();
    const item = createItem(queryString);
    changeItems(withItemAt(items, position, item), () => placeItem(item, position));
    refreshList();
    focusPart(item, 'title');
    announce(message + ' ' + (position + 1));
}

// In place of the clear items.
function showExample(example) {
    items.forEach(currentQueryString);
    if (!items.every(isClear)) {
        return;
    }
    clearUndo();
    [...items].forEach(takeItem);
    example.forEach(([title, query], position) => {
        placeItem(createItem(new URLSearchParams({
            querytitle: LZString.compressToEncodedURIComponent(title),
            query: LZString.compressToEncodedURIComponent(query),
        }).toString()), position);
    });
    refreshList();
    // Nothing is selected and no text field is active, as after opening the page.
    document.activeElement.blur();
    announce('Example added: ' + example.length + ' queries');
}

function duplicateItem(item) {
    addItem(items.indexOf(item) + 1, currentQueryString(item), 'Duplicated as query');
}

// An item with a title or a query is only removed after a confirmation.
function confirmRemoval(item) {
    const query = decompress(new URLSearchParams(currentQueryString(item)).get('query')).trim();
    const title = itemTitle(item);
    if (title === '' && query === '') {
        return true;
    }
    return window.confirm('Remove query ' + (items.indexOf(item) + 1) + (title ? ' "' + title + '"' : '') + '?');
}

function removeItem(item) {
    const position = items.indexOf(item);
    // Older missing references can't come back any more: Undo is for this removal only.
    const olderMissing = {'*?': '?'};
    removedItem = {queryString: renumberedQueryString(currentQueryString(item), olderMissing), position,
        replacement: null};
    // The list is never empty: one clear item takes the place of the only item.
    if (items.length === 1) {
        removedItem.replacement = createItem();
    }
    const {replacement} = removedItem;
    changeItems(replacement ? [replacement] : items.filter((other) => other !== item), () => {
        takeItem(item);
        if (replacement) {
            placeItem(replacement, 0);
        }
    }, {more: olderMissing});
    refreshList();
    document.getElementById('undo-toast-text').textContent = 'Query ' + (position + 1) + ' removed';
    document.getElementById('undo-toast').hidden = false;
    announce('Query ' + (position + 1) + ' removed. Undo is available.');
    if (removedItem.replacement) {
        focusPart(removedItem.replacement, 'title');
    } else {
        // Not the neighbour's Remove button: a second Enter would remove that item too.
        focusPart(items[Math.min(position, items.length - 1)], 'collapse');
    }
}

function undoRemove() {
    const {queryString, position, replacement} = removedItem;
    clearUndo();
    const item = createItem(queryString);
    if (replacement) {
        currentQueryString(replacement);
    }
    const replaced = replacement && isClear(replacement);
    const others = replaced ? items.filter((other) => other !== replacement) : items;
    changeItems(withItemAt(others, position, item), () => {
        if (replaced) {
            takeItem(replacement);
        }
        placeItem(item, position);
    }, {more: {[(position + 1) + '?']: String(position + 1)}, except: item});
    refreshList();
    focusPart(item, 'collapse');
    announce('Query ' + (position + 1) + ' restored');
}

// Clears the query, not the title. Waits until the item has loaded.
function clearItem(item) {
    item.clearOnLoad = !item.loaded;
    sendToItem(item, 'clearQuery', null);
}

function editQuery(item) {
    setCollapsed(item, false);
    focusItem(item, 'editQuery');
}

const copyLabels = {copy: 'Copy query', 'copy-full': 'Copy full query', more: 'More ▾'};

// The text of the button that the user sees becomes the result for a moment.
function showCopyResult(item, name, text) {
    const button = part(item, name).offsetParent ? part(item, name) : part(item, 'more');
    clearTimeout(item.copyTimer);
    Object.entries(copyLabels).forEach(([other, label]) => {
        part(item, other).textContent = label;
    });
    button.textContent = text;
    announce('Query ' + itemName(item) + ': ' + text.toLowerCase());
    item.copyTimer = setTimeout(() => {
        button.textContent = copyLabels[button.dataset.part];
    }, 2000);
}

async function copyQuery(item) {
    const queryBox = item.loaded && item.frame.contentDocument.getElementById('query-input1');
    try {
        await navigator.clipboard.writeText(queryBox ? queryBox.value
            : decompress(new URLSearchParams(item.queryString).get('query')));
        showCopyResult(item, 'copy', 'Copied');
    } catch (error) {
        showCopyResult(item, 'copy', 'Not copied');
    }
}

async function copyFullQuery(item) {
    items.forEach(currentQueryString);
    const {full} = resolvedItems()[items.indexOf(item)];
    try {
        if (!full) {
            throw new Error('a reference has a problem');
        }
        await navigator.clipboard.writeText(full);
        showCopyResult(item, 'copy-full', 'Copied');
    } catch (error) {
        showCopyResult(item, 'copy-full', 'Not copied');
    }
}

function moveItem(item, direction) {
    clearUndo();
    const position = items.indexOf(item) + (direction === 'up' ? -1 : 1);
    const newItems = withItemAt(items.filter((other) => other !== item), position, item);
    changeItems(newItems, () => {
        takeItem(item);
        // The iframe loads again in its new place.
        setFrameSource(item);
        placeItem(item, position);
    }, {moved: item});
    refreshList();
    const opposite = direction === 'up' ? 'down' : 'up';
    focusPart(item, part(item, direction).disabled ? opposite : direction);
    announce('Moved to position ' + (position + 1));
}

document.getElementById('myList').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) {
        return;
    }
    const item = itemOf(button);
    if (button.dataset.part !== 'more') {
        closeMenu();
    }
    switch (button.dataset.part) {
        case 'more':
            toggleMenu(item);
            break;
        case 'edit':
            editQuery(item);
            break;
        case 'copy':
            focusPart(item, 'copy');
            copyQuery(item);
            break;
        case 'copy-full':
            focusPart(item, 'copy-full');
            copyFullQuery(item);
            break;
        case 'add':
            addItem(items.indexOf(item) + 1, '', 'Added query');
            break;
        case 'duplicate':
            duplicateItem(item);
            break;
        case 'remove':
            if (confirmRemoval(item)) {
                removeItem(item);
            }
            break;
        case 'clear':
            clearItem(item);
            focusPart(item, 'clear');
            announce('Query ' + itemName(item) + ' cleared');
            break;
        case 'up':
        case 'down':
            moveItem(item, button.dataset.part);
            break;
        case 'collapse':
            setCollapsed(item, !item.element.classList.contains('is-collapsed'));
            break;
    }
});
document.getElementById('add-first-item').addEventListener('click', () => addItem(0, '', 'Added query'));
document.getElementById('show-example').addEventListener('click', () => showExample(picoExample));
document.getElementById('show-multiline-example').addEventListener('click', () => showExample(multilineExample));
document.getElementById('undo-button').addEventListener('click', undoRemove);

// --- Hiding a query box after it lost the focus. Hiding it moves what is below, so this waits until the
// pointer is up anywhere in the WORKSPACE; a click that took the focus away then still reaches its target.

const boxesToHide = new Set();
let pointerIsDown = false;

function hideQueryBoxes() {
    // Not while another window has the focus: the user comes back to the same box.
    if (pointerIsDown || !document.hasFocus()) {
        return;
    }
    boxesToHide.forEach((item) => sendToItem(item, 'hideQueryBox', null));
    boxesToHide.clear();
}

function setPointerDown(isDown) {
    pointerIsDown = isDown;
    if (isDown) {
        stopCentering();
    }
    if (!isDown) {
        setTimeout(hideQueryBoxes, 50);
    }
}

document.addEventListener('pointerdown', () => setPointerDown(true), true);
document.addEventListener('pointerup', () => setPointerDown(false), true);
document.addEventListener('pointercancel', () => setPointerDown(false), true);
window.addEventListener('focus', () => setTimeout(hideQueryBoxes, 50));

// --- Messages from the items

window.addEventListener('message', (event) => {
    // Only our own items, from our own origin.
    if (event.origin !== window.location.origin) {
        console.error('Message received from unauthorized origin!');
        return;
    }
    const item = items.find((candidate) => candidate.frame.contentWindow === event.source);
    if (!item || !event.data) {
        return;
    }

    switch (event.data.type) {
        case 'setEditMode':
            editMode = event.data.payload;
            break;
        case 'updateUrl': {
            // payload: <id>%index%<EDITOR query string without ws>. The numbers in it can be old by now, so it
            // is only a sign: what the item holds is always the newest.
            const [id] = event.data.payload.split('%index%');
            if (id === String(item.id)) {
                currentQueryString(item);
                refreshItem(item);
                refreshReferences();
                writeLink();
            }
            break;
        }
        case 'moveFocus': {
            // Alt+Up (-1) or Alt+Down (1) in an item
            clearTypedNumber();
            const neighbour = items[items.indexOf(item) + event.data.payload];
            if (neighbour) {
                selectItem(neighbour);
            }
            break;
        }
        case 'selectNumber': {
            // A digit in an item, in its tree or not
            const {digit, inTree} = event.data.payload;
            if (/^[0-9]$/.test(digit) && (inTree || numberKeysEverywhere())) {
                selectByDigit(digit);
            }
            break;
        }
        case 'centerItem':
            centerItem(item);
            break;
        case 'itemResized':
            fitItem(item);
            break;
        case 'focusTitle':
            // T in an item
            focusPart(item, 'title');
            break;
        case 'pointerState':
            closeMenu();
            setPointerDown(event.data.payload);
            break;
        case 'queryBoxLeft':
            boxesToHide.add(item);
            setTimeout(hideQueryBoxes, 0);
            break;
    }
});

// --- Start: the items in the link without the clear ones, but never an empty list

const linkedItems = queryStringsFromLink().map((queryString) => ({queryString}));
const keptItems = linkedItems.filter((item) => !isClear(item));
const linkMapping = {};
linkedItems.forEach((item, position) => {
    const newPosition = keptItems.indexOf(item);
    linkMapping[position + 1] = newPosition === -1 ? (position + 1) + '?' : String(newPosition + 1);
});
keptItems.forEach((item, position) => {
    placeItem(createItem(renumberedQueryString(item.queryString, linkMapping)), position);
});
if (items.length === 0) {
    placeItem(createItem(), 0);
}
refreshList();
