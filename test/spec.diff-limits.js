const expect = require('expect.js');
const { getDiffLimitError } = require('../source/diff-limits');

describe('diff limits', () => {
  it('allows a small diff', () => {
    expect(getDiffLimitError('a\nb\n', { maxBytes: 100, maxLines: 10 })).to.be(null);
  });

  it('rejects a diff over the byte limit', () => {
    const error = getDiffLimitError('x'.repeat(101), { maxBytes: 100, maxLines: 10 });
    expect(error.errorCode).to.be('diff-too-large');
    expect(error.size).to.be(101);
  });

  it('rejects a diff over the line limit', () => {
    const error = getDiffLimitError(Array(12).fill('x').join('\n'), {
      maxBytes: 1000,
      maxLines: 10,
    });
    expect(error.errorCode).to.be('diff-too-large');
  });

  it('allows force', () => {
    expect(getDiffLimitError('x'.repeat(101), { maxBytes: 100, maxLines: 10, force: true })).to.be(
      null
    );
  });
});
