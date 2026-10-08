import {
  getApp,
  groupBy,
  localizeApp,
  type AppId,
  type Task,
  type Tool,
} from "@kmra/registry";
import type { Locale } from "./i18n";

/**
 * Tools and tasks grouped into sections, with anchor ids made from the English group names so
 * links like /tools#background work in every language.
 */
export interface Section<T> {
  id: string;
  label: string;
  items: T[];
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Popular first (in the app's `popular` order), then the rest in registry order */
function byPopular<T extends { slug: string }>(
  list: T[],
  popular: readonly string[],
) {
  const rank = (x: T) =>
    popular.includes(x.slug) ? popular.indexOf(x.slug) : 999;
  return list
    .map((x, i) => ({ x, i }))
    .sort((a, b) => rank(a.x) - rank(b.x) || a.i - b.i)
    .map((e) => e.x);
}

export function toolSections(
  appId: AppId,
  locale: Locale,
  popularFirst = false,
): Section<Tool>[] {
  const en = getApp(appId);
  const app = localizeApp(en, locale);
  const ids = groupBy(
    en.tools.filter((t) => t.ready),
    en.toolGroups,
  ).map(([g]) => slug(g));
  return groupBy(
    app.tools.filter((t) => t.ready),
    app.toolGroups,
  ).map(([label, items], i) => ({
    id: ids[i] ?? slug(label),
    label,
    items: popularFirst ? byPopular(items, app.popular ?? []) : items,
  }));
}

export function taskSections(
  appId: AppId,
  locale: Locale,
  popularFirst = false,
): Section<Task>[] {
  const en = getApp(appId);
  const app = localizeApp(en, locale);
  const ids = groupBy(en.tasks).map(([g]) => slug(g));
  return groupBy(app.tasks).map(([label, items], i) => ({
    id: ids[i] ?? slug(label),
    label,
    items: popularFirst ? byPopular(items, app.popular ?? []) : items,
  }));
}
