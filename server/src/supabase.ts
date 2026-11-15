import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

if (!env.supabaseUrl || !env.supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server/.env");
  process.exit(1);
}

// Service-role client: bypasses RLS. Server-only, never ship this key to the app.
export const sb = createClient(env.supabaseUrl, env.supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Throw on Supabase errors so routes fail loudly instead of silently writing nothing.
 * Typed non-null for selects; for plain inserts/updates (data is null) just ignore the return value,
 * and use .maybeSingle() + optional chaining where a row may legitimately be missing.
 */
export function must<T>(r: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data as NonNullable<T>;
}
