// References to other items (#3) in an item: an EDITOR embedded in the WORKSPACE (?ws=<id>). What is a reference:
// ../references.js. Does nothing in an EDITOR that is opened directly.

// From the WORKSPACE: a warning, and {key: {color, ink, title, problem}} for the references in this item's query
let knownReferences = {};
let knownWarning = '';

// The chips are drawn over the visualisation, because nested brackets change the colours inside them (a filter).
const chipsElement = document.createElement('div');
const referencesWarning = document.createElement('p');

function visualisationElement() {
    return document.getElementById('search-string');
}

// [{key, node, start, end}] of the references in the visualisation, by text node. The text as a whole decides what
// a reference is: #1 is none in #1[tiab], which are two elements.
function visibleReferences() {
    const root = visualisationElement();
    if (!root) {
        return [];
    }
    const texts = [];
    let length = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
        texts.push({node: walker.currentNode, from: length, to: length + walker.currentNode.length});
        length += walker.currentNode.length;
    }
    return findReferences(texts.map(({node}) => node.data).join('')).flatMap(({key, start, end}) => {
        const text = texts.find(({from, to}) => start >= from && end <= to);
        return text ? [{key, node: text.node, start: start - text.from, end: end - text.from}] : [];
    });
}

// Spans: hovering and the keyboard tree walk through the divs and child nodes of the visualisation.
function drawReferences() {
    document.querySelectorAll('#medsyntax-target1 .item-ref').forEach((chip) => {
        const parent = chip.parentNode;
        chip.replaceWith(...chip.childNodes);
        parent.normalize();
    });
    const references = visibleReferences();
    // From the end, so that the places before it in the same text stay right.
    [...references].reverse().forEach(({key, node, start, end}) => {
        const known = knownReferences[key];
        if (!known || !node.parentElement.classList.contains('term')) {
            return;
        }
        const chip = document.createElement('span');
        chip.className = known.problem ? 'item-ref has-problem' : 'item-ref';
        chip.dataset.key = key;
        chip.title = known.problem ? '#' + key + ': ' + known.problem : known.title;
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, end);
        range.surroundContents(chip);
    });

    const problems = Object.entries(knownReferences).filter(([, known]) => known.problem);
    const inQuery = new Set(findReferences(queryBoxElement.value).map(({key}) => key));
    referencesWarning.textContent = problems.filter(([key]) => inQuery.has(key))
        .map(([key, known]) => '#' + key + ': ' + known.problem + '.').concat(knownWarning || []).join(' ');
    referencesWarning.hidden = referencesWarning.textContent === '';
    drawChips();
    drawMarker();
}

function drawChips() {
    chipsElement.replaceChildren(...[...document.querySelectorAll('#medsyntax-target1 .item-ref')].map((chip) => {
        const known = knownReferences[chip.dataset.key];
        const rect = chip.getBoundingClientRect();
        const drawn = document.createElement('div');
        drawn.className = 'drawn-ref';
        drawn.textContent = chip.textContent;
        if (!known || known.problem) {
            drawn.classList.add('has-problem');
        } else {
            drawn.style.background = known.color;
            drawn.style.color = known.ink;
        }
        drawn.style.left = rect.left + window.scrollX + 'px';
        drawn.style.top = rect.top + window.scrollY + 'px';
        drawn.style.width = rect.width + 'px';
        drawn.style.height = rect.height + 'px';
        drawn.style.lineHeight = rect.height + 'px';
        return drawn;
    }));
}

// The WORKSPACE calls this, at once, when item numbers change: its link and the item then never differ.
function renumberItemReferences(mapping) {
    const box = queryBoxElement;
    const renumbered = renumberText(box.value, mapping, [box.selectionStart, box.selectionEnd]);
    const input = document.getElementById('dynamic-input');
    if (input) {
        renumberScopeEdit(input, mapping);
    }
    if (renumbered.text === box.value) {
        return;
    }
    const hadFocus = document.activeElement === box;
    if (input) {
        box.value = renumbered.text;
        stringLatestString = box.value; // already shown: rendering it would close the edit
        updateUrl('query', LZString.compressToEncodedURIComponent(box.value));
        return;
    }
    box.value = renumbered.text;
    syntaxCheck('query-input1', 'medsyntax-target1');
    if (hadFocus) {
        box.setSelectionRange(...renumbered.positions);
    }
}

// The text in the edit, and around it
function renumberScopeEdit(input, mapping) {
    [...visibleReferences()].reverse().forEach(({key, node, start, end}) => {
        const newKey = renumberedKey(key, mapping);
        node.replaceData(start, end - start, '#' + newKey);
        if (node.parentElement.classList.contains('item-ref')) {
            node.parentElement.dataset.key = newKey;
        }
    });
    const renumbered = renumberText(input.value, mapping, [input.selectionStart, input.selectionEnd]);
    if (renumbered.text !== input.value) {
        input.value = renumbered.text;
        if (document.activeElement === input) {
            input.setSelectionRange(...renumbered.positions);
        }
    }
}

if (ws) {
    referencesWarning.id = 'warning-references';
    referencesWarning.className = 'warning-medsyntax';
    referencesWarning.hidden = true;
    document.getElementById(warningBracketOpenElementId).before(referencesWarning);

    // The query of the link is in the query box now (editor.js): renumberItemReferences works.
    $(document).ready(() => {
        // Not if one of the scripts did not load; then the WORKSPACE loads the item again.
        window.itemIsReady = typeof syntaxCheck === 'function' && typeof openQueryBox === 'function'
            && typeof drawMarker === 'function';
    });
    chipsElement.id = 'item-refs';
    chipsElement.setAttribute('aria-hidden', 'true'); // the visualisation has the text
    markerElement.before(chipsElement);
    document.addEventListener('medsyntax:rendered', drawReferences);
    const visualisation = document.getElementById('medsyntax-target1');
    new ResizeObserver(drawChips).observe(visualisation);
    // A scope edit that starts or grows
    new MutationObserver(drawChips).observe(visualisation,
        {childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'rows', 'cols']});
    window.addEventListener('message', (event) => {
        // Only the WORKSPACE, from our own origin.
        if (event.origin === window.location.origin && event.source === window.parent && event.data
            && event.data.type === 'references') {
            knownReferences = event.data.payload.references;
            knownWarning = event.data.payload.warning;
            drawReferences();
        }
    });
}
