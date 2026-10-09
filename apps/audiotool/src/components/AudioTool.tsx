import {
  lazy,
  Suspense,
  type ComponentType,
  type LazyExoticComponent,
} from "react";
import type { Preset } from "@kmra/registry";
import type { Locale } from "@kmra/ui/lib/i18n";
import { LangProvider } from "@kmra/ui/lib/i18n-react";
import type { ToolProps } from "./Workspace";

/**
 * The audio tools' island: picks the tool by slug and loads only that tool's code. The engine
 * (@kmra/media) loads with the first tool; its workers and ffmpeg.wasm load when a job needs them.
 */
const TOOLS: Record<string, LazyExoticComponent<ComponentType<ToolProps>>> = {
  convert: lazy(() => import("./Convert")),
  compress: lazy(() => import("./Compress")),
  "video-to-audio": lazy(() => import("./VideoToAudio")),
  trim: lazy(() => import("./Trim")),
  merge: lazy(() => import("./Merge")),
  fade: lazy(() => import("./Fade")),
  speed: lazy(() => import("./Speed")),
  reverse: lazy(() => import("./Reverse")),
  volume: lazy(() => import("./Volume")),
  normalize: lazy(() => import("./Normalize")),
  pitch: lazy(() => import("./Pitch")),
  "remove-silence": lazy(() => import("./RemoveSilence")),
  mono: lazy(() => import("./Mono")),
  "voice-recorder": lazy(() => import("./VoiceRecorder")),
  "audio-info": lazy(() => import("./AudioInfo")),
};

export default function AudioTool({
  tool,
  lang,
  preset,
}: {
  tool: string;
  lang?: Locale;
  preset?: Preset;
}) {
  const Tool = TOOLS[tool];
  return (
    <LangProvider lang={lang}>
      {Tool && (
        <Suspense
          fallback={
            <div className="toolcard solo vt-ws vt-loading" aria-busy="true" />
          }
        >
          <Tool preset={preset} />
        </Suspense>
      )}
    </LangProvider>
  );
}
