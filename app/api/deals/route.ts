import { NextRequest, NextResponse } from "next/server";

const BASE_URL = process.env.RELATIA_BASE_URL!;
const TOKEN = process.env.RELATIA_TOKEN!;
const PIPELINE_ID = "356e94ad-170a-4cee-9e6a-e5b2438ab211";

export async function GET(_req: NextRequest) {
  const allDeals: unknown[] = [];
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      pipeline_id: PIPELINE_ID,
      page: String(page),
      page_size: "100",
    });

    const res = await fetch(`${BASE_URL}/api/deals/?${params}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      next: { revalidate: 300 },
    });

    if (!res.ok) break;

    const data = await res.json();
    const results = data.results ?? data;

    if (Array.isArray(results) && results.length > 0) {
      allDeals.push(...results);
    }

    // next === null means no more pages
    if (!data.next) break;
    page++;
  }

  // Keep only deals belonging to the "SWAPA" pipeline (excludes "SWAPA BTB" and others)
  const deals = allDeals.filter(
    (d) => (d as Record<string, unknown>).pipeline_name === "SWAPA"
  );

  return NextResponse.json(deals);
}
