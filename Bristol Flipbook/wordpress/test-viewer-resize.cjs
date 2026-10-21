const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const LazyPages = require('../lazy-pages.js');
const FlipbookLayout = require('../page-layout.js');
const { ZoomPan } = require('../zoom-pan.js');
test('fullscreen-sized resize preserves current page and canvas without PDF reload or rasterization', async () => {
    class Element {
        constructor() { this.style = {}; this.dataset = {}; this.children = []; this.classList = { add() {}, remove() {} }; this.parentElement = {}; this.offsetWidth = 800; this.offsetHeight = 600; this.clientWidth = 1000; this.clientHeight = 700; }
        addEventListener() {} setAttribute() {}
        appendChild(child) { this.children.push(child); }
        replaceChildren(...children) { this.children = children; }
        querySelectorAll() { return this.children; }
        getContext() { return { fillRect() {} }; }
        set innerHTML(value) { this.children = []; }
    }
    const elements = new Map();
    const document = { body: new Element(), addEventListener() {}, getElementById(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); }, createElement: () => new Element() };
    let loads = 0, renders = 0, destroyed = 0;
    const pdfDoc = { numPages: 100, getPage: async () => ({ getViewport: ({scale}) => ({ width: 600 * scale, height: 800 * scale }), render: () => { renders++; return { promise: Promise.resolve() }; } }), destroy: async () => destroyed++ };
    class PageFlip {
        constructor() { this.index = 0; this.events = {}; }
        destroy() {} loadFromHTML() {} update() {}
        turnToPage(index) { this.index = index; }
        on(name, fn) { this.events[name] = fn; }
        getCurrentPageIndex() { return this.index; }
        getOrientation() { return 'landscape'; }
        getState() { return 'read'; }
    }
    const timers = [], listeners = {};
    const window = { innerWidth: 1100, innerHeight: 700, devicePixelRatio: 1, location: { protocol: 'http:' }, addEventListener: (name, fn) => listeners[name] = fn };
    const context = vm.createContext({ document, window, LazyPages, FlipbookLayout, St: { PageFlip }, pdfjsLib: { getDocument: () => { loads++; return { promise: Promise.resolve(pdfDoc) }; } }, console, performance, queueMicrotask, setTimeout: (fn, delay) => { timers.push({fn, delay}); return timers.length; }, clearTimeout() {} });
    vm.runInContext(fs.readFileSync(__dirname + '/../zoom-pan.js', 'utf8'), context);
    const html = fs.readFileSync(__dirname + '/bristol-flipbook/assets/viewer.html', 'utf8');
    const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].find(match => match[1].includes('const pdfUrl'))[1];
    vm.runInContext(script, context);
    await window.loadFlipbookSource({ data: new Uint8Array() });
    for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve));
    assert.ok(renders < 10, 'initial display must not render the entire book');
    vm.runInContext('pageFlip.turnToPage(12); pageFlip.events.flip({ data: 12 });', context);
    for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve));
    const before = renders;
    const canvas = vm.runInContext('lazyPages.cache.get(12)', context);
    for (const [width, height] of [[1920, 1080], [1100, 700], [420, 800]]) {
        window.innerWidth = width; window.innerHeight = height;
        listeners.resize(); timers.filter(t => t.delay === 180).at(-1).fn();
        for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve));
        assert.equal(vm.runInContext('currentPageIndex', context), 12);
        assert.equal(vm.runInContext('lazyPages.cache.get(12)', context), canvas);
        assert.equal(renders, before);
    }
    assert.equal(loads, 1); assert.equal(destroyed, 0);
});
