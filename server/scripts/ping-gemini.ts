// npm run ping-gemini  -> should print valid JSON in under 3 s.
// If it fails: check the key, the model name and the rate limit, in that order.
import { z } from "zod";
import { callAgent } from "../src/gemini";

const t = Date.now();
callAgent({
  agent: "ping",
  tier: "fast",
  system: "Reply in JSON. Echo the input's 'say' field as 'reply'.",
  input: { say: "hello" },
  schema: z.object({ reply: z.string() }),
})
  .then((r) => { console.log(r.out, `source=${r.source}`, `${Date.now() - t} ms`); process.exit(0); })
  .catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
