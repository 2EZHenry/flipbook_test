// Layout is independent of screen size so resize/mobile keep the same page order.
(function (root) {
    function planPages(pages) {
        const showCover = pages[0].width <= pages[0].height;
        const entries = [];
        pages.forEach((page, index) => {
            const pageNumber = index + 1;
            if (page.width > page.height) {
                // With a cover, spreads begin at 1,3,5...; otherwise 0,2,4...
                if (entries.length % 2 !== (showCover ? 1 : 0)) {
                    entries.push({ blank: true, pageNumber: null });
                }
                for (const half of ["left", "right"]) {
                    entries.push({ pageNumber, half, width: page.width / 2, height: page.height });
                }
            } else {
                entries.push({ pageNumber, half: null, width: page.width, height: page.height });
            }
        });
        return { showCover, entries };
    }

    function renderGeometry(entry, source, width, height, pixelRatio) {
        const cropWidth = entry.half ? source.width / 2 : source.width;
        const scale = Math.min(width * pixelRatio / cropWidth, height * pixelRatio / source.height);
        const contentWidth = cropWidth * scale;
        const left = entry.half === "left" ? width * pixelRatio - contentWidth
            : entry.half === "right" ? 0 : (width * pixelRatio - contentWidth) / 2;
        return {
            scale,
            x: left - (entry.half === "right" ? contentWidth : 0),
            y: (height * pixelRatio - source.height * scale) / 2,
        };
    }

    const api = { planPages, renderGeometry };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.FlipbookLayout = api;
})(globalThis);
