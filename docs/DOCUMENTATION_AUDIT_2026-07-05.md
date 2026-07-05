# Documentation Audit & Cleanup Recommendations (2026-07-05)

**Svrha:** Revizija svih dokumenata u `docs/` i `docs/obsolete/` s preporukom što se trebalo obrisati, što ažurirati i kako organizirati za održivost.

**Povezani dokumenti:** `docs/FABLE_PLAN.md` (prioritetna akcija), `CLAUDE.md` (backlog koji se ažurira po sesijama)

---

## I. Analiza stanja po dokumentu

### AKTIVNI DOKUMENTI (docs/) — stanje i preporuka

#### A. Arhitektura i dizajn (trebalo bi čitati prije rada)

| Dokument | Zadnja ažurirana | Relevantnost | Akcija | Prioritet |
|----------|------------------|--------------|--------|-----------|
| `ARCHITECTURE_v1_6.md` | S97+ (implicit) | ✅ KRITIČNA — P1/P2/P3 pravila, chain_key, session identity | Učitaj na S104 da pojaviš parent event extract | — |
| `STRUCTURE_TAB_SPEC_FOR_DEV_v1.1.md` | S28+ | ✅ ČINI SE AŽURNA — sve feature su gotove; provjeri što nedostaje | **Provjeri je li §4 (leaf-with-events blok) i §5 (delete cascade) up-to-date nakon S33** | S105 |
| `RESTRUCTURE_DECISIONS_2026-04-01.md` | 2026-04-01 (decision log) | ✅ Vrijedan — decisions su se pokazale ispravnima; reference pri budućim planama | Arhivna vrijednost, obriši ničega | — |
| `COLLAB_PLAN_v2.md` | S41 (zadnja faza implementirana) | ✅ DOVRŠENA — sve Faze 0–7 su implementirane | Nije trebalo dalje ažurirati (decision log)  | — |
| `COLLAB_UX_DESIGN_v1.html` | S35 (wireframe) | ⚠️ OBSOLETNA — svi Decisions D1–D10 su implementirani (S36–S41) | **Prebaci u `docs/obsolete/`** — nije temeljen dokument | S105 |

#### B. Kako radi (izvršni vodiči)

| Dokument | Zadnja ažurirana | Relevantnost | Akcija | Prioritet |
|----------|------------------|--------------|--------|-----------|
| `Code_Guidelines_React_v6.md` | S97+ (implicit) | ✅ REFERENTNA — code conventions | Učitaj na S104 kod parent event extracta | — |
| `EXCEL_FORMAT_ANALYSIS_v2.md` | S102+ (implicit) | ⚠️ ZASTARJELA — v2 je zamijenjena v3 (Unified Workbook Format, S26–S27) | **Trebalo bi ažurirati ili prebaciti u obsolete/**; umjesto toga koristi `docs/help/excel.md` dinamički | S106 |
| `PLAYWRIGHT_E2E_GUIDE.md` | S97+ | ✅ E2E test setup — ne trebalo dalje ažurirati dok se test suite ne proširuje | — | — |
| `Playwright_Supabase_Setup_Guide.md` | Neizvjesno | ⚠️ MOGUCE ZASTARJELA — setup je bio S50 area; trebalo bi provjeriti je li još relevantno za TEST | **Provjeri je li CredentialsURL i postgres string i dalje valjani** | S105 (ako koristiš TEST) |

#### C. Nove feature specifications (ad-hoc, aktualne za budućnost)

| Dokument | Zadnja ažurirana | Relevantnost | Akcija | Prioritet |
|----------|------------------|--------------|--------|-----------|
| `TEMPLATE_SYSTEM_SPEC.md` | S49–S58 (done) | ✅ ARHIVNA — Feature je dovršena (demo Area, E11/E12 Playwright) | Obriši ničega (decision log) | — |
| `HELP_STRUCTURE.md` | S59–S81 (done) | ✅ AKTIVNA — mehanika Help sistema (3 taba, dinamički load, context chips) | **Trebalo bi update §4 (H1–H4 status); update na S108 nakon Analytics tab** | S108 |
| `Comment_Filter_Spec.md` | 2026-03-? | ⚠️ ZASTARJELA — nije jasno je li implementirana ili je samo design; trebalo bi provjeriti u kodu | **Provjeri je li `commentSearch` filter u `FilterContext` pokriva sve iz ovog spec-a** | S105 |
| `DATA_INTEGRATION_DESIGN.md` | 2026-07-04 (nova) | ✅ AKTIVNA — Garmin merge strategija + historijska migracija + photo matching | Reference za budućnost (nakon Diary); aktualizira se kad dođe Garmin merge | — |
| `AUTOMATION_SPEC.md` | S36+ (implicita, Faza 1–2 done) | ⚠️ PARCIJALNO IMPLEMENTIRANA — Rata tool (Faza 1) nije napravljena; auto-comment template (Faza 2) — trebalo bi provjeriti je li `comment_template` field u kategorijama | **Čeka Financije Tip/Podtip workflow (S104 prioritet 3)** | S109+ |
| `Analytics_tab.md` | 2026-07-04 (nova) | ✅ AKTIVNA — Period koncept, Fable F2 ideja | **Trebalo bi korisnikova feedback na §5 Open Questions prije S108** | S108 |
| `Help_details.md` | 2026-07-05 (nova) | ✅ AKTIVNA — Feature inventory format, Help sistemska evolucija | Integrirati s help/*.md dijelama kada se dodaju novi feature-i | S109+ |
| `Diary.md` | 2026-07-04 (nova) | ✅ AKTIVNA — Trening.xlsm migracija plan (7 koraka, mapping tablica) | **Koristi se tijekom S106–S107** | S106 |

#### D. Status tracking (održivanost)

| Dokument | Sadržaj | Akcija | Prioritet |
|----------|---------|--------|-----------|
| `FABLE_PLAN.md` | ✨ **NOVI** — S104–S110 prioriteti, sesijski redoslijed, doc. cleanup plan | **Ažurira se nakon S104/S105/... kada se stvarni rad razlikuje od plana** | S104 |

---

### ZASTARJELI DOKUMENTI (docs/obsolete/) — analiza

**Cilj:** Očistiti što je defakto superseded i nikad se neće čitati.

#### Status po fajlu

| Fajl | Razlog za brisanje | Superseded by | PREPORUKA |
|------|-------|-------------|-----------|
| `MULTI_USER_SHARING_ANALYSIS.md` | V1 analiza; sva logika je integrirana u COLLAB_PLAN_v2 (S34–S41) | COLLAB_PLAN_v2.md | **OBRIŠI** — nema vrijednosti kao arhiva |
| `ADD_ATTRIBUTE_SPEC.md` | Spec za Add Attribute feature (S28, done); nikad se više neće ponavljati | Commit S28 + Code | **OBRIŠI** — spec je u kodu, commit log govori cijelu priču |
| `ADD_CATEGORY_BETWEEN_SPEC_v1.md` | V1 spec; niži prioritet, nije prioritizirano | — | **OBRIŠI** — feature nije implementirana, spec je zastarjela |
| `ADD_CATEGORY_BETWEEN_SPEC_v2.md` | Ažurirana V1; još uvijek nije implementirana | — | **OBRIŠI** — feature nije prioritetna, spec bi trebala biti u backlog-u, ne u documenti |
| `COLLAB_PLAN_v1.md` | V1; zamijenjena v2 | COLLAB_PLAN_v2.md | **OBRIŠI** — V2 je dovršena verzija |
| `EXPORT_IMPORT_REFACTOR_PROPOSAL.md` | Proposal iz ranih dana; logika je integrirana u S26–S32 (Unified Workbook Format) | excelExport.ts + excelImport.ts + commit log | **OBRIŠI** — implementacija je u kodu, proposal je stara arhiva |
| `FAZA_10E_SMART_IMPORT_SPEC.md` | Smart import proposal; nikad nije prioritiziran (ili je odbijen kao kompleksan) | docs/Diary.md § 3–7 (koraci su objasnivi drugačije) | **OBRIŠI** — ne koristi se; Diary plan nema više specifikacije |
| `IMPORT_DIFF_SPEC.md` | Spec za Import diff feature (S28, done) | Commit S28 + excelImport.ts:430 (`hasChanges()`) | **OBRIŠI** — feature je implementirana |
| `RESTRUCTURE_ANALYSIS.md` | Analiza prije RESTRUCTURE_DECISIONS_2026-04-01.md | RESTRUCTURE_DECISIONS_2026-04-01.md | **OBRIŠI** — decisions dokument je dovršena verzija |
| `SUGGEST_DEPENDSON_SPEC_v2.md` | Spec za depends_on feature (S29–S30, done) | Commit S29 + StructureNodeEditPanel.tsx | **OBRIŠI** — feature je implementirana, spec je artefakt razvoja |

#### Zaključak za obsolete/:

**Preporuka:** Obriši svih 10 fajlova iz `docs/obsolete/`. 

**Razlog:** Nema njihove vrijednosti kao arhive — sve relevantne informacije su:
1. U commit logovima (Što se što kopnulo i zašto)
2. U živućim spec dokumentima (što je trebalo biti donijeto kao odluka)
3. U kodu (kako je zapravo implementirano)
4. U CLAUDE.md backlog-u (što je do kraja, što je pending)

Specifikacije iz razvoja postaju mrtvim važdom nakon implementacije. Ako trebola je kontekst, gitlog je bolji izvor od stare spec-a (jer prikazuje što se promijenilo tijekom implementacije).

---

## II. Što trebalo obavezno ažurirati kada se S104 završi

### 1. Ažuriranje CLAUDE.md backlog-a

**Sadržaj koji trebalo update-ati:**

```markdown
### Done (through S104)
- ✅ Fable 5 critical findings fixed:
  - Delete Activity bug (session_start → chain_key filter) — S104
  - Parent event logic extracted to upsertParentEvent() — S104
  - BUG-S102-DELETE: live event count recheck — S104
  - Quick wins Q1–Q6 (batch insert, import progress, ILIKE escape) — S104

### Open bugs (main)
- **BUG-S103-ANYATTR:** [SOLUTION DEFERRED TO S105] See docs/FABLE_PLAN.md § I.5
```

### 2. Ažuriranje MIGRATION_STATE.md (nakon II.7 — S107)

```markdown
| trening.xlsm (ručni log)  | ✅ S106 | ✅ S107  | ✅ S107 | ✅ S107 | ✅ S107 | ✅ S107 | `Dnevnik > Trening dnevnik` (Area + leaf)  |
```

### 3. Ažuriranje docs/HELP_STRUCTURE.md (nakon S108)

```markdown
### H5. Analytics tab (S108+)
- Period management modal
- Series (category + attr + agg) selection
- Charts integration
- Drill-down workflows
```

---

## III. Prijedlog nove doc. strukture (ako trebalo na reorg)

Sadašnja struktura je dovoljna, ali ako trebalo后来, evo smislene organizacije:

```
docs/
├── ARCHITECTURE_v1_6.md           (P1/P2/P3, data model)
├── Code_Guidelines_React_v6.md    (code conventions)
├── FABLE_PLAN.md                   (S104–S110 strategic plan)  ✨ NOVO
├── DOCUMENTATION_AUDIT_2026-07-05.md (this file)  ✨ NOVO
│
├── Features/
│   ├── RESTRUCTURE_DECISIONS_2026-04-01.md
│   ├── COLLAB_PLAN_v2.md
│   ├── TEMPLATE_SYSTEM_SPEC.md
│   ├── AUTOMATION_SPEC.md
│   ├── Analytics_tab.md
│   ├── DATA_INTEGRATION_DESIGN.md
│   ├── Diary.md
│   └── Help_details.md
│
├── Guides/
│   ├── EXCEL_FORMAT_ANALYSIS_v2.md   (trebalo bi update ili move to help/)
│   ├── PLAYWRIGHT_E2E_GUIDE.md
│   ├── Playwright_Supabase_Setup_Guide.md
│   └── HELP_STRUCTURE.md
│
├── help/                            (dinamički učitani, ne mijenja se ručno)
│   ├── activities.md
│   ├── attributes.md
│   ├── concepts.md
│   ├── excel.md
│   ├── sharing.md
│   ├── structure.md
│   └── templates.md
│
└── obsolete/
    └── (EMPTY — svi su obrisani)
```

**Prednost:** Fajlovi su intuitivno grupirani. Nedostatak: ne trebalo reorganizirati prije nego što nema pritiska.

**Preporuka:** Zaobiđi ovu reorg za sada. Ako trebalo, iskoristi ju nakon što su sve aktivne sekcije (S110) dovršene.

---

## IV. Što NIKADA ne obriši

| Dokument | Razlog |
|----------|--------|
| `ARCHITECTURE_v1_6.md` | Temelj cijelog sistema — P1/P2/P3 su invarijante |
| `FABLE_REVIEW_2026-07-03.md` | Vrijedna kritika — 7 arhitekturalnih problema što trebalo implementirati |
| `FABLE_PLAN.md` | Strateški plan — trebalo za S104–S110 redoslijed |
| `RESTRUCTURE_DECISIONS_2026-04-01.md` | Decision log — kontekst za budućnost |
| `Code_Guidelines_React_v6.md` | Konvencije — trebalo za new code |
| `CLAUDE.md` | Šef — sve je zbrojeno tamo |

---

## V. Checklist za S105 (nakon S104 je završena)

```
[ ] Provjeri je li STRUCTURE_TAB_SPEC_FOR_DEV_v1.1.md §4–§5 još relevantno
[ ] Prebaci COLLAB_UX_DESIGN_v1.html → docs/obsolete/
[ ] Ažurira CLAUDE.md: Done (S104) sekcija
[ ] Provjerite EXCEL_FORMAT_ANALYSIS_v2.md — trebalo li ažurirati ili premjestiti?
[ ] Zatvori COMMENT_FILTER_SPEC.md ako je implementirana; obriši ako nije prioritetna
[ ] Spremi S105 notes za FABLE_PLAN.md (što se razlikovalo od plana?)
[ ] Čitaj docs/Diary.md za II.1 preparation
```

---

## VI. Zaključak

**Preporuka:** 
1. **Sada (S105):** Obriši 10 fajlova iz `docs/obsolete/` — nema njihove vrijednosti
2. **S105:** Prebaci `COLLAB_UX_DESIGN_v1.html` → `obsolete/` (ili obriši)
3. **S108:** Ažurira `docs/HELP_STRUCTURE.md` § H5 za Analytics tab
4. **S110:** Ažurira `FABLE_PLAN.md` § Što se desilo — lessons learned log

**Održivost:** Živući dokumenti (`ARCHITECTURE`, `FABLE_PLAN`, `CLAUDE.md`) se ažuriraju nakon svake sesije. Spec dokumenti (`COLLAB_PLAN_v2`, `TEMPLATE_SYSTEM_SPEC`, itd.) se NE moraju ažurirati nakon implementacije — commit log je izvor istine.
