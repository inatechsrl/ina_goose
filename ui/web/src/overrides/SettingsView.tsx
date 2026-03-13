/**
 * Web override for SettingsView.
 *
 * Filters settings tabs based on feature flags from features.config.json.
 * Always shows: Models, App.
 * Conditionally shows: Local Inference, Chat, Session, Prompts, Keyboard.
 */
import { ScrollArea } from '@desktop/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@desktop/components/ui/tabs';
import { View, ViewOptions } from '@desktop/utils/navigationUtils';
import ModelsSection from '@desktop/components/settings/models/ModelsSection';
import SessionSharingSection from '@desktop/components/settings/sessions/SessionSharingSection';
import ExternalBackendSection from '@desktop/components/settings/app/ExternalBackendSection';
// Import from override directly — @desktop/ alias bypasses the webOverridesPlugin
import AppSettingsSection from './AppSettingsSection';
import ConfigSettings from '@desktop/components/settings/config/ConfigSettings';
import PromptsSettingsSection from '@desktop/components/settings/PromptsSettingsSection';
import { ExtensionConfig } from '@desktop/api';
import { MainPanelLayout } from '@desktop/components/Layout/MainPanelLayout';
import { Bot, Share2, Monitor, MessageSquare, FileText, Keyboard, HardDrive } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState, useEffect, useRef, ReactNode } from 'react';
import TunnelSection from '@desktop/components/settings/tunnel/TunnelSection';
import GatewaySettingsSection from '@desktop/components/settings/gateways/GatewaySettingsSection';
import { getTunnelStatus } from '@desktop/api/sdk.gen';
import ChatSettingsSection from '@desktop/components/settings/chat/ChatSettingsSection';
import KeyboardShortcutsSection from '@desktop/components/settings/keyboard/KeyboardShortcutsSection';
import LocalInferenceSection from '@desktop/components/settings/localInference/LocalInferenceSection';
import { CONFIGURATION_ENABLED } from '@desktop/updates';
import { trackSettingsTabViewed } from '@desktop/utils/analytics';
import { useFeatureFlags } from '../feature-flags';

export type SettingsViewOptions = {
  deepLinkConfig?: ExtensionConfig;
  showEnvVars?: boolean;
  section?: string;
};

// ── Tab definitions ────────────────────────────────────────────────────────────

interface TabDef {
  value: string;
  label: string;
  icon: LucideIcon;
  testId: string;
  flagKey?: string; // key into featureFlags.settingsTabs; undefined = always shown
  content: (props: {
    setView: (view: View, viewOptions?: ViewOptions) => void;
    viewOptions: SettingsViewOptions;
    tunnelDisabled: boolean;
  }) => ReactNode;
}

const TAB_DEFS: TabDef[] = [
  {
    value: 'models',
    label: 'Models',
    icon: Bot,
    testId: 'settings-models-tab',
    content: ({ setView }) => <ModelsSection setView={setView} />,
  },
  {
    value: 'local-inference',
    label: 'Local Inference',
    icon: HardDrive,
    testId: 'settings-local-inference-tab',
    flagKey: 'localInference',
    content: () => <LocalInferenceSection />,
  },
  {
    value: 'chat',
    label: 'Chat',
    icon: MessageSquare,
    testId: 'settings-chat-tab',
    flagKey: 'chat',
    content: () => <ChatSettingsSection />,
  },
  {
    value: 'sharing',
    label: 'Session',
    icon: Share2,
    testId: 'settings-sharing-tab',
    flagKey: 'session',
    content: ({ tunnelDisabled }) => (
      <div className="space-y-8 pb-8">
        <SessionSharingSection />
        <ExternalBackendSection />
        {!tunnelDisabled && (
          <div className="space-y-4">
            <TunnelSection />
            <GatewaySettingsSection />
          </div>
        )}
      </div>
    ),
  },
  {
    value: 'prompts',
    label: 'Prompts',
    icon: FileText,
    testId: 'settings-prompts-tab',
    flagKey: 'prompts',
    content: () => <PromptsSettingsSection />,
  },
  {
    value: 'keyboard',
    label: 'Keyboard',
    icon: Keyboard,
    testId: 'settings-keyboard-tab',
    flagKey: 'keyboard',
    content: () => <KeyboardShortcutsSection />,
  },
  {
    value: 'app',
    label: 'App',
    icon: Monitor,
    testId: 'settings-app-tab',
    content: ({ viewOptions }) => (
      <div className="space-y-8">
        {CONFIGURATION_ENABLED && <ConfigSettings />}
        <AppSettingsSection scrollToSection={viewOptions.section} />
      </div>
    ),
  },
];

// ── Section-to-tab mapping (for deep links) ────────────────────────────────────

const SECTION_TO_TAB: Record<string, string> = {
  update: 'app',
  models: 'models',
  modes: 'chat',
  sharing: 'sharing',
  styles: 'chat',
  tools: 'chat',
  app: 'app',
  chat: 'chat',
  prompts: 'prompts',
  keyboard: 'keyboard',
  gateway: 'sharing',
  'local-inference': 'local-inference',
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function SettingsView({
  onClose,
  setView,
  viewOptions,
}: {
  onClose: () => void;
  setView: (view: View, viewOptions?: ViewOptions) => void;
  viewOptions: SettingsViewOptions;
}) {
  const flags = useFeatureFlags();
  const [tunnelDisabled, setTunnelDisabled] = useState(false);
  const hasTrackedInitialTab = useRef(false);

  // Filter tabs based on feature flags
  const enabledTabs = TAB_DEFS.filter((tab) => {
    if (!tab.flagKey) return true; // Always shown
    return (flags.settingsTabs as Record<string, boolean>)[tab.flagKey] !== false;
  });

  // Determine initial tab — fall back to first enabled tab if deep-linked tab is disabled
  const getInitialTab = () => {
    if (viewOptions.section) {
      const targetTab = SECTION_TO_TAB[viewOptions.section];
      if (targetTab && enabledTabs.some((t) => t.value === targetTab)) {
        return targetTab;
      }
    }
    return enabledTabs[0]?.value ?? 'models';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    trackSettingsTabViewed(tab);
  };

  // Update tab if section prop changes
  useEffect(() => {
    if (viewOptions.section) {
      const targetTab = SECTION_TO_TAB[viewOptions.section];
      if (targetTab && enabledTabs.some((t) => t.value === targetTab)) {
        setActiveTab(targetTab);
      }
    }
  }, [viewOptions.section, enabledTabs]);

  useEffect(() => {
    if (!hasTrackedInitialTab.current) {
      trackSettingsTabViewed(activeTab);
      hasTrackedInitialTab.current = true;
    }
  }, [activeTab]);

  useEffect(() => {
    getTunnelStatus()
      .then(({ data }) => {
        setTunnelDisabled(data?.state === 'disabled');
      })
      .catch(() => {
        setTunnelDisabled(false);
      });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <>
      <MainPanelLayout>
        <div className="flex-1 flex flex-col min-h-0">
          <div className="bg-background-primary px-8 pb-8 pt-16">
            <div className="flex flex-col page-transition">
              <div className="flex justify-between items-center mb-1">
                <h1 className="text-4xl font-light">Settings</h1>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 relative px-6">
            <Tabs
              value={activeTab}
              onValueChange={handleTabChange}
              className="h-full flex flex-col"
            >
              <div className="px-1">
                <TabsList className="w-full mb-2 justify-start overflow-x-auto flex-nowrap">
                  {enabledTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className="flex gap-2"
                        data-testid={tab.testId}
                      >
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              <ScrollArea className="flex-1 px-2">
                {enabledTabs.map((tab) => (
                  <TabsContent
                    key={tab.value}
                    value={tab.value}
                    className="mt-0 focus-visible:outline-none focus-visible:ring-0"
                  >
                    {tab.content({ setView, viewOptions, tunnelDisabled })}
                  </TabsContent>
                ))}
              </ScrollArea>
            </Tabs>
          </div>
        </div>
      </MainPanelLayout>
    </>
  );
}
