import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Metadata } from "next";
import { buildPageMetadata, SITE_URL, SUPPORTED_LOCALES } from "./i18n";
import { buildDoodleIdeasMetadata } from "./doodle-ideas";
import { buildEditorialMetadata } from "@/components/editorial-pages";
import { legalMetadata } from "@/components/legal-page";
import { ARTICLE_SLUGS } from "./editorial";
import nextConfig from "../../next.config";

vi.mock("botid/next/config", () => ({ withBotId: (config: unknown) => config }));

const imagePath = "/social/doodle-og-2026-10-14.png";
const imageUrl = `${SITE_URL}${imagePath}`;
const channels = ["x", "reddit", "pinterest", "instagram", "tiktok", "facebook", "linkedin", "threads", "bluesky"];

function expectApprovedPreview(metadata: Metadata) {
  expect(metadata.openGraph).toMatchObject({
    images: [{ url: imageUrl, width: 1200, height: 630, type: "image/png", alt: expect.stringContaining("bear") }],
  });
  expect(metadata.twitter).toMatchObject({
    card: "summary_large_image",
    images: [{ url: imageUrl, alt: expect.stringContaining("bear") }],
  });
}

describe("approved Doodle social preview", () => {
  it.each(SUPPORTED_LOCALES)("covers the home, ideas and editorial pages in %s", (locale) => {
    expectApprovedPreview(buildPageMetadata(locale));
    expectApprovedPreview(buildDoodleIdeasMetadata(locale));
    expectApprovedPreview(buildEditorialMetadata(locale, "blog"));
    expectApprovedPreview(buildEditorialMetadata(locale, "for-ai"));
    for (const slug of ARTICLE_SLUGS) expectApprovedPreview(buildEditorialMetadata(locale, "blog", slug));
  });

  it.each(["privacy", "terms", "refund", "contact", "delete-account"])("covers /%s without changing its canonical", (page) => {
    const metadata = legalMetadata(page, page, `Doodle ${page}`);
    expectApprovedPreview(metadata);
    expect(metadata.alternates?.canonical).toBe(`${SITE_URL}/${page}`);
  });

  it("serves the original owner-approved PNG at the declared dimensions", () => {
    const bytes = readFileSync(path.join(process.cwd(), "public", imagePath));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe("3564fddf3ed091e8a3a219606a2776e329ff3fc5b5bdd05d4b234e64f4e82e93");
    expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1200, 630]);
    expect(bytes.length).toBeLessThan(5_000_000);
  });

  it("provides channel shortcuts with fixed destinations and safe attribution", async () => {
    const redirects = await nextConfig.redirects?.();
    for (const channel of channels) {
      expect(redirects).toContainEqual({
        source: `/${channel}`,
        destination: `/?utm_source=${channel}&utm_medium=organic_social&utm_campaign=doodle_web_launch`,
        permanent: false,
      });
    }
    expect(buildPageMetadata("en").alternates?.canonical).toBe(`${SITE_URL}/`);
  });
});
