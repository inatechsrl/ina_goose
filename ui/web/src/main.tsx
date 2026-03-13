/**
 * Web entry point — equivalent to desktop's renderer.tsx but without Electron.
 *
 * 1. Installs the platform shim (window.electron + window.appConfig polyfills)
 * 2. Configures the API client with the goosed backend URL
 * 3. Renders the WebApp component
 */

// Install platform shim BEFORE any other imports that may reference window.electron
import { installPlatformShim } from './platform-shim';
installPlatformShim();

// Import TailwindCSS styles (must be processed by the Vite TailwindCSS plugin)
import '@desktop/styles/main.css';

import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from '@desktop/components/ConfigContext';
import { ErrorBoundary } from '@desktop/components/ErrorBoundary';
import SuspenseLoader from '@desktop/suspense-loader';
import { client } from '@desktop/api/client.gen';
import { setTelemetryEnabled } from '@desktop/utils/analytics';
import { readConfig } from '@desktop/api';
import { applyThemeTokens } from '@desktop/theme/theme-tokens';

// Apply theme tokens to :root before first paint
applyThemeTokens();

const WebApp = lazy(() => import('./WebApp'));

const TELEMETRY_CONFIG_KEY = 'GOOSE_TELEMETRY_ENABLED';

(async () => {
  const gooseApiHost = await window.electron.getGoosedHostPort();
  if (gooseApiHost === null) {
    document.getElementById('root')!.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#888;">
        <div style="text-align:center">
          <h2>Cannot connect to goosed backend</h2>
          <p>Make sure <code>goosed agent</code> is running and set <code>VITE_GOOSE_API_HOST</code> to its URL.</p>
          <p>Default: <code>http://localhost:3000</code></p>
        </div>
      </div>
    `;
    return;
  }

  console.log('Connecting to goosed at', gooseApiHost);

  const secretKey = await window.electron.getSecretKey();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (secretKey) {
    headers['X-Secret-Key'] = secretKey;
  }

  client.setConfig({
    baseUrl: gooseApiHost,
    headers,
  });

  try {
    const telemetryResponse = await readConfig({
      body: { key: TELEMETRY_CONFIG_KEY, is_secret: false },
    });
    const isTelemetryEnabled = telemetryResponse.data !== false;
    setTelemetryEnabled(isTelemetryEnabled);
  } catch (error) {
    console.warn('[Analytics] Failed to initialize analytics:', error);
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Suspense fallback={SuspenseLoader()}>
        <ConfigProvider>
          <ErrorBoundary>
            <WebApp />
          </ErrorBoundary>
        </ConfigProvider>
      </Suspense>
    </React.StrictMode>
  );
})();
