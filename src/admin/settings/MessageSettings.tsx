import { useRef } from "react";
import { RotateCcw } from "lucide-react";
import { Button, Card, Textarea } from "../../components/ui";
import { DEFAULT_SETTINGS, TEMPLATE_LABELS, TEMPLATE_VARS, type TemplateKey } from "../../data/config";
import { addDays, today } from "../../lib/format";
import { fill, type MergeContext } from "../../lib/messages";
import { patchSettings, useSettings } from "../../lib/store";

const GROUPS: { title: string; keys: TemplateKey[] }[] = [
  { title: "Appointments", keys: ["confirm", "remind24", "remind1", "cancel", "onMyWay", "vehicleReady"] },
  { title: "Proposals", keys: ["proposalSend", "proposalFollow24", "proposalFollow48"] },
  { title: "Billing", keys: ["invoiceSend", "paymentThanks"] },
  { title: "Reviews & documents", keys: ["review", "docSign"] },
];

const SAMPLE: MergeContext = {
  name: "Jordan Lee",
  vehicle: "2021 Honda Accord",
  appointment: { date: addDays(today(), 1), start: "09:00" },
  link: "axisglasstinting.com/a/AP-7K2M",
  amount: 450,
  code: "2041",
  approvedAt: new Date().toISOString(),
};

export function MessageSettings() {
  const s = useSettings();
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold">Message templates</h2>
        <p className="mt-1 text-sm text-fg/50">The texts and emails Axis fills in for you. Tap a :variable to drop it in where your cursor is; the preview uses sample data.</p>
      </div>
      {GROUPS.map((g) => (
        <section key={g.title}>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-fg/45">{g.title}</h3>
          <div className="space-y-4">
            {g.keys.map((k) => <TemplateEditor key={k} k={k} value={s.templates[k]} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function TemplateEditor({ k, value }: { k: TemplateKey; value: string }) {
  // ui.Textarea doesn't forward refs (React 18), so find the element through a wrapper.
  const wrap = useRef<HTMLDivElement>(null);
  const save = (v: string) => patchSettings((x) => ({ templates: { ...x.templates, [k]: v } }));
  const changed = value !== DEFAULT_SETTINGS.templates[k];

  const insert = (token: string) => {
    const el = wrap.current?.querySelector("textarea");
    const at = el ? el.selectionStart : value.length;
    const end = el ? el.selectionEnd : value.length;
    // Pad with spaces so the variable doesn't glue onto a word.
    const pre = value.slice(0, at), post = value.slice(end);
    const piece = `${pre && !/\s$/.test(pre) ? " " : ""}${token}${post && !/^[\s.,!?]/.test(post) ? " " : ""}`;
    save(pre + piece + post);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(at + piece.length, at + piece.length);
    });
  };

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-medium">{TEMPLATE_LABELS[k]}</span>
        <div className="flex items-center gap-2">
          <span className={value.length > 200 ? "text-xs tabular-nums text-warn" : "text-xs tabular-nums text-fg/40"}>{value.length}</span>
          {changed && <Button size="sm" variant="ghost" onClick={() => save(DEFAULT_SETTINGS.templates[k])}><RotateCcw size={13} /> Reset</Button>}
        </div>
      </div>
      <div ref={wrap}><Textarea value={value} onChange={(e) => save(e.target.value)} className="!min-h-[76px] text-sm" aria-label={TEMPLATE_LABELS[k]} /></div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {TEMPLATE_VARS.map((v) => (
          <button key={v} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(v)}
            className="rounded-full border border-fg/12 px-2 py-0.5 font-mono text-[11px] text-fg/60 transition hover:border-accent hover:text-fg">
            {v}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-xl bg-fg/[.04] px-3 py-2 text-sm text-fg/70">
        <span className="mr-1.5 text-[10px] font-medium uppercase tracking-wider text-fg/40">Preview</span>
        {fill(value, SAMPLE) || <span className="text-fg/35">Empty: this message won't have any text.</span>}
      </div>
    </Card>
  );
}
