// Frame definitions own the export's paper, border and content placement.
// Future designs can use the same renderer without changing message handling.
export const CLASSIC_CARD_FRAME = {
  paperColor: "#fcfcf8",
  inkColor: "#20231f",
  borderColor: "#d8ded4",
  borderWidth: 0,
  imageInset: 0,
  imageTop: 0,
  imageHeight: 1200,
  messageCenterY: 1350,
  messageMaxWidth: 1040,
};

export type CardFrame = typeof CLASSIC_CARD_FRAME;
