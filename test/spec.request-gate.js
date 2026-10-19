const expect = require('expect.js');
const RequestGate = require('../public/source/request-gate');

describe('RequestGate', () => {
  it('accepts only the newest generation', () => {
    const gate = new RequestGate();
    const first = gate.begin();
    const second = gate.begin();
    expect(gate.isCurrent(first)).to.be(false);
    expect(gate.isCurrent(second)).to.be(true);
    gate.invalidate();
    expect(gate.isCurrent(second)).to.be(false);
  });
});
