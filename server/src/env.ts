import "dotenv/config";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "..");
export const CACHE_DIR = path.join(ROOT, "cache");
export const PROMPTS_DIR = path.join(ROOT, "src", "prompts");

export const env = {
  geminiKey: process.env.GEMINI_API_KEY ?? "",
  modelFast: process.env.GEMINI_MODEL_FAST ?? "",
  modelSmart: process.env.GEMINI_MODEL_SMART ?? "",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  eventId: process.env.EVENT_ID || "00000000-0000-4000-8000-000000000001",
  port: Number(process.env.PORT || 3000),
  weatherPoll: (process.env.WEATHER_POLL ?? "on") !== "off",
};

export const geminiEnabled = () => Boolean(env.geminiKey && env.modelFast && env.modelSmart);
