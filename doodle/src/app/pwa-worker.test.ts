import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

describe("PWA service worker", () => {
  it("does not intercept non-GET document navigations", () => {
    const listeners = new Map<string, (event: { request: object; respondWith: (response: Promise<Response>) => void }) => void>();
    const workerSource = fs.readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");
    vm.runInNewContext(workerSource, {
      self: {
        location: { origin: "https://doodle.samistudio.nl" },
        addEventListener: (type: string, listener: (event: never) => void) => listeners.set(type, listener as never),
      },
      caches: {},
      fetch: vi.fn().mockResolvedValue(new Response("online")),
      Request,
      Response,
      URL,
      Promise,
    });

    const respondWith = vi.fn();
    listeners.get("fetch")?.({
      request: {
        method: "POST",
        mode: "navigate",
        destination: "document",
        url: "https://doodle.samistudio.nl/checkout-return",
      },
      respondWith,
    });

    expect(respondWith).not.toHaveBeenCalled();
  });
});
