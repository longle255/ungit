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

  it('should include common heavy and virtual environment directories in defaultIgnoredDirNames', () => {
    const ignored = restGit._defaultIgnoredDirNames;
    expect(ignored).to.be.ok();
    expect(ignored.has('.git')).to.be(true);
    expect(ignored.has('node_modules')).to.be(true);
    expect(ignored.has('.venv')).to.be(true);
    expect(ignored.has('venv')).to.be(true);
    expect(ignored.has('__pycache__')).to.be(true);
    expect(ignored.has('.build')).to.be(true);
    expect(ignored.has('target')).to.be(true);
  });

  it('should load nested .gitignore rules with directory prefixes', async () => {
    const subDir = path.join(testDir, 'subpackage');
    await fs.promises.mkdir(subDir, { recursive: true });
    await fs.promises.writeFile(path.join(subDir, '.gitignore'), 'ignored-sub/\n*.subtmp\n');

    const ig = await restGit._readIgnore(testDir);
    expect(ig.ignores('subpackage/ignored-sub/file.txt')).to.be(true);
    expect(ig.ignores('subpackage/test.subtmp')).to.be(true);
    expect(ig.ignores('subpackage/valid-file.txt')).to.be(false);
  });

  it('reloads a nested ignore file without walking the tree', async () => {
    let finds = 0;
    await fs.promises.mkdir(path.join(testDir, 'subpackage'), { recursive: true });
    const index = new restGit._GitIgnoreIndex(testDir, path.join(testDir, '.git'), async () => {
      finds += 1;
      return [{ relDir: 'subpackage', fullPath: path.join(testDir, 'subpackage', '.gitignore') }];
    });
    await index.load();
    const afterLoad = finds;
    await fs.promises.writeFile(
      path.join(testDir, 'subpackage', '.gitignore'),
      'ignored-sub/\n*.newsubtmp\n'
    );
    await index.reload(path.join(testDir, 'subpackage', '.gitignore'));
    expect(finds).to.be(afterLoad);
    expect(index.matcher.ignores('subpackage/new.newsubtmp')).to.be(true);
  });
});
