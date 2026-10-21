// Public Drive PDFs only. Credentials remain in page memory.
(() => {
    const style = document.createElement("style");
    style.textContent = `
        #driveDialog { border: 1px solid #ccc; border-radius: 16px; padding: 26px; width: min(480px, calc(100vw - 32px)); color: #333; box-shadow: 0 24px 48px #0003; }
        #driveDialog::backdrop { background: #0006; }
        #driveDialog h2 { margin: 0 0 12px; }
        #driveDialog p { font-size: 14px; line-height: 1.5; }
        #driveDialog label { display: block; font-weight: 600; margin: 18px 0 6px; }
        #driveDialog input { width: 100%; padding: 11px; border: 1px solid #aaa; border-radius: 6px; font: inherit; }
        #driveDialog .actions { display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap; }
        #driveDialog button { padding: 10px 16px; border: 1px solid #777; border-radius: 6px; background: white; cursor: pointer; }
        #driveDialog button[type=submit] { background: #6b9900; color: white; border-color: #6b9900; }
        #driveStatus { color: #9b2222; }
        #driveDialog button:disabled { opacity: .5; cursor: wait; }
    `;
    document.head.append(style);
    const dialog = document.createElement("dialog");
    dialog.id = "driveDialog";
    dialog.setAttribute("aria-labelledby", "driveTitle");
    dialog.innerHTML = `
        <form id="driveForm">
            <h2 id="driveTitle">Open a Drive PDF</h2>
            <p>Use a PDF shared as <strong>Anyone with the link</strong>, with downloading allowed.</p>
            <label for="driveLink">Google Drive link or file ID</label>
            <input id="driveLink" type="text" required value="https://drive.google.com/file/d/1NQqJlAJxW0MnPzFwbFCF1Vt9L4sEGCN4/view" autocomplete="off">
            <label for="driveApiKey">Google Drive API key</label>
            <input id="driveApiKey" type="password" required autocomplete="off" spellcheck="false">
            <p>Your key is kept in this page’s memory. For website-restricted keys, allow <strong>http://localhost:8000/*</strong> in Google Cloud.</p>
            <p id="driveStatus" role="status" aria-live="polite"></p>
            <div class="actions">
                <button type="submit">Load PDF</button>
                <button type="button" id="localPdfBtn">Use local catalogue</button>
                <button type="button" id="closeDriveBtn">Close</button>
            </div>
        </form>
    `;
    document.body.append(dialog);
    const status = document.getElementById("driveStatus");
    const loader = document.getElementById("loader");
    let busy = false;

    function parseDriveLink(value) {
        value = value.trim();
        if (/^[a-zA-Z0-9_-]{10,}$/.test(value)) return { id: value, resourceKey: null };
        let url;
        try { url = new URL(value); }
        catch { throw new Error("Enter a Google Drive file link or file ID."); }
        if (url.protocol !== "https:" || !["drive.google.com", "docs.google.com"].includes(url.hostname)) {
            throw new Error("Use a link from drive.google.com.");
        }
        const id = url.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || url.searchParams.get("id");
        if (!id || !/^[a-zA-Z0-9_-]{10,}$/.test(id)) throw new Error("This link does not contain a valid Drive file ID.");
        const resourceKey = url.searchParams.get("resourcekey");
        if (resourceKey && !/^[a-zA-Z0-9_-]+$/.test(resourceKey)) throw new Error("Invalid resource key in Drive link.");
        return { id, resourceKey };
    }

    async function getDrivePdf(link, apiKey) {
        const { id, resourceKey } = parseDriveLink(link);
        const headers = { "X-Goog-Api-Key": apiKey };
        if (resourceKey) headers["X-Goog-Drive-Resource-Keys"] = `${id}/${resourceKey}`;
        let response;
        try {
            response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`, {
                headers, credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(120000),
            });
        } catch {
            throw new Error("Could not reach Google Drive. Check your connection and retry.");
        }
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            const reason = error.error?.errors?.[0]?.reason;
            if (response.status === 404) throw new Error("File not found or not publicly accessible. Check the link and set sharing to Anyone with the link.");
            if (response.status === 429 || reason === "downloadQuotaExceeded") throw new Error("Google Drive’s download limit was reached. Please try again later.");
            if (response.status === 403) throw new Error("Google denied access. Check that Drive API is enabled, the key allows http://localhost:8000/*, and the PDF is public with downloads allowed.");
            if (response.status === 400) throw new Error("Google rejected the request. Check your API key and Drive link.");
            throw new Error(`Google Drive returned HTTP ${response.status}. Please retry.`);
        }
        const data = new Uint8Array(await response.arrayBuffer());
        if (!new TextDecoder().decode(data.subarray(0, 1024)).includes("%PDF-")) {
            throw new Error("This file is not a PDF. Use a PDF uploaded to Drive rather than a Google Docs document or shortcut.");
        }
        return { data };
    }

    async function loadSource(getSource) {
        if (busy) return;
        busy = true;
        dialog.querySelectorAll("button").forEach(button => button.disabled = true);
        status.textContent = "Loading PDF…";
        loader.style.display = "block";
        loader.textContent = "Loading PDF…";
        try {
            const source = await getSource();
            status.textContent = "Preparing flipbook…";
            await window.loadFlipbookSource(source);
            dialog.close();
        } catch (error) {
            // Display only our sanitized Drive errors or PDF parser messages.
            status.textContent = error.message || "Could not load this PDF.";
            loader.style.display = "none";
        } finally {
            busy = false;
            dialog.querySelectorAll("button").forEach(button => button.disabled = false);
        }
    }

    window.openDriveDialog = () => { if (!dialog.open) dialog.showModal(); };
    document.getElementById("sourceBtn").addEventListener("click", window.openDriveDialog);
    document.getElementById("closeDriveBtn").addEventListener("click", () => dialog.close());
    dialog.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
    document.getElementById("driveForm").addEventListener("submit", event => {
        event.preventDefault();
        const key = document.getElementById("driveApiKey").value.trim();
        if (!key) { status.textContent = "Enter your Google Drive API key."; return; }
        loadSource(() => getDrivePdf(document.getElementById("driveLink").value, key));
    });
    document.getElementById("localPdfBtn").addEventListener("click", () => loadSource(() => "./DesignCollection2024.pdf"));
    window.startFlipbook();
})();
