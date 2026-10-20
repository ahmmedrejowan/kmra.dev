/** Types for gifenc (MIT, https://github.com/mattdesl/gifenc), which ships none. */
declare module "gifenc" {
  type Format = "rgb565" | "rgb444" | "rgba4444";
  type Palette = number[][];
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: Format; oneBitAlpha?: boolean | number; clearAlpha?: boolean },
  ): Palette;
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: Palette,
    format?: Format,
  ): Uint8Array;
  export function GIFEncoder(): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: { palette?: Palette; transparent?: boolean; transparentIndex?: number; delay?: number },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  };
}
