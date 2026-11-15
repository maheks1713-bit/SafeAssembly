import { env, geminiEnabled } from "./env";
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import { ZodError } from "zod";
import { runTick, tickState } from "./tick";
import { agentRoutes } from "./routes/agents";
import { draftRoutes } from "./routes/drafts";
import { injectRoutes } from "./routes/inject";
import { startWeatherPoller } from "./weather";

const app = express();
app.use(cors());
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    last_tick: tickState.lastTick,
    last_error: tickState.lastError,
    gemini: geminiEnabled() ? "live" : "cache-only",
    event_id: env.eventId,
  });
});

// Called by the app after every report insert, and by the injector.
app.post("/tick", async (_req, res) => {
  try {
    const r = await runTick();
    tickState.lastError = null;
    res.json(r);
  } catch (e) {
    tickState.lastError = (e as Error).message;
    throw e;
  }
});

app.use(agentRoutes);
app.use(draftRoutes);
app.use(injectRoutes);

const onError: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) return void res.status(400).json({ error: "Invalid request", issues: err.issues });
  console.error(`[${req.method} ${req.path}]`, err);
  res.status(err.status ?? 500).json({ error: err.message ?? "Server error" });
};
app.use(onError);

app.listen(env.port, () => {
  console.log(`SafeAssembly agent server on :${env.port} (Gemini: ${geminiEnabled() ? "live" : "cache-only"})`);
  startWeatherPoller();
});
