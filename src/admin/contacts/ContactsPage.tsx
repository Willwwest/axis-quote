import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Download, GitMerge, Tag, Upload, UserPlus, Users } from "lucide-react";
import { Avatar, Badge, Button, EmptyState, PageHeader, SearchInput, Segmented, Select, Table, Td } from "../../components/ui";
import { digits, downloadFile, money, relative, today } from "../../lib/format";
import { ensureContact } from "../../lib/project";
import { contacts, leads, messages, notes, payments } from "../../lib/store";
import { AddContactSheet } from "./ContactForm";
import { contactStats, displayName, duplicateGroups, exportContacts, uniq } from "./lib";
import { ImportSheet, MergeSheet, TagsSheet } from "./tools";

type Sort = "recent" | "name" | "value";
type Panel = "add" | "import" | "tags" | "merge" | null;

export default function ContactsPage() {
  const nav = useNavigate();
  const all = contacts.use();
  const jobs = leads.use();
  const pays = payments.use();
  const msgs = messages.use();
  const ns = notes.use();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [panel, setPanel] = useState<Panel>(null);
  const tag = params.get("tag") ?? "";
  const setTag = (t: string) => setParams(t ? { tag: t } : {});

  // One-time backfill: every job gets a contact record (quote-app leads arrive without one).
  useEffect(() => {
    leads.all().filter((l) => !l.contactId).forEach(ensureContact);
  }, []);

  const stats = useMemo(() => contactStats(all, jobs, pays, msgs, ns), [all, jobs, pays, msgs, ns]);
  const tags = useMemo(() => uniq(all.flatMap((c) => c.tags)).sort(), [all]);
  const dupes = useMemo(() => duplicateGroups(all).length, [all]);
  const list = useMemo(() => {
    const n = q.trim().toLowerCase(), d = digits(q);
    const hit = (c: (typeof all)[number]) =>
      !n || [c.name, c.company, c.email, c.address, c.city, ...c.tags].some((v) => v?.toLowerCase().includes(n)) || (d.length >= 3 && [c.phone, c.workPhone].some((p) => p && digits(p).includes(d)));
    const out = all.filter((c) => (!tag || c.tags.includes(tag)) && hit(c));
    const s = (id: string) => stats.get(id)!;
    return out.sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "value" ? s(b.id).value - s(a.id).value : s(b.id).last.localeCompare(s(a.id).last));
  }, [all, q, tag, sort, stats]);

  return (
    <div>
      <PageHeader title="Contacts" sub={`${all.length} people and businesses · every job links to one`}
        actions={<>
          <Button variant="outline" size="sm" onClick={() => setPanel("import")}><Upload size={15} /> Import</Button>
          <Button variant="outline" size="sm" onClick={() => downloadFile(`axis-contacts-${today()}.csv`, exportContacts(list, stats), "text/csv")} disabled={!list.length}><Download size={15} /> Export</Button>
          <Button variant="outline" size="sm" onClick={() => setPanel("tags")}><Tag size={15} /> Tags</Button>
          <Button variant="outline" size="sm" onClick={() => setPanel("merge")}><GitMerge size={15} /> Duplicates{dupes > 0 && <Badge tone="warn">{dupes}</Badge>}</Button>
          <Button size="sm" onClick={() => setPanel("add")}><UserPlus size={15} /> Add contact</Button>
        </>} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Name, phone, email or address" className="min-w-0 flex-1 basis-60" />
        <Select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filter by tag" className="!w-auto !py-2.5 text-sm">
          <option value="">All tags</option>
          {tags.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Segmented size="sm" value={sort} onChange={setSort} options={[{ value: "recent", label: "Recent" }, { value: "name", label: "Name" }, { value: "value", label: "Value" }]} />
      </div>

      {!all.length ? (
        <EmptyState icon={<Users size={32} />} title="No contacts yet" actions={<><Button onClick={() => setPanel("add")}><UserPlus size={16} /> Add contact</Button><Button variant="outline" onClick={() => setPanel("import")}><Upload size={16} /> Import CSV</Button></>}>
          Leads from the quote app show up here automatically. You can also import a customer list.
        </EmptyState>
      ) : !list.length ? (
        <EmptyState icon={<Users size={32} />} title="No matches">Try a different search{tag && <> or <button type="button" className="text-accent-fg underline" onClick={() => setTag("")}>clear the tag filter</button></>}.</EmptyState>
      ) : (
        <>
          {/* Phones get a stacked list; wider screens the full table. */}
          <div className="divide-y divide-fg/5 rounded-2xl border border-fg/10 sm:hidden">
            {list.map((c) => {
              const s = stats.get(c.id)!;
              return (
                <Link key={c.id} to={`/admin/contacts/${c.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-fg/[.04]">
                  <Avatar name={c.name} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{displayName(c)}</div>
                    <div className="truncate text-xs text-fg/50">{[c.phone, c.city].filter(Boolean).join(" · ")}</div>
                    {c.tags.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{c.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div>}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-display text-sm font-semibold tabular-nums">{money(s.value)}</div>
                    <div className="text-xs text-fg/45">{s.jobs.length} job{s.jobs.length === 1 ? "" : "s"}</div>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="hidden sm:block">
            <Table head={["Name", "Phone", "City", "Jobs", "Lifetime value", "Tags", "Last activity"]}>
              {list.map((c) => {
                const s = stats.get(c.id)!;
                return (
                  <tr key={c.id} onClick={() => nav(`/admin/contacts/${c.id}`)} className="cursor-pointer transition hover:bg-fg/[.03]">
                    <Td>
                      <Link to={`/admin/contacts/${c.id}`} className="flex items-center gap-2.5 font-medium" onClick={(e) => e.stopPropagation()}>
                        <Avatar name={c.name} size={28} />
                        <span className="min-w-0">
                          <span className="block truncate">{c.name}</span>
                          {c.company && c.company !== c.name && <span className="block truncate text-xs font-normal text-fg/45">{c.company}</span>}
                        </span>
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap text-fg/70">{c.phone}</Td>
                    <Td className="text-fg/70">{c.city}</Td>
                    <Td className="tabular-nums">{s.jobs.length}</Td>
                    <Td className="font-display tabular-nums">{money(s.value)}</Td>
                    <Td><div className="flex flex-wrap gap-1">{c.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div></Td>
                    <Td className="whitespace-nowrap text-fg/50">{s.last ? relative(s.last.length === 10 ? `${s.last}T12:00:00` : s.last) : "—"}</Td>
                  </tr>
                );
              })}
            </Table>
          </div>
        </>
      )}

      <AnimatePresence>
        {panel === "add" && <AddContactSheet key="add" onClose={() => setPanel(null)} startJob="none" />}
        {panel === "import" && <ImportSheet key="import" onClose={() => setPanel(null)} />}
        {panel === "tags" && <TagsSheet key="tags" onClose={() => setPanel(null)} onPick={setTag} />}
        {panel === "merge" && <MergeSheet key="merge" onClose={() => setPanel(null)} />}
      </AnimatePresence>
    </div>
  );
}
