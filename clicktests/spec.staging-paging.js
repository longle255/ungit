'use strict';
const expect = require('expect.js');
const fs = require('fs');
const path = require('path');
const environment = require('./environment')();
const testRepoPaths = [];

describe('[STAGING PAGING]', () => {
  before('Environment init', async () => {
    await environment.init();
    await environment.createRepos(testRepoPaths, [
      { bare: false, initCommits: 1 },
      { bare: false, initCommits: 1 },
    ]);
    for (let i = 0; i < 60; i += 1) {
      fs.writeFileSync(path.join(testRepoPaths[0], `paged-${i}.txt`), `file ${i}\n`);
      fs.writeFileSync(path.join(testRepoPaths[1], `other-${i}.txt`), `file ${i}\n`);
    }
  });

  after('Environment stop', () => environment.shutdown());

  it('opens the repository and continues past the large-change warning', async () => {
    await environment.openUngit(testRepoPaths[0]);
    await environment.waitForElementVisible('[data-ta-action="loadAnyway"]');
    await environment.click('[data-ta-action="loadAnyway"]');
    await environment.waitForElementVisible('.files .file');
  });

  it('shows 50 files, then loads the remaining 10', async () => {
    expect(await environment.page.$$eval('.files .file', (els) => els.length)).to.be(50);
    await environment.waitForElementVisible('.load-more-files');
    await environment.click('.load-more-files');
    await environment.page.waitForFunction(
      () => document.querySelectorAll('.files .file').length === 60
    );
    expect(await environment.page.$eval('.file-paging', (el) => el.textContent)).to.contain('60');
  });

  it('resets to the first page when a refresh arrives after load more', async () => {
    await environment.backgroundAction('POST', '/api/testing/changefile', {
      path: testRepoPaths[0],
      file: path.join(testRepoPaths[0], 'paged-59.txt'),
    });
    await environment.ensureRedraw();
    await environment.page.waitForFunction(
      () => document.querySelectorAll('.files .file').length === 50
    );
    expect(await environment.page.$$eval('.files .file', (els) => els.length)).to.be(50);
  });

  it('creates exactly one diff after a file is expanded', async () => {
    let diffRequests = 0;
    const onRequest = (req) => {
      if (req.url().includes('/api/diff')) diffRequests += 1;
    };
    environment.page.on('request', onRequest);
    expect(await environment.page.$$eval('.diffContainer', (els) => els.length)).to.be(0);
    await environment.click('.files .file .name');
    await environment.waitForElementVisible('.diffContainer');
    environment.page.off('request', onRequest);
    expect(diffRequests).to.be(1);
  });

  it('shows only the newly selected repository after rapid navigation', async () => {
    await environment.openUngit(testRepoPaths[0]);
    await environment.openUngit(testRepoPaths[1]);
    await environment.waitForElementVisible('[data-ta-action="loadAnyway"]');
    await environment.click('[data-ta-action="loadAnyway"]');
    await environment.waitForElementVisible('.files .file');
    const names = await environment.page.$$eval('.files .file .name', (els) =>
      els.map((el) => el.textContent.trim())
    );
    expect(names.every((name) => name.startsWith('other-'))).to.be(true);
  });

  it('commits unloaded pages when toggle all is used', async () => {
    await environment.openUngit(testRepoPaths[1]);
    // The warning was already dismissed for this repository in an earlier test,
    // so only click through it if it shows up again.
    await environment.page.waitForSelector('.files .file, [data-ta-action="loadAnyway"]', {
      visible: true,
    });
    if (await environment.page.$('[data-ta-action="loadAnyway"]')) {
      await environment.click('[data-ta-action="loadAnyway"]');
    }
    await environment.waitForElementVisible('.files .file');
    expect(await environment.page.$$eval('.files .file', (els) => els.length)).to.be(50);
    await environment.click('.toggle-all-files');
    await environment.commit('commit all');
    const status = await environment.backgroundAction('GET', '/api/status', {
      path: testRepoPaths[1],
      limit: 50,
    });
    expect(status.total).to.be(0);
  });
});
