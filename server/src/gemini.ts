import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { CACHE_DIR, PROMPTS_DIR, env, geminiEnabled } from "./env";

const ai = env.geminiKey ? new GoogleGenAI({ apiKey: env.geminiKey }) : null;
const MODELS = { fast: env.modelFast, smart: env.modelSmart };

fs.mkdirSync(CACHE_DIR, { recursive: true });

export type AgentResult<T> = { out: T; source: "gemini" | "cache"; ms: number };

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: NodeJS.Timeout;
  return Promise.race([
    p.finally(() => clearTimeout(t)),
    new Promise<T>((_, rej) => { t = setTimeout(() => rej(new Error(`timeout after ${ms} ms`)), ms); }),
  ]);
}

/** Gemini accepts a subset of JSON Schema. Strip keys it may reject; zod still validates the result. */
function cleanSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(cleanSchema);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === "$schema" || k === "additionalProperties") continue;
      out[k] = cleanSchema(v);
    }
    return out;
  }
  return node;
}

const cachePath = (key: string) => path.join(CACHE_DIR, `${key.replace(/[^a-z0-9_-]/gi, "_")}.json`);

export function prompt(name: string): string {
  return fs.readFileSync(path.join(PROMPTS_DIR, name), "utf8");
}

/**
 * Every agent calls this. Forces JSON matching the zod schema, validates it, retries once,
 * times out (default 8 s) and falls back to the cached golden-path answer.
 */
export async function callAgent<T>(o: {
  agent: string;
  tier: "fast" | "smart";
  system: string;
  input: unknown;
  schema: z.ZodType<T>;
  cacheKey?: string;
  timeoutMs?: number;
}): Promise<AgentResult<T>> {
  const started = Date.now();
  if (ai && geminiEnabled()) {
    const jsonSchema = cleanSchema(z.toJSONSchema(o.schema));
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await withTimeout(
          ai.models.generateContent({
            model: MODELS[o.tier],
            contents: JSON.stringify(o.input),
            // No temperature/top_p/top_k: deprecated on current Gemini models.
            config: {
              systemInstruction: o.system,
              responseMimeType: "application/json",
              responseJsonSchema: jsonSchema,
            },
          }),
          o.timeoutMs ?? 8000,
        );
        const out = o.schema.parse(JSON.parse(res.text ?? ""));
        if (o.cacheKey) fs.writeFileSync(cachePath(o.cacheKey), JSON.stringify(out, null, 2));
        return { out, source: "gemini", ms: Date.now() - started };
      } catch (e) {
        console.warn(`[${o.agent}] attempt ${attempt} failed:`, (e as Error).message);
      }
    }
  }
  const f = o.cacheKey && cachePath(o.cacheKey);
  if (f && fs.existsSync(f)) {
    const out = o.schema.parse(JSON.parse(fs.readFileSync(f, "utf8")));
    console.warn(`[${o.agent}] served from cache: ${o.cacheKey}`);
    return { out, source: "cache", ms: Date.now() - started };
  }
  throw new Error(`${o.agent} failed and no cache${geminiEnabled() ? "" : " (GEMINI_API_KEY/model env vars not set)"}`);
}
