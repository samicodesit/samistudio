import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const flower = "M28 14 C22 6 17 12 20 18 C11 19 15 27 23 25 C21 34 31 35 33 26 C42 28 46 20 37 17 C40 9 31 7 28 14 Z";
const stem = "M28 25 C29 31 26 38 28 45";
const leaves = "M27 37 C22 29 15 30 16 32 C17 38 22 40 27 37 M28 40 C33 32 40 33 39 35 C36 40 32 42 28 40";
const drawings = {
  simple: '<path d="' + flower + " " + stem + '"/><circle cx="28" cy="20" r="3.2"/>',
  medium: '<path d="' + flower + " " + stem + " " + leaves + '"/><circle cx="28" cy="20" r="3.5"/><path d="M26 16 24 13 M32 18 35 16 M31 24 32 27 M24 22 20 23"/>',
  detailed: '<path d="' + flower + " " + stem + " " + leaves + '"/><circle cx="28" cy="20" r="3.5"/><path d="M25 16 C24 14 23 12 22 12 M28 15 27 11 M32 17 C34 14 35 13 35 12 M33 21 40 22 M31 24 32 29 M26 24 25 29 M23 20 17 21 M27 37 19 33 M22 36 22 33 M25 37 25 35 M29 39 36 35 M33 38 33 36 M28 31 25 30"/><path d="m13 15 0 3 m-1.5-1.5 3 0"/><circle cx="41" cy="30" r=".8" fill="#20231f" stroke="none"/><circle cx="27" cy="19" r=".55" fill="#20231f" stroke="none"/><circle cx="29" cy="21" r=".55" fill="#20231f" stroke="none"/>',
};
await mkdir(path.join(root, "public/detail"), { recursive: true });
await mkdir(path.join(root, "mobile/assets/detail"), { recursive: true });
for (const [level, drawing] of Object.entries(drawings)) {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56"><rect width="56" height="56" fill="#FFEB8A"/><g fill="none" stroke="#20231f" stroke-width="' + (level === "detailed" ? "1.2" : "1.45") + '" stroke-linecap="round" stroke-linejoin="round">' + drawing + '</g></svg>\n';
  await writeFile(path.join(root, "public/detail", level + ".svg"), svg);
  await sharp(Buffer.from(svg)).resize(168, 168).png().toFile(path.join(root, "mobile/assets/detail", level + ".png"));
}
console.log("Exported three coordinated flower vectors and native PNGs.");
