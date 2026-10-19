const { execFileSync } = require('child_process');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');

const git = (cwd, args, options = {}) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', ...options });

const set = (cwd, args, input) => execFileSync('git', args, { cwd, input, encoding: 'utf8' });

async function createPerformanceRepo(options = {}) {
  const {
    commits = 200,
    stagedFiles = 50,
    unstagedFiles = 50,
    untrackedFiles = 100,
    largeDiffBytes = 0,
    branches = 3,
  } = options;

  const repoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'ungit-perf-'));
  const cleanup = () => fs.rm(repoPath, { recursive: true, force: true });

  try {
    git(repoPath, ['init', '-q']);
    git(repoPath, ['config', 'user.email', 'perf@example.com']);
    git(repoPath, ['config', 'user.name', 'Performance Fixture']);
    git(repoPath, ['symbolic-ref', 'HEAD', 'refs/heads/master']);

    const epoch = 1577836800;
    const marks = [];
    let stream = 'blob\nmark :1\ndata 5\nbase\n';
    stream +=
      'commit refs/heads/master\nmark :2\n' +
      `committer Perf <perf@example.com> ${epoch} +0000\n` +
      'data 5\nbase\nM 100644 :1 README.md\n\n';
    marks.push(2);

    for (let i = 1; i <= commits; i += 1) {
      const mark = i + 2;
      const message = `commit ${i}`;
      stream +=
        `commit refs/heads/master\nmark :${mark}\n` +
        `committer Perf <perf@example.com> ${epoch + i} +0000\n` +
        `data ${Buffer.byteLength(message)}\n${message}\n` +
        `from :${mark - 1}\n\n`;
      marks.push(mark);
    }

    for (let i = 0; i < branches; i += 1) {
      const mark = marks[Math.max(1, Math.floor((marks.length * (i + 1)) / (branches + 1)))];
      stream += `reset refs/heads/branch-${i}\nfrom :${mark}\n\n`;
    }

    set(repoPath, ['fast-import', '--quiet'], stream);
    git(repoPath, ['reset', '--hard', 'master']);

    if (unstagedFiles > 0) {
      for (let i = 0; i < unstagedFiles; i += 1) {
        await fs.writeFile(path.join(repoPath, `unstaged-${i}.txt`), `base ${i}\n`);
      }
      git(repoPath, ['add', '.']);
      git(repoPath, ['commit', '-qm', 'tracked files']);
      for (let i = 0; i < unstagedFiles; i += 1) {
        await fs.writeFile(path.join(repoPath, `unstaged-${i}.txt`), `changed ${i}\n`);
      }
    }

    if (largeDiffBytes > 0) {
      await fs.writeFile(path.join(repoPath, 'large-diff.txt'), 'base\n');
      git(repoPath, ['add', 'large-diff.txt']);
      git(repoPath, ['commit', '-qm', 'large diff base']);
      await fs.writeFile(path.join(repoPath, 'large-diff.txt'), 'x'.repeat(largeDiffBytes));
    }

    for (let i = 0; i < stagedFiles; i += 1) {
      await fs.writeFile(path.join(repoPath, `staged-${i}.txt`), `staged ${i}\n`);
    }
    // Stage only the staged-* paths. `git add .` would also absorb the modified
    // unstaged files and the modified large-diff file written above.
    if (stagedFiles > 0) git(repoPath, ['add', '--', 'staged-*.txt']);

    for (let i = 0; i < untrackedFiles; i += 1) {
      await fs.writeFile(path.join(repoPath, `untracked-${i}.txt`), `untracked ${i}\n`);
    }

    return {
      repoPath,
      cleanup,
      counts: { commits, stagedFiles, unstagedFiles, untrackedFiles, largeDiffBytes },
    };
  } catch (err) {
    await cleanup();
    throw err;
  }
}

module.exports = { createPerformanceRepo };
