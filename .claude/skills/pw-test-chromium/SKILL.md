---
name: .pw-test-chromium
description: Run the Playwright tests (all, or a file / -g pattern) in Chromium only. Use after changing the EDITOR, the WORKSPACE, site/scripts/ or tests, or when asked to run the tests.
argument-hint: "[spec file] [-g pattern] [other playwright options]"
---

Run from the repo root (the config starts `server.js` on its own):

```bash
PLAYWRIGHT_HTML_OPEN=never npm run pw-test -- --reporter=list,html --project=chromium $ARGUMENTS
```

`PLAYWRIGHT_HTML_OPEN=never` keeps a failed run from opening the report and waiting. The report is still written, for `/.pw-report`.

This is for Chromium only. If the user asked for other browsers, or this is the run before a commit (`CLAUDE.md`), use `npm run pw-test` as in `/.pw-test-all` instead.

Then report:

- The counts: passed, failed, skipped.
- Each failure with its test title, `file:line` and the error in short.
- Tests marked `test.fail(true, 'Known bug: …')` are expected to fail and count as passed. If one passes unexpectedly, the bug may be fixed: say that its `test.fail` line can be removed.

Don't change tests or code, or run `--update-snapshots`, only to make a run pass, unless the user asked for that.
