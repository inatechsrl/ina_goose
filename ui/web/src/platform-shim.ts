/**
 * Web Platform Shim
 *
 * Provides web-compatible implementations of window.electron and window.appConfig
 * so that existing desktop React components work in a browser without modification.
 *
 * Methods are implemented as follows:
 * - Critical methods: fully implemented with web equivalents
 * - Non-critical methods: stubbed as no-ops or simple fallbacks
 * - Desktop-only methods: no-ops (e.g., system tray, dock icon)
 */

import type { Settings, SettingKey } from '@desktop/utils/settings';
import { defaultSettings } from '@desktop/utils/settings';

// ─── Configuration ──────────────────────────────────────────────────────────

// In dev mode, leave empty so API calls go through the Vite proxy (which handles
// the self-signed cert). In production, set VITE_GOOSE_API_HOST to the goosed URL.
const GOOSE_API_HOST =
  (import.meta as unknown as Record<string, Record<string, unknown>>).env?.VITE_GOOSE_API_HOST ??
  '';
// Default secret key matches goosed's default (GOOSE_SERVER__SECRET_KEY env var).
// Override with VITE_GOOSE_SECRET_KEY if goosed uses a custom key.
const GOOSE_SECRET_KEY =
  (import.meta as unknown as Record<string, Record<string, unknown>>).env
    ?.VITE_GOOSE_SECRET_KEY ?? 'test';

// ─── Settings persistence via localStorage ──────────────────────────────────

const SETTINGS_KEY = 'agent-core-settings';

function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch {
    // ignore parse errors
  }
  return { ...defaultSettings };
}

function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota errors
  }
}

// ─── Platform detection ─────────────────────────────────────────────────────

function detectPlatform(): string {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) return 'darwin';
  if (ua.includes('win')) return 'win32';
  return 'linux';
}

// ─── IPC event stub (no-op event bus for compatibility) ─────────────────────

type IpcHandler = (...args: unknown[]) => void;
const ipcListeners = new Map<string, Set<IpcHandler>>();

// ─── Install shims ──────────────────────────────────────────────────────────

export function installPlatformShim(): void {
  // Skip if already installed (e.g., running inside Electron)
  if (window.electron) return;

  const settings = loadSettings();

  const electronShim = {
    platform: detectPlatform(),

    // ── Lifecycle ──
    reactReady: () => {
      /* no-op in web */
    },
    getConfig: () => ({}),
    hideWindow: () => {
      /* no-op */
    },
    closeWindow: () => {
      /* no-op */
    },
    reloadApp: () => window.location.reload(),
    getVersion: () => '1.0.0-web',

    // ── Window management ──
    createChatWindow: () => {
      /* no-op — single window in web */
    },

    // ── Logging ──
    logInfo: (txt: string) => console.log('[goose]', txt),

    // ── Notifications ──
    showNotification: (data: { title: string; body: string }) => {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(data.title, { body: data.body });
      } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') {
            new Notification(data.title, { body: data.body });
          }
        });
      }
    },

    // ── Dialogs ──
    showMessageBox: async (options: { message: string; detail?: string; buttons?: string[] }) => {
      const text = options.detail ? `${options.message}\n\n${options.detail}` : options.message;
      const confirmed = window.confirm(text);
      return { response: confirmed ? 0 : 1 };
    },

    showSaveDialog: async () => {
      // Web can't show native save dialogs — return cancelled
      return { canceled: true, filePath: undefined };
    },

    // ── External links ──
    openExternal: async (url: string) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    openInChrome: (url: string) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    },

    // ── File operations ──
    getPathForFile: (file: File) => {
      // In web, there is no filesystem path. Return the file name.
      // Components that need the actual content should use the File object directly.
      return file.name;
    },

    selectFileOrDirectory: async () => {
      // Web file picker would need to be triggered differently
      return null;
    },

    directoryChooser: async () => {
      return { canceled: true, filePaths: [] };
    },

    readFile: async () => {
      return { file: '', filePath: '' };
    },

    writeFile: async () => false,

    ensureDirectory: async () => false,

    listFiles: async () => [] as string[],

    getAllowedExtensions: async () => [] as string[],

    getBinaryPath: async () => '',

    fetchMetadata: async () => '',

    openDirectoryInExplorer: async () => false,

    addRecentDir: async () => false,

    // ── Settings ──
    getSetting: async <K extends SettingKey>(key: K): Promise<Settings[K]> => {
      const current = loadSettings();
      return current[key];
    },

    setSetting: async <K extends SettingKey>(key: K, value: Settings[K]): Promise<void> => {
      const current = loadSettings();
      current[key] = value;
      saveSettings(current);
    },

    getSecretKey: async () => GOOSE_SECRET_KEY,
    getGoosedHostPort: async () => GOOSE_API_HOST,

    // ── Desktop-only features (no-ops) ──
    setMenuBarIcon: async () => false,
    getMenuBarIconState: async () => false,
    setDockIcon: async () => false,
    getDockIconState: async () => false,
    setWakelock: async () => false,
    getWakelockState: async () => false,
    setSpellcheck: async () => false,
    getSpellcheckState: async () => false,
    openNotificationsSettings: async () => false,
    checkForOllama: async () => false,

    // ── IPC events (stub) ──
    on: (channel: string, callback: IpcHandler) => {
      if (!ipcListeners.has(channel)) {
        ipcListeners.set(channel, new Set());
      }
      ipcListeners.get(channel)!.add(callback);
    },
    off: (channel: string, callback: IpcHandler) => {
      ipcListeners.get(channel)?.delete(callback);
    },
    emit: (channel: string, ...args: unknown[]) => {
      ipcListeners.get(channel)?.forEach((cb) => cb({}, ...args));
    },

    // ── Theme ──
    broadcastThemeChange: () => {
      /* no-op — single window in web */
    },

    // ── Mouse ──
    onMouseBackButtonClicked: () => {
      /* no-op */
    },
    offMouseBackButtonClicked: () => {
      /* no-op */
    },

    // ── Updates (not applicable to web) ──
    checkForUpdates: async () => ({ updateInfo: null, error: null }),
    downloadUpdate: async () => ({ success: false, error: 'Not available in web' }),
    installUpdate: () => {
      /* no-op */
    },
    restartApp: () => window.location.reload(),
    onUpdaterEvent: () => {
      /* no-op */
    },
    getUpdateState: async () => null,
    isUsingGitHubFallback: async () => false,

    // ── Recipes ──
    hasAcceptedRecipeBefore: async () => false,
    recordRecipeHash: async () => true,

    // ── Apps ──
    launchApp: async () => {
      /* no-op */
    },
    refreshApp: async () => {
      /* no-op */
    },
    closeApp: async () => {
      /* no-op */
    },
  };

  // Install on window
  (window as unknown as Record<string, unknown>).electron = electronShim;

  // Install appConfig
  const appConfig = {
    get: (key: string): unknown => {
      const config: Record<string, unknown> = {
        GOOSE_API_HOST: GOOSE_API_HOST,
        GOOSE_WORKING_DIR: '',
        GOOSE_DEFAULT_PROVIDER: '',
        GOOSE_DEFAULT_MODEL: '',
        GOOSE_PREDEFINED_MODELS: '',
        GOOSE_ALLOWLIST_WARNING: false,
        GOOSE_VERSION: '1.0.0-web',
      };
      return config[key];
    },
    getAll: () => ({
      GOOSE_API_HOST: GOOSE_API_HOST,
      GOOSE_WORKING_DIR: '',
    }),
  };

  (window as unknown as Record<string, unknown>).appConfig = appConfig;
}
