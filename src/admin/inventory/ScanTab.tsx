import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Camera, CameraOff, ScanLine, Scissors, SearchX } from "lucide-react";
import { Button, Card, CardHeader, Input } from "../../components/ui";
import { findByCode, parseScan } from "../../lib/film";
import { rolls as rollStore } from "../../lib/store";
import type { FilmRoll } from "../../lib/types";
import { LogCut } from "./LogCut";
import { RollCard } from "./RollsTab";
import { useStock } from "./shared";

/** BarcodeDetector isn't in TypeScript's DOM types yet (Chrome on Android has it; iOS Safari doesn't). */
type Detector = { detect(src: HTMLVideoElement): Promise<{ rawValue: string }[]> };
type DetectorCtor = new (o: { formats: string[] }) => Detector;
const Detector = (globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;

/** Scan a roll's QR label (or type its code) and log a cut on the spot. */
export function ScanTab() {
  const { leftOf } = useStock();
  const nav = useNavigate();
  const video = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [found, setFound] = useState<{ code: string; roll?: FilmRoll } | null>(null);
  const [cut, setCut] = useState<string | null>(null);

  const lookup = (raw: string) => {
    const c = parseScan(raw);
    if (!c) return;
    setFound({ code: c, roll: findByCode(c, rollStore.all()) });
    setCode("");
  };

  useEffect(() => {
    if (!on || !Detector) return;
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    const detector = new Detector({ formats: ["qr_code"] });
    const tick = async () => {
      if (stopped || !video.current) return;
      try {
        const hits = await detector.detect(video.current);
        if (hits[0]?.rawValue) {
          navigator.vibrate?.(40);
          lookup(hits[0].rawValue);
          setOn(false);
          return;
        }
      } catch { /* frame not ready yet */ }
      timer = window.setTimeout(tick, 250);
    };
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => {
        if (stopped) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        if (video.current) { video.current.srcObject = s; video.current.play().catch(() => {}); }
        tick();
      })
      .catch(() => { setError("Camera blocked. Allow camera access for this site, or type the code below."); setOn(false); });
    return () => { stopped = true; clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, [on]);

  return (
    <div className="mx-auto max-w-lg">
      <Card className="mb-4">
        <CardHeader title="Scan a roll" icon={<ScanLine size={16} />} sub="Point the camera at the QR on the roll's label." />
        {Detector ? (
          <>
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-sunken">
              <video ref={video} playsInline muted className={on ? "h-full w-full object-cover" : "hidden"} />
              {on && <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-accent/80" />}
              {!on && (
                <div className="absolute inset-0 grid place-items-center text-center text-sm text-fg/45">
                  <div><Camera size={32} className="mx-auto mb-2 text-fg/30" />Camera is off</div>
                </div>
              )}
            </div>
            <Button className="mt-3 w-full" variant={on ? "outline" : "primary"} onClick={() => { setError(""); setFound(null); setOn(!on); }}>
              {on ? <><CameraOff size={16} /> Stop</> : <><Camera size={16} /> Start scanning</>}
            </Button>
          </>
        ) : (
          <p className="rounded-xl bg-fg/[.04] px-4 py-3 text-sm text-fg/60">
            This browser can't read QR codes in the app. Use the phone's own camera app: the label opens the roll straight in Axis. Or type the code below.
          </p>
        )}
        {error && <p className="mt-2 text-sm text-warn">{error}</p>}
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); lookup(code); }}>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Roll code, e.g. 10001" inputMode="text" className="!py-2.5 font-display tabular-nums tracking-wider" aria-label="Roll code" />
          <Button type="submit" variant="outline" disabled={!code.trim()}>Find</Button>
        </form>
      </Card>

      {found && (found.roll ? (
        <div>
          <RollCard roll={found.roll} left={leftOf(found.roll)} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button onClick={() => setCut(found.roll!.id)} disabled={found.roll.status === "lost"}><Scissors size={16} /> Log a cut</Button>
            <Button variant="outline" onClick={() => nav(`/admin/inventory/rolls/${found.roll!.id}`)}>Open roll</Button>
          </div>
        </div>
      ) : (
        <Card tone="warn">
          <div className="flex items-center gap-3 text-sm"><SearchX size={18} className="shrink-0 text-warn" /> No roll has the code <b className="font-display">{found.code}</b>.</div>
        </Card>
      ))}
      <AnimatePresence>{cut && <LogCut key="cut" rollId={cut} onClose={() => setCut(null)} />}</AnimatePresence>
    </div>
  );
}
