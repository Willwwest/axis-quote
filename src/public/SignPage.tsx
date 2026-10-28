import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Download, Eraser, Mail, MessageSquare, Phone, Printer } from "lucide-react";
import { BUSINESS } from "../data/config";
import { docView, type DocView } from "../admin/documents/docs";
import { DocBody, PrintOnly, printLight } from "../admin/documents/DocView";
import { Button, Card, Field, Input, Logo, cx } from "../components/ui";
import { downloadFile } from "../lib/format";
import { decodeSnap } from "../lib/links";
import { smsHref } from "../lib/messages";
import { notify } from "../lib/notify";
import { signedDocs } from "../lib/store";

export default function SignPage() {
  const { id = "" } = useParams();
  const local = signedDocs.useOne(id);
  const snap = useMemo(() => decodeSnap<DocView>(window.location.hash), []);
  // Signed on another phone: kept here only, since the shop's records aren't on this device.
  const [remote, setRemote] = useState<Pick<DocView, "signature" | "signedName" | "signedAt"> | null>(null);
  const base = local ? docView(local) : snap;
  const view = base && remote ? { ...base, ...remote, status: "signed" as const } : base;

  const title = view?.title;
  useEffect(() => { if (title) document.title = `${title} · ${BUSINESS.name}`; }, [title]);

  return (
    <div className="min-h-screen bg-bg pb-24 text-fg">
      <header className="no-print border-b border-fg/5">
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-3 px-4">
          <Logo flat className="h-9" />
          <div className="flex-1" />
          <a href={BUSINESS.phoneHref} className="flex items-center gap-1.5 rounded-full border border-fg/15 px-3 py-1.5 text-sm text-fg/75 hover:border-fg/30 hover:text-fg"><Phone size={14} /> {BUSINESS.phone}</a>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pt-8">
        {!view ? (
          <div className="pt-12 text-center">
            <AlertTriangle className="mx-auto text-warn" size={32} />
            <h1 className="mt-4 font-display text-2xl font-semibold">This link looks incomplete</h1>
            <p className="mt-2 text-fg/60">Some apps cut long links short. Text us and we'll send it again.</p>
            <a href={BUSINESS.smsHref}><Button className="mt-6"><MessageSquare size={16} /> Text {BUSINESS.name}</Button></a>
          </div>
        ) : view.status === "signed" && view.signature ? (
          <Signed view={view} isLocal={!!local && !remote} />
        ) : (
          <SignForm view={view} onSigned={(sig) => {
            const record = signedDocs.get(view.id);
            if (record) {
              signedDocs.update(record.id, { status: "signed", ...sig });
              notify("document", `${sig.signedName || view.customer.name} signed "${view.title}"`, `/admin/jobs/${record.leadId}`);
            } else setRemote(sig);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }} />
        )}
      </main>
    </div>
  );
}

function SignForm({ view, onSigned }: { view: DocView; onSigned: (s: { signature: string; signedName: string; signedAt: string }) => void }) {
  const [names] = useState(() => view.customer.name.trim().split(/\s+/));
  const [firstName, setFirst] = useState(names[0] ?? "");
  const [lastName, setLast] = useState(names.slice(1).join(" "));
  const [signature, setSignature] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const nameOk = !view.requireName || (firstName.trim().length > 0 && lastName.trim().length > 0);
  const ok = nameOk && !!signature;

  const submit = () => {
    setTried(true);
    if (!ok) return;
    onSigned({ signature: signature!, signedName: `${firstName.trim()} ${lastName.trim()}`.trim(), signedAt: new Date().toISOString() });
  };

  return (
    <>
      <div className="mb-4 font-display text-xs font-semibold uppercase tracking-[.25em] text-accent-fg">Please review & sign</div>
      <Card className="!p-5 sm:!p-7"><DocBody view={view} /></Card>

      <Card tone="accent" className="mt-6 !p-5 sm:!p-6">
        <h2 className="font-display text-xl font-semibold">Sign</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="First name" hint={view.requireName ? "Required" : undefined}>
            <Input value={firstName} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" className={cx(tried && view.requireName && !firstName.trim() && "border-warn")} />
          </Field>
          <Field label="Last name" hint={view.requireName ? "Required" : undefined}>
            <Input value={lastName} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" className={cx(tried && view.requireName && !lastName.trim() && "border-warn")} />
          </Field>
        </div>
        <div className="mt-5">
          <div className="mb-1.5 text-sm font-medium text-fg/80">Please sign below</div>
          <SignaturePad onChange={setSignature} invalid={tried && !signature} />
        </div>
        <Button size="lg" className="mt-5 w-full" onClick={submit}><CheckCircle2 size={18} /> Confirm & submit</Button>
        {tried && !ok && <p className="mt-2 text-center text-sm text-warn">{!signature ? "Add your signature above." : "Add your first and last name."}</p>}
        <p className="mt-3 text-center text-xs text-fg/40">Your typed name and drawn signature count as your electronic signature on this document.</p>
      </Card>
    </>
  );
}

/** Finger or mouse signature. Draws in scrim (black in both themes) on white "paper", exports a PNG. */
function SignaturePad({ onChange, invalid }: { onChange: (png: string | null) => void; invalid?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);
  const hasInk = useRef(false);

  useEffect(() => {
    const c = canvas.current!;
    const fit = () => {
      const r = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      // Resizing a canvas wipes it, so redraw what was signed (rotating a phone mid-signature).
      const prev = hasInk.current ? c.toDataURL() : null;
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      const ctx = c.getContext("2d")!;
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = `rgb(${getComputedStyle(document.documentElement).getPropertyValue("--c-scrim").trim() || "0 0 0"})`;
      if (prev) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, r.width, r.height); img.src = prev; }
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const point = (e: PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: PointerEvent) => {
    e.preventDefault();
    canvas.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    const ctx = canvas.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  };
  const move = (e: PointerEvent) => {
    if (!drawing.current || !last.current) return;
    const ctx = canvas.current!.getContext("2d")!;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    setEmpty(false);
    hasInk.current = true;
    onChange(canvas.current!.toDataURL("image/png"));
  };
  const clear = () => {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
    hasInk.current = false;
    onChange(null);
  };

  return (
    <div className={cx("relative overflow-hidden rounded-2xl border-2 bg-on-accent", invalid ? "border-warn" : "border-fg/15")}>
      <canvas ref={canvas} className="block h-44 w-full cursor-crosshair touch-none" aria-label="Signature pad"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
      {empty && <span className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-scrim/35">Sign here with your finger</span>}
      <div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-scrim/20" />
      <button type="button" onClick={clear} className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-scrim/10 px-2.5 py-1.5 text-xs font-medium text-scrim/70 hover:bg-scrim/15">
        <Eraser size={13} /> Clear
      </button>
    </div>
  );
}

function Signed({ view, isLocal }: { view: DocView; isLocal: boolean }) {
  const body = useRef<HTMLDivElement>(null);
  const fileName = `${view.title.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "")}-signed.html`;
  const download = () => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${view.title.replace(/</g, "&lt;")}</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:32px auto;padding:0 16px;line-height:1.55}img[alt="Axis Glass Tinting"]{display:none}img{max-width:320px}dl div{margin:2px 0}</style></head>
<body>${body.current?.innerHTML ?? ""}</body></html>`;
    downloadFile(fileName, html, "text/html");
  };
  const mailBody = `Hi ${BUSINESS.name}, I signed "${view.title}" on ${new Date(view.signedAt ?? Date.now()).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}. My signed copy is attached.\n\n${view.signedName ?? ""}`;

  return (
    <>
      <Card tone="success" className="no-print !p-5 sm:!p-6">
        <div className="flex items-center gap-2 font-display text-lg font-semibold text-success"><CheckCircle2 size={22} /> Signed. Thank you{view.signedName ? `, ${view.signedName.split(" ")[0]}` : ""}!</div>
        {isLocal ? (
          <p className="mt-2 text-fg/70">{BUSINESS.name} has your signed copy. You can save one for yourself below.</p>
        ) : (
          <>
            <p className="mt-2 text-fg/70">One more step: your signature is saved on this phone only. Download your signed copy (or save it as a PDF), then send it to us:</p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-fg/65">
              <li>Tap <strong className="text-fg">Download signed copy</strong> or <strong className="text-fg">Save as PDF</strong>.</li>
              <li>Attach it to an email to {BUSINESS.email}, or a text to {BUSINESS.phone}.</li>
            </ol>
          </>
        )}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button onClick={download}><Download size={16} /> Download signed copy</Button>
          <Button variant="outline" onClick={printLight}><Printer size={16} /> Save as PDF / print</Button>
          {!isLocal && (
            <>
              <a href={`mailto:${BUSINESS.email}?subject=${encodeURIComponent(`Signed: ${view.title}`)}&body=${encodeURIComponent(mailBody)}`}><Button variant="outline" className="w-full"><Mail size={16} /> Email it to us</Button></a>
              <a href={smsHref(BUSINESS.phone, `Hi, I signed "${view.title}". Sending my copy now. – ${view.signedName ?? ""}`)}><Button variant="outline" className="w-full"><MessageSquare size={16} /> Text us</Button></a>
            </>
          )}
        </div>
      </Card>
      <Card className="mt-6 !p-5 sm:!p-7"><DocBody ref={body} view={view} /></Card>
      <PrintOnly><DocBody view={view} /></PrintOnly>
    </>
  );
}
