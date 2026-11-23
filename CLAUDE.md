# CLAUDE.md

Medsyntax is a syntax assistant for (medical) search-engine queries, with a scope-driven editor. It is a plain static site (HTML + inline JS + jQuery), with no build step and no framework. It is deployed to GitHub Pages by `.github/workflows/static.yml`.

See `FEATURES.md` for the feature list and the TODO list. Keep it up to date when you add or finish features.

## Layout

- `index.html`: the main Medsyntax app. Most of the logic is in inline `<script>` blocks: parsing and rendering (`syntaxCheck`), warnings, the scope editor (`setEditMode`, dynamic input), URL sharing (`updateUrl`, `getParameterByName`) and copy buttons.
- `style.css`, `iframe.css`: styles for the main app.
- `workspace/`: MedsyntaxQA (Query Augmentation), an experimental v0.1. It embeds several copies of `../index.html?ws=<n>&...` in iframes and loads `../scripts/...`, so it must be served from the **repo root**, not from `workspace/` on its own.
- `scripts/`: client-side scripts loaded by the pages.
  - `third-party/`: vendored libraries: `lzstring.js` (MIT) and `iframe-resizer/` (GPLv3). **Read-only.** See Conventions.
  - `key-commands.js` is our own (a keyboard-handling stub that uses the global `editMode`).
- `server.js`: a static dev server with no dependencies. It serves the repo root on `PORT` (default 8080).
- `playwright/`: end-to-end tests. `playwright.config.js` starts `server.js`, sets `baseURL` to `http://127.0.0.1:8080`, and starts every browser at a **1920x1080** viewport (set after each device preset, which has its own size). Keep that default. Only resize inside a test when the test is about another screen size.
  - `editor.spec.ts`: EDITOR behaviour. `editor-layout.spec.ts`: EDITOR layout (structure checks plus screenshot comparisons).
  - `editor-layout.spec.ts-snapshots/`: screenshot baselines, one per browser and OS (`-darwin`). After an intended layout change, refresh them with `npx playwright test editor-layout --update-snapshots`, look at the new images, and commit them.
- `product-development/`: product development resources (research, roadmap, designs, feedback). Not part of the site's code. See its `README.md`.

## The two `index.html` files

There are two pages, both called `index.html`. Each has a short identifier. Use it in chat, plans, commit messages and docs instead of a bare "index.html":

- **EDITOR**: the Medsyntax query editor, `index.html` at the repo root
- **WORKSPACE**: the MedsyntaxQA workspace, `workspace/index.html`. It holds a list of EDITORs. A single EDITOR embedded in the WORKSPACE is an **item** (as in the code: `addItemAfter`, `removeThisItem`, `li_item_<n>`).

If the user just says "index.html", ask which one they mean, unless the context makes it clear.

| | EDITOR (Medsyntax app) | WORKSPACE (MedsyntaxQA workspace) |
|---|---|---|
| File | `index.html` (repo root) | `workspace/index.html` |
| `<title>` | `Medsyntax` | `MedsyntaxQA` |
| URL (dev) | http://127.0.0.1:8080/index.html | http://127.0.0.1:8080/workspace/ |
| Styles | `style.css`, plus `iframe.css` when embedded | `workspace/style.css` |
| Version | 1.0 (`README.md`) | 0.1, experimental (`workspace/README.md`) |
| Role | Edits **one** query: input, syntax visualisation, warnings, scope editor, copy and share | Holds a **list** of Medsyntax apps, each in its own iframe, with Add/Remove buttons |

**How they work together:**
- The workspace builds each list item as `<iframe id="page_is_fresh_<n>" src="../index.html?ws=<n>&...">` (`queryFunction`). Each item gets a random coloured border and is sized with iframe-resizer.
- The app detects workspace mode from the `ws` URL parameter. In that mode it adds the `ws-iframe-body` class and sends messages to the parent with `window.parent.postMessage`:
  - `updateUrl`: payload `"<n>%index%<app query string without ws>"`. The workspace stores it in its own URL as `<n padded to 9 digits>iframequery`, compressed with LZString.
  - `setEditMode`: payload `true`/`false`. The workspace stores it in its global `editMode`, which `scripts/key-commands.js` reads.
- The workspace only accepts messages from its own origin, so both pages must be served from the same server.
- When the workspace loads, it rebuilds the list from its `…iframequery` parameters. If there are none, it starts with three empty apps.

**When editing:**
- A change to the root `index.html` affects both the stand-alone app and every workspace item. Test both.
- If you change the message types or payload formats, update both files together.
- When opened without `ws`, the app must keep working on its own.

## Commands

- `npm start`: serve the site at http://127.0.0.1:8080/ (workspace: `/workspace/`)
- `npm run pw-test`: run all Playwright tests (Chromium, Firefox, WebKit). The server starts on its own.
- `npm run pw-test-gui`: Playwright UI mode
- `npm run pw-test-ui`: headed run (browser windows visible)
- `npm run pw-codegen`: record a new test
- `npx playwright show-report`: open the last HTML report

Run `npm run pw-test` after changing `index.html`, `workspace/` or `scripts/`, and make sure everything passes in all three browsers.

## Conventions

- **Never edit, reformat, rename or delete anything in `scripts/third-party/`.** These are unmodified upstream copies, kept for licensing and attribution. If one needs a fix or an upgrade, stop and ask the user. Put our own code in `scripts/` (outside `third-party/`) and wrap or extend the library from there.
- Keep the site static: no bundler, no framework, and no new runtime dependencies unless asked. jQuery 3.6 comes from the CDN.
- Scripts are loaded with relative paths (`scripts/...` from the root, `../scripts/...` from `workspace/`). Keep pages working when served from the repo root and on GitHub Pages under a sub-path, so never use absolute `/` URLs.
- Shareable state (query, title, workspace items) lives in the URL query string, compressed with LZString. Changes must keep existing links loading.
- In tests, navigate with relative paths (`page.goto('/index.html')`, `page.goto('/workspace/')`) so they use `baseURL`. Don't use `file://` URLs. Prefer role, text and id locators (`#medsyntax`, `#dynamic-input`, `#query-input1`).
- Give new functions and ids clear names. The existing generic names (`myFunction`, `myForm`, ...) are on the TODO list to be renamed.
