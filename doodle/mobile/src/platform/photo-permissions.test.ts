import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import config from "../../app.config";

it("keeps photo selection free of broad storage access after native regeneration", () => {
  expect(config.android?.blockedPermissions).toContain("android.permission.READ_EXTERNAL_STORAGE");
  expect(config.android?.blockedPermissions).toContain("android.permission.READ_MEDIA_IMAGES");
  const manifest = readFileSync(new URL("../../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8");
  expect(manifest).toMatch(/<uses-permission\b[^>]*android:name="android\.permission\.READ_EXTERNAL_STORAGE"[^>]*tools:node="remove"/);
  // Existing write-only saving on older Android remains available.
  expect(config.android?.blockedPermissions).not.toContain("android.permission.WRITE_EXTERNAL_STORAGE");
});

it("does not require camera hardware on large-screen devices", () => {
  const manifest = readFileSync(new URL("../../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8");
  expect(manifest).toMatch(/<uses-feature\b[^>]*android:name="android\.hardware\.camera"[^>]*android:required="false"/);
});
