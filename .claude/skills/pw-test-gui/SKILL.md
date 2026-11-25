---
name: pw-test-gui
description: Open Playwright UI mode to pick, run and inspect tests.
argument-hint: "[spec file] [-g pattern]"
disable-model-invocation: true
---

Run from the repo root **in the background**, because it runs until the user closes the window (the config starts `server.js` on its own):

```bash
npm run pw-test-gui -- $ARGUMENTS
```

Tell the user that UI mode is open. If it stops right away, show the error.
