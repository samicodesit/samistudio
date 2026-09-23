import type { NativeImageSource } from "../ui/types";

export const NATIVE_IDEA_ASSETS: readonly [string, NativeImageSource][] = [
  ["thank-you-mug", require("../../assets/thank-you-mug.webp")],
  ["cat-note", require("../../assets/cat-note.webp")],
  ["birthday-dog", require("../../assets/birthday-dog.webp")],
  ["warm-hug", require("../../assets/warm-hug.webp")],
  ["super-banana", require("../../assets/super-banana.webp")],
  ["lunch-high-five", require("../../assets/lunch-high-five.webp")],
  ["pencil-helps-eraser", require("../../assets/pencil-helps-eraser.webp")],
  ["school-snail", require("../../assets/school-snail.webp")],
];

export const NATIVE_REFERENCE_IMAGE: NativeImageSource = require("../../assets/doodle-reference-kiss.png");
