// Only public values live in the app. The Gemini key and Supabase service-role key stay on the server.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");
export const EVENT_ID = process.env.EXPO_PUBLIC_EVENT_ID || "00000000-0000-4000-8000-000000000001";

/** Mock mode: the whole app runs on built-in golden-path data, no backend needed. */
export const USE_MOCKS =
  process.env.EXPO_PUBLIC_USE_MOCKS === "true" || !SUPABASE_URL || !SUPABASE_ANON_KEY;
