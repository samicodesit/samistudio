import { expect, it, vi } from "vitest";
import { readNativeJson } from "./native-contracts";

it("stops an undeclared oversized upload before consuming the rest of its stream", async () => {
  const cancel = vi.fn();
  let reads = 0;
  const stream = new ReadableStream({ pull(controller) { reads += 1; if (reads === 5) controller.close(); else controller.enqueue(new Uint8Array(64)); }, cancel });
  const request = new Request("http://localhost", { method: "POST", body: stream, duplex: "half" } as RequestInit);
  await expect(readNativeJson(request, 100)).rejects.toMatchObject({ code: "body_too_large" });
  expect(cancel).toHaveBeenCalledOnce();
  expect(reads).toBeLessThan(5);
});
