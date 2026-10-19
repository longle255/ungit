'use strict';
const expect = require('expect.js');
const environment = require('./environment')({
  serverStartupOptions: ['--numberOfNodesPerLoad=10'],
});
const testRepoPaths = [];

describe('[GRAPH PAGING]', () => {
  before('Environment init', async () => {
    await environment.init();
    await environment.createRepos(testRepoPaths, [{ bare: false, initCommits: 35 }]);
  });

  after('Environment stop', () => environment.shutdown());

  it('opens the repository', () => environment.openUngit(testRepoPaths[0]));

  it('appends without duplicate nodes', async () => {
    const initial = await environment.page.$$eval('.nodeContainer', (els) => els.length);
    await environment.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await environment.page.waitForFunction(
      (count) => document.querySelectorAll('.nodeContainer').length > count,
      {},
      initial
    );
    const titles = await environment.page.$$eval('.nodeContainer', (els) =>
      els.map((el) => el.getAttribute('data-ta-node-title'))
    );
    expect(new Set(titles).size).to.be(titles.length);
  });
});
