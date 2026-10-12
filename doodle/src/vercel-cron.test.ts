import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Vercel refund reconciliation cron", () => {
  it("uses the current vercel.json cron shape for a daily UTC invocation", () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8")) as {
      $schema?: string;
      crons?: Array<{ path?: string; schedule?: string }>;
    };

    expect(config.$schema).toBe("https://openapi.vercel.sh/vercel.json");
    expect(config.crons).toEqual([
      {
        path: "/api/internal/play/reconcile-voids",
        schedule: "0 3 * * *",
      },
    ]);
    const cron = config.crons?.[0];
    expect(cron?.path).toMatch(/^\//);
    expect(cron?.schedule).toMatch(/^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/);
  });
});
