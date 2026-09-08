const expect = require('expect.js');
const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');
const restGit = require('../source/git-api');
const common = require('./common-es6.js');

const app = express();
app.use(require('body-parser').json());

restGit.registerApi({ app: app, config: { dev: true } });

let testDir;
let worktreeDir;

const req = request(app);

describe('git-api worktrees', function () {
  this.timeout(10000);

  before(async () => {
    const rawDir = await common.createSmallRepo(req);
    testDir = fs.realpathSync(rawDir);
    worktreeDir = `${testDir}-worktree`;
  });

  after(() => common.post(req, '/testing/cleanup'));

  it('should list main repo worktree initially', async () => {
    const res = await common.get(req, '/worktrees', { path: testDir });
    expect(res.length).to.be(1);
    expect(res[0].status).to.be('clean');
    expect(restGit._worktreeStatusCache.size).to.be.above(0);
  });

  it('should create a new worktree', async () => {
    const res = await common.post(req, '/worktrees', {
      path: testDir,
      worktreePath: worktreeDir,
      branch: 'feature-worktree',
      createBranch: true,
    });
    expect(res).to.be.ok();
    expect(res.path).to.be(worktreeDir);
  });

  it('should cache worktree status and reuse in-flight requests', async () => {
    const [res1, res2] = await Promise.all([
      common.get(req, '/worktrees', { path: testDir }),
      common.get(req, '/worktrees', { path: testDir }),
    ]);

    expect(res1.length).to.be(2);
    expect(res2.length).to.be(2);
    expect(res1[0].status).to.be('clean');
    expect(res1[1].status).to.be('clean');
    expect(res1).to.eql(res2);
  });

  it('should invalidate cache when file changes in worktree', async () => {
    await common.post(req, '/testing/createfile', {
      file: path.join(worktreeDir, 'dirty.txt'),
      content: 'dirty content',
    });

    // Invalidate worktree path cache
    restGit._invalidateWorktreeStatus(worktreeDir);

    const res = await common.get(req, '/worktrees', { path: testDir });
    const wt = res.find((w) => w.path === worktreeDir);
    expect(wt).to.be.ok();
    expect(wt.status).to.be('dirty');
  });

  it('should remove worktree and invalidate cache', async () => {
    await common.delete(req, '/worktrees', {
      path: testDir,
      worktreePath: worktreeDir,
      force: 'true',
    });

    const res = await common.get(req, '/worktrees', { path: testDir });
    expect(res.length).to.be(1);
  });
});
