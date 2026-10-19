const expect = require('expect.js');
const { payloadKey } = require('../components/payload-key');

describe('payloadKey', () => {
  it('prefers a server revision', () => {
    expect(payloadKey({ revision: 'abc', files: { one: 1 } })).to.be('abc');
  });

  it('falls back to stringify', () => {
    expect(payloadKey({ files: {} })).to.be('{"files":{}}');
  });
});
