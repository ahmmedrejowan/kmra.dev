/** ICO file holding PNG images (supported by every current browser and Windows) */
export async function icoFromPngs(
  images: { size: number; blob: Blob }[],
): Promise<Blob> {
  const datas = await Promise.all(
    images.map(async (i) => new Uint8Array(await i.blob.arrayBuffer())),
  );
  const head = 6 + 16 * images.length;
  const total = head + datas.reduce((a, d) => a + d.length, 0);
  const buf = new Uint8Array(total);
  const v = new DataView(buf.buffer);
  v.setUint16(2, 1, true);
  v.setUint16(4, images.length, true);
  let offset = head;
  images.forEach((img, i) => {
    const e = 6 + i * 16;
    v.setUint8(e, img.size >= 256 ? 0 : img.size);
    v.setUint8(e + 1, img.size >= 256 ? 0 : img.size);
    v.setUint16(e + 4, 1, true);
    v.setUint16(e + 6, 32, true);
    v.setUint32(e + 8, datas[i]!.length, true);
    v.setUint32(e + 12, offset, true);
    buf.set(datas[i]!, offset);
    offset += datas[i]!.length;
  });
  return new Blob([buf], { type: "image/x-icon" });
}
