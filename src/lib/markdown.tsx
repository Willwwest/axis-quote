import type { ReactNode } from "react";
import { cx } from "../components/ui";

/*
 * Tiny, safe markdown for proposal descriptions, notes and documents: blank-line paragraphs, # headings, - bullets,
 * 1. numbered lists, **bold** and _italic_. Everything renders as React elements, so typed HTML stays plain text.
 */

export const MD_HINT = "**bold** · _italic_ · # heading · - list";

const isWord = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);

/** **bold** and _italic_ (underscores inside words, like file_name, are left alone). */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|_(.+?)_/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[2] != null && (isWord(text[m.index - 1]) || isWord(text[m.index + m[0].length]))) {
      re.lastIndex = m.index + 1;
      continue;
    }
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(m[1] != null
      ? <strong key={m.index} className="font-semibold text-fg">{inline(m[1])}</strong>
      : <em key={m.index}>{inline(m[2])}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { t: "h"; level: number; text: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "p"; lines: string[] };

function parse(src: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) blocks.push({ t: "p", lines: para }); para = []; };
  for (const raw of src.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    const ul = line.match(/^[-*•]\s+(.*)$/);
    const ol = line.match(/^\d+[.)]\s+(.*)$/);
    if (!line) flush();
    else if (h) { flush(); blocks.push({ t: "h", level: h[1].length, text: h[2] }); }
    else if (ul || ol) {
      flush();
      const t = ul ? "ul" : "ol";
      const prev = blocks[blocks.length - 1];
      if (prev && prev.t === t) prev.items.push((ul ?? ol)![1]);
      else blocks.push({ t, items: [(ul ?? ol)![1]] });
    } else para.push(line);
  }
  flush();
  return blocks;
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = parse(text ?? "");
  if (!blocks.length) return null;
  return (
    <div className={cx("space-y-3 text-sm leading-relaxed text-fg/75", className)}>
      {blocks.map((b, i) => {
        if (b.t === "h") {
          const cls = b.level === 1 ? "text-lg" : b.level === 2 ? "text-base" : "text-sm uppercase tracking-wider text-fg/60";
          return <p key={i} role="heading" aria-level={b.level + 1} className={cx("font-display font-semibold text-fg", cls, i > 0 && "pt-1")}>{inline(b.text)}</p>;
        }
        if (b.t === "ul") return <ul key={i} className="list-disc space-y-1 pl-5 marker:text-accent-fg">{b.items.map((it, n) => <li key={n}>{inline(it)}</li>)}</ul>;
        if (b.t === "ol") return <ol key={i} className="list-decimal space-y-1 pl-5 marker:text-fg/45">{b.items.map((it, n) => <li key={n}>{inline(it)}</li>)}</ol>;
        return <p key={i}>{b.lines.flatMap((l, n) => (n ? [<br key={`b${n}`} />, ...inline(l)] : inline(l)))}</p>;
      })}
    </div>
  );
}

/** Plain text for one-line previews. */
export const stripMarkdown = (s: string) =>
  s.replace(/^#{1,3}\s+/gm, "").replace(/^[-*•]\s+/gm, "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/(^|\W)_(.+?)_(?=\W|$)/g, "$1$2").replace(/\s+/g, " ").trim();
