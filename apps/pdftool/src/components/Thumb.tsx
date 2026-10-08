import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { renderPage } from "../lib/pdfjs";

/** Rendered thumbnails, kept for the session: "<file>:<page>:<width>" → object URL */
const cache = new Map<string, Promise<string>>();

function thumb(
  key: string,
  doc: PDFDocumentProxy,
  index: number,
  width: number,
) {
  const id = `${key}:${index}:${width}`;
  let p = cache.get(id);
  if (!p) {
    p = (async () => {
      const page = await doc.getPage(index + 1);
      const v = page.getViewport({ scale: 1 });
      const canvas = await renderPage(doc, index + 1, (width * 2) / v.width);
      const blob = await new Promise<Blob>((r) =>
        canvas.toBlob((b) => r(b!), "image/jpeg", 0.8),
      );
      return URL.createObjectURL(blob);
    })();
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

/** A page picture that only renders once it scrolls into view. Rotation is applied with CSS. */
export default function Thumb({
  fileKey,
  doc,
  index,
  rotate = 0,
  width = 150,
  alt,
}: {
  fileKey: string;
  doc: PDFDocumentProxy | null;
  index: number;
  rotate?: number;
  width?: number;
  alt: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Already on screen (or near it): start now rather than waiting for the observer
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight + 300 && r.bottom > -300) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !doc) return;
    let live = true;
    void thumb(fileKey, doc, index, width).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [visible, doc, fileKey, index, width]);

  const turned = rotate % 180 !== 0;
  return (
    <div className={`thumb${turned ? " turned" : ""}`} ref={ref}>
      {url ? (
        <img
          src={url}
          alt={alt}
          style={{ transform: `rotate(${rotate}deg)` }}
          draggable={false}
        />
      ) : (
        <span className="thumb-wait" aria-hidden="true" />
      )}
    </div>
  );
}

/** Size of a page in points as it displays (the page's own /Rotate applied); null while loading */
export function usePageBox(doc: PDFDocumentProxy | null, index: number) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!doc) return;
    let live = true;
    void doc
      .getPage(index + 1)
      .then((p) => {
        const v = p.getViewport({ scale: 1 });
        if (live) setBox({ w: v.width, h: v.height });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [doc, index]);
  return box;
}

/**
 * A page as a white sheet at its real shape (A4, Letter, landscape…), for previews that draw on top
 * of the page. `children` gets the sheet's size in points, so overlays can use an SVG viewBox.
 */
export function Sheet({
  fileKey,
  doc,
  index,
  rotate = 0,
  width = 360,
  alt,
  className = "",
  children,
}: {
  fileKey: string;
  doc: PDFDocumentProxy | null;
  index: number;
  rotate?: number;
  width?: number;
  alt: string;
  className?: string;
  children?: (box: { vw: number; vh: number }) => ReactNode;
}) {
  const box = usePageBox(doc, index) ?? { w: 595.28, h: 841.89 };
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!doc) return;
    let live = true;
    void thumb(fileKey, doc, index, width).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [doc, fileKey, index, width]);
  const turned = rotate % 180 !== 0;
  const vw = turned ? box.h : box.w;
  const vh = turned ? box.w : box.h;
  return (
    <div
      className={`sheet ${className}`}
      style={{ aspectRatio: `${vw} / ${vh}` }}
    >
      {url ? (
        <img
          src={url}
          alt={alt}
          draggable={false}
          style={{
            width: `${(box.w / vw) * 100}%`,
            height: `${(box.h / vh) * 100}%`,
            transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
          }}
        />
      ) : (
        <span className="thumb-wait" aria-hidden="true" />
      )}
      {children?.({ vw, vh })}
    </div>
  );
}
