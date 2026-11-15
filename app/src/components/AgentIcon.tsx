import { View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C } from "@/lib/theme";
import type { AgentName } from "@/lib/types";

// The six agents: one icon each, same teal tile. "Human" marks organizer decisions in the feed.
const ICON: Record<AgentName, { set: "feather" | "mci"; name: string }> = {
  Planner: { set: "feather", name: "clipboard" },
  Rights: { set: "mci", name: "scale-balance" },
  Monitor: { set: "feather", name: "activity" },
  Dispatcher: { set: "feather", name: "send" },
  Comms: { set: "feather", name: "message-square" },
  Report: { set: "feather", name: "file-text" },
  Human: { set: "feather", name: "user-check" },
};

export const AGENT_BLURB: Record<string, string> = {
  Planner: "Permits, checklists", Rights: "Charter Q&A", Monitor: "Detects risks",
  Dispatcher: "Moves people", Comms: "Fights misinfo", Report: "After-action",
};

export function AgentGlyph({ agent, size = 18, color = C.teal }: { agent: AgentName; size?: number; color?: string }) {
  const i = ICON[agent] ?? ICON.Monitor;
  return i.set === "mci"
    ? <MaterialCommunityIcons name={i.name as any} size={size} color={color} />
    : <Feather name={i.name as any} size={size} color={color} />;
}

export function AgentIcon({ agent, size = 40, solid }: { agent: AgentName; size?: number; solid?: boolean }) {
  const human = agent === "Human";
  return (
    <View
      accessibilityLabel={`${agent} agent`}
      style={{
        width: size, height: size, borderRadius: size * 0.28, alignItems: "center", justifyContent: "center",
        backgroundColor: solid ? C.teal : human ? C.okBg : C.tint,
      }}>
      <AgentGlyph agent={agent} size={size * 0.48} color={solid ? C.white : human ? C.ok : C.teal} />
    </View>
  );
}
