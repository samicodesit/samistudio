import { describe,it,expect } from "vitest";
import { storedDetailLevel } from "./detail-level";
describe("detail defaults",()=>{
 it("starts a new preference at Medium",()=>{expect(storedDetailLevel(null)).toBe("medium");expect(storedDetailLevel("invalid")).toBe("medium");});
 it.each(["simple","medium","detailed"] as const)("preserves saved %s",level=>expect(storedDetailLevel(level)).toBe(level));
});
