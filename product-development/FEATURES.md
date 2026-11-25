# Features

Medsyntax is a syntax assistant for (medical) search engine queries with a scope-driven editor.

## Query input
- Query title field and query text area (auto-resizing)
- Clear button to reset the query
- Demo button that loads an example query

## Syntax visualisation
- Live parsing and rendering of the query into a nested visual structure
- Highlights for:
  - Boolean operators: `AND`, `OR`, `NOT`
  - Round brackets `( )` and square brackets `[ ]`
  - Quoted phrases `"..."`
  - Proximity/NEAR operators
  - Embase-style field syntax
- Colour or greyscale display mode

## Syntax checks (warnings)
- Unbalanced `(` / `)` brackets
- Unbalanced `[` / `]` brackets
- Odd number of quote signs
- Duplicate `OR` / `AND` operators
- Ambiguous mixing of `AND` and `OR` at the same bracket level

## Scope-driven editor
- Hover over the visualisation to pick the scope of an edit (highlighted)
- Click to open a dynamic input field for that scope
- `Enter` confirms the edit; clicking outside cancels it
- Animated demo GIF and quick guide in the help modal

## Sharing
- Query and title are compressed (LZString) into the URL, so links are shareable
- Loading a URL restores the query and title
- Copy-query and copy-link buttons (clipboard)

## WORKSPACE (MedsyntaxQA)
- A list of queries (items), each an embedded EDITOR, kept in one shareable link
- Add, duplicate, move, collapse, clear the query, and remove with Undo, without disturbing other items
- Edit, copy and clear query in the card header, with a More menu on narrow screens
- Title per item in its card header, and a Show example button with four PICO queries while every item is clear
- Number and colour per item; a switch for system, light, dark or greyscale colours, remembered in the browser
- The query box shows while editing; otherwise only the visualisation
- Opening the page or loading an example leaves nothing selected; a number key or Tab starts keyboard navigation
- Keyboard navigation through items and scopes, and scope editing without a mouse
- Selecting an item selects its whole query as a scope; Enter edits it in the scope editor
- The keyboard marker has dashes and a glow in the item's colour; the glow pulses when the selection moves
- The query that the keyboard selects is centered in the viewport
- Typing a query's number selects it, from anywhere except a text field (can be limited to navigation mode)
- Combine items: `#1 AND (#3 OR #7)` refers to other items, as coloured chips. References follow their item when items are moved, added or removed; Copy full query copies the combined query, and Show a multiline search example shows how
- Items without a title and query are dropped on reload

## Embedding
- iframe-resizer support for embedding in other pages

## Tooling
- jQuery fallbacks in the EDITOR and WORKSPACE: code.jquery.com, then jsDelivr, then cdnjs, then a local copy; the CDN files are checked with an SRI hash
- Playwright end-to-end tests (`npm run pw-test`, `npm run pw-test-ui`), also as Claude Code skills (`/.pw-test-chromium`, `/.pw-test-all`, `/.pw-test-gui`, `/.pw-codegen`, `/.pw-report`)
- Claude Code hooks that report how long each shell command took (`.claude/settings.json`, needs `jq`)
- GitHub Pages deployment via `.github/workflows/static.yml` (publishes only `site/`)
- Qodana code analysis config
- `site/workspace/`: MedsyntaxQA (Query Augmentation) experimental version (v0.1), see WORKSPACE above

---

## TODO

### Bugs / code questions
- [x] EDITOR scrolled sideways on narrow screens (375px): the title box (`size="100"`) and the hidden 400px copy tooltips were wider than the screen, and without a viewport tag phones zoomed out a 980px layout. Fixed with `max-width` on `.query-title` and `.tooltiptext` and a viewport meta tag (tests: `editor-layout.spec.ts` "no horizontal page scroll at 375px wide")
- [x] WORKSPACE dropped new empty items on reload. First fixed by restoring every item; since the new WORKSPACE UX, clear items are dropped on purpose (ITEM-10 in `product-development/workspace-ux.md`)
- [x] Alerts were blocked in WORKSPACE items (the iframes' `sandbox` lacked `allow-modals`), so an invalid scope edit gave no message
- [x] Clear button: hide syntax warnings, and reset `stringLatestString` so re-entering the same query renders it again (`clearButtonFunc` in `site/index.html`; tests in `editor-controls.spec.ts`)
- [ ] Verify the `savedLatestInputTime !== latestInputTime` check in `afterParseFunction` actually works (`site/index.html` TODO)
- [x] `site/scripts/key-commands.js` was a stub (only `console.log`s): removed; the keys are in `site/scripts/editor/item-keyboard.js`
- [x] Typing in the query box during a scope edit did not update the visualisation; it now renders the query and cancels the edit (`syntaxCheck` in `site/index.html`; tests: `editor-edge-cases.spec.ts` "during a scope edit")
- [ ] EDITOR bugs with a `test.fail` test in `playwright/editor-edge-cases.spec.ts` (remove that line when fixed):
  - [ ] **Security (XSS):** HTML in a query, also from a shared link, runs as code (`innerHTML`, unescaped)
  - [ ] Fast typing in Safari stops rendering: over 100 history changes in 10 seconds (`updateUrl` calls `replaceState` and `pushState`)
  - [x] Terms were not recognised if they started with a symbol or non-ASCII letter, or were a one-letter last term (`vitamin AND D`, `#1 AND #2`, `é AND écart`), and such a last term was left out of the scope; `syntaxParser` now makes any remaining text a term (tests: "terms")
  - [ ] Brackets inside quotes give a false bracket warning (`"smile :)"`)
  - [ ] Wrongly ordered brackets that balance give no warning (`(heart))((lung)`, `([)]`), and the scope editor accepts them
  - [ ] Apostrophes count as quotes (`Crohn's disease`, `Crohn's AND Parkinson's`)
  - [ ] Misplaced operators give no warning (`AND heart`, `heart AND`, `heart AND OR lung`, `heart NOT NOT lung`)
  - [ ] Operators between tabs or non-breaking spaces are not recognised
  - [ ] The clean-up adds spaces where it should not (`"heart AND(lung)"`, `(door)ORAL drug`, `FOR(heart)`)
  - [ ] HTML, entities and `___` are changed in the visualisation, and can be lost when a scope edit is confirmed
  - [ ] The Back button changes the link but not the query
  - [ ] A link with malformed percent-encoding stops the start-up code
  - [ ] Emptying the query box by hand does not bring back the demo button

### Known risks: # references
Not covered by the WORKSPACE's references between items (REF in `product-development/workspace-ux.md`):
- [ ] `#` numbers that aren't seen as references (`#1[tiab]`, ranges as `#1-#3`) are not rewritten, so they silently point to the wrong line after a move
- [ ] In existing links, and in a strategy pasted from elsewhere, `#1` means item 1, also if it meant another line. A strategy pasted below other items refers to the wrong ones
- [ ] The browser's own undo (Cmd/Ctrl+Z) in a query box or scope edit may not work well after a rewrite, and can bring old numbers back (not tested)
- [ ] Moving an item closes the scope edit open in it, and loses what wasn't confirmed (already so before references)
- [ ] Once Undo is no longer possible, a missing reference (`#2?`) can only be retyped
- [ ] Copy full query doesn't check the combined query against a database: length limits and field syntax can still make it invalid
- [ ] A chip's tooltip can't be reached with the keyboard, and only its number and colour link it to its card. Not tested with a real screen reader
- [ ] The EDITOR's known bugs count here too: brackets in quotes and apostrophes (`"smile :)"`, `Crohn's`) make a referenced query "unbalanced", and text between two apostrophes is seen as quoted, so a `#1` in it is no reference
- [ ] After over 100 changes in 10 seconds in Safari the link lags behind; a reload in that time gives an older, but consistent, list
- [ ] WebKit can stop loading an item's scripts during quick changes (already so before references). The item then loads again after about 1.5 seconds, at most three times; what was typed in it in that time can be lost

### Testing
- [x] Add EDITOR edge-case tests: `playwright/editor-edge-cases.spec.ts`
- [x] Remove `playwright/example.spec.ts`, after moving its tests:
  - "Medsyntax has title": already covered by `editor-controls.spec.ts` (exact title) and `editor-sharing.spec.ts`
  - "Demo query and custom input render combined medsyntax output" → `editor-scope.spec.ts` ("editing a nested scope in the demo query")
  - "Workspace page loads with its scripts" → `workspace.spec.ts` ("loads its scripts without errors")
- [x] Add tests for the bracket warnings `( )` and `[ ]`: `playwright/editor-warnings.spec.ts`
- [x] Add tests for the other syntax warnings (quotes, duplicate/ambiguous operators): `editor-warnings.spec.ts`
- [x] Add tests for URL sharing (query/title restored from link): `editor-sharing.spec.ts`
- [x] Add tests for copy buttons, clear button and greyscale mode: `editor-controls.spec.ts`
- [x] Add tests for cancelling an edit (click outside the dynamic input): `playwright/editor-scope.spec.ts`
- [x] Add tests for the WORKSPACE: `playwright/workspace.spec.ts`
- [ ] Run Playwright tests in GitHub Actions
- [x] Enable all browsers again: the `chromium` and `firefox` projects in `playwright.config.js` run next to `webkit`
- [x] Refresh `editor-with-warning-chromium-darwin.png` and `editor-with-warning-firefox-darwin.png` (they showed the old double bracket warning)

### Code quality
- [x] Move inline `<script>` blocks from `site/index.html` into separate JS files
- [ ] Give generic functions clearer names (e.g. `myFunction`, `myForm`, `myRadios`)
- [x] Add an SRI hash to the CDN `<script>`s
- [ ] Remove or reduce commented-out `console.log` calls

### Docs / housekeeping
- [ ] Update `README.md` (still says "medsyntaxexperimental"; add usage and dev instructions)
- [ ] Document how `site/workspace/` (MedsyntaxQA) relates to the main app

### Ideas
- [ ] Support more search engine syntaxes (PubMed, Ovid, etc.)
- [ ] Undo/redo for scope edits
- [x] New look and better item management in the WORKSPACE: undo for Remove, move, duplicate, collapse (requirements: `product-development/workspace-ux.md`)
- [x] Accessibility: keyboard navigation for the WORKSPACE and its scope editor (requirements: `product-development/keyboard-navigation.md`)
- [ ] Test the WORKSPACE with a real screen reader (VoiceOver, NVDA)
