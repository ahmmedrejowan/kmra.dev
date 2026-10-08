import type { App } from "../index";
import type { AppContent } from "./types";
import { bn } from "./bn.ts";

export type { AppContent };

/** Content per language, per app id. English is the registry itself. */
const CONTENT: Record<string, Record<string, AppContent>> = { bn };

/**
 * The app with its text in `locale`. Group labels are translated too, so menus group and order
 * the same way in every language. Missing translations stay in English.
 */
export function localizeApp(app: App, locale: string): App {
  const c = CONTENT[locale]?.[app.id];
  if (!c) return app;
  const g = (label: string) => c.groups?.[label] ?? label;
  return {
    ...app,
    name: c.name ?? app.name,
    short: c.short ?? app.short,
    tagline: c.tagline ?? app.tagline,
    toolGroups: app.toolGroups?.map(g),
    tools: app.tools.map((t) => ({
      ...t,
      ...c.tools?.[t.slug],
      group: g(t.group),
    })),
    tasks: app.tasks.map((t) => ({
      ...t,
      ...c.tasks?.[t.slug],
      group: g(t.group),
    })),
  };
}
