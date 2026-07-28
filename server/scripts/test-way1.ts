import { computeFromVoiceRequest } from "../src/rationBridge.js";

const base = {
  district: "Anand",
  state: "Gujarat",
  animals: [
    {
      species: "buffalo" as const,
      weight_kg: 450,
      calvings: 1,
      in_milk: true,
      milk_yield_litres: 8,
      pregnant: false,
    },
  ],
};

function run(label: string, extra: Record<string, unknown> = {}) {
  const result = computeFromVoiceRequest({ ...base, ...extra });
  if (!result.ok) {
    console.error(label, "ERROR", result.error);
    return;
  }
  console.log(`\n===== ${label} =====\n`);
  console.log(result.summary);
  if (result.warnings.length) console.log("\nWarnings:", result.warnings.join("; "));
}

run("Step 1 — no mineral stated (auto mineral added)", {
  feeds: [
    { name: "makke ka hara chara", qty_kg: 15, price_rs: 0.8 },
    { name: "gehun ka bhoosa", qty_kg: 5, price_rs: 4 },
    { name: "amul daan", qty_kg: 2, price_rs: 18 },
  ],
});

run("Step 2 — add hybrid napier from neighbourhood", {
  feeds: [
    { name: "makke ka hara chara", qty_kg: 15, price_rs: 0.8 },
    { name: "gehun ka bhoosa", qty_kg: 5, price_rs: 4 },
    { name: "amul daan", qty_kg: 2, price_rs: 18 },
    { name: "mineral mixture", qty_kg: 0.1, price_rs: 30 },
  ],
  neighborhood_feeds: [{ name: "napier hybrid grass", qty_kg: 0, price_rs: 2 }],
});

run("Original test — wheat straw + mustard, then napier + barseem", {
  feeds: [
    { name: "wheat straw", qty_kg: 5, price_rs: 4 },
    { name: "mustard cake", qty_kg: 1.5, price_rs: 22 },
  ],
});

run("Original test step 2 — napier + barseem", {
  feeds: [
    { name: "wheat straw", qty_kg: 5, price_rs: 4 },
    { name: "mustard cake", qty_kg: 1.5, price_rs: 22 },
  ],
  neighborhood_feeds: [
    { name: "napier", qty_kg: 0, price_rs: 2 },
    { name: "barseem", qty_kg: 0, price_rs: 3 },
  ],
});
