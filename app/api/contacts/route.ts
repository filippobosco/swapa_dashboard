import { NextResponse } from "next/server";

const BASE_URL = process.env.RELATIA_BASE_URL!;
const TOKEN = process.env.RELATIA_TOKEN!;

function parseCrmDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const from = fromParam ? new Date(`${fromParam}T00:00:00`) : null;
  const to = toParam ? new Date(`${toParam}T23:59:59`) : null;

  const contacts: unknown[] = [];
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      page: String(page),
      page_size: "100",
    });

    const res = await fetch(`${BASE_URL}/api/contacts/?${params}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      next: { revalidate: 300 },
    });

    if (!res.ok) break;

    const data = await res.json();
    const results = data.results ?? data;

    if (Array.isArray(results) && results.length > 0) {
      contacts.push(...results);
    }

    // next === null means no more pages
    if (!data.next) break;
    page++;
  }

  if (!from && !to) {
    return NextResponse.json(contacts);
  }

  const filtered = contacts.filter((contact) => {
    const createdAt = (contact as { created_at?: string }).created_at;
    const created = parseCrmDate(createdAt);
    if (!created) return false;
    if (from && created < from) return false;
    if (to && created > to) return false;
    return true;
  });

  return NextResponse.json(filtered);
}
