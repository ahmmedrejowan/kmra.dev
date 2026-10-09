/**
 * Joining clips without re-encoding (the fast engine, in ./wc.worker.ts): the compressed packets
 * of each clip are written one after another into one file, timestamps shifted. Only possible
 * when every clip was encoded the same way (same codec, frame size and codec settings, same sound
 * format); otherwise `ConcatUnsupported` is thrown and the caller re-encodes with ffmpeg.
 */
import {
  EncodedAudioPacketSource,
  EncodedPacketSink,
  EncodedVideoPacketSource,
  Output,
  BufferTarget,
  type AudioCodec,
  type Input,
  type InputAudioTrack,
  type InputVideoTrack,
  type OutputFormat,
  type VideoCodec,
} from "mediabunny";

export class ConcatUnsupported extends Error {}

const same = (a?: AllowSharedBufferSource, b?: AllowSharedBufferSource) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const x = ArrayBuffer.isView(a)
    ? new Uint8Array(a.buffer, a.byteOffset, a.byteLength)
    : new Uint8Array(a);
  const y = ArrayBuffer.isView(b)
    ? new Uint8Array(b.buffer, b.byteOffset, b.byteLength)
    : new Uint8Array(b);
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

interface Clip {
  v: InputVideoTrack;
  a: InputAudioTrack | null;
  start: number;
  length: number;
}

export async function concatCopy(
  inputs: Input[],
  format: OutputFormat,
  onRatio: (r: number) => void,
  stopped: () => boolean,
): Promise<ArrayBuffer> {
  const clips: Clip[] = [];
  for (const input of inputs) {
    const v = await input.getPrimaryVideoTrack();
    if (!v) throw new ConcatUnsupported("A clip has no picture");
    const a = await input.getPrimaryAudioTrack();
    // The picture sets the pace: each clip starts where the last clip's picture ended
    const start = await v.getFirstTimestamp();
    const end = await v.computeDuration();
    clips.push({ v, a, start, length: Math.max(0, end - start) });
  }
  const first = clips[0]!;
  const vCodec = await first.v.getCodec();
  const vCfg = await first.v.getDecoderConfig();
  const rotation = await first.v.getRotation();
  if (!vCodec || !vCfg || !format.getSupportedVideoCodecs().includes(vCodec))
    throw new ConcatUnsupported("The video codec can't be copied");
  const aCodec = first.a ? await first.a.getCodec() : null;
  const aCfg = first.a ? await first.a.getDecoderConfig() : null;
  if (
    first.a &&
    (!aCodec || !aCfg || !format.getSupportedAudioCodecs().includes(aCodec))
  )
    throw new ConcatUnsupported("The sound codec can't be copied");
  for (const c of clips.slice(1)) {
    const cfg = await c.v.getDecoderConfig();
    if (
      (await c.v.getCodec()) !== vCodec ||
      !cfg ||
      cfg.codec !== vCfg.codec ||
      cfg.codedWidth !== vCfg.codedWidth ||
      cfg.codedHeight !== vCfg.codedHeight ||
      !same(cfg.description, vCfg.description) ||
      (await c.v.getRotation()) !== rotation
    )
      throw new ConcatUnsupported(
        "The clips' pictures are encoded differently",
      );
    if (!!c.a !== !!first.a)
      throw new ConcatUnsupported("Some clips have sound and some don't");
    if (c.a) {
      const ac = await c.a.getDecoderConfig();
      if (
        (await c.a.getCodec()) !== aCodec ||
        !ac ||
        ac.codec !== aCfg!.codec ||
        ac.sampleRate !== aCfg!.sampleRate ||
        ac.numberOfChannels !== aCfg!.numberOfChannels ||
        !same(ac.description, aCfg!.description)
      )
        throw new ConcatUnsupported("The clips' sound is encoded differently");
    }
  }

  const output = new Output({ format, target: new BufferTarget() });
  const vSrc = new EncodedVideoPacketSource(vCodec as VideoCodec);
  output.addVideoTrack(vSrc, { rotation });
  const aSrc = aCodec
    ? new EncodedAudioPacketSource(aCodec as AudioCodec)
    : null;
  if (aSrc) output.addAudioTrack(aSrc);
  await output.start();

  const offsets: number[] = [];
  let total = 0;
  for (const c of clips) {
    offsets.push(total);
    total += c.length;
  }
  const stop = () => {
    if (stopped()) throw new DOMException("cancelled", "AbortError");
  };

  const video = async () => {
    let meta = true;
    for (const [i, c] of clips.entries()) {
      const shift = offsets[i]! - c.start;
      for await (const p of new EncodedPacketSink(c.v).packets()) {
        stop();
        const t = p.timestamp + shift;
        await vSrc.add(
          p.clone({ timestamp: Math.max(0, t) }),
          meta ? { decoderConfig: vCfg } : undefined,
        );
        meta = false;
        onRatio(Math.min(0.99, (t + p.duration) / Math.max(0.001, total)));
      }
    }
  };
  const audio = async () => {
    if (!aSrc) return;
    let meta = true;
    // Sound runs on: each clip starts where the last ended (no overlap from encoder priming)
    let end = 0;
    for (const [i, c] of clips.entries()) {
      let shift: number | null = null;
      for await (const p of new EncodedPacketSink(c.a!).packets()) {
        stop();
        shift ??= Math.max(offsets[i]! - c.start, end - p.timestamp);
        const t = p.timestamp + shift;
        await aSrc.add(
          p.clone({ timestamp: t }),
          meta ? { decoderConfig: aCfg! } : undefined,
        );
        meta = false;
        end = t + p.duration;
      }
    }
  };
  try {
    await Promise.all([video(), audio()]);
    await output.finalize();
  } catch (e) {
    await output.cancel().catch(() => {});
    throw e;
  }
  return (output.target as BufferTarget).buffer!;
}
