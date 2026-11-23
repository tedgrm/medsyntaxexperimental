# Test fixtures

Inputs for the Playwright tests, copied from the read-only source documents in `product-development/external documents/`. Tests read these copies, not the originals.

| File | Source | Used by |
|---|---|---|
| `embase-query.txt` | `embase string example.xlsx`, sheet "string", cell B3: an Embase.com search as one string (191 results on 18/06/2026) | `editor.spec.ts`, "EDITOR with an Embase query" |

Keep each fixture byte-for-byte identical to its source (UTF-8, no trailing newline). If the source document changes, copy it again and re-run the tests.
