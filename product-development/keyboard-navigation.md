# Keyboard navigation: requirements

Status: **built** (2026-11-25), see [Decisions](#decisions) and [As built](workspace-ux.md#as-built). Not tested with a real screen reader.

How this meets the new cards and actions (move, collapse, undo) is in [workspace-ux.md](workspace-ux.md#keyboard-navigation).

## Goal and users

Use the WORKSPACE without a mouse: move between items, into the parts of a visualised query, and edit them.

- **Expert searchers** who want to work fast.
- **People who don't use a mouse**, including screen-reader users. Target: WCAG 2.2 AA.

Before, picking a scope worked only with the mouse, and `site/scripts/key-commands.js` only logged key presses.

## Decisions

- WORKSPACE only. The stand-alone EDITOR (opened without `ws`) keeps its current behaviour.
- Each item has its own tree, inside its iframe: item (root) → scopes → nested scopes. Screen readers see one tree per item; Alt+Up / Alt+Down moves the focus between the trees.
- Runs inside a group are stops, as at the top level: from `(a OR (b AND c))`, Down selects `a OR`, then Right selects `(b AND c)`.
- A run inside a group leaves out the group's own brackets: `a OR`, not `(a OR`. The mouse keeps including them (COMP-1).
- The content of a group without nested groups is a stop too: Down on `(b AND c)` selects `b AND c`. Editing it keeps the brackets.
- Alt+Up / Alt+Down moves between items, from an item or any scope (scheme C of the [prototype](prototypes/keyboard-navigation.html)). On a whole query, Right goes down to its first scope and Left to its last; on an item without a valid query they do nothing. In a text field, Alt+Up / Alt+Down keeps its normal behaviour.
- On an item, Enter opens the scope edit on the whole query, and T goes to the title. If the query is empty or has unbalanced brackets or quotes, Enter goes to the query box. For a valid query, "Edit query" opens the box. From a scope, go Up to the item first.
- Typing an item's number selects that item, on the whole page except in a text field, and starts navigation mode. A digit within 1 second extends the number; if there is no such item, it counts on its own. A switch under "Keyboard keys" limits this to navigation mode.
- Selecting an item with a valid query selects its whole query, as a scope. It takes the place of the item in the tree, also after Up, and has the item's keys (T, Enter). An item is only selected itself if its query is empty or has unbalanced brackets or quotes.
- A query that is a single scope has no second node with the same text: Down from `(a OR b)` selects `a OR b`, and Down on `heart` does nothing.
- Enter confirms a scope edit; Escape, Tab and Shift+Tab cancel it and go back to the node it started from.
- The first version has navigation, scope editing, and jumping to an item's title or query.
- Typing in the query box during a scope edit cancels the edit. This bug had to be fixed first, and is (2026-11-25). Other known bugs don't block this.

**Not in the first version:** shortcuts to add, remove, copy or reorder items; undo; keys in the stand-alone EDITOR. The existing buttons stay reachable with Tab.

## Terms

- **Item:** one EDITOR embedded in the WORKSPACE.
- **Scope:** a part of the visualised query that can be edited as a whole. Either a bracket *group*, or a *run*: neighbouring parts between groups at one level, without the surrounding group's brackets.
- **Whole query:** the whole visualised query of an item, if it is valid: its largest scope, and the top node of its tree. Below, "item" as a node means the whole query if there is one.
- **Current node:** the selected item or scope.
- **Navigation mode:** an item's tree has the focus. **Edit mode:** a text field has the focus (title, query box or dynamic input).

Example tree of an item with `(a OR (b AND c)) AND d`:

```
item: (a OR (b AND c)) AND d    whole query
├─ (a OR (b AND c))      group
│  ├─ a OR               run
│  └─ (b AND c)          group
│     └─ b AND c         run
└─ AND d                 run
```

## Keys

| Key | On an item | On a scope | In a text field |
|---|---|---|---|
| Alt+Up / Alt+Down | previous / next item | previous / next item | normal behaviour |
| Left / Right | last / first scope of its query | previous / next scope at this level | move the text cursor |
| Down | first scope of its query | first scope inside | normal behaviour |
| Up | nothing | surrounding scope; from the top level, the item | normal behaviour |
| Enter | open the scope edit on the whole query; empty or with an error: go to the query box | open the scope edit | scope edit: confirm; query box: new line |
| T | go to the title | nothing | types "t" |
| 0–9 | the item with that number | the item with that number | types the digit |
| Escape | nothing | nothing | scope edit: cancel; title or query box: back to the item |
| Tab / Shift+Tab | leave the item's tree | leave the item's tree | normal behaviour; scope edit: cancel and stay on the node |

Elsewhere on the page (nothing focused, a button, a link, the colour switch), only the digits do something, unless switched off.

At an edge (first, last, or no scope inside) the key does nothing. Navigation does not wrap.

## Requirements

### Navigation

| ID | Requirement | Priority |
|---|---|---|
| NAV-1 | The arrow keys, and Alt+Up / Alt+Down, move through the tree as in [Keys](#keys). | Must |
| NAV-2 | The keyboard can reach every group, and every run that holds at least one term or operator. Empty runs and runs with only a bracket are skipped. | Must |
| NAV-3 | Exactly one node is current while in navigation mode, and it is visibly marked: a scope or whole query with a box around its text, an item without a valid query with an outline around the item. | Must |
| NAV-4 | Each item's tree is one Tab stop: its last current node, or the item itself. Moving to an item with Alt+Up / Alt+Down selects its whole query, or the item itself if there is none. | Must |
| NAV-5 | Down does nothing on an item whose query is empty or has unbalanced brackets or quotes (scope editing is off then). The item itself is then selected, in place of the whole query. | Must |
| NAV-6 | A scope scrolls into view. An item or whole query that the keyboard selects is centered: its card, as far as the page can scroll; a card taller than the viewport starts at the top. A click doesn't scroll. If heights change just after that, it is centered again, unless the user scrolls. Arrow keys don't also scroll the page. | Must |
| NAV-7 | Clicking an item or scope makes it the current node. | Should |
| NAV-8 | Typing a number selects the item with that number (a collapsed one expands), from anywhere except a text field, and starts navigation mode. Without such an item the focus stays, and screen readers hear "No query" and the digit. Holding a key doesn't repeat it. | Must |
| NAV-9 | Escape doesn't make Safari leave full screen in navigation mode, or where it has a job (scope edit, query box, title, More menu). Elsewhere it still does. | Should |

### Editing

| ID | Requirement | Priority |
|---|---|---|
| EDIT-1 | Enter on a scope opens the existing dynamic input with the scope's text, focused. On an item with a valid query, with the whole query. | Must |
| EDIT-2 | Enter confirms, and Escape, Tab and Shift+Tab cancel, with the same result as confirming or clicking outside today. | Must |
| EDIT-3 | After confirming or cancelling, navigation returns to the same place. If that scope is gone, it goes to the nearest remaining one: a neighbour, then the surrounding scope, then the item. | Must |
| EDIT-4 | An invalid edit shows the existing alert and keeps the input open and focused. | Must |
| EDIT-5 | Keys typed in a text field never navigate. | Must |
| EDIT-6 | Key combinations with Ctrl, Alt or Cmd are left to the browser, except Alt+Up and Alt+Down in navigation mode. | Must |
| EDIT-7 | Enter does not confirm while text is being composed (IME). | Should |

### Accessibility

| ID | Requirement | Priority |
|---|---|---|
| A11Y-1 | The marker of the current node is clear without colour, works in greyscale, has at least 3:1 contrast, and differs from the hover highlight. It is a line of black and white dashes, so it also differs from the solid borders around it. | Must |
| A11Y-2 | There is no keyboard trap: Tab and Shift+Tab always lead out of an item and its iframe. | Must |
| A11Y-3 | Single-letter keys work only in navigation mode (WCAG 2.1.4). Digits work on the whole page except in text fields, with a switch, remembered in the browser, that limits them to navigation mode. | Must |
| A11Y-4 | Each item's tree is labelled with the item's title, or its position if it has none. Screen readers announce the item (its title or number, then its whole query) or scope, its level and its text. | Must |
| A11Y-5 | The keys are explained on the page. | Should |

### Compatibility

| ID | Requirement | Priority |
|---|---|---|
| COMP-1 | Mouse behaviour and the stand-alone EDITOR don't change. | Must |
| COMP-2 | Existing share links keep loading, and navigating doesn't change the link. | Must |
| COMP-3 | Works in Chromium, Firefox and WebKit. | Must |
| COMP-4 | After adding or removing an item there is still a valid current node. | Must |

## Scenarios

To become Playwright tests (`playwright/workspace-keyboard.spec.ts`). Unless stated otherwise, item 1 holds `(a OR (b AND c)) AND d` and is current.

1. **Traverse:** Down selects `(a OR (b AND c))`. Right selects `AND d`. Right again does nothing. Up selects item 1.
2. **Nest:** from `(a OR (b AND c))`, Down then Right selects `(b AND c)`. Down selects `b AND c`. Up, Up, Up returns to item 1.
3. **Next item:** Alt+Down selects item 2, also from a scope in item 1. Right on an item without a valid query does nothing.
4. **Confirm:** on `(b AND c)`, Enter, change it to `(b AND e)`, Enter. The query and link are updated, and `(b AND e)` is current.
5. **Cancel:** on `(b AND c)`, Enter, type, Escape. The query is unchanged, and `(b AND c)` is current.
6. **Structure changes:** on `(b AND c)`, Enter, change it to `b`, Enter. The nearest remaining scope is current.
7. **Invalid edit:** on `(b AND c)`, Enter, change it to `(b AND c`, Enter. An alert appears, and the input stays open.
8. **Query with an error:** item 1 holds `(a OR b`. Down does nothing; Alt+Down selects item 2.
9. **Typing:** arrows, T and Enter in the query box of item 1 (opened with Edit query) only affect the text. Escape selects item 1.
10. **Remove:** item 2 of 3 is current and gets removed. The focus is on the Collapse button of the item now in that place, and Tab reaches its tree (KEY-5 in [workspace-ux.md](workspace-ux.md#keyboard-navigation)).
11. **Number:** with three items, 2 on a card button selects item 2; 3 on one of its scopes selects item 3; 9 does nothing. In a text field, digits are typed. With twelve items, 1 and 2 quickly after each other selects item 12.
12. **Whole query:** Enter on item 1 opens the scope edit with its whole query. Enter confirms a change; Escape, Tab and Shift+Tab cancel. Item 1 is then current, and Tab leaves it. Emptying the query shows the query box.
13. **Selecting:** each way to select item 1 (1, Alt+Up, Escape in its title, Up from a scope, a click on it) marks its whole query. T goes to its title. An item without a valid query is marked itself.
14. **Left and Right from the top:** on item 1, Right selects `(a OR (b AND c))` and Left selects `AND d`.

## Technical notes

- `makeEditScope` picks the scope and `hoverMouseDown` starts the edit (`site/index.html`). Both depend on mouse events, so picking and editing should first be separated from the mouse.
- **What hovering selects now** (checked in Chromium with `(aa OR (bb AND cc)) AND dd`): over `aa` it selects `(aa OR `, over `bb` the parts of `(bb AND cc)`, and over `dd` ` AND dd`. So a run next to a nested group takes a loose bracket with it, and a whole outer group can only be picked by its own edge. The keyboard scopes leave that bracket out, so they can't simply copy hovering.
- Confirming or cancelling renders the query again, so the place must be remembered as a path in the tree, not as an element.
- `addItemAfter` and `removeThisItem` rebuild every iframe in the WORKSPACE.
- Focus moves between documents. The WORKSPACE and items talk through `postMessage` (`updateUrl`, `setEditMode`). New message types must be added to both pages, and the receiver must check the origin.
- `editMode` relies on `focusout`, which may not fire when the dynamic input is removed from the page. Then `editMode` would stay on.
