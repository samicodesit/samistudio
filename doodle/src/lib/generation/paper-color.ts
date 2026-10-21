import { DOODLE_PAPER_COLOR } from "./profile";

import { PAPER_CORRECTION_VERSION, type PaperCorrectionMetadata } from "./paper-color-metadata";

const SIZE = 1024;
const MAX_BYTES = 8 * 1024 * 1024;
const INK_LIMIT = 120;
const TARGET = DOODLE_PAPER_COLOR.slice(1).match(/../g)!.map(channel => parseInt(channel, 16));
interface PaperCorrectionResult {
  bytes: Uint8Array;
  metadata: PaperCorrectionMetadata;
}

function quantile(histogram: Uint32Array, count: number, fraction: number): number {
  let total = 0;
  for (let value = 0; value < histogram.length; value++) {
    total += histogram[value];
    if (total >= count * fraction) return value;
  }
  return 255;
}

function paperEstimate(pixels: Buffer) {
  const histograms = Array.from({ length: 3 }, () => new Uint32Array(256));
  let samples = 0;
  let colored = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    if (pixels[i + 3] !== 255) return null;
    const warm = r >= g - 15 && g - b > 8 && r - b > 12;
    if (!warm && Math.max(r, g, b) >= INK_LIMIT && Math.max(r, g, b) - Math.min(r, g, b) > 40) colored++;
    if (!(r > 170 && g > 150 && r >= g - 15 && g - b > 20 && r - b > 35)) continue;
    samples++;
    histograms[0][r]++;
    histograms[1][g]++;
    histograms[2][b]++;
  }
  // Only normalize predominantly yellow, opaque drawings with modest color drift.
  // These gates prefer an unchanged image to guessing about other artwork.
  if (samples < SIZE * SIZE * 0.6 || colored > SIZE * SIZE * 0.001) return null;
  const rgb = histograms.map(histogram => quantile(histogram, samples, 0.5));
  if (rgb.some((value, channel) => Math.abs(value - TARGET[channel]) > 48)) return null;
  if (quantile(histograms[1], samples, 0.9) - quantile(histograms[1], samples, 0.1) > 40) return null;
  return rgb;
}

/** Best-effort color-only processing. All skips and failures return the same original bytes. */
export async function correctPaperColor(bytes: Uint8Array): Promise<PaperCorrectionResult> {
  const startedAt = Date.now();
  const finish = (status: PaperCorrectionMetadata["status"], output = bytes): PaperCorrectionResult => ({
    bytes: output,
    metadata: { version: PAPER_CORRECTION_VERSION, status, durationMs: Math.min(5_000, Math.max(0, Date.now() - startedAt)) },
  });
  if (process.env.DOODLE_PAPER_CORRECTION === "off") return finish("disabled");
  if (bytes.length > MAX_BYTES) return finish("unsupported");
  try {
    // Import inside the fallback boundary so native-library failures cannot discard a doodle.
    const { default: sharp } = await import("sharp");
    const image = sharp(bytes, { limitInputPixels: SIZE * SIZE, failOn: "warning" });
    const info = await image.metadata();
    const supported = info.format === "png" && info.width === SIZE && info.height === SIZE
      && info.depth === "uchar" && info.space === "srgb" && info.channels >= 3 && info.channels <= 4
      && !info.hasProfile && (info.pages ?? 1) === 1 && (info.orientation ?? 1) === 1;
    if (!supported) return finish("unsupported");
    const before = await image.ensureAlpha().raw().timeout({ seconds: 2 }).toBuffer();
    const base = paperEstimate(before);
    if (!base) return finish("uncertain");
    const shift = TARGET.map((value, channel) => value - base[channel]);
    if (shift.every(value => value === 0)) return finish("unchanged");

    const after = Buffer.from(before);
    const paperBrightness = Math.min(base[0], base[1]);
    for (let i = 0; i < before.length; i += 4) {
      const r = before[i], g = before[i + 1], b = before[i + 2];
      if (r - b < 12 || g - b < 8 || Math.max(r, g, b) < INK_LIMIT) continue;
      const t = Math.max(0, Math.min(1, (Math.min(r, g) - INK_LIMIT) / (paperBrightness - INK_LIMIT)));
      const weight = t * t * (3 - 2 * t);
      for (let channel = 0; channel < 3; channel++) {
        after[i + channel] = Math.max(0, Math.min(255, Math.round(before[i + channel] + shift[channel] * weight)));
      }
    }
    const correctedBase = paperEstimate(after);
    if (!correctedBase || correctedBase.some((value, channel) => Math.abs(value - TARGET[channel]) > 1)) return finish("uncertain");
    const output = await sharp(after, { raw: { width: SIZE, height: SIZE, channels: 4 } }).png().timeout({ seconds: 2 }).toBuffer();
    return finish("corrected", output);
  } catch {
    return finish("error");
  }
}
