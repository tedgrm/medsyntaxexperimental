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

// The titles and queries of the demo in https://tedgrm.github.io/picomedsyntax/
const picoExample = [
    ['P (Population/Problem)', 'handover OR "Patient Handoff"[Mesh] OR handoff OR "patient transfer"'],
    ['I (Intervention)', 'SBAR OR ISBAR OR SBAR-R OR ISBARR OR ISOBAR'],
    ['C (Comparison/Control)', ''],
    ['O (Outcome)', 'teamwork OR "inter-professional communication" OR "communication"[Mesh] OR communication'
        + ' OR "Interdisciplinary Communication"[Mesh] OR "Patient Safety"[Mesh] OR "patient safety"'
        + ' OR "safety culture"'],
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
                            <button class="btn" data-part="clear">Clear query</button>
                        </div>
                    </div>
                    <button class="btn danger" data-part="remove" data-label="Remove">Remove</button>
                </div>
            </div>
            <div class="item-editor" id="item_editor_${id}"></div>
        </div>
        <div class="after"><button class="btn primary" data-part="add" data-label="+ Add query after">+ Add query</button></div>`;

    const frame = document.createElement('iframe');
    frame.id = 'page_is_fresh_' + id;
    frame.name = 'iframe' + id;
    // allow-modals: the EDITOR uses alerts, for example for an invalid scope edit.
    frame.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-top-navigation allow-modals');

    const item = {id, element, frame, queryString: queryString || '', loaded: false, focusOnLoad: null,
        clearOnLoad: false};
    frame.addEventListener('load', () => {
        item.loaded = true;
        sendItemState(item);
        sendToItem(item, 'setTitle', part(item, 'title').value);
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

function setUpTitle(item) {
    const title = part(item, 'title');
    title.value = storedTitle(item);
    title.addEventListener('input', () => {
        currentQueryString(item);
        setQueryString(item, item.queryString);
        sendToItem(item, 'setTitle', title.value);
        refreshItem(item);
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
            setCollapsed(item, false);
            focusItem(item);
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
    writeLink();
}

// The item's title, or its number if it has none
function itemName(item) {
    return itemTitle(item) || String(items.indexOf(item) + 1);
}

function refreshItem(item) {
    ['edit', 'copy', 'clear'].forEach((name) => {
        const label = {edit: 'Edit', copy: 'Copy', clear: 'Clear'}[name];
        part(item, name).setAttribute('aria-label', label + ' query ' + itemName(item));
    });
    part(item, 'copy').disabled = itemQuery(item) === '';
    // Collapsed and without a title, the start of the query shows which item it is.
    part(item, 'title').placeholder = item.element.classList.contains('is-collapsed')
        ? itemQuery(item) || 'Empty query' : titlePlaceholder;
    part(item, 'remove').disabled = items.length === 1 && isClear(item);
    document.getElementById('show-example').hidden = !items.every(isClear);
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
}

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

function focusPart(item, name) {
    // A pending focus of another item must not take it away again.
    items.forEach((other) => {
        other.focusOnLoad = null;
    });
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
    if (event.key === 'Escape' && itemWithMenu) {
        const item = itemWithMenu;
        closeMenu();
        part(item, 'more').focus();
    }
});

// --- Actions

function clearUndo() {
    removedItem = null;
    document.getElementById('undo-toast').hidden = true;
}

function addItem(position, queryString, message) {
    clearUndo();
    const item = createItem(queryString);
    placeItem(item, position);
    refreshList();
    focusPart(item, 'title');
    announce(message + ' ' + (position + 1));
}

// Four items, in place of the clear ones.
function showExample() {
    items.forEach(currentQueryString);
    if (!items.every(isClear)) {
        return;
    }
    clearUndo();
    [...items].forEach(takeItem);
    picoExample.forEach(([title, query], position) => {
        placeItem(createItem(new URLSearchParams({
            querytitle: LZString.compressToEncodedURIComponent(title),
            query: LZString.compressToEncodedURIComponent(query),
        }).toString()), position);
    });
    refreshList();
    focusPart(items[0], 'title');
    announce('Example added: ' + picoExample.length + ' queries');
}

function duplicateItem(item) {
    addItem(items.indexOf(item) + 1, currentQueryString(item), 'Duplicated as query');
}

function removeItem(item) {
    const queryString = currentQueryString(item);
    const position = takeItem(item);
    removedItem = {queryString, position, replacement: null};
    // The list is never empty: one clear item takes the place of the only item.
    if (items.length === 0) {
        removedItem.replacement = createItem();
        placeItem(removedItem.replacement, 0);
    }
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
    if (replacement) {
        currentQueryString(replacement);
        if (isClear(replacement)) {
            takeItem(replacement);
        }
    }
    const item = createItem(queryString);
    placeItem(item, position);
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

// The text of the button that the user sees becomes the result for a moment.
function showCopyResult(item, text) {
    const button = part(item, 'copy').offsetParent ? part(item, 'copy') : part(item, 'more');
    clearTimeout(item.copyTimer);
    part(item, 'copy').textContent = 'Copy query';
    part(item, 'more').textContent = 'More ▾';
    button.textContent = text;
    announce('Query ' + itemName(item) + ': ' + text.toLowerCase());
    item.copyTimer = setTimeout(() => {
        button.textContent = button.dataset.part === 'copy' ? 'Copy query' : 'More ▾';
    }, 2000);
}

async function copyQuery(item) {
    const queryBox = item.loaded && item.frame.contentDocument.getElementById('query-input1');
    try {
        await navigator.clipboard.writeText(queryBox ? queryBox.value
            : decompress(new URLSearchParams(item.queryString).get('query')));
        showCopyResult(item, 'Copied');
    } catch (error) {
        showCopyResult(item, 'Not copied');
    }
}

function moveItem(item, direction) {
    clearUndo();
    currentQueryString(item);
    const position = takeItem(item) + (direction === 'up' ? -1 : 1);
    // The iframe loads again in its new place.
    setFrameSource(item);
    placeItem(item, position);
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
        case 'add':
            addItem(items.indexOf(item) + 1, '', 'Added query');
            break;
        case 'duplicate':
            duplicateItem(item);
            break;
        case 'remove':
            removeItem(item);
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
document.getElementById('show-example').addEventListener('click', showExample);
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
            // payload: <id>%index%<EDITOR query string without ws>
            const [id, queryString] = event.data.payload.split('%index%');
            if (id === String(item.id)) {
                setQueryString(item, queryString);
                refreshItem(item);
                writeLink();
            }
            break;
        }
        case 'moveFocus': {
            // Alt+Up (-1) or Alt+Down (1) in an item
            const neighbour = items[items.indexOf(item) + event.data.payload];
            if (neighbour) {
                setCollapsed(neighbour, false);
                focusItem(neighbour);
            }
            break;
        }
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

queryStringsFromLink()
    .map((queryString) => ({queryString}))
    .filter((item) => !isClear(item))
    .forEach((item, position) => placeItem(createItem(item.queryString), position));
if (items.length === 0) {
    placeItem(createItem(), 0);
}
refreshList();
