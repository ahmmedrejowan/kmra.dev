import type { ComponentType } from "react";
import type { Preset } from "@kmra/registry";

/** Props every tool component takes */
export interface ToolProps {
  preset?: Preset;
}

type Loader = () => Promise<{ default: ComponentType<ToolProps> }>;

/** Each tool is its own module, loaded only on its page. */
export const TOOLS: Record<string, Loader> = {};
