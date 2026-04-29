# Swapa Dashboard — Documentazione tecnica

## Panoramica progetto

Dashboard di reporting per il cliente **Swapa** (Filante Motors srl), costruita in Next.js e deployata su Vercel. Legge i dati in tempo reale dal CRM Relatia tramite API REST. Nessun auth, pubblica.

Obiettivo: permettere al team Swapa di monitorare i lead in entrata, le prenotazioni di Video Call e Test Drive, la distribuzione per fonte e per provincia.

---

## Stack tecnico

- **Framework**: Next.js (App Router)
- **Stile**: Tailwind CSS
- **Grafici**: Recharts
- **Deploy**: Vercel
- **API**: Relatia CRM (chiamate server-side via Route Handlers per evitare CORS)

---

## Credenziali e configurazione API

| Variabile | Valore |
|---|---|
| `RELATIA_BASE_URL` | `https://filante.relatiacrm.com` |
| `RELATIA_TOKEN` | `4Vn_W36esPVZIyO4TNCu4aybG-de63Lo7pRt8mvqmlXuJDvnRrTe7mRi4dn6MXAT` |

Header da usare in ogni chiamata:
```
Authorization: Bearer 4Vn_W36esPVZIyO4TNCu4aybG-de63Lo7pRt8mvqmlXuJDvnRrTe7mRi4dn6MXAT
```

File `.env.local` nella root:
```
RELATIA_TOKEN=4Vn_W36esPVZIyO4TNCu4aybG-de63Lo7pRt8mvqmlXuJDvnRrTe7mRi4dn6MXAT
RELATIA_BASE_URL=https://filante.relatiacrm.com
```

---

## Endpoint API Relatia utilizzati

Tutti gli endpoint supportano paginazione. Iterare finché la risposta non restituisce una pagina vuota o un campo `next: null`.

| Metodo | Endpoint | Note |
|---|---|---|
| `GET` | `/api/contacts/` | Lista contatti, supporta `?page=N` |
| `GET` | `/api/contacts/{id}/` | Dettaglio singolo contatto |
| `PATCH` | `/api/contacts/{id}/` | Aggiorna contatto |
| `GET` | `/api/deals/` | Lista deal, filtro `?pipeline_id=UUID` |
| `GET` | `/api/deals/{id}/` | Dettaglio singolo deal |
| `PATCH` | `/api/deals/{id}/` | Aggiorna deal |
| `POST` | `/api/deals/move_pipeline/` | Sposta deal tra pipeline |
| `GET` | `/api/appointments/` | Lista appuntamenti |
| `POST` | `/api/appointments/` | Crea appuntamento |
| `GET` | `/api/users/` | Lista utenti CRM |
| `GET` | `/api/contact-sources/` | Lista sorgenti |
| `GET` | `/api/pipelines/` | Lista pipeline |

### Note tecniche importanti
- `assigned_to` in lettura è un oggetto `{id, name}`, in scrittura si usa `assigned_to_id` (intero)
- `source_new_id` (non `source`) per evitare errori di chiave duplicata nei PATCH
- I PATCH sulle deal richiedono trailing slash sull'endpoint
- La risposta di `POST /api/webhook/website/` restituisce `contact_id` (UUID)

---

## Struttura dati

### Contatto — campi rilevanti

| Campo | Tipo | Note |
|---|---|---|
| `id` | UUID | Identificatore univoco |
| `first_name` | string | |
| `last_name` | string | |
| `email` | string | |
| `phone` | string | |
| `city` | string | Usato per provincia |
| `created_at` | datetime | |
| `source_new` | oggetto `{id, name}` | Sorgente contatto |
| `source_new_id` | intero | Usare nei PATCH |
| `assigned_to` | oggetto `{id, name}` | Commerciale assegnato |
| `lead_score` | intero | |

### Campi custom Swapa

| Campo | Valori possibili | Descrizione |
|---|---|---|
| `website_tipo_app` | `"Video Call"`, `"Test Drive"` | Tipo appuntamento scelto |
| `meta_campaign_name` | stringa | Nome campagna Meta |
| `meta_adset_name` | stringa | Nome adset Meta |
| `meta_ad_name` | stringa | Nome annuncio Meta |
| `meta_form_id` | stringa | ID form Meta |
| `meta_leadgen_id` | stringa | ID lead Meta |
| `meta_platform` | stringa | Piattaforma Meta (Facebook/Instagram) |
| `meta_is_organic` | boolean | Lead organico o a pagamento |
| `desidero` | `"prenotare_un_test_drive"`, `"maggiori_informazioni"` | Intenzione dichiarata |
| `desideri_finanziare_l'importo_` | `"sì"`, `"no"` | Interesse finanziamento |
| `in_che_provincia_risiedi_` | testo libero | Provincia del lead |
| `e_mail` | stringa | Duplicato del campo email |

### Deal — campi rilevanti

| Campo | Tipo | Note |
|---|---|---|
| `id` | UUID | |
| `contact_id` | UUID | Riferimento al contatto |
| `current_stage_id` | UUID | Stage attuale |
| `current_stage` | oggetto `{id, name}` | |
| `created_at` | datetime | |
| `assigned_to` | oggetto `{id, name}` | |

---

## Pipeline e stage Swapa

**Pipeline ID**: `356e94ad-170a-4cee-9e6a-e5b2438ab211`
**Nome**: Swapa

| Stage | ID | Colore dashboard | Descrizione |
|---|---|---|---|
| Videocall | `52a28729-58ac-4777-9a9d-ac874c1988c1` | viola `#9C6FE8` | Video call prenotata |
| Follow up | `03108e8e-47b7-46e0-978e-080701784fc2` | blu `#3B6FE8` | In follow up commerciale |
| Hot Lead | `80473b43-709e-4039-ad73-0d3fcd4d74e6` | blu `#3B6FE8` | Lead ad alta priorità |
| Long Term | `110c5405-fac0-4f68-9216-3be40e6e8a48` | blu `#3B6FE8` | Lead a lungo termine |
| Test Drive LOMBARDIA | `2503dba8-a62e-4c3a-bc4a-07fe7a19026b` | verde `#4CAF7D` | Test drive prenotato in Lombardia |
| Test Drive LAZIO | `824dd0b3-cfa1-4ae7-ad9f-2670bab92731` | verde `#4CAF7D` | Test drive prenotato nel Lazio |
| Test Drive PIEMONTE | `5c32feb9-67bf-492d-8ad2-dfd2317aee81` | verde `#4CAF7D` | Test drive prenotato in Piemonte |
| Test Drive CAMPANIA | `8d80016f-9142-41ea-96ef-e289508cd1f1` | verde `#4CAF7D` | Test drive prenotato in Campania |
| Test Drive TOSCANA | `26c0d748-63cb-415d-93b0-a3499821e49c` | verde `#4CAF7D` | Test drive prenotato in Toscana |
| Test Drive ROMAGNA | `a1c13da3-5ffd-4701-8bcb-c2256b1578e0` | verde `#4CAF7D` | Test drive prenotato in Romagna |
| Order | `133d8a6a-ea84-4393-8fc4-fc7b296333d8` | gold `#F59E0B` | Ordine confermato |
| Trade In | `fe17a3ba-0afe-4734-a111-1d49a16ea318` | arancione `#F97316` | Permuta attiva |

---

## Sorgenti contatto

| ID | Nome |
|---|---|
| 1 | Paid Google |
| 4 | Organic |
| — | Meta Lead Ads (nome da API) |

---

## Utenti CRM (commerciali Swapa)

| ID | Nome | Email |
|---|---|---|
| 144 | Mirko Del Prete | mdprete@filantemotors.it |
| 143 | Martina Perrucci | mperrucci@filantemotors.com |
| 133 | Francesco Farina | fmfarina@filantemotors.it |

---

## Architettura Route Handlers

Tutte le chiamate a Relatia partono server-side dai Route Handlers Next.js, mai dal client (evita CORS).

```
/app
  /api
    /contacts/route.ts     → GET /api/contacts/ con paginazione
    /deals/route.ts        → GET /api/deals/?pipeline_id=...
    /appointments/route.ts → GET /api/appointments/
  /page.tsx                → Pagina principale dashboard
  /layout.tsx              → Layout con font Inter
```

Ogni Route Handler:
1. Legge i query params (filtri data, sorgente, stage)
2. Chiama Relatia con paginazione automatica (loop fino a `next: null`)
3. Restituisce JSON al client
4. Usa `cache: { next: { revalidate: 300 } }` (aggiornamento ogni 5 minuti)

---

## Struttura dashboard (pagina principale)

### Filtri (sticky in alto)
- Date range: data inizio / data fine (default: ultimo mese)
- Sorgente: select multipla (Meta Lead Ads / Paid Google / Organic / Tutti)
- Stage: select multipla (tutti gli stage pipeline)
- Bottone "Aggiorna"

### Sezione 1 — KPI Cards
5 card in griglia:
1. **Totale Lead**
2. **Video Call prenotate** (`website_tipo_app = "Video Call"`)
3. **Test Drive prenotati** (`website_tipo_app = "Test Drive"`)
4. **Mai risposto** (deal in stage Mai risposto)
5. **Tasso di conversione** ((Video Call + Test Drive) / Totale %)

### Sezione 2 — Breakdown Sorgente × Tipo Appuntamento
Tabella incrociata: righe = sorgenti, colonne = Video Call | Test Drive | Nessuno | Totale + % sul totale sorgente.

### Sezione 3 — Breakdown Provincia × Tipo Appuntamento
Tabella incrociata: righe = province (`in_che_provincia_risiedi_`), colonne = Video Call | Test Drive | Nessuno | Totale. Ordine decrescente per totale, prime 20.

### Sezione 4 — Andamento Lead nel Tempo
Grafico a linee (Recharts): asse X = date, linee = Totale / Video Call / Test Drive.

### Sezione 5 — Tabella Contatti
Paginata 50 per pagina, colonne: Nome | Telefono | Fonte | Provincia | Tipo App | Stage | Assegnato a | Data creazione. Ogni riga cliccabile → apre `https://filante.relatiacrm.com/contacts/{id}` in nuova tab.

---

## Stile e design

Ispirato all'interfaccia Relatia CRM.

```css
/* Palette */
--bg-page:        #F8F9FB;
--bg-card:        #FFFFFF;
--border:         #E8EAF0;
--accent-blue:    #3B6FE8;   /* principale, bottoni */
--accent-green:   #4CAF7D;   /* Test Drive, successo */
--accent-purple:  #9C6FE8;   /* Video Call */
--text-primary:   #1A1A2E;
--text-secondary: #6B7280;

/* Badge Tipo Appuntamento */
/* Video Call  → bg #EDE9FE, testo #7C3AED */
/* Test Drive  → bg #D1FAE5, testo #065F46 */
/* Nessuno     → bg #F3F4F6, testo #6B7280 */

/* Border radius */
/* Card: 8px — Badge: 6px */

/* Font: Inter (Google Fonts) */
```

Tabelle: header `#F3F4F6`, righe alternate `#FAFAFA`.

---

## Funnel cliente

```
Lead da Meta Ads / Google Ads
        ↓
Entra in Relatia via webhook (POST /api/webhook/website/)
        ↓
Prenota su Calendly → Video Call o Test Drive
        ↓
Appuntamento creato su Google Calendar (split 50/50 Mirko / Jason Suraci)
        ↓
Video Call → link Google Meet automatico
        ↓
Deal spostato nello stage corretto (Videocall / Test Drive)
        ↓
Email conferma (Gmail SMTP) + WhatsApp (Spoki)
        ↓
Reminder WhatsApp 24h prima
        ↓
Dopo appuntamento → deal spostato allo stage successivo
```

---

## Deploy su Vercel

1. `vercel` dalla root del progetto
2. Aggiungere le variabili d'ambiente nel pannello Vercel:
   - `RELATIA_TOKEN`
   - `RELATIA_BASE_URL`
3. Il dominio generato da Vercel è quello da condividere con il cliente

---

## Note per Cursor

- Leggere sempre questo file prima di generare o modificare codice
- Le chiamate API vanno sempre nei Route Handlers, mai nel client
- I campi custom Swapa hanno nomi con caratteri speciali (apostrofi, underscore finali) — usare bracket notation: `contact["desideri_finanziare_l'importo_"]`
- La paginazione Relatia va gestita con loop, non con una singola chiamata
- Il token va sempre letto da `process.env.RELATIA_TOKEN`, mai hardcoded
