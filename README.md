# Pashu Poshan AI — Ration Advisory Web App

NDDB **Ration Balancing Programme (RBP)** advisory for Indian dairy farmers: multi-step web wizard, **linear programming** least-cost formulation (INAPH nutrition tables + Main Feed Library), district-aware feeds, and **ElevenLabs voice agent** for phone-style interaction.

## Features

- **Farmer interview flow**: location → herd (multiple animals) → feeds & prices → balanced ration plan
- **LP engine**: TDN, CP, Ca, P, dry matter range, concentrate cap, ±25% on farmer-entered qty, forage + mineral mixture (from *Other constraints used for RBP*)
- **Regional feeds**: season + state/region filtering from NDDB feed library
- **Charts**: nutrient required vs supplied per animal
- **Voice**: ElevenLabs Conversational AI (`@elevenlabs/react`) with server webhook tool `compute_balanced_ration`

## Quick start

```bash
cd "D:\work\Innovations\Pashu Poshan AI"
npm install
npm install --prefix client
npm install --prefix server

# Copy env templates
copy server\.env.example server\.env
copy client\.env.example client\.env

npm run dev
```

- Web app: http://localhost:5173  
- API: http://localhost:8787  

## Environment

**server/.env**

```
PORT=8787
ELEVENLABS_API_KEY=your_key
ELEVENLABS_AGENT_ID=agent_xxxx
```

**client/.env**

```
VITE_ELEVENLABS_AGENT_ID=agent_xxxx
```

## ElevenLabs voice (configured)

The app uses your **ration-ai** agent (`agent_7901ktxb63bce06ayv4zzh47kmz3`) with a warm Hindi-first personality (same voice style as Pashu Mitra). Credentials go in `server/.env` — never commit this file.

Voice panel: click **Awaz se shuru karein** → live transcript → natural back-and-forth like a village livestock officer.

## ElevenLabs agent setup (optional webhook)

1. Create an agent in [ElevenLabs Agents](https://elevenlabs.io/app/agents).
2. Paste the system prompt from `elevenlabs/agent-config.json` (or import via CLI).
3. Expose the API publicly (ngrok, Cloudflare Tunnel, or deploy server):

   ```bash
   ngrok http 8787
   ```

4. Create webhook tool from `elevenlabs/tool-compute-ration.json` — set `PUBLIC_API_URL` to your HTTPS base URL.
5. Attach tool ID to the agent’s `prompt.tool_ids`.
6. Choose a Hindi/multilingual voice for TTS.

Voice calls use `GET /api/elevenlabs/signed-url` so the API key stays on the server.

## Knowledge sources (bundled in code)

| Source | Use |
|--------|-----|
| INAPH Nutrition masters for RBP Revised | Maintenance & milk nutrient tables |
| Other constraints used for RBP | DM %, concentrate %, pregnancy month 7+, ±25%, mineral, forage |
| Main Feed library .xlsx | 270+ feeds — `client/src/lib/feedLibrary.ts` |

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/elevenlabs/signed-url` | Signed URL for voice session |
| POST | `/api/ration/compute` | Compute herd ration JSON |
| POST | `/api/webhook/elevenlabs/compute-ration` | ElevenLabs server tool |

## Production build

```bash
npm run build --prefix client
npm run build --prefix server
npm start
```

Serve static client from `client/dist` via Express.

## Related project

Core ration logic was adapted from `AI Pashu Sahayak/c-Users-sinjini-Projects-dairy-sakha` (PashuMitra Ration Advisor).
