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
- Alt+Up / Alt+Down moves between items, from an item or any scope (scheme C of the [prototype](prototypes/keyboard-navigation.html)). Left/Right does nothing on an item. In a text field, Alt+Up / Alt+Down keeps its normal behaviour.
- On an item, Enter goes to the query box and T to the title. From a scope, go Up to the item first.
- Enter confirms a scope edit, Escape cancels it.
- The first version has navigation, scope editing, and jumping to an item's title or query.
- Typing in the query box during a scope edit cancels the edit. This bug had to be fixed first, and is (2026-11-25). Other known bugs don't block this.

**Not in the first version:** shortcuts to add, remove, copy or reorder items; undo; keys in the stand-alone EDITOR. The existing buttons stay reachable with Tab.

## Terms

- **Item:** one EDITOR embedded in the WORKSPACE.
- **Scope:** a part of the visualised query that can be edited as a whole. Either a bracket *group*, or a *run*: neighbouring parts between groups at one level, without the surrounding group's brackets.
- **Current node:** the selected item or scope.
- **Navigation mode:** an item's tree has the focus. **Edit mode:** a text field has the focus (title, query box or dynamic input).

Example tree of an item with `(a OR (b AND c)) AND d`:

```
item
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
| Left / Right | nothing | previous / next scope at this level | move the text cursor |
| Down | first scope of its query | first scope inside | normal behaviour |
| Up | nothing | surrounding scope; from the top level, the item | normal behaviour |
| Enter | go to the query box | open the scope edit | scope edit: confirm; query box: new line |
| T | go to the title | nothing | types "t" |
| Escape | nothing | nothing | scope edit: cancel; title or query box: back to the item |
| Tab / Shift+Tab | leave the item's tree | leave the item's tree | normal behaviour; in a scope edit it also cancels |

At an edge (first, last, or no scope inside) the key does nothing. Navigation does not wrap.

## Requirements

### Navigation

| ID | Requirement | Priority |
|---|---|---|
| NAV-1 | The arrow keys, and Alt+Up / Alt+Down, move through the tree as in [Keys](#keys). | Must |
| NAV-2 | The keyboard can reach every group, and every run that holds at least one term or operator. Empty runs and runs with only a bracket are skipped. | Must |
| NAV-3 | Exactly one node is current while in navigation mode, and it is visibly marked. | Must |
| NAV-4 | Each item's tree is one Tab stop: its last current node, or the item itself. Moving to an item with Alt+Up / Alt+Down selects the item itself. | Must |
| NAV-5 | Down does nothing on an item whose query is empty or has unbalanced brackets or quotes (scope editing is off then). The item itself stays reachable. | Must |
| NAV-6 | The current node scrolls into view, and arrow keys don't also scroll the page. | Must |
| NAV-7 | Clicking an item or scope makes it the current node. | Should |

### Editing

| ID | Requirement | Priority |
|---|---|---|
| EDIT-1 | Enter on a scope opens the existing dynamic input with the scope's text, focused. | Must |
| EDIT-2 | Enter confirms and Escape cancels, with the same result as confirming or clicking outside today. | Must |
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
| A11Y-3 | Single-letter keys work only in navigation mode (WCAG 2.1.4). | Must |
| A11Y-4 | Each item's tree is labelled with the item's title, or its position if it has none. Screen readers announce the item or scope, its level and its text. | Must |
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
3. **Next item:** Alt+Down selects item 2, also from a scope in item 1. Right on an item does nothing.
4. **Confirm:** on `(b AND c)`, Enter, change it to `(b AND e)`, Enter. The query and link are updated, and `(b AND e)` is current.
5. **Cancel:** on `(b AND c)`, Enter, type, Escape. The query is unchanged, and `(b AND c)` is current.
6. **Structure changes:** on `(b AND c)`, Enter, change it to `b`, Enter. The nearest remaining scope is current.
7. **Invalid edit:** on `(b AND c)`, Enter, change it to `(b AND c`, Enter. An alert appears, and the input stays open.
8. **Query with an error:** item 1 holds `(a OR b`. Down does nothing; Alt+Down selects item 2.
9. **Typing:** arrows, T and Enter in the query box of item 1 only affect the text. Escape selects item 1.
10. **Remove:** item 2 of 3 is current and gets removed. The focus is on the Collapse button of the item now in that place, and Tab reaches its tree (KEY-5 in [workspace-ux.md](workspace-ux.md#keyboard-navigation)).

## Technical notes

- `makeEditScope` picks the scope and `hoverMouseDown` starts the edit (`site/index.html`). Both depend on mouse events, so picking and editing should first be separated from the mouse.
- **What hovering selects now** (checked in Chromium with `(aa OR (bb AND cc)) AND dd`): over `aa` it selects `(aa OR `, over `bb` the parts of `(bb AND cc)`, and over `dd` ` AND dd`. So a run next to a nested group takes a loose bracket with it, and a whole outer group can only be picked by its own edge. The keyboard scopes leave that bracket out, so they can't simply copy hovering.
- Confirming or cancelling renders the query again, so the place must be remembered as a path in the tree, not as an element.
- `addItemAfter` and `removeThisItem` rebuild every iframe in the WORKSPACE.
- Focus moves between documents. The WORKSPACE and items talk through `postMessage` (`updateUrl`, `setEditMode`). New message types must be added to both pages, and the receiver must check the origin.
- `editMode` relies on `focusout`, which may not fire when the dynamic input is removed from the page. Then `editMode` would stay on.
