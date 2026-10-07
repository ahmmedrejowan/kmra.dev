import { useEffect, useRef, useState } from "react";
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
