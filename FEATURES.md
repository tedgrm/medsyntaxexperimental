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

## Embedding
- iframe-resizer support for embedding in other pages

## Tooling
- Playwright end-to-end tests (`npm run pw-test`, `npm run pw-test-ui`)
- GitHub Pages deployment via `.github/workflows/static.yml`
- Qodana code analysis config
- `workspace/`: MedsyntaxQA (Query Augmentation) experimental version (v0.1)

---

## TODO

### Bugs / code questions
- [ ] Clear button leaves syntax warnings visible: `clearButtonFunc` in `index.html` should call `hideWarnings()`. Test: `editor-controls.spec.ts` "hides the syntax warnings of the cleared query" (marked `test.fail`; remove that line once fixed)
- [ ] Verify the `savedLatestInputTime !== latestInputTime` check in `afterParseFunction` actually works (`index.html` TODO)
- [ ] `scripts/key-commands.js` is a stub (only `console.log`s); implement keyboard commands or remove it

### Testing
- [ ] Remove `playwright/example.spec.ts`. Move its tests first so nothing is lost:
  - "Medsyntax has title" and "Demo query and custom input render combined medsyntax output" → `editor.spec.ts`
  - "Workspace page loads with its scripts" → a new `workspace.spec.ts`
- [x] Add tests for the bracket warnings `( )` and `[ ]`: `playwright/editor-warnings.spec.ts`
- [x] Add tests for the other syntax warnings (quotes, duplicate/ambiguous operators): `editor-warnings.spec.ts`
- [x] Add tests for URL sharing (query/title restored from link): `editor-sharing.spec.ts`
- [x] Add tests for copy buttons, clear button and greyscale mode: `editor-controls.spec.ts`
- [x] Add tests for cancelling an edit (click outside the dynamic input): `playwright/editor-scope.spec.ts`
- [ ] Run Playwright tests in GitHub Actions
- [ ] Enable all browsers again: uncomment the `chromium` and `firefox` projects in `playwright.config.js` (only Safari/WebKit runs for now), check that their `editor-layout` screenshot baselines still match (refresh with `--update-snapshots` if the layout changed on purpose; `editor-with-warning-chromium-darwin.png` and `-firefox-darwin.png` still show the old double bracket warning and must be refreshed), and update the Commands section of `CLAUDE.md`

### Code quality
- [ ] Move inline `<script>` blocks from `index.html` into separate JS files
- [ ] Give generic functions clearer names (e.g. `myFunction`, `myForm`, `myRadios`)
- [ ] Host jQuery locally or add an SRI hash to the CDN `<script>`
- [ ] Remove or reduce commented-out `console.log` calls

### Docs / housekeeping
- [ ] Update `README.md` (still says "medsyntaxexperimental"; add usage and dev instructions)
- [ ] Document how `workspace/` (MedsyntaxQA) relates to the main app

### Ideas
- [ ] Support more search engine syntaxes (PubMed, Ovid, etc.)
- [ ] Undo/redo for scope edits
- [ ] Accessibility: keyboard navigation for the scope editor
