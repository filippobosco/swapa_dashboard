import { NextRequest, NextResponse } from "next/server";

const BASE_URL = process.env.RELATIA_BASE_URL!;
const TOKEN = process.env.RELATIA_TOKEN!;

export async function GET(_req: NextRequest) {
  const appointments: unknown[] = [];
  let page = 1;

  while (true) {
    const params = new URLSearchParams({ page: String(page) });

    const res = await fetch(`${BASE_URL}/api/appointments/?${params}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      next: { revalidate: 300 },
    });

    if (!res.ok) break;

    const data = await res.json();
    const results = data.results ?? data;

    if (!Array.isArray(results) || results.length === 0) break;

    appointments.push(...results);

    if (!data.next) break;
    page++;
  }

  return NextResponse.json(appointments);
}
