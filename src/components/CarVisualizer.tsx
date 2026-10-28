import { useId } from "react";
import type { BodyType, Zone } from "../data/config";
import { tintOpacity } from "../lib/pricing";

// Hand-drawn side profiles (front facing right) in a 900x360 box, ground at y=300.

type Glass = { d: string; zone: Zone };
interface Geo {
  body: string;
  wheels: [number, number];
  glass: Glass[];
  pillars: string[];
  heads: { rear: [number, number]; driver: [number, number]; wheel: [number, number] };
  seams: string[];
  handles: [number, number][];
  mirror: [number, number];
  headlight: string;
  taillight: string;
  rocker: [number, number];
  extra?: string[];
}

const rect = (x1: number, x2: number, y1: number, y2: number) => `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2} L ${x1} ${y2} Z`;

const GEO: Record<BodyType, Geo> = {
  sedan: {
    body: "M 72 260 L 64 232 Q 58 204 76 194 L 92 178 Q 104 166 142 164 L 252 160 C 292 150 332 112 372 99 Q 404 89 452 88 L 540 89 C 582 92 614 112 652 150 L 662 156 Q 762 164 814 180 Q 840 190 842 212 L 844 238 Q 842 258 822 260 L 740 260 A 60 60 0 0 0 620 260 L 280 260 A 60 60 0 0 0 160 260 Z",
    wheels: [220, 680],
    glass: [
      { zone: "rearWindshield", d: "M 262 159 C 300 148 336 114 374 102 L 382 106 C 350 118 322 140 296 156 Z" },
      { zone: "rearSides", d: "M 302 156 C 328 138 354 118 384 107 Q 410 98 446 97 L 446 156 Z" },
      { zone: "frontSides", d: "M 462 97 L 524 98 C 556 102 584 120 614 154 L 462 156 Z" },
      { zone: "windshield", d: "M 540 89 C 582 92 614 112 652 150 L 642 152 C 610 118 578 99 536 96 Z" },
    ],
    pillars: [rect(446, 462, 96, 156)],
    heads: { rear: [392, 128], driver: [522, 120], wheel: [588, 142] },
    seams: ["M 300 160 C 296 190 290 214 286 244", "M 454 158 L 454 246", "M 640 160 C 634 190 630 216 626 240"],
    handles: [[418, 176], [596, 174]],
    mirror: [606, 152],
    headlight: "M 800 178 Q 828 184 838 200 L 812 202 Q 796 196 790 184 Z",
    taillight: "M 66 214 Q 70 196 88 182 L 102 184 Q 90 198 86 214 Z",
    rocker: [286, 616],
  },
  coupe: {
    body: "M 72 260 L 64 232 Q 58 206 78 196 L 96 182 Q 110 170 150 168 L 236 164 C 290 150 350 108 402 96 Q 430 90 468 90 L 520 92 C 566 96 606 118 648 152 L 660 158 Q 762 166 814 182 Q 840 192 842 212 L 844 238 Q 842 258 822 260 L 740 260 A 60 60 0 0 0 620 260 L 280 260 A 60 60 0 0 0 160 260 Z",
    wheels: [220, 680],
    glass: [
      { zone: "rearWindshield", d: "M 246 163 C 296 148 352 110 404 99 L 410 104 C 362 116 314 142 276 161 Z" },
      { zone: "rearSides", d: "M 318 158 C 344 138 372 118 400 108 L 408 106 L 408 158 Z" },
      { zone: "frontSides", d: "M 420 104 Q 440 99 470 98 L 508 99 C 548 104 584 124 612 156 L 420 158 Z" },
      { zone: "windshield", d: "M 520 92 C 566 96 606 118 648 152 L 636 154 C 600 122 562 101 516 98 Z" },
    ],
    pillars: [rect(408, 420, 104, 158)],
    heads: { rear: [376, 136], driver: [500, 122], wheel: [584, 144] },
    seams: ["M 414 160 C 412 190 414 220 420 246", "M 640 162 C 634 190 630 218 626 240"],
    handles: [[446, 178]],
    mirror: [602, 154],
    headlight: "M 800 180 Q 828 186 838 202 L 812 204 Q 796 198 790 186 Z",
    taillight: "M 66 216 Q 72 198 92 186 L 106 188 Q 92 200 88 216 Z",
    rocker: [286, 616],
  },
  suv: {
    body: "M 64 262 L 58 226 Q 56 200 66 186 L 70 120 Q 74 92 100 88 L 160 84 Q 300 76 520 78 C 560 80 600 100 640 140 L 660 152 Q 770 160 820 178 Q 844 188 846 214 L 848 240 Q 846 260 826 262 L 750 262 A 60 60 0 0 0 630 262 L 270 262 A 60 60 0 0 0 150 262 Z",
    wheels: [210, 690],
    glass: [
      { zone: "rearWindshield", d: "M 72 140 L 76 106 Q 80 94 98 92 L 104 98 Q 88 100 86 110 L 84 140 Z" },
      { zone: "rearSides", d: "M 98 140 L 100 110 Q 102 100 114 99 L 196 95 L 196 140 Z" },
      { zone: "rearSides", d: "M 210 94 L 360 90 L 360 140 L 210 140 Z" },
      { zone: "frontSides", d: "M 376 90 L 506 88 C 542 92 576 110 606 140 L 376 142 Z" },
      { zone: "windshield", d: "M 520 78 C 560 80 600 100 640 140 L 628 142 C 592 110 556 92 516 86 Z" },
    ],
    pillars: [rect(196, 210, 94, 140), rect(360, 376, 90, 142)],
    heads: { rear: [292, 114], driver: [456, 108], wheel: [566, 128] },
    seams: ["M 204 144 L 204 236", "M 368 144 L 368 248", "M 640 146 C 636 180 632 214 630 236"],
    handles: [[330, 162], [516, 160]],
    mirror: [592, 140],
    headlight: "M 806 176 Q 834 182 842 198 L 814 200 Q 800 194 794 182 Z",
    taillight: "M 60 200 L 64 158 L 78 156 L 74 200 Z",
    rocker: [276, 626],
    extra: ["M 120 82 L 480 75"],
  },
  truck: {
    body: "M 52 262 L 48 228 L 50 150 L 300 150 L 304 92 Q 306 80 320 80 L 520 80 C 556 82 596 102 632 142 L 652 152 Q 770 158 822 176 Q 846 186 848 214 L 850 240 Q 848 260 828 262 L 750 262 A 60 60 0 0 0 630 262 L 260 262 A 60 60 0 0 0 140 262 Z",
    wheels: [200, 690],
    glass: [
      { zone: "rearWindshield", d: "M 306 140 L 308 98 Q 310 88 320 87 L 324 92 Q 316 94 315 102 L 313 140 Z" },
      { zone: "rearSides", d: "M 322 140 L 322 100 Q 324 92 334 91 L 420 90 L 420 140 Z" },
      { zone: "frontSides", d: "M 436 90 L 508 88 C 544 92 578 112 606 140 L 436 142 Z" },
      { zone: "windshield", d: "M 520 80 C 556 82 596 102 632 142 L 620 143 C 588 110 554 92 514 88 Z" },
    ],
    pillars: [rect(420, 436, 90, 142)],
    heads: { rear: [376, 114], driver: [480, 108], wheel: [568, 128] },
    seams: ["M 300 150 L 300 252", "M 428 144 L 428 250", "M 640 148 C 636 180 632 214 630 236", "M 58 156 L 58 252"],
    handles: [[396, 162], [540, 160]],
    mirror: [592, 140],
    headlight: "M 808 174 Q 836 180 844 196 L 816 198 Q 802 192 796 180 Z",
    taillight: "M 48 160 L 62 160 L 62 198 L 48 198 Z",
    rocker: [266, 626],
    extra: ["M 52 151 L 298 151"],
  },
  minivan: {
    body: "M 60 262 L 54 226 Q 52 196 62 180 L 70 108 Q 76 84 106 82 L 470 78 C 540 80 600 104 660 148 L 676 156 Q 772 166 820 182 Q 844 192 846 216 L 848 240 Q 846 260 826 262 L 750 262 A 60 60 0 0 0 630 262 L 270 262 A 60 60 0 0 0 150 262 Z",
    wheels: [210, 690],
    glass: [
      { zone: "rearWindshield", d: "M 72 140 L 76 104 Q 80 90 104 88 L 108 94 Q 90 96 86 106 L 82 140 Z" },
      { zone: "rearSides", d: "M 94 140 L 98 104 Q 100 96 114 95 L 220 92 L 220 140 Z" },
      { zone: "rearSides", d: "M 234 92 L 392 89 L 392 140 L 234 140 Z" },
      { zone: "frontSides", d: "M 406 89 L 478 88 C 528 92 576 112 620 144 L 406 144 Z" },
      { zone: "windshield", d: "M 470 78 C 540 80 600 104 660 148 L 646 150 C 594 112 540 92 486 86 Z" },
    ],
    pillars: [rect(220, 234, 92, 140), rect(392, 406, 89, 144)],
    heads: { rear: [312, 112], driver: [470, 110], wheel: [576, 132] },
    seams: ["M 228 144 L 226 248", "M 400 146 L 398 250", "M 650 154 C 644 186 640 216 638 238"],
    handles: [[252, 164], [430, 162]],
    mirror: [604, 144],
    headlight: "M 806 180 Q 834 186 842 202 L 814 204 Q 800 198 794 186 Z",
    taillight: "M 58 196 L 64 150 L 78 148 L 74 196 Z",
    rocker: [276, 626],
    extra: ["M 236 146 L 396 146"],
  },
};

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f);
  return `rgb(${r},${g},${b})`;
}

const FACTORY_VLT = 82;

export interface CarProps {
  body: BodyType;
  paint: string;
  zones: Zone[];
  frontVlt: number;
  rearVlt: number;
  /** Highlight a zone in brand red (used by the window picker). */
  focus?: Zone | null;
  stage?: boolean;
  className?: string;
}

export function CarVisualizer({ body, paint, zones, frontVlt, rearVlt, focus, stage = true, className }: CarProps) {
  const uid = useId().replace(/:/g, "");
  const g = GEO[body];
  const vltFor = (z: Zone) => {
    if (!zones.includes(z)) return FACTORY_VLT;
    if (z === "frontSides") return frontVlt;
    if (z === "windshield") return 70;
    return rearVlt;
  };
  const n = parseInt(paint.slice(1), 16);
  const light = ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 > 140;

  return (
    <svg viewBox="0 0 900 340" className={className} role="img" aria-label="Your vehicle with the selected tint">
      <defs>
        <linearGradient id={`paint${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(paint, 0.35)} />
          <stop offset="0.38" stopColor={shade(paint, 0.08)} />
          <stop offset="0.55" stopColor={paint} />
          <stop offset="1" stopColor={shade(paint, -0.55)} />
        </linearGradient>
        <linearGradient id={`sheen${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0.04" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.75" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`cabin${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fa3b8" />
          <stop offset="1" stopColor="#3b3f47" />
        </linearGradient>
        <radialGradient id={`rim${uid}`} cx="0.45" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#d9dce0" />
          <stop offset="0.6" stopColor="#6f747b" />
          <stop offset="1" stopColor="#2a2c30" />
        </radialGradient>
        <radialGradient id={`shadow${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.85" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`beam${uid}`} cx="0.5" cy="0" r="1">
          <stop offset="0" stopColor="rgb(var(--c-accent-bright))" stopOpacity="0.32" />
          <stop offset="0.6" stopColor="rgb(var(--c-accent))" stopOpacity="0.05" />
          <stop offset="1" stopColor="rgb(var(--c-accent))" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`floor${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1b1f" />
          <stop offset="1" stopColor="#0b0b0c" />
        </linearGradient>
        <clipPath id={`glass${uid}`}>
          {g.glass.map((gl, i) => <path key={i} d={gl.d} />)}
        </clipPath>
        <filter id={`glow${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id={`soft${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="28" />
        </filter>
      </defs>

      {stage && (
        <g>
          <path d="M 450 -60 L 120 320 L 780 320 Z" fill={`url(#beam${uid})`} filter={`url(#soft${uid})`} />
          <rect x="0" y="292" width="900" height="48" fill={`url(#floor${uid})`} />
          <ellipse cx="450" cy="300" rx="380" ry="10" fill="rgb(var(--c-accent))" opacity="0.08" filter={`url(#glow${uid})`} />
        </g>
      )}
      <ellipse cx="452" cy="298" rx="400" ry="16" fill={`url(#shadow${uid})`} />

      {/* Body */}
      <path d={g.body} fill={`url(#paint${uid})`} stroke={shade(paint, -0.6)} strokeWidth="1.5" />
      <path d={`M ${g.rocker[0]} 248 L ${g.rocker[1]} 248`} stroke="#000" strokeOpacity="0.35" strokeWidth="10" strokeLinecap="round" />
      {g.extra?.map((d, i) => <path key={i} d={d} stroke="#0a0a0b" strokeWidth="4" strokeLinecap="round" fill="none" />)}
      {g.seams.map((d, i) => <path key={i} d={d} stroke="#000" strokeOpacity="0.45" strokeWidth="1.4" fill="none" />)}
      <path d="M 140 174 Q 450 160 820 184" stroke="#fff" strokeOpacity={light ? 0.5 : 0.22} strokeWidth="1.5" fill="none" />
      {g.handles.map(([x, y], i) => <rect key={i} x={x - 13} y={y - 3} width="26" height="6" rx="3" fill={shade(paint, -0.4)} stroke="#fff" strokeOpacity="0.25" />)}

      {/* Lights */}
      <path d={g.headlight} fill="#f2f6ff" />
      <path d={g.headlight} fill="#cfe2ff" opacity="0.7" filter={`url(#glow${uid})`} />
      <path d={g.taillight} fill="rgb(var(--c-accent-bright))" />
      <path d={g.taillight} fill="rgb(var(--c-accent-bright))" opacity="0.6" filter={`url(#glow${uid})`} />

      {/* Cabin seen through the glass */}
      <g clipPath={`url(#glass${uid})`}>
        <rect x="0" y="60" width="900" height="120" fill={`url(#cabin${uid})`} />
        <Head at={g.heads.rear} scale={0.9} />
        <Head at={g.heads.driver} scale={1} />
        <ellipse cx={g.heads.wheel[0]} cy={g.heads.wheel[1]} rx="7" ry="20" fill="none" stroke="#1d1f24" strokeWidth="5" transform={`rotate(-18 ${g.heads.wheel[0]} ${g.heads.wheel[1]})`} />
      </g>

      {/* Film */}
      {g.glass.map((gl, i) => {
        const vlt = vltFor(gl.zone);
        const on = focus === gl.zone;
        return (
          <g key={i}>
            <path
              d={gl.d}
              fill="#050607"
              style={{ transition: "fill-opacity 450ms ease" }}
              fillOpacity={tintOpacity(vlt)}
            />
            <path d={gl.d} fill={`url(#sheen${uid})`} />
            {on && <path d={gl.d} fill="rgb(var(--c-accent))" fillOpacity="0.35" stroke="rgb(var(--c-accent-bright))" strokeWidth="2" />}
          </g>
        );
      })}
      {g.pillars.map((d, i) => <path key={i} d={d} fill="#0a0a0b" />)}
      <Mirror at={g.mirror} paint={paint} />

      {g.wheels.map((cx) => <Wheel key={cx} cx={cx} uid={uid} />)}
    </svg>
  );
}

function Head({ at: [x, y], scale }: { at: [number, number]; scale: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fill="#262930">
      <rect x="-20" y="-6" width="30" height="60" rx="10" fill="#1d1f24" />
      <circle cx="4" cy="-4" r="15" />
      <path d="M -22 40 Q -18 14 4 12 Q 28 14 32 40 Z" />
    </g>
  );
}

function Mirror({ at: [x, y], paint }: { at: [number, number]; paint: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M -10 -2 L 14 -6 Q 26 -4 24 10 L 0 14 Q -12 12 -10 -2 Z" fill={paint} stroke="#000" strokeOpacity="0.5" />
      <path d="M -8 4 L 22 0" stroke="#000" strokeOpacity="0.35" />
    </g>
  );
}

function Wheel({ cx, uid }: { cx: number; uid: string }) {
  const cy = 254;
  return (
    <g>
      <circle cx={cx} cy={cy} r="46" fill="#0d0d0e" />
      <circle cx={cx} cy={cy} r="40" fill="none" stroke="#1d1d20" strokeWidth="3" />
      <circle cx={cx} cy={cy} r="30" fill={`url(#rim${uid})`} />
      <path d={`M ${cx - 20} ${cy - 18} A 27 27 0 0 1 ${cx + 6} ${cy - 26}`} stroke="rgb(var(--c-accent))" strokeWidth="7" fill="none" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <rect key={a} x={cx - 3} y={cy - 29} width="6" height="22" rx="2" fill="#2b2d31" transform={`rotate(${a} ${cx} ${cy})`} />
      ))}
      <circle cx={cx} cy={cy} r="7" fill="#17181a" stroke="#888" strokeWidth="1" />
    </g>
  );
}

/* ---------- Driver's-seat view ---------- */

export function DriverView({ vlt, className }: { vlt: number; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const window = "M 70 262 L 78 74 Q 82 44 120 42 L 600 36 C 700 40 780 130 830 262 Z";
  const tint = tintOpacity(vlt) * 0.82;
  return (
    <svg viewBox="0 0 900 340" className={className} role="img" aria-label={`View from the driver's seat through ${vlt}% tint`}>
      <defs>
        <linearGradient id={`sky${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f6fd0" />
          <stop offset="0.55" stopColor="#8ab8e8" />
          <stop offset="0.85" stopColor="#f6c38c" />
        </linearGradient>
        <radialGradient id={`sun${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.15" stopColor="#fff8e0" />
          <stop offset="0.5" stopColor="#ffd98a" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`door${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2b30" />
          <stop offset="1" stopColor="#0c0c0e" />
        </linearGradient>
        <clipPath id={`win${uid}`}><path d={window} /></clipPath>
      </defs>
      <rect width="900" height="340" fill={`url(#door${uid})`} />
      <g clipPath={`url(#win${uid})`}>
        <rect width="900" height="300" fill={`url(#sky${uid})`} />
        <circle cx="680" cy="96" r="120" fill={`url(#sun${uid})`} />
        <path d="M 0 214 L 80 178 L 150 196 L 240 150 L 300 168 L 360 140 L 430 176 L 520 158 L 600 186 L 700 162 L 800 190 L 900 172 L 900 300 L 0 300 Z" fill="#8a7fa6" opacity="0.8" />
        {/* Granite butte */}
        <path d="M 180 230 Q 210 168 250 150 Q 290 138 318 160 Q 350 186 372 230 Z" fill="#7b5a43" />
        <path d="M 0 236 Q 200 214 420 228 T 900 222 L 900 300 L 0 300 Z" fill="#b98a5e" />
        <path d="M 0 252 Q 300 240 900 248 L 900 300 L 0 300 Z" fill="#9d7048" />
        <g fill="#2f4a2a">
          <path d="M 560 252 L 560 196 Q 560 188 568 188 Q 576 188 576 196 L 576 252 Z" />
          <path d="M 560 222 L 546 222 L 546 204 Q 546 198 552 198 Q 558 198 558 204 L 558 214 L 560 214 Z" />
          <path d="M 576 214 L 588 214 L 588 196 Q 588 190 594 190 Q 600 190 600 196 L 600 222 L 576 222 Z" />
          <ellipse cx="120" cy="246" rx="34" ry="14" />
          <ellipse cx="760" cy="248" rx="44" ry="16" />
        </g>
        <rect width="900" height="300" fill="#050607" opacity={tint} style={{ transition: "opacity 450ms ease" }} />
        <path d="M 120 42 L 300 42 L 120 262 L 70 262 Z" fill="#fff" opacity="0.05" />
      </g>
      <path d={window} fill="none" stroke="#050506" strokeWidth="10" />
      {/* Door panel */}
      <path d="M 0 262 L 900 262 L 900 340 L 0 340 Z" fill={`url(#door${uid})`} />
      <path d="M 40 262 L 860 262" stroke="#3a3b41" strokeWidth="3" />
      <rect x="560" y="286" width="150" height="16" rx="8" fill="#151518" stroke="#3a3b41" />
      <rect x="610" y="291" width="50" height="6" rx="3" fill="#7d8088" />
      <rect x="150" y="282" width="120" height="40" rx="10" fill="#141417" />
      {Array.from({ length: 24 }, (_, i) => (
        <circle key={i} cx={162 + (i % 8) * 14} cy={292 + Math.floor(i / 8) * 10} r="2" fill="#2a2b30" />
      ))}
      <path d="M 830 262 C 850 230 870 200 900 180 L 900 262 Z" fill="#0b0b0d" />
    </svg>
  );
}
