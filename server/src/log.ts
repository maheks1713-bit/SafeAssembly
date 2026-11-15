import { sb } from "./supabase";
import { env } from "./env";

export type AgentName = "Planner" | "Rights" | "Monitor" | "Dispatcher" | "Comms" | "Report" | "Human";

/** One agent_log row = one line in the app's Agent Activity feed. */
export async function logAgent(
  agent: AgentName,
  action: string,
  summary: string,
  output: unknown = null,
  inputRef: string | null = null,
) {
  const { error } = await sb.from("agent_log").insert({
    event_id: env.eventId,
    agent,
    action,
    summary,
    input_ref: inputRef,
    output_json: output,
  });
  if (error) console.error("agent_log insert failed:", error.message);
}
