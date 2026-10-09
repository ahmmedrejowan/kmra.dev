import { useEffect, useState } from "react";

/** An image (GIF, PNG …) from a Blob, its object URL freed when it changes or unmounts */
export function BlobImage({
  blob,
  alt,
  className,
  aspect,
}: {
  blob: Blob;
  alt: string;
  className?: string;
  /** Width ÷ height when known, so the box keeps its shape while loading */
  aspect?: number;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url ? (
    <img
      className={className}
      src={url}
      alt={alt}
      style={
        aspect && Number.isFinite(aspect) && aspect > 0
          ? ({ "--ar": aspect } as React.CSSProperties)
          : undefined
      }
    />
  ) : null;
}

/** Waits `ms`; resolves false when a newer call started meanwhile (for debounced async work) */
export function debounced(ms: number) {
  let gen = 0;
  return async () => {
    const g = ++gen;
    await new Promise((r) => setTimeout(r, ms));
    return g === gen;
  };
}
