import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  define: {
    'process.env.ALPHA': JSON.stringify(process.env.ALPHA === 'true'),
    'process.env.GOOSE_TUNNEL': JSON.stringify(
      process.env.GOOSE_TUNNEL !== 'no' && process.env.GOOSE_TUNNEL !== 'none'
    ),
  },

  plugins: [react(), tailwindcss()],

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
      '^/(reply|action-required|agent|dictation|local-inference|config|recipes|sessions|schedule|status|telemetry|tunnel|gateway|mcp-ui-proxy|mcp-app-proxy|mcp-app-guest|handle_openrouter|handle_tetrate|search)': {
        target: process.env.GOOSE_API_HOST || 'https://localhost:3000',
        changeOrigin: true,
        secure: false, // accept self-signed TLS certs
        ws: true, // proxy WebSocket/SSE connections
      },
    },
  },
});
