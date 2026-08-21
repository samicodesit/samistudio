import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/202608210001_doodle_credits.sql", "utf8");

describe("paid credit hold migration", () => {
  it("keeps reservations in expiring holds and charges only during atomic finalization", () => {
    expect(sql).toMatch(/create table public\.credit_holds[\s\S]*expires_at timestamptz[\s\S]*finalized_at timestamptz/);
    expect(sql).toMatch(/reserve_paid_credit[\s\S]*expires_at > now\(\)[\s\S]*count\(\*\)[\s\S]*insert into public\.credit_holds/);
    expect(sql).toMatch(/finalize_paid_credit[\s\S]*for update[\s\S]*balance = balance - 1[\s\S]*finalized_at = now\(\)/);
    expect(sql).toMatch(/release_paid_credit[\s\S]*delete from public\.credit_holds[\s\S]*finalized_at is null/);
    expect(sql).toMatch(/alter table public\.credit_holds enable row level security/);
    expect(sql).toMatch(/grant execute on function public\.finalize_paid_credit\(uuid, text\) to service_role/);
  });

  it("serializes concurrent holds and makes finalization idempotent", () => {
    const reserve = sql.slice(sql.indexOf("function public.reserve_paid_credit"), sql.indexOf("function public.finalize_paid_credit"));
    const finalize = sql.slice(sql.indexOf("function public.finalize_paid_credit"), sql.indexOf("function public.release_paid_credit"));

    expect(reserve).toMatch(/credit_balances[\s\S]*for update[\s\S]*active_holds[\s\S]*current_balance <= active_holds/);
    expect(reserve).not.toMatch(/balance = balance - 1/);
    expect(finalize.indexOf("hold_finalized is not null")).toBeLessThan(finalize.indexOf("hold_expires <= now()"));
    expect(finalize.match(/balance = balance - 1/g)).toHaveLength(1);
  });
});
