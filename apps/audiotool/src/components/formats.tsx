import { Seg } from "@kmra/ui/components/controls";
import { useT } from "@kmra/ui/lib/i18n-react";
import type { AudioContainer, MediaInfo } from "@kmra/media/engine";
import { Mp3Credit } from "@kmra/media/components/Mp3Credit";
import { sameAudio } from "./Workspace";

/** Output formats the audio tools offer, in the order people look for them */
export const FORMATS: [AudioContainer, string][] = [
  ["mp3", "MP3"],
  ["m4a", "M4A"],
  ["wav", "WAV"],
  ["ogg", "OGG"],
  ["opus", "Opus"],
  ["flac", "FLAC"],
];
export const LOSSLESS = new Set<AudioContainer>(["wav", "flac"]);
export const RATES = [64, 96, 128, 192, 256, 320];

export const isFormat = (v: unknown): v is AudioContainer =>
  FORMATS.some(([f]) => f === v);

/** "Same as the original" or a chosen format */
export type FormatPick = AudioContainer | "same";
export const resolveFormat = (pick: FormatPick, info: MediaInfo) =>
  pick === "same" ? sameAudio(info) : pick;

/** Format picker, with "Same as original" first when `same` is set */
export function FormatSeg({
  value,
  onPick,
  same,
  only,
}: {
  value: FormatPick;
  onPick: (v: FormatPick) => void;
  same?: boolean;
  only?: AudioContainer[];
}) {
  const T = useT();
  const list = only ? FORMATS.filter(([f]) => only.includes(f)) : FORMATS;
  return (
    <>
      <Seg
        label={T("Format")}
        options={[
          ...(same ? ([["same", T("Same")]] as [FormatPick, string][]) : []),
          ...list,
        ]}
        value={value}
        onPick={onPick}
      />
      {value === "mp3" && <Mp3Credit />}
    </>
  );
}

/** Bitrate picker for lossy formats */
export function RateSeg({
  value,
  onPick,
  rates = RATES,
}: {
  value: number;
  onPick: (v: number) => void;
  rates?: number[];
}) {
  const T = useT();
  return (
    <Seg
      label={T("Quality (kbps)")}
      options={rates.map((r) => [r, `${r}`] as [number, string])}
      value={value}
      onPick={onPick}
    />
  );
}
