import { createBrowserClient } from "@supabase/ssr";
import { required } from "./env";

export function getBrowserSupabase() {
  return createBrowserClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  );
}
