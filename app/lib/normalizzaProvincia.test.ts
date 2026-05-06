import { describe, it, expect } from "vitest";
import { normalizzaProvincia, siglaToNomeProvincia } from "./normalizzaProvincia";

function sigla(input: string | null | undefined): string | null {
  return normalizzaProvincia(input).sigla;
}

describe("normalizzaProvincia — match diretti, case mixed", () => {
  it.each([
    ["Roma", "RM"],
    ["ROMA", "RM"],
    ["roma", "RM"],
    ["Milano", "MI"],
    ["milano", "MI"],
    ["MILANO", "MI"],
  ])("%s → %s", (input, expected) => {
    expect(sigla(input)).toBe(expected);
  });
});

describe("normalizzaProvincia — sigle dirette di 2 lettere", () => {
  it.each([
    ["MO", "MO"],
    ["CR", "CR"],
    ["pn", "PN"],
    ["ct", "CT"],
    ["mi", "MI"],
    ["MI", "MI"],
  ])("%s → %s", (input, expected) => {
    expect(sigla(input)).toBe(expected);
  });
});

describe("normalizzaProvincia — sigla MB e varianti Monza Brianza", () => {
  it.each([
    ["MB", "MB"],
    ["Mb", "MB"],
    ["mb", "MB"],
    ["Monza Brianza", "MB"],
    ["monza brianza", "MB"],
  ])("%s → MB", (input, expected) => {
    expect(sigla(input)).toBe(expected);
  });
});

describe("normalizzaProvincia — fuzzy match su typo comuni/province", () => {
  it.each([
    ["Milamo", "MI"],
    ["bolognia", "BO"],
    ["Potrnza", "PZ"],
    ["Mrssina", "ME"],
    ["lmperia", "IM"],
    ["Pia cenza", "PC"],
    ["Forli", "FC"],
  ])("%s → %s", (input, expected) => {
    expect(sigla(input)).toBe(expected);
  });
});

describe("normalizzaProvincia — combinazioni regione+capoluogo, vince il capoluogo", () => {
  it.each([
    ["Liguria Genova", "GE"],
    ["toscana pisa", "PI"],
    ["marche ancons", "AN"], // ancons → typo, fuzzy su Ancona
  ])("%s → %s", (input, expected) => {
    expect(sigla(input)).toBe(expected);
  });
});

describe("normalizzaProvincia — comuni non capoluogo", () => {
  it.each([
    ["Saviano", "NA"],
    ["Arconate", "MI"],
    ["Riccione", "RN"],
    ["Mondragone", "CE"],
    ["Olbia", "SS"],
    ["Biella", "BI"],
  ])("%s → %s", (input, expected) => {
    expect(sigla(input)).toBe(expected);
  });
});

describe("normalizzaProvincia — comuni con nomi composti lunghi", () => {
  it.each([
    ["San Giovanni in Fiore", "CS"],
    ["Castelnuovo di Porto", "RM"],
    ["Reggio nell'Emilia", "RE"],
    ["Monteforte d'Alpone", "VR"],
    ["Spilamberto di Modena", "MO"],
    ["vertemate con minoprio", "CO"],
  ])("%s → %s", (input, expected) => {
    expect(sigla(input)).toBe(expected);
  });
});

describe("normalizzaProvincia — input combinati con punteggiatura/sigle", () => {
  it.each([
    ["Polcenigo pn", "PN"],
    ["Cologno Monzese...Milano", "MI"],
    ["Apricena 71011", "FG"],
    ["gravina in puglia bari", "BA"],
    ["acireale ct", "CT"],
    ["Genzano di roma", "RM"],
    ["Civitavecchia Roma", "RM"],
    ["firenze e prato", "FI"],
    ["Pesaro/Urbino", "PU"],
    ["Pesaro e Urbino", "PU"],
  ])("%s → %s", (input, expected) => {
    expect(sigla(input)).toBe(expected);
  });
});

describe("normalizzaProvincia — CAP risolvono alla provincia", () => {
  it.each([
    ["47842", "RN"],
    ["73054", "LE"],
    ["80028", "NA"],
    ["80014", "NA"],
    ["64049", "TE"],
    ["83027", "AV"],
  ])("%s → %s", (input, expected) => {
    expect(sigla(input)).toBe(expected);
  });
});

describe("normalizzaProvincia — regioni da sole → null", () => {
  it.each([
    "Lombardia",
    "Campania",
    "Puglia",
    "Piemonte",
    "Veneto",
    "lazio",
    "toscana",
    "Italy",
    "Italia",
  ])("%s → null", (input) => {
    expect(sigla(input)).toBeNull();
  });
});

describe("normalizzaProvincia — garbage / domande / paragrafi → null", () => {
  it.each([
    "Ciao vorrei sapere quanto costa",
    "Dove?",
    "Info",
    "si",
    "Ma",
    "Hh",
    "lo",
    "informazioni",
    "vorrei sapere il prezzo",
    "<test lead: dummy data for in_che_provincia_risiedi_?>",
    "Quando si raschia via un nido di fango attaccato sotto una gronda, non si pulisce una macchia. Si cancella un indirizzo. Quel nido, una rondine lo ha costruito pallina dopo pallina.",
  ])("%s → null", (input) => {
    expect(sigla(input)).toBeNull();
  });
});

describe("normalizzaProvincia — input vuoto / nullish", () => {
  it("'' → null", () => {
    expect(sigla("")).toBeNull();
  });
  it("'   ' → null", () => {
    expect(sigla("   ")).toBeNull();
  });
  it("null → null", () => {
    expect(sigla(null)).toBeNull();
  });
  it("undefined → null", () => {
    expect(sigla(undefined)).toBeNull();
  });
});

describe("normalizzaProvincia — ritorna anche lo strato che ha fatto match", () => {
  it("Roma → strato 'comune' (Roma è anche capoluogo, è in lookup)", () => {
    const r = normalizzaProvincia("Roma");
    expect(r.sigla).toBe("RM");
    expect(["comune", "provincia"]).toContain(r.strato);
  });
  it("MI → strato 'sigla'", () => {
    expect(normalizzaProvincia("MI").strato).toBe("sigla");
  });
  it("47842 → strato 'cap'", () => {
    expect(normalizzaProvincia("47842").strato).toBe("cap");
  });
  it("Lombardia → strato 'regione'", () => {
    expect(normalizzaProvincia("Lombardia").strato).toBe("regione");
  });
  it("Milamo → strato 'fuzzy'", () => {
    expect(normalizzaProvincia("Milamo").strato).toBe("fuzzy");
  });
  it("Liguria Genova → strato 'token' (Genova è risolto come comune da token)", () => {
    expect(normalizzaProvincia("Liguria Genova").strato).toBe("token");
  });
});

describe("siglaToNomeProvincia — sigla → nome esteso per il display", () => {
  it.each([
    ["MI", "Milano"],
    ["RM", "Roma"],
    ["BO", "Bologna"],
    ["NA", "Napoli"],
    ["MB", "Monza e Brianza"],
    ["AO", "Aosta"],
    ["BZ", "Bolzano"],
    ["FC", "Forlì-Cesena"],
    ["PU", "Pesaro e Urbino"],
    ["RE", "Reggio Emilia"],
    ["RC", "Reggio Calabria"],
    ["AQ", "L'Aquila"],
    ["SP", "La Spezia"],
    ["VB", "Verbano-Cusio-Ossola"],
    ["SU", "Sud Sardegna"],
  ])("%s → %s", (sigla, expected) => {
    expect(siglaToNomeProvincia(sigla)).toBe(expected);
  });

  it("null → null", () => {
    expect(siglaToNomeProvincia(null)).toBeNull();
  });
  it("undefined → null", () => {
    expect(siglaToNomeProvincia(undefined)).toBeNull();
  });
  it("sigla inesistente → null", () => {
    expect(siglaToNomeProvincia("ZZ")).toBeNull();
  });
});

describe("normalizzaProvincia — performance: 10k record sotto 1ms/record", () => {
  it("10k record in tempo accettabile", () => {
    const sample = [
      "Roma", "Milano", "MI", "Milamo", "47842", "Liguria Genova",
      "Lombardia", "Hh", "vertemate con minoprio", "San Giovanni in Fiore",
    ];
    const N = 10000;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      normalizzaProvincia(sample[i % sample.length]);
    }
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(N); // 1ms/record di budget
  });
});
