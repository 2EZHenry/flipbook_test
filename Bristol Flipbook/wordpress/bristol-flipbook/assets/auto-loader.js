/* Browser API key: restrict to this website and Google Drive API in Google Cloud. */
(async () => {
    const loader = document.getElementById('loader');
    const config = window.BristolFlipbookConfig;
    try {
        if (!config?.apiKey || !config?.fileId) throw new Error('The catalogue is awaiting configuration.');
        document.title = config.title + ' catalogue';
        loader.textContent = 'Loading ' + config.title + ' catalogue…';
        const response = await fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(config.fileId) + '?alt=media', {
            headers: { 'X-Goog-Api-Key': config.apiKey },
            credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(120000),
        });
        if (!response.ok) {
            if (response.status === 403) throw new Error('Google Drive denied access. The site administrator should check API key restrictions and PDF sharing permissions.');
            if (response.status === 404) throw new Error('The catalogue is unavailable. Please check its Google Drive sharing permissions.');
            if (response.status === 429) throw new Error('The catalogue download limit was reached. Please try again later.');
            throw new Error('Could not download the catalogue. Please try again later.');
        }
        const data = new Uint8Array(await response.arrayBuffer());
        if (!new TextDecoder().decode(data.subarray(0, 1024)).includes('%PDF-')) throw new Error('The catalogue file is not a PDF.');
        await window.loadFlipbookSource({ data, isEvalSupported: false });
    } catch (error) {
        loader.classList?.add('load-error');
        loader.style.display = 'block';
        loader.textContent = error.name === 'TimeoutError' ? 'The download timed out. Please reload to try again.' : (error.message || 'Unable to load the catalogue. Please reload to retry.');
    }
})();
