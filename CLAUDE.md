# CLAUDE.md

Medsyntax is a syntax assistant for (medical) search-engine queries, with a scope-driven editor. It is a plain static site (HTML + JS + jQuery), with no build step and no framework. It is deployed to GitHub Pages by `.github/workflows/static.yml`, which publishes only the `site/` folder (the Pages source must be GitHub Actions).

See `product-development/FEATURES.md` for the feature list and the TODO list. Keep it up to date when you add or finish features.

## Layout

- `site/`: the published site. Everything the pages load is in here; nothing outside it is served or published. Paths in URLs are relative to it (`site/workspace/` is `/workspace/`).
- `site/index.html`: the main Medsyntax app (markup only; its logic is in `site/scripts/editor/`).
- `site/style.css`, `site/iframe.css`: styles for the main app.
- `site/workspace/`: MedsyntaxQA (Query Augmentation), an experimental v0.1. It embeds several copies of `../index.html?ws=<id>&...` in iframes and loads `../scripts/...`, so it must be served from **`site/`**, not from `site/workspace/` on its own.
- `site/scripts/`: client-side scripts loaded by the pages.
  - `third-party/`: vendored libraries, currently `lzstring.js` (MIT), `iframe-resizer/` (GPLv3) and `jquery/` (MIT). Anything added here later is third-party too. **Read-only**, and not to be tested. See Conventions.
  - `editor/`: the EDITOR's own scripts, loaded by `site/index.html` in this order. They are plain scripts (not modules) that share globals and are called from inline `on…` handlers, and they need the elements above their `<script>` tags, so keep the tags where they are.
    - `menu.js` (dropdown menu), `color-mode.js` (colour/greyscale), `help-image.js` (help image modal).
    - `editor.js`: most of the logic: parsing and rendering (`syntaxCheck`), warnings, the scope editor (`setEditMode`, dynamic input), URL sharing (`updateUrl`, `getParameterByName`) and copy buttons.
    - `item.js`, `item-keyboard.js`: only for an EDITOR embedded in the WORKSPACE (`ws`): hiding the query box, and keyboard navigation. Without `ws` they must do nothing.
  - `references.js`: references between items (`#1`): finding, renumbering, full queries. No DOM; loaded by both pages.
    - `editor/item-references.js`: their chips and warnings in an item (`ws`). The WORKSPACE calls its `renumberItemReferences` directly, only once `itemIsReady` is true. Every change to the order or number of items goes through `changeItems` in `workspace.js`.
  - `workspace/color-mode.js`: the WORKSPACE's colour switch (system, light, dark, greyscale), kept in `localStorage`. Sets `data-theme` on `<html>`; loaded in the head. Not the EDITOR's `editor/color-mode.js`.
  - `workspace/workspace.js`: the WORKSPACE's list: items, their buttons, Undo, the link, messages.
- `server.js`: a static dev server with no dependencies. It serves `site/` on `PORT` (default 8080).
- `playwright/`: end-to-end tests. `playwright.config.js` starts `server.js`, sets `baseURL` to `http://127.0.0.1:8080`, and starts every browser at a **1920x1080** viewport (set after each device preset, which has its own size). Keep that default. Only resize inside a test when the test is about another screen size.
  - `editor.spec.ts`: EDITOR behaviour with a PubMed query and an Embase query. `editor-layout.spec.ts`: EDITOR layout (structure checks plus screenshot comparisons). `editor-warnings.spec.ts`: syntax warnings (bracket warnings so far). `editor-scope.spec.ts`: the scope-driven editor (hover to pick a scope, click to edit, Enter to confirm, click outside to cancel, alerts on invalid edits).
  - `editor-parser.spec.ts`: how queries are rendered and cleaned up. `editor-quotes.spec.ts`: conversion of curly and look-alike quotes. `editor-controls.spec.ts`: title, demo/clear/copy buttons, menu, colour mode, help image. `editor-sharing.spec.ts`: restoring query and title from a link. `editor-edge-cases.spec.ts`: unusual input, including the known bugs listed in `product-development/FEATURES.md` (as `test.fail`). `editor-embedded.spec.ts`: the EDITOR inside the WORKSPACE (`?ws=<n>`, messages to the parent).
  - `workspace.spec.ts`: the WORKSPACE (items, Add/Remove, query sync to its link, edit mode, reload, item sizing). `workspace-ux.spec.ts`: the scenarios of `workspace-ux.md`. `workspace-keyboard.spec.ts`: keyboard navigation. `workspace-references.spec.ts`: references between items (moving, Undo, open edits, loading, circles). `workspace-layout.spec.ts`: screenshots, light, dark and greyscale (baselines in its `-snapshots` folder, refreshed like the EDITOR's).
  - `jquery-fallback.spec.ts`: the order of jQuery sources in the EDITOR and the WORKSPACE, with stubbed CDNs that are unreachable or serve a changed file (SRI).
  - `helpers.ts`: shared test helpers. EDITOR: `enterQuery`, `queryBox`, `target`, `captureAlerts`, `expectWarnings`. WORKSPACE: `openWorkspace`, `waitForItems`, `workspaceItem`, `itemFrame`, `titleField`, `itemBox`, `openItemBox`, `enterItemQuery`, `enterItemTitle`, `itemQuery`, `linkQueries`, `linkTitles`, `stableMiddle` (items by position, from 0). Use them in new tests. Tests that document a known bug use `test.fail(true, 'Known bug: …')`; remove that line when the bug is fixed.
  - `fixtures/`: test inputs copied from `product-development/external documents/` (tests never read the originals). See its `README.md` for each file's source.
  - `editor-layout.spec.ts-snapshots/`: screenshot baselines, one per browser and OS (`-darwin`). After an intended layout change, refresh them with `npx playwright test editor-layout --update-snapshots`, look at the new images, and commit them.
- `.claude/skills/`: skills (slash commands) that run the Playwright commands below. Only `/.pw-test-chromium` can be started by Claude itself; the others open windows or (`/.pw-test-all`) take long, so only the user starts them.
- `product-development/`: product development resources (research, roadmap, designs, feedback). Not part of the site's code. See its `README.md`.
  - `FEATURES.md`: the feature list, the TODO list and known risks.
  - `keyboard-navigation.md`: requirements for keyboard navigation in the WORKSPACE. Built.
  - `workspace-ux.md`: UX requirements for the WORKSPACE (visual style with dark mode, managing items, how they meet keyboard navigation). Built.
  - `prototypes/`: throwaway prototypes, opened straight from disk. Not part of the site and not tested.
  - `external documents/`: source documents from outside the project. **Read-only.** See Conventions.
    - `Zoekstrategie Medsyntax Ted.docx`: a PubMed search strategy, the query used in `playwright/editor.spec.ts`.
    - `embase string example.xlsx`: an Embase.com search strategy as 28 numbered lines (`#1`–`#28`, with result counts and syntax explanations) and as one combined string.

## The two `index.html` files

There are two pages, both called `index.html`. Each has a short identifier. Use it in chat, plans, commit messages and docs instead of a bare "index.html":

- **EDITOR**: the Medsyntax query editor, `site/index.html`
- **WORKSPACE**: the MedsyntaxQA workspace, `site/workspace/index.html`. It holds a list of EDITORs. A single EDITOR embedded in the WORKSPACE is an **item** (as in the code: `addItem`, `removeItem`, `li_item_<id>`).

If the user just says "index.html", ask which one they mean, unless the context makes it clear.

| | EDITOR (Medsyntax app) | WORKSPACE (MedsyntaxQA workspace) |
|---|---|---|
| File | `site/index.html` | `site/workspace/index.html` |
| `<title>` | `Medsyntax` | `MedsyntaxQA` |
| URL (dev) | http://127.0.0.1:8080/index.html | http://127.0.0.1:8080/workspace/ |
| Styles | `site/style.css`, plus `site/iframe.css` when embedded (the look of items, with dark mode) | `site/workspace/style.css` |
| Version | 1.0 (`README.md`) | 0.1, experimental (`site/workspace/README.md`) |
| Role | Edits **one** query: input, syntax visualisation, warnings, scope editor, copy and share | Holds a **list** of Medsyntax apps, each in its own iframe, with Add/Remove buttons |

**How they work together:**
- The workspace builds each list item as `<iframe id="page_is_fresh_<id>" src="../index.html?ws=<id>&...">` (`createItem`), sized with iframe-resizer. An item's id stays the same while the page is open; its position in the list gives its number, its colour and its place in the link. Actions must not reload the iframes of other items.
- The app detects workspace mode from the `ws` URL parameter. In that mode it adds the `ws-embedded` class to `<html>` (in the head, before anything shows) and `ws-iframe-body` to `<body>`, and sends messages to the parent with `window.parent.postMessage`:
  - `updateUrl`: payload `"<id>%index%<app query string without ws>"`. The workspace then reads the item's state itself (`itemQueryString`), because a payload can hold old reference numbers, and stores it in its own URL as `<position padded to 9 digits>iframequery`, compressed with LZString.
  - `setEditMode`: payload `true`/`false`. The workspace stores it in its global `editMode`.
  - `moveFocus` (-1/1): Alt+Up/Alt+Down. `centerItem`: the keyboard selected the item's top node. `selectNumber` (`{digit, inTree}`): a digit outside a text field; the workspace handles digits on its own page itself. `focusTitle`: T on an item. The title field is in the WORKSPACE's card header, which decides about the title in an item's query string; the EDITOR's own field is hidden in items. `queryBoxLeft` and `pointerState` (true/false): the workspace answers with `hideQueryBox` once the pointer is up, so a click never misses its target.
  - `itemResized`: the workspace fits the iframe to the item, in case iframe-resizer missed a change.
  - The workspace sends items `focusItem`, `itemState` (`{color, number, theme}`), `references` (`{references: {key: {color, ink, title, problem}}, warning}`), `setTitle`, `hideQueryBox`, `editQuery` and `clearQuery` (buttons in the card header; the EDITOR's own title field and clear, demo and copy buttons are hidden in items).
- The workspace only accepts messages from its own origin, so both pages must be served from the same server.
- When the workspace loads, it rebuilds the list from its `…iframequery` parameters. If there are none, it starts with one clear item. Items without a title and query are dropped on load, but one always remains.

**When editing:**
- An EDITOR opened directly must not change in look or behaviour because of the WORKSPACE: keep item styles under `.ws-embedded` in `site/iframe.css`, and item code in `item.js`/`item-keyboard.js`.
- A change to `site/index.html` or `site/scripts/editor/` affects both the stand-alone app and every workspace item. Test both.
- If you change the message types or payload formats, update both files together.
- When opened without `ws`, the app must keep working on its own.

## Commands

- `npm start`: serve the site at http://127.0.0.1:8080/ (workspace: `/workspace/`)
- `npm run pw-test` (skill `/.pw-test-all`; `/.pw-test-chromium` runs only Chromium): run all Playwright tests in Chromium, Firefox and Safari (WebKit). Add `--project=webkit` (or another name) for one browser. The server starts on its own.
- `npm run pw-test-gui` (skill `/.pw-test-gui`): Playwright UI mode
- `npm run pw-test-ui`: headed run (browser windows visible). **Flaky**, so there is no skill for it: on 2026-11-24, 2 of 4 headed WebKit runs of `editor-quotes` had one failing test, a different one each time (one timed out closing the browser; fewer workers did not help), while the headless runs passed. The cause is unknown. Use `npm run pw-test` to decide whether a test really fails
- `npm run pw-codegen` (skill `/.pw-codegen`): record a new test
- `npx playwright show-report` (skill `/.pw-report`): open the last HTML report

After changing anything in `site/`, `playwright/`, `playwright.config.js` or `server.js`, run the tests **in Chromium only**: `npm run pw-test -- --project=chromium`. Run **all browsers** (`npm run pw-test`) only before committing such changes, or when the user asks. Make sure everything passes. Commits that touch none of these (docs only, for example) need no test run.

## Conventions

- **Always make edits on a temporary feature branch.** Before the first edit of a task, check for uncommitted changes (`git status -sb`), run `git fetch origin main`, and create a new branch from the latest `main`: `git switch --no-track -c feature/<short-task-name> origin/main`. If local `main` has commits that aren't on `origin/main`, or uncommitted changes block the switch, ask the user first. Stay on it for the rest of that task, and check the branch again before committing, because the user may switch it in between. Don't merge, push or delete the branch unless the user asks. Leave uncommitted changes that aren't yours alone.
- **Never edit, overwrite, convert, rename, move or delete anything in `product-development/external documents/`.** These are originals from other people. Read them (unzip the `.docx`/`.xlsx` XML) and copy what you need elsewhere, for example a query into a test. To add or replace a document, ask the user to do it. `.claude/settings.json` also denies file edits there.
- **Never edit, reformat, rename or delete anything in `site/scripts/third-party/`.** These are unmodified upstream copies, kept for licensing and attribution. If one needs a fix or an upgrade, stop and ask the user. Put our own code in `site/scripts/` (outside `third-party/`) and wrap or extend the library from there. `.claude/settings.json` also denies file edits there.
- Keep the site static: no bundler, no framework, and no new runtime dependencies unless asked. jQuery 3.6.0 comes from code.jquery.com, then jsDelivr, then cdnjs, then `site/scripts/third-party/jquery/`; each is tried only if the ones before it failed. The three CDN scripts share one SRI hash. When changing the version, change all four sources and the hash in both pages (and the sources and version in `jquery-fallback.spec.ts`). Compute the hash with `openssl dgst -sha256 -binary <file> | base64`, prefixed with `sha256-`.
- Scripts are loaded with relative paths (`scripts/...` from `site/`, `../scripts/...` from `site/workspace/`). Keep pages working when served from `site/` and on GitHub Pages under a sub-path, so never use absolute `/` URLs.
- Shareable state (query, title, workspace items) lives in the URL query string, compressed with LZString. Changes must keep existing links loading.
- In tests, navigate with relative paths (`page.goto('/index.html')`, `page.goto('/workspace/')`) so they use `baseURL`. Don't use `file://` URLs. Prefer role, text and id locators (`#medsyntax`, `#dynamic-input`, `#query-input1`).
- **When deciding which tests to add, ignore everything in `site/scripts/third-party/`**, including any library added there later. Don't plan or write tests for those libraries themselves (today `lzstring.js`, `iframe-resizer/` and `jquery/`); they're unmodified upstream code. Test our own behaviour that uses them (e.g. links restored via LZString, WORKSPACE items sized by iframe-resizer) through the EDITOR and WORKSPACE pages.
- Names of our own skills start with `.` (`/.pw-test-chromium`). Set this in the `name` field of `SKILL.md`; the folder name has no dot (`.claude/skills/pw-test-chromium/`).
- Give new functions and ids clear names. The existing generic names (`myFunction`, `myForm`, ...) are on the TODO list to be renamed.
