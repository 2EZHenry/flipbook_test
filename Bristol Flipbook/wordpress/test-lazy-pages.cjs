const { test } = require('node:test');
const assert = require('node:assert/strict');
const LazyPages = require('../lazy-pages.js');
test('only renders nearby pages and reuses cache for fullscreen layout changes', async () => {
    const calls = [], attached = [];
    const pages = new LazyPages(100, async index => { calls.push(index); return { index }; }, (i, c) => attached.push(c));
    await pages.focus(0);
    assert.deepEqual(calls, [0, 1, 2, 3]);
    const first = await pages.get(0);
    await pages.focus(0);
    assert.equal(await pages.get(0), first);
    assert.equal(calls.length, 4);
    await pages.focus(10);
    assert.deepEqual(calls.slice(4), [10, 11, 9, 12, 13, 8, 7]);
    assert.equal(attached.length, 11);
});
test('deduplicates requests and serializes rasterization', async () => {
    let count = 0, active = 0, peak = 0;
    const pages = new LazyPages(20, async index => {
        count++; peak = Math.max(peak, ++active);
        await new Promise(resolve => setImmediate(resolve));
        active--; return { index };
    }, () => {});
    const [a, b] = await Promise.all([pages.get(2), pages.get(2), pages.get(3)]);
    assert.equal(a, b); assert.equal(count, 2); assert.equal(peak, 1);
});
test('new focus abandons obsolete prefetch after the current render', async () => {
    const calls = [];
    const pages = new LazyPages(100, async index => { calls.push(index); await new Promise(resolve => setImmediate(resolve)); return index; }, () => {});
    const old = pages.focus(0);
    const fresh = pages.focus(50);
    await Promise.all([old, fresh]);
    assert.deepEqual(calls, [0, 50, 51, 49, 52, 53, 48, 47]);
});
test('failed renders can retry; closing prevents stale attachment', async () => {
    let fail = true, attached = 0;
    const pages = new LazyPages(3, async () => { if (fail) throw Error('failed'); return {}; }, () => attached++);
    await assert.rejects(pages.get(0)); await pages.idle;
    fail = false; await pages.get(0); assert.equal(attached, 1);
    const pending = pages.get(1);
    await pages.close(); await pending;
    assert.equal(attached, 1); assert.equal(pages.cache.size, 0);
});
