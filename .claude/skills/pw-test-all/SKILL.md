---
name: .pw-test-all
description: Run all Playwright tests in all browsers - Chromium, Firefox and Safari (WebKit).
disable-model-invocation: true
---

Run from the repo root **in the background**, because all tests take about 8 minutes (the config starts `server.js` on its own):

```bash
PLAYWRIGHT_HTML_OPEN=never npm run pw-test -- --reporter=list,html
```

`PLAYWRIGHT_HTML_OPEN=never` keeps a failed run from opening the report and waiting. The report is still written, for `/.pw-report`.

Always run exactly this command, also if the user typed something after the skill's name: no spec file, `-g`, `--project` or other options. So all tests run in every browser of `playwright.config.js`. If the user typed something, say that it was ignored. Don't change files in `site/`, `playwright/`, `playwright.config.js` or `server.js`, or switch branches, while it runs.

When it is done, report:

- The counts, in total and per browser: passed, failed, skipped.
- Each failure with its browser, test title, `file:line` and the error in short. Say whether it fails in every browser or only in some.
- Tests marked `test.fail(true, 'Known bug: …')` are expected to fail and count as passed. If one passes unexpectedly, the bug may be fixed: say that its `test.fail` line can be removed.

If the run is stopped, say how far it got, and that this is not a result.

Don't change tests or code, or run `--update-snapshots`, only to make a run pass, unless the user asked for that.
