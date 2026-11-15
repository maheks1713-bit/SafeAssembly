import { callAgent, prompt } from "../gemini";
import { logAgent } from "../log";
import { RightsOut, slug } from "../schemas";

const DISCLAIMER = { en: "General information, not legal advice.", fr: "Information générale, pas un avis juridique." };

/** Gemini grounded ONLY in the curated rights text. Disclaimer always enforced in code. */
export async function rightsAgent(question: string, lang: "en" | "fr") {
  const r = await callAgent({
    agent: "rights",
    tier: "smart",
    system: prompt("rights.txt"),
    input: { LANG: lang, QUESTION: question, RIGHTS_TEXT: prompt("rights_text.md") },
    schema: RightsOut,
    cacheKey: `rights_${lang}_${slug(question)}`,
    timeoutMs: 12000,
  });
  const out = { ...r.out, disclaimer: DISCLAIMER[lang], ms: r.ms, source: r.source };
  await logAgent("Rights", "answer",
    `Answered "${question}" (${lang.toUpperCase()})${out.cited_sections.length ? `, citing ${out.cited_sections.join(", ")}` : ""}.${out.covered ? "" : " Not covered: pointed to legal aid."}`,
    { cited_sections: out.cited_sections, confidence: out.confidence, covered: out.covered, source: r.source });
  return out;
}
