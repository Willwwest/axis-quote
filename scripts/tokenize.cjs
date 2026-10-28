// Codemod: raw Tailwind palette classes -> semantic design tokens (src/styles/tokens.css).
// Safe to re-run; also used as a lint: `node scripts/tokenize.cjs --check` exits 1 if anything off-token remains.
const fs = require("fs");
const path = require("path");

const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(f)) files.push(p);
  }
})("src");

const rules = [
  // accent family (old axis-* aliases)
  [/\btext-axis-bright\b/g, "text-accent-fg"],
  [/\b(from|to|via|bg|border|ring|shadow|fill|stroke)-axis-bright\b/g, "$1-accent-bright"],
  [/\b(from|to|via|bg|border|ring|text|fill|stroke|shadow|outline)-axis-red\b/g, "$1-accent"],
  [/\b(from|to|via|bg|border|text|fill)-axis-deep\b/g, "$1-accent-deep"],
  [/\bbg-axis-black\b/g, "bg-bg"], [/\btext-axis-black\b/g, "text-bg"], [/\b(from|to|via|border)-axis-black\b/g, "$1-bg"],
  [/\bbg-axis-ink\b/g, "bg-sunken"], [/\bbg-axis-panel\b/g, "bg-surface"],
  [/\bborder-axis-line\b/g, "border-fg/10"], [/\btext-axis-mute\b/g, "text-fg/55"],
  // neutrals: white is the foreground, black is the background / scrim
  [/\b(text|bg|border|from|to|via|divide|ring|placeholder|fill|stroke|outline|decoration)-white\b/g, "$1-fg"],
  [/\bbg-black\/(\d+)\b/g, "bg-scrim/$1"], [/\btext-black\b/g, "text-bg"], [/\bbg-black\b/g, "bg-bg"],
  // status colors
  [/\b(text|bg|border|from|to|ring|fill)-(emerald|green)-\d{3}\b/g, "$1-success"],
  [/\b(text|bg|border|from|to|ring|fill)-(amber|yellow)-\d{3}\b/g, "$1-warn"],
  [/\b(text|bg|border|from|to|ring|fill)-(sky|blue)-\d{3}\b/g, "$1-info"],
  [/\b(text|bg|border|from|to|ring|fill)-(red|rose)-\d{3}\b/g, "$1-danger"],
  // brand hexes used inline
  [/#da281b/gi, "rgb(var(--c-accent))"], [/#ff2a2a/gi, "rgb(var(--c-accent-bright))"], [/#b30000/gi, "rgb(var(--c-accent-deep))"],
  [/rgba\(218,\s*40,\s*27,\s*([.\d]+)\)/g, "rgb(var(--c-accent)/$1)"],
  [/rgba\(255,\s*42,\s*42,\s*([.\d]+)\)/g, "rgb(var(--c-accent-bright)/$1)"],
];

// Paint swatches and illustration palettes are product data, not UI chrome.
const EXEMPT = /(config.ts|samples.ts|context.ts|Visualizer.tsx|WindowPicker.tsx|VehicleSteps.tsx|CommonSteps.tsx)$/;
const check = process.argv.includes("--check");
let hits = 0;
for (const f of files) {
  if (f.endsWith("config.ts")) continue;
  const src = fs.readFileSync(f, "utf8");
  let out = src;
  for (const [re, to] of rules) out = out.replace(re, to);
  if (out === src) continue;
  hits++;
  if (check) console.log("off-token:", f);
  else fs.writeFileSync(f, out);
}
if (check) {
  for (const f of files) {
    if (EXEMPT.test(f)) continue;
    const m = fs.readFileSync(f, "utf8").match(/#[0-9a-fA-F]{6}\b/g);
    if (m) { hits++; console.log("raw hex:", f, [...new Set(m)].join(" ")); }
  }
}
console.log(check ? `${hits} problem file(s)` : `files changed: ${hits}`);
process.exit(check && hits ? 1 : 0);
