import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../server/.env") });
dotenv.config();

import cors from "cors";
import express from "express";
import { z } from "zod";
import { computeHerdRation, formatPlanSummary } from "./lib/rationService.js";
import type { AdvisorySession } from "./lib/types.js";
import { computeFromVoiceRequest } from "./rationBridge.js";
import { feedsForLocation } from "./lib/regionalFeeds.js";
import { computeRequirement } from "./lib/nutrientRequirements.js";
import { detectSeason, defaultWeight } from "./lib/types.js";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY ?? "";
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID ?? "";

const sessionSchema = z.object({
  farmerName: z.string().default(""),
  lang: z.enum(["hi", "en", "gu", "mr", "bn", "ta", "te", "kn", "ml", "pa", "or", "as", "ur"]).default("hi"),
  location: z
    .object({
      district: z.string(),
      state: z.string(),
      stateCode: z.string().optional(),
      village: z.string().optional(),
      label: z.string(),
    })
    .nullable()
    .optional(),
  animals: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      species: z.enum(["cattle", "buffalo"]),
      breed: z.string().optional(),
      weightKg: z.number(),
      calvings: z.number(),
      inMilk: z.boolean(),
      monthsAfterCalving: z.number(),
      milkYieldKg: z.number(),
      milkFatPct: z.number(),
      milkPriceRs: z.number(),
      pregnant: z.boolean(),
      pregnancyMonth: z.number(),
    })
  ),
  feeds: z.array(
    z.object({
      feedId: z.string(),
      feedName: z.string(),
      qtyKg: z.number(),
      priceRs: z.number(),
      category: z.enum(["roughage", "concentrate", "mineral"]),
    })
  ),
});

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "pashu-poshan-ration-api" });
  });

  app.get("/api/elevenlabs/config", (_req, res) => {
    const missing: string[] = [];
    if (!ELEVENLABS_API_KEY) missing.push("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_AGENT_ID) missing.push("ELEVENLABS_AGENT_ID");
    res.json({
      configured: missing.length === 0,
      agentId: ELEVENLABS_AGENT_ID || undefined,
      agentName: "ration-ai",
      missing: missing.length ? missing : undefined,
    });
  });

  app.get("/api/elevenlabs/signed-url", async (_req, res) => {
    if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) {
      res.status(503).json({
        error: "Set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID in environment variables",
      });
      return;
    }
    try {
      const url = `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(ELEVENLABS_AGENT_ID)}`;
      const resp = await fetch(url, {
        headers: { "xi-api-key": ELEVENLABS_API_KEY },
      });
      if (!resp.ok) {
        const text = await resp.text();
        res.status(resp.status).json({ error: text });
        return;
      }
      const data = (await resp.json()) as { signed_url: string };
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/ration/compute", (req, res) => {
    const parsed = sessionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const session = parsed.data as AdvisorySession;
    if (!session.animals.length) {
      res.status(400).json({ error: "At least one animal required" });
      return;
    }
    const report = computeHerdRation(session);
    const summary = formatPlanSummary(report, session.lang === "en" ? "en" : "hi");
    res.json({ report, summary });
  });

  app.post("/api/ration/compute-from-voice", (req, res) => {
    const result = computeFromVoiceRequest(req.body);
    if (!result.ok) {
      res.status(400).json({ error: result.error, warnings: result.warnings });
      return;
    }
    res.json({
      summary: result.summary,
      report: result.report,
      warnings: result.warnings,
    });
  });

  app.post("/api/ration/regional-feeds", (req, res) => {
    const district = String(req.body?.district ?? "");
    const state = String(req.body?.state ?? "");
    if (!district) {
      res.status(400).json({ error: "district required" });
      return;
    }
    const season = detectSeason();
    const feeds = feedsForLocation({ district, state, label: `${district}, ${state}` }, season).slice(0, 30);
    const lines = feeds.map((f) => `• ${f.name} — ₹${f.rate}/kg (${f.group})`);
    res.json({
      result: `Mausam: ${season}. ${district}, ${state} ke common chara:\n${lines.join("\n")}`,
      feeds: feeds.map((f) => ({ name: f.name, id: f.id, rate: f.rate, group: f.group })),
    });
  });

  app.post("/api/ration/nutrient-requirements", (req, res) => {
    const species = req.body?.species === "buffalo" ? "buffalo" : "cattle";
    const weight = Number(req.body?.weight_kg) || defaultWeight(species);
    const req_ = computeRequirement({
      species,
      weight,
      adult: (Number(req.body?.calvings) || 1) > 0,
      pregnant: !!req.body?.pregnant,
      pregnancyMonth: Number(req.body?.pregnancy_month) || 0,
      inMilk: req.body?.in_milk ?? (Number(req.body?.milk_yield_litres) || 0) > 0,
      milkYield: Number(req.body?.milk_yield_litres) || 0,
      milkFat: Number(req.body?.milk_fat_percent) || (species === "buffalo" ? 7 : 4),
      monthsAfterCalving: Number(req.body?.months_after_calving) || 4,
      milkPrice: 34,
    });
    res.json({
      result: `Roz ki zaroorat (INAPH): TDN ${Math.round(req_.total.tdn)} gram, CP ${Math.round(req_.total.cp)} gram, Calcium ${req_.total.ca.toFixed(1)} g, Phosphorus ${req_.total.p.toFixed(1)} g.`,
      requirements: req_.total,
    });
  });

  app.post("/api/webhook/elevenlabs/compute-ration", (req, res) => {
    const voice = computeFromVoiceRequest(req.body);
    if (voice.ok) {
      res.json({ result: voice.summary, report: voice.report, warnings: voice.warnings });
      return;
    }
    const parsed = sessionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.json({
        result: "Missing or invalid data. Ask the farmer for species, milk yield, location, and feeds first.",
      });
      return;
    }
    const session = parsed.data as AdvisorySession;
    if (!session.location?.district) {
      res.json({
        result: "Please confirm the farmer's district and state before computing the ration.",
      });
      return;
    }
    if (!session.animals.length) {
      res.json({ result: "No animal profile yet. Ask which animal — cow or buffalo, milk yield, lactation stage." });
      return;
    }
    const report = computeHerdRation(session);
    const summary = formatPlanSummary(report, session.lang === "en" ? "en" : "hi");
    res.json({ result: summary, report });
  });

  return app;
}

/** Singleton for local dev and Vercel */
export const app = createApp();
