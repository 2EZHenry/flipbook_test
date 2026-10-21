const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup(options = {}) {
    const events = {}, pointer = {}, wheel = {};
    const stage = { offsetWidth: 800, offsetHeight: 600, style: {} };
    const viewport = { clientWidth: 1000, clientHeight: 700, getBoundingClientRect: () => ({left: 0, top: 0, right: 1000, bottom: 700, width: 1000, height: 700}), addEventListener: (name, fn) => wheel[name] = fn };
    const surface = { hidden: true, addEventListener: (name, fn) => pointer[name] = fn, setPointerCapture() {}, classList: { add() {}, remove() {} } };
    const document = { addEventListener: (name, fn) => events[name] = fn };
    let reported;
    const context = vm.createContext({ document });
    vm.runInContext(fs.readFileSync(__dirname + '/../zoom-pan.js', 'utf8'), context);
    const zoom = new context.ZoomPan({ viewport, stage, surface, isReady: () => true, onZoom: value => reported = value, ...options });
    return { zoom, stage, viewport, surface, events, pointer, wheel, get reported() { return reported; } };
}
test('zoom creates pannable overflow; dragging reaches both edges without losing content', () => {
    const s = setup(); s.zoom.setZoom(2);
    assert.equal(s.surface.hidden, false);
    s.pointer.pointerdown({button: 0, pointerId: 1, clientX: 0, clientY: 0, preventDefault() {}});
    s.pointer.pointermove({pointerId: 1, clientX: 9999, clientY: 9999});
    assert.equal(s.zoom.x, 300); assert.equal(s.zoom.y, 250);
    s.pointer.pointermove({pointerId: 1, clientX: -9999, clientY: -9999});
    assert.equal(s.zoom.x, -300); assert.equal(s.zoom.y, -250);
    s.pointer.pointerup(); assert.equal(s.zoom.drag, null);
    s.zoom.setZoom(1); assert.equal(s.zoom.x, 0); assert.equal(s.zoom.y, 0); assert.equal(s.surface.hidden, true);
});
test('only actual visible outer edges hit; clipped edges and spine do not', () => {
    const { hitEdge } = require('../zoom-pan.js');
    const view = { left: 0, right: 1000, top: 0, bottom: 700 };
    const book = { left: 100, right: 900, top: 50, bottom: 650, prev: true, next: true };
    assert.equal(hitEdge(890, 80, book, view).side, 'next');
    assert.equal(hitEdge(110, 600, book, view).side, 'prev');
    assert.equal(hitEdge(500, 80, book, view), null);
    assert.equal(hitEdge(890, 20, book, view), null);
    assert.equal(hitEdge(990, 80, {...book, right: 1100}, view), null);
    assert.equal(hitEdge(10, 80, {...book, left: -100}, view), null);
    assert.equal(hitEdge(890, 80, {...book, next: false}, view), null);
});
test('inward edge drag flips once on release without panning; short, outward, vertical and cancelled drags do not', () => {
    const flips = [];
    const indicator = { style: {}, dataset: {} };
    const s = setup({ getBookBounds: () => ({left: 100, right: 900, top: 50, bottom: 650, prev: true, next: true}), onFlip: (...args) => flips.push(args), edgeIndicator: indicator });
    s.zoom.setZoom(2);
    const event = (x, y = 100) => ({button: 0, pointerId: 1, clientX: x, clientY: y, preventDefault() {}});
    s.pointer.pointermove(event(890)); assert.equal(indicator.hidden, false);
    s.pointer.pointerdown(event(890)); s.pointer.pointermove(event(800));
    assert.equal(s.zoom.x, 0); assert.equal(indicator.dataset.ready, 'true');
    s.pointer.pointerup(event(800)); assert.deepEqual(flips, [['next', 'top']]);
    for (const [x, y] of [[870,100], [960,100], [800,400]]) {
        s.pointer.pointerdown(event(890)); s.pointer.pointerup(event(x,y));
    }
    s.pointer.pointerdown(event(890)); s.pointer.pointermove(event(800)); s.pointer.pointercancel(); s.pointer.pointerup(event(800));
    assert.equal(flips.length, 1);
    s.pointer.pointerdown(event(110, 600)); s.pointer.pointerup(event(180, 600));
    assert.deepEqual(flips[1], ['prev', 'bottom']);
});
test('Ctrl wheel anchors zoom to cursor and ordinary wheel keeps browser behavior', () => {
    const s = setup(); let prevented = 0;
    const event = {ctrlKey: true, deltaY: -100, deltaMode: 0, clientX: 650, clientY: 350, preventDefault: () => prevented++};
    s.wheel.wheel(event);
    assert.ok(s.zoom.zoom > 1); assert.ok(s.zoom.x < 0); assert.equal(prevented, 1);
    s.wheel.wheel({...event, ctrlKey: false}); assert.equal(prevented, 1);
});
test('Ctrl +/-/0 zoom and reset; form fields are excluded; zoom limits clamp', () => {
    const s = setup(); let prevented = 0;
    const key = value => ({ ctrlKey: true, key: value, target: { closest: () => false }, preventDefault: () => prevented++ });
    s.events.keydown(key('+')); assert.equal(s.reported, 1.1);
    s.events.keydown(key('-')); assert.equal(s.reported, 1);
    s.zoom.setZoom(30); assert.equal(s.zoom.zoom, 3);
    s.events.keydown({...key('-'), target: {closest: () => true}}); assert.equal(s.zoom.zoom, 3);
    s.events.keydown(key('0')); assert.equal(s.zoom.zoom, 1); assert.equal(prevented, 3);
    s.zoom.setZoom(-30); assert.equal(s.zoom.zoom, .8);
});
test('resize reclamps pan and page changes recenter without resetting zoom', () => {
    const s = setup(); s.zoom.setZoom(3); s.zoom.x = 500; s.zoom.y = 400;
    s.viewport.clientWidth = 2000; s.viewport.clientHeight = 1600; s.zoom.refresh();
    assert.equal(s.zoom.x, 200); assert.equal(s.zoom.y, 100);
    s.zoom.recenter(); assert.equal(s.zoom.x, 0); assert.equal(s.zoom.y, 0); assert.equal(s.zoom.zoom, 3);
});
