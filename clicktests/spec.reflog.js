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

  it('opens the reflog modal and lists the lost commit', async () => {
    await environment.click('.tools .dropdown-toggle');
    await environment.click('[data-ta-action="open-reflog"]');
    await environment.waitForElementVisible('[data-ta-container="reflog-modal"]');
    await environment.waitForElementVisible(`[data-ta-reflog-entry="${lostSha}"]`);
  });

  it('selects an entry and prefills a branch name', async () => {
    await environment.click(`[data-ta-reflog-entry="${lostSha}"]`);
    const branchName = await environment.page.$eval(
      '[data-ta-reflog-branch-name]',
      (element) => element.value
    );
    expect(branchName.startsWith('recovered/')).to.be(true);
    expect(lostSha.startsWith(branchName.replace('recovered/', ''))).to.be(true);
  });

  it('filters entries', async () => {
    await environment.insert('[data-ta-reflog-filter]', 'no-such-entry');
    await environment.waitForElementHidden(`[data-ta-reflog-entry="${lostSha}"]`);
    await environment.insert('[data-ta-reflog-filter]', 'two');
    await environment.waitForElementVisible(`[data-ta-reflog-entry="${lostSha}"]`);
  });

  it('closes the reflog modal', async () => {
    await environment.click('[data-ta-reflog-cancel]');
    await environment.waitForElementHidden('[data-ta-container="reflog-modal"]');
  });

  it('recovers the lost commit on a new branch', async () => {
    await environment.click('.tools .dropdown-toggle');
    await environment.click('[data-ta-action="open-reflog"]');
    await environment.waitForElementVisible('[data-ta-container="reflog-modal"]');
    await environment.click(`[data-ta-reflog-entry="${lostSha}"]`);
    const branchName = await environment.page.$eval(
      '[data-ta-reflog-branch-name]',
      (element) => element.value
    );

    const branchResponse = environment.setApiListener('/branches', 'POST');
    await environment.click('[data-ta-reflog-recover]');
    await branchResponse;
    await environment.ensureRedraw();

    expect(git(testRepoPaths[0], ['rev-parse', branchName])).to.be(lostSha);
    await environment.waitForElementVisible(`.ref.branch[data-ta-name="${branchName}"]`, 10000);
  });

  it('checks out the recovered branch when requested', async () => {
    const checkoutBranch = 'recovered/checkout-test';
    await environment.click('.tools .dropdown-toggle');
    await environment.click('[data-ta-action="open-reflog"]');
    await environment.waitForElementVisible('[data-ta-container="reflog-modal"]');
    await environment.click(`[data-ta-reflog-entry="${lostSha}"]`);
    await environment.insert('[data-ta-reflog-branch-name]', checkoutBranch);
    await environment.click('[data-ta-reflog-checkout]');

    const checkoutResponse = environment.setApiListener('/checkout', 'POST');
    await environment.click('[data-ta-reflog-recover]');
    await checkoutResponse;
    await environment.ensureRedraw();

    expect(git(testRepoPaths[0], ['rev-parse', '--abbrev-ref', 'HEAD'])).to.be(checkoutBranch);
    expect(git(testRepoPaths[0], ['rev-parse', 'HEAD'])).to.be(lostSha);
  });

  it('keeps the modal open when the branch already exists', async () => {
    await environment.click('.tools .dropdown-toggle');
    await environment.click('[data-ta-action="open-reflog"]');
    await environment.waitForElementVisible('[data-ta-container="reflog-modal"]');
    await environment.click(`[data-ta-reflog-entry="${lostSha}"]`);

    const branchResponse = environment.setApiListener('/branches', 'POST');
    await environment.click('[data-ta-reflog-recover]');
    await branchResponse;

    await environment.waitForElementVisible('[data-ta-container="reflog-modal"]');
  });
});
