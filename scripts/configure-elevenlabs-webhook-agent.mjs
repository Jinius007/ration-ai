/**
 * Configures ration-ai on ElevenLabs with **webhook** LP tools (works without the web app).
 * ElevenLabs calls your deployed HTTPS API; LP runs on the server.
 *
 * Prerequisites:
 *   1. Deploy this repo to Vercel (or any public HTTPS host)
 *   2. server/.env:
 *        ELEVENLABS_API_KEY=...
 *        ELEVENLABS_AGENT_ID=agent_1401ktxb5xm7e1892xgwj36me0xm
 *        PUBLIC_API_URL=https://your-app.vercel.app   (no trailing slash)
 *
 * Usage:
 *   npm run configure-webhook-agent
 *   npm run verify-agent
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
const PUBLIC_API_URL = (env.PUBLIC_API_URL ?? "").replace(/\/$/, "");

if (!API_KEY || !AGENT_ID) {
  console.error("Missing ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID in server/.env");
  process.exit(1);
}
if (!PUBLIC_API_URL) {
  console.error("Missing PUBLIC_API_URL in server/.env (your deployed HTTPS base, e.g. https://ration-ai.vercel.app)");
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

const PERSONA_BLOCK = `
## ADVISOR PERSONA (always follow)
You are **Pashu Poshan** — a male (purush) dairy extension officer speaking to Indian farmers. Use **masculine Hindi** for yourself:
- Say: main kar **sakta** hoon, bata **sakta** hoon, madad kar **sakta** hoon, samjha **sakta** hoon
- NEVER: kar sakti hoon, bata sakti hoon, de sakti hoon (feminine — wrong for your voice)

**Language:** Natural **Devanagari Hindi** — simple village speech, not formal English. Chat and voice both in Hindi unless farmer uses English.

**Do NOT repeat or narrate process (CRITICAL):**
- NEVER repeat the previous step's ration when giving a new result.
- Do NOT repeat the farmer's answers after every step. A short acknowledgement like "ठीक है" is enough.
- Do NOT summarize location, animal profile, milk, pregnancy, or feed details during data collection.
- Give one brief recap only at the end, after the ration result: animal type, milk status/yield, and main feeds used.
- NEVER say: "main ab hisaab laga raha hoon", "tool call", "pehla hisaab tha...", "linear programming", "webhook".
- NEVER read examples lists or section headers like "पहला हिसाब —".
- Read ONLY what the tool returns now — feed names and quantities, then total daily cost, then nutrition %. Never read per-feed prices.
- First call: state today's ration + ask "क्या आपके इलाके में और चारा मिलता है?"
- Second call: state updated ration only (+ optional extras if listed). Do not recap step 1.

**Mineral mixture:** Step 1 always includes khareej / mineral matra in the tool output even if farmer did not mention it — read that line to the farmer.

**Ration flow:**
1. Optimise farmer's stated feeds + automatic mineral quantity. Dry bhusa/straw max 8 kg/day.
2. Ask if more feed available locally.
3. Second call with neighborhood_feeds_json or local_feed_names — optimised plan with local feeds added.
`.trim();

const LP_MANDATE = `
## MANDATORY: Real linear programming ration (webhook tools)
Knowledge base files are reference only. You MUST NOT invent kg amounts from memory.

You have three **webhook tools** (server runs least-cost LP on 270+ feed library + INAPH nutrition):

1. **list_regional_feeds** — after district + state are known.

2. **get_nutrient_requirements** — after animal profile (species, weight, milk, pregnancy).

3. **compute_balanced_ration** — ONLY when you have ALL of:
   - district, state
   - species (cattle/buffalo), weight_kg, calvings
   - in_milk, milk_yield_litres, milk_fat_percent if milking; pregnant, pregnancy_month
   - feeds_json: JSON array e.g. [{"name":"hybrid napier ghaas","qty_kg":5,"price_rs":2}]. Include price_rs ONLY when farmer told you the price. Omit price_rs when farmer said pata nahi or did not answer — tool uses library rate for those feeds.
   - neighborhood_feeds_json (second call): REQUIRED when farmer names local feeds, e.g. [{"name":"hybrid napier grass","price_rs":3}]
   - local_feed_names (second call): simpler alternative, e.g. "hybrid napier grass"

**Conversation memory and feed collection (CRITICAL):**
- Track every feed name, variety, quantity, and price the farmer has already said.
- For EACH feed collect: (1) exact name/variety (e.g. hybrid napier ghaas, NB-21, gehu bhusa), (2) daily quantity in kilogram, (3) ask price per kilogram out loud — "<feed name> ek kilogram ka kitna rupaya dete ho?"
- ALWAYS ask the price question for every feed — do not skip.
- **If farmer tells the price:** put that exact number in price_rs for that feed. LP will use ONLY the farmer's price.
- **If farmer says pata nahi / malum nahi / nahi pata, or does not answer after you asked:** say "theek hai, main market rate lagaunga" and omit price_rs for that feed. LP will use the regional library/database rate automatically.
- After you have asked every feed's price once, call compute_balanced_ration even if some feeds have no price_rs.
- If the farmer has already named feeds, DO NOT ask "what do you feed?" again — only ask missing quantity or price.
- Pass the farmer's exact feed names in feeds_json (Hindi or English) — the tool matches 270+ feeds in the library including napier ghaas, makai dana, gehu bhusa, sarson khali, etc. NEVER tell the farmer a feed is not in the database unless the tool warning explicitly says so.

**How to use compute_balanced_ration result:**
- Tool returns step field "first" or "second". Read ONLY that text — nothing else.
- For each feed line: read ONLY feed name and recommended quantity — NEVER read per-feed cost or price.
- step=first: read feed quantity lines + total daily cost + nutrition line + neighbourhood question. Then add one short recap of only the major details already used.
- step=second: read updated feed quantity lines + total daily cost + nutrition. Optional extras last if present. Do NOT repeat step 1. Add one short recap only if the farmer asks.
- All numbers as whole numbers — no decimals when speaking.
- Chat: copy tool text in Devanagari Hindi. Numbers as digits: 12, ₹150. Voice: natural Hindi, numbers may be spoken as words.
- Speech pronunciation: never say or write "kg" or "किग्रा" to the farmer; say "kilogram" or "किलोग्राम". Read numeric ranges like "10-15" as "10 to 15" in every language.
- Do NOT say: TDN, CP, ±25%, linear programming, webhook, INAPH.
- Do NOT tell farmer to stop green fodder — only adjust quantities.
- Keep sentences short. No process narration.
`.trim();

const TOOL_FILES = [
  "webhook-compute-ration.json",
  "webhook-regional-feeds.json",
  "webhook-nutrient-requirements.json",
];

function loadTool(filename) {
  const raw = readFileSync(resolve(__dir, `../elevenlabs/${filename}`), "utf8");
  return JSON.parse(raw.replaceAll("{{PUBLIC_API_URL}}", PUBLIC_API_URL));
}

async function ensureWebhookTool(toolConfig) {
  const list = await api("GET", "/convai/tools");
  const existing = list.tools?.find((t) => t.tool_config?.name === toolConfig.name);
  if (existing?.id) {
    console.log(`Updating webhook tool: ${toolConfig.name} (${existing.id})`);
    console.log(`  → ${toolConfig.api_schema?.url}`);
    await api("PATCH", `/convai/tools/${existing.id}`, { tool_config: toolConfig });
    return existing.id;
  }
  console.log(`Creating webhook tool: ${toolConfig.name}`);
  console.log(`  → ${toolConfig.api_schema?.url}`);
  const created = await api("POST", "/convai/tools", { tool_config: toolConfig });
  return created.id;
}

async function main() {
  console.log("Public API:", PUBLIC_API_URL);
  console.log("Agent:", AGENT_ID);

  const agent = await api("GET", `/convai/agents/${AGENT_ID}`);
  const existingPrompt = agent.conversation_config?.agent?.prompt?.prompt ?? "";
  const mandateBlock =
    /## MANDATORY: Real linear programming ration \((client|webhook) tools\)[\s\S]*?(?=\n## |$)/;
  const personaBlock = /## ADVISOR PERSONA \(always follow\)[\s\S]*?(?=\n## |$)/;
  let mergedPrompt = existingPrompt;
  if (personaBlock.test(existingPrompt)) {
    mergedPrompt = mergedPrompt.replace(personaBlock, PERSONA_BLOCK);
  } else {
    mergedPrompt = `${PERSONA_BLOCK}\n\n${mergedPrompt}`;
  }
  if (mandateBlock.test(mergedPrompt)) {
    mergedPrompt = mergedPrompt.replace(mandateBlock, LP_MANDATE);
  } else if (!mergedPrompt.includes("How to read the ration result")) {
    mergedPrompt = `${mergedPrompt}\n\n${LP_MANDATE}`;
  }

  const firstMessage =
    "नमस्ते! मैं आपका पशु पोषण राशन सहायक हूँ — मैं आपकी मदद कर सकता हूँ। पहले बताइए आप किस ज़िले और राज्य में रहते हैं, और गाय है या भैंस?";

  const toolIds = [];
  for (const file of TOOL_FILES) {
    toolIds.push(await ensureWebhookTool(loadTool(file)));
  }

  await api("PATCH", `/convai/agents/${AGENT_ID}`, {
    conversation_config: {
      agent: {
        first_message: firstMessage,
        prompt: {
          prompt: mergedPrompt,
          tool_ids: toolIds,
          llm: agent.conversation_config?.agent?.prompt?.llm ?? "gemini-2.5-flash",
        },
      },
    },
  });

  console.log("\n✅ Agent updated — webhook LP tools attached (ElevenLabs-only, no web app needed).");
  console.log("Tool IDs:", toolIds.join(", "));
  console.log("\nTest: ElevenLabs → Agents → ration-ai → Test → ask for a ration after giving location + feeds.");
  console.log("Verify: npm run verify-agent");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
