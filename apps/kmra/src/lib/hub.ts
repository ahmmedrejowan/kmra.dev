/** The hub's view of the registry: every live app with its tools and tasks, linked to its site. */
import {
  apps,
  appUrl,
  getApp,
  localizeApp,
  type Accent,
  type App,
  type AppId,
  type Task,
  type Tool,
} from "@kmra/registry";
import { lp, t, type Locale } from "@kmra/ui/lib/i18n";

const dev = import.meta.env.DEV;

/** A page in an app, in the reader's language when the app has it */
export function link(id: string, path = "/", locale: Locale = "en"): string {
  const app = (apps as readonly App[]).find((a) => a.id === id)!;
  const has = (app.locales ?? ["en"]).includes(locale);
  return appUrl(id as AppId, has ? lp(locale, path) : path, dev);
}

/** Live apps, in the reader's language */
export const appsIn = (locale: Locale): App[] =>
  (apps as readonly App[])
    .filter((a) => a.live)
    .map((a) => localizeApp(getApp(a.id as AppId), locale));

export interface Entry {
  tool: Tool;
  appId: string;
  href: string;
  accent: Accent;
}

const rank = (app: App, slug: string) => {
  const i = (app.popular ?? []).indexOf(slug);
  return i < 0 ? 999 : i;
};

/** An app's ready tools, popular first, as cards for the hub */
export function toolsOf(app: App, locale: Locale = "en"): Entry[] {
  return app.tools
    .filter((t) => t.ready)
    .slice()
    .sort((a, b) => rank(app, a.slug) - rank(app, b.slug))
    .map((tool) => ({
      tool,
      appId: app.id,
      href: link(app.id, `/${tool.slug}`, locale),
      accent: app.accent,
    }));
}

/** The first `n` tools of every app, taken in turns (one from each app, then the next round) */
export function mixed(n: number, locale: Locale = "en"): Entry[] {
  const lists = appsIn(locale).map((a) => toolsOf(a, locale));
  const out: Entry[] = [];
  for (let i = 0; i < n; i++) for (const l of lists) if (l[i]) out.push(l[i]!);
  return out;
}

export interface TaskEntry {
  task: Task;
  app: App;
  href: string;
  icon: Tool["icon"];
}

/** Popular use cases from every app, in turns */
export function mixedTasks(n: number, locale: Locale = "en"): TaskEntry[] {
  const lists = appsIn(locale).map((app) =>
    app.tasks
      .slice()
      .sort((a, b) => rank(app, a.slug) - rank(app, b.slug))
      .map((task) => ({
        task,
        app,
        href: link(app.id, `/${task.slug}`, locale),
        icon: app.tools.find((t) => t.slug === task.tool)?.icon ?? "file",
      })),
  );
  const out: TaskEntry[] = [];
  for (let i = 0; out.length < n && i < 20; i++)
    for (const l of lists) if (l[i] && out.length < n) out.push(l[i]!);
  return out;
}

const NOUN: Record<string, string> = {
  imgtool: "image",
  audiotool: "audio",
  pdftool: "PDF",
  vidtool: "video",
  qrtool: "QR",
  ocrtool: "OCR",
  devtool: "",
};
/** A tool's name that says which app it's from when another app has a tool of that name */
export function label(e: Entry, list: Entry[], locale: Locale = "en"): string {
  const n = e.tool.name;
  const noun = NOUN[e.appId];
  const twin = list.some((o) => o !== e && o.tool.name === n);
  return twin && noun && !n.toLowerCase().includes(noun.toLowerCase())
    ? t(locale, "{name} {noun}", { name: n, noun: t(locale, noun) })
    : n;
}

const live = appsIn("en");
export const totalTools = live.reduce(
  (s, a) => s + a.tools.filter((t) => t.ready).length,
  0,
);
export const totalTasks = live.reduce((s, a) => s + a.tasks.length, 0);

export const hueStyle = (a: Accent) =>
  `--acc-l:${a.light};--acc-d:${a.dark};--acc-soft-l:${a.softLight};--acc-soft-d:${a.softDark}`;

/** Kinds of file the hub's drop box recognises, and the tools (app, slugs) that open each */
export const KINDS: {
  key: string;
  label: string;
  /** MIME type prefixes or exact types, and file extensions */
  mime: string[];
  ext: string[];
  tools: [string, string[]][];
}[] = [
  {
    key: "pdf",
    label: "PDF",
    mime: ["application/pdf"],
    ext: ["pdf"],
    tools: [
      [
        "pdftool",
        [
          "compress",
          "merge",
          "split",
          "sign",
          "organize",
          "remove-pages",
          "rotate",
          "page-numbers",
          "watermark",
          "grayscale",
          "to-image",
          "metadata",
        ],
      ],
      ["ocrtool", ["pdf-to-text", "searchable-pdf"]],
    ],
  },
  {
    key: "gif",
    label: "GIF",
    mime: ["image/gif"],
    ext: ["gif"],
    tools: [
      ["vidtool", ["gif-to-video"]],
      ["imgtool", ["gif-frames", "compress", "resize"]],
    ],
  },
  {
    key: "image",
    label: "Image",
    mime: ["image/"],
    ext: ["jpg", "jpeg", "png", "webp", "heic", "heif", "avif", "bmp"],
    tools: [
      [
        "imgtool",
        [
          "compress",
          "resize",
          "convert",
          "remove-bg",
          "crop",
          "passport-photo",
          "strip-metadata",
          "rotate",
          "adjust",
          "filters",
          "watermark",
          "add-text",
          "border",
          "extend-canvas",
          "beautify",
          "blur",
          "face-blur",
          "change-bg",
          "signature",
          "form-size",
          "image-info",
          "exif",
          "palette",
          "color-picker",
          "favicon",
          "base64",
        ],
      ],
      ["pdftool", ["from-image"]],
      ["ocrtool", ["image-to-text"]],
      ["qrtool", ["scanner", "checker", "fix-qr"]],
    ],
  },
  {
    key: "video",
    label: "Video",
    mime: ["video/"],
    ext: ["mp4", "mov", "webm", "mkv", "avi", "m4v"],
    tools: [
      [
        "vidtool",
        [
          "compress",
          "convert",
          "trim",
          "resize",
          "video-to-gif",
          "video-to-mp3",
          "mute",
          "rotate",
          "speed",
          "extract-frames",
          "video-info",
          "merge",
        ],
      ],
      ["audiotool", ["video-to-audio"]],
    ],
  },
  {
    key: "audio",
    label: "Audio",
    mime: ["audio/"],
    ext: [
      "mp3",
      "m4a",
      "m4r",
      "aac",
      "wav",
      "flac",
      "ogg",
      "oga",
      "opus",
      "aif",
      "aiff",
      "wma",
      "amr",
    ],
    tools: [
      [
        "audiotool",
        [
          "convert",
          "trim",
          "compress",
          "volume",
          "normalize",
          "merge",
          "fade",
          "speed",
          "pitch",
          "remove-silence",
          "reverse",
          "mono",
          "audio-info",
        ],
      ],
    ],
  },
  {
    key: "json",
    label: "JSON",
    mime: ["application/json"],
    ext: ["json"],
    tools: [
      [
        "devtool",
        ["json-formatter", "json-to-typescript", "yaml-json", "csv-json"],
      ],
    ],
  },
  {
    key: "csv",
    label: "Spreadsheet",
    mime: ["text/csv"],
    ext: ["csv", "tsv", "xlsx", "xls"],
    tools: [["devtool", ["csv-json"]]],
  },
  {
    key: "yaml",
    label: "YAML",
    mime: [],
    ext: ["yaml", "yml"],
    tools: [["devtool", ["yaml-json"]]],
  },
  {
    key: "xml",
    label: "XML",
    mime: ["application/xml", "text/xml"],
    ext: ["xml"],
    tools: [["devtool", ["xml-formatter"]]],
  },
  {
    key: "sql",
    label: "SQL",
    mime: [],
    ext: ["sql"],
    tools: [["devtool", ["sql-formatter"]]],
  },
  {
    key: "md",
    label: "Markdown",
    mime: ["text/markdown"],
    ext: ["md", "markdown"],
    tools: [["devtool", ["markdown-preview"]]],
  },
  {
    key: "html",
    label: "HTML",
    mime: ["text/html"],
    ext: ["html", "htm"],
    tools: [["devtool", ["html-formatter"]]],
  },
  {
    key: "css",
    label: "CSS",
    mime: ["text/css"],
    ext: ["css", "scss"],
    tools: [["devtool", ["css-formatter"]]],
  },
  {
    key: "js",
    label: "JavaScript",
    mime: ["text/javascript"],
    ext: ["js", "mjs", "cjs", "ts", "jsx", "tsx"],
    tools: [["devtool", ["js-formatter"]]],
  },
  {
    key: "txt",
    label: "Text",
    mime: ["text/plain"],
    ext: ["txt", "log"],
    tools: [["devtool", ["line-tools", "case-converter", "text-hex"]]],
  },
];
