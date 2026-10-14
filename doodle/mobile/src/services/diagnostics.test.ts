import { describe, expect, it, vi } from "vitest";
import { NativeDiagnostics, type NativeDiagnosticsStorage } from "./diagnostics";

const metadata = { appVersion: "0.1.5", build: "7", androidApi: 36 };

function storage(initial = ""): NativeDiagnosticsStorage & { value: string; writes: number } {
  return {
    value: initial,
    writes: 0,
    async read() {
      return this.value;
    },
    async write(value: string) {
      this.writes += 1;
      this.value = value;
    },
    async clear() {
      this.value = "";
    },
  };
}

function uuidSequence() {
  let next = 1;
  return () => `00000000-0000-4000-8000-${String(next++).padStart(12, "0")}`;
}

function eventInput(index: number) {
  return {
    operation: "generation" as const,
    stage: "http_request" as const,
    code: "network" as const,
    requestId: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  };
}

describe("NativeDiagnostics", () => {
  it("persists a bounded failure queue and drops the oldest records", async () => {
    const store = storage();
    const diagnostics = new NativeDiagnostics({ storage: store, metadata, now: () => 1_700_000_000_000, uuid: uuidSequence() });

    await Promise.all(Array.from({ length: 21 }, (_, index) => diagnostics.record(eventInput(index + 1))));

    const events = await diagnostics.snapshot();
    expect(events).toHaveLength(20);
    expect(events[0]?.requestId).toContain("000000000002");
    expect(store.writes).toBe(21);
  });

  it("expires records older than seven days before export", async () => {
    let now = 1_700_000_000_000;
    const store = storage();
    const diagnostics = new NativeDiagnostics({ storage: store, metadata, now: () => now, uuid: uuidSequence() });

    await diagnostics.record(eventInput(1));
    now += 7 * 86_400_000 + 1;

    await expect(diagnostics.snapshot()).resolves.toEqual([]);
    expect(await diagnostics.exportPayload()).toContain('"events": []');
  });

  it("drops future-dated persisted records beyond the five-minute clock-skew window", async () => {
    const now = 1_700_000_000_000;
    const event = {
      v: 1,
      id: "00000000-0000-4000-8000-000000000001",
      timestamp: new Date(now + 6 * 60_000).toISOString(),
      appVersion: "0.1.5",
      build: "7",
      androidApi: 36,
      operation: "generation",
      stage: "http_request",
      code: "network",
    };
    const diagnostics = new NativeDiagnostics({
      storage: storage(JSON.stringify({ version: 1, events: [event] })),
      metadata,
      now: () => now,
      uuid: uuidSequence(),
    });

    await expect(diagnostics.snapshot()).resolves.toEqual([]);
  });

  it("serializes concurrent writes and keeps the queue valid", async () => {
    const store = storage();
    const write = store.write.bind(store);
    store.write = async (value) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      await write(value);
    };
    const diagnostics = new NativeDiagnostics({ storage: store, metadata, now: () => 1_700_000_000_000, uuid: uuidSequence() });

    await Promise.all([diagnostics.record(eventInput(1)), diagnostics.record(eventInput(2)), diagnostics.record(eventInput(3))]);

    expect(await diagnostics.snapshot()).toHaveLength(3);
    expect(() => JSON.parse(store.value)).not.toThrow();
  });

  it("uploads at most five events per batch and respects the cooldown", async () => {
    let now = 1_700_000_000_000;
    const store = storage();
    const upload = vi.fn().mockResolvedValue(true);
    const diagnostics = new NativeDiagnostics({ storage: store, metadata, now: () => now, uuid: uuidSequence(), upload, flushCooldownMs: 60_000 });
    await Promise.all(Array.from({ length: 7 }, (_, index) => diagnostics.record(eventInput(index + 1))));

    await expect(diagnostics.flush()).resolves.toBe(true);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0]?.[0]).toHaveLength(5);
    expect(await diagnostics.snapshot()).toHaveLength(2);

    await expect(diagnostics.flush()).resolves.toBe(false);
    expect(upload).toHaveBeenCalledTimes(1);

    now += 60_001;
    await expect(diagnostics.flush()).resolves.toBe(true);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(await diagnostics.snapshot()).toEqual([]);
  });

  it("keeps records and does not throw when upload fails", async () => {
    const store = storage();
    const upload = vi.fn().mockRejectedValue(new Error("connection refused"));
    const diagnostics = new NativeDiagnostics({ storage: store, metadata, now: () => 1_700_000_000_000, uuid: uuidSequence(), upload });
    await diagnostics.record(eventInput(1));

    await expect(diagnostics.flush()).resolves.toBe(false);
    expect(await diagnostics.snapshot()).toHaveLength(1);
  });

  it("swallows UUID failures because diagnostics are best effort", async () => {
    const diagnostics = new NativeDiagnostics({
      storage: storage(),
      metadata,
      uuid: () => { throw new Error("uuid unavailable"); },
    });

    await expect(diagnostics.record(eventInput(1))).resolves.toBeUndefined();
  });

  it("exports only the sanitized event contract", async () => {
    const store = storage();
    const diagnostics = new NativeDiagnostics({ storage: store, metadata, now: () => 1_700_000_000_000, uuid: uuidSequence() });
    await diagnostics.record({ ...eventInput(1), providerCode: "10" });

    const payload = await diagnostics.exportPayload();
    expect(payload).toContain('"providerCode": "10"');
    expect(payload).not.toContain("scene");
    expect(payload).not.toContain("token");
    expect(payload).not.toContain("message");
  });
});
