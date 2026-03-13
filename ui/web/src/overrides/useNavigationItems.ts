/**
 * Web override for useNavigationItems.
 *
 * Filters navigation items based on feature flags from features.config.json.
 * Imports the original NAV_ITEMS via the @desktop alias (which is NOT intercepted
 * by the webOverridesPlugin — it only intercepts relative imports starting with '.').
 */
import {
  NAV_ITEMS as ORIGINAL_NAV_ITEMS,
  getNavItemById as originalGetNavItemById,
} from '@desktop/hooks/useNavigationItems';
import type { NavItem } from '@desktop/hooks/useNavigationItems';
import { featureFlags } from '../feature-flags';

// Map nav item IDs to their corresponding route flags
const navItemToRouteFlag: Record<string, keyof typeof featureFlags.routes> = {
  recipes: 'recipes',
  scheduler: 'schedules',
  extensions: 'extensions',
};

export type { NavItem };

export const NAV_ITEMS: NavItem[] = ORIGINAL_NAV_ITEMS.filter((item) => {
  const flagKey = navItemToRouteFlag[item.id];
  if (flagKey) {
    return featureFlags.routes[flagKey];
  }
  return true; // Items without a flag mapping are always shown
});

export function getNavItemById(id: string): NavItem | undefined {
  const flagKey = navItemToRouteFlag[id];
  if (flagKey && !featureFlags.routes[flagKey]) {
    return undefined;
  }
  return originalGetNavItemById(id);
}
