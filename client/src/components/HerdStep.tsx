import { Plus, Trash2 } from "lucide-react";
import { useAdvisory } from "../context/AdvisoryContext";
import { AnimalRecord, Species } from "../lib/types";
import { Field } from "./ui";

const BREEDS: Record<Species, string[]> = {
  cattle: ["HF Cross", "Jersey Cross", "Gir", "Sahiwal", "Kankrej", "Desi"],
  buffalo: ["Murrah", "Mehsani", "Jaffarabadi", "Surti", "Nili-Ravi", "Desi"],
};

export function HerdStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { session, addAnimal, updateAnimal, removeAnimal } = useAdvisory();
  const hi = session.lang === "hi";

  const ensureOne = () => {
    if (!session.animals.length) addAnimal();
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold mb-1">{hi ? "🐄 Pashu ki jaankari" : "🐄 Animal details"}</h2>
        <p className="text-sm text-[var(--muted)]">
          {hi
            ? "Har pashu ke liye: gaay/bhains, byaat, doodh/sukhi, garbh, doodh matra — INAPH tables se requirement niklegi."
            : "Per animal: species, lactation, milk/dry, pregnancy, yield — INAPH tables compute requirements."}
        </p>
      </div>

      {session.animals.length === 0 && (
        <button type="button" className="btn btn-primary" onClick={() => addAnimal()}>
          <Plus size={18} /> {hi ? "Pehla pashu jodo" : "Add first animal"}
        </button>
      )}

      <div className="space-y-4">
        {session.animals.map((a: AnimalRecord, idx: number) => (
          <div key={a.id} className="card p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">
                {hi ? `Pashu ${idx + 1}` : `Animal ${idx + 1}`}
              </h3>
              <button type="button" className="text-red-400" onClick={() => removeAnimal(a.id)}>
                <Trash2 size={16} />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label={hi ? "Naam (optional)" : "Label"}>
                <input
                  className="input"
                  value={a.label}
                  onChange={(e) => updateAnimal(a.id, { label: e.target.value })}
                />
              </Field>
              <Field label={hi ? "Pashu" : "Species"}>
                <select
                  className="input"
                  value={a.species}
                  onChange={(e) => {
                    const species = e.target.value as Species;
                    updateAnimal(a.id, {
                      species,
                      milkFatPct: species === "buffalo" ? 7 : 4,
                    });
                  }}
                >
                  <option value="cattle">{hi ? "Gaay" : "Cow"}</option>
                  <option value="buffalo">{hi ? "Bhains" : "Buffalo"}</option>
                </select>
              </Field>
              <Field label={hi ? "Nasl" : "Breed"}>
                <select
                  className="input"
                  value={a.breed ?? BREEDS[a.species][0]}
                  onChange={(e) => updateAnimal(a.id, { breed: e.target.value })}
                >
                  {BREEDS[a.species].map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </Field>
              <Field label={hi ? "Wajan (kg)" : "Body weight (kg)"}>
                <input
                  type="number"
                  className="input"
                  value={a.weightKg}
                  onChange={(e) => updateAnimal(a.id, { weightKg: Number(e.target.value) })}
                />
              </Field>
              <Field label={hi ? "Kitni baar bachha?" : "Lactation number (calvings)"}>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={a.calvings}
                  onChange={(e) => updateAnimal(a.id, { calvings: Number(e.target.value) })}
                />
              </Field>
              <Field label={hi ? "Ab doodh de rahi?" : "Currently in milk?"}>
                <select
                  className="input"
                  value={a.inMilk ? "yes" : "no"}
                  onChange={(e) =>
                    updateAnimal(a.id, {
                      inMilk: e.target.value === "yes",
                      milkYieldKg: e.target.value === "yes" ? a.milkYieldKg : 0,
                    })
                  }
                >
                  <option value="yes">{hi ? "Haan — doodh wali" : "Yes — in milk"}</option>
                  <option value="no">{hi ? "Nahi — sukhi" : "No — dry"}</option>
                </select>
              </Field>
              {a.inMilk && (
                <>
                  <Field label={hi ? "Bachhe ke baad kitne mahine?" : "Months since calving"}>
                    <input
                      type="number"
                      min={0}
                      max={24}
                      className="input"
                      value={a.monthsAfterCalving}
                      onChange={(e) => updateAnimal(a.id, { monthsAfterCalving: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label={hi ? "Doodh (L/day)" : "Milk yield (L/day)"}>
                    <input
                      type="number"
                      step="0.5"
                      className="input"
                      value={a.milkYieldKg}
                      onChange={(e) => updateAnimal(a.id, { milkYieldKg: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label={hi ? "Fat %" : "Milk fat %"}>
                    <input
                      type="number"
                      step="0.1"
                      className="input"
                      value={a.milkFatPct}
                      onChange={(e) => updateAnimal(a.id, { milkFatPct: Number(e.target.value) })}
                    />
                  </Field>
                </>
              )}
              <Field label={hi ? "Gaabhan?" : "Pregnant?"}>
                <select
                  className="input"
                  value={a.pregnant ? "yes" : "no"}
                  onChange={(e) => updateAnimal(a.id, { pregnant: e.target.value === "yes" })}
                >
                  <option value="no">{hi ? "Nahi" : "No"}</option>
                  <option value="yes">{hi ? "Haan" : "Yes"}</option>
                </select>
              </Field>
              {a.pregnant && (
                <Field label={hi ? "Garbh ke mahine (7+ par extra ration)" : "Pregnancy month (7+ adds allowance)"}>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    className="input"
                    value={a.pregnancyMonth}
                    onChange={(e) => updateAnimal(a.id, { pregnancyMonth: Number(e.target.value) })}
                  />
                </Field>
              )}
            </div>
          </div>
        ))}
      </div>

      {session.animals.length > 0 && (
        <button type="button" className="btn btn-secondary" onClick={() => addAnimal()}>
          <Plus size={18} /> {hi ? "Ek aur pashu" : "Add another animal"}
        </button>
      )}

      <div className="flex gap-3">
        <button type="button" className="btn btn-secondary flex-1" onClick={onBack}>
          {hi ? "Peeche" : "Back"}
        </button>
        <button
          type="button"
          className="btn btn-primary flex-1"
          onClick={() => {
            ensureOne();
            onNext();
          }}
        >
          {hi ? "Chara & daana" : "Feeds & prices"}
        </button>
      </div>
    </div>
  );
}
