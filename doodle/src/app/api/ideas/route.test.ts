import { expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { GET } from "./route";
import { SUPPORTED_LOCALES } from "@/lib/i18n";

it.each(SUPPORTED_LOCALES)("serves the localized Simple gallery anonymously for %s", async locale => {
  const response = await GET(new Request(`https://doodle.samistudio.nl/api/ideas?locale=${locale}`));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("public");
  expect(response.headers.has("set-cookie")).toBe(false);
  const body = await response.json();
  expect(body.locale).toBe(locale);
  expect(body.version).toBe(1);
  expect(body.items.length).toBeGreaterThan(10);
  for (const item of body.items) {
    expect([...item.prompt].length).toBeLessThanOrEqual(180);
    expect(item.prompt.length).toBeGreaterThan(0);
    expect(existsSync(join(process.cwd(), "public", item.image))).toBe(true);
    expect(existsSync(join(process.cwd(), "public", item.thumbnail))).toBe(true);
  }
});

it("rejects unsupported locale values instead of mixing localized cache entries", async () => {
  expect((await GET(new Request("https://doodle.samistudio.nl/api/ideas?locale=unknown"))).status).toBe(400);
});
