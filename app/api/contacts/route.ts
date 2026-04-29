import { NextResponse } from "next/server";

const BASE_URL = process.env.RELATIA_BASE_URL!;
const TOKEN = process.env.RELATIA_TOKEN!;
export const dynamic = "force-dynamic";

function getCrmDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

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
    const created = getCrmDateKey(createdAt);
    if (!created) return false;
    if (from && created < from) return false;
    if (to && created > to) return false;
    return true;
  });

  return NextResponse.json(filtered);
}
