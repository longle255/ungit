const expect = require('expect.js');
const request = require('supertest');
const express = require('express');
const path = require('path');
const restGit = require('../source/git-api');
const common = require('./common-es6.js');

const app = express();
app.use(require('body-parser').json());
restGit.registerApi({ app: app, config: { dev: true } });

const req = request(app);
let testDir;
let lostSha;

describe('git-api reflog', () => {
  before(async () => {
    testDir = await common.initRepo(req);
    await common.post(req, '/testing/createfile', {
      path: testDir,
      file: path.join(testDir, 'one.txt'),
    });
    await common.post(req, '/commit', {
      path: testDir,
      message: 'one',
      files: [{ name: 'one.txt' }],
    });
    await common.post(req, '/testing/createfile', {
      path: testDir,
      file: path.join(testDir, 'two.txt'),
    });
    await common.post(req, '/commit', {
      path: testDir,
      message: 'two',
      files: [{ name: 'two.txt' }],
    });
    lostSha = (await common.get(req, '/head', { path: testDir }))[0].sha1;
    await common.post(req, '/testing/git', {
      path: testDir,
      command: ['reset', '--hard', 'HEAD~1'],
    });
  });

  after(() => common.post(req, '/testing/cleanup'));

  it('lists the lost commit newest first without duplicate SHAs', async () => {
    const res = await common.get(req, '/reflog', { path: testDir });
    expect(res.entries).to.be.an('array');
    expect(res.hasMore).to.be(false);

    const lost = res.entries.find((entry) => entry.sha1 === lostSha);
    expect(lost).to.be.ok();
    expect(lostSha.startsWith(lost.shortSha)).to.be(true);
    expect(lost.ref).to.be('HEAD');
    expect(lost.selector).to.contain('HEAD@{');
    expect(new Date(lost.reflogDate).toString()).not.to.be('Invalid Date');
    expect(lost.action).to.be('commit: two');
    expect(lost.subject).to.be('two');
    expect(lost.authorName).to.be.ok();

    const shas = res.entries.map((entry) => entry.sha1);
    expect(new Set(shas).size).to.be(shas.length);

    const firstCommit = res.entries.find((entry) => entry.subject === 'one');
    expect(firstCommit.action).to.be('reset: moving to HEAD~1');
  });

  it('pages through raw reflog entries', async () => {
    const first = await common.get(req, '/reflog', { path: testDir, limit: 1, skip: 0 });
    const second = await common.get(req, '/reflog', { path: testDir, limit: 1, skip: 1 });

    expect(first.hasMore).to.be(true);
    expect(first.entries.length).to.be(1);
    expect(second.entries.length).to.be(1);
    expect(second.entries[0].sha1).not.to.be(first.entries[0].sha1);
  });

  it('rejects invalid paging', async () => {
    const badLimit = await req
      .get(`${restGit.pathPrefix}/reflog`)
      .query({ path: testDir, limit: 0 })
      .expect(400);
    expect(badLimit.body.errorCode).to.be('invalid-limit');

    const badSkip = await req
      .get(`${restGit.pathPrefix}/reflog`)
      .query({ path: testDir, skip: -1 })
      .expect(400);
    expect(badSkip.body.errorCode).to.be('invalid-offset');

    const badNumber = await req
      .get(`${restGit.pathPrefix}/reflog`)
      .query({ path: testDir, limit: 'abc' })
      .expect(400);
    expect(badNumber.body.errorCode).to.be('invalid-paging');
  });

  it('returns an empty list for a repository without commits', async () => {
    const emptyDir = await common.initRepo(req);
    expect(await common.get(req, '/reflog', { path: emptyDir })).to.eql({
      entries: [],
      hasMore: false,
    });
  });

  it('still lists entries when HEAD is detached', async () => {
    await common.post(req, '/checkout', { path: testDir, name: lostSha });
    const res = await common.get(req, '/reflog', { path: testDir });
    expect(res.entries.some((entry) => entry.sha1 === lostSha)).to.be(true);
  });

  it('creates a branch at a reflog SHA through the existing endpoint', async () => {
    await common.post(req, '/branches', {
      path: testDir,
      name: 'recovered/lost',
      sha1: lostSha,
    });
    const rev = await common.post(req, '/testing/git', {
      path: testDir,
      command: ['rev-parse', 'recovered/lost'],
    });
    expect(rev.trim()).to.be(lostSha);

    const collision = await req
      .post(`${restGit.pathPrefix}/branches`)
      .send({ path: testDir, name: 'recovered/lost', sha1: lostSha })
      .expect(400);
    expect(collision.body.error).to.contain('already exists');
  });
});
