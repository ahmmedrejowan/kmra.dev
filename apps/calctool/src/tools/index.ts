import type { ComponentType } from "react";
import type { Preset } from "@kmra/registry";

/** Props every tool component takes */
export interface ToolProps {
  preset?: Preset;
}

type Loader = () => Promise<{ default: ComponentType<ToolProps> }>;

/** Each tool is its own module, loaded only on its page. */
export const TOOLS: Record<string, Loader> = {
  calculator: () => import("./calculator"),
  percentage: () => import("./percentage"),
  discount: () => import("./discount"),
  tip: () => import("./tip"),
  "sales-tax": () => import("./sales-tax"),
  fraction: () => import("./fraction"),
  "aspect-ratio": () => import("./aspect-ratio"),
  loan: () => import("./loan"),
  "compound-interest": () => import("./compound-interest"),
  salary: () => import("./salary"),
  age: () => import("./age"),
  "date-difference": () => import("./date-difference"),
  "time-calculator": () => import("./time-calculator"),
  "time-zones": () => import("./time-zones"),
  bmi: () => import("./bmi"),
  calories: () => import("./calories"),
  "unit-converter": () => import("./unit-converter"),
};
