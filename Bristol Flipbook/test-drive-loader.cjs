const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function setup(response) {
    const elements = new Map();
    const get = id => {
        if (!elements.has(id)) elements.set(id, {
            value: '', textContent: '', style: {}, listeners: {},
            addEventListener(type, fn) { this.listeners[type] = fn; },
            append() {}, setAttribute() {}, querySelectorAll() { return []; },
            showModal() { this.open = true; }, close() { this.open = false; },
        });
        return elements.get(id);
    };
    const requests = [], loaded = [];
    const window = { startFlipbook() {}, async loadFlipbookSource(source) { loaded.push(source); } };
    const document = {
        head: get('head'), body: get('body'), getElementById: get,
        createElement(tag) { return tag === 'dialog' ? get('dialog') : get(tag); },
    };
    vm.runInNewContext(fs.readFileSync(__dirname + '/drive-loader.js', 'utf8'), {
        document, window, URL, Uint8Array, TextDecoder, AbortSignal,
        fetch: async (url, options) => { requests.push({ url, options }); return response; },
    });
    get('driveApiKey').value = 'test-key';
    return {
        requests, loaded, get,
        async submit(link) {
            get('driveLink').value = link;
            get('driveForm').listeners.submit({ preventDefault() {} });
            for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve));
        },
    };
}

test('loads PDF bytes through Drive API without putting the key in the URL', async () => {
    const s = setup({ ok: true, arrayBuffer: async () => new TextEncoder().encode('%PDF-1.7\n').buffer });
    await s.submit('https://drive.google.com/file/d/1NQqJlAJxW0MnPzFwbFCF1Vt9L4sEGCN4/view?resourcekey=abc_123');
    assert.equal(s.requests.length, 1);
    assert.match(s.requests[0].url, /files\/1NQqJlAJxW0MnPzFwbFCF1Vt9L4sEGCN4\?alt=media$/);
    assert.equal(s.requests[0].options.headers['X-Goog-Api-Key'], 'test-key');
    assert.equal(s.requests[0].options.headers['X-Goog-Drive-Resource-Keys'], '1NQqJlAJxW0MnPzFwbFCF1Vt9L4sEGCN4/abc_123');
    assert.ok(!s.requests[0].url.includes('test-key'));
    assert.equal(s.loaded.length, 1);
    assert.equal(new TextDecoder().decode(s.loaded[0].data), '%PDF-1.7\n');
});

test('rejects other domains before transmitting credentials', async () => {
    const s = setup();
    await s.submit('https://example.com/file/d/1234567890123/view');
    assert.equal(s.requests.length, 0);
    assert.match(s.get('driveStatus').textContent, /drive.google.com/);
});

test('explains denied access without exposing Google response secrets', async () => {
    const s = setup({ ok: false, status: 403, json: async () => ({ error: { message: 'test-key' } }) });
    await s.submit('1234567890123');
    assert.match(s.get('driveStatus').textContent, /Google denied access/);
    assert.ok(!s.get('driveStatus').textContent.includes('test-key'));
    assert.equal(s.loaded.length, 0);
});

test('rejects successful responses that are HTML instead of PDF', async () => {
    const s = setup({ ok: true, arrayBuffer: async () => new TextEncoder().encode('<html>Login</html>').buffer });
    await s.submit('1234567890123');
    assert.match(s.get('driveStatus').textContent, /not a PDF/);
    assert.equal(s.loaded.length, 0);
});

test('local catalogue does not call Google', async () => {
    const s = setup();
    s.get('localPdfBtn').listeners.click();
    for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(s.requests.length, 0);
    assert.equal(s.loaded[0], './DesignCollection2024.pdf');
});
