import { callAgent, prompt } from "../gemini";
import { EmailOut } from "../schemas";

export type EmailRequest = {
  to: { title: string; office: string; salutation: string };
  event: { name: string; place: string; time: string };
  about: string; ask: string; angle: string; tone: string; avoid: string[];
};

/**
 * Participant "How you can help" tab: one fresh email draft per tap.
 * No cacheKey on purpose: a cached answer would hand everyone the same email.
 * Not logged to agent_log: this is the attendee's own message, not an event action.
 * If Gemini fails, this throws and the app writes a draft on the phone instead.
 */
export async function advocacyAgent(req: EmailRequest) {
  const r = await callAgent({
    agent: "advocacy",
    tier: "fast",
    system: prompt("advocacy.txt"),
    input: { TO: req.to, EVENT: req.event, ABOUT: req.about, ASK: req.ask, ANGLE: req.angle, TONE: req.tone, AVOID: req.avoid },
    schema: EmailOut,
    timeoutMs: 9000,
  });
  return { subject: r.out.subject.trim(), body: r.out.body.trim(), source: r.source, ms: r.ms };
}
