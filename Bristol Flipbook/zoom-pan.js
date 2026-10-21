(function (root) {
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    function bounds(width, height, viewportWidth, viewportHeight, zoom) {
        return { x: Math.max(0, (width * zoom - viewportWidth) / 2), y: Math.max(0, (height * zoom - viewportHeight) / 2) };
    }
    function hitEdge(x, y, book, viewport, width = 28) {
        if (!book || y < Math.max(book.top, viewport.top) || y > Math.min(book.bottom, viewport.bottom)) return null;
        if (x < viewport.left || x > viewport.right) return null;
        const side = book.next && book.right >= viewport.left && book.right <= viewport.right && x <= book.right && x >= book.right - width ? 'next'
            : book.prev && book.left >= viewport.left && book.left <= viewport.right && x >= book.left && x <= book.left + width ? 'prev' : null;
        if (!side) return null;
        return { side, x: side === 'next' ? book.right : book.left,
            top: Math.max(book.top, viewport.top), bottom: Math.min(book.bottom, viewport.bottom),
            corner: y < (book.top + book.bottom) / 2 ? 'top' : 'bottom' };
    }
    class ZoomPan {
        constructor({ viewport, stage, surface, onZoom, isReady, getBookBounds = () => null, onFlip = () => {}, edgeIndicator = null }) {
            Object.assign(this, { viewport, stage, surface, onZoom, isReady, getBookBounds, onFlip, edgeIndicator });
            this.zoom = 1; this.x = 0; this.y = 0; this.drag = null;
            surface.addEventListener('pointerdown', event => {
                if (event.button !== 0 || this.zoom <= 1 || !isReady() || this.drag) return;
                event.preventDefault();
                const edge = this.edgeAt(event);
                this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: this.x, startY: this.y, edge };
                this.showEdge(edge);
                surface.setPointerCapture(event.pointerId);
                surface.classList.add('dragging');
            });
            surface.addEventListener('pointermove', event => {
                if (!this.drag) { this.showEdge(this.edgeAt(event)); return; }
                if (event.pointerId !== this.drag.id) return;
                if (this.drag.edge) {
                    const distance = (event.clientX - this.drag.x) * (this.drag.edge.side === 'next' ? -1 : 1);
                    this.showEdge(this.drag.edge, distance >= 56 && distance > Math.abs(event.clientY - this.drag.y));
                    return;
                }
                this.x = this.drag.startX + event.clientX - this.drag.x;
                this.y = this.drag.startY + event.clientY - this.drag.y;
                this.refresh();
            });
            surface.addEventListener('pointerup', event => {
                if (event && this.drag && event.pointerId !== this.drag.id) return;
                const drag = this.drag;
                this.cancelDrag();
                if (!event || !drag?.edge || !isReady()) return;
                const distance = (event.clientX - drag.x) * (drag.edge.side === 'next' ? -1 : 1);
                if (distance >= 56 && distance > Math.abs(event.clientY - drag.y)) onFlip(drag.edge.side, drag.edge.corner);
            });
            surface.addEventListener('pointercancel', () => this.cancelDrag());
            surface.addEventListener('lostpointercapture', () => this.cancelDrag());
            surface.addEventListener('pointerleave', () => { if (!this.drag) this.showEdge(null); });
            viewport.addEventListener('wheel', event => {
                if (!(event.ctrlKey || event.metaKey) || !isReady()) return;
                event.preventDefault();
                const rect = viewport.getBoundingClientRect();
                const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1);
                this.setZoom(this.zoom * Math.exp(-delta * 0.003), { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 });
            }, { passive: false });
            document.addEventListener('keydown', event => {
                if (!(event.ctrlKey || event.metaKey) || !isReady()) return;
                if (event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
                if (!['+', '=', '-', '_', '0'].includes(event.key)) return;
                event.preventDefault();
                if (event.key === '0') this.setZoom(1);
                else this.setZoom(this.zoom + (['+', '='].includes(event.key) ? 0.1 : -0.1));
            });
            this.refresh();
        }
        setZoom(value, anchor = { x: 0, y: 0 }) {
            this.cancelDrag();
            const next = clamp(value, 0.8, 3);
            const ratio = next / this.zoom;
            this.x = anchor.x - (anchor.x - this.x) * ratio;
            this.y = anchor.y - (anchor.y - this.y) * ratio;
            this.zoom = next;
            if (next <= 1) { this.x = 0; this.y = 0; }
            this.refresh();
            this.onZoom(next);
        }
        edgeAt(event) {
            if (this.zoom <= 1 || !this.isReady()) return null;
            return hitEdge(event.clientX, event.clientY, this.getBookBounds(), this.viewport.getBoundingClientRect());
        }
        showEdge(edge, ready = false) {
            this.surface.classList.remove('edge-hover', 'edge-ready');
            if (edge) this.surface.classList.add(ready ? 'edge-ready' : 'edge-hover');
            if (!this.edgeIndicator) return;
            this.edgeIndicator.hidden = !edge;
            if (!edge) return;
            const rect = this.viewport.getBoundingClientRect();
            Object.assign(this.edgeIndicator.style, {
                left: `${edge.x - rect.left - (edge.side === 'next' ? 28 : 0)}px`,
                top: `${edge.top - rect.top}px`, height: `${edge.bottom - edge.top}px`,
            });
            this.edgeIndicator.dataset.side = edge.side;
            this.edgeIndicator.dataset.corner = edge.corner;
            this.edgeIndicator.dataset.ready = String(ready);
        }
        cancelDrag() {
            const id = this.drag?.id;
            this.drag = null;
            if (id !== undefined && this.surface.hasPointerCapture?.(id)) this.surface.releasePointerCapture(id);
            this.surface.classList.remove('dragging');
            this.showEdge(null);
        }
        recenter() { this.cancelDrag(); this.x = 0; this.y = 0; this.refresh(); }
        refresh() {
            const limit = bounds(this.stage.offsetWidth, this.stage.offsetHeight, this.viewport.clientWidth, this.viewport.clientHeight, this.zoom);
            this.x = clamp(this.x, -limit.x, limit.x);
            this.y = clamp(this.y, -limit.y, limit.y);
            this.stage.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.zoom})`;
            this.surface.hidden = this.zoom <= 1;
        }
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = { ZoomPan, bounds, hitEdge };
    else root.ZoomPan = ZoomPan;
})(globalThis);
