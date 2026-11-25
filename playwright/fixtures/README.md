# Test fixtures

Inputs for the Playwright tests, copied from the read-only source documents in `product-development/external documents/`. Tests read these copies, not the originals.

Each fixture is a JSON file with two fields:

- `source`: where the copy came from (`file`, `sheet`, `cell`) plus context such as the database, result count and date.
- `query`: the copied text, exactly as in the source.

| File | Source | Used by |
|---|---|---|
| `embase-query.json` | `embase string example.xlsx`, sheet "string", cell B3: an Embase.com search as one string (191 results on 2026-06-18) | `editor.spec.ts`, "EDITOR with an Embase query" |

Keep `query` identical to its source. If the source document changes, copy it again, update `source`, and re-run the tests.
