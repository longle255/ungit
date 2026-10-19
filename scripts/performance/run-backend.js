const express = require('express');
const request = require('supertest');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const restGit = require('../../source/git-api');
const metrics = require('../../source/git-metrics');
const { createPerformanceRepo } = require('./fixtures');

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log(
      'usage: node scripts/performance/run-backend.js [--repo <path>] [--label <name>] [--out <file>]'
    );
    return;
  }

  const app = express();
  app.use(require('body-parser').json());
  restGit.registerApi({ app, config: { dev: true } });
  const req = request(app);
  const prefix = restGit.pathPrefix || '';
  const repoIndex = args.indexOf('--repo');
  const fixture =
    repoIndex >= 0
      ? {
          repoPath: args[repoIndex + 1],
          counts: { reused: true },
          cleanup: async () => {},
        }
      : await createPerformanceRepo({
          commits: 10000,
          stagedFiles: 2500,
          unstagedFiles: 2500,
          untrackedFiles: 2500,
          largeDiffBytes: 5 * 1024 * 1024,
        });

  try {
    const timed = async (name, fn) => {
      metrics.reset();
      const started = Date.now();
      const response = await fn();
      return {
        name,
        wallMs: Date.now() - started,
        status: response.status,
        bodyBytes: Buffer.byteLength(JSON.stringify(response.body || {})),
        metrics: metrics.snapshot(),
      };
    };

    const results = [];
    results.push(
      await timed('status-page-1', () =>
        req.get(`${prefix}/status`).query({ path: fixture.repoPath, limit: 50, offset: 0 })
      )
    );
    results.push(
      await timed('status-page-2', () =>
        req.get(`${prefix}/status`).query({ path: fixture.repoPath, limit: 50, offset: 50 })
      )
    );
    results.push(
      await timed('gitlog-page-1', () =>
        req.get(`${prefix}/gitlog`).query({ path: fixture.repoPath, limit: 25, skip: 0 })
      )
    );
    results.push(
      await timed('gitlog-page-2', () =>
        req.get(`${prefix}/gitlog`).query({ path: fixture.repoPath, limit: 25, skip: 25 })
      )
    );
    results.push(
      await timed('diff-large', () =>
        req.get(`${prefix}/diff`).query({ path: fixture.repoPath, file: 'large-diff.txt' })
      )
    );

    const labelIndex = args.indexOf('--label');
    const label = labelIndex >= 0 ? args[labelIndex + 1] : null;
    const report = {
      timestamp: new Date().toISOString(),
      label,
      node: process.version,
      git: require('child_process').execFileSync('git', ['--version'], { encoding: 'utf8' }).trim(),
      machine: {
        hostname: os.hostname(),
        platform: os.platform(),
        release: os.release(),
        cpus: os.cpus().length,
        cpuModel: os.cpus()[0] ? os.cpus()[0].model : null,
        totalMemBytes: os.totalmem(),
      },
      fixture: fixture.counts,
      results,
    };

    const outIndex = args.indexOf('--out');
    const out = outIndex >= 0 ? args[outIndex + 1] : null;
    if (out) {
      await fs.mkdir(path.dirname(out), { recursive: true });
      await fs.writeFile(out, JSON.stringify(report, null, 2));
    }
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await fixture.cleanup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
