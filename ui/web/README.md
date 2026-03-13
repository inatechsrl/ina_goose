# Agent Core — Web UI

A browser-based frontend for [goosed](../../crates/goose-server), reusing the desktop React components via a platform shim. No desktop code is modified — `window.electron` and `window.appConfig` are polyfilled for the web.

---

## Quick start

### 1. Start the goosed backend

From the repo root:

```bash
# Using a pre-built binary
goosed agent

# Or build and run from source
cargo run -p goose-server --bin goosed -- agent
```

goosed binds to **`https://127.0.0.1:3000`** by default (self-signed TLS cert).

### 2. Start the Web UI

```bash
cd ui/web
npm install      # first time only
npm run dev
```

Open **http://localhost:5173** in your browser.

The Vite dev server proxies all API calls through to goosed, so the browser never touches the self-signed certificate.

---

## Configuration

### goosed environment variables

| Variable | Default | Description |
|---|---|---|
| `GOOSE_SERVER__HOST` | `127.0.0.1` | Bind address (`0.0.0.0` to allow network access) |
| `GOOSE_SERVER__PORT` | `3000` | HTTPS API port |
| `GOOSE_SERVER__SECRET_KEY` | `test` | API auth token sent as `X-Secret-Key` header |

### Web UI environment variables

Create `ui/web/.env` to override defaults:

```bash
# ui/web/.env

# Where the Vite dev proxy forwards API requests (default: https://localhost:3000)
GOOSE_API_HOST=https://localhost:3000

# Override the API key if goosed uses a non-default secret
VITE_GOOSE_SECRET_KEY=test

# Override the goosed API URL for production builds (leave empty to use Vite proxy in dev)
VITE_GOOSE_API_HOST=
```

See `.env.example` for a template.

### Example: custom port and secret key

```bash
# Start goosed on port 4000 with a custom key
GOOSE_SERVER__PORT=4000 GOOSE_SERVER__SECRET_KEY=mysecret goosed agent

# Point the web UI at it
GOOSE_API_HOST=https://localhost:4000 VITE_GOOSE_SECRET_KEY=mysecret npm run dev
```

---

## Working directory

The working directory is **per-session** — it is set when a new chat session is created and defaults to the user's home directory. It can also be changed mid-session from the Settings page.

To set a default working directory for all new sessions, add to `ui/web/.env`:

```bash
VITE_GOOSE_WORKING_DIR=/path/to/your/project
```

---

## Production build

```bash
cd ui/web
npm run build        # outputs to ui/web/dist/
npx serve dist       # or serve with nginx, caddy, etc.
```

For production, set `VITE_GOOSE_API_HOST` to the full goosed URL (e.g. `https://your-server:3000`) and `VITE_GOOSE_SECRET_KEY` to your secret key before building.

---

## Architecture

```
Browser (http://localhost:5173)
    │
    ├── Vite dev server
    │       └── proxy: /config, /sessions, /reply, ... ──► goosed (https://localhost:3000)
    │
    └── React app
            ├── ui/web/src/         — web-specific entry, shim, routing
            ├── @desktop/*          → ui/desktop/src/*  (shared components, zero changes)
            └── window.electron     — polyfilled by platform-shim.ts
```

### How the platform shim works

`src/platform-shim.ts` installs `window.electron` and `window.appConfig` before the React app loads. Desktop components call `window.electron.*` normally — they have no knowledge of whether they're running in Electron or a browser.

| Desktop API | Web implementation |
|---|---|
| `openExternal(url)` | `window.open(url, '_blank')` |
| `getSetting / setSetting` | `localStorage` |
| `showNotification` | Web Notifications API |
| `showMessageBox` | `window.confirm()` |
| `getGoosedHostPort` | `VITE_GOOSE_API_HOST` env var (or empty → Vite proxy) |
| Dock icon, menu bar, wake lock | no-ops |

### Key files

| File | Purpose |
|---|---|
| `src/platform-shim.ts` | `window.electron` + `window.appConfig` polyfills |
| `src/WebApp.tsx` | App shell (BrowserRouter, routes) |
| `src/main.tsx` | Entry point — installs shim, configures API client |
| `vite.config.ts` | Vite config — desktop alias, React dedup, dev proxy |
| `tsconfig.json` | TypeScript config — includes `ui/desktop/src` |
