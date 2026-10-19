const fresh = () => ({
  commands: 0,
  active: 0,
  maxActive: 0,
  queueWaitMs: 0,
  commandMs: 0,
  stdoutBytes: 0,
  stderrBytes: 0,
});

let state = fresh();
let sequence = 0;

exports.reset = () => {
  state = fresh();
};

exports.start = () => {
  sequence += 1;
  state.commands += 1;
  return sequence;
};

exports.spawned = (waitMs) => {
  state.active += 1;
  state.maxActive = Math.max(state.maxActive, state.active);
  state.queueWaitMs += waitMs;
};

exports.finished = (data) => {
  state.active = Math.max(0, state.active - 1);
  state.commandMs += data.durationMs || 0;
  state.stdoutBytes += data.stdoutBytes || 0;
  state.stderrBytes += data.stderrBytes || 0;
};

exports.snapshot = () => ({ ...state });
