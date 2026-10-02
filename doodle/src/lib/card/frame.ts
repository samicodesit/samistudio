// Frame definitions own the export's paper, border and content placement.
// Future designs can use the same renderer without changing message handling.
export const CLASSIC_CARD_FRAME = {
  paperColor: "#fcfcf8",
  inkColor: "#20231f",
  borderColor: "#d8ded4",
  borderInset: 32,
  borderWidth: 2,
  imageInset: 72,
  imageTop: 72,
  imageHeight: 1056,
  messageCenterY: 1296,
  messageMaxWidth: 960,
};

export type CardFrame = typeof CLASSIC_CARD_FRAME;
