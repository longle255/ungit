const expect = require('expect.js');
const { execFileSync } = require('child_process');
const { createPerformanceRepo } = require('../scripts/performance/fixtures');
const git = require('../source/git-promise');
const metrics = require('../source/git-metrics');

describe('performance harness', function () {
  this.timeout(20000);
  let fixture;

  afterEach(async () => {
    if (fixture) {
      await fixture.cleanup();
      fixture = null;
    }
  });

  it('creates the requested commits and working-tree entries', async () => {
    fixture = await createPerformanceRepo({
      commits: 12,
      stagedFiles: 3,
      unstagedFiles: 4,
      untrackedFiles: 2,
    });

    const count = Number(
      execFileSync('git', ['rev-list', '--count', 'HEAD'], {
        cwd: fixture.repoPath,
        encoding: 'utf8',
      }).trim()
    );
    const status = execFileSync('git', ['status', '--porcelain'], {
      cwd: fixture.repoPath,
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .filter(Boolean);
    const codes = status.map((line) => line.slice(0, 2));

    expect(count).to.be.greaterThan(12);
    expect(status.length).to.be(9);
    expect(codes.filter((code) => code === 'A ')).to.have.length(3);
    expect(codes.filter((code) => code === ' M')).to.have.length(4);
    expect(codes.filter((code) => code === '??')).to.have.length(2);
  });

  it('records command count and bytes', async () => {
    fixture = await createPerformanceRepo({
      commits: 2,
      stagedFiles: 0,
      unstagedFiles: 0,
      untrackedFiles: 0,
    });
    metrics.reset();
    await git(['rev-parse', 'HEAD'], fixture.repoPath);
    const snapshot = metrics.snapshot();
    expect(snapshot.commands).to.be(1);
    expect(snapshot.stdoutBytes).to.be.greaterThan(0);
  });
});
