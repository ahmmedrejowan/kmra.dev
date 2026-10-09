import { apps, type App } from "@kmra/registry";

/**
 * The other live apps, starting after `appId` and wrapping around, so each app shows a different
 * set first. The card above the footer takes the first two and the footer the next three: five
 * different apps, never the current one, none in both places.
 */
export function otherApps(appId: string): App[] {
  const live = (apps as readonly App[]).filter((a) => a.live);
  const i = live.findIndex((a) => a.id === appId);
  return [...live.slice(i + 1), ...live.slice(0, Math.max(i, 0))].filter(
    (a) => a.id !== appId,
  );
}

export const ctaApps = (appId: string) => otherApps(appId).slice(0, 2);
export const footerApps = (appId: string) => otherApps(appId).slice(2, 5);
