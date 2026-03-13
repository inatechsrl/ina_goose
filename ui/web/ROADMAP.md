# Web UI — Remaining Work

Status of each phase. Phases 1–3 are merged to `main` via PR #3.

---

## ✅ Phase 1 — Core Chat (merged)

- Platform shim (`window.electron` + `window.appConfig` polyfills)
- `@desktop/*` Vite alias to share desktop components with zero modifications
- React deduplication (prevents "Invalid hook call" from dual React copies)
- Vite dev proxy → goosed (`https://localhost:3000`) with `secure: false`
- BrowserRouter + localStorage for settings persistence
- Secret key defaults to `"test"` matching goosed's `GOOSE_SERVER__SECRET_KEY`

## ✅ Phase 2 — Settings & Overrides (merged)

- `webOverridesPlugin` — custom Vite `resolveId` plugin that redirects specific desktop files to web overrides without changing desktop code
- `AppSettingsSection` override — removes Electron-only controls (menu bar icon, wakelock, dock icon, OS notifications), adds browser notification permission, shows `1.0.0-web`
- `SpellcheckToggle` override — replaces broken Electron toggle with informational note
- `DirSwitcher` override — replaces native `directoryChooser` dialog with inline text input

## ✅ Phase 3 — SPA Route / API Proxy Fix (merged)

- `bypass()` function on Vite proxy detects browser navigations (`Accept: text/html`, no `X-Secret-Key`) and serves `index.html`
- Routes like `/recipes`, `/sessions`, `/schedules` now work correctly as both SPA routes and API endpoints

---

## 🔲 Phase 4 — File Operations

**Goal:** Enable file attachment and browsing from the web UI.

### What's currently broken

| Feature | Current behaviour | Root cause |
|---|---|---|
| **Drag-drop file into chat** | `getPathForFile()` returns just the filename (e.g. `"report.pdf"`), goosed can't read it | Browser `File` API doesn't expose real filesystem paths |
| **`@file` mentions** | `selectFileOrDirectory()` returns `{ canceled: true }` — silently does nothing | No native file-picker replacement in the web shim |
| **GooseHints modal** | Opens but loads nothing, saves nothing | `window.electron.readFile()` / `writeFile()` are no-ops |
| **Working directory browser** | User must type a path blind | No server-side directory listing endpoint |

### What this phase enables for the user

- **Attach files to chat** — drag-drop a file from your computer; it gets uploaded to goosed and used as context
- **`@file` mentions** — browse the server filesystem and pick files to reference in a message
- **Edit `.goosehints`** — read and write the hints file from the web UI
- **Browse directories** — a proper folder picker for switching working directories

### Implementation plan

#### 1. New goosed REST endpoints (Rust, `crates/goose-server`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/files/upload` | `POST` (multipart) | Accepts a file from the browser, saves it to a temp directory on the server, returns `{ "path": "/tmp/goose-uploads/<uuid>-<filename>" }` |
| `/files/list` | `GET ?path=/some/dir` | Returns a directory listing (names, types, sizes) for the given server-side path |
| `/files/read` | `GET ?path=/some/file` | Returns file contents (text) for a given server-side path |
| `/files/write` | `POST { path, content }` | Writes text content to a file on the server |

#### 2. Platform shim updates (`ui/web/src/platform-shim.ts`)

- `getPathForFile(file: File)` → upload file via `POST /files/upload`, return the server path
- `selectFileOrDirectory()` → open a web-based file browser component that calls `GET /files/list`
- `readFile(path)` → `GET /files/read?path=...`
- `writeFile(path, content)` → `POST /files/write`

#### 3. Web file browser component (`ui/web/src/overrides/FileBrowser.tsx`)

- Tree or list view of server-side directories
- Used by `@file` mention popover and working directory picker
- Calls `GET /files/list` to populate

#### 4. Cleanup

- Temp upload files should be deleted after session ends or on a schedule
- Consider max file size limits on `/files/upload`

---

## 🔲 Phase 5 — Production Readiness

**Goal:** Make the web UI deployable in production (not just Vite dev mode).

### Tasks

- **Static build** — `npm run build` already produces `dist/`, but needs testing with a real reverse proxy (nginx, caddy)
- **CORS configuration** — goosed needs to accept requests from the production origin (not just `localhost:5173`)
- **TLS termination** — in production the reverse proxy handles TLS; goosed may need a plaintext HTTP mode or the proxy handles the self-signed cert
- **Environment variable injection** — `VITE_GOOSE_API_HOST` and `VITE_GOOSE_SECRET_KEY` must be baked into the build at compile time; document the workflow
- **Auth** — the current `X-Secret-Key: test` is fine for localhost but not for network-exposed deployments; consider token auth, OAuth, or basic auth
- **Docker / docker-compose** — optional: a `Dockerfile` that builds the web UI and runs goosed behind a reverse proxy
- **Health check endpoint** — goosed should expose a lightweight `/health` or `/ping` for load balancers
- **Rate limiting / abuse prevention** — if exposed to the internet

---

## 🔲 Future Ideas (not scoped)

- **Multi-user support** — separate sessions per authenticated user
- **WebSocket reconnection** — graceful reconnect on network drops
- **PWA / offline shell** — service worker for app-like install
- **Mobile-responsive layout** — the desktop UI assumes a wide viewport
- **Theming** — sync dark/light mode with `prefers-color-scheme`
- **Keyboard shortcuts** — re-map Electron accelerators to browser shortcuts
