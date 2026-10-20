# Performance harness

- `node scripts/performance/run-backend.js --label baseline --out performance/results/baseline.json`
- `node scripts/performance/run-browser.js --out performance/results/browser-baseline.json`

Both runners generate a temporary fixture with the same dimensions unless `--repo` is supplied. The browser runner handles the too-many-files warning and records route-to-interactive time. Record machine, Node version, Git version, fixture dimensions, and whether the server was warm.
Do not compare runs made with different fixture dimensions.

The browser probe reports `heapBytes` only when the browser exposes the Chrome-only `performance.memory` API; it is `null` otherwise.

## Recorded runs

Both recorded runs used Node v24.18.0, Git 2.55.0, and macOS 27.0.0 on an Apple M5 Max (18 CPUs, 128 GiB RAM), with the default fixture dimensions: 10,000 commits, 2,500 staged files, 2,500 unstaged files, 2,500 untracked files, and a 5 MiB text file (`largeDiffBytes: 5242880`). The backend runner exercises an in-process Express app after the fixture is created, so no request is timed against a cold server. Do not compare runs made with different fixture dimensions.

| Measurement | Baseline | After |
| --- | --- | --- |
| `status-page-1` (`limit=50`, `offset=0`) | 131 ms, 1,807,011 B | 46 ms, 11,898 B |
| `status-page-2` (`limit=50`, `offset=50`) | 111 ms, 1,807,011 B | 30 ms, 11,937 B |
| `gitlog-page-1` (`limit=25`, `skip=0`) | 13 ms, 364,576 B | 13 ms, 364,630 B |
| `gitlog-page-2` (`limit=25`, `skip=25`) | 8 ms, 10,177 B | 8 ms, 10,231 B |
| `diff-large` / `diff-bounded` (see note) | 138 ms, 5,243,056 B, HTTP 200 | 35 ms, 89 B, HTTP 400 |
| Browser: route to interactive | 2,806 ms | 1,459 ms |
| Browser: DOM nodes | 160,239 | 3,771 |
| Browser: file rows | 7,501 | 50 |
| Browser: long tasks | 871 ms, 5,065 ms | none |
| Browser: heap bytes | 217,072,318 | 35,585,452 |

`diff-large` and `diff-bounded` are different measurements, not a renamed time series: before the change the request returned the full 5 MiB diff (HTTP 200); after the change the same request is rejected at the configured diff limit (HTTP 400) unless the user explicitly loads the full diff. Likewise, the baseline status route ignored `limit` and returned the entire working tree; the after run honors the requested page.

