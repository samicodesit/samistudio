import { afterEach, describe, expect, it, vi } from "vitest";
import { getBrowserSupabase } from "./browser";

const createBrowserClient = vi.hoisted(() => vi.fn());

vi.mock("@supabase/ssr", () => ({ createBrowserClient }));

describe("browser Supabase client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    createBrowserClient.mockReset();
  });

  it("creates a client from the public Supabase environment", () => {
    const client = {};
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    createBrowserClient.mockReturnValue(client);

    expect(getBrowserSupabase()).toBe(client);
    expect(createBrowserClient).toHaveBeenCalledWith("https://project.supabase.co", "publishable-key");
  });

  it("rejects a missing public Supabase URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");

    expect(getBrowserSupabase).toThrow("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL");
  });
});
