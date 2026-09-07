import type { Viewport } from "next";

// Keep zoom available while allowing the mobile layout to respond to the keyboard
// and reserving space for display cutouts through CSS safe-area insets.
export const doodleViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#195c47",
  colorScheme: "light",
};
