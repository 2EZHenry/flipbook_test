const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const code = fs.readFileSync(__dirname + '/bristol-flipbook/assets/auto-loader.js', 'utf8');
async function run(config, response) {
    const loader = { style: {}, textContent: '' }, calls = [], loaded = [];
    await vm.runInNewContext(code, {
        window: { BristolFlipbookConfig: config, loadFlipbookSource: async source => loaded.push(source) },
        document: { getElementById: () => loader },
        fetch: async (...args) => { calls.push(args); return response; },
        Uint8Array, TextDecoder, AbortSignal,
    });
    return { loader, calls, loaded };
}
const config = { apiKey: 'test-key', fileId: 'syron-file', title: 'Syron' };
test('automatically loads configured PDF with key in header and evaluation disabled', async () => {
    const r = await run(config, { ok: true, arrayBuffer: async () => new TextEncoder().encode('%PDF-1.7').buffer });
    assert.equal(r.calls.length, 1);
    assert.equal(r.calls[0][1].headers['X-Goog-Api-Key'], 'test-key');
    assert.ok(!r.calls[0][0].includes('test-key'));
    assert.equal(r.loaded.length, 1);
    assert.equal(r.loaded[0].isEvalSupported, false);
});
test('missing configuration makes no network request', async () => {
    const r = await run({});
    assert.equal(r.calls.length, 0);
    assert.match(r.loader.textContent, /awaiting configuration/);
});
test('denied and non-PDF responses never enter viewer', async () => {
    for (const response of [{ ok: false, status: 403 }, { ok: true, arrayBuffer: async () => new TextEncoder().encode('<html>Login</html>').buffer }]) {
        const r = await run(config, response);
        assert.equal(r.loaded.length, 0);
        assert.equal(r.loader.style.display, 'block');
        assert.ok(!r.loader.textContent.includes('test-key'));
    }
});
