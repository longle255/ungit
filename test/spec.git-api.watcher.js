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

const req = request(app);

describe('git-api watcher', function () {
  this.timeout(10000);

  before(async () => {
    const rawDir = await common.createSmallRepo(req);
    testDir = fs.realpathSync(rawDir);
  });

  after(() => common.post(req, '/testing/cleanup'));

  it('should not emit events for pre-existing files on watch start', async () => {
    const RepoWatcher = restGit._RepoWatcher;
    expect(RepoWatcher).to.be.ok();

    const watcher = new RepoWatcher();
    const emittedEvents = [];
    watcher.on('workdir', (filePath) => emittedEvents.push(filePath));

    await watcher.addWorkdir(testDir);

    // Wait a brief period to ensure no initial crawl events fire
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(emittedEvents.length).to.be(0);

    // Now modify/add a new file and ensure it is caught
    const newFilePath = path.join(testDir, 'watcher-test.txt');
    await fs.promises.writeFile(newFilePath, 'watcher test content');

    // Wait for chokidar event
    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (emittedEvents.length > 0) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(interval);
        resolve();
      }, 2000);
    });

    expect(emittedEvents.length).to.be.above(0);
    watcher.close();
  });
});
