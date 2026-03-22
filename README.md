# Fusco Family Hub

A polished, mobile-first family command center with:
- **Static GitHub Pages frontend** (`index.html`, `app.css`, `app.js`)
- **Cloudflare Worker backend** (`worker/src/index.js`)
- **Cloudflare D1 persistence** via `env.DB` binding (`fuscohub-db`)

## Frontend and API wiring

The frontend calls the Worker API from one obvious config line:

- `app.js` → `const API_BASE_URL = "https://fuscohub-api.michael-r-fusco.workers.dev";`

If you move to a custom domain later (for example `https://api.fuscohub.com`), update that single constant.

## Core sections

- Header / Today (greeting, date, refresh, last sync)
- Tasks (add/edit/delete/complete, assignee, completed strikethrough)
- Notes (add/edit/delete, pin/unpin)
- Meals (weekly entries with day/meal/notes)
- Quick Links (title/url/icon with clean cards)

## Worker API routes

- `GET/POST /api/tasks`
- `PUT/DELETE /api/tasks/:id`
- `GET/POST /api/notes`
- `PUT/DELETE /api/notes/:id`
- `GET/POST /api/meals`
- `PUT/DELETE /api/meals/:id`
- `GET/POST /api/links`
- `PUT/DELETE /api/links/:id`

Includes JSON responses, basic validation, CORS headers, OPTIONS preflight handling, and safe table initialization.

## Files to edit later

- **Styling/theme/layout**: `app.css`
- **Section text/structure**: `index.html`
- **Behavior + API URL + UI interaction logic**: `app.js`
- **Backend schema/routes/validation**: `worker/src/index.js`

## Notes

- No auth/passcodes/accounts are included by design.
- Shared data source of truth is D1 via Worker APIs (not localStorage).
- Sync model is simple **manual refresh-to-sync** for v1.


## Deploying the Cloudflare Worker

The API Worker source is in `worker/src/index.js`, and deployment is configured by `worker/wrangler.toml` with Worker name `fuscohub-api`.

1. Set the real D1 database UUID in `worker/wrangler.toml` (`database_id`).
2. Authenticate with Cloudflare:
   - `npx wrangler login`
3. Deploy this Worker entrypoint to the existing Worker name:
   - `npx wrangler deploy --config worker/wrangler.toml`

After deploy, verify:
- `curl https://fuscohub-api.michael-r-fusco.workers.dev/api/tasks` returns JSON.
