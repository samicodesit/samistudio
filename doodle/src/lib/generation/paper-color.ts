import { paperColorHex, type PaperColorId } from "./paper-colors";

import { PAPER_CORRECTION_VERSION, type PaperCorrectionMetadata } from "./paper-color-metadata";

const SIZE = 1024;
const MAX_BYTES = 8 * 1024 * 1024;
const INK_LIMIT = 120;

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

/** Neutral graphite mixed with paper follows the paper's chroma direction. */
function paperMatcher(target: number[]) {
  const mean = (target[0] + target[1] + target[2]) / 3;
  const cr = target[0] - mean, cg = target[1] - mean, cb = target[2] - mean;
  const norm = cr * cr + cg * cg + cb * cb;
  // White has no chroma direction. Admit only near-neutral paper and graphite.
  if (norm < 1) return (r: number, g: number, b: number) => Math.max(r, g, b) - Math.min(r, g, b) <= 18;
  return (r: number, g: number, b: number) => {
    const valueMean = (r + g + b) / 3;
    const dr = r - valueMean, dg = g - valueMean, db = b - valueMean;
    const scale = (dr * cr + dg * cg + db * cb) / norm;
    return scale > 0.12 && scale < 2 && Math.abs(dr - scale * cr) <= 18
      && Math.abs(dg - scale * cg) <= 18 && Math.abs(db - scale * cb) <= 18;
  };
}

function paperEstimate(pixels: Buffer, target: number[], yellow: boolean) {
  const matchesPaper = paperMatcher(target);
  const histograms = Array.from({ length: 3 }, () => new Uint32Array(256));
  let samples = 0;
  let colored = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    if (pixels[i + 3] !== 255) return null;
    const warm = yellow ? r >= g - 15 && g - b > 8 && r - b > 12 : matchesPaper(r, g, b);
    if (!warm && Math.max(r, g, b) >= INK_LIMIT && Math.max(r, g, b) - Math.min(r, g, b) > 40) colored++;
    if (yellow ? !(r > 170 && g > 150 && r >= g - 15 && g - b > 20 && r - b > 35) : !(warm && Math.min(r, g, b) > INK_LIMIT && Math.max(r, g, b) > 170)) continue;
    samples++;
    histograms[0][r]++;
    histograms[1][g]++;
    histograms[2][b]++;
  }
  // Only normalize predominantly matching, opaque drawings with modest color drift.
  // These gates prefer an unchanged image to guessing about other artwork.
  if (samples < SIZE * SIZE * 0.6 || colored > SIZE * SIZE * 0.001) return null;
  const rgb = histograms.map(histogram => quantile(histogram, samples, 0.5));
  if (rgb.some((value, channel) => Math.abs(value - target[channel]) > 48)) return null;
  if ((yellow ? [histograms[1]] : histograms).some(h => quantile(h, samples, 0.9) - quantile(h, samples, 0.1) > 40)) return null;
  return rgb;
}

/** Best-effort color-only processing. All skips and failures return the same original bytes. */
export async function correctPaperColor(bytes: Uint8Array, paperColor: PaperColorId = "yellow"): Promise<PaperCorrectionResult> {
  const startedAt = Date.now();
  const target = paperColorHex(paperColor).slice(1).match(/../g)!.map(c => parseInt(c, 16));
  const yellow = paperColor === "yellow";
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
    const base = paperEstimate(before, target, yellow);
    if (!base) return finish("uncertain");
    const shift = target.map((value, channel) => value - base[channel]);
    if (shift.every(value => value === 0)) return finish("unchanged");

    const after = Buffer.from(before);
    const matchesBase = paperMatcher(base);
    const paperBrightness = yellow ? Math.min(base[0], base[1]) : Math.min(...base);
    for (let i = 0; i < before.length; i += 4) {
      const r = before[i], g = before[i + 1], b = before[i + 2];
      if ((yellow ? r - b < 12 || g - b < 8 : !matchesBase(r, g, b)) || Math.max(r, g, b) < INK_LIMIT) continue;
      const t = Math.max(0, Math.min(1, ((yellow ? Math.min(r, g) : Math.min(r, g, b)) - INK_LIMIT) / (paperBrightness - INK_LIMIT)));
      const weight = t * t * (3 - 2 * t);
      for (let channel = 0; channel < 3; channel++) {
        after[i + channel] = Math.max(0, Math.min(255, Math.round(before[i + channel] + shift[channel] * weight)));
      }
    }
    const correctedBase = paperEstimate(after, target, yellow);
    if (!correctedBase || correctedBase.some((value, channel) => Math.abs(value - target[channel]) > 1)) return finish("uncertain");
    const output = await sharp(after, { raw: { width: SIZE, height: SIZE, channels: 4 } }).png().timeout({ seconds: 2 }).toBuffer();
    return finish("corrected", output);
  } catch {
    return finish("error");
  }
}
