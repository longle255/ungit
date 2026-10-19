class RequestGate {
  constructor() {
    this._generation = 0;
  }
  begin() {
    this._generation += 1;
    return this._generation;
  }
  isCurrent(token) {
    return token === this._generation;
  }
  invalidate() {
    this._generation += 1;
  }
}
module.exports = RequestGate;
