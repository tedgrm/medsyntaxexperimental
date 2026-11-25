// An EDITOR embedded in the WORKSPACE (?ws=<id>), called an item: what it shows, and its messages.
// Does nothing in an EDITOR that is opened directly.

// Send a message to the WORKSPACE (not to ourselves, when the item is opened outside of it).
function sendToWorkspace(type, payload) {
    if (ws && window.parent !== window) {
        window.parent.postMessage({status: 'success', type, payload}, window.location.origin);
    }
}

// The query box shows only while it has the focus, and when there is nothing to visualise.
const queryBoxElement = document.getElementById('query-input1');
let queryBoxFocused = false;
let queryBoxOpen = false;

// Unbalanced brackets or quotes
function queryHasError() {
    return [warningBracketOpenElementId, warningBracketCloseElementId, warningSquareBracketOpenElementId,
        warningSquareBracketCloseElementId, warningQuotesElementId]
        .some((id) => !document.getElementById(id).hidden);
}

function updateQueryView() {
    const isEmpty = queryBoxElement.value.trim() === '';
    const showBox = queryBoxOpen || isEmpty || queryHasError();
    queryBoxElement.hidden = !showBox;
    document.getElementById('medsyntax-target1').hidden = isEmpty;
}

function openQueryBox() {
    queryBoxOpen = true;
    updateQueryView();
    queryBoxElement.focus();
}

// The item's title, or its number if it has none
let itemNumber = 1;

function itemLabel() {
    return document.getElementById('query-title1').value.trim() || 'Query ' + itemNumber;
}

if (ws) {
    document.addEventListener('medsyntax:rendered', updateQueryView);
    $(document).ready(updateQueryView);

    queryBoxElement.addEventListener('focusin', () => {
        queryBoxFocused = true;
        queryBoxOpen = true;
        updateQueryView();
    });
    queryBoxElement.addEventListener('focusout', () => {
        queryBoxFocused = false;
        // Hiding the box moves what is below it, in the whole WORKSPACE. So the WORKSPACE says when.
        sendToWorkspace('queryBoxLeft', null);
    });

    new ResizeObserver(() => sendToWorkspace('itemResized', null)).observe(document.body, {box: 'border-box'});

    document.addEventListener('pointerdown', () => sendToWorkspace('pointerState', true), true);
    document.addEventListener('pointerup', () => sendToWorkspace('pointerState', false), true);
    document.addEventListener('pointercancel', () => sendToWorkspace('pointerState', false), true);

    window.addEventListener('message', (event) => {
        // Only the WORKSPACE, from our own origin.
        if (event.origin !== window.location.origin || event.source !== window.parent || !event.data) {
            return;
        }
        if (event.data.type === 'itemState') {
            itemNumber = event.data.payload.number;
            document.documentElement.style.setProperty('--item-color', event.data.payload.color);
            updateTreeLabel();
        }
        if (event.data.type === 'focusItem') {
            selectNode([]);
        }
        if (event.data.type === 'setTitle') {
            // The title field is in the card header; the one here is hidden.
            document.getElementById('query-title1').value = event.data.payload;
            updateTitle('query-title1');
            updateTreeLabel();
        }
        if (event.data.type === 'editQuery') {
            openQueryBox();
        }
        if (event.data.type === 'clearQuery') {
            clearButtonFunc();
            // It may have removed an open scope edit, whose focusout may not fire.
            setEditMode(false);
        }
        if (event.data.type === 'hideQueryBox' && !queryBoxFocused) {
            queryBoxOpen = false;
            updateQueryView();
        }
    });
}
