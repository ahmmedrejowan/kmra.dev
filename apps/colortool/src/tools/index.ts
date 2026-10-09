import type { ComponentType } from "react";
import type { Preset } from "@kmra/registry";

/** Props every tool component takes */
export interface ToolProps {
  preset?: Preset;
}

type Loader = () => Promise<{ default: ComponentType<ToolProps> }>;

/** Each tool is its own module, loaded only on its page. */
export const TOOLS: Record<string, Loader> = {
  "color-picker": () => import("./color-picker"),
  "color-mixer": () => import("./color-mixer"),
  "palette-generator": () => import("./palette-generator"),
  shades: () => import("./shades"),
  "contrast-checker": () => import("./contrast-checker"),
  "color-blindness": () => import("./color-blindness"),
  "gradient-generator": () => import("./gradient-generator"),
  "box-shadow": () => import("./box-shadow"),
};
