import { getApp } from "@kmra/registry";

/**
 * One page per ready tool and per task, in every language (the views translate themselves).
 * Tools that aren't built yet get no page at all.
 */
export function toolPaths() {
  const app = getApp("ocrtool");
  return [
    ...app.tools
      .filter((t) => t.ready)
      .map((t) => ({
        params: { slug: t.slug },
        props: { slug: t.slug },
      })),
    ...app.tasks.map((t) => ({
      params: { slug: t.slug },
      props: { slug: t.slug },
    })),
  ];
}
