import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve, dirname } from 'path';

/**
 * Vite plugin that redirects specific desktop source files to web-specific
 * override implementations, without modifying any desktop source files.
 *
 * Works by intercepting the `resolveId` hook: when Vite resolves a relative
 * import that points to a desktop file in our override map, it returns the
 * override file path instead.
 */
function webOverridesPlugin(overrides: Record<string, string>): Plugin {
  // Normalise all keys once at startup
  const normalisedOverrides = Object.fromEntries(
    Object.entries(overrides).map(([k, v]) => [k.replace(/\\/g, '/'), v])
  );

  return {
    name: 'web-overrides',
    enforce: 'pre',
    resolveId(id, importer) {
      if (!importer || !id.startsWith('.')) return null;

      // Resolve the relative import to an absolute path, then normalise separators
      const abs = resolve(dirname(importer), id).replace(/\\/g, '/');

      for (const [from, to] of Object.entries(normalisedOverrides)) {
        if (abs === from || abs === from.replace(/\.(tsx?|jsx?)$/, '')) {
          return to;
        }
      }
      return null;
    },
  };
}

const desktop = (p: string) => resolve(__dirname, '../desktop/src', p);
const override = (p: string) => resolve(__dirname, 'src/overrides', p);

export default defineConfig({
  define: {
    'process.env.ALPHA': JSON.stringify(process.env.ALPHA === 'true'),
    'process.env.GOOSE_TUNNEL': JSON.stringify(
      process.env.GOOSE_TUNNEL !== 'no' && process.env.GOOSE_TUNNEL !== 'none'
    ),
  },

  plugins: [
    react(),
    tailwindcss(),
    webOverridesPlugin({
      // Desktop file (absolute path) → web override file (absolute path)
      [desktop('components/bottom_menu/DirSwitcher.tsx')]:
        override('DirSwitcher.tsx'),
      [desktop('components/settings/app/AppSettingsSection.tsx')]:
        override('AppSettingsSection.tsx'),
      [desktop('components/settings/chat/SpellcheckToggle.tsx')]:
        override('SpellcheckToggle.tsx'),
      // Feature-flags overrides
      [desktop('hooks/useNavigationItems.ts')]:
        override('useNavigationItems.ts'),
      [desktop('components/settings/SettingsView.tsx')]:
        override('SettingsView.tsx'),
      [desktop('components/ChatInput.tsx')]:
        override('ChatInput.tsx'),
      [desktop('components/bottom_menu/BottomMenuExtensionSelection.tsx')]:
        override('BottomMenuExtensionSelection.tsx'),
    }),
  ],

  resolve: {
    alias: {
      // Resolve imports from desktop/src so we can reuse components directly
      '@desktop': resolve(__dirname, '../desktop/src'),
      // Force all React imports (including from desktop's components) to use
      // the web package's single copy of React — prevents "invalid hook call"
      react: resolve(__dirname, 'node_modules/react'),
      'react-dom': resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime': resolve(__dirname, 'node_modules/react/jsx-runtime'),
      'react/jsx-dev-runtime': resolve(__dirname, 'node_modules/react/jsx-dev-runtime'),
    },
    dedupe: ['react', 'react-dom'],
  },

  build: {
    target: 'esnext',
    outDir: 'dist',
  },

  server: {
    port: 5173,
    open: true,
    fs: {
      // Allow serving files from the desktop source (shared components)
      allow: ['.', '../desktop/src', '../../node_modules'],
    },
    proxy: {
      // Proxy API requests to the goosed backend.
      // This avoids browser self-signed certificate errors during development.
      // The target defaults to https://localhost:3000; override with GOOSE_API_HOST env var.
      //
      // IMPORTANT: some API path prefixes (recipes, sessions, schedules, search) collide
      // with frontend SPA routes of the same name. The `bypass` function resolves this:
      // browser navigations carry `Accept: text/html` and no X-Secret-Key header →
      // serve index.html (SPA). API calls from the React app carry X-Secret-Key →
      // proxy to goosed.
      '^/(reply|action-required|agent|dictation|local-inference|config|recipes|sessions|schedule|schedules|status|telemetry|tunnel|gateway|mcp-ui-proxy|mcp-app-proxy|mcp-app-guest|handle_openrouter|handle_tetrate|search)': {
        target: process.env.GOOSE_API_HOST || 'https://localhost:3000',
        changeOrigin: true,
        secure: false, // accept self-signed TLS certs
        ws: true,      // proxy WebSocket/SSE connections
        bypass(req) {
          // If the request looks like browser navigation (accepts HTML and has no
          // API secret key), serve the SPA instead of proxying to goosed.
          const accept = req.headers['accept'] ?? '';
          const hasSecretKey = !!req.headers['x-secret-key'];
          if (!hasSecretKey && accept.includes('text/html')) {
            return '/index.html';
          }
          return null; // proxy to goosed
        },
      },
    },
  },
});
