const expect = require('expect.js');
const request = require('supertest');
const express = require('express');
const fs = require('fs');
const restGit = require('../source/git-api');
const common = require('./common-es6.js');

const app = express();
app.use(require('body-parser').json());

restGit.registerApi({ app: app, config: { dev: true } });

let testDir;

const req = request(app);

describe('git-api refs', function () {
  this.timeout(10000);

  before(async () => {
    const rawDir = await common.createSmallRepo(req);
    testDir = fs.realpathSync(rawDir);
  });

  after(() => common.post(req, '/testing/cleanup'));

  it('should list refs for repository', async () => {
    const res = await common.get(req, '/refs', { path: testDir });
    expect(res).to.be.an('array');
    expect(res.length).to.be.above(0);
    expect(res[0].name).to.be.ok();
    expect(res[0].sha1).to.be.ok();
  });

  it('should reuse in-flight requests for concurrent calls', async () => {
    const [res1, res2] = await Promise.all([
      common.get(req, '/refs', { path: testDir }),
      common.get(req, '/refs', { path: testDir }),
    ]);

    expect(res1).to.eql(res2);
    expect(res1.length).to.be.above(0);
  });

  it('should record remote fetch timestamp and enforce cooldown', async () => {
    await common.get(req, '/refs', { path: testDir, remoteFetch: 'true' });
    const normalized = testDir.replace(/\\/g, '/');
    const firstFetchTime = restGit._lastRemoteFetchTime.get(normalized);
    expect(firstFetchTime).to.be.ok();

    // Immediate second call should be within cooldown window
    await common.get(req, '/refs', { path: testDir, remoteFetch: 'true' });
    const secondFetchTime = restGit._lastRemoteFetchTime.get(normalized);
    expect(secondFetchTime).to.be(firstFetchTime);
  });
});
