const expect = require('expect.js');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('client server', () => {
  function createServer() {
    const source = fs.readFileSync(path.join(__dirname, '../public/source/server.js'), {
      encoding: 'utf8',
    });
    const sandbox = {
      module: { exports: {} },
      exports: {},
      console,
      ungit: {
        config: {
          isDisableProgressBar: true,
        },
      },
      window: {
        addEventListener: () => {},
      },
      require: (name) => {
        if (name === 'ungit-program-events') return { dispatch: () => {}, add: () => {} };
        throw new Error(`Unexpected require: ${name}`);
      },
    };

    vm.runInNewContext(source, sandbox);
    return new sandbox.module.exports();
  }

  it('does not subscribe to the same repository twice', () => {
    const server = createServer();
    const emitted = [];
    server.socket = {
      emit: (...args) => emitted.push(args),
    };

    server.watchRepository('/repos/SleepyCats');
    server.watchRepository('/repos/SleepyCats');
    server.watchRepository('/repos/SleepyCats-feature');

    expect(emitted).to.eql([
      ['watch', { path: '/repos/SleepyCats' }, undefined],
      ['watch', { path: '/repos/SleepyCats-feature' }, undefined],
    ]);
  });

  it('attaches an operation id to mutating requests', async () => {
    const server = createServer();
    server.socketId = 3;
    server._httpJsonRequest = (request, callback) => {
      expect(request.body.socketId).to.be(3);
      expect(request.body.operationId).to.match(/^op-/);
      callback(null, {});
    };

    await server.postPromise('/commit', { path: '/repos/SleepyCats' });
  });

  it('keeps socket id zero when creating operation requests', async () => {
    const server = createServer();
    server.socketId = 0;
    server._httpJsonRequest = (request, callback) => {
      expect(request.body.socketId).to.be(0);
      expect(request.body.operationId).to.match(/^op-/);
      callback(null, {});
    };

    await server.postPromise('/commit', { path: '/repos/SleepyCats' });
  });
});
