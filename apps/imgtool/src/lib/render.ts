/// <reference lib="webworker" />
import {
  colorMatrix,
  FONTS,
  GRADIENTS,
  PHOTO_SPECS,
  SHEETS,
  type Frame,
  type PhotoSpec,
  type Ink,
  type Redact,
  type TextLayer,
  type Watermark,
} from "./fx";
import {
  fitDims,
  hasGeometry,
  outType,
  RATIOS,
  type Crop,
  type Settings,
} from "./settings";
import type { Box } from "./ml";

/**
 * The image pipeline, run in the worker:
 * redact → crop/rotate → signature ink → resize → background → colour → text → watermark → frame
 * → print sheet → flatten (JPEG). Each step is skipped when it's off.
 */

type Src = CanvasImageSource & { width: number; height: number };
type Ctx = OffscreenCanvasRenderingContext2D;

export interface Extras {
  /** Subject mask for background changes, same size as the original image */
  mask?: ImageBitmap | null;
  /** Decoded watermark logo */
  logo?: ImageBitmap | null;
  /** Faces found in the original image (fractions), when a step needs them */
  faces?: Box[];
}

/** Where to crop for an ID photo: head at the official size, centred, with room above. */
export function passportCrop(
  bmp: ImageBitmap,
  face: Box,
  spec: PhotoSpec,
  zoom: number,
): Crop {
  const W = bmp.width;
  const H = bmp.height;
  // Calibrated on the detector: its box runs from the upper forehead to just below the chin.
  // The crown (top of the hair) sits about a third of a box height above it.
  const fx = face.x * W;
  const fy = face.y * H;
  const fw = face.w * W;
  const fh = face.h * H;
  const crown = fy - fh * 0.33;
  const chin = fy + fh * 0.95;
  const headH = chin - crown;
  const cropH = (headH / spec.head) * (1 - zoom / 100);
  const cropW = (cropH * spec.w) / spec.h;
  const top = crown - spec.top * cropH;
  const left = fx + fw / 2 - cropW / 2;
  return { x: left / W, y: top / H, w: cropW / W, h: cropH / H };
}

function canvas(w: number, h: number): [OffscreenCanvas, Ctx] {
  const c = new OffscreenCanvas(Math.max(1, w), Math.max(1, h));
  const x = c.getContext("2d")!;
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = "high";
  return [c, x];
}

/**
 * Cheap, smooth blur: halve the size step by step down to 1/k, then scale back up the same way.
 * Works everywhere (no ctx.filter), and fast even on large photos.
 */
export function soften(
  src: Src,
  k: number,
  sx = 0,
  sy = 0,
  sw = src.width,
  sh = src.height,
): OffscreenCanvas {
  const tw = Math.max(1, Math.round(sw / k));
  const th = Math.max(1, Math.round(sh / k));
  let cur: Src = src;
  let [cx, cy, cw, ch] = [sx, sy, sw, sh];
  let w = sw;
  let h = sh;
  const down = (nw: number, nh: number) => {
    const [c, x] = canvas(nw, nh);
    x.drawImage(cur, cx, cy, cw, ch, 0, 0, nw, nh);
    cur = c;
    [cx, cy, cw, ch] = [0, 0, nw, nh];
    w = nw;
    h = nh;
  };
  while (w / 2 > tw && h / 2 > th) down(Math.round(w / 2), Math.round(h / 2));
  down(tw, th);
  while (w * 2 < sw && h * 2 < sh) down(w * 2, h * 2);
  down(Math.round(sw), Math.round(sh));
  return cur as OffscreenCanvas;
}

/* ---------- Redact (on the original, so crop and rotate carry it along) ---------- */

/** Face boxes grown to cover hair and chin, for blurring */
function faceRegions(faces: Box[]): Crop[] {
  return faces.map((f) => ({
    x: f.x - f.w * 0.15,
    y: f.y - f.h * 0.3,
    w: f.w * 1.3,
    h: f.h * 1.45,
  }));
}

function redact(src: Src, r: Redact, faces: Box[] = []): Src {
  const regions = [...r.regions, ...(r.faces ? faceRegions(faces) : [])];
  if (!regions.length) return src;
  const W = src.width;
  const H = src.height;
  const [c, x] = canvas(W, H);
  x.drawImage(src, 0, 0);
  for (const g of regions) {
    const rx = Math.max(0, Math.round(g.x * W));
    const ry = Math.max(0, Math.round(g.y * H));
    const rw = Math.max(1, Math.min(W - rx, Math.round(g.w * W)));
    const rh = Math.max(1, Math.min(H - ry, Math.round(g.h * H)));
    x.save();
    x.beginPath();
    if (r.shape === "ellipse")
      x.ellipse(rx + rw / 2, ry + rh / 2, rw / 2, rh / 2, 0, 0, Math.PI * 2);
    else x.rect(rx, ry, rw, rh);
    x.clip();
    if (r.mode === "fill") {
      x.fillStyle = r.color;
      x.fillRect(rx, ry, rw, rh);
    } else {
      const size = Math.max(rw, rh);
      if (r.mode === "pixelate") {
        const cell = Math.max(
          3,
          Math.round(size * (0.02 + (r.strength / 100) * 0.14)),
        );
        const [t, tx] = canvas(Math.ceil(rw / cell), Math.ceil(rh / cell));
        tx.drawImage(c, rx, ry, rw, rh, 0, 0, t.width, t.height);
        x.imageSmoothingEnabled = false;
        x.drawImage(t, rx, ry, rw, rh);
        x.imageSmoothingEnabled = true;
      } else {
        // Blur a slightly larger area so the edges don't pull in sharp detail
        const m = Math.round(size * 0.1);
        const bx = Math.max(0, rx - m);
        const by = Math.max(0, ry - m);
        const bw = Math.min(W - bx, rw + m * 2);
        const bh = Math.min(H - by, rh + m * 2);
        const k = 4 + (r.strength / 100) * 60;
        x.drawImage(soften(c, k, bx, by, bw, bh), bx, by);
      }
    }
    x.restore();
  }
  return c;
}

/* ---------- Crop, rotate, flip ---------- */

function geometry(src: Src, s: Settings): Src {
  if (!hasGeometry(s)) return src;
  const sx = s.crop ? s.crop.x * src.width : 0;
  const sy = s.crop ? s.crop.y * src.height : 0;
  const sw = Math.max(1, s.crop ? s.crop.w * src.width : src.width);
  const sh = Math.max(1, s.crop ? s.crop.h * src.height : src.height);
  const turned = s.rotate === 90 || s.rotate === 270;
  const bw = Math.round(turned ? sh : sw);
  const bh = Math.round(turned ? sw : sh);
  const [c, x] = canvas(bw, bh);
  x.translate(bw / 2, bh / 2);
  x.rotate((s.rotate * Math.PI) / 180);
  x.scale(s.flipH ? -1 : 1, s.flipV ? -1 : 1);
  x.drawImage(src, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
  return c;
}

/* ---------- Signature ink ---------- */

/**
 * Compare each pixel with the paper around it (a heavy blur), so shadows and uneven light
 * don't turn into grey smudges. Dark-enough pixels become ink, the rest transparent.
 */
function inkify(src: Src, ink: Ink): OffscreenCanvas {
  const W = src.width;
  const H = src.height;
  const [c, x] = canvas(W, H);
  x.drawImage(src, 0, 0);
  const img = x.getImageData(0, 0, W, H);
  const p = img.data;
  const paper = soften(src, 24).getContext("2d")!.getImageData(0, 0, W, H).data;
  const cutoff = 0.6 + (ink.threshold / 100) * 0.35;
  const hex = ink.color !== "keep" ? ink.color : null;
  const [cr, cg, cb] = hex
    ? [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    : [0, 0, 0];
  let minX = W;
  let minY = H;
  let maxX = -1;
  let maxY = -1;
  for (let i = 0, n = 0; i < p.length; i += 4, n++) {
    const lum = 0.299 * p[i]! + 0.587 * p[i + 1]! + 0.114 * p[i + 2]!;
    const bg =
      0.299 * paper[i]! + 0.587 * paper[i + 1]! + 0.114 * paper[i + 2]! || 1;
    const a = Math.min(1, Math.max(0, (cutoff - lum / bg) / 0.12));
    if (hex) {
      p[i] = cr!;
      p[i + 1] = cg!;
      p[i + 2] = cb!;
    }
    p[i + 3] = Math.round(a * 255);
    if (a > 0.3) {
      const px = n % W;
      const py = (n / W) | 0;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
  }
  x.putImageData(img, 0, 0);
  if (!ink.trim || maxX < 0) return c;
  const m = Math.round(Math.max(maxX - minX, maxY - minY) * 0.04) + 2;
  const tx = Math.max(0, minX - m);
  const ty = Math.max(0, minY - m);
  const tw = Math.min(W, maxX + m + 1) - tx;
  const th = Math.min(H, maxY + m + 1) - ty;
  const [t, tctx] = canvas(tw, th);
  tctx.drawImage(c, tx, ty, tw, th, 0, 0, tw, th);
  return t;
}

/* ---------- Resize ---------- */

function place(src: Src, w: number, h: number, s: Settings): OffscreenCanvas {
  const [c, x] = canvas(w, h);
  if (s.w && s.h && !s.lock) {
    // Fixed frame (social and form presets): scale to cover and crop the overflow evenly.
    const scale = Math.max(w / src.width, h / src.height);
    const dw = src.width * scale;
    const dh = src.height * scale;
    x.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
  } else x.drawImage(src, 0, 0, w, h);
  return c;
}

/* ---------- Colour ---------- */

function color(c: OffscreenCanvas, s: Settings) {
  const m = colorMatrix(s.adjust, s.filter, s.filterAmount);
  const sharpen = s.adjust?.sharpen ?? 0;
  const vignette = s.adjust?.vignette ?? 0;
  const x = c.getContext("2d")!;
  const W = c.width;
  const H = c.height;
  if (m || sharpen) {
    const img = x.getImageData(0, 0, W, H);
    const p = img.data;
    if (m) {
      for (let i = 0; i < p.length; i += 4) {
        const r = p[i]!;
        const g = p[i + 1]!;
        const b = p[i + 2]!;
        p[i] = m[0]! * r + m[1]! * g + m[2]! * b + m[4]!;
        p[i + 1] = m[5]! * r + m[6]! * g + m[7]! * b + m[9]!;
        p[i + 2] = m[10]! * r + m[11]! * g + m[12]! * b + m[14]!;
      }
    }
    if (sharpen) {
      // 3×3 unsharp kernel on a copy
      const a = (sharpen / 100) * 0.8;
      const q = new Uint8ClampedArray(p);
      const row = W * 4;
      for (let y = 1; y < H - 1; y++) {
        for (let xx = 1; xx < W - 1; xx++) {
          const i = y * row + xx * 4;
          for (let k = 0; k < 3; k++) {
            const j = i + k;
            p[j] =
              q[j]! * (1 + 4 * a) -
              a * (q[j - 4]! + q[j + 4]! + q[j - row]! + q[j + row]!);
          }
        }
      }
    }
    x.putImageData(img, 0, 0);
  }
  if (vignette) {
    const r = Math.hypot(W, H) / 2;
    const g = x.createRadialGradient(W / 2, H / 2, r * 0.35, W / 2, H / 2, r);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${(vignette / 100) * 0.75})`);
    x.save();
    x.globalCompositeOperation = "source-atop";
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    x.restore();
  }
}

/* ---------- Text ---------- */

function wrap(x: Ctx, text: string, max: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && x.measureText(next).width > max) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

function caption(c: OffscreenCanvas, t: TextLayer) {
  const x = c.getContext("2d")!;
  const W = c.width;
  const H = c.height;
  const size = Math.max(10, Math.round((W * t.size) / 100));
  x.font = `${t.font === "impact" ? 400 : 800} ${size}px ${FONTS[t.font]}`;
  x.textAlign = "center";
  x.lineJoin = "round";
  x.fillStyle = t.color;
  x.strokeStyle = isLight(t.color) ? "#000" : "#fff";
  x.lineWidth = Math.max(2, size * 0.14);
  const lh = size * 1.12;
  const pad = size * 0.35;
  const draw = (raw: string, top: boolean) => {
    const text = t.font === "impact" ? raw.toUpperCase() : raw;
    if (!text.trim()) return;
    const lines = wrap(x, text, W * 0.92);
    x.textBaseline = top ? "top" : "bottom";
    lines.forEach((line, i) => {
      const y = top ? pad + i * lh : H - pad - (lines.length - 1 - i) * lh;
      if (t.stroke) x.strokeText(line, W / 2, y);
      x.fillText(line, W / 2, y);
    });
  };
  draw(t.top, true);
  draw(t.bottom, false);
}

function isLight(hex: string): boolean {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) || 0);
  return 0.299 * v[0]! + 0.587 * v[1]! + 0.114 * v[2]! > 150;
}

/* ---------- Watermark ---------- */

function watermark(c: OffscreenCanvas, m: Watermark, logo: ImageBitmap | null) {
  const x = c.getContext("2d")!;
  const W = c.width;
  const H = c.height;
  const margin = Math.round(Math.min(W, H) * 0.035);
  let bw: number;
  let bh: number;
  let drawAt: (px: number, py: number) => void;
  x.save();
  x.globalAlpha = m.opacity / 100;
  if (logo) {
    bw = Math.max(8, Math.round((W * m.size) / 100));
    bh = Math.round((bw * logo.height) / logo.width);
    drawAt = (px, py) => x.drawImage(logo, px, py, bw, bh);
  } else {
    if (!m.text.trim()) {
      x.restore();
      return;
    }
    const size = Math.max(8, Math.round((W * m.size) / 100));
    x.font = `600 ${size}px ${FONTS.sans}`;
    x.textBaseline = "top";
    x.fillStyle = m.color;
    x.shadowColor = isLight(m.color)
      ? "rgba(0,0,0,.45)"
      : "rgba(255,255,255,.45)";
    x.shadowBlur = size * 0.15;
    bw = Math.ceil(x.measureText(m.text).width);
    bh = Math.round(size * 1.15);
    drawAt = (px, py) => x.fillText(m.text, px, py);
  }
  if (m.pos === "tile") {
    // Diagonal rows across the whole image
    x.translate(W / 2, H / 2);
    x.rotate(-Math.PI / 6);
    const stepX = bw + Math.max(bw * 0.8, W * 0.08);
    const stepY = bh * 3.2;
    const reach = Math.hypot(W, H);
    for (let yy = -reach / 2, row = 0; yy < reach / 2; yy += stepY, row++)
      for (
        let xx = -reach / 2 - (row % 2) * (stepX / 2);
        xx < reach / 2;
        xx += stepX
      )
        drawAt(xx, yy);
  } else {
    const col = m.pos[1];
    const row = m.pos[0];
    const px =
      col === "l" ? margin : col === "r" ? W - margin - bw : (W - bw) / 2;
    const py =
      row === "t" ? margin : row === "b" ? H - margin - bh : (H - bh) / 2;
    drawAt(px, py);
  }
  x.restore();
}

/* ---------- Frame: border, rounded corners, padding, background, shadow, window bar ---------- */

function frame(img: OffscreenCanvas, f: Frame): OffscreenCanvas {
  const w = img.width;
  const h = img.height;
  const m = Math.min(w, h);
  const border = Math.round((m * f.border) / 100);
  const radius = (m * f.radius) / 100;
  const pad = Math.round((m * f.pad) / 100);
  const bar = f.chrome === "none" ? 0 : Math.round(Math.max(24, w * 0.032));
  const cw = w + border * 2;
  const ch = h + border * 2 + bar;
  let W = cw + pad * 2;
  let H = ch + pad * 2;
  const r = RATIOS.find((q) => q.id === f.ratio);
  if (r) {
    if (W / H < r.r) W = Math.round(H * r.r);
    else H = Math.round(W / r.r);
  }
  const [c, x] = canvas(W, H);
  const outside = W > cw || H > ch;
  if (outside && f.fill === "color") {
    x.fillStyle = f.color;
    x.fillRect(0, 0, W, H);
  } else if (outside && f.fill === "gradient") {
    const stops = GRADIENTS.find((g) => g.id === f.gradient)?.stops ?? [
      "#fff",
      "#ddd",
    ];
    const g = x.createLinearGradient(0, 0, W, H);
    stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
  } else if (outside && f.fill === "blur") {
    // The photo itself, enlarged to cover and blurred
    const scale = Math.max(W / w, H / h);
    const [bg, bx] = canvas(W, H);
    bx.drawImage(
      img,
      (W - w * scale) / 2,
      (H - h * scale) / 2,
      w * scale,
      h * scale,
    );
    x.drawImage(soften(bg, 40), 0, 0);
    x.fillStyle = "rgba(0,0,0,.08)";
    x.fillRect(0, 0, W, H);
  }
  const ox = Math.round((W - cw) / 2);
  const oy = Math.round((H - ch) / 2);
  const outerR = radius ? radius + border : 0;
  const card = () => {
    x.beginPath();
    x.roundRect(ox, oy, cw, ch, outerR);
  };
  if (f.shadow) {
    x.save();
    x.shadowColor = "rgba(15,20,40,.32)";
    x.shadowBlur = m * 0.06;
    x.shadowOffsetY = m * 0.02;
    card();
    x.fillStyle = border ? f.borderColor : "#fff";
    x.fill();
    x.restore();
  }
  x.save();
  card();
  x.clip();
  if (border) {
    x.fillStyle = f.borderColor;
    x.fillRect(ox, oy, cw, ch);
  }
  if (bar) {
    const dark = f.chrome === "dark";
    x.fillStyle = dark ? "#2b2f36" : "#e9ecf1";
    x.fillRect(ox + border, oy + border, w, bar);
    const d = bar * 0.22;
    ["#ff5f57", "#febc2e", "#28c840"].forEach((col, i) => {
      x.beginPath();
      x.arc(
        ox + border + bar * 0.6 + i * d * 3.1,
        oy + border + bar / 2,
        d,
        0,
        Math.PI * 2,
      );
      x.fillStyle = col;
      x.fill();
    });
  }
  x.beginPath();
  x.roundRect(
    ox + border,
    oy + border + bar,
    w,
    h,
    bar ? [0, 0, radius, radius] : radius,
  );
  x.clip();
  x.drawImage(img, ox + border, oy + border + bar);
  x.restore();
  return c;
}

/* ---------- Print sheet ---------- */

function sheet(photo: OffscreenCanvas, id: string): OffscreenCanvas {
  const sh = SHEETS.find((q) => q.id === id)!;
  const gap = 24; // 2 mm at 300 dpi
  const fit = (W: number, H: number) =>
    Math.floor((W - gap) / (photo.width + gap)) *
    Math.floor((H - gap) / (photo.height + gap));
  // Use whichever orientation fits more copies
  const [W, H] =
    fit(sh.h, sh.w) > fit(sh.w, sh.h) ? [sh.h, sh.w] : [sh.w, sh.h];
  const cols = Math.max(1, Math.floor((W - gap) / (photo.width + gap)));
  const rows = Math.max(1, Math.floor((H - gap) / (photo.height + gap)));
  const [c, x] = canvas(W, H);
  x.fillStyle = "#fff";
  x.fillRect(0, 0, W, H);
  const gw = cols * photo.width + (cols - 1) * gap;
  const gh = rows * photo.height + (rows - 1) * gap;
  const ox = Math.round((W - gw) / 2);
  const oy = Math.round((H - gh) / 2);
  x.strokeStyle = "#c8c8c8";
  x.lineWidth = 1;
  for (let r = 0; r < rows; r++)
    for (let k = 0; k < cols; k++) {
      const px = ox + k * (photo.width + gap);
      const py = oy + r * (photo.height + gap);
      x.drawImage(photo, px, py);
      x.strokeRect(px - 0.5, py - 0.5, photo.width + 1, photo.height + 1);
    }
  return c;
}

/* ---------- Background ---------- */

function background(
  out: OffscreenCanvas,
  maskOut: OffscreenCanvas,
  s: Settings,
): OffscreenCanvas {
  const bg = s.bg!;
  const W = out.width;
  const H = out.height;
  const [fg, fx] = canvas(W, H);
  fx.drawImage(out, 0, 0);
  fx.globalCompositeOperation = "destination-in";
  fx.drawImage(maskOut, 0, 0);
  if (bg.mode === "remove") return fg;
  const [c, x] = canvas(W, H);
  if (bg.mode === "color") {
    x.fillStyle = bg.color;
    x.fillRect(0, 0, W, H);
  } else x.drawImage(soften(out, 28), 0, 0);
  x.drawImage(fg, 0, 0);
  return c;
}

/** Render everything up to encoding. */
export function render(
  bmp: ImageBitmap,
  s: Settings,
  srcType: string,
  extras: Extras = {},
): OffscreenCanvas {
  let src: Src = bmp;
  // ID photo: frame the biggest face at the official size (falls back to a centred crop)
  if (s.passport) {
    const spec =
      PHOTO_SPECS.find((p) => p.id === s.passport!.spec) ?? PHOTO_SPECS[0]!;
    const face = [...(extras.faces ?? [])].sort(
      (a, b) => b.w * b.h - a.w * a.h,
    )[0];
    s = {
      ...s,
      crop: face ? passportCrop(bmp, face, spec, s.passport.zoom) : s.crop,
      ratio: null,
      w: spec.w,
      h: spec.h,
      lock: false,
      size: null,
    };
  }
  if (s.redact) src = redact(src, s.redact, extras.faces);
  let g = geometry(src, s);
  if (s.ink) g = inkify(g, s.ink);
  const [w, h] = fitDims(g.width, g.height, s);
  let out = place(g, w, h, s);
  if (s.bg && extras.mask) {
    const maskOut = place(geometry(extras.mask, s), w, h, s);
    out = background(out, maskOut, s);
  }
  if (s.adjust || s.filter) color(out, s);
  if (s.text) caption(out, s.text);
  if (s.mark) watermark(out, s.mark, extras.logo ?? null);
  if (s.frame) out = frame(out, s.frame);
  if (s.sheet) out = sheet(out, s.sheet);
  if (outType(srcType, s) === "image/jpeg") {
    // JPEG has no transparency; paint white (or the chosen background) underneath.
    const [c, x] = canvas(out.width, out.height);
    x.fillStyle = s.bg?.mode === "color" ? s.bg.color : "#fff";
    x.fillRect(0, 0, c.width, c.height);
    x.drawImage(out, 0, 0);
    out = c;
  }
  return out;
}
