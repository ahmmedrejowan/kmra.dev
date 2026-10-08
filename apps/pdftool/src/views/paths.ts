import { getApp } from "@kmra/registry";

/** One page per tool and per task, in every language (the views translate themselves). */
export function toolPaths() {
  const app = getApp("pdftool");
  return [
    ...app.tools.map((t) => ({
      params: { slug: t.slug },
      props: { slug: t.slug },
    })),
    ...app.tasks.map((t) => ({
      params: { slug: t.slug },
      props: { slug: t.slug },
    })),
  ];
}
