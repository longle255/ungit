const signals = require('signals');

const programEvents = new signals.Signal();
module.exports = programEvents;
ungit.programEvents = programEvents;

programEvents.add(function (event) {
  console.log(`${new Date().toISOString()} [ACTION:UI EVENT] ${event.event}`, event);
});
