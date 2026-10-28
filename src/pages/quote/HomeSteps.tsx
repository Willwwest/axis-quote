import { useState } from "react";
import { Check, Eye, Home, Sparkles } from "lucide-react";
import { HOME_FILMS, HOME_GOALS, PANES, type HomeFilm, type HomeGoal } from "../../data/config";
import { HomeVisualizer } from "../../components/HomeVisualizer";
import { Chip, Choice, Counter, Segmented, StepHeader, cx } from "../../components/ui";
import { homePaneCount, homeSqft } from "../../lib/pricing";
import type { HomeSpec } from "../../lib/types";
import { useQuote } from "./context";

export function recommend(goals: HomeGoal[]): { film: HomeFilm; shade: string } {
  if (goals.includes("privacy")) return { film: "ultraview", shade: "Ultra View 15" };
  if (goals.includes("view")) return { film: "pristine", shade: "Pristine 50" };
  if (goals.includes("heat")) return { film: "ultraview", shade: "Ultra View 25" };
  if (goals.includes("glare")) return { film: "ultraview", shade: "Ultra View 35" };
  return { film: "pristine", shade: "Pristine 70" };
}

function useHome() {
  const { q, set } = useQuote();
  const update = (patch: Partial<HomeSpec>) => set((s) => ({ home: { ...s.home, ...patch } }));
  return [q.home, update] as const;
}

export function PropertyStep() {
  const { q } = useQuote();
  const [h, update] = useHome();
  const toggleGoal = (g: HomeGoal) => {
    const goals = h.goals.includes(g) ? h.goals.filter((x) => x !== g) : [...h.goals, g];
    update({ goals, ...recommend(goals) });
  };
  const noun = q.kind === "business" ? "building" : "home";

  return (
    <div>
      <StepHeader
        eyebrow={`Step 1 · Your ${noun}`}
        title="What should your windows do?"
        sub="Pick everything that matters. We'll recommend a film to match."
      />
      <div className="flex flex-wrap gap-2">
        {HOME_GOALS.map((g) => (
          <Chip key={g.id} selected={h.goals.includes(g.id)} onClick={() => toggleGoal(g.id)}>{g.label}</Chip>
        ))}
      </div>

      <h2 className="mb-1 mt-10 font-display text-xl font-semibold">Roughly how many windows?</h2>
      <p className="mb-4 text-sm text-white/55">Ballpark is fine. We measure exactly at the free consultation.</p>
      <div className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[.02]">
        {PANES.map((p) => (
          <div key={p.id} className="flex items-center gap-4 px-5 py-4">
            <PaneIcon size={p.id} />
            <div className="flex-1">
              <div className="font-medium">{p.label}</div>
              <div className="text-xs text-white/50">{p.hint} · ~{p.sqft} sq ft</div>
            </div>
            <Counter value={h.panes[p.id]} onChange={(n) => update({ panes: { ...h.panes, [p.id]: n } })} />
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-white/50">
        {homePaneCount(h)} windows · about <span className="text-white">{homeSqft(h)} sq ft</span> of glass
      </p>
    </div>
  );
}

function PaneIcon({ size }: { size: (typeof PANES)[number]["id"] }) {
  const dims = { small: [18, 22], standard: [24, 28], large: [36, 26], door: [34, 34] }[size];
  return (
    <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/[.04]">
      <div className="relative rounded-[3px] border-2 border-white/50 bg-sky-300/20" style={{ width: dims[0], height: dims[1] }}>
        <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white/50" />
      </div>
    </div>
  );
}

export function HomeFilmStep() {
  const [h, update] = useHome();
  const [view, setView] = useState<"outside" | "inside">("outside");
  const rec = recommend(h.goals);
  const film = HOME_FILMS[h.film];
  const shade = film.shades.find((s) => s.name === h.shade) ?? film.shades[0];
  const reflect = "vlrExt" in shade ? (view === "outside" ? shade.vlrExt : shade.vlrInt) : 6;

  return (
    <div>
      <StepHeader eyebrow="Step 2 · Film" title="Same view. Half the heat." sub="Edge films from our lineup. Flip between the street and your living room." />

      <div className="relative overflow-hidden rounded-3xl border border-white/10">
        <div className="absolute left-4 top-4 z-10">
          <Segmented size="sm" value={view} onChange={setView} options={[
            { value: "outside", label: <span className="flex items-center gap-1.5"><Home size={13} /> From the street</span> },
            { value: "inside", label: <span className="flex items-center gap-1.5"><Eye size={13} /> From inside</span> },
          ]} />
        </div>
        <div className="absolute right-4 top-4 z-10 rounded-xl bg-black/50 px-3 py-2 text-right backdrop-blur">
          <div className="font-display text-xl font-bold">{shade.name}</div>
          <div className="text-[11px] uppercase tracking-widest text-white/60">{shade.vlt}% light in</div>
        </div>
        <HomeVisualizer vlt={shade.vlt} reflect={reflect} view={view} className="w-full" />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {(Object.keys(HOME_FILMS) as HomeFilm[]).map((id) => {
          const f = HOME_FILMS[id];
          return (
            <Choice key={id} selected={h.film === id} onClick={() => update({ film: id, shade: id === rec.film ? rec.shade : f.shades[Math.floor(f.shades.length / 2)].name })} className="!p-5">
              {rec.film === id && (
                <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-axis-red px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                  <Sparkles size={11} /> For you
                </span>
              )}
              <div className="text-xs uppercase tracking-widest text-white/45">{f.kind}</div>
              <div className="font-display text-xl font-semibold">{f.name}</div>
              <p className="mt-1 text-sm text-white/60">{f.tagline}</p>
            </Choice>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {film.shades.map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => update({ shade: s.name })}
            className={cx("rounded-xl border px-4 py-2.5 text-left transition", h.shade === s.name ? "border-axis-red bg-axis-red/10" : "border-white/10 hover:border-white/30")}
          >
            <div className="flex items-center gap-1.5 font-display font-semibold">
              {h.shade === s.name && <Check size={14} className="text-axis-bright" />}{s.name}
              {rec.shade === s.name && <Sparkles size={12} className="text-axis-bright" />}
            </div>
            <div className="text-xs text-white/50">{s.vlt}% visible light</div>
          </button>
        ))}
      </div>

      {"tser" in shade && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total solar energy rejected" value={`${shade.tser}%`} />
          <Stat label="Infrared heat rejected" value={`${shade.irr}%`} />
          <Stat label="UV blocked" value=">99%" />
          <Stat label="Solar heat gain coeff." value={shade.shgc} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
      <div className="font-display text-2xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs leading-snug text-white/50">{label}</div>
    </div>
  );
}
