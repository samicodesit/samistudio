import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const png = fs.readFileSync(path.join(process.cwd(), "public/references/doodle-reference-kiss.png"));
for (const width of [320, 1440]) {
  test(`reporting consent and layout at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/account", route => route.fulfill({ json: { authenticated: false, balance: 0, freeRemaining: 2 } }));
    await page.route("**/api/generate", route => route.fulfill({ contentType: "image/png", body: png }));
    const submissions: Record<string, unknown>[] = [];
    await page.route("**/api/reports", async route => {
      submissions.push(route.request().postDataJSON());
      await route.fulfill({ status: 201, json: { id: "11111111-1111-4111-8111-111111111111" } });
    });
    await page.goto("/");
    await page.getByLabel("Describe a scene", { exact: true }).fill("A happy dog");
    await page.getByRole("button", { name: "Create doodle", exact: true }).click();
    const trigger = page.getByRole("button", { name: "Report this doodle", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Report this doodle", exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("checkbox")).not.toBeChecked();
    expect(submissions).toHaveLength(0);
    await dialog.getByRole("combobox").selectOption("violence");
    await page.screenshot({ path: testInfo.outputPath(`report-${width}.png`) });
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await dialog.getByRole("button", { name: "Submit report", exact: true }).click();
    await expect(dialog.getByRole("status")).toContainText("Report received");
    expect(submissions[0]).toMatchObject({ reason: "violence", includeContent: false });
    expect(submissions[0]).not.toHaveProperty("imageBase64");
    expect(submissions[0]).not.toHaveProperty("scene");
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await trigger.click();
    await dialog.getByRole("combobox").selectOption("violence");
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Submit report", exact: true }).click();
    await expect(dialog.getByRole("status")).toContainText("Report received");
    expect(submissions[1]).toMatchObject({ includeContent: true, scene: "A happy dog" });
    expect(Buffer.from(submissions[1].imageBase64 as string, "base64").byteLength).toBeLessThanOrEqual(60000);
  });
}