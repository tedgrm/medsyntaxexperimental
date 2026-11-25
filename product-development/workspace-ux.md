# WORKSPACE UX: requirements

Status: **built** (2026-11-25). Not tested with a real screen reader. See [Decisions](#decisions) and [As built](#as-built). Prototype: [prototypes/workspace-ux.html](prototypes/workspace-ux.html).

## Goal and users

Make the WORKSPACE easy to recognise, scan and rearrange.

- **Expert searchers** who keep several versions or parts of a search side by side.
- **Occasional users**, who need to see what the page is for and must not lose work by a wrong click.

## Before

- The page has no header, heading or help: an Add button, then the list.
- Each item has a 10px border in a random colour, different after every reload.
- Remove is immediate and has no undo. Items can't be moved, duplicated or collapsed.
- Add and Remove rebuild every item. Unfinished edits and the focus are lost.
- Scopes can be picked only with the mouse. `key-commands.js` only logs key presses.
- Buttons are called "Add" and "Remove" in every item, and the iframes have no label in the markup.
- There is no viewport tag, so phones show a zoomed-out page.

## Decisions

- The WORKSPACE and the items in it get the new style. An EDITOR opened directly (without `ws`) stays exactly as it was. Items also hide their query box when it is not being edited (ITEM-11).
- The colours that carry meaning in the visualisation (operators, brackets, quotes, warnings, the scope highlight) stay, as in the fork.
- The style is inspired by the Medsyntax Framework page in [mrgtverleg-lgtm/MedsyntaxQA](https://github.com/mrgtverleg-lgtm/MedsyntaxQA/tree/Medsyntax-Framework/framework) (commit `12f5d75`, GPL-3.0).
- The WORKSPACE and its items have a dark mode with the fork's dark colours, and a greyscale mode: the light colours, all in grey. A switch in the header chooses System (the default, follows the system setting), Light, Dark or Greyscale. The choice is kept in the browser, not in the link. The visualisation stays white, like paper, as in the fork, because its colours carry meaning.
- Border colours of cards and buttons are the fork's.
- Item colours: 1–4 are the borders of the four textareas of [Medsyntax PICO](https://tedgrm.github.io/picomedsyntax/) (`#query-input1` to `#query-input4`), 5 is a blue, and 6–10 are chosen to differ from those and each other. The marker of the current item has dashes in the item's colour on white (the brightest colours darkened), so that it differs from the solid lines around it. Dark mode lightens them where they are used as lines.
- Each item has a number and a colour from a fixed palette. Both follow its position: nothing is stored in the link for them. They change when the item moves, or when an item above it is added or deleted, also by a reload.
- Removing the last item leaves one clear item, so the list is never empty. Its link opens with one clear item too. A new WORKSPACE (`/workspace/`) also starts with one, instead of three.
- Clear items are deleted on reload, anywhere in the list. If all items are clear, one is left. This replaces the earlier choice to keep empty items on reload (see `FEATURES.md`).
- After a reload every item is expanded. The collapsed state is not in the link.
- Alt+Up / Alt+Down expands a collapsed item, instead of skipping it.
- Besides style, the first version is about managing items and keyboard navigation. [keyboard-navigation.md](keyboard-navigation.md) is part of these requirements. Its rules stay in that file; this one adds only what the card, its buttons and the new actions change.

**Not in the first version:** web fonts (IBM Plex would be a new external dependency), drag and drop, combining items into one query, choosing a colour, a WORKSPACE title, copying all queries, and frameworks such as PICO.

## Terms

- **Item:** one EDITOR embedded in the WORKSPACE.
- **Card:** the frame around an item, drawn by the WORKSPACE: header and item. Its Add button is below it.
- **Clear item:** an item without a title and without a query. Only spaces or line breaks count as nothing.

## Style tokens

| Use | Value | Contrast |
|---|---|---|
| Page background | `#e6eaea` | |
| Card | `#ffffff` | |
| Text / secondary text | `#1c2525` / `#586867` | secondary: 4.82:1 on the page, 5.85:1 on a card |
| Card and plain button border | `#c6d0cf` | 1.58:1 on a card; see A11Y-1 |
| Accent, with white text | `#127c79` | 5.02:1 |
| Text field border | `#748382` (not in the fork) | 3.95:1 on white; a field needs 3:1, as nothing else marks it |
| Link text on the page | `#0e6663` (not in the fork: the accent has only 4.14:1 there) | at least 4.5:1 |
| Danger button: text, background, border | `#8b1d1d`, `#fbe4e4`, `#e3a5a5` | text: 7.56:1 |
| Items with white badge text: 1, 4, 5, 8, 9, 10 | `#E12A39` `#7527A1` `#1F6FD1` `#7A4A2B` `#5B6B7B` `#14613B` | text: at least 4.57:1 |
| Items with dark badge text (`#1c2525`): 2, 3, 6, 7 | `#FFB407` `#89CA26` `#17B8C9` `#F2760C` | text: at least 5.50:1. As a line on white only 1.78:1 to 2.85:1, see STYLE-8 |

Dark mode:

| Use | Value | Contrast |
|---|---|---|
| Page background / card | `#131919` / `#222c2b` | |
| Text / secondary text and placeholders | `#e2eae9` / `#9bafad` | on a card 11.74:1 / 6.24:1 |
| Card and plain button border | `#34413f` | 1.35:1; see A11Y-1 |
| Text field border | `#82928f` (not in the fork) | 4.41:1 |
| Accent (also links), with `#052120` text | `#3db6b1` | text 6.85:1, as link 7.22:1 |
| Danger: text, background, border | `#f4b4b4`, `#3b1d1d`, `#703636` | text 8.72:1 |
| Item badge | the same colours and text as in light mode | text: at least 4.57:1 |
| Item edge, query box and visualisation border | the item colour, 55% mixed with white | at least 5.00:1 on a card |
| Marker of the current item or scope (every mode) | dashes in the item's colour on a white (`#fff`) line, 3px, with a glow. Around an item the dashes are slightly longer (9px, gaps 4px) | dashes: at least 3:1 on the white; the brightest colours are darkened for that |

## Requirements

### Visual style

| ID | Requirement | Priority |
|---|---|---|
| STYLE-1 | A header shows the brand mark (text only, so it does not look like a button), the name MedsyntaxQA as the page heading, the line "Workspace for multiline searches", and links to the EDITOR and to "Report an issue" (the same issues page as the EDITOR's menu). | Must |
| STYLE-2 | Each item is a white card with a 1px line, a 10px radius and a 3px left edge in the item's colour. It replaces the random border. | Must |
| STYLE-3 | The card's header shows a badge with the item's number in its colour (white text, or dark where white has less than 4.5:1), the title field, and the item's buttons: Collapse, up, down, Duplicate, Edit query, Copy query, Clear query, Remove. Below a viewport of 1000px, Duplicate to Clear query are in a More menu. On a phone the buttons are below the title. After item 10 the colours repeat. | Must |
| STYLE-4 | The content is centred and at most 1240px wide. | Must |
| STYLE-5 | Add is a primary (accent) button, Remove a danger button, the others are plain. | Must |
| STYLE-6 | Colours are CSS variables in `site/workspace/style.css`. Fonts come from the system. | Must |
| STYLE-7 | The title field has a 1px border and a 7px radius. While an item is collapsed and has no title, the field's placeholder is the start of the query, or "Empty query". The item has no title field of its own. | Should |
| STYLE-8 | Items have no grey background. The query box is white, monospace, with a 3px border in the item's colour and a 1px line in the text field border colour around it, because some item colours have less than 3:1 on white. | Must |
| STYLE-9 | The visualisation is on white, in a frame with a 3px border in the item's colour and an 8px radius. Its syntax colours stay as now. | Must |
| STYLE-10 | Warnings in items are dark red on light red with a dark red left edge. | Must |
| STYLE-11 | With Dark, or with System and a dark system setting, the WORKSPACE and its items use the dark colours. They change at once when the choice or the setting changes, without reloading items. The visualisation, and a scope edit in it, stay light. | Must |
| STYLE-12 | Dark mode and the switch don't reach an EDITOR opened directly. | Must |
| STYLE-13 | With Greyscale, the WORKSPACE and its items, including the visualisation, have the light look in grey. | Must |
| STYLE-14 | The choice is remembered in the browser. If it can't be stored, it lasts until the page closes. | Must |

### Managing items

| ID | Requirement | Priority |
|---|---|---|
| ITEM-1 | The user can add an empty item at the top and after any item. It scrolls into view, with its title focused. | Must |
| ITEM-2 | Remove works at once and shows a message with Undo. Undo restores the title, query and position. | Must |
| ITEM-3 | Undo covers the last removal, and stays available until the next add, remove, move or duplicate. | Must |
| ITEM-4 | Each item can move up and down one place. Up is disabled on the first item, Down on the last. | Must |
| ITEM-5 | Removing the only item puts one clear item in its place, also after a reload or when the link is opened. Remove is disabled when the only item is already clear. Undo puts the removed item back instead of the clear one, or before it if the user has typed in it. | Must |
| ITEM-6 | No action changes or loses the title or query of another item. | Must |
| ITEM-7 | Duplicate adds a copy of the title and query right after the item. | Should |
| ITEM-8 | An item can be collapsed to its card header, and expanded again. After a reload all items are expanded. | Should |
| ITEM-9 | Actions on one item leave unfinished edits in the others alone. | Should |
| ITEM-10 | A reload, or opening a link, deletes every clear item and closes the gaps: the others keep their order, title and query, and the link is updated to match. If all items are clear, one is left. An item with only a title, or only a query, stays. | Must |
| ITEM-11 | An item's query box shows only while it has the focus, and when there is nothing to visualise: an empty query, or unbalanced brackets or quotes. Otherwise only the visualisation shows. "Edit query" in the card's header shows the box with the focus in it, and expands a collapsed item. While the user types, the visualisation shows below the box and updates live, as now. Warnings always show. | Must |
| ITEM-12 | Leaving the box never makes the user's click miss its target, although hiding the box moves what is below. | Must |
| ITEM-13 | A Clear query button, directly before Remove in the card's header, clears the query and keeps the title. It also works on a collapsed item, and drops an unfinished scope edit in that item. It has no Undo, and leaves the Undo of a removal available. The item itself has no clear button. | Must |
| ITEM-14 | The title can be edited in the card's header, also while the item is collapsed or still loading. A title is never lost by an action right after typing. | Must |
| ITEM-15 | "Show a multiline search example", next to "Show example", puts nine items, the last one with nested references, in place of the clear ones, under the same conditions. "Show example", next to "Add query at the top", puts four items with the labels, queries and order of the Medsyntax PICO demo in place of the clear ones (C has no query; O is nested, with brackets in brackets in brackets). It shows only while every item is clear, so it never replaces work. Like add, it ends a pending Undo. Items have no demo button. | Should |
| ITEM-16 | The button that adds a query after an item is below its card, also while the item is collapsed. | Must |
| ITEM-17 | "Copy query" in the card's header copies the query, also while the item is collapsed or loading. The button (More, if it is in the menu) says "Copied" or "Not copied" for two seconds. It is disabled without a query. Items have no Edit or Copy buttons of their own. | Must |
| ITEM-18 | The More menu closes on More, Escape (the focus goes to More), a choice, a click elsewhere or in an item, when the focus leaves it, and when another one opens. | Must |

### References between items

| ID | Requirement | Priority |
|---|---|---|
| REF-1 | `#` and a number, outside quotes and as a word of its own (next to a space, a bracket, or the start or end), refers to the item with that number. So not in `"#1"`, `a#1`, `#1[tiab]` or `#1-#3`. Only in the WORKSPACE. | Must |
| REF-2 | A reference is a chip in the visualisation, in the colour of its item, with that item's title and full query (at most 500 characters) as tooltip. Scopes, scope edits and keys work as without chips. | Must |
| REF-3 | "Copy query" copies the text as typed. "Copy full query", only on items with references, copies the query with each reference replaced by that item's full query in brackets (not doubled). With it, all buttons are next to the title from 1150px. | Must |
| REF-4 | After move, add, duplicate, remove and Undo, references follow their item: in the queries, the link, a query box that is being typed in (the cursor stays) and an open scope edit (it stays open). | Must |
| REF-5 | A reference to a removed item becomes `#3?`. Undo makes it `#3` again. At the next removal, older ones become `#?`. | Must |
| REF-6 | When clear items are dropped on reload (ITEM-10), references follow; those to a dropped item become missing. | Must |
| REF-7 | A problem shows as a red dashed chip and a warning, and disables Copy full query: no such item, a removed one, no query, unbalanced brackets or quotes, a circle, or over 1 million characters. It counts for the items that refer to that item too. It doesn't turn scope editing off. | Must |
| REF-8 | The link format doesn't change. | Must |

### Keyboard navigation

All requirements and decisions in [keyboard-navigation.md](keyboard-navigation.md) apply (its IDs are NAV, EDIT, A11Y and COMP too, so name the file when referring to them). In short, see its Keys table for the rest:

| Key | Does |
|---|---|
| Alt+Up / Alt+Down | previous / next item, from an item or a scope |
| Left / Right | previous / next scope at this level, or the surrounding scope if there is none; on a whole query: its last / first scope |
| Down / Up | into the query or scope / out of it, up to the whole query |
| Enter | edit the whole query or scope, then confirm; on an item without a valid query: go to the query box |
| T | on a whole query, or an item without a valid one: go to the title |
| 0–9 | the item with that number, from anywhere except a text field |
| Escape | cancel a scope edit (Tab too); from the title or query box: back to the whole query or item |

| ID | Requirement | Priority |
|---|---|---|
| KEY-1 | The Tab order follows the page: for each card its title, its buttons, the item, then Add. The card's buttons work with Enter and Space. | Must |
| KEY-2 | The navigation keys above, except the digits, do nothing on the card's buttons and Undo, which are outside the items' trees, also in the More menu, where only Escape, or a digit that selects an item, closes it. There are no shortcuts for the card's actions in the first version. | Must |
| KEY-3 | After add and duplicate, Escape in the new title goes to that item. Escape in the title of a collapsed item expands it. | Must |
| KEY-4 | Alt+Up / Alt+Down follow the order on the page, also after add, remove, undo and move. | Must |
| KEY-5 | After remove, the focus goes where A11Y-4 says (a button or the clear item's title), so no item is in navigation mode. Tab from there reaches the tree of the item now in that place, with a valid current node. | Must |
| KEY-6 | Moving an item, or undoing its removal, may reset its current node to the item itself. Other items keep theirs (as ITEM-9). | Should |
| KEY-7 | Alt+Up / Alt+Down to a collapsed item expands it and selects the item itself. It stays expanded when the user moves on. Tab doesn't expand: it reaches the Expand button. | Must |
| KEY-8 | The item's tree is labelled with its title, or its number on the badge if it has none, and the label follows changes of either. | Must |
| KEY-9 | After a reload, the current node of every item's tree is the item itself. | Should |
| KEY-10 | Enter on an item whose query is empty or has an error goes to its query box; otherwise it edits the whole query as a scope, and the box stays hidden. Escape in the box returns to the item and hides the box (unless ITEM-11 keeps it). Edit query can be reached with Tab, if needed through More. | Must |

### Accessibility

| ID | Requirement | Priority |
|---|---|---|
| A11Y-1 | Text has at least 4.5:1 contrast; the focus outline at least 3:1 (WCAG 2.2 AA). Button borders may be lighter, because the button's text or arrow identifies it. This holds in light, dark and greyscale mode. | Must |
| A11Y-2 | An item is never recognised by colour alone: its number is always visible. | Must |
| A11Y-3 | Buttons and iframes have a name with the item's number ("Remove query 2"). Edit, Copy and Clear query are named after the title instead, or the number without one ("Clear query Population", "Clear query 2"), and follow changes of either. The More button is "More actions for query 2". A button's name starts with its visible text. | Must |
| A11Y-4 | Keyboard focus is visible and never lost after an action: add and duplicate → the new title; show example → nothing (NAV-10 in [keyboard-navigation.md](keyboard-navigation.md)); move → the same button, or the opposite one at an edge; remove → the Collapse button of the item now in that place (the last item if there is none), or the title of the clear item; undo → the restored item; clear and copy query → the same button, or More; edit query → the query box. | Must |
| A11Y-5 | After Remove, the focus is not on another Remove button, so a second Enter can't remove more. | Must |
| A11Y-6 | Screen readers hear the result of add, remove, undo, move, duplicate, copy query, clear query and show example. | Must |
| A11Y-7 | Nothing scrolls the page sideways at 375px. Long queries scroll or wrap inside their item. | Must |

### Compatibility

| ID | Requirement | Priority |
|---|---|---|
| COMP-1 | Existing links load (without their clear items, ITEM-10), and `/workspace/` without items starts with one. The existing messages between the pages don't change; keyboard navigation adds new ones. The link format doesn't either. | Must |
| COMP-2 | An EDITOR opened directly doesn't change, in look or behaviour. Its layout screenshots stay the same. Items change in look (STYLE-8 to STYLE-11) and as in ITEM-11. | Must |
| COMP-3 | The item's colour edge and badge look different from the current-node marker in [keyboard-navigation.md](keyboard-navigation.md), and adding or removing still leaves a valid current node there. | Must |
| COMP-4 | Works in Chromium, Firefox and WebKit. | Must |

## Scenarios

To become Playwright tests. Unless stated otherwise: three items with the titles A, B and C.

1. **Add:** add after A. The order is A, empty, B, C, and the title of item 2 has the focus.
2. **Remove and undo:** remove B, then Undo. The order is A, B, C again, with B's query, also in the link.
3. **Undo expires:** remove B, add after A. Undo is gone.
4. **Move:** move A down. The order is B, A, C; A has number 2 and the second colour. The link has the new order.
5. **Edges:** Up is disabled on item 1, Down on item 3.
6. **Duplicate:** duplicate A, change the copy. The original is unchanged.
7. **Collapse:** collapse A. Its header stays visible, and its query stays in the link. After a reload A is expanded.
8. **Remove all:** remove all items. One clear item is left, its Remove is disabled, and after a reload there is still one. Opening `/workspace/` gives one too.
9. **Undo the last removal:** remove all items, then Undo. Only the last removed item is there. If the user typed in the clear item first, both are there.
10. **Reload:** without clear items, numbers, colours, titles and queries are the same after a reload.
11. **Reload deletes clear items:** add after A, give C no query but keep its title, and reload. The order is A, B, C, numbered 1–3, and the link has three items.
12. **Reload with only clear items:** open `/workspace/`, add two items and reload. One clear item is left.
13. **Unfinished edit:** start a scope edit in C and move A down. The edit in C is still open.
14. **Keys after move:** move A down and press Alt+Down on B (item 1). A (item 2) is selected.
15. **Keys and collapse:** collapse B and press Alt+Down on A. B expands and is selected. Alt+Down again selects C, and B stays expanded.
16. **Keys after add:** add after A, then Escape. Item 2 is selected; Alt+Down selects B.
17. **Keys on buttons:** with the focus on a card's Duplicate button, the arrow keys, Alt+Down, T and Escape do nothing. A digit selects the item with that number.
18. **Query box:** type `(heart OR lung)` in an empty item: the visualisation follows while typing. Click its Duplicate button. The item is duplicated, and its box is hidden but its visualisation shows. Edit query shows the box, focused, above the visualisation. Remove the last bracket and press Tab: the box stays, with a warning.
19. **EDITOR opened directly:** it looks and works as before (the existing EDITOR tests pass, with the same screenshot baselines).
20. **Dark mode:** with a dark system setting, the WORKSPACE and its items are dark and the visualisation is white. An EDITOR opened directly looks the same as with a light setting.
21. **Narrow screen:** at 375px wide the page doesn't scroll sideways.
22. **Clear query:** clear B's query. Its title and the other items stay, also after a reload, and the focus stays on the button.
23. **Title:** rename B in its card header. The link, the Clear query button's name and the tree label follow, also after a reload.
24. **Title while collapsed:** collapse B and empty its title. The field shows the query as placeholder.
25. **Example:** open `/workspace/` and click Show example. The four PICO items are there, with Medsyntax PICO's colours, also after a reload, and the button is gone.
26. **Button row:** at 1000px all eight buttons are next to the title; at 999px there are five, with More.
27. **Copy query:** it copies the query and says so; if the browser refuses, it says that.
28. **More menu:** every action works from it and closes it.
29. **Closing the menu:** each way of ITEM-18.
30. **Colour switch:** choose Dark, Greyscale and Light: the page and all items change at once, and the link stays the same. After a reload the last choice is still there.
31. **References:** with A `aa`, B `bb`, C `#1 OR #2` and D `#3 AND #1`: Copy full query of D gives `((aa) OR (bb)) AND (aa)`. Move B up: C is `#2 OR #1`, D is `#3 AND #2`, and the full queries are the same. Remove B: C is `#1 OR #2?`, with a warning in C and D; Undo restores both. All scenarios are in `playwright/workspace-references.spec.ts`.

## As built

- The keyboard tree is a visually hidden copy of the query's scopes, and the marker is drawn over the visualisation. Hovering walks through the siblings and parents in the visualisation, so scopes can't be wrapped in elements there.
- The WORKSPACE and its items only replace the link, so nothing is added to the browser history. The Back button leaves the WORKSPACE.
- The iframes have an `aria-label` ("Editor of query 2"), because iframe-resizer sets their `title`.
- The iframes allow alerts now (`allow-modals`), which the existing sandbox blocked.
- Clear query asks the item to clear itself (message `clearQuery`). The prototype doesn't have this button in the header.
- The title field is in the WORKSPACE, which decides about titles: it puts its value in the item's query string, and sends it to the item (message `setTitle`) for the tree label. T sends `focusTitle`.
- The prototype still has the summary, the title, Edit, Copy and demo buttons in the item, and Add in the card. It has no More menu.
- The numbers change before the list does, at once in each item (`renumberItemReferences`, a direct call). What an item holds is always the newest; its `updateUrl` message is only a sign. An item that hasn't read its query yet (`itemIsReady`) loads again with the new numbers.
- An item that loads without its scripts (WebKit, during quick changes) loads again, at most three times.
- A moved item loses its own unfinished scope edit, because its iframe loads again.

## Technical notes

Written before building; "now" is the old page.

- Items are the EDITOR with `ws`, so their new look must be scoped to `body.ws-iframe-body` in `site/iframe.css`, which loads only then. Leave `site/style.css` alone. The EDITOR adds that class and stylesheet only when the page is ready, so check for a flash of the old look.
- The WORKSPACE can set an item's colour as a CSS variable in its iframe after it loads (same origin), without a new message. It must do so again when the item moves or reloads.
- Brackets are `darkorange` with `hue-rotate(110deg)`, which also turns the colour of everything inside them, including highlights. Keep that or recolour on purpose; don't lose it by accident.
- `textAreaAdjust` sets the query box's width in script (window width minus 200px). New paddings and borders must agree with it.
- The baselines in `playwright/editor-layout.spec.ts-snapshots/` must not change: they guard COMP-2. Items need layout tests of their own.
- If a page and its iframe have a different `color-scheme`, browsers paint the iframe with an opaque background. Set it on both the WORKSPACE and `body.ws-iframe-body`'s document, or on neither.
- KEY-4: an item in its iframe can't know its neighbours, so Alt+Up / Alt+Down goes through a new message to the WORKSPACE, which focuses the right iframe. KEY-8 needs a message the other way. These are new message types; the existing ones stay as they are (COMP-1).
- A collapsed item's tree is in a hidden iframe and can't have the focus, so KEY-7 must show the iframe first and then focus it.
- `queryFunction` (`site/workspace/index.html`) sets the random colour and the border inline. `addItemAfter` and `removeThisItem` rebuild every iframe.
- The position is part of each item's `?ws=<n>`, element ids and button handlers. ITEM-9 needs an id that stays the same when the position changes, with the WORKSPACE mapping it to the position in the link. The item reads `ws` only to send it back, so the message format can stay.
- Moving an iframe in the DOM reloads it. For ITEM-9, change the order with CSS `order` (but then the Tab and screen-reader order is wrong), or move only the item that was asked for, which reloads just that one.
- The summary can come from the `updateUrl` messages, which hold the title and query.
- A new item can only focus its title after its iframe has loaded.
- ITEM-11 needs EDITOR code that only runs with `ws`. `syntaxCheck` also runs on the query box's `focusout` and can stay there; the confirmed scope edit writes to the hidden box. Hide the box in a way that doesn't break `textAreaAdjust`, which measures it.
- ITEM-12: the prototype waits for the pointer to be released. In the site a click can land in another document, so hiding the box there can't rely on the item's own pointer events.
- A collapsed iframe has no size while hidden, so iframe-resizer must measure it again when it expands.
- `updateUrl` adds history entries for every item it writes: one Add in a fresh WORKSPACE added 8 (3 → 4 items, Chromium).
- Removing all items now leaves a link without items, which starts with three on reload. Starting with one is enough for ITEM-5, but write the clear item to the link like any other empty item (`000000000iframequery=Q`); a reload already restores that as one item.
- For ITEM-10, an item's stored value can be clear in several ways: an empty string (`Q`), or an EDITOR query string whose `query` and `querytitle` are missing, empty, or the compressed empty string. Decompress and trim both before deciding.
- `queryFunction` gives restored items new positions, and the ready handler already deletes the old `…iframequery` keys, so the link follows when clear items are left out of `list`.
- `workspace.spec.ts` "reloading the link keeps empty items too" checks the opposite of ITEM-10, and most of its tests expect three items at the start. Two tests in `jquery-fallback.spec.ts` expect three items too. Change them when this is built.
- `workspace.spec.ts` checks the 10px border and the names "Add" and "Remove". Both change.
