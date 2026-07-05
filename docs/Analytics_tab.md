# Analytics Tab + Period koncept — Design Doc v1

**Datum:** 2026-07-04
**Autor:** Claude Fable 5 (nastavak Fable review-a 2026-07-03, sekcija "Što nije u ovom dokumentu")
**Status:** PRIJEDLOG — čeka odluke (vidi Open Questions na dnu)

Cilj dokumenta: dizajn **Period** entiteta (vremenski raspon koji opisuje projekt, putovanje,
životnu fazu) koji se korelira s eventima iz različitih Area, te **cross-area kombiniranje**
lanaca kategorija i atributa (UI + Excel format). Oboje se sastaje u novom **Analytics tabu**.

---

## 0. Terminologija — POZOR na koliziju imena

U kodu već postoji `periodKey` (`FilterContext.tsx:33`, `ProfileFilterState.periodKey` u
`exportProfile.ts`) — to je **relativni date-range preset** (`'this-year'`, `'last-3-months'`,
`'custom'`, `'all-time'`). To NIJE ovaj koncept.

| Pojam | Što je | Gdje živi |
|-------|--------|-----------|
| `periodKey` (postojeći) | Relativni preset za date range filtera | FilterContext, Filter sheet, Export Profile |
| **Period** (novi entitet) | Imenovani, korisnikov, apsolutni vremenski raspon sa semantikom ("Japan 2026", "Priprema za maraton", "Renovacija stana") | Nova tablica `periods` |
| **Series** (novi koncept) | Jedna definicija podataka za analitiku: kategorijski lanac + atribut + agregacija | Sekcija 3 |

U UI-ju Period entitet zovemo **"Period"**, postojeći preset dropdown ostaje "Date range".
Integracijska točka: Date range dropdown dobiva optgroup **"My periods"** — odabir perioda
postavlja `dateFrom`/`dateTo` + `periodKey='custom'`, bez ikakve promjene u query pipelineu.
To je najjeftiniji prvi korak i radi u Activities tabu odmah (Faza 1).

---

## 1. Period entitet — alternative i trade-offovi

Ključno svojstvo EAV modela koje sve olakšava: **svaki event već ima `event_date` (date) i
`session_start` (timestamptz)**, neovisno o Arei. Vremenska korelacija je dakle *besplatna* —
pitanje je samo koliko preciznu semantiku članstva ("ovaj event pripada ovom periodu") želimo.

### Alternativa A — `periods` tablica + temporalna korelacija (query-time)

Nova first-class tablica; eventi se NE mijenjaju. Članstvo = `event_date BETWEEN date_start
AND date_end`, izračunato u query-ju.

```sql
CREATE TABLE public.periods (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  date_start date NOT NULL,
  date_end date,                    -- NULL = još traje ("ongoing")
  color text,                       -- za timeline/chart prikaz
  icon text,
  description text,
  scope jsonb DEFAULT '{}'::jsonb,  -- opcionalni filter, vidi 1.5
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- RLS: user_id = auth.uid() (periodi su OSOBNI, ne dijele se — vidi 1.6)
```

**Za:**
- Nula migracije na `events` — retroaktivno radi na svih ~N tisuća postojećih eventa odmah.
- Preklapajući periodi prirodno rade ("Q1 2026" i "Japan trip" se preklapaju — event je u oba).
- Cross-area besplatno: korelacija je vremenska, ne strukturna.
- Excel roundtrip netaknut — periodi ne diraju Events sheet format.

**Protiv:**
- Samo temporalna semantika: plaćanje stanarine *tijekom* putovanja u Japan upada u "Japan
  2026" iako s putovanjem nema veze. Treba mehanizam isključivanja (→ Alternativa D).

### Alternativa B — Period kao Area/kategorija u postojećem EAV modelu

"Periods" Area, svaki period = leaf kategorija s atributima `date_start`/`date_end`
(datetime), event po periodu za bilješke.

**Za:**
- Nula novog koda za CRUD — Structure tab, Excel roundtrip, RLS, atributi: sve već radi.
- Period može imati proizvoljne atribute (budžet, lokacija, cilj...) bez schema promjena.

**Protiv:**
- Semantičko nasilje: period nije aktivnost. P2 (session identity), collision detection,
  "no events yet" badge — sve se ponaša čudno za ovakav pseudo-sadržaj.
- Datumi perioda žive u `event_attributes.value_datetime` → join za "svi eventi u periodu"
  postaje EAV-na-EAV upit, ružan i spor, bez indeksa na raspon.
- Discovery: Analytics tab bi morao "znati" koja Area je magična. Konvencija umjesto tipa.

### Alternativa C — Eksplicitni junction (`period_events`)

Ručno dodjeljivanje eventa (ili sesija) periodima; M:N tablica.

**Za:**
- Maksimalna preciznost — stanarina tijekom puta jednostavno nije dodijeljena.
- Event u više perioda eksplicitno.

**Protiv:**
- Teret ručne dodjele ubija adopciju: 3000+ postojećih eventa, plus svaki novi unos traži
  još jedan korak. Za tracking app koji živi od brzine unosa (Shortcuts, prefill) to je
  regresija.
- Excel Import/Add/Edit flow — sva tri unosa trebaju UI za dodjelu. Velik surface.

### Alternativa D — Period kao atribut na eventima

`Period` suggest atribut (npr. na L1 razini svake Aree), popunjava se pri unosu.

**Protiv (fatalno):**
- Mora se znati unaprijed — periodi su često retroaktivni ("zadnja 3 mjeseca su zapravo
  bila 'burnout faza'").
- Denormalizacija: preimenovanje perioda = bulk update tisuća `event_attributes` redova.
- Duplikacija po Arei (P1 atributi su per-kategorija) — isti period definiran N puta.
- Ne podržava preklapanje (jedan atribut = jedna vrijednost).

Odbačeno bez daljnjeg razmatranja.

### 1.5 PREPORUKA — Hybrid A + session-level overrides (+ scope filter)

**Temelj = Alternativa A** (temporalna korelacija), s dva opcionalna sloja preciznosti:

**Sloj 1 — `scope` JSONB na periodu** (deklarativno sužavanje):

```jsonc
// periods.scope — prazan {} = svi eventi u rasponu (default)
{
  "include": [
    { "area_slug": "financije", "category_path": "Transakcija" },
    { "area_slug": "fitness" }                    // cijela Area
  ],
  "attr_filters": [                               // opcionalno, isti oblik kao AttrFilterState
    { "attr_slug": "lokacija", "value": "Japan", "isExact": false }
  ]
}
```

Time "Japan 2026" može reći: *iz Financija samo eventi gdje Lokacija=Japan, iz Fitness sve,
Health ništa*. Scope se evaluira client-side (isti mehanizam kao postojeći
`filterToLeafCategories` + attr filter u `eventQueryBuilder.ts`).

**Sloj 2 — override tablica na razini SESIJE** (kirurški izuzeci):

```sql
CREATE TABLE public.period_session_overrides (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_id uuid NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  -- Session identitet po P2: session_start + chain_key (leaf category id).
  -- Za legacy evente bez chain_key: chain_key = leaf category_id sesije.
  session_start timestamptz NOT NULL,
  chain_key uuid NOT NULL REFERENCES public.categories(id),
  mode text NOT NULL CHECK (mode IN ('include','exclude')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (period_id, session_start, chain_key)
);
```

Granularnost je **sesija, ne event** — u skladu s P2: parent chain eventi jedne sesije nemaju
smisla polovično u periodu. `exclude` rješava stanarinu-tijekom-puta; `include` rješava
"kupnja opreme 2 tjedna PRIJE puta pripada putu".

Zašto ne FK na `events.id`: sesija je logička jedinica (1 leaf + N parenata, a kod
multi-leaf sesija i više lanaca), a `session_start + chain_key` je već kanonski identitet
sesije u cijelom codebaseu (collision detection, delete, Excel merge). Edit Activity
delta-shift mijenja `session_start` → treba hook koji ažurira override redove (ili ih
tretiramo kao izgubljene — override je "best effort"; odluka OQ-3).

**Redoslijed evaluacije članstva:**
1. `event_date` u `[date_start, date_end]` (ili `date_end IS NULL` → do danas)
2. AND prolazi `scope` (ako scope nije prazan)
3. XOR override: `exclude` izbacuje, `include` ubacuje i izvan raspona/scopea

### 1.6 Trade-off tablica (sažetak)

| Kriterij | A: temporal | B: EAV pseudo-Area | C: junction | D: atribut | **Hybrid (A+overrides)** |
|---|---|---|---|---|---|
| Migracija postojećih podataka | nikakva | nikakva | ručni rad | bulk write | nikakva |
| Retroaktivnost | ✅ | ✅ | ⚠️ ručno | ❌ | ✅ |
| Preciznost članstva | ⚠️ gruba | ⚠️ gruba | ✅ | ⚠️ | ✅ (opt-in) |
| Preklapajući periodi | ✅ | ✅ | ✅ | ❌ | ✅ |
| Trošak unosa novog eventa | 0 | 0 | +1 korak | +1 polje | 0 |
| Novi kod | S | ~0 (ali hack) | M–L | S | M |
| Query performanse | ✅ indeks na date | ❌ EAV join | ✅ | ⚠️ EAV filter | ✅ |
| Excel roundtrip utjecaj | nikakav | nikakav | novi sheet nužan | nova kolona | opcionalan sheet |

**RLS i collab:** periodi su osobni (`user_id = auth.uid()`), i vlastiti periodi smiju
gledati evente iz shared Area (SELECT na evente ionako ide kroz postojeće RLS — period samo
sužava datume). Dijeljenje perioda s granteeima = eksplicitno izvan scopea v1 (OQ-4).

---

## 2. Analytics tab — UI koncept

Novi treći tab u `AppHome` (Activities | Structure | **Analytics**). Sve read-only → nema
P2/P3 rizika, nema write path-a osim CRUD-a nad `periods` i `analytics_views`.

```
┌─ Analytics ────────────────────────────────────────────────┐
│ Period: [Japan 2026 ▼]  [⚙ Manage periods]  [+ New period] │
│ ── ili: Compare: [Japan 2026] vs [Portugal 2025]           │
├────────────────────────────────────────────────────────────┤
│ KPI kartice (jedna po Series, vidi §3):                    │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│ │ Troškovi     │ │ Treninzi     │ │ Prosj. san   │         │
│ │ 2.340 €      │ │ 12 sesija    │ │ 6h 51m       │         │
│ │ Financije    │ │ Fitness      │ │ Health       │         │
│ └──────────────┘ └──────────────┘ └──────────────┘         │
├────────────────────────────────────────────────────────────┤
│ Timeline (Plotly, već u bundleu — vendor-plotly):          │
│   X = vrijeme, trake perioda kao pozadinski shapes,        │
│   serije kao line/bar/scatter po time bucketu              │
├────────────────────────────────────────────────────────────┤
│ Session lista perioda (postojeći ActivitiesTable,          │
│   filtriran na period, s Area kolonom) + per-session       │
│   ⋮ → "Exclude from period" / "Include" (Sloj 2)           │
└────────────────────────────────────────────────────────────┘
```

Napomene:
- Plotly je već plaćen u bundle sizeu (4.9MB, koristi se samo za Sunburst) — line/bar/scatter
  ne dodaju ništa mjerljivo. Ovo je bio i Fable review nalaz F2.
- "Manage periods" = jednostavan CRUD modal (name, raspon, boja, scope builder).
- Period selector u Analytics tabu je NEOVISAN o FilterContext filteru — Analytics gleda
  cross-area po definiciji, globalni Area filter tu ne vrijedi. (Alternativa — da Analytics
  poštuje globalni filter — odbačena: poanta taba je upravo bijeg iz single-area pogleda.)

---

## 3. Cross-area kombiniranje — koncept "Series"

Problem: lanci kategorija i atributi žive unutar jedne Aree; želimo ih kombinirati
("pace iz Fitnessa uz težinu iz Healtha uz potrošnju iz Financija, po tjednima").

**Series** = jedna imenovana definicija podataka:

```typescript
interface AnalyticsSeries {
  label: string;                 // "Troškovi hrane"
  areaSlug: string;              // 'financije'
  categoryPath: string | null;   // 'Transakcija > Kategorija' — subtree root; null = cijela Area
  attrSlug: string | null;       // 'iznos' — null = COUNT sesija (bez atributa)
  agg: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'last';
  bucket: 'day' | 'week' | 'month' | 'total';
  attrFilter?: { attrSlug: string; value: string; isExact: boolean };  // npr. Tip=Hrana
  chartType?: 'line' | 'bar' | 'kpi';
}
```

**Zašto slug-based, a ne ID-based:** slugovi su stabilni (nikad se ne mijenjaju — pravilo iz
schema komentara), čitljivi u Excelu, i preživljavaju Structure Import/re-kreaciju kategorija.
Resolve slug→id se radi pri učitavanju (isti pattern kao `structureImport.ts` slug lookup).

**Join semantika između serija iz različitih Area:** jedina smislena zajednička os je
**vrijeme**. Session-level join preko Area nema značenje (sesije se ne poklapaju), pa je
kanonski oblik rezultata *long format*:

```
(bucket_date, series_label, value)
```

iz kojeg se rade i chartovi i Excel pivot. Bucketiranje client-side (dan iz `event_date`,
tjedan ISO, mjesec) — količine podataka po periodu su male (stotine sesija).

**Query plan po seriji** (naučene lekcije ugrađene):
1. Kategorije subtree-a: jedan `.eq('area_id', ...)` fetch + in-memory walk (pattern iz
   `filterToLeafCategories`) — NE rekurzivni per-node upiti (Fable nalaz 1.6, N+1).
2. Eventi: `category_id IN (leafIds)` + date range perioda; jedan upit po seriji, serije
   paralelno (`Promise.all`).
3. Atributi: **uvijek s `attribute_definition_id` pre-filterom** (imamo attrDefId nakon slug
   resolve-a) — nikad ILIKE preko cijele `event_attributes` (lekcija BUG-S103-ANYATTR:
   ILIKE nije leakproof, RLS EXISTS se evaluira po cijeloj tablici za granteeje).
4. Number agregacije čitaju `value_number` (ne text-parse) — veže se na backlog stavku
   "Potpuni attrFilter za number/boolean/datetime".

**Spremanje definicija:**

```sql
CREATE TABLE public.analytics_views (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  series jsonb NOT NULL,          -- AnalyticsSeries[]
  default_period_id uuid REFERENCES public.periods(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- RLS: user_id = auth.uid()
```

JSONB umjesto normaliziranih redova: serije se čitaju/pišu uvijek kao cjelina view-a, nema
potrebe za per-series querijima, a format je identičan Excel redovima (§4) — jedan
(de)serializer za oba smjera. Presedan u projektu: `validation_rules` JSONB,
`preset_default_attributes`.

**UI builder:** po jednoj seriji reuse `ProgressiveCategorySelector` (Area → chain) + attr
dropdown (iz `useAttributeDefinitions` za odabrani node) + agg/bucket selecti. Builder je
u "Manage view" modalu; casual korisnik samo bira gotov view iz dropdowna.

---

## 4. Excel format — `AnalyticsDef` sheet

U duhu projekta (Excel roundtrip = primarni bulk workflow), definicija view-a mora biti
izraziva i u Excelu. Dvije nove stvari u workbooku:

### 4.1 `AnalyticsDef` sheet (definicija — import/export)

Jedan red = jedna Series. Kolone (sve text, dropdown validacije gdje moguće):

| Kolona | Primjer | Napomena |
|---|---|---|
| A `Label` | `Troškovi hrane` | jedinstven unutar view-a |
| B `Area` | `Financije` | area **slug** u komentaru ćelije; ime za čitljivost |
| C `Category_Path` | `Transakcija > Kategorija` | **bez area imena** — isti format kao Events sheet col C (postojeće pravilo!); prazno = cijela Area |
| D `Attribute_Slug` | `iznos` | prazno = COUNT sesija |
| E `Agg` | `sum` | dropdown: sum/avg/min/max/count/last |
| F `Bucket` | `month` | dropdown: day/week/month/total |
| G `Filter_Attr_Slug` | `tip` | opcionalno |
| H `Filter_Value` | `Hrana` | opcionalno |
| I `Exact` | `TRUE` | boolean |
| J `Chart` | `bar` | dropdown: line/bar/kpi |

Plus header blok iznad tablice (key-value, isti stil kao Filter sheet): `View name`,
`Period` (ime perioda ili `custom` + `Date From`/`Date To` — ista ISO-guard logika kao
`readFilterFromWorkbook` u `exportProfile.ts`).

Import path: novi parser u `excelUtils.ts` (slug resolve + validacijski report u istom stilu
kao Structure Import conflict report — nepostojeći slug = warning red, ne hard fail).
**Pazi na postojeća OOXML pravila:** promptTitle ≤32 / prompt ≤255 znakova za data validation
input messages (Critical rule iz CLAUDE.md).

### 4.2 `AnalyticsData` sheet (rezultat — samo export)

Long format, pivot-ready:

| Bucket | Series | Value | Unit | Period |
|---|---|---|---|---|
| 2026-05 | Troškovi hrane | 412.50 | € | Japan 2026 |
| 2026-05 | Treninzi | 9 | | Japan 2026 |

Korisnik u Excelu radi pivot/chart po volji — ne pokušavamo replicirati Excel u appu, samo
dostaviti čist dataset. Ovo je i escape hatch dok Analytics UI ne pokrije neki use case.

### 4.3 Odnos s Export Profile sistemom

Export Profile (`exportProfile.ts`) ostaje netaknut — on definira *oblik Events sheeta jedne
Aree*. `AnalyticsDef` je paralelan, viši sloj (cross-area, agregirano). Jedina veza:
`ProfileFilterState` čitanje Filter sheeta je pattern koji se kopira za AnalyticsDef header
blok. Ne spajati ta dva sistema (razmatrano i odbačeno: multi-area Export Profile bi
slomio pretpostavku 1 workbook = 1 Area u cijelom import pipelineu).

---

## 5. Fazni plan

**Faza 1 — Period entitet (S, ~1 sesija):**
`sql/03X_periods.sql` (periods + RLS), `usePeriods` hook, CRUD modal, optgroup
**"My periods"** u postojećem Date range dropdownu (postavlja dateFrom/dateTo +
periodKey='custom'). Vrijednost odmah, bez novog taba.

**Faza 2 — Analytics tab, read-only (M):**
Tab skeleton, period selector, KPI kartice + timeline za hardkodirani "sve Aree, count
sesija" pogled. Plotly line/bar. Session lista perioda.

**Faza 3 — Series builder + saved views (M):**
`analytics_views` tablica, UI builder, view dropdown. Ovdje se rješava i backlog
"Potpuni attrFilter za number/boolean/datetime" (agregacije ga ionako trebaju).

**Faza 4 — Excel roundtrip (S–M):**
`AnalyticsData` export (samo čitanje — jeftino, prvo), pa `AnalyticsDef` import.

**Faza 5 — Preciznost članstva (S, po potrebi):**
`scope` builder UI + `period_session_overrides` + ⋮ exclude/include u session listi.
Svjesno zadnje: temporal-only pokriva 90% vrijednosti, overrides su polish.

---

## 6. Open Questions (odluke prije Faze 1)

- **OQ-1:** Treba li period `date_end IS NULL` ("ongoing") u v1, ili uvijek zatvoren raspon?
  (Prijedlog: da, NULL = do danas — trivijalno u queryju.)
- **OQ-2:** Compare mode (2 perioda side-by-side) u Fazi 2 ili kasnije? (Prijedlog: kasnije;
  v1 = jedan period, ali long format s Period kolonom ga već priprema.)
- **OQ-3:** Edit Activity delta-shift mijenja `session_start` — ažurirati
  `period_session_overrides` (trigger/app-side) ili prihvatiti "best effort" gubitak
  overridea? (Prijedlog: app-side update u EditActivityPage, isti transaction block gdje
  se već radi delta-shift; trigger je overkill.)
- **OQ-4:** Vide li grantee-ji ownerove periode na shared Arei? (Prijedlog: ne u v1 —
  periodi su privatni; sharing perioda je zaseban feature ako se ikad pokaže potreba.)
- **OQ-5:** KPI za `count` — brojati sesije ili leaf evente? (Prijedlog: sesije —
  `COUNT(DISTINCT session_start, chain_key)` — jer je sesija korisnikova mentalna jedinica;
  P2 parent eventi se NIKAD ne broje.)

---

## 7. Sažetak preporuke

1. **Period = standalone `periods` tablica, temporalna korelacija po `event_date`** (Hybrid,
   §1.5) — nula migracije, retroaktivno, preklapanje radi, cross-area besplatno. Preciznost
   se dodaje opt-in slojevima (scope JSONB, session-level overrides), ne unaprijed.
2. **Cross-area kombiniranje = Series koncept** — slug-based definicije, time-bucket join,
   long format; spremljeno kao `analytics_views.series` JSONB, uređivano kroz UI builder
   koji reuse-a ProgressiveCategorySelector.
3. **Excel = `AnalyticsDef` (definicija, roundtrip) + `AnalyticsData` (rezultat, pivot-ready
   long format)** — paralelno s, ne unutar, Export Profile sistema.
4. Redoslijed izvedbe: Period + "My periods" u date dropdownu prvo (najveća vrijednost po
   satu rada), Analytics tab i builder poslije, overrides zadnje.
