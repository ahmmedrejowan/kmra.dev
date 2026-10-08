import type { ComponentType } from "react";
import type { Preset } from "@kmra/registry";

/** Props every tool component takes */
export interface ToolProps {
  preset?: Preset;
}

type Loader = () => Promise<{ default: ComponentType<ToolProps> }>;

/** Each tool is its own module, loaded only on its page. */
export const TOOLS: Record<string, Loader> = {
  "json-formatter": () => import("./json-formatter"),
  "yaml-json": () => import("./yaml-json"),
  "xml-formatter": () => import("./xml-formatter"),
  "sql-formatter": () => import("./sql-formatter"),
  "html-formatter": () => import("./html-formatter"),
  "css-formatter": () => import("./css-formatter"),
  "js-formatter": () => import("./js-formatter"),
  "markdown-preview": () => import("./markdown-preview"),
  base64: () => import("./base64"),
  "url-encode": () => import("./url-encode"),
  "html-entities": () => import("./html-entities"),
  "jwt-decoder": () => import("./jwt-decoder"),
  "unicode-escape": () => import("./unicode-escape"),
  "text-hex": () => import("./text-hex"),
  uuid: () => import("./uuid"),
  "password-generator": () => import("./password-generator"),
  hash: () => import("./hash"),
  "lorem-ipsum": () => import("./lorem-ipsum"),
  "fake-data": () => import("./fake-data"),
  timestamp: () => import("./timestamp"),
  "number-base": () => import("./number-base"),
  "color-converter": () => import("./color-converter"),
  "case-converter": () => import("./case-converter"),
  "csv-json": () => import("./csv-json"),
  "json-to-typescript": () => import("./json-to-typescript"),
  "curl-converter": () => import("./curl-converter"),
  "diff-checker": () => import("./diff-checker"),
  "regex-tester": () => import("./regex-tester"),
  "line-tools": () => import("./line-tools"),
  "slug-generator": () => import("./slug-generator"),
  "cron-explainer": () => import("./cron-explainer"),
  "chmod-calculator": () => import("./chmod-calculator"),
  "url-parser": () => import("./url-parser"),
  "http-status": () => import("./http-status"),
};
