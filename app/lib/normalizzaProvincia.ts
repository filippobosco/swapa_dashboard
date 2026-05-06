import provinceData from "@/public/data/province-istat.json";
import comuniData from "@/public/data/comuni-istat.json";
import capData from "@/public/data/cap-provincia.json";

export type Sigla = string;
export type Strato =
  | "vuoto"
  | "garbage"
  | "regione"
  | "cap"
  | "sigla"
  | "comune"
  | "provincia"
  | "token"
  | "fuzzy"
  | "fallback";

export interface Risultato {
  sigla: Sigla | null;
  strato: Strato;
}

const provinceTuples = provinceData as unknown as ReadonlyArray<readonly [string, string]>;
const comuniTuples = comuniData as unknown as ReadonlyArray<readonly [string, string]>;
const capMap = capData as Readonly<Record<string, string>>;

const SIGLE: ReadonlySet<string> = new Set(provinceTuples.map(([s]) => s));

// Override sui nomi province per casi in cui il nome ISTAT ufficiale è verboso
// o multilingue. Per le sigle non elencate qui si usa il nome ISTAT direttamente.
const NOMI_DISPLAY_OVERRIDE: Readonly<Record<string, string>> = {
  MB: "Monza e Brianza",
  AO: "Aosta",
  BZ: "Bolzano",
  FC: "Forlì-Cesena",
  PU: "Pesaro e Urbino",
  RE: "Reggio Emilia",
  RC: "Reggio Calabria",
  MS: "Massa-Carrara",
  BT: "Barletta-Andria-Trani",
  AQ: "L'Aquila",
  SP: "La Spezia",
  VB: "Verbano-Cusio-Ossola",
  SU: "Sud Sardegna",
};

const NOMI_BY_SIGLA: ReadonlyMap<string, string> = new Map(
  provinceTuples.map(([sigla, nomeIstat]) => [
    sigla,
    NOMI_DISPLAY_OVERRIDE[sigla] ?? nomeIstat,
  ])
);

export function siglaToNomeProvincia(sigla: string | null | undefined): string | null {
  if (!sigla) return null;
  return NOMI_BY_SIGLA.get(sigla) ?? null;
}

function pulisci(input: string): string {
  const decomposed = input.normalize("NFKD");
  let s = "";
  for (const ch of decomposed) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x0300 && code <= 0x036f) continue;
    s += ch;
  }
  s = s.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

const provinceLookup: Map<string, string> = new Map(
  provinceTuples.map(([sigla, nome]) => [pulisci(nome), sigla])
);
const comuniLookup: Map<string, string> = new Map(
  comuniTuples.map(([nome, sigla]) => [pulisci(nome), sigla])
);
interface FuzzyEntry { key: string; sigla: string }
const provinceNomi: ReadonlyArray<FuzzyEntry> = Array.from(
  provinceLookup,
  ([key, sigla]) => ({ key, sigla })
);
const comuniNomi: ReadonlyArray<FuzzyEntry> = Array.from(
  comuniLookup,
  ([key, sigla]) => ({ key, sigla })
);

// Indice {prima lettera}_{lunghezza} → entries, per restringere il pool fuzzy.
function buildIndex(entries: ReadonlyArray<FuzzyEntry>): Map<string, FuzzyEntry[]> {
  const idx = new Map<string, FuzzyEntry[]>();
  for (const e of entries) {
    if (e.key.length < 2) continue;
    const c0 = e.key.charCodeAt(0);
    const c1 = e.key.charCodeAt(1);
    const len = e.key.length;
    // Inserisco l'entry nei bucket [first-or-second, len-2..len+2] per
    // tollerare typo iniziali (es. "lmperia" per "imperia") e piccoli shift
    // di lunghezza per insert/delete.
    const seen = new Set<string>();
    for (const head of [c0, c1]) {
      for (let dl = -2; dl <= 2; dl++) {
        const bucketLen = len + dl;
        if (bucketLen < 2) continue;
        const k = `${head}_${bucketLen}`;
        if (seen.has(k)) continue;
        seen.add(k);
        let bucket = idx.get(k);
        if (!bucket) { bucket = []; idx.set(k, bucket); }
        bucket.push(e);
      }
    }
  }
  return idx;
}
const comuniIndex = buildIndex(comuniNomi);
const provinceIndex = buildIndex(provinceNomi);

const REGIONI_NORM: ReadonlySet<string> = new Set(
  [
    "abruzzo",
    "basilicata",
    "calabria",
    "campania",
    "emilia romagna",
    "friuli venezia giulia",
    "lazio",
    "liguria",
    "lombardia",
    "marche",
    "molise",
    "piemonte",
    "puglia",
    "sardegna",
    "sicilia",
    "toscana",
    "trentino alto adige",
    "umbria",
    "valle d aosta",
    "veneto",
    "italia",
    "italy",
  ].map(pulisci)
);

const PAROLE_GARBAGE: ReadonlyArray<string> = [
  "vorrei",
  "quanto",
  "costa",
  "informazioni",
  "prezzo",
  "ciao",
  "dove",
  "noleggio",
  "preventivo",
  "test drive",
  "patente",
  "grazie",
];

function isGarbage(originale: string, pulita: string): boolean {
  if (originale.includes("<test") || originale.toLowerCase().includes("lead:"))
    return true;
  if (pulita.length < 2) return false;
  const tokens = pulita.split(" ").filter(Boolean);
  if (tokens.length > 8) return true;
  // Le parole tipo "vorrei", "quanto", "ciao" non sono mai nomi di comuni o
  // province, quindi se l'input pulito le contiene è garbage qualsiasi sia
  // la lunghezza (la spec dichiara la regola "len > 40 AND keyword" ma quei
  // valori risultano garbage anche più corti, vedi "vorrei sapere il prezzo").
  for (const w of PAROLE_GARBAGE) {
    if (pulita.includes(w)) return true;
  }
  if (pulita.length > 40 && originale.includes("?")) return true;
  return false;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const la = a.length;
  const lb = b.length;
  let prev = new Array<number>(lb + 1);
  let curr = new Array<number>(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      const del = prev[j] + 1;
      const ins = curr[j - 1] + 1;
      const sub = prev[j - 1] + cost;
      let v = del < ins ? del : ins;
      if (sub < v) v = sub;
      curr[j] = v;
    }
    [prev, curr] = [curr, prev];
  }
  return prev[lb];
}

function ratio(a: string, b: string): number {
  const total = a.length + b.length;
  if (total === 0) return 100;
  const d = levenshtein(a, b);
  return Math.round(((total - d) / total) * 100);
}

function fuzzyBestIndexed(
  query: string,
  index: ReadonlyMap<string, FuzzyEntry[]>,
  soglia: number
): string | null {
  if (!query || query.length < 2) return null;
  const c0 = query.charCodeAt(0);
  const c1 = query.charCodeAt(1);
  const len = query.length;
  let best: { score: number; sigla: string } | null = null;
  const maxDelta = 2;
  const seen = new Set<FuzzyEntry>();
  // Provo entrambi i caratteri iniziali della query come head: copre il caso
  // "lmperia" (typo nel primo carattere) — l'indice contiene "imperia" sotto
  // sia c0='i' sia c1='m'.
  for (const head of [c0, c1]) {
    for (let dl = -maxDelta; dl <= maxDelta; dl++) {
      const bucket = index.get(`${head}_${len + dl}`);
      if (!bucket) continue;
      for (const item of bucket) {
        if (seen.has(item)) continue;
        seen.add(item);
        const s = ratio(query, item.key);
        if (s >= soglia && (best === null || s > best.score)) {
          best = { score: s, sigla: item.sigla };
        }
      }
    }
  }
  return best ? best.sigla : null;
}

const SEPARATORI_TOKEN = /[,/\-\s]+| e | con | pr /;
const SIGLE_AMBIGUE: ReadonlySet<string> = new Set(["si", "lo", "ma"]);

function risolviToken(tok: string): string | null {
  const t = tok.trim();
  if (!t) return null;
  if (/^\d{5}$/.test(t)) return capMap[t] ?? null;
  if (t.length === 2 && /^[a-z]{2}$/.test(t) && !SIGLE_AMBIGUE.has(t)) {
    const upper = t.toUpperCase();
    if (SIGLE.has(upper)) return upper;
  }
  const comune = comuniLookup.get(t);
  if (comune) return comune;
  const provincia = provinceLookup.get(t);
  if (provincia) return provincia;
  return null;
}

function risolviPair(a: string, b: string): string | null {
  const joined = `${a} ${b}`;
  const c = comuniLookup.get(joined);
  if (c) return c;
  const p = provinceLookup.get(joined);
  if (p) return p;
  return null;
}

function risolviTriple(a: string, b: string, c: string): string | null {
  const joined = `${a} ${b} ${c}`;
  const cm = comuniLookup.get(joined);
  if (cm) return cm;
  const p = provinceLookup.get(joined);
  if (p) return p;
  return null;
}

export function normalizzaProvincia(valore: string | null | undefined): Risultato {
  if (valore === null || valore === undefined) return { sigla: null, strato: "vuoto" };
  if (typeof valore !== "string") return { sigla: null, strato: "vuoto" };
  const pulita = pulisci(valore);
  if (!pulita) return { sigla: null, strato: "vuoto" };

  if (isGarbage(valore, pulita)) return { sigla: null, strato: "garbage" };

  if (REGIONI_NORM.has(pulita)) return { sigla: null, strato: "regione" };

  const capMatch = pulita.match(/\b\d{5}\b/);
  if (capMatch) {
    const sigla = capMap[capMatch[0]];
    if (sigla) return { sigla, strato: "cap" };
  }

  if (pulita.length === 2 && /^[a-z]{2}$/.test(pulita)) {
    if (SIGLE_AMBIGUE.has(pulita)) return { sigla: null, strato: "garbage" };
    const upper = pulita.toUpperCase();
    if (SIGLE.has(upper)) return { sigla: upper, strato: "sigla" };
  }

  const comuneFull = comuniLookup.get(pulita);
  if (comuneFull) return { sigla: comuneFull, strato: "comune" };

  const provinciaFull = provinceLookup.get(pulita);
  if (provinciaFull) return { sigla: provinciaFull, strato: "provincia" };

  const tokens = pulita.split(SEPARATORI_TOKEN).map((t) => t.trim()).filter(Boolean);
  if (tokens.length > 1) {
    // Bigrammi: "monza brianza" non è un singolo comune ma "Monza" sì → tentiamo
    // anche le coppie/trigrammi per catturare comuni con nome composto.
    for (let i = 0; i < tokens.length - 2; i++) {
      const hit = risolviTriple(tokens[i], tokens[i + 1], tokens[i + 2]);
      if (hit) return { sigla: hit, strato: "token" };
    }
    for (let i = 0; i < tokens.length - 1; i++) {
      const hit = risolviPair(tokens[i], tokens[i + 1]);
      if (hit) return { sigla: hit, strato: "token" };
    }
    for (const tok of tokens) {
      const hit = risolviToken(tok);
      if (hit) return { sigla: hit, strato: "token" };
    }
  }

  // Fuzzy sull'intero input (soglia alta per evitare collisioni). Saltato per
  // input < 4 caratteri: "Hh", "lo" non devono fare match.
  if (pulita.length >= 4) {
    const fuzzyComune = fuzzyBestIndexed(pulita, comuniIndex, 90);
    if (fuzzyComune) return { sigla: fuzzyComune, strato: "fuzzy" };
    const fuzzyProv = fuzzyBestIndexed(pulita, provinceIndex, 88);
    if (fuzzyProv) return { sigla: fuzzyProv, strato: "fuzzy" };
  }

  // Fuzzy sui token singoli: cattura "marche ancons" (ancons → Ancona) dopo che
  // la tokenizzazione esatta ha fallito.
  if (tokens.length > 1) {
    for (const tok of tokens) {
      if (tok.length < 4) continue;
      const fuzzyComune = fuzzyBestIndexed(tok, comuniIndex, 90);
      if (fuzzyComune) return { sigla: fuzzyComune, strato: "fuzzy" };
      const fuzzyProv = fuzzyBestIndexed(tok, provinceIndex, 88);
      if (fuzzyProv) return { sigla: fuzzyProv, strato: "fuzzy" };
    }
  }

  return { sigla: null, strato: "fallback" };
}

interface StatsRecord {
  strato: Strato;
  count: number;
  percentuale: string;
}

let _logged = false;
export function logStratiOnce(valori: ReadonlyArray<string | null | undefined>): void {
  if (_logged) return;
  if (typeof process === "undefined" || process.env.NODE_ENV === "production") return;
  _logged = true;
  const counter = new Map<Strato, number>();
  for (const v of valori) {
    const r = normalizzaProvincia(v);
    counter.set(r.strato, (counter.get(r.strato) ?? 0) + 1);
  }
  const total = valori.length || 1;
  const rows: StatsRecord[] = Array.from(counter, ([strato, count]) => ({
    strato,
    count,
    percentuale: ((count / total) * 100).toFixed(1) + "%",
  })).sort((a, b) => b.count - a.count);
  // eslint-disable-next-line no-console
  console.table(rows);
  const noneCount =
    (counter.get("vuoto") ?? 0) +
    (counter.get("garbage") ?? 0) +
    (counter.get("regione") ?? 0) +
    (counter.get("fallback") ?? 0);
  const nonePct = (noneCount / total) * 100;
  if (nonePct > 30) {
    // eslint-disable-next-line no-console
    console.warn(
      `[normalizzaProvincia] ${nonePct.toFixed(1)}% dei valori non normalizzati (>30%): il dataset potrebbe essere sporco.`
    );
  }
}
