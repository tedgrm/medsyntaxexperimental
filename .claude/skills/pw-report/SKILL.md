---
name: pw-report
description: Open the HTML report of the last Playwright run.
disable-model-invocation: true
---

If `playwright-report/index.html` does not exist, tell the user to run `/pw-test` first and stop.

Otherwise run from the repo root **in the background**, because it serves the report until stopped:

```bash
npx playwright show-report
```

Give the user the URL it prints. If the port is already in use, an earlier report server is probably still running: open `http://localhost:9323`, or use `--port=<other>`.
