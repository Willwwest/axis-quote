/*
 * Customer-facing links (proposal, invoice, document, appointment).
 * The record id is in the path; a snapshot of what the customer needs rides in the hash, so the page opens on any
 * phone even though data lives on the shop's device. When a server is added, pages read the live record by id first.
 */

export function encodeSnap(data: unknown) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(data)))).replace(/=+$/, "");
}

export function decodeSnap<T>(hash: string): T | null {
  try {
    const s = hash.replace(/^#/, "");
    return s ? (JSON.parse(decodeURIComponent(escape(atob(s)))) as T) : null;
  } catch {
    return null;
  }
}

const base = () => `${location.origin}${import.meta.env.BASE_URL}`;

export const publicUrl = (kind: "p" | "i" | "s" | "a", id: string, snap: unknown) => `${base()}${kind}/${id}#${encodeSnap(snap)}`;
export const reviewsUrl = () => `${base()}reviews`;
