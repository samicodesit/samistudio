import { describe, expect, it, vi } from "vitest";

const initBotId = vi.hoisted(() => vi.fn());

vi.mock("botid/client/core", () => ({ initBotId }));

describe("BotID client instrumentation", () => {
  it("attaches verification headers to every server-verified route", async () => {
    await import("./instrumentation-client");

    expect(initBotId).toHaveBeenCalledWith({
      protect: [
        { path: "/api/generate", method: "POST" },
        { path: "/api/checkout", method: "POST" },
      ],
    });
  });
});
