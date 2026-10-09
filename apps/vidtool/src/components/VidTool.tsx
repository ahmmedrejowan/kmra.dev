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
 * The video tools' island: picks the tool by slug and loads only that tool's code. The engine
 * (@kmra/media) loads with the first tool; its workers and ffmpeg.wasm load when a job needs them.
 */
const TOOLS: Record<string, LazyExoticComponent<ComponentType<ToolProps>>> = {
  compress: lazy(() => import("./Compress")),
  convert: lazy(() => import("./Convert")),
  resize: lazy(() => import("./Resize")),
  trim: lazy(() => import("./Trim")),
  rotate: lazy(() => import("./Rotate")),
  speed: lazy(() => import("./Speed")),
  merge: lazy(() => import("./Merge")),
  mute: lazy(() => import("./Mute")),
  "video-to-gif": lazy(() => import("./VideoToGif")),
  "gif-to-video": lazy(() => import("./GifToVideo")),
  "video-to-mp3": lazy(() => import("./VideoToMp3")),
  "extract-frames": lazy(() => import("./ExtractFrames")),
  "screen-recorder": lazy(() => import("./ScreenRecorder")),
  "video-info": lazy(() => import("./VideoInfo")),
};

export default function VidTool({
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
