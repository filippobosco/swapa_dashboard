"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Users, Video, Car, PhoneCall, TrendingUp, BarChart2, type LucideIcon } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CustomValue {
  custom_field: { key: string };
  value_text: string | null;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  city: string;
  created_at: string;
  source?: number;
  assigned_to?: { id: number; name: string };
  custom_values?: CustomValue[];
}

interface Deal {
  id: string;
  contact?: { id: string };
  current_stage?: string;
  current_stage_name?: string;
  pipeline_name?: string;
  created_at: string;
  assigned_to?: { id: number; name: string };
}

interface ContactSource {
  id: number;
  name: string;
}

interface Appointment {
  id: string;
  appointment_type?: string;
  scheduled_at?: string;
  created_at?: string;
  contact?: { id?: string };
}

type ProvinciaSortKey = "vc" | "td" | "total";
type SortDirection = "asc" | "desc";
type ProvinciaSortState = { by: ProvinciaSortKey; dir: SortDirection };

const PIPELINE_STAGES = [
  { id: "52a28729-58ac-4777-9a9d-ac874c1988c1", name: "Videocall",            color: "#9C6FE8" },
  { id: "03108e8e-47b7-46e0-978e-080701784fc2", name: "Follow up",            color: "#3B6FE8" },
  { id: "80473b43-709e-4039-ad73-0d3fcd4d74e6", name: "Hot Lead",             color: "#3B6FE8" },
  { id: "110c5405-fac0-4f68-9216-3be40e6e8a48", name: "Long Term",            color: "#3B6FE8" },
  { id: "2503dba8-a62e-4c3a-bc4a-07fe7a19026b", name: "Test Drive LOMBARDIA", color: "#4CAF7D" },
  { id: "824dd0b3-cfa1-4ae7-ad9f-2670bab92731", name: "Test Drive LAZIO",     color: "#4CAF7D" },
  { id: "5c32feb9-67bf-492d-8ad2-dfd2317aee81", name: "Test Drive PIEMONTE",  color: "#4CAF7D" },
  { id: "8d80016f-9142-41ea-96ef-e289508cd1f1", name: "Test Drive CAMPANIA",  color: "#4CAF7D" },
  { id: "26c0d748-63cb-415d-93b0-a3499821e49c", name: "Test Drive TOSCANA",   color: "#4CAF7D" },
  { id: "a1c13da3-5ffd-4701-8bcb-c2256b1578e0", name: "Test Drive ROMAGNA",   color: "#4CAF7D" },
  { id: "133d8a6a-ea84-4393-8fc4-fc7b296333d8", name: "Order",                color: "#F59E0B" },
  { id: "fe17a3ba-0afe-4734-a111-1d49a16ea318", name: "Trade In",             color: "#F97316" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCustomValue(custom_values: CustomValue[] | undefined, key: string): string | null {
  const found = custom_values?.find((cv) => cv.custom_field?.key === key);
  return found?.value_text ?? null;
}

function toTitleCase(s: string): string {
  return s.trim().toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function defaultDateRange() {
  const end = new Date();
  return {
    from: "2026-03-20",
    to: end.toISOString().slice(0, 10),
  };
}

function getCrmDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function normalizeAppointmentType(value: string | undefined): "Video Call" | "Test Drive" | "Call" | null {
  const v = value?.trim().toLowerCase();
  if (v === "video") return "Video Call";
  if (v === "in_person") return "Test Drive";
  if (v === "call") return "Call";
  return null;
}

function appointmentTypeForContact(
  contactId: string,
  appointmentTypeByContact: Map<string, "Video Call" | "Test Drive" | "Call">
): "Video Call" | "Test Drive" | "Call" | "Nessuno" {
  const type = appointmentTypeByContact.get(contactId);
  if (type) return type;
  return "Nessuno";
}

function getSourceName(c: Contact, sourceMap: Map<number, string>): string {
  if (c.source != null) return sourceMap.get(c.source) ?? `Fonte ${c.source}`;
  return "Sconosciuta";
}

function getProvinciaNome(c: Contact): string {
  const raw = getCustomValue(c.custom_values, "in_che_provincia_risiedi_") || c.city || "";
  return raw ? toTitleCase(raw) : "—";
}

function fmtPct(n: number, total: number): string {
  return total > 0 ? ((n / total) * 100).toFixed(1) + "%" : "—";
}

// ─── LeadDrawer ───────────────────────────────────────────────────────────────

function LeadDrawer({
  open,
  title,
  leads,
  sourceMap,
  onClose,
}: {
  open: boolean;
  title: string;
  leads: Contact[];
  sourceMap: Map<number, string>;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.35)", zIndex: 200 }}
      />
      <div style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: 480,
        backgroundColor: "#fff",
        borderLeft: "1px solid #E8EAF0",
        zIndex: 201,
        display: "flex",
        flexDirection: "column",
        animation: "slideInRight 200ms ease-out",
        fontFamily: "Inter, sans-serif",
      }}>
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid #E8EAF0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: "#1A1A2E" }}>
            {title}
          </span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 18, padding: 0, lineHeight: 1, flexShrink: 0 }}
          >
            ✕
          </button>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {leads.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Nessun lead</div>
          )}
          {leads.map((lead, i) => {
            const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "—";
            const prov = getProvinciaNome(lead);
            const src = getSourceName(lead, sourceMap);
            const date = lead.created_at?.slice(0, 10) ?? "—";
            return (
              <a
                key={lead.id}
                href={`https://filante.relatiacrm.com/contacts/${lead.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  padding: "12px 20px",
                  borderBottom: i === leads.length - 1 ? "none" : "1px solid #F0F2F5",
                  textDecoration: "none",
                  color: "inherit",
                  backgroundColor: "transparent",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8F9FB")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <div style={{ fontWeight: 600, fontSize: 13, color: "#1A1A2E", marginBottom: 3 }}>{fullName}</div>
                <div style={{ fontSize: 12, color: "#6B7280", display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <span>{lead.phone || "—"}</span>
                  <span>{prov}</span>
                  <span>{src}</span>
                  <span>{date}</span>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  accent,
  Icon,
  onClick,
}: {
  label: string;
  value: string | number;
  accent?: string;
  Icon?: LucideIcon;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: "#fff",
        border: "1px solid #E8EAF0",
        borderRadius: 8,
        padding: 20,
        position: "relative",
        cursor: onClick ? "pointer" : undefined,
      }}
      onMouseEnter={(e) => { if (onClick) (e.currentTarget as HTMLDivElement).style.backgroundColor = "#F8F9FB"; }}
      onMouseLeave={(e) => { if (onClick) (e.currentTarget as HTMLDivElement).style.backgroundColor = "#fff"; }}
    >
      {Icon && (
        <Icon
          size={16}
          style={{ position: "absolute", top: 16, right: 16, color: accent ?? "#6B7280", opacity: 0.6 }}
        />
      )}
      <div style={{ color: "#6B7280", fontSize: 12, marginBottom: 8 }}>{label}</div>
      <div style={{
        color: accent ?? "#1A1A2E",
        fontSize: 28,
        fontWeight: 600,
        lineHeight: 1,
        textDecoration: onClick ? "underline dotted" : "none",
        textDecorationColor: accent ?? "#1A1A2E",
      }}>
        {value}
      </div>
    </div>
  );
}

// ─── Filter Label ─────────────────────────────────────────────────────────────

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10,
      color: "#6B7280",
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      fontWeight: 500,
      marginBottom: 5,
    }}>
      {children}
    </div>
  );
}

// ─── ClickableBadge ───────────────────────────────────────────────────────────

function ClickableBadge({
  value,
  badgeStyle,
  onClick,
}: {
  value: number;
  badgeStyle: React.CSSProperties;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "inline-flex" }}
    >
      <span style={{ ...badgeStyle, textDecoration: "underline dotted" }}>{value}</span>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const defaults = defaultDateRange();
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [sourceFilter, setSourceFilter] = useState("");
  const [provinciaFilter, setProvinciaFilter] = useState("");
  const [provinciaSearch, setProvinciaSearch] = useState("");
  const [showProvDropdown, setShowProvDropdown] = useState(false);
  const provRef = useRef<HTMLDivElement>(null);
  const [provinciaSort, setProvinciaSort] = useState<ProvinciaSortState>({ by: "total", dir: "desc" });
  const [stageFilter, setStageFilter] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [sourceMap, setSourceMap] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const latestRequestRef = useRef(0);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState("");
  const [drawerLeads, setDrawerLeads] = useState<Contact[]>([]);

  const openDrawer = useCallback((title: string, leads: Contact[]) => {
    setDrawerTitle(title);
    setDrawerLeads(leads);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const fetchData = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const contactsUrl = `/api/contacts${params.toString() ? `?${params.toString()}` : ""}`;

      const [cRes, dRes, sRes, aRes] = await Promise.all([
        fetch(contactsUrl, { cache: "no-store" }),
        fetch("/api/deals", { cache: "no-store" }),
        fetch("/api/contact-sources", { cache: "no-store" }),
        fetch("/api/appointments", { cache: "no-store" }),
      ]);
      const [c, d, s, a] = await Promise.all([cRes.json(), dRes.json(), sRes.json(), aRes.json()]);

      if (requestId !== latestRequestRef.current) return;

      const dealsArr: Deal[] = Array.isArray(d) ? d : [];
      const validContactIds = new Set(dealsArr.map((deal) => deal.contact?.id).filter(Boolean));
      const filteredContacts = Array.isArray(c)
        ? (c as Contact[]).filter((contact) => validContactIds.has(contact.id))
        : [];

      setContacts(filteredContacts);
      setDeals(dealsArr);
      setAppointments(Array.isArray(a) ? (a as Appointment[]) : []);

      if (Array.isArray(s)) {
        const map = new Map<number, string>();
        (s as ContactSource[]).forEach((src) => map.set(src.id, src.name));
        setSourceMap(map);
      }
    } finally {
      if (requestId === latestRequestRef.current) {
        setLoading(false);
      }
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (provRef.current && !provRef.current.contains(e.target as Node)) {
        setShowProvDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // contact.id → deal (for stage filter)
  const dealByContact = useMemo(() => {
    const m = new Map<string, Deal>();
    for (const d of deals) {
      if (d.contact?.id) m.set(d.contact.id, d);
    }
    return m;
  }, [deals]);

  // contact.id → latest appointment type
  const appointmentTypeByContact = useMemo(() => {
    const latestByContact = new Map<string, { timestamp: number; type: "Video Call" | "Test Drive" | "Call" }>();

    for (const appointment of appointments) {
      const contactId = appointment.contact?.id;
      if (!contactId) continue;

      const normalizedType = normalizeAppointmentType(appointment.appointment_type);
      if (!normalizedType) continue;

      const rawDate = appointment.scheduled_at ?? appointment.created_at ?? "";
      const timestamp = Date.parse(rawDate);
      const safeTimestamp = Number.isNaN(timestamp) ? 0 : timestamp;
      const existing = latestByContact.get(contactId);

      if (!existing || safeTimestamp >= existing.timestamp) {
        latestByContact.set(contactId, { timestamp: safeTimestamp, type: normalizedType });
      }
    }

    const typeByContact = new Map<string, "Video Call" | "Test Drive" | "Call">();
    for (const [contactId, value] of latestByContact.entries()) {
      typeByContact.set(contactId, value.type);
    }
    return typeByContact;
  }, [appointments]);

  // filtered contacts (all filters applied client-side)
  const filtered = useMemo(() => {
    const from = dateFrom || null;
    const to = dateTo || null;

    return contacts.filter((c) => {
      if (from || to) {
        const created = getCrmDateKey(c.created_at);
        if (!created) return false;
        if (from && created < from) return false;
        if (to && created > to) return false;
      }
      if (sourceFilter && getSourceName(c, sourceMap) !== sourceFilter) return false;
      if (provinciaFilter && getProvinciaNome(c) !== provinciaFilter) return false;
      if (stageFilter) {
        const deal = dealByContact.get(c.id);
        if ((deal?.current_stage_name ?? "") !== stageFilter) return false;
      }
      return true;
    });
  }, [contacts, dateFrom, dateTo, sourceFilter, provinciaFilter, stageFilter, dealByContact, sourceMap]);

  // KPIs
  const totalLeads = filtered.length;
  const videoCallLeads = useMemo(
    () => filtered.filter((c) => appointmentTypeForContact(c.id, appointmentTypeByContact) === "Video Call"),
    [filtered, appointmentTypeByContact]
  );
  const testDriveLeads = useMemo(
    () => filtered.filter((c) => appointmentTypeForContact(c.id, appointmentTypeByContact) === "Test Drive"),
    [filtered, appointmentTypeByContact]
  );
  const videoCallCount = videoCallLeads.length;
  const testDriveCount = testDriveLeads.length;
  const callCount = filtered.filter((c) => appointmentTypeForContact(c.id, appointmentTypeByContact) === "Call").length;
  const pct = (n: number) =>
    totalLeads > 0 ? ((n / totalLeads) * 100).toFixed(1) + "%" : "0.0%";

  // pipeline stage distribution — uses raw `deals` (all SWAPA deals, date filter NOT applied)
  const pipelineBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    deals.forEach((d) => {
      if (d.current_stage) counts.set(d.current_stage, (counts.get(d.current_stage) ?? 0) + 1);
    });
    return PIPELINE_STAGES.map(({ id, name, color }) => ({ name, color, count: counts.get(id) ?? 0 }));
  }, [deals]);

  // dropdown options — derived from all loaded contacts (not filtered)
  const allSources = useMemo(() => {
    const s = new Set<string>();
    contacts.forEach((c) => s.add(getSourceName(c, sourceMap)));
    return Array.from(s).sort();
  }, [contacts, sourceMap]);

  const allProvinces = useMemo(() => {
    const s = new Set<string>();
    contacts.forEach((c) => {
      const p = getProvinciaNome(c);
      if (p !== "—") s.add(p);
    });
    return Array.from(s).sort();
  }, [contacts]);

  const allStages = useMemo(() => {
    const s = new Set<string>();
    deals.forEach((d) => {
      const name = d.current_stage_name ?? "";
      if (name) s.add(name);
    });
    return Array.from(s)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ id: name, name }));
  }, [deals]);

  // breakdown sorgente × tipo
  const sourceBreakdown = useMemo(() => {
    const map = new Map<string, { vc: number; td: number; call: number; no: number }>();
    for (const c of filtered) {
      const src = getSourceName(c, sourceMap);
      const t = appointmentTypeForContact(c.id, appointmentTypeByContact);
      if (!map.has(src)) map.set(src, { vc: 0, td: 0, call: 0, no: 0 });
      const row = map.get(src)!;
      if (t === "Video Call") row.vc++;
      else if (t === "Test Drive") row.td++;
      else if (t === "Call") row.call++;
      else row.no++;
    }
    return Array.from(map.entries())
      .map(([src, v]) => ({ src, ...v, total: v.vc + v.td + v.call + v.no }))
      .sort((a, b) => b.total - a.total);
  }, [filtered, sourceMap, appointmentTypeByContact]);

  // breakdown provincia × tipo
  const provinciaBreakdown = useMemo(() => {
    const map = new Map<string, { vc: number; td: number; call: number; no: number }>();
    for (const c of filtered) {
      const prov = getProvinciaNome(c);
      const t = appointmentTypeForContact(c.id, appointmentTypeByContact);
      if (!map.has(prov)) map.set(prov, { vc: 0, td: 0, call: 0, no: 0 });
      const row = map.get(prov)!;
      if (t === "Video Call") row.vc++;
      else if (t === "Test Drive") row.td++;
      else if (t === "Call") row.call++;
      else row.no++;
    }
    return Array.from(map.entries())
      .map(([prov, v]) => ({ prov, ...v, total: v.vc + v.td + v.call + v.no }))
      .sort((a, b) => {
        const diff = a[provinciaSort.by] - b[provinciaSort.by];
        return provinciaSort.dir === "desc" ? -diff : diff;
      })
      .slice(0, 20);
  }, [filtered, appointmentTypeByContact, provinciaSort]);

  const handleProvinciaSort = useCallback((sortBy: ProvinciaSortKey) => {
    setProvinciaSort((current) => {
      if (current.by === sortBy) {
        return { by: sortBy, dir: current.dir === "desc" ? "asc" : "desc" };
      }
      return { by: sortBy, dir: "desc" };
    });
  }, []);

  const provinciaSortIndicator = provinciaSort.dir === "desc" ? "↓" : "↑";

  // andamento nel tempo
  const timeData = useMemo(() => {
    const map = new Map<string, { total: number; vc: number; td: number; call: number }>();
    for (const c of filtered) {
      const day = c.created_at?.slice(0, 10) ?? "";
      if (!day) continue;
      if (!map.has(day)) map.set(day, { total: 0, vc: 0, td: 0, call: 0 });
      const row = map.get(day)!;
      row.total++;
      const t = appointmentTypeForContact(c.id, appointmentTypeByContact);
      if (t === "Video Call") row.vc++;
      else if (t === "Test Drive") row.td++;
      else if (t === "Call") row.call++;
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date: date.slice(5),
        Totale: v.total,
        "Video Call": v.vc,
        "Test Drive": v.td,
        Call: v.call,
      }));
  }, [filtered, appointmentTypeByContact]);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <LeadDrawer
        open={drawerOpen}
        title={drawerTitle}
        leads={drawerLeads}
        sourceMap={sourceMap}
        onClose={closeDrawer}
      />

      <div style={{ minHeight: "100vh", backgroundColor: "#F8F9FB", color: "#1A1A2E" }}>

        {/* ── Header ── */}
        <div style={{
          backgroundColor: "#fff",
          borderBottom: "1px solid #E8EAF0",
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#1A1A2E" }}>Swapa</span>
          <span style={{ color: "#6B7280", fontSize: 13 }}>Filante Motors srl</span>
        </div>

        {/* ── Filter bar (sticky) ── */}
        <div style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          backgroundColor: "#fff",
          borderBottom: "1px solid #E8EAF0",
          padding: "10px 32px",
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "flex-end",
        }}>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <FilterLabel>Data inizio</FilterLabel>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={fieldStyle} />
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <FilterLabel>Data fine</FilterLabel>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={fieldStyle} />
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <FilterLabel>Sorgente</FilterLabel>
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={fieldStyle}>
              <option value="">Tutte</option>
              {allSources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Provincia combobox */}
          <div ref={provRef} style={{ display: "flex", flexDirection: "column", position: "relative" }}>
            <FilterLabel>Provincia</FilterLabel>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <input
                type="text"
                placeholder="Cerca…"
                value={provinciaSearch}
                onChange={(e) => { setProvinciaSearch(e.target.value); setProvinciaFilter(""); setShowProvDropdown(true); }}
                onFocus={() => setShowProvDropdown(true)}
                style={{ ...fieldStyle, paddingRight: provinciaSearch ? 26 : 10, minWidth: 140 }}
              />
              {provinciaSearch && (
                <button
                  onClick={() => { setProvinciaSearch(""); setProvinciaFilter(""); setShowProvDropdown(false); }}
                  style={{ position: "absolute", right: 7, background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 13, padding: 0, lineHeight: 1 }}
                >✕</button>
              )}
            </div>
            {showProvDropdown && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, marginTop: 2,
                backgroundColor: "#fff", border: "1px solid #E8EAF0", borderRadius: 6,
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)", zIndex: 100, maxHeight: 200, overflowY: "auto",
              }}>
                {allProvinces
                  .filter((p) => provinciaSearch === "" || p.toLowerCase().includes(provinciaSearch.toLowerCase()))
                  .map((p) => (
                    <div
                      key={p}
                      onMouseDown={() => { setProvinciaFilter(p); setProvinciaSearch(p); setShowProvDropdown(false); }}
                      style={{
                        padding: "7px 10px", fontSize: 13, cursor: "pointer",
                        backgroundColor: p === provinciaFilter ? "#EEF3FD" : "transparent",
                        color: p === provinciaFilter ? "#3B6FE8" : "#1A1A2E",
                        fontWeight: p === provinciaFilter ? 600 : 400,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = p === provinciaFilter ? "#EEF3FD" : "#F8F9FB")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = p === provinciaFilter ? "#EEF3FD" : "transparent")}
                    >{p}</div>
                  ))}
                {allProvinces.filter((p) => provinciaSearch === "" || p.toLowerCase().includes(provinciaSearch.toLowerCase())).length === 0 && (
                  <div style={{ padding: "7px 10px", fontSize: 13, color: "#6B7280" }}>Nessuna trovata</div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <FilterLabel>Stage</FilterLabel>
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} style={fieldStyle}>
              <option value="">Tutti</option>
              {allStages.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
            </select>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              backgroundColor: "#3B6FE8", color: "#fff", border: "none",
              borderRadius: 6, padding: "0 16px", fontWeight: 500,
              fontSize: 13, cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1, height: 36, marginTop: "auto",
            }}
          >
            {loading ? "Caricamento…" : "Aggiorna"}
          </button>
        </div>

        {/* ── Content ── */}
        <div style={{ padding: "0 32px 48px" }}>

          {/* Section: Riepilogo */}
          <h2 style={sectionTitle}>Riepilogo</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 12 }}>
            <KpiCard
              label="Totale Lead"
              value={totalLeads}
              Icon={Users}
              onClick={() => openDrawer(`Totale Lead — ${totalLeads} lead`, filtered)}
            />
            <KpiCard
              label="Video Call"
              value={videoCallCount}
              Icon={Video}
              accent="#9C6FE8"
              onClick={() => openDrawer(`Video Call — ${videoCallCount} lead`, videoCallLeads)}
            />
            <KpiCard
              label="Test Drive"
              value={testDriveCount}
              Icon={Car}
              accent="#4CAF7D"
              onClick={() => openDrawer(`Test Drive — ${testDriveCount} lead`, testDriveLeads)}
            />
            <KpiCard label="Call"             value={callCount}               Icon={PhoneCall}  accent="#F59E0B" />
            <KpiCard label="Tasso Video Call" value={pct(videoCallCount)}     Icon={TrendingUp} accent="#9C6FE8" />
            <KpiCard label="Tasso Test Drive" value={pct(testDriveCount)}     Icon={TrendingUp} accent="#4CAF7D" />
            <KpiCard label="Tasso Totale"     value={pct(videoCallCount + testDriveCount)} Icon={BarChart2} accent="#3B6FE8" />
          </div>

          {/* Section: Pipeline */}
          <h2 style={sectionTitle}>
            Distribuzione Pipeline Swapa
            <span style={{ fontSize: 11, color: "#9CA3AF", fontStyle: "italic", fontWeight: 400, marginLeft: 8 }}>
              — dati totali, indipendenti dal filtro date
            </span>
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {pipelineBreakdown.map(({ name, color, count }) => (
              <div key={name} style={{
                backgroundColor: "#fff", border: "1px solid #E8EAF0",
                borderRadius: 8, padding: 16, minWidth: 110, flex: "1 1 110px",
              }}>
                <div style={{ fontSize: 22, fontWeight: 600, color, lineHeight: 1.1 }}>{count}</div>
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>{name}</div>
              </div>
            ))}
          </div>

          {/* Section: Breakdown Sorgente */}
          <h2 style={sectionTitle}>Breakdown Sorgente × Tipo Appuntamento</h2>
          <div style={cardStyle}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#F8F9FB" }}>
                  {["Sorgente", "Video Call", "% VC", "Test Drive", "% TD", "% conv.", "Call", "% Call", "Nessuno", "Totale", "% Totale"].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sourceBreakdown.map((row, i) => {
                  const vcLeads = filtered.filter(
                    (c) => getSourceName(c, sourceMap) === row.src && appointmentTypeForContact(c.id, appointmentTypeByContact) === "Video Call"
                  );
                  const tdLeads = filtered.filter(
                    (c) => getSourceName(c, sourceMap) === row.src && appointmentTypeForContact(c.id, appointmentTypeByContact) === "Test Drive"
                  );
                  return (
                    <tr
                      key={row.src}
                      style={{ borderBottom: i === sourceBreakdown.length - 1 ? "none" : "1px solid #F0F2F5" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8F9FB")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <td style={tdStyle}>{row.src}</td>
                      <td style={tdStyle}>
                        <ClickableBadge
                          value={row.vc}
                          badgeStyle={vcBadge}
                          onClick={() => openDrawer(`Video Call da ${row.src} — ${row.vc} lead`, vcLeads)}
                        />
                      </td>
                      <td style={{ ...tdStyle, color: "#6B7280", fontSize: 12 }}>
                        {fmtPct(row.vc, row.total)}
                      </td>
                      <td style={tdStyle}>
                        <ClickableBadge
                          value={row.td}
                          badgeStyle={tdBadge}
                          onClick={() => openDrawer(`Test Drive da ${row.src} — ${row.td} lead`, tdLeads)}
                        />
                      </td>
                      <td style={{ ...tdStyle, color: "#6B7280", fontSize: 12 }}>
                        {fmtPct(row.td, row.total)}
                      </td>
                      <td style={{ ...tdStyle, color: "#6B7280", fontSize: 12 }}>
                        {fmtPct(row.vc + row.td, row.total)}
                      </td>
                      <td style={tdStyle}>
                        <span style={callBadge}>{row.call}</span>
                      </td>
                      <td style={{ ...tdStyle, color: "#6B7280", fontSize: 12 }}>
                        {fmtPct(row.call, row.total)}
                      </td>
                      <td style={{ ...tdStyle, color: "#6B7280" }}>{row.no}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{row.total}</td>
                      <td style={{ ...tdStyle, color: "#6B7280", fontSize: 12 }}>
                        {totalLeads > 0 ? ((row.total / totalLeads) * 100).toFixed(1) + "%" : "—"}
                      </td>
                    </tr>
                  );
                })}
                {sourceBreakdown.length === 0 && (
                  <tr><td colSpan={11} style={{ ...tdStyle, textAlign: "center", color: "#9CA3AF", padding: 32 }}>Nessun dato</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Section: Breakdown Provincia */}
          <h2 style={sectionTitle}>Breakdown Provincia × Tipo Appuntamento (top 20)</h2>
          <div style={cardStyle}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid #F0F2F5", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}>Ordina per</span>
              {[
                { key: "total" as ProvinciaSortKey, label: "Totale" },
                { key: "td" as ProvinciaSortKey, label: "Test Drive" },
                { key: "vc" as ProvinciaSortKey, label: "Video Call" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => handleProvinciaSort(opt.key)}
                  style={{
                    border: "1px solid",
                    borderColor: provinciaSort.by === opt.key ? "#3B6FE8" : "#E8EAF0",
                    backgroundColor: provinciaSort.by === opt.key ? "#EEF3FD" : "#fff",
                    color: provinciaSort.by === opt.key ? "#3B6FE8" : "#6B7280",
                    borderRadius: 999,
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {opt.label} {provinciaSort.by === opt.key ? provinciaSortIndicator : ""}
                </button>
              ))}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#F8F9FB" }}>
                  <th style={thStyle}>Provincia</th>
                  <th style={{ ...thStyle, backgroundColor: provinciaSort.by === "vc" ? "#EEF3FD" : "#F8F9FB", color: provinciaSort.by === "vc" ? "#3B6FE8" : thStyle.color }}>Video Call</th>
                  <th style={thStyle}>% VC</th>
                  <th style={{ ...thStyle, backgroundColor: provinciaSort.by === "td" ? "#EEF3FD" : "#F8F9FB", color: provinciaSort.by === "td" ? "#3B6FE8" : thStyle.color }}>Test Drive</th>
                  <th style={thStyle}>% TD</th>
                  <th style={thStyle}>Call</th>
                  <th style={thStyle}>% Call</th>
                  <th style={thStyle}>Nessuno</th>
                  <th style={{ ...thStyle, backgroundColor: provinciaSort.by === "total" ? "#EEF3FD" : "#F8F9FB", color: provinciaSort.by === "total" ? "#3B6FE8" : thStyle.color }}>Totale</th>
                  <th style={thStyle}>% conv.</th>
                </tr>
              </thead>
              <tbody>
                {provinciaBreakdown.map((row, i) => {
                  const isHighlighted = provinciaFilter !== "" && row.prov === provinciaFilter;
                  const vcLeads = filtered.filter(
                    (c) => getProvinciaNome(c) === row.prov && appointmentTypeForContact(c.id, appointmentTypeByContact) === "Video Call"
                  );
                  const tdLeads = filtered.filter(
                    (c) => getProvinciaNome(c) === row.prov && appointmentTypeForContact(c.id, appointmentTypeByContact) === "Test Drive"
                  );
                  return (
                    <tr
                      key={row.prov}
                      style={{
                        borderBottom: i === provinciaBreakdown.length - 1 ? "none" : "1px solid #F0F2F5",
                        backgroundColor: isHighlighted ? "#EEF3FD" : "transparent",
                        outline: isHighlighted ? "2px solid #3B6FE8" : undefined,
                        outlineOffset: isHighlighted ? "-1px" : undefined,
                      }}
                      onMouseEnter={(e) => { if (!isHighlighted) e.currentTarget.style.backgroundColor = "#F8F9FB"; }}
                      onMouseLeave={(e) => { if (!isHighlighted) e.currentTarget.style.backgroundColor = "transparent"; }}
                    >
                      <td style={{ ...tdStyle, fontWeight: isHighlighted ? 600 : undefined, color: isHighlighted ? "#3B6FE8" : undefined }}>{row.prov}</td>
                      <td style={tdStyle}>
                        <ClickableBadge
                          value={row.vc}
                          badgeStyle={vcBadge}
                          onClick={() => openDrawer(`Video Call da ${row.prov} — ${row.vc} lead`, vcLeads)}
                        />
                      </td>
                      <td style={{ ...tdStyle, color: "#6B7280", fontSize: 12 }}>
                        {fmtPct(row.vc, row.total)}
                      </td>
                      <td style={tdStyle}>
                        <ClickableBadge
                          value={row.td}
                          badgeStyle={tdBadge}
                          onClick={() => openDrawer(`Test Drive da ${row.prov} — ${row.td} lead`, tdLeads)}
                        />
                      </td>
                      <td style={{ ...tdStyle, color: "#6B7280", fontSize: 12 }}>
                        {fmtPct(row.td, row.total)}
                      </td>
                      <td style={tdStyle}><span style={callBadge}>{row.call}</span></td>
                      <td style={{ ...tdStyle, color: "#6B7280", fontSize: 12 }}>
                        {fmtPct(row.call, row.total)}
                      </td>
                      <td style={{ ...tdStyle, color: "#6B7280" }}>{row.no}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{row.total}</td>
                      <td style={{ ...tdStyle, color: "#6B7280", fontSize: 12 }}>
                        {fmtPct(row.vc + row.td, row.total)}
                      </td>
                    </tr>
                  );
                })}
                {provinciaBreakdown.length === 0 && (
                  <tr><td colSpan={10} style={{ ...tdStyle, textAlign: "center", color: "#9CA3AF", padding: 32 }}>Nessun dato</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Section: Andamento */}
          <h2 style={sectionTitle}>Andamento Lead nel Tempo</h2>
          <div style={{ ...cardStyle, padding: 20 }}>
            {timeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={timeData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #E8EAF0", borderRadius: 6, fontSize: 12, boxShadow: "none" }}
                    labelStyle={{ color: "#6B7280", marginBottom: 4 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#6B7280", paddingTop: 8 }} />
                  <Line type="monotone" dataKey="Totale"     stroke="#3B6FE8" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Video Call" stroke="#9C6FE8" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Test Drive" stroke="#4CAF7D" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Call"       stroke="#F59E0B" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: "center", color: "#9CA3AF", padding: 48, fontSize: 13 }}>
                Nessun dato da visualizzare
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}

// ─── Shared Styles ────────────────────────────────────────────────────────────

const sectionTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "#1A1A2E",
  marginTop: 32,
  marginBottom: 12,
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  border: "1px solid #E8EAF0",
  borderRadius: 8,
  overflow: "hidden",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 16px",
  fontSize: 11,
  fontWeight: 600,
  color: "#6B7280",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: 13,
  color: "#1A1A2E",
  whiteSpace: "nowrap",
};

const fieldStyle: React.CSSProperties = {
  height: 36,
  border: "1px solid #E8EAF0",
  borderRadius: 6,
  padding: "0 10px",
  fontSize: 13,
  color: "#1A1A2E",
  backgroundColor: "#fff",
  minWidth: 130,
  outline: "none",
};

const vcBadge: React.CSSProperties = {
  backgroundColor: "#EDE9FE",
  color: "#7C3AED",
  borderRadius: 4,
  padding: "2px 8px",
  fontSize: 12,
  fontWeight: 500,
};

const tdBadge: React.CSSProperties = {
  backgroundColor: "#D1FAE5",
  color: "#065F46",
  borderRadius: 4,
  padding: "2px 8px",
  fontSize: 12,
  fontWeight: 500,
};

const callBadge: React.CSSProperties = {
  backgroundColor: "#FEF3C7",
  color: "#92400E",
  borderRadius: 4,
  padding: "2px 8px",
  fontSize: 12,
  fontWeight: 500,
};
