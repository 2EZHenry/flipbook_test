// Cache rasterized pages independently from the flipbook's display dimensions.
(function (root) {
    class LazyPages {
        constructor(count, render, ready) {
            this.count = count;
            this.render = render;
            this.ready = ready;
            this.cache = new Map();
            this.pending = new Map();
            this.idle = Promise.resolve();
            this.revision = 0;
            this.closed = false;
        }
        get(index) {
            if (this.closed || index < 0 || index >= this.count) return Promise.resolve(null);
            if (this.cache.has(index)) return Promise.resolve(this.cache.get(index));
            if (this.pending.has(index)) return this.pending.get(index);
            const task = this.idle.then(async () => {
                if (this.closed) return null;
                const canvas = await this.render(index);
                if (!this.closed) {
                    this.cache.set(index, canvas);
                    this.ready(index, canvas);
                }
                return canvas;
            });
            this.pending.set(index, task);
            this.idle = task.catch(() => {}).then(() => this.pending.delete(index));
            return task;
        }
        async focus(index) {
            const revision = ++this.revision;
            // Visible spread first, then adjacent spreads. Stop obsolete prefetch work.
            for (const offset of [0, 1, -1, 2, 3, -2, -3]) {
                if (this.closed || revision !== this.revision) return;
                await this.get(index + offset);
            }
        }
        async close() {
            this.closed = true;
            this.revision++;
            await this.idle;
            this.cache.clear();
        }
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = LazyPages;
    else root.LazyPages = LazyPages;
})(globalThis);
