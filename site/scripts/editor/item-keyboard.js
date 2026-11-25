// Keyboard navigation in an item (an EDITOR embedded in the WORKSPACE, ?ws=<id>).
// See product-development/keyboard-navigation.md. Does nothing in an EDITOR that is opened directly.
//
// The item has its own tree: the whole query (or the item itself, if its query is empty or has an error),
// its scopes, and the scopes inside them. A scope is
//  - a group: a bracket group, brackets included; or
//  - a run: neighbouring parts between groups at one level, without the surrounding group's brackets.
// The visualisation can't hold the tree: hovering walks through its siblings and parents. So the tree is
// a visually hidden copy that has the focus, and a marker is drawn over the visualisation.

// The current node: indexes of scopes from the top level. [] is the top node: the whole query, or the item.
let currentPath = [];

const treeElement = document.createElement('div');
const markerElement = document.createElement('div');

// --- Scopes, from the rendered visualisation

// [{type, nodes, children}] of the parts in this element
function scopesIn(element) {
    const scopes = [];
    let run = [];
    const endRun = () => {
        while (run.length && run[0].textContent.trim() === '') run.shift();
        while (run.length && run[run.length - 1].textContent.trim() === '') run.pop();
        if (run.length) {
            scopes.push({type: 'run', nodes: run, children: []});
        }
        run = [];
    };
    element.childNodes.forEach((node) => {
        const classes = node.classList;
        if (classes && classes.contains('brackets')) {
            endRun();
            scopes.push({type: 'group', nodes: [node], children: scopesIn(node)});
        } else if (!classes || !(classes.contains('bracket-open') || classes.contains('bracket-close'))) {
            run.push(node);
        }
    });
    endRun();
    return scopes;
}

// null for an empty query, or one with an error
function wholeQueryScope() {
    const searchString = document.getElementById('search-string');
    // Scope editing is off while brackets or quotes are unbalanced.
    if (!searchString || queryHasError() || queryBoxElement.value.trim() === '') {
        return null;
    }
    const scopes = scopesIn(searchString);
    // A single scope is the whole query itself.
    const children = scopes.length === 1 ? scopes[0].children : scopes;
    return {nodes: [...searchString.childNodes], children};
}

function topScopes() {
    const scope = wholeQueryScope();
    return scope ? scope.children : [];
}

function scopesAt(path) {
    return path.reduce((scopes, index) => scopes[index].children, topScopes());
}

// For the top node: null if it is the item itself
function scopeAt(path) {
    if (!path.length) {
        return wholeQueryScope();
    }
    return scopesAt(path.slice(0, -1))[path[path.length - 1]];
}

function scopeText(scope) {
    return scope.nodes.map((node) => node.textContent).join('').trim();
}

// The nearest remaining place: a neighbour, then the surrounding scope, then the item.
function validPath(path) {
    const result = [];
    for (const index of path) {
        const scopes = scopesAt(result);
        if (!scopes.length) {
            break;
        }
        result.push(Math.min(index, scopes.length - 1));
        if (index >= scopes.length) {
            break;
        }
    }
    return result;
}

// The path of the scope that holds this element of the visualisation
function pathOf(element, scopes = topScopes()) {
    const index = scopes.findIndex((scope) => scope.nodes.some((node) => node.contains(element)));
    return index === -1 ? [] : [index, ...pathOf(element, scopes[index].children)];
}

function topNodeLabel() {
    const scope = wholeQueryScope();
    return itemLabel() + (scope ? ': ' + scopeText(scope) : '');
}

// --- The hidden tree

function treeNode(path, label) {
    const node = document.createElement('div');
    node.setAttribute('role', 'treeitem');
    node.setAttribute('aria-level', path.length + 1);
    node.setAttribute('aria-label', label);
    node.dataset.path = path.join('.');
    node.tabIndex = -1;
    return node;
}

function appendScopes(parent, scopes, path) {
    if (!scopes.length) {
        return;
    }
    const group = document.createElement('div');
    group.setAttribute('role', 'group');
    scopes.forEach((scope, index) => {
        const node = treeNode([...path, index], scopeText(scope));
        appendScopes(node, scope.children, [...path, index]);
        group.append(node);
    });
    parent.append(group);
}

function nodeElement(path) {
    return treeElement.querySelector('[data-path="' + path.join('.') + '"]');
}

function treeHasFocus() {
    return treeElement.contains(document.activeElement);
}

function rebuildTree() {
    const hadFocus = treeHasFocus();
    currentPath = validPath(currentPath);
    const root = treeNode([], topNodeLabel());
    appendScopes(root, topScopes(), []);
    treeElement.replaceChildren(root);
    updateTreeLabel();
    if (hadFocus) {
        selectNode(currentPath, {scroll: false});
    } else {
        updateTabStop();
    }
}

function updateTreeLabel() {
    treeElement.setAttribute('aria-label', itemLabel());
    const root = nodeElement([]);
    if (root) {
        root.setAttribute('aria-label', topNodeLabel());
    }
}

function updateTabStop() {
    treeElement.querySelectorAll('[role=treeitem]').forEach((node) => {
        node.tabIndex = -1;
    });
    nodeElement(currentPath).tabIndex = 0;
}

function selectNode(path, {scroll = true} = {}) {
    currentPath = validPath(path);
    updateTabStop();
    nodeElement(currentPath).focus({preventScroll: true});
    const visible = currentPath.length ? scopeAt(currentPath).nodes.find((node) => node.scrollIntoView) : document.body;
    if (visible && scroll) {
        visible.scrollIntoView({block: 'nearest'});
    }
    drawMarker();
}

// With the keyboard: the WORKSPACE also centers the item. Not after a click: the page must not move then.
function selectTopNode() {
    selectNode([]);
    sendToWorkspace('centerItem', null);
}

function selectNodeOrTopNode(path) {
    if (path.length) {
        selectNode(path);
    } else {
        selectTopNode();
    }
}

// --- The marker of the current node

// One rectangle per line
function rectsOfScope(scope) {
    const lines = [];
    scope.nodes.forEach((node) => {
        const range = document.createRange();
        range.selectNode(node);
        const rects = node.getBoundingClientRect ? [node.getBoundingClientRect()] : [...range.getClientRects()];
        rects.filter((rect) => rect.width > 0).forEach((rect) => {
            const middle = (rect.top + rect.bottom) / 2;
            const line = lines[lines.length - 1];
            if (line && middle > line.top && middle < line.bottom) {
                line.left = Math.min(line.left, rect.left);
                line.right = Math.max(line.right, rect.right);
                line.top = Math.min(line.top, rect.top);
                line.bottom = Math.max(line.bottom, rect.bottom);
            } else {
                lines.push({left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom});
            }
        });
    });
    return lines;
}

// The marked node and since when: drawing it again must not start its pulse (iframe.css) again.
let markedNode = null;
let markedSince = 0;

function drawMarker() {
    markerElement.replaceChildren();
    const shown = treeHasFocus();
    const node = shown ? currentPath.join('.') : null;
    if (node !== markedNode) {
        markedNode = node;
        markedSince = performance.now();
    }
    const scope = shown ? scopeAt(currentPath) : null;
    document.documentElement.classList.toggle('item-is-current', shown && !scope);
    if (!scope) {
        return;
    }
    const gap = 3;
    rectsOfScope(scope).forEach((rect) => {
        const box = document.createElement('div');
        box.className = 'current-scope';
        box.style.animationDelay = markedSince - performance.now() + 'ms';
        box.style.left = rect.left + window.scrollX - gap + 'px';
        box.style.top = rect.top + window.scrollY - gap + 'px';
        box.style.width = rect.right - rect.left + 2 * gap + 'px';
        box.style.height = rect.bottom - rect.top + 2 * gap + 'px';
        markerElement.append(box);
    });
}

// --- Keys

// Edit these neighbouring parts of the visualisation; path is the node to go back to.
function startKeyboardScopeEdit(path, nodes) {
    editedPath = path;
    startScopeEdit($(nodes));
    // The spaces around a run belong to its neighbours.
    $('#dynamic-input').val($('#dynamic-input').val().trim());
}

function onTopNodeKey(key) {
    const scope = wholeQueryScope();
    if (key === 'Enter' && scope) {
        startKeyboardScopeEdit([], scope.nodes);
    } else if (key === 'Enter') {
        openQueryBox();
    } else if (key.toLowerCase() === 't') {
        sendToWorkspace('focusTitle', null);
    } else if (/^Arrow(Down|Right|Left)$/.test(key) && scope && scope.children.length) {
        // It has no neighbours: Right goes into it from the start, Left from the end.
        selectNode([key === 'ArrowLeft' ? scope.children.length - 1 : 0]);
    }
}

function onScopeKey(key) {
    const parent = currentPath.slice(0, -1);
    const index = currentPath[currentPath.length - 1];
    if (key === 'Enter') {
        startKeyboardScopeEdit(currentPath, scopeAt(currentPath).nodes);
    } else if (key === 'ArrowUp' || (key === 'ArrowLeft' && index === 0)
        || (key === 'ArrowRight' && index === scopesAt(parent).length - 1)) {
        // Left and Right go up where they can't go further.
        selectNodeOrTopNode(parent);
    } else if (key === 'ArrowDown' && scopesAt(currentPath).length) {
        selectNode([...currentPath, 0]);
    } else if (key === 'ArrowLeft') {
        selectNode([...parent, index - 1]);
    } else if (key === 'ArrowRight') {
        selectNode([...parent, index + 1]);
    }
}

function onTreeKey(event) {
    if (event.ctrlKey || event.metaKey) {
        return;
    }
    if (event.altKey) {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            sendToWorkspace('moveFocus', event.key === 'ArrowUp' ? -1 : 1);
        }
        return;
    }
    if (event.key === 'Escape') {
        event.preventDefault(); // Safari: stay in full screen, also on a second press
        return;
    }
    if (!/^(Arrow(Up|Down|Left|Right)|Enter|t)$/i.test(event.key)) {
        return;
    }
    event.preventDefault();
    if (currentPath.length) {
        onScopeKey(event.key);
    } else {
        onTopNodeKey(event.key);
    }
}

// --- Scope edits, started with the keyboard or the mouse

let editedPath = [];

function endScopeEdit() {
    // focusout may not fire when the dynamic input is removed.
    setEditMode(false);
    selectNodeOrTopNode(editedPath);
}

function onScopeEditKey(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        if (document.getElementById('dynamic-input')) {
            document.getElementById('dynamic-input').focus(); // invalid: keep editing
        } else {
            endScopeEdit();
        }
    } else if ((event.key === 'Escape' || event.key === 'Tab') && !event.isComposing) {
        // Escape: Safari stays in full screen. Tab: the focus stays on the node; the next Tab leaves the item.
        event.preventDefault();
        syntaxCheck('query-input1', 'medsyntax-target1', true);
        endScopeEdit();
    }
}

if (ws) {
    treeElement.id = 'item-tree';
    treeElement.setAttribute('role', 'tree');
    document.body.prepend(treeElement);
    markerElement.id = 'item-marker';
    document.body.append(markerElement);

    rebuildTree();
    $(document).ready(rebuildTree);
    document.addEventListener('medsyntax:rendered', () => {
        // Typing in the query box: back to the item.
        if (queryBoxFocused) {
            currentPath = [];
        }
        rebuildTree();
    });

    treeElement.addEventListener('keydown', onTreeKey);
    treeElement.addEventListener('focusin', drawMarker);
    treeElement.addEventListener('focusout', () => setTimeout(drawMarker));
    new ResizeObserver(drawMarker).observe(document.getElementById('medsyntax'));

    // Enter that ends the composing of text (IME) does not confirm.
    document.addEventListener('keydown', (event) => {
        if (event.target.id === 'dynamic-input' && event.key === 'Enter' && event.isComposing) {
            event.stopPropagation();
        }
    }, true);
    document.addEventListener('keydown', (event) => {
        if (event.target.id === 'dynamic-input') {
            onScopeEditKey(event);
        } else if (event.key === 'Escape' && !event.isComposing && event.target.id === 'query-input1') {
            event.preventDefault(); // Safari: stay in full screen
            // First: leaving the query box renders the query again, which rebuilds the tree.
            event.target.blur();
            selectTopNode();
        }
    });

    // A digit selects the item with that number. The WORKSPACE knows the numbers.
    document.addEventListener('keydown', (event) => {
        if (!/^[0-9]$/.test(event.key) || event.ctrlKey || event.altKey || event.metaKey || event.repeat
            || event.isComposing || event.target.matches('textarea, input:not([type=radio], [type=checkbox])')) {
            return;
        }
        const inTree = treeHasFocus();
        if (inTree) {
            event.preventDefault();
        }
        sendToWorkspace('selectNumber', {digit: event.key, inTree});
    });

    // Clicking an item or scope makes it the current node. On a scope this starts its edit, as before.
    document.getElementById('medsyntax-target1').addEventListener('mousedown', (event) => {
        if (event.target.id !== 'dynamic-input') {
            editedPath = pathOf(event.target);
            currentPath = editedPath;
            updateTabStop();
        }
    }, true);
    document.addEventListener('click', (event) => {
        // The border and empty parts of the visualisation too
        if (event.target === document.body || event.target === document.documentElement
            || ['medsyntax', 'medsyntax-target1', 'search-string'].includes(event.target.id)) {
            selectNode([]);
        }
    });
}
