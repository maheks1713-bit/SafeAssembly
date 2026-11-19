import { env, geminiEnabled } from "./env";
import { app } from "./app";
import { startWeatherPoller } from "./weather";

app.listen(env.port, () => {
  console.log(`SafeAssembly agent server on :${env.port} (Gemini: ${geminiEnabled() ? "live" : "cache-only"})`);
  startWeatherPoller();
});
