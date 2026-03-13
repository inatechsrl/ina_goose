/**
 * WebApp — Web-specific app shell.
 *
 * Stripped-down version of the desktop App.tsx that:
 * - Uses BrowserRouter instead of HashRouter
 * - Removes all Electron IPC listeners
 * - Only includes Phase 1 routes (hub, pair, welcome, settings, sessions)
 * - Keeps all desktop-only features disabled
 */

import { useEffect, useState, useRef } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
  useSearchParams,
} from 'react-router-dom';
import { ErrorUI } from '@desktop/components/ErrorBoundary';
import { ToastContainer } from 'react-toastify';
import TelemetryOptOutModal from '@desktop/components/TelemetryOptOutModal';
import ProviderGuard from '@desktop/components/ProviderGuard';
import { createSession } from '@desktop/sessions';

import { ChatType } from '@desktop/types/chat';
import Hub from '@desktop/components/Hub';
import { UserInput } from '@desktop/types/message';

interface PairRouteState {
  resumeSessionId?: string;
  initialMessage?: UserInput;
}
import SettingsView, { SettingsViewOptions } from '@desktop/components/settings/SettingsView';
import SessionsView from '@desktop/components/sessions/SessionsView';
import ProviderSettings from '@desktop/components/settings/providers/ProviderSettingsPage';
import { AppLayout } from '@desktop/components/Layout/AppLayout';
import { ChatProvider, DEFAULT_CHAT_TITLE } from '@desktop/contexts/ChatContext';

import 'react-toastify/dist/ReactToastify.css';
import { useConfig } from '@desktop/components/ConfigContext';
import { ModelAndProviderProvider } from '@desktop/components/ModelAndProviderContext';
import { ThemeProvider } from '@desktop/contexts/ThemeContext';
import PermissionSettingsView from '@desktop/components/settings/permission/PermissionSetting';

import ExtensionsView, {
  ExtensionsViewOptions,
} from '@desktop/components/extensions/ExtensionsView';
import RecipesView from '@desktop/components/recipes/RecipesView';
import AppsView from '@desktop/components/apps/AppsView';
import StandaloneAppView from '@desktop/components/apps/StandaloneAppView';
import SchedulesView from '@desktop/components/schedule/SchedulesView';
import SharedSessionView from '@desktop/components/sessions/SharedSessionView';
import { View, ViewOptions } from '@desktop/utils/navigationUtils';

import { useNavigation } from '@desktop/hooks/useNavigation';
import { errorMessage } from '@desktop/utils/conversionUtils';
import { getInitialWorkingDir } from '@desktop/utils/workingDir';
import { usePageViewTracking } from '@desktop/hooks/useAnalytics';
import { trackOnboardingCompleted, trackErrorWithContext } from '@desktop/utils/analytics';
import { AppEvents } from '@desktop/constants/events';

function PageViewTracker() {
  usePageViewTracking();
  return null;
}

// Route Components
const HubRouteWrapper = () => {
  const setView = useNavigation();
  return <Hub setView={setView} />;
};

const PairRouteWrapper = ({
  activeSessions,
}: {
  activeSessions: Array<{
    sessionId: string;
    initialMessage?: UserInput;
  }>;
  setActiveSessions: (sessions: Array<{ sessionId: string; initialMessage?: UserInput }>) => void;
}) => {
  const { extensionsList } = useConfig();
  const location = useLocation();
  const routeState =
    (location.state as PairRouteState) || (window.history.state as PairRouteState) || {};
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const resumeSessionId = searchParams.get('resumeSessionId') ?? undefined;
  const recipeDeeplinkFromConfig = window.appConfig?.get('recipeDeeplink') as string | undefined;
  const recipeIdFromConfig = window.appConfig?.get('recipeId') as string | undefined;
  const initialMessage = routeState.initialMessage;

  useEffect(() => {
    if (
      (initialMessage || recipeDeeplinkFromConfig || recipeIdFromConfig) &&
      !resumeSessionId &&
      !isCreatingSession
    ) {
      setIsCreatingSession(true);

      (async () => {
        try {
          const newSession = await createSession(getInitialWorkingDir(), {
            recipeDeeplink: recipeDeeplinkFromConfig,
            recipeId: recipeIdFromConfig,
            allExtensions: extensionsList,
          });

          window.dispatchEvent(
            new CustomEvent(AppEvents.ADD_ACTIVE_SESSION, {
              detail: {
                sessionId: newSession.id,
                initialMessage,
              },
            })
          );

          setSearchParams((prev) => {
            prev.set('resumeSessionId', newSession.id);
            return prev;
          });
        } catch (error) {
          console.error('Failed to create session:', error);
          trackErrorWithContext(error, {
            component: 'PairRouteWrapper',
            action: 'create_session',
            recoverable: true,
          });
        } finally {
          setIsCreatingSession(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initialMessage,
    recipeDeeplinkFromConfig,
    recipeIdFromConfig,
    resumeSessionId,
    setSearchParams,
    extensionsList,
  ]);

  useEffect(() => {
    if (resumeSessionId && !activeSessions.some((s) => s.sessionId === resumeSessionId)) {
      window.dispatchEvent(
        new CustomEvent(AppEvents.ADD_ACTIVE_SESSION, {
          detail: {
            sessionId: resumeSessionId,
            initialMessage: initialMessage,
          },
        })
      );
    }
  }, [resumeSessionId, activeSessions, initialMessage]);

  return null;
};

const SettingsRoute = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setView = useNavigation();

  const viewOptions =
    (location.state as SettingsViewOptions) || (window.history.state as SettingsViewOptions) || {};

  const sectionFromUrl = searchParams.get('section');
  if (sectionFromUrl) {
    viewOptions.section = sectionFromUrl;
  }

  return <SettingsView onClose={() => navigate('/')} setView={setView} viewOptions={viewOptions} />;
};

const SessionsRoute = () => {
  return <SessionsView />;
};

const SchedulesRoute = () => {
  const navigate = useNavigate();
  return <SchedulesView onClose={() => navigate('/')} />;
};

const RecipesRoute = () => {
  return <RecipesView />;
};

const PermissionRoute = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const parentView = location.state?.parentView as View;
  const parentViewOptions = location.state?.parentViewOptions as ViewOptions;

  return (
    <PermissionSettingsView
      onClose={() => {
        switch (parentView) {
          case 'chat':
            navigate('/');
            break;
          case 'pair':
            navigate('/pair');
            break;
          case 'settings':
            navigate('/settings', { state: parentViewOptions });
            break;
          case 'sessions':
            navigate('/sessions');
            break;
          case 'schedules':
            navigate('/schedules');
            break;
          case 'recipes':
            navigate('/recipes');
            break;
          default:
            navigate('/');
        }
      }}
    />
  );
};

const ConfigureProvidersRoute = () => {
  const navigate = useNavigate();

  return (
    <div className="w-screen h-screen bg-background-primary">
      <ProviderSettings
        onClose={() => navigate('/settings', { state: { section: 'models' } })}
        isOnboarding={false}
      />
    </div>
  );
};

interface WelcomeRouteProps {
  onSelectProvider: () => void;
}

const WelcomeRoute = ({ onSelectProvider }: WelcomeRouteProps) => {
  const navigate = useNavigate();

  return (
    <div className="w-screen h-screen bg-background-primary">
      <ProviderSettings
        onClose={() => {
          navigate('/', { replace: true });
        }}
        isOnboarding={true}
        onProviderLaunched={(model?: string) => {
          trackOnboardingCompleted('other', model);
          onSelectProvider();
          navigate('/', { replace: true });
        }}
      />
    </div>
  );
};

const ExtensionsRoute = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const viewOptions =
    (location.state as ExtensionsViewOptions) ||
    (window.history.state as ExtensionsViewOptions) ||
    {};

  return (
    <ExtensionsView
      onClose={() => navigate(-1)}
      setView={(view, options) => {
        switch (view) {
          case 'chat':
            navigate('/');
            break;
          case 'pair':
            navigate('/pair', { state: options });
            break;
          case 'settings':
            navigate('/settings', { state: options });
            break;
          default:
            navigate('/');
        }
      }}
      viewOptions={viewOptions}
    />
  );
};

export function WebAppInner() {
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [didSelectProvider, setDidSelectProvider] = useState<boolean>(false);

  const navigate = useNavigate();
  const setView = useNavigation();

  const [chat, setChat] = useState<ChatType>({
    sessionId: '',
    name: DEFAULT_CHAT_TITLE,
    messages: [],
    recipe: null,
  });

  const MAX_ACTIVE_SESSIONS = 10;

  const [activeSessions, setActiveSessions] = useState<
    Array<{ sessionId: string; initialMessage?: UserInput }>
  >([]);

  useEffect(() => {
    const handleAddActiveSession = (event: Event) => {
      const { sessionId, initialMessage } = (
        event as CustomEvent<{
          sessionId: string;
          initialMessage?: UserInput;
        }>
      ).detail;

      setActiveSessions((prev) => {
        const existingIndex = prev.findIndex((s) => s.sessionId === sessionId);

        if (existingIndex !== -1) {
          const existing = prev[existingIndex];
          return [...prev.slice(0, existingIndex), ...prev.slice(existingIndex + 1), existing];
        }

        const newSession = { sessionId, initialMessage };
        const updated = [...prev, newSession];
        if (updated.length > MAX_ACTIVE_SESSIONS) {
          return updated.slice(updated.length - MAX_ACTIVE_SESSIONS);
        }
        return updated;
      });
    };

    const handleClearInitialMessage = (event: Event) => {
      const { sessionId } = (event as CustomEvent<{ sessionId: string }>).detail;

      setActiveSessions((prev) => {
        return prev.map((session) => {
          if (session.sessionId === sessionId) {
            return { ...session, initialMessage: undefined };
          }
          return session;
        });
      });
    };

    window.addEventListener(AppEvents.ADD_ACTIVE_SESSION, handleAddActiveSession);
    window.addEventListener(AppEvents.CLEAR_INITIAL_MESSAGE, handleClearInitialMessage);
    return () => {
      window.removeEventListener(AppEvents.ADD_ACTIVE_SESSION, handleAddActiveSession);
      window.removeEventListener(AppEvents.CLEAR_INITIAL_MESSAGE, handleClearInitialMessage);
    };
  }, []);

  // No reactReady signal needed in web
  // No IPC listeners needed in web

  // Keyboard shortcuts (web-compatible)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      if ((isMac ? event.metaKey : event.ctrlKey) && event.key === 'n') {
        event.preventDefault();
        // In web, Ctrl+N creates a new chat in the same window
        navigate('/');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // Prevent default drag-and-drop behavior (same as desktop)
  useEffect(() => {
    const preventDefaults = (e: globalThis.DragEvent) => {
      const target = e.target as HTMLElement;
      const isOverDropZone = target.closest('[data-drop-zone="true"]') !== null;
      if (!isOverDropZone) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleDragOver = (e: globalThis.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e: globalThis.DragEvent) => {
      const target = e.target as HTMLElement;
      const isOverDropZone = target.closest('[data-drop-zone="true"]') !== null;
      if (!isOverDropZone) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('dragenter', preventDefaults, false);
    document.addEventListener('dragleave', preventDefaults, false);
    document.addEventListener('dragover', handleDragOver, false);
    document.addEventListener('drop', handleDrop, false);

    return () => {
      document.removeEventListener('dragenter', preventDefaults, false);
      document.removeEventListener('dragleave', preventDefaults, false);
      document.removeEventListener('dragover', handleDragOver, false);
      document.removeEventListener('drop', handleDrop, false);
    };
  }, []);

  if (fatalError) {
    return <ErrorUI error={errorMessage(fatalError)} />;
  }

  return (
    <>
      <PageViewTracker />
      <ToastContainer
        aria-label="Toast notifications"
        toastClassName={() =>
          `relative min-h-16 mb-4 p-2 rounded-lg
               flex justify-between overflow-hidden cursor-pointer
               text-text-inverse bg-background-inverse
              `
        }
        style={{ width: '450px' }}
        className="mt-6"
        position="top-right"
        autoClose={3000}
        closeOnClick
        pauseOnHover
      />
      <div className="relative w-screen h-screen overflow-hidden bg-background-secondary flex flex-col">
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <Routes>
            <Route
              path="welcome"
              element={<WelcomeRoute onSelectProvider={() => setDidSelectProvider(true)} />}
            />
            <Route path="configure-providers" element={<ConfigureProvidersRoute />} />
            <Route path="standalone-app" element={<StandaloneAppView />} />
            <Route
              path="/"
              element={
                <ProviderGuard didSelectProvider={didSelectProvider}>
                  <ChatProvider chat={chat} setChat={setChat} contextKey="hub">
                    <AppLayout activeSessions={activeSessions} />
                  </ChatProvider>
                </ProviderGuard>
              }
            >
              <Route index element={<HubRouteWrapper />} />
              <Route
                path="pair"
                element={
                  <PairRouteWrapper
                    activeSessions={activeSessions}
                    setActiveSessions={setActiveSessions}
                  />
                }
              />
              <Route path="settings" element={<SettingsRoute />} />
              <Route
                path="extensions"
                element={
                  <ChatProvider chat={chat} setChat={setChat} contextKey="extensions">
                    <ExtensionsRoute />
                  </ChatProvider>
                }
              />
              <Route path="apps" element={<AppsView />} />
              <Route path="sessions" element={<SessionsRoute />} />
              <Route path="schedules" element={<SchedulesRoute />} />
              <Route path="recipes" element={<RecipesRoute />} />
              <Route
                path="shared-session"
                element={
                  <SharedSessionView
                    session={null}
                    isLoading={false}
                    error={null}
                    onRetry={async () => {}}
                  />
                }
              />
              <Route path="permission" element={<PermissionRoute />} />
            </Route>
          </Routes>
        </div>
      </div>
    </>
  );
}

export default function WebApp() {
  return (
    <ThemeProvider>
      <ModelAndProviderProvider>
        <BrowserRouter>
          <WebAppInner />
        </BrowserRouter>
        <TelemetryOptOutModal controlled={false} />
      </ModelAndProviderProvider>
    </ThemeProvider>
  );
}
