'use strict';
const expect = require('expect.js');
const child_process = require('child_process');
const environment = require('./environment')();
const testRepoPaths = [];

const git = (repoPath, args) =>
  child_process.execFileSync('git', args, { cwd: repoPath, encoding: 'utf8' }).trim();

describe('[REFLOG]', () => {
  let lostSha;

  before('Environment init', async () => {
    await environment.init();
    await environment.createRepos(testRepoPaths, [{ bare: false }]);
  });

  after('Environment stop', () => environment.shutdown());

  it('Open path screen', () => environment.openUngit(testRepoPaths[0]));

  it('creates a lost commit', async () => {
    await environment.createTestFile(`${testRepoPaths[0]}/one.txt`, testRepoPaths[0]);
    await environment.commit('one');
    await environment.createTestFile(`${testRepoPaths[0]}/two.txt`, testRepoPaths[0]);
    await environment.commit('two');
    lostSha = git(testRepoPaths[0], ['rev-parse', 'HEAD']);
    git(testRepoPaths[0], ['reset', '--hard', 'HEAD~1']);
    expect(git(testRepoPaths[0], ['cat-file', '-t', lostSha])).to.be('commit');
    await environment.ensureRedraw();
  });

  it('shows the tools menu', async () => {
    await environment.click('.tools .dropdown-toggle');
    await environment.waitForElementVisible('[data-ta-action="open-reflog"]');
    await environment.click('.tools .dropdown-toggle');
    await environment.waitForElementHidden('[data-ta-action="open-reflog"]');
  });
});
