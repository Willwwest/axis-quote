import { useId } from "react";
import { tintOpacity } from "../lib/pricing";

// A stucco wall with a picture window, seen from the street or from the living room.

function Landscape({ uid }: { uid: string }) {
  return (
    <g>
      <rect width="900" height="360" fill={`url(#sky${uid})`} />
      <circle cx="700" cy="90" r="110" fill={`url(#sun${uid})`} />
      <path d="M 0 220 L 120 170 L 210 196 L 330 140 L 420 180 L 520 150 L 640 190 L 760 160 L 900 190 L 900 360 L 0 360 Z" fill="#8a7fa6" opacity=".85" />
      <path d="M 0 250 Q 250 228 500 244 T 900 238 L 900 360 L 0 360 Z" fill="#b98a5e" />
      <g fill="#2f4a2a">
        <path d="M 230 260 L 250 190 L 270 260 Z" /><path d="M 220 270 L 250 205 L 280 270 Z" />
        <ellipse cx="620" cy="262" rx="60" ry="20" />
        <path d="M 700 270 L 716 214 L 732 270 Z" />
      </g>
    </g>
  );
}

export function HomeVisualizer({
  vlt, reflect, view, className,
}: { vlt: number; reflect: number; view: "outside" | "inside"; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const win = { x: 230, y: 70, w: 440, h: 220 };
  const tint = tintOpacity(vlt);
  const t = { transition: "opacity 450ms ease" };

  const defs = (
    <defs>
      <linearGradient id={`sky${uid}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2f6fd0" />
        <stop offset="0.6" stopColor="#8ab8e8" />
        <stop offset="0.9" stopColor="#f6c38c" />
      </linearGradient>
      <radialGradient id={`sun${uid}`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#fff" />
        <stop offset="0.2" stopColor="#fff6da" />
        <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`stucco${uid}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#a8916f" />
        <stop offset="0.18" stopColor="#d9c4a3" />
        <stop offset="1" stopColor="#c7ad86" />
      </linearGradient>
      <radialGradient id={`lamp${uid}`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ffd894" stopOpacity=".9" />
        <stop offset="1" stopColor="#ffd894" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`room${uid}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#5a4e44" />
        <stop offset="1" stopColor="#2b241f" />
      </linearGradient>
      <linearGradient id={`wall${uid}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ece6dc" />
        <stop offset="1" stopColor="#cfc6b8" />
      </linearGradient>
      <clipPath id={`glass${uid}`}><rect x={win.x} y={win.y} width={win.w} height={win.h} /></clipPath>
    </defs>
  );

  const mullions = (color: string) => (
    <g>
      <rect x={win.x - 10} y={win.y - 10} width={win.w + 20} height={win.h + 20} fill="none" stroke={color} strokeWidth="14" />
      <rect x={win.x + win.w / 2 - 4} y={win.y} width="8" height={win.h} fill={color} />
    </g>
  );

  if (view === "inside") {
    return (
      <svg viewBox="0 0 900 360" className={className} role="img" aria-label={`Looking out through ${vlt}% film`}>
        {defs}
        <rect width="900" height="360" fill={`url(#wall${uid})`} />
        <g clipPath={`url(#glass${uid})`}>
          <g transform={`translate(${win.x - 120} ${win.y - 40}) scale(.8)`}><Landscape uid={uid} /></g>
          <rect x={win.x} y={win.y} width={win.w} height={win.h} fill="#06080a" opacity={tint * 0.78} style={t} />
          <rect x={win.x} y={win.y} width={win.w} height={win.h} fill="#efe6d6" opacity={reflect / 400} style={t} />
        </g>
        {mullions("#f7f5f0")}
        <rect x={win.x - 24} y={win.y + win.h + 8} width={win.w + 48} height="12" rx="3" fill="#e7e1d6" />
        {/* Sunlight pool on the floor shrinks as the film darkens */}
        <path d="M 260 360 L 300 312 L 650 312 L 720 360 Z" fill="#ffe3a8" opacity={0.45 * (1 - tint)} style={t} />
        <path d="M 60 360 L 60 250 Q 60 230 80 230 L 190 230 Q 210 230 210 250 L 210 360 Z" fill="#7a6a5a" />
        <path d="M 760 360 L 770 270 L 800 270 L 810 360 Z" fill="#4d5b3b" />
        <ellipse cx="785" cy="250" rx="34" ry="30" fill="#5e7a45" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 900 360" className={className} role="img" aria-label={`Your window from the street with ${vlt}% film`}>
      {defs}
      <rect width="900" height="360" fill={`url(#stucco${uid})`} />
      <rect width="900" height="26" fill="#6b4f3a" />
      <rect y="26" width="900" height="30" fill="#000" opacity=".12" />
      <g clipPath={`url(#glass${uid})`}>
        <rect x={win.x} y={win.y} width={win.w} height={win.h} fill={`url(#room${uid})`} />
        <circle cx="330" cy="150" r="80" fill={`url(#lamp${uid})`} />
        <rect x="324" y="150" width="12" height="110" fill="#2a2420" />
        <path d="M 304 150 L 356 150 L 346 120 L 314 120 Z" fill="#f3d9a8" />
        <path d="M 420 290 L 420 230 Q 420 214 436 214 L 610 214 Q 626 214 626 230 L 626 290 Z" fill="#6c5646" />
        <ellipse cx="560" cy="170" rx="36" ry="44" fill="#4f6b3d" />
        <rect x="550" y="200" width="20" height="60" fill="#3c2f26" />
        <rect x={win.x} y={win.y} width={win.w} height={win.h} fill="#050607" opacity={tint} style={t} />
        {/* Exterior reflection of the sky and yard, strongest on dual-reflective film */}
        <g opacity={0.08 + (reflect / 100) * 1.1} style={t}>
          <g transform={`translate(${win.x + win.w} ${win.y - 20}) scale(-.75 .75)`}><Landscape uid={uid} /></g>
        </g>
        <path d={`M ${win.x} ${win.y} L ${win.x + 140} ${win.y} L ${win.x + 40} ${win.y + win.h} L ${win.x} ${win.y + win.h} Z`} fill="#fff" opacity=".08" />
      </g>
      {mullions("#3b2f26")}
      <rect x={win.x - 26} y={win.y + win.h + 10} width={win.w + 52} height="14" fill="#b39a76" />
      <g fill="#5b7a4a">
        <path d="M 120 360 L 140 280 L 150 360 Z" /><path d="M 130 360 L 100 290 L 150 360 Z" /><path d="M 140 360 L 180 296 L 160 360 Z" />
        <path d="M 760 360 L 780 270 L 792 360 Z" /><path d="M 770 360 L 740 286 L 792 360 Z" /><path d="M 780 360 L 826 290 L 800 360 Z" />
      </g>
    </svg>
  );
}
