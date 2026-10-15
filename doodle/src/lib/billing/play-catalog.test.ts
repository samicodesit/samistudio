import { describe, expect, it, vi } from "vitest";
import { getPlayCatalog, isPlayProductId, launchSchedule } from "./play-catalog";
vi.mock("server-only", () => ({}));
describe("Android pack catalog", () => {
 it("keeps pack IDs and the launch quantities", () => {
  expect(getPlayCatalog(new Date("2026-10-10T12:00:00Z")).packs.map(p => [p.productId,p.credits])).toEqual([["pack_mini",6],["pack_regular",25],["pack_big",60]]);
  expect(isPlayProductId("doodle_credits_10")).toBe(true);
  expect(isPlayProductId("unknown")).toBe(false);
 });
 it("ends the bonus after the inclusive deadline without changing other packs", () => {
  expect(getPlayCatalog(new Date("2026-10-31T22:59:59Z")).packs[1].credits).toBe(25);
  const catalog=getPlayCatalog(new Date("2026-10-31T23:00:00Z"));
  expect(catalog.packs[1]).toMatchObject({credits:20,offerApplied:false});
 });
 it("shifts all dates once from the baseline and rejects invalid delays", () => {
  expect(launchSchedule(3)).toEqual({launchDate:"2026-10-15",reportDate:"2026-10-26",offerEnd:"2026-11-03T23:59:59+01:00"});
  expect(() => launchSchedule(-1)).toThrow();
 });
});
