/**
 * Feature flags system for the web UI.
 *
 * Flags are read from `ui/web/features.config.json` at build time (Vite JSON import).
 * Components use `useFeatureFlags()` to check which features are enabled.
 *
 * To disable a feature, set its value to `false` in features.config.json and rebuild.
 * To re-enable, set it back to `true`.
 */
import { createContext, useContext, ReactNode } from 'react';
import defaultConfig from '../features.config.json';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FeatureFlagsConfig {
  routes: {
    recipes: boolean;
    extensions: boolean;
    permission: boolean;
    schedules: boolean;
  };
  settingsTabs: {
    localInference: boolean;
    chat: boolean;
    session: boolean;
    prompts: boolean;
    keyboard: boolean;
  };
  appSettings: {
    helpAndFeedback: boolean;
    navigation: boolean;
    telemetry: boolean;
    useInatechBranding: boolean;
  };
  features: {
    workingDirectory: boolean;
    fileAttachment: boolean;
    extensionSelection: boolean;
    recipeCreation: boolean;
  };
}

// ── Context ────────────────────────────────────────────────────────────────────

const FeatureFlagsContext = createContext<FeatureFlagsConfig>(defaultConfig as FeatureFlagsConfig);

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  return (
    <FeatureFlagsContext.Provider value={defaultConfig as FeatureFlagsConfig}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags(): FeatureFlagsConfig {
  return useContext(FeatureFlagsContext);
}

// ── Direct config access (for non-React code like useNavigationItems) ──────

export const featureFlags: FeatureFlagsConfig = defaultConfig as FeatureFlagsConfig;
