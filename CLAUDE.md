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
- `playwright/`: end-to-end tests. `playwright.config.js` starts `server.js` and sets `baseURL` to `http://127.0.0.1:8080`.

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
