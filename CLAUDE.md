# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**0x3 Nav** is a minimalist navigation/bookmark page with a Koa (Node.js) backend and Vue 3 frontend. Features dynamic MySQL database configuration (set up at first visit), 2FA (TOTP) authentication for the admin panel, and favicon caching. Single-admin model — no user registration, only one 2FA secret stored globally in `SystemConfig`.

## Development Commands

### Database (required first)
```bash
docker-compose up -d mysql        # MySQL 8.0 on port 3306, root/rootpassword, db: nav
```

### Backend (server/)
```bash
cd server
pnpm install
pnpm dev       # node --watch app.js, runs on :3000
pnpm start     # node app.js (production)
```

### Frontend (client/)
```bash
cd client
pnpm install
pnpm dev       # Vite dev server on :5173, proxies /api and /data to :3000
pnpm build     # Production build → client/dist/
pnpm preview   # Preview production build
```

There are **no tests, linters, or formatters** configured in the project.

## Architecture

### Runtime flow
1. On startup, server checks `/app/data/config.json` for DB credentials. If absent, the app is in "setup mode."
2. First visit redirects to `/setup` where the admin enters MySQL credentials and binds 2FA.
3. Config is saved to `/app/data/config.json`; 2FA secret goes into `SystemConfig` table.
4. Login requires only a TOTP code (no username/password). JWT issued with `{ role: 'admin' }`, expires in 7 days.

### Backend (server/) — single file: `app.js`
- **Framework**: Koa with `koa-router`, `koa-bodyparser`, `koa-cors`, `koa-static`
- **Database**: Sequelize ORM over MySQL (`mysql2`). Models defined in `models.js`: `SystemConfig` (2FA secret) and `Site` (title, url, icon, category).
- **Auth**: JWT middleware (`authMiddleware`) checks `Authorization: Bearer <token>` and verifies `role === 'admin'`. Protected routes use this middleware; public routes (`GET /api/sites`, `GET /api/setup-status`, `POST /api/login`) do not.
- **Icons**: Favicons are downloaded from websites via `axios`+`cheerio`, saved as files under `/app/data/icons/`, and served statically at `/data/icons/`. Legacy base64 icons are auto-migrated to files on read.
- **Static serving**: In production, serves `../client/dist/` with SPA fallback to `index.html`.

### Frontend (client/) — Vue 3 + Vite
- **Routing**: `vue-router` with 3 routes: `/` (Home), `/login` (Login), `/setup` (Setup). Navigation guard in `router/index.js` checks `/api/setup-status` on every route change and redirects to `/setup` if needed.
- **State**: Pinia store `stores/auth.js` manages JWT token in `localStorage` and sets `axios` default headers. Axios interceptor auto-logs-out on 401.
- **Styling**: Tailwind CSS. Icons from `lucide-vue-next`.
- **API calls**: Direct `axios` calls in components (no separate API layer).

### Key files
| File | Purpose |
|---|---|
| `server/app.js` | All backend routes and middleware (single file) |
| `server/models.js` | Sequelize model definitions and DB init |
| `client/src/router/index.js` | Route definitions and setup-status guard |
| `client/src/stores/auth.js` | Auth state, token persistence, 401 interceptor |
| `client/vite.config.js` | Dev proxy config for `/api` → `:3000` |

## Conventions

- **Package manager**: pnpm (used in both client/ and server/)
- **Backend modules**: CommonJS (`require`/`module.exports`)
- **Frontend modules**: ESM (`import`/`export`), `<script setup>` syntax
- **Indentation**: 2 spaces, single quotes
- **API style**: RESTful JSON. Auth via `Authorization: Bearer <token>` header. Error responses: `{ error: 'message' }`.
- **Naming**: Vue components PascalCase, API endpoints kebab-case (`/api/setup-status`, `/api/fetch-favicon`), DB fields camelCase

## Data Persistence

The Docker volume at `/app/data` stores:
- `config.json` — MySQL connection credentials
- `icons/` — cached favicon files

This directory must be persisted across container restarts or the app will return to setup mode.
