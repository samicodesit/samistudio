import { createServerSupabase } from "./server";

export type SessionUser = { id: string; email: string | null };

export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") throw error;
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
}
