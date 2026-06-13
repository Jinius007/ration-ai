/**
 * Verifies ration-ai has LP client tools attached (required for real computation).
 * Usage: node scripts/verify-agent-lp.mjs
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../server/.env");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const API_KEY = env.ELEVENLABS_API_KEY;
const AGENT_ID = env.ELEVENLABS_AGENT_ID;
if (!API_KEY || !AGENT_ID) {
  console.error("Missing ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID in server/.env");
  process.exit(1);
}

const REQUIRED = ["compute_balanced_ration", "list_regional_feeds", "get_nutrient_requirements"];

const r = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
  headers: { "xi-api-key": API_KEY },
});
const agent = await r.json();
if (!r.ok) {
  console.error("Failed to fetch agent:", agent);
  process.exit(1);
}

const toolIds = agent.conversation_config?.agent?.prompt?.tool_ids ?? [];
const prompt = agent.conversation_config?.agent?.prompt?.prompt ?? "";

console.log("Agent:", agent.name, AGENT_ID);
console.log("tool_ids count:", toolIds.length);

if (toolIds.length === 0) {
  console.error("\n❌ NO TOOLS ATTACHED — agent will guess rations from LLM/knowledge base only.");
  console.error("   Run: node scripts/configure-ration-ai-agent.mjs");
  process.exit(1);
}

const toolsR = await fetch("https://api.elevenlabs.io/v1/convai/tools", {
  headers: { "xi-api-key": API_KEY },
});
const { tools } = await toolsR.json();
const attached = tools.filter((t) => toolIds.includes(t.id));
const names = attached.map((t) => t.tool_config?.name).filter(Boolean);

console.log("Attached tools:", names.join(", ") || "(could not resolve names)");

const missing = REQUIRED.filter((n) => !names.includes(n));
if (missing.length) {
  console.error("\n❌ Missing tools:", missing.join(", "));
  console.error("   Run: node scripts/configure-ration-ai-agent.mjs");
  process.exit(1);
}

if (!prompt.includes("compute_balanced_ration")) {
  console.warn("\n⚠ Prompt may not instruct agent to call compute_balanced_ration.");
  console.warn("   Run: node scripts/configure-ration-ai-agent.mjs");
} else {
  console.log("\n✅ Prompt includes LP tool instructions.");
}

console.log("\n✅ Agent is configured for real LP computation via client tools.");
console.log("   In a call, when agent calls compute_balanced_ration, UI shows:");
console.log('   "✅ LP ration computed — see form below"');
