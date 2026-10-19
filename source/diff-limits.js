const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_LINES = 20000;

function getDiffLimitError(diff, options = {}) {
  const maxBytes = options.maxBytes || DEFAULT_MAX_BYTES;
  const maxLines = options.maxLines || DEFAULT_MAX_LINES;
  if (options.force || typeof diff !== 'string') return null;
  const size = Buffer.byteLength(diff, 'utf8');
  const lines = diff.split('\n').length;
  if (size > maxBytes || lines > maxLines) {
    return { errorCode: 'diff-too-large', size, lines, limit: maxBytes, lineLimit: maxLines };
  }
  return null;
}

module.exports = { getDiffLimitError, DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES };
