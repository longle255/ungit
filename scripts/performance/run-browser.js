/* global window, document */
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { createPerformanceRepo } = require('./fixtures');

async function main() {
  const Environment = require('../../clicktests/environment');
  const args = process.argv.slice(2);
  const repoIndex = args.indexOf('--repo');
  const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
  const fixture =
    repoIndex >= 0
      ? { repoPath: args[repoIndex + 1], counts: { reused: true }, cleanup: async () => {} }
      : await createPerformanceRepo({
          commits: 10000,
          stagedFiles: 2500,
          unstagedFiles: 2500,
          untrackedFiles: 2500,
          largeDiffBytes: 5 * 1024 * 1024,
        });
  const repoPath = fixture.repoPath;
  const env = Environment({ serverStartupOptions: ['--numberOfNodesPerLoad=25'] });

  await env.init();
  try {
    const pages = await env.browser.pages();
    env.page = pages[0];
    await env.page.evaluateOnNewDocument(() => {
      window.__ungitLongTasks = [];
      if (window.PerformanceObserver) {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) window.__ungitLongTasks.push(entry.duration);
        }).observe({ entryTypes: ['longtask'] });
      }
    });

    const started = Date.now();
    await env.openUngit(repoPath);
    const routeToInteractiveMs = Date.now() - started;
    const loadAnyway = await env.page
      .waitForSelector('[data-ta-action="loadAnyway"]', { visible: true, timeout: 5000 })
      .catch(() => null);
    if (loadAnyway) {
      await loadAnyway.click();
      await env.page.waitForNetworkIdle();
    }
    await env.page.waitForNetworkIdle();
    const snapshot = await env.page.evaluate(() => ({
      domNodes: document.querySelectorAll('*').length,
      graphNodes: document.querySelectorAll('.nodeContainer').length,
      fileRows: document.querySelectorAll('.files .file').length,
      longTasks: window.__ungitLongTasks || [],
      heapBytes: performance.memory ? performance.memory.usedJSHeapSize : null,
    }));

    const report = {
      timestamp: new Date().toISOString(),
      node: process.version,
      git: execFileSync('git', ['--version'], { encoding: 'utf8' }).trim(),
      machine: {
        hostname: os.hostname(),
        platform: os.platform(),
        release: os.release(),
        cpus: os.cpus().length,
        cpuModel: os.cpus()[0] ? os.cpus()[0].model : null,
        totalMemBytes: os.totalmem(),
      },
      repo: repoPath,
      fixture: fixture.counts,
      routeToInteractiveMs,
      snapshot,
    };
    if (out) {
      await fs.mkdir(path.dirname(out), { recursive: true });
      await fs.writeFile(out, JSON.stringify(report, null, 2));
    }
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await env.shutdown();
    await fixture.cleanup();
  }
}

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('usage: node scripts/performance/run-browser.js [--repo <path>] [--out <file>]');
} else {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
