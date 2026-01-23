# Fusco Family Hub

A lightweight, GitHub Pages-hosted family dashboard.

## Repo layout
- `index.html`, `app.css`, `app.js` — app shell
- `data/hub.json` — cloud-readable shared state (cross-device)
- `assets/` — icons + favicons
- `manifest.webmanifest` + `service-worker.js` — PWA install support

## Cloud data
The app loads from:
- `./data/hub.json`

## Next steps
- Add “Save to Cloud” (GitHub Action commit workflow)
- Add modules (weather, chores, calendar embeds, etc.)
