// Import this FIRST in every test file that touches server modules.
// It runs before dotenv, so the real server/.env (Gemini key, Supabase service key) is never used:
// dotenv does not override variables that are already set, even to "".
process.env.GEMINI_API_KEY = "";
process.env.GEMINI_MODEL_FAST = "";
process.env.GEMINI_MODEL_SMART = "";
process.env.SUPABASE_URL = "http://supabase.test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.EVENT_ID = "ev-test";
process.env.PORT = "0";
process.env.WEATHER_POLL = "off";

export const EVENT_ID = "ev-test";
