import type { ComponentType } from "react";
import type { Preset } from "@kmra/registry";

/** Props every tool component takes */
export interface ToolProps {
  preset?: Preset;
}

type Loader = () => Promise<{ default: ComponentType<ToolProps> }>;

/** Each tool is its own module, loaded only on its page. */
export const TOOLS: Record<string, Loader> = {
  tuner: () => import("./tuner"),
  metronome: () => import("./metronome"),
  "tap-tempo": () => import("./tap-tempo"),
  "tone-generator": () => import("./tone-generator"),
  drone: () => import("./drone"),
  chords: () => import("./chords"),
  scales: () => import("./scales"),
  "ear-trainer": () => import("./ear-trainer"),
};
