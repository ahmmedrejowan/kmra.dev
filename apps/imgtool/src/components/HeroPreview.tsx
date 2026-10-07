import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import { Icon } from "@kmra/ui/components/Icon";
import { stashFiles } from "@kmra/ui/lib/handoff";
import { toast } from "@kmra/ui/lib/toast";

/**
 * Homepage hero: an example of the Compress tool you can play with (compare slider, quality),
 * which is also the drop target. Dropped, pasted or chosen images open /compress with the files.
 */
export default function HeroPreview() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cut, setCut] = useState(50);
  const [quality, setQuality] = useState(72);
  const [format, setFormat] = useState<"WebP" | "JPEG">("WebP");
  const [over, setOver] = useState(false);

  // Rough size curve for the 4.2 MB example photo, so the numbers react like the real tool.
  const kb = Math.round(
    (90 + Math.pow(quality / 100, 2.4) * 2400) * (format === "WebP" ? 0.78 : 1),
  );
  const size = kb >= 1000 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
  const pct = Math.round((1 - kb / 4300) * 100);

  async function take(list: FileList | File[] | null) {
    const files = [...(list ?? [])].filter((f) => f.type.startsWith("image/"));
    if (!files.length) {
      if (list && [...list].length)
        toast("That isn't an image. Try JPEG, PNG, WebP, GIF or AVIF.");
      return;
    }
    await stashFiles(files);
    window.location.href = "/compress";
  }

  useEffect(() => {
    const open = () => inputRef.current?.click();
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) void take(files);
    };
    const onOver = (e: globalThis.DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        e.preventDefault();
        setOver(true);
      }
    };
    const onLeave = (e: globalThis.DragEvent) => {
      if (!e.relatedTarget) setOver(false);
    };
    const onDrop = (e: globalThis.DragEvent) => {
      if (!e.dataTransfer?.files.length) return;
      e.preventDefault();
      setOver(false);
      void take(e.dataTransfer.files);
    };
    window.addEventListener("kmra:upload", open);
    window.addEventListener("paste", onPaste);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("kmra:upload", open);
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  return (
    <div
      className={`preview${over ? " over" : ""}`}
      onDragOver={(e: DragEvent) => e.preventDefault()}
    >
      {over && <div className="pv-overlay">Drop to compress</div>}
      <div className="pv-bar">
        <Icon name="compress" />
        <strong>Compress</strong> beach-sunset.jpg
        <span className="soon">Example</span>
      </div>
      <div className="pv-body">
        <div
          className="pv-canvas"
          style={{ "--cut": `${cut}%` } as CSSProperties}
        >
          <Landscape />
          <Landscape className="after" />
          <div
            className="cmp"
            style={{
              position: "absolute",
              inset: 0,
              boxShadow: "none",
              borderRadius: 0,
            }}
          >
            <div className="line" />
            <span className="lab" style={{ left: 10 }}>
              Original 4.2 MB
            </span>
            <span className="lab" style={{ right: 10 }}>
              {format} {size}
            </span>
            <input
              type="range"
              min={4}
              max={96}
              value={cut}
              onChange={(e) => setCut(+e.target.value)}
              aria-label="Drag to compare original and compressed example"
            />
          </div>
        </div>
        <div className="pv-side">
          <div>
            <span className="lbl">Format</span>
            <div className="seg" role="group" aria-label="Example format">
              {(["JPEG", "WebP"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={format === f}
                  onClick={() => setFormat(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="lbl" htmlFor="pv-q">
              Quality <span>{quality}</span>
            </label>
            <input
              id="pv-q"
              type="range"
              min={10}
              max={100}
              value={quality}
              onChange={(e) => setQuality(+e.target.value)}
            />
          </div>
          <div className="pv-size">
            <span className="muted">4.2 MB to</span>
            <b>{size}</b>
            <span className="delta">{pct}% smaller</span>
          </div>
        </div>
      </div>
      <div className="pv-drop">
        <span>
          <Icon name="upload" />
          Drop your images anywhere on this page
        </span>
        <button
          type="button"
          className="btn sm acc"
          onClick={() => inputRef.current?.click()}
        >
          Choose images
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void take(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function Landscape({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pv-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb37a" />
          <stop offset="0.55" stopColor="#ff7e7e" />
          <stop offset="1" stopColor="#7a5cff" />
        </linearGradient>
        <linearGradient id="pv-lake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a4bd1" />
          <stop offset="1" stopColor="#1e2a5a" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#pv-sky)" />
      <circle cx="270" cy="128" r="38" fill="#ffe7a8" />
      <path
        d="M0 190 L70 120 L120 165 L190 90 L260 170 L320 125 L400 185 L400 300 L0 300Z"
        fill="#3b2f7a"
      />
      <path
        d="M0 215 L90 160 L160 205 L240 150 L320 200 L400 170 L400 300 L0 300Z"
        fill="#2a2160"
      />
      <rect y="232" width="400" height="68" fill="url(#pv-lake)" />
      <rect
        x="236"
        y="244"
        width="70"
        height="4"
        rx="2"
        fill="#ffe7a8"
        opacity=".5"
      />
      <rect
        x="250"
        y="256"
        width="44"
        height="3"
        rx="1.5"
        fill="#ffe7a8"
        opacity=".35"
      />
    </svg>
  );
}
