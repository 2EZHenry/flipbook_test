const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function setup({ supported = true, reject = false } = {}) {
    const icon = {}, attrs = {}, events = {}, status = { hidden: true };
    let click, opened = 0;
    const button = { setAttribute: (k, v) => attrs[k] = v, querySelector: () => icon, addEventListener: (name, fn) => click = fn };
    const root = { requestFullscreen: async () => { if (reject) throw Error('blocked'); doc.fullscreenElement = root; events.fullscreenchange(); } };
    const doc = { documentElement: root, fullscreenEnabled: supported, fullscreenElement: null,
        getElementById: id => id === 'fullscreenBtn' ? button : status,
        addEventListener: (name, fn) => events[name] = fn,
        exitFullscreen: async () => { doc.fullscreenElement = null; events.fullscreenchange(); },
    };
    vm.runInNewContext(fs.readFileSync(__dirname + '/../fullscreen.js', 'utf8'), { document: doc, window: { location: { href: 'https://example.com/viewer' }, open: () => opened++ } });
    return { doc, button, attrs, status, click, get opened() { return opened; } };
}
test('fullscreen enter, exit and Escape keep labels in sync', async () => {
    const s = setup();
    await s.click();
    assert.equal(s.attrs['aria-pressed'], 'true');
    assert.equal(s.button.title, 'Exit fullscreen');
    await s.click();
    assert.equal(s.attrs['aria-pressed'], 'false');
    await s.click();
    await s.doc.exitFullscreen();
    assert.equal(s.button.title, 'Enter fullscreen');
});
test('unsupported browser offers a standalone tab', async () => {
    const s = setup({ supported: false });
    assert.equal(s.button.title, 'Open viewer in new tab');
    await s.click();
    assert.equal(s.opened, 1);
});
test('request rejection shows feedback without changing fullscreen state', async () => {
    const s = setup({ reject: true });
    await s.click();
    assert.equal(s.status.hidden, false);
    assert.equal(s.attrs['aria-pressed'], 'false');
});
