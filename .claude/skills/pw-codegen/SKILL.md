---
name: .pw-codegen
description: Record a new Playwright test by clicking through the EDITOR or the WORKSPACE.
argument-hint: "[path, e.g. index.html or workspace/]"
disable-model-invocation: true
---

Path to record, from the user: `$ARGUMENTS`. If empty, use `index.html` (the EDITOR). The WORKSPACE is `workspace/`.

1. Codegen does not start the server. If `curl -sf -o /dev/null http://127.0.0.1:8080/index.html` fails, run `npm start` in the background first.
2. Run from the repo root **in the background**, because it runs until the user closes the browser. Replace `<path>`, and keep the quotes:

   ```bash
   mkdir -p test-results && npm run pw-codegen -- -b webkit --viewport-size=1920,1080 -o test-results/codegen-recording.ts "http://127.0.0.1:8080/<path>"
   ```

3. Tell the user to click through the steps and then close the browser. The recording is saved in `test-results/codegen-recording.ts`, which git ignores and the next test run clears.
4. When the browser is closed, show the recording and stop the server if step 1 started it.

Only add it to `playwright/` if the user asks. Then adapt it to the conventions in `CLAUDE.md`: `page.goto` with a relative path, the helpers from `playwright/helpers.ts`, and the spec file that fits.
