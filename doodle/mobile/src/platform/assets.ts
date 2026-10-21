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
  ["cooking-friends", require("../../assets/cooking-friends.webp")],
  ["bookshop", require("../../assets/bookshop.webp")],
];

export const NATIVE_REFERENCE_IMAGE: NativeImageSource = require("../../assets/doodle-reference-kiss.png");


/** Offline presentation samples, used only by the isolated QA runtime. */
export const NATIVE_PAPER_FIXTURES = {
  yellow: require("../../assets/paper-fixtures/yellow.png"),
  pink: require("../../assets/paper-fixtures/pink.png"),
  peach: require("../../assets/paper-fixtures/peach.png"),
  mint: require("../../assets/paper-fixtures/mint.png"),
  blue: require("../../assets/paper-fixtures/blue.png"),
  lavender: require("../../assets/paper-fixtures/lavender.png"),
  white: require("../../assets/paper-fixtures/white.png"),
} as const;
