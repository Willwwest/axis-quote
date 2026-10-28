import type { Zone } from "../data/config";
import { cx } from "./ui";

// Top-down car outline; each glass zone is clickable.

const SHAPES: Record<Zone, string[]> = {
  visor: ["M 56 116 Q 110 98 164 116 L 162 125 Q 110 108 58 125 Z"],
  windshield: ["M 58 128 Q 110 111 162 128 L 154 160 Q 110 150 66 160 Z"],
  frontSides: ["M 38 166 L 49 162 L 49 222 L 38 225 Z", "M 182 166 L 171 162 L 171 222 L 182 225 Z"],
  rearSides: ["M 38 233 L 49 230 L 49 290 L 40 288 Z", "M 182 233 L 171 230 L 171 290 L 180 288 Z"],
  sunroof: ["M 84 182 h 52 a 8 8 0 0 1 8 8 v 46 a 8 8 0 0 1 -8 8 h -52 a 8 8 0 0 1 -8 -8 v -46 a 8 8 0 0 1 8 -8 Z"],
  rearWindshield: ["M 64 300 Q 110 309 156 300 L 164 334 Q 110 346 56 334 Z"],
};

export function WindowPicker({
  zones, onToggle, hover, onHover, disabled = [],
}: {
  zones: Zone[];
  onToggle: (z: Zone) => void;
  hover: Zone | null;
  onHover: (z: Zone | null) => void;
  disabled?: Zone[];
}) {
  return (
    <svg viewBox="0 0 220 400" className="h-full w-full" role="group" aria-label="Choose windows">
      <defs>
        <linearGradient id="wp-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1a1a1e" />
          <stop offset="0.5" stopColor="#2a2a30" />
          <stop offset="1" stopColor="#1a1a1e" />
        </linearGradient>
      </defs>
      <path
        d="M 110 22 C 172 22 196 44 198 92 L 200 330 C 200 370 172 384 110 384 C 48 384 20 370 20 330 L 22 92 C 24 44 48 22 110 22 Z"
        fill="url(#wp-body)" stroke="rgba(255,255,255,.14)" strokeWidth="1.5"
      />
      <path d="M 60 162 Q 110 152 160 162 L 162 298 Q 110 306 58 298 Z" fill="#141417" stroke="rgba(255,255,255,.06)" />
      <path d="M 30 70 Q 40 38 72 30 M 190 70 Q 180 38 148 30" stroke="rgba(255,255,255,.18)" fill="none" />
      {/* Mirrors */}
      <path d="M 22 150 L 8 146 Q 4 154 8 160 L 22 158 Z M 198 150 L 212 146 Q 216 154 212 160 L 198 158 Z" fill="#2a2a30" />
      {/* Headlights / taillights */}
      <path d="M 36 40 Q 50 30 70 28 L 64 38 Q 48 42 40 50 Z M 184 40 Q 170 30 150 28 L 156 38 Q 172 42 180 50 Z" fill="#dfe8ff" opacity=".8" />
      <path d="M 28 360 Q 40 376 70 380 L 70 372 Q 44 368 34 352 Z M 192 360 Q 180 376 150 380 L 150 372 Q 176 368 186 352 Z" fill="#ff2a2a" />

      {(Object.keys(SHAPES) as Zone[]).map((z) => {
        const on = zones.includes(z);
        const off = disabled.includes(z);
        return (
          <g
            key={z}
            onClick={() => !off && onToggle(z)}
            onMouseEnter={() => onHover(z)}
            onMouseLeave={() => onHover(null)}
            className={cx(!off && "cursor-pointer")}
            opacity={off ? 0.25 : 1}
          >
            {SHAPES[z].map((d, i) => (
              <path
                key={i}
                d={d}
                fill={on ? "#da281b" : "#3a3d46"}
                fillOpacity={on ? 0.95 : 0.7}
                stroke={hover === z ? "#fff" : on ? "#ff5a4f" : "rgba(255,255,255,.25)"}
                strokeWidth={hover === z ? 2 : 1}
                style={{ transition: "all 200ms ease", filter: on ? "drop-shadow(0 0 6px rgba(255,42,42,.7))" : undefined }}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
