const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { CodeGraph } = require('../lib');
const protocol = require('../lib/watch/protocol');
const execute = promisify(execFile);

test('watch stop exits nonzero when an endpoint refuses authentication', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-stop-refused-'));
    const graph = await CodeGraph.init(root); graph.close();
    const location = protocol.locations(root);
    protocol.writeJson(location.state, { token: 'fixture-token', pid: process.pid });
    const server = net.createServer(socket => {
        socket.on('error', () => socket.destroy());
        socket.once('data', () => socket.end(JSON.stringify({ projectId: location.id, error: 'authentication failed' }) + '\n'));
    });
    await new Promise(resolve => server.listen(location.endpoint, resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const result = await execute(process.execPath, ['--liftoff-only', require.resolve('../lib/bin/codegraph'), 'watch', 'stop', root, '--json'], { windowsHide: true, timeout: 10000 }).catch(error => error);
    assert.equal(result.code, 1);
    assert.equal(JSON.parse(result.stdout).phase, 'unresponsive');
    assert.equal(server.listening, true);
});
