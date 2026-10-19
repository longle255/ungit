function payloadKey(value) {
  if (value && typeof value.revision === 'string') return value.revision;
  return JSON.stringify(value);
}
module.exports = { payloadKey };
