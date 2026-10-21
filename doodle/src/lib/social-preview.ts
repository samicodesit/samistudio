// Versioned URL prevents new shares from reusing the previous cached drawing.
export const SOCIAL_PREVIEW_IMAGE_PATH = "/social/doodle-og-2026-10-14.png";

export function socialPreviewImage(siteUrl: string) {
  return {
    url: `${siteUrl}${SOCIAL_PREVIEW_IMAGE_PATH}`,
    width: 1200,
    height: 630,
    type: "image/png",
    alt: 'Doodle: Your idea. Doodled. Turn words or photos into doodles. A bear gives a heart to a happy bunny on a yellow note, illustrating “Sending you my love”.',
  };
}
