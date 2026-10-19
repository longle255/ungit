# Performance harness

- `node scripts/performance/run-backend.js --label baseline --out performance/results/baseline.json`
- `node scripts/performance/run-browser.js --out performance/results/browser-baseline.json`

Both runners generate a temporary fixture with the same dimensions unless `--repo` is supplied. The browser runner handles the too-many-files warning and records route-to-interactive time. Record machine, Node version, Git version, fixture dimensions, and whether the server was warm.
Do not compare runs made with different fixture dimensions.

The browser probe reports `heapBytes` only when the browser exposes the Chrome-only `performance.memory` API; it is `null` otherwise.
