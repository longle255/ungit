const expect = require('expect.js');
const request = require('supertest');
const express = require('express');
const path = require('path');
const restGit = require('../source/git-api');
const common = require('./common-es6.js');

const app = express();
app.use(require('body-parser').json());

restGit.registerApi({ app: app, config: { dev: true } });

let testDir;

const req = request(app);

describe('git-api conflict rebase', function () {
  const testFile1 = 'testfile1.txt';

  before(() => {
    return common
      .createSmallRepo(req)
      .then((dir) => {
        testDir = dir;
      })
      .then(() => common.post(req, '/testing/createfile', { file: path.join(testDir, testFile1) }));
  });

  after(() => common.post(req, '/testing/cleanup'));

  it('should be possible to stash', () => common.post(req, '/stashes', { path: testDir }));

  it('stashes should list the stashed item', () => {
    return common.get(req, '/stashes', { path: testDir }).then((res) => {
      expect(res.length).to.be(1);
      expect(res[0].reflogId).to.be('0');
      expect(res[0].reflogName).to.be('stash@{0}');
      const stashedFile = res[0].fileLineDiffs.find(
        (fileLineDiff) => fileLineDiff.fileName == testFile1
      );
      expect(stashedFile).to.be.ok();
      expect(stashedFile.isNew).to.be(true);
      expect(stashedFile.sha1).to.be.ok();
    });
  });

  it('should show the stashed new file diff', () => {
    return common
      .get(req, '/stashes', { path: testDir })
      .then((res) => {
        const stashedFile = res[0].fileLineDiffs.find(
          (fileLineDiff) => fileLineDiff.fileName == testFile1
        );
        return common.get(req, '/diff', {
          path: testDir,
          file: testFile1,
          sha1: stashedFile.sha1,
        });
      })
      .then((res) => {
        expect(res.indexOf(`diff --git a/${testFile1} b/${testFile1}`)).to.be.above(-1);
      });
  });

  it('should be possible to drop stash', () => {
    return common.delete(req, '/stashes/0', { path: testDir });
  });
});
