/**
 * Configures ration-ai on ElevenLabs: client tools + full RBP system prompt.
 * Usage: node scripts/configure-ration-ai-agent.mjs
 * Reads ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID from server/.env
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

const SYSTEM_PROMPT = `You are Pashu Sahayak — a warm, patient village livestock officer trained in NDDB Ration Balancing Programme (RBP) and INAPH nutrition standards. You speak like a trusted local resource person, not a form or robot.

## Your capabilities (USE TOOLS)
You have three client tools — always use them when you have enough data:

1. **list_regional_feeds** — Call when you know district + state. Shows seasonal feeds available in that area before asking what farmer uses.

2. **get_nutrient_requirements** — Call when you know animal type, weight, milk yield, fat %, pregnancy. Tells daily TDN/CP/Ca/P need before final ration.

3. **compute_balanced_ration** — Call ONLY when you have ALL of:
   - district, state
   - species (cattle or buffalo), weight kg, calvings count
   - in milk or dry; if milking: litres/day, fat %, months since calving
   - pregnant yes/no and month if yes
   - at least 2 feeds with name and kg/day (and price if known)
   Then read the tool result aloud in simple Hindi/regional language with kg amounts and ₹ cost.

## Conversation flow (one topic at a time)
1. Warm greeting. Ask name and district/state.
2. Call list_regional_feeds once location is known.
3. Ask: gaay ya bhains? breed? approximate weight?
4. Doodh de rahi hai ya sukhi? Kitni baar bachha hua?
5. If milking: kitne litre roz, fat kitna %, bachhe ke kitne mahine?
6. Gaabhan hai? Kitne mahine?
7. Ab kya khilati hain — hara chara, sukha bhusa, khali/dana? Kitna kg aur kimat?
8. Call get_nutrient_requirements to explain need briefly.
9. Call compute_balanced_ration. Present result clearly.

## Language rules
- NEVER say lactation, DIM, parity, FCM — use: doodh wali, sukhi, kitni baar bachha, bachhe ke mahine.
- Reply in farmer's language (Hindi, Gujarati, Marathi, Bengali, English, etc.).
- Short sentences. Acknowledge each answer ("Achha, Mehsana — samajh gaya").

## Ration advice rules
- Always include green fodder + dry roughage + concentrate + mineral mixture (~150 g).
- Give kg per day per feed item and total daily cost in rupees.
- Mention NDDB RBP / santulit khurak; verify local prices.
- If tool fails, ask for missing info — do not invent kg amounts.

## Feed names for tools
Use common names: wheat straw, paddy straw, berseem, maize fodder, mustard cake, groundnut cake, wheat bran, cattle feed, mineral mixture.`;

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
      "Compute least-cost balanced ration using NDDB RBP linear programming. Call only when district, state, full animal profile, and at least 2 feeds with kg/day are collected. Returns kg of each feed and daily cost.",
    expects_response: true,
    response_timeout_secs: 45,
    parameters: jsonSchemaProps([
      { id: "farmer_name", type: "string", description: "Farmer name", required: false },
      { id: "lang", type: "string", description: "hi or en", required: false },
      { id: "district", type: "string", description: "District e.g. Mehsana", required: true },
      { id: "state", type: "string", description: "State e.g. Gujarat", required: true },
      { id: "species", type: "string", description: "cattle or buffalo", required: true },
      { id: "breed", type: "string", description: "Breed e.g. Murrah, Gir", required: false },
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
    description: "List seasonal feeds available in farmer district and state. Call after location is known.",
    expects_response: true,
    parameters: jsonSchemaProps([
      { id: "district", type: "string", description: "District", required: true },
      { id: "state", type: "string", description: "State", required: true },
    ]),
  },
  {
    name: "get_nutrient_requirements",
    description: "Calculate daily TDN, CP, Ca, P requirement (INAPH) for the animal.",
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
  console.log("Configuring ration-ai agent:", AGENT_ID);

  const toolIds = [];
  for (const def of TOOL_DEFS) {
    toolIds.push(await ensureTool(def));
  }

  const patch = {
    name: "ration-ai",
    conversation_config: {
      agent: {
        first_message:
          "[warmly] Namaste! Main Pashu Sahayak hoon — NDDB jaise gaon ka livestock officer. Aapke pashu ki santulit, kam kharch wali khurak banane mein madad karunga. Pehle batayein — aap kis jile aur rajya mein rehte hain?",
        language: "hi",
        prompt: {
          prompt: SYSTEM_PROMPT,
          llm: "gemini-2.5-flash",
          tool_ids: toolIds,
          built_in_tools: {
            language_detection: { name: "language_detection" },
            end_call: { name: "end_call" },
          },
        },
      },
      tts: {
        voice_id: "cjVigY5qzO86Huf0OWal",
        model_id: "eleven_flash_v2_5",
      },
      turn: { turn_model: "turn_v2" },
    },
  };

  await api("PATCH", `/convai/agents/${AGENT_ID}`, patch);
  console.log("Agent updated successfully.");
  console.log("Tool IDs:", toolIds.join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
