import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, USE_MOCKS } from "./config";

// Anon key only: protected by RLS (read all, insert reports, acknowledge assignments).
export const sb: SupabaseClient | null = USE_MOCKS
  ? null
  : createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { storage: AsyncStorage, persistSession: false, autoRefreshToken: false },
    });
