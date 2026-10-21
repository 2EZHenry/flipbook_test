const { test } = require('node:test');
const assert = require('node:assert/strict');
const { planPages, renderGeometry } = require('./page-layout.js');
const portrait = { width: 600, height: 800 };
const landscape = { width: 1200, height: 800 };

test('portrait pages retain their order and single-page cover', () => {
    const layout = planPages([portrait, portrait, portrait]);
    assert.equal(layout.showCover, true);
    assert.deepEqual(layout.entries.map(p => p.pageNumber), [1, 2, 3]);
    assert.ok(layout.entries.every(p => !p.half && !p.blank));
});

test('landscape-only books open with a complete spread, without a cover', () => {
    const layout = planPages([landscape, landscape]);
    assert.equal(layout.showCover, false);
    assert.deepEqual(layout.entries.map(p => [p.pageNumber, p.half]), [
        [1, 'left'], [1, 'right'], [2, 'left'], [2, 'right'],
    ]);
});

test('inserts a blank only when needed to keep a divided page in one spread', () => {
    const layout = planPages([portrait, portrait, landscape, landscape, portrait]);
    assert.deepEqual(layout.entries.map(p => p.blank ? 'blank' : `${p.pageNumber}:${p.half || 'whole'}`), [
        '1:whole', '2:whole', 'blank', '3:left', '3:right', '4:left', '4:right', '5:whole',
    ]);
});

test('every half pair stays together for arbitrary mixed orientation sequences', () => {
    for (let pattern = 0; pattern < 256; pattern++) {
        const pages = Array.from({ length: 8 }, (_, i) => (pattern >> i) & 1 ? landscape : portrait);
        const { entries, showCover } = planPages(pages);
        entries.forEach((entry, index) => {
            if (entry.half !== 'left') return;
            assert.equal(index % 2, showCover ? 1 : 0);
            assert.equal(entries[index + 1].half, 'right');
            assert.equal(entries[index + 1].pageNumber, entry.pageNumber);
        });
        assert.deepEqual(entries.filter(p => !p.blank && p.half !== 'right').map(p => p.pageNumber), [1,2,3,4,5,6,7,8]);
    }
});

test('halves preserve scale and share exactly the same middle seam', () => {
    for (const source of [landscape, { width: 1001, height: 700 }, { width: 1600, height: 600 }]) {
        const left = renderGeometry({ half: 'left' }, source, 400, 600, 2);
        const right = renderGeometry({ half: 'right' }, source, 400, 600, 2);
        assert.equal(left.scale, right.scale);
        const seam = source.width / 2 * left.scale;
        assert.ok(Math.abs(left.x + seam - 800) < 1e-9);
        assert.ok(Math.abs(right.x + seam) < 1e-9);
        assert.ok(source.height * left.scale <= 1200 + 1e-9);
        assert.equal(left.y, right.y);
    }
});

test('portrait pages with different dimensions fit without stretching or cropping', () => {
    const source = { width: 400, height: 1000 };
    const g = renderGeometry({ half: null }, source, 600, 800, 1);
    assert.equal(g.scale, .8);
    assert.equal(g.x, 140);
    assert.equal(g.y, 0);
});
