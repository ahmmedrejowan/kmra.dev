import { Fragment, useState } from "react";
import { CopyBtn } from "@kmra/ui/components/kit";
import { Icon } from "@kmra/ui/components/Icon";
import { formatBytes } from "@kmra/ui/lib/files";
import { useLang, useT } from "@kmra/ui/lib/i18n-react";
import {
  AUDIO_ACCEPT,
  codecLabel,
  containerLabel,
  fmtTime,
  probe,
  type MediaInfo,
} from "@kmra/media/engine";
import {
  MediaDrop,
  MediaInput,
  useMediaFiles,
} from "@kmra/media/components/MediaDrop";
import { WavePlayer } from "@kmra/media/components/WavePlayer";
import type { ToolProps } from "./Workspace";

interface Item {
  key: number;
  file: File;
  info?: MediaInfo;
  error?: string;
}

type TFn = ReturnType<typeof useT>;
type Section = { title: string; rows: [string, string][] };

let nextKey = 1;

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** 1920×1080 → "16:9"; odd shapes → "2.39:1" */
function aspect(w: number, h: number): string {
  if (!w || !h) return "";
  const g = gcd(w, h);
  const [a, b] = [w / g, h / g];
  if (a <= 32 && b <= 32) return `${a}:${b}`;
  const r = w / h;
  for (const [x, y] of [
    [16, 9],
    [9, 16],
    [4, 3],
    [3, 4],
    [1, 1],
    [21, 9],
    [4, 5],
  ] as const)
    if (Math.abs(r - x / y) < 0.01) return `${x}:${y}`;
  return r >= 1 ? `${r.toFixed(2)}:1` : `1:${(1 / r).toFixed(2)}`;
}

const bitrate = (b: number) =>
  !b
    ? ""
    : b >= 1e6
      ? `${(b / 1e6).toFixed(1)} Mbps`
      : `${Math.round(b / 1000)} kbps`;

/** ISO 6709 ("+40.7128-074.0060+010.0/") → "40.7128° N, 74.0060° W" */
export function place(iso: string): string | null {
  const m = /^([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)/.exec(iso.trim());
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? "E" : "W"}`;
}

/** Everything probe() knows about a file, in sections of [label, value] rows */
function sections(item: Item, T: TFn, lang: string): Section[] {
  const i = item.info;
  if (!i) return [];
  const out: Section[] = [];
  out.push({
    title: T("File"),
    rows: [
      [T("Name"), item.file.name],
      [T("Format"), containerLabel(i.container)],
      [
        T("Length"),
        `${fmtTime(i.durationSec, 2)} (${i.durationSec.toFixed(3)} s)`,
      ],
      [
        T("Size"),
        `${formatBytes(i.sizeBytes)} (${i.sizeBytes.toLocaleString("en")} B)`,
      ],
      [T("Overall bitrate"), bitrate(i.bitrate)],
    ],
  });
  const v = i.video;
  if (v) {
    const c = v.colour;
    out.push({
      title: T("Video"),
      rows: [
        [
          T("Codec"),
          [codecLabel(v.codec), v.codecString ? `(${v.codecString})` : ""]
            .filter(Boolean)
            .join(" "),
        ],
        [T("Profile"), v.profile ?? ""],
        [T("Resolution"), `${v.width} × ${v.height}`],
        [T("Display aspect"), aspect(v.width, v.height)],
        [T("Rotation"), v.rotation ? `${v.rotation}°` : T("None")],
        [
          T("Stored size"),
          v.codedWidth &&
          v.codedHeight &&
          (v.codedWidth !== (v.rotation % 180 ? v.height : v.width) ||
            v.codedHeight !== (v.rotation % 180 ? v.width : v.height))
            ? `${v.codedWidth} × ${v.codedHeight}`
            : "",
        ],
        [T("Frame rate"), v.fps ? `${Math.round(v.fps * 100) / 100} fps` : ""],
        [T("Bitrate"), bitrate(v.bitrate)],
        [T("Pixel format"), v.pixelFormat ?? ""],
        [T("Bit depth"), v.bitDepth ? `${v.bitDepth}-bit` : ""],
        [
          T("Colour"),
          c
            ? [c.primaries, c.transfer, c.matrix].filter(Boolean).join(" / ")
            : "",
        ],
        [
          T("Colour range"),
          c?.fullRange === undefined
            ? ""
            : c.fullRange
              ? T("Full")
              : T("Limited"),
        ],
        [T("HDR"), v.hdr === undefined ? "" : v.hdr ? T("Yes") : T("No")],
      ],
    });
  }
  const a = i.audio;
  out.push({
    title: T("Sound"),
    rows: a
      ? [
          [
            T("Codec"),
            [
              a.profile?.startsWith(codecLabel(a.codec))
                ? a.profile
                : codecLabel(a.codec),
              a.profile && !a.profile.startsWith(codecLabel(a.codec))
                ? a.profile
                : "",
              a.codecString ? `(${a.codecString})` : "",
            ]
              .filter(Boolean)
              .join(" "),
          ],
          [
            T("Sample rate"),
            a.sampleRate
              ? `${(a.sampleRate / 1000).toLocaleString("en")} kHz`
              : "",
          ],
          [
            T("Channels"),
            a.channels === 1
              ? T("mono")
              : a.channels === 2
                ? T("stereo")
                : a.channels === 6
                  ? "5.1"
                  : a.channels === 8
                    ? "7.1"
                    : String(a.channels || ""),
          ],
          [T("Bitrate"), bitrate(a.bitrate)],
        ]
      : [[T("Sound"), T("None")]],
  });
  if (i.other?.length)
    out.push({
      title: T("Other streams"),
      rows: i.other.map((o, n) => [`${T("Stream")} ${n + 1}`, o]),
    });
  const tags = Object.entries(i.tags ?? {});
  if (tags.length)
    out.push({
      title: T("Tags"),
      rows: tags.map(([k, val]) => {
        if (k === "Created") {
          const d = new Date(val);
          return [
            T(k),
            Number.isNaN(d.getTime()) ? val : d.toLocaleString(lang),
          ];
        }
        if (k === "Location") {
          const p = place(val);
          return [T(k), p ? `${p} (${val})` : val];
        }
        return [T(k), val];
      }),
    });
  return out.map((s) => ({ ...s, rows: s.rows.filter(([, val]) => val) }));
}

/**
 * Audio info: everything the file says about itself (format, length, size, bitrate; codec,
 * profile, sample rate, channels; tags such as title, artist and encoder) with a waveform player.
 * Several files compare side by side (rows that differ are marked). Copy as text or JSON.
 */
export default function AudioInfo(_: ToolProps) {
  const T = useT();
  const lang = useLang();
  const [items, setItems] = useState<Item[]>([]);

  const patch = (key: number, p: Partial<Item>) =>
    setItems((l) => l.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const add = (files: File[]) => {
    const list = files.map<Item>((file) => ({ key: nextKey++, file }));
    setItems((l) => [...l, ...list]);
    void (async () => {
      for (const it of list) {
        try {
          const info = await probe(it.file);
          patch(it.key, { info });
        } catch (e) {
          patch(it.key, { error: e instanceof Error ? e.message : String(e) });
        }
      }
    })();
  };
  const { dragging, pickRef, pick, take } = useMediaFiles(add);

  const remove = (key: number) => {
    setItems((l) => l.filter((x) => x.key !== key));
  };

  const input = (
    <MediaInput inputRef={pickRef} onFiles={take} multiple accept={AUDIO_ACCEPT} />
  );

  if (!items.length)
    return (
      <div className="toolcard solo vt-ws vt-info">
        {input}
        <div className="stage">
          <MediaDrop
            title={T("Drop audio files to see their details")}
            formats={["MP3", "WAV", "M4A", "FLAC", "OGG"]}
            dragging={dragging}
            onPick={pick}
            button={T("Choose audio files")}
          />
        </div>
      </div>
    );

  const all = items.map((it) => sections(it, T, lang));
  // One row per label across every file, in the order they first appear
  const titles: string[] = [];
  const labels = new Map<string, string[]>();
  for (const secs of all)
    for (const s of secs) {
      if (!labels.has(s.title)) {
        titles.push(s.title);
        labels.set(s.title, []);
      }
      const l = labels.get(s.title)!;
      for (const [k] of s.rows) if (!l.includes(k)) l.push(k);
    }
  const value = (n: number, title: string, label: string) =>
    all[n]!.find((s) => s.title === title)?.rows.find(
      ([k]) => k === label,
    )?.[1] ?? "";

  const text = items
    .map((it, n) =>
      [
        it.file.name,
        ...(it.error
          ? [T("This file couldn't be read. It may be damaged or not an audio file.")]
          : []),
        ...all[n]!.flatMap((s) => [
          "",
          s.title,
          ...s.rows.map(([k, val]) => `  ${k}: ${val}`),
        ]),
      ].join("\n"),
    )
    .join("\n\n----\n\n");
  const json = JSON.stringify(
    items.map((it) => ({
      name: it.file.name,
      ...(it.info ?? { error: it.error }),
    })),
    null,
    2,
  );
  const many = items.length > 1;
  const one = items[0]!;

  return (
    <div
      className={`toolcard vt-ws vt-info${many ? " many" : ""}${dragging ? " over" : ""}`}
    >
      {input}
      <div className="vt-info-bar">
        <span className="vt-info-count">
          {many ? T("{n} files", { n: items.length }) : one.file.name}
        </span>
        <div className="vt-info-acts">
          <CopyBtn text={text} label={T("Copy as text")} />
          <CopyBtn text={json} label={T("Copy as JSON")} />
          <button type="button" className="btn sm" onClick={pick}>
            <Icon name="plus" />
            {many ? T("Add files") : T("Add a file to compare")}
          </button>
        </div>
      </div>

      <div className="vt-info-body">
        {!many && one.info?.audio && (
          <div className="vt-info-view at-info-view">
            <WavePlayer file={one.file} label={T("Preview")} />
          </div>
        )}
        <div className="vt-itable-wrap">
          <table className="vt-itable">
            {many && (
              <thead>
                <tr>
                  <td />
                  {items.map((it) => (
                    <th key={it.key} scope="col">
                      <span className="vt-iname" title={it.file.name}>
                        {it.file.name}
                      </span>
                      <button
                        type="button"
                        className="btn xs"
                        aria-label={T("Remove {name}", { name: it.file.name })}
                        onClick={() => remove(it.key)}
                      >
                        <Icon name="x" />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {items.some((it) => it.error || !it.info) && (
                <tr>
                  <th scope="row">{T("Status")}</th>
                  {items.map((it) => (
                    <td key={it.key} className={it.error ? "bad" : "muted"}>
                      {it.error
                        ? T("Can't be read")
                        : it.info
                          ? ""
                          : T("Reading the file")}
                    </td>
                  ))}
                </tr>
              )}
              {titles.map((title) => (
                <Fragment key={title}>
                  <tr className="sec">
                    <th scope="colgroup" colSpan={items.length + 1}>
                      {title}
                    </th>
                  </tr>
                  {labels.get(title)!.map((label) => {
                    const vals = items.map((_, n) => value(n, title, label));
                    const differs =
                      many && label !== T("Name") && new Set(vals).size > 1;
                    return (
                      <tr key={label} className={differs ? "diff" : undefined}>
                        <th scope="row">{label}</th>
                        {vals.map((v, n) => (
                          <td key={items[n]!.key}>{v || "–"}</td>
                        ))}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {many && (
        <p className="muted vt-info-hint">
          {T("Rows in bold differ between the files.")}
        </p>
      )}
    </div>
  );
}
