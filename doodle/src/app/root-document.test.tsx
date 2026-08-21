import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Bricolage_Grotesque: () => ({ variable: "display-font" }),
  IBM_Plex_Sans: () => ({ variable: "body-font" }),
  Alexandria: () => ({ variable: "arabic-font" }),
}));

import { RootDocument } from "./root-document";

describe("RootDocument", () => {
  it("renders Arabic with RTL direction and its Arabic font", () => {
    const html = renderToStaticMarkup(<RootDocument locale="ar"><main>مرحبا</main></RootDocument>);

    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain('class="display-font body-font arabic-font"');
  });
});
