# Flipbook repository

The root `index.html` and `index2.html` are the existing LAPP viewers.
The current Bristol viewer lives in `Bristol Flipbook/index.html`.

## Bristol improvements

Compared with the previous Bristol viewer at commit 134ca48:

- Uses StPageFlip instead of jQuery/turn.js.
- Loads public Google Drive PDFs with a browser API key, with a local catalogue fallback.
- Splits landscape PDF spreads into left/right pages and inserts alignment blanks.
- Caches actual rendered canvases, queues rendering, and reuses pages during resize/fullscreen.
- Adds fullscreen, pointer-centered zoom/pan, edge page turning, and revised styling.
- Includes a WordPress shortcode plugin with automatic Drive loading.
- Retains arrow-key navigation, while ignoring input fields and the Drive dialog.

The old viewer already had lazy loading, zoom, touch gestures, and page sounds.
Its canvas cache used cloneNode, which does not copy canvas pixels. The new
implementation reuses rendered canvases directly.

## Local preview

Serve this repository using a local HTTP server, then open
`/Bristol%20Flipbook/`. Add `?drive` to open the Drive source dialog immediately.
The local DesignCollection2024.pdf is unchanged. Drive requires a public,
downloadable PDF and a Drive API browser key with suitable website restrictions.

## WordPress

Install `Bristol Flipbook/wordpress/bristol-flipbook.zip`, configure the key in
Settings > Bristol Flipbook, then use `[bristol_flipbook catalogue="syron"]`.
Rebuild viewer assets with `node "Bristol Flipbook/wordpress/build.cjs"` before
repackaging the `bristol-flipbook` plugin directory.

## Validation and limits

The included Node regression tests cover Drive loading, spread geometry,
automatic loading, fullscreen failures, lazy rendering, resize preservation,
and zoom/pan. PHP syntax can be checked with `php -l`.
This migration does not constitute a fresh live WordPress or Google Drive test.
Both versions rely on external CDN libraries. The new standalone viewer is a
full-page app; use the WordPress iframe integration for embedding. The former
Magento RequireJS workaround is not carried into the new viewer.
