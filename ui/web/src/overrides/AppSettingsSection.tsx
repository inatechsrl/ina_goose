/**
 * Web override for AppSettingsSection.
 *
 * Removes desktop-only controls that have no meaning in a browser:
 *   - Menu bar icon toggle        (macOS/Windows tray — N/A)
 *   - Dock icon toggle            (macOS dock — N/A)
 *   - Prevent Sleep / wakelock    (OS wakelock — N/A)
 *   - "Open Notification Settings" button  (OS settings dialog — N/A)
 *
 * Everything else is kept: Theme, Navigation, Cost Tracking, Telemetry,
 * Help & Feedback, and Version.
 */
import { useState, useEffect, useRef } from 'react';
import { Button } from '@desktop/components/ui/button';
import { Switch } from '@desktop/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@desktop/components/ui/card';
import ThemeSelector from '@desktop/components/GooseSidebar/ThemeSelector';
import TelemetrySettings from '@desktop/components/settings/app/TelemetrySettings';
import { NavigationProvider, useNavigationContextSafe } from '@desktop/components/Layout/NavigationContext';
import { NavigationModeSelector } from '@desktop/components/settings/app/NavigationModeSelector';
import { NavigationStyleSelector } from '@desktop/components/settings/app/NavigationStyleSelector';
import { NavigationPositionSelector } from '@desktop/components/settings/app/NavigationPositionSelector';
import { NavigationCustomizationSettings } from '@desktop/components/settings/app/NavigationCustomizationSettings';
import { ChevronDown, ChevronUp } from 'lucide-react';
import BlockLogoBlack from '@desktop/components/settings/app/icons/block-lockup_black.png';
import BlockLogoWhite from '@desktop/components/settings/app/icons/block-lockup_white.png';
import { COST_TRACKING_ENABLED, UPDATES_ENABLED } from '@desktop/updates';
import { trackSettingToggled } from '@desktop/utils/analytics';
import UpdateSection from '@desktop/components/settings/app/UpdateSection';

interface AppSettingsSectionProps {
  scrollToSection?: string;
}

const NavigationSettingsContent: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const navContext = useNavigationContextSafe();
  const isOverlayMode = navContext?.navigationMode === 'overlay';

  return (
    <Card className="rounded-lg">
      <CardHeader className="pb-0">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left"
        >
          <div>
            <CardTitle className="mb-1">Navigation</CardTitle>
            <CardDescription>Customize navigation layout and behavior</CardDescription>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-text-secondary" />
          ) : (
            <ChevronDown className="w-5 h-5 text-text-secondary" />
          )}
        </button>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-4 px-4 space-y-6">
          <div>
            <h3 className="text-sm font-medium text-text-primary mb-3">Mode</h3>
            <NavigationModeSelector />
          </div>
          {!isOverlayMode && (
            <div>
              <h3 className="text-sm font-medium text-text-primary mb-3">Style</h3>
              <NavigationStyleSelector />
            </div>
          )}
          {!isOverlayMode && (
            <div>
              <h3 className="text-sm font-medium text-text-primary mb-3">Position</h3>
              <NavigationPositionSelector />
            </div>
          )}
          <div>
            <h3 className="text-sm font-medium text-text-primary mb-3">Customize Items</h3>
            <NavigationCustomizationSettings />
          </div>
        </CardContent>
      )}
    </Card>
  );
};

const NavigationSettingsCard: React.FC = () => {
  const navContext = useNavigationContextSafe();
  if (navContext) return <NavigationSettingsContent />;
  return (
    <NavigationProvider>
      <NavigationSettingsContent />
    </NavigationProvider>
  );
};

export default function AppSettingsSection({ scrollToSection }: AppSettingsSectionProps) {
  const [showPricing, setShowPricing] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const updateSectionRef = useRef<HTMLDivElement>(null);
  const shouldShowUpdates = !window.appConfig.get('GOOSE_VERSION');

  useEffect(() => {
    const updateTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    window.electron.getSetting('showPricing').then(setShowPricing);
  }, []);

  useEffect(() => {
    if (scrollToSection === 'update' && updateSectionRef.current) {
      setTimeout(() => {
        updateSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [scrollToSection]);

  const handleShowPricingToggle = async (checked: boolean) => {
    setShowPricing(checked);
    await window.electron.setSetting('showPricing', checked);
    trackSettingToggled('cost_tracking', checked);
    window.dispatchEvent(new CustomEvent('showPricingChanged'));
  };

  return (
    <div className="space-y-4 pr-4 pb-8 mt-1">
      <Card className="rounded-lg">
        <CardHeader className="pb-0">
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Configure how the app appears</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4 px-4">
          {/* Notifications — web: browser handles these, no OS settings button needed */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-text-primary text-xs">Notifications</h3>
              <p className="text-xs text-text-secondary max-w-md mt-[2px]">
                Notifications use your browser's notification system. Enable them in your browser
                settings if prompted.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if ('Notification' in window && Notification.permission !== 'granted') {
                  Notification.requestPermission();
                }
              }}
              disabled={'Notification' in window && Notification.permission === 'granted'}
            >
              {typeof Notification !== 'undefined' && Notification.permission === 'granted'
                ? 'Enabled'
                : 'Enable'}
            </Button>
          </div>

          {/* Cost Tracking */}
          {COST_TRACKING_ENABLED && (
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-text-primary">Cost Tracking</h3>
                <p className="text-xs text-text-secondary max-w-md mt-[2px]">
                  Show model pricing and usage costs
                </p>
              </div>
              <div className="flex items-center">
                <Switch
                  checked={showPricing}
                  onCheckedChange={handleShowPricingToggle}
                  variant="mono"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader className="pb-0">
          <CardTitle className="mb-1">Theme</CardTitle>
          <CardDescription>Customize the look and feel</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 px-4">
          <ThemeSelector className="w-auto" hideTitle horizontal />
        </CardContent>
      </Card>

      <NavigationSettingsCard />

      <TelemetrySettings isWelcome={false} />

      <Card className="rounded-lg">
        <CardHeader className="pb-0">
          <CardTitle className="mb-1">Help & feedback</CardTitle>
          <CardDescription>
            Help us improve by reporting issues or requesting new features
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 px-4">
          <div className="flex space-x-4">
            <Button
              onClick={() =>
                window.open(
                  'https://github.com/block/goose/issues/new?template=bug_report.md',
                  '_blank'
                )
              }
              variant="secondary"
              size="sm"
            >
              Report a Bug
            </Button>
            <Button
              onClick={() =>
                window.open(
                  'https://github.com/block/goose/issues/new?template=feature_request.md',
                  '_blank'
                )
              }
              variant="secondary"
              size="sm"
            >
              Request a Feature
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Version — shown when GOOSE_VERSION is set (e.g. '1.0.0-web') */}
      {!shouldShowUpdates && (
        <Card className="rounded-lg">
          <CardHeader className="pb-0">
            <CardTitle className="mb-1">Version</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 px-4">
            <div className="flex items-center gap-3">
              <img
                src={isDarkMode ? BlockLogoWhite : BlockLogoBlack}
                alt="Block Logo"
                className="h-8 w-auto"
              />
              <span className="text-2xl font-mono text-black dark:text-white">
                {String(window.appConfig.get('GOOSE_VERSION') || 'Development')}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {UPDATES_ENABLED && shouldShowUpdates && (
        <div ref={updateSectionRef}>
          <Card className="rounded-lg">
            <CardHeader className="pb-0">
              <CardTitle className="mb-1">Updates</CardTitle>
              <CardDescription>Check for and install updates</CardDescription>
            </CardHeader>
            <CardContent className="px-4">
              <UpdateSection />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
