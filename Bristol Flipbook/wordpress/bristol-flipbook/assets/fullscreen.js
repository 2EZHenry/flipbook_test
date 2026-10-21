(() => {
    const button = document.getElementById('fullscreenBtn');
    const status = document.getElementById('fullscreenStatus');
    const root = document.documentElement;
    const supported = Boolean(root.requestFullscreen && document.fullscreenEnabled);
    function update() {
        const active = Boolean(document.fullscreenElement);
        const label = supported ? (active ? 'Exit fullscreen' : 'Enter fullscreen') : 'Open viewer in new tab';
        button.title = label;
        button.setAttribute('aria-label', label);
        button.setAttribute('aria-pressed', String(active));
        button.querySelector('i').className = 'fa-solid ' + (active ? 'fa-compress' : supported ? 'fa-expand' : 'fa-arrow-up-right-from-square');
    }
    button.addEventListener('click', async () => {
        status.hidden = true;
        if (!supported) {
            window.open(window.location.href, '_blank', 'noopener,noreferrer');
            return;
        }
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await root.requestFullscreen();
        } catch {
            status.textContent = 'Fullscreen was blocked by your browser. Allow fullscreen for this page and try again.';
            status.hidden = false;
        }
        update();
    });
    document.addEventListener('fullscreenchange', update);
    update();
})();
