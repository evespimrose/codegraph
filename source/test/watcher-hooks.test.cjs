const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

test('PowerShell session hook selects nearest index without crossing a nested Git root', { skip: process.platform !== 'win32', timeout: 30000 }, async t => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-watch-hook-'));
    const root = path.join(fixture, 'repository');
    const nested = path.join(root, 'nested project');
    const leaf = path.join(nested, 'src');
    fs.mkdirSync(leaf, { recursive: true });
    execFileSync('git', ['init', '-q', root], { windowsHide: true });
    for (const indexed of [root, nested]) {
        fs.mkdirSync(path.join(indexed, '.codegraph'));
        fs.writeFileSync(path.join(indexed, '.codegraph', 'codegraph.db'), 'hook-routing-fixture');
    }
    const profile = path.join(fixture, 'profile');
    const bin = path.join(profile, '.local', 'bin');
    fs.mkdirSync(bin, { recursive: true });
    const record = path.join(fixture, 'arguments.json');
    const stub = path.join(fixture, 'codegraph-stub.cjs');
    fs.writeFileSync(stub, 'require("node:fs").writeFileSync(process.env.KIT_HOOK_TEST_RECORD,JSON.stringify(process.argv.slice(2)));console.log(JSON.stringify({active:true,phase:"watching"}));');
    fs.writeFileSync(path.join(bin, 'codegraph.cmd'), `@"${process.execPath}" "${stub}" %*\r\n`);
    const hook = path.resolve(__dirname, '../../../../hooks/codegraph-session.ps1');
    const environment = { ...process.env, USERPROFILE: profile, KIT_HOOK_TEST_RECORD: record };
    delete environment.KIT_NO_AUTOINDEX;
    delete environment.KIT_AUTOINDEX_DRYRUN;
    const runHook = async (context, cwd) => {
        fs.rmSync(record, { force: true });
        const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', hook], { input: JSON.stringify({ cwd }), encoding: 'utf8', windowsHide: true, env: environment, timeout: 10000 });
        let argumentsUsed;
        await context.waitFor(() => { argumentsUsed = JSON.parse(fs.readFileSync(record, 'utf8')); }, { timeout: 10000, interval: 100 });
        return { output, argumentsUsed };
    };
    await t.test('nested existing index wins over the Git top level', async context => {
        const { output, argumentsUsed } = await runHook(context, leaf);
        assert.deepEqual(argumentsUsed, ['watch', 'start', nested, '--json']);
        assert.match(JSON.parse(output).hookSpecificOutput.additionalContext, /CodeGraph indexes this repo/);
    });
    await t.test('the Git top-level index remains the fallback', async context => {
        const other = path.join(root, 'other'); fs.mkdirSync(other);
        const { argumentsUsed } = await runHook(context, other);
        assert.deepEqual(argumentsUsed, ['watch', 'start', root, '--json']);
    });
    await t.test('an unindexed nested Git repository does not start its parent watcher', () => {
        const separate = path.join(root, 'separate'); fs.mkdirSync(separate);
        execFileSync('git', ['init', '-q', separate], { windowsHide: true });
        fs.unlinkSync(record);
        execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', hook], { input: JSON.stringify({ cwd: separate }), encoding: 'utf8', windowsHide: true, env: environment, timeout: 10000 });
        assert.equal(fs.existsSync(record), false);
    });
});
