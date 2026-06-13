/**
 * Attaches LP client tools to ration-ai on ElevenLabs and merges mandatory LP instructions
 * into the existing agent prompt (preserves your voice/TTS/knowledge-base settings).
 *
 * Usage:
 *   1. Set ELEVENLABS_API_KEY + ELEVENLABS_AGENT_ID in server/.env
 *   2. node scripts/configure-ration-ai-agent.mjs
 *   3. node scripts/verify-agent-lp.mjs
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

const BASE = "https://api.elevenlabs.io/v1";
const headers = { "xi-api-key": API_KEY, "Content-Type": "application/json" };

async function api(method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${text}`);
  return data;
}

const LP_MANDATE = `
## MANDATORY: Real linear programming ration (client tools)
Knowledge base files are reference only. You MUST NOT invent kg amounts from memory.

You have three **client tools** (run in the farmer's browser with the real LP engine):

1. **list_regional_feeds** — after district + state are known. Shows feeds from the 270+ item library for that season/region.

2. **get_nutrient_requirements** — after animal profile (species, weight, milk, pregnancy). Returns INAPH minimum TDN/CP/Ca/P.

3. **compute_balanced_ration** — ONLY when you have ALL of:
   - district, state
   - species (cattle/buffalo), weight_kg, calvings
   - in_milk, milk_yield_litres, milk_fat_percent if milking; pregnant, pregnancy_month
   - feeds_json: JSON array with at least 2 feeds, e.g. [{"name":"wheat straw","qty_kg":5,"price_rs":4},{"name":"mustard cake","qty_kg":1.5}]
   This runs **least-cost linear programming** with constraints: minimum nutrition, DM range, concentrate cap, forage + mineral mixture, ±25% on farmer qty.

**Rules:**
- Call compute_balanced_ration before giving final kg advice. Read aloud ONLY what the tool returns (starts with "✅ Computed by linear programming" or Hindi equivalent).
- If tool errors, ask for missing fields — never guess ration numbers.
- Acknowledge each answer warmly, one or two questions at a time.
`.trim();

function jsonSchemaProps(entries) {
  const properties = {};
  const required = [];
  for (const e of entries) {
    properties[e.id] = { type: e.type, description: e.description };
    if (e.required) required.push(e.id);
  }
  return { type: "object", properties, required };
}

const TOOL_DEFS = [
  {
    name: "compute_balanced_ration",
    description:
      "MANDATORY for final ration. Runs least-cost LP on 270+ feed library with INAPH minimum nutrition. Returns kg/day per feed and daily cost. Call only when district, state, full animal profile, and feeds_json (2+ feeds) are collected.",
    expects_response: true,
    response_timeout_secs: 45,
    parameters: jsonSchemaProps([
      { id: "farmer_name", type: "string", description: "Farmer name", required: false },
      { id: "lang", type: "string", description: "Language code hi/en/gu/etc", required: false },
      { id: "district", type: "string", description: "District", required: true },
      { id: "state", type: "string", description: "State", required: true },
      { id: "species", type: "string", description: "cattle or buffalo", required: true },
      { id: "breed", type: "string", description: "Breed", required: false },
      { id: "weight_kg", type: "number", description: "Body weight kg", required: true },
      { id: "calvings", type: "number", description: "Number of calvings", required: true },
      { id: "in_milk", type: "boolean", description: "Currently giving milk", required: true },
      { id: "months_after_calving", type: "number", description: "Months since calving", required: false },
      { id: "milk_yield_litres", type: "number", description: "Daily milk litres", required: false },
      { id: "milk_fat_percent", type: "number", description: "Milk fat percent", required: false },
      { id: "pregnant", type: "boolean", description: "Is pregnant", required: true },
      { id: "pregnancy_month", type: "number", description: "Pregnancy month if pregnant", required: false },
      {
        id: "feeds_json",
        type: "string",
        description:
          'JSON array e.g. [{"name":"wheat straw","qty_kg":5,"price_rs":4},{"name":"mustard cake","qty_kg":1.5}]',
        required: true,
      },
    ]),
  },
  {
    name: "list_regional_feeds",
    description: "List seasonal feeds from the feed library for district/state. Call after location known.",
    expects_response: true,
    parameters: jsonSchemaProps([
      { id: "district", type: "string", description: "District", required: true },
      { id: "state", type: "string", description: "State", required: true },
    ]),
  },
  {
    name: "get_nutrient_requirements",
    description: "INAPH minimum daily TDN, CP, Ca, P for the animal. Call before final ration.",
    expects_response: true,
    parameters: jsonSchemaProps([
      { id: "species", type: "string", description: "cattle or buffalo", required: true },
      { id: "weight_kg", type: "number", description: "Body weight kg", required: true },
      { id: "calvings", type: "number", description: "Calving count", required: false },
      { id: "in_milk", type: "boolean", description: "In milk", required: true },
      { id: "months_after_calving", type: "number", description: "Months since calving", required: false },
      { id: "milk_yield_litres", type: "number", description: "Milk L/day", required: false },
      { id: "milk_fat_percent", type: "number", description: "Fat percent", required: false },
      { id: "pregnant", type: "boolean", description: "Pregnant", required: false },
      { id: "pregnancy_month", type: "number", description: "Pregnancy month", required: false },
    ]),
  },
];

async function ensureTool(def) {
  const list = await api("GET", "/convai/tools");
  const existing = list.tools?.find((t) => t.tool_config?.name === def.name);
  const tool_config = { type: "client", ...def };
  if (existing?.id) {
    console.log(`Updating tool: ${def.name} (${existing.id})`);
    await api("PATCH", `/convai/tools/${existing.id}`, { tool_config });
    return existing.id;
  }
  console.log(`Creating tool: ${def.name}`);
  const created = await api("POST", "/convai/tools", { tool_config });
  return created.id;
}

async function main() {
  console.log("Fetching agent:", AGENT_ID);
  const agent = await api("GET", `/convai/agents/${AGENT_ID}`);
  const existingPrompt = agent.conversation_config?.agent?.prompt?.prompt ?? "";
  const mergedPrompt = existingPrompt.includes("compute_balanced_ration")
    ? existingPrompt
    : `${existingPrompt}\n\n${LP_MANDATE}`;

  console.log("Ensuring client tools...");
  const toolIds = [];
  for (const def of TOOL_DEFS) {
    toolIds.push(await ensureTool(def));
  }

  const patch = {
    conversation_config: {
      agent: {
        prompt: {
          prompt: mergedPrompt,
          tool_ids: toolIds,
          llm: agent.conversation_config?.agent?.prompt?.llm ?? "gemini-2.5-flash",
        },
      },
    },
  };

  await api("PATCH", `/convai/agents/${AGENT_ID}`, patch);
  console.log("\n✅ Agent updated — client LP tools attached.");
  console.log("Tool IDs:", toolIds.join(", "));
  console.log("\nNext: node scripts/verify-agent-lp.mjs");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
