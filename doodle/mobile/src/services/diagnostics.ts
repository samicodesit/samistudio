import {
  DIAGNOSTIC_OPERATIONS,
  DIAGNOSTIC_STAGES,
  DIAGNOSTIC_UUID,
  diagnosticCode,
  diagnosticProviderCode,
  isDiagnosticEvent,
  type DiagnosticEvent,
  type DiagnosticOperation,
  type DiagnosticStage,
} from "../../../src/lib/diagnostics/events";

const MAX_EVENTS = 20;
const MAX_BATCH_SIZE = 5;
const MAX_STORAGE_BYTES = 32 * 1024;
const MAX_UPLOAD_BYTES = 4 * 1024;
const MAX_EVENT_AGE_MS = 7 * 86_400_000;
const MAX_DURATION_MS = 190_000;
const DEFAULT_FLUSH_COOLDOWN_MS = 60_000;
const MAX_FUTURE_SKEW_MS = 5 * 60_000;

export interface NativeDiagnosticsStorage {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  clear(): Promise<void>;
}

export interface NativeDiagnosticsMetadata {
  appVersion: string;
  build: string;
  androidApi: number;
}

export interface NativeDiagnosticInput {
  operation: DiagnosticOperation;
  stage: DiagnosticStage;
  code: unknown;
  status?: unknown;
  requestId?: unknown;
  durationMs?: unknown;
  providerCode?: unknown;
}

export interface NativeDiagnosticsSink {
  record(input: NativeDiagnosticInput): Promise<void> | void;
  flush(): Promise<boolean> | boolean | void;
}

export interface NativeDiagnosticsUploadResult {
  ok: boolean;
  retryAfterMs?: number;
}

export interface NativeDiagnosticsOptions {
  storage: NativeDiagnosticsStorage;
  metadata: NativeDiagnosticsMetadata;
  uuid: () => string;
  now?: () => number;
  upload?: (events: readonly DiagnosticEvent[]) => Promise<boolean | NativeDiagnosticsUploadResult>;
  flushCooldownMs?: number;
}

export class NativeDiagnostics {
  private readonly now: () => number;
  private readonly uuid: () => string;
  private readonly upload?: NativeDiagnosticsOptions["upload"];
  private readonly flushCooldownMs: number;
  private events: DiagnosticEvent[] = [];
  private loaded = false;
  private queue = Promise.resolve();
  private flushInFlight: Promise<boolean> | undefined;
  private lastFlushAttempt = Number.NEGATIVE_INFINITY;

  constructor(private readonly options: NativeDiagnosticsOptions) {
    this.now = options.now ?? Date.now;
    this.uuid = options.uuid;
    this.upload = options.upload;
    this.flushCooldownMs = Number.isSafeInteger(options.flushCooldownMs) && (options.flushCooldownMs ?? 0) >= 0
      ? options.flushCooldownMs as number
      : DEFAULT_FLUSH_COOLDOWN_MS;
  }

  async record(input: NativeDiagnosticInput): Promise<void> {
    let event: DiagnosticEvent | undefined;
    try {
      event = this.createEvent(input);
    } catch {
      return;
    }
    if (!event) return;
    try {
      await this.serial(async () => {
        await this.load();
        await this.commit(this.prune([...this.events, event]));
      });
    } catch {
      // Diagnostics are best effort and must never replace the user flow.
    }
  }

  async snapshot(): Promise<readonly DiagnosticEvent[]> {
    return this.serial(async () => {
      await this.load();
      const pruned = boundEvents(this.prune(this.events));
      if (pruned.length !== this.events.length) await this.commit(pruned);
      return [...this.events];
    });
  }

  async clear(): Promise<void> {
    await this.serial(async () => {
      await this.load();
      this.events = [];
      try {
        await this.options.storage.clear();
      } catch {
        // Diagnostics must never affect the user flow.
      }
    });
  }

  async exportPayload(): Promise<string> {
    const events = await this.snapshot();
    return JSON.stringify({
      format: "doodle-diagnostics-v1",
      generatedAt: new Date(this.now()).toISOString(),
      events,
    }, null, 2);
  }

  async flush(): Promise<boolean> {
    if (this.flushInFlight) return this.flushInFlight;
    const task = this.flushInternal();
    this.flushInFlight = task.finally(() => {
      this.flushInFlight = undefined;
    });
    return this.flushInFlight;
  }

  private async flushInternal(): Promise<boolean> {
    if (!this.upload) return false;
    const now = this.now();
    if (now - this.lastFlushAttempt < this.flushCooldownMs) return false;
    this.lastFlushAttempt = now;
    const events = await this.snapshot();
    if (events.length === 0) return false;
    const batch = selectUploadBatch(events);
    if (batch.length === 0) return false;
    let result: boolean | NativeDiagnosticsUploadResult = false;
    try {
      result = await this.upload(batch);
    } catch {
      return false;
    }
    const uploaded = typeof result === "boolean" ? result : result.ok;
    if (!uploaded && typeof result !== "boolean" && Number.isSafeInteger(result.retryAfterMs) && (result.retryAfterMs ?? 0) >= 0) {
      this.lastFlushAttempt = now + Math.min(result.retryAfterMs ?? 0, 86_400_000);
    }
    if (!uploaded) return false;
    const uploadedIds = new Set(batch.map((event) => event.id));
    await this.serial(async () => {
      await this.load();
      await this.commit(this.events.filter((event) => !uploadedIds.has(event.id)));
    });
    return true;
  }

  private createEvent(input: NativeDiagnosticInput): DiagnosticEvent | undefined {
    const id = this.uuid();
    if (!DIAGNOSTIC_UUID.test(id)) return undefined;
    const appVersion = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(this.options.metadata.appVersion)
      ? this.options.metadata.appVersion
      : "0.0.0";
    const build = /^\d{1,10}$/.test(this.options.metadata.build) ? this.options.metadata.build : "0";
    const androidApi = Number.isSafeInteger(this.options.metadata.androidApi) && this.options.metadata.androidApi >= 1 && this.options.metadata.androidApi <= 1000
      ? this.options.metadata.androidApi
      : 1;
    const event: DiagnosticEvent = {
      v: 1,
      id,
      timestamp: new Date(this.now()).toISOString(),
      appVersion,
      build,
      androidApi,
      operation: normalizeOperation(input.operation),
      stage: normalizeStage(input.stage),
      code: diagnosticCode(input.code),
    };
    const status = integerInRange(input.status, 100, 599);
    if (status !== undefined) event.status = status;
    const requestId = typeof input.requestId === "string" && DIAGNOSTIC_UUID.test(input.requestId) ? input.requestId : undefined;
    if (requestId) event.requestId = requestId;
    const durationMs = integerInRange(input.durationMs, 0, MAX_DURATION_MS);
    if (durationMs !== undefined) event.durationMs = durationMs;
    const providerCode = diagnosticProviderCode(input.providerCode);
    if (providerCode) event.providerCode = providerCode;
    return isDiagnosticEvent(event) ? event : undefined;
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await this.options.storage.read();
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
      const events = (parsed as { events?: unknown }).events;
      if (!Array.isArray(events)) return;
      this.events = boundEvents(this.prune(events.filter(isDiagnosticEvent).slice(-MAX_EVENTS)));
    } catch {
      this.events = [];
    }
  }

  private prune(events: readonly DiagnosticEvent[]): DiagnosticEvent[] {
    const now = this.now();
    const cutoff = now - MAX_EVENT_AGE_MS;
    const futureCutoff = now + MAX_FUTURE_SKEW_MS;
    return events
      .filter((event) => {
        if (!isDiagnosticEvent(event)) return false;
        const timestamp = Date.parse(event.timestamp);
        return Number.isFinite(timestamp) && timestamp >= cutoff && timestamp <= futureCutoff;
      })
      .slice(-MAX_EVENTS);
  }

  private async commit(events: DiagnosticEvent[]): Promise<void> {
    this.events = boundEvents(events);
    try {
      await this.options.storage.write(JSON.stringify({ version: 1, events: this.events }));
    } catch {
      // The in-memory queue remains useful during this process even if the file is unavailable.
    }
  }

  private async serial<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task, task);
    this.queue = result.then(() => undefined, () => undefined);
    return result;
  }
}

function selectUploadBatch(events: readonly DiagnosticEvent[]): DiagnosticEvent[] {
  const batch: DiagnosticEvent[] = [];
  for (const event of events) {
    if (batch.length >= MAX_BATCH_SIZE) break;
    const candidate = [...batch, event];
    if (serializedSize({ events: candidate }) > MAX_UPLOAD_BYTES) break;
    batch.push(event);
  }
  return batch;
}

function boundEvents(events: readonly DiagnosticEvent[]): DiagnosticEvent[] {
  const bounded = events.filter(isDiagnosticEvent).slice(-MAX_EVENTS);
  while (bounded.length > 0 && serializedSize({ version: 1, events: bounded }) > MAX_STORAGE_BYTES) bounded.shift();
  return bounded;
}

function serializedSize(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function normalizeOperation(value: DiagnosticOperation): DiagnosticOperation {
  return DIAGNOSTIC_OPERATIONS.includes(value) ? value : "startup";
}

function normalizeStage(value: DiagnosticStage): DiagnosticStage {
  return DIAGNOSTIC_STAGES.includes(value) ? value : "unknown";
}

function integerInRange(value: unknown, min: number, max: number): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max ? value : undefined;
}
