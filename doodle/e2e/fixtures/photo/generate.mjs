// Synthetic regression fixtures, not photos or marketing assets.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
const output = fileURLToPath(new URL(".", import.meta.url));
const width = 1200, height = 800;
const pixels = Buffer.alloc(width * height * 3);
const colors = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0]];
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const color = colors[(y >= height / 2 ? 2 : 0) + (x >= width / 2 ? 1 : 0)];
  pixels.set(color, (y * width + x) * 3);
}
for (let orientation = 1; orientation <= 8; orientation++) {
  await sharp(pixels, { raw: { width, height, channels: 3 } })
    .withMetadata({ orientation }).jpeg({ quality: 95 }).toFile(`${output}orientation-${orientation}.jpg`);
}
await sharp({ create: { width: 8000, height: 6000, channels: 3, background: "#ffdf60" } })
  .composite([{ input: Buffer.from('<svg width="8000" height="6000"><rect x="2000" y="1500" width="4000" height="3000" fill="red"/></svg>') }])
  .jpeg({ quality: 90 }).toFile(`${output}camera-48mp.jpg`);
await sharp({ create: { width: 600, height: 400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: Buffer.from('<svg width="600" height="400"><circle cx="300" cy="200" r="100" fill="red"/></svg>') }])
  .png().toFile(`${output}transparent.png`);
await sharp({ create: { width: 20, height: 2400, channels: 3, background: "#27a16a" } }).png().toFile(`${output}tall.png`);
await sharp({ create: { width: 120, height: 80, channels: 3, background: "#27a16a" } }).webp().toFile(`${output}small.webp`);
