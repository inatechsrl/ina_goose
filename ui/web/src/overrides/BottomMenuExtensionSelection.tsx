/**
 * Web override for BottomMenuExtensionSelection.
 *
 * When the extensionSelection feature flag is disabled, renders nothing.
 * Otherwise re-exports the original component.
 */
import { featureFlags } from '../feature-flags';

// Re-export the original component, gated by feature flag
import {
  BottomMenuExtensionSelection as OriginalBottomMenuExtensionSelection,
} from '@desktop/components/bottom_menu/BottomMenuExtensionSelection';

interface BottomMenuExtensionSelectionProps {
  sessionId: string | null;
}

export const BottomMenuExtensionSelection = ({ sessionId }: BottomMenuExtensionSelectionProps) => {
  if (!featureFlags.features.extensionSelection) return null;
  return <OriginalBottomMenuExtensionSelection sessionId={sessionId} />;
};
