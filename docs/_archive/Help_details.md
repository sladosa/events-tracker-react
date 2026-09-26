# Help Details — "What can I do here?" Feature Inventory & Evolucija Help sistema

**Datum:** 2026-07-05
**Svrha:** Sadržajna podloga za standing chip `"✨ What can I do on this screen?"` u Help panelu,
strategija prikaza po kontekstu (mobile/desktop, modal/stranica) i mehanizam kojim se help
automatski dopunjava kad se dodaju novi featurei (npr. Analytics tab, Tools/Connectors).

Povezani dokumenti: `docs/HELP_STRUCTURE.md` (mehanika help sistema), `docs/help/*.md` (izvor istine
za AI znanje). Ovaj dokument definira ŠTO ide u "Feature inventory" sekcije tih fajlova i KAKO se
sistem održava.

---

## 1. Princip: što chip treba pokazati

Cilj chipa nije ponoviti ono što korisnik vidi na ekranu ("ovdje je tablica aktivnosti"), nego
otkriti mogućnosti koje **ne bi sam otkrio**:

- funkcije skrivene iza ikona bez labele (💾 pored Shortcuts dropdowna, ⚡ Use, ⋮ meniji)
- funkcije koje se pojavljuju samo u određenom stanju (orphan banner, Manage Access badge,
  collision dijalog, "Tuđi zapis" ekran)
- konvencije koje nisu vidljive u UI-u (`_` sentinel u Excelu, P3 pravilo, delta shift)
- workflow-e koji spajaju više ekrana (Excel roundtrip, Export Profile, Shortcut s atributima)

Format odgovora AI-a na chip: **kratka orijentacija (2-3 rečenice) + lista mogućnosti grupirana
po "vidljivo odmah" / "skriveno iza akcija" / "napredno"**, na jeziku korisnika.

---

## 2. Feature inventory po kontekstima

Svaka sekcija niže ide (prilagođena) u odgovarajući `docs/help/*.md` fajl pod naslov
`## Feature inventory`. AI ih čita dinamički — `help.ts` se ne mijenja.

### 2.1 Kontekst: `home-general` (AppHome shell — zajedničko za oba taba)

**Vidljivo odmah:**
- Dva taba: **Activities** (unos i pregled zapisa) i **Structure** (uređivanje hijerarhije kategorija)
- Filter panel (collapse/expand na mobitelu)
- Help FAB (ovaj panel) — 3 taba: Pitaj AI / Koncepti / Povratna info

**Skriveno iza akcija:**
- **Avatar u headeru → Profile settings** (`ProfileSettingsModal`): promjena display imena —
  to ime vide drugi korisnici u User koloni i share pozivnicama; tu je i Sign out
- **🔗 Manage Access badge** u filter baru — pojavljuje se samo owneru kad odabrana Area ima
  aktivne shareove; otvara Share Management modal (aktivni pristupi + pending pozivnice +
  invite forma, inline read↔write dropdown)
- **Shared Area banner** — pojavljuje se kad je odabrana shared Area: ljubičasti (owner),
  zeleni (write grantee), amber (read grantee); grantee tu vidi ownera i može zatražiti
  promjenu pristupa

**Napredno / koncept:**
- Sve što vidiš ovisi o **filteru** — Area + Category + period + sort su globalno stanje koje
  dijele tablica, export i Prev/Next navigacija u View ekranu

### 2.2 Kontekst: `filter` (Filter panel — sekcija unutar Activities)

**Vidljivo odmah:**
- Area dropdown → Category dropdown (progresivni odabir L1 → L2 → ... → leaf; možeš stati na
  bilo kojoj razini — filter tada obuhvaća cijelu granu)
- Period (danas / tjedan / mjesec / godina / custom raspon), sort (najnovije/najstarije)
- "Reset cat." — resetira samo kategoriju, Area ostaje

**Skriveno iza akcija:**
- **Shortcuts dropdown** — spremljeni brzi pristupi; odabir postavlja Area + Category + filter state
- **💾 ikona** pored dropdowna — spremi trenutni filter kao Shortcut (radi i za non-leaf granu —
  korisno za izvještaje/exporte)
- **⚡ Use gumb** — kad odabrani shortcut vodi do leaf kategorije, preskače filter i odmah otvara
  Add Activity s prefill-om
- **🗑 ikona** — brisanje shortcuta
- **Filter by dropdown**: Comment (pretraga komentara), specifični atribut (za suggest atribute
  dropdown opcija, za text/number partial match), ili **"In any attribute"** (tekst kroz sve
  atribute odjednom)

**Napredno:**
- Shortcut može nositi i **predefinirane vrijednosti atributa** — ali samo ako se spremi iz
  Add Activity stranice ("💾 Save as Shortcut" gumb ispod atributa). Tako spremljen shortcut
  prefilla formu (polja su odmah "touched", Save aktivan bez dodatnog unosa). Za istu kategoriju
  možeš imati više varijanti (Update postojećeg / Save as new).
- **Filter ↔ Excel veza:** postavke filtera zapisuju se u **Filter sheet** exportanog workbooka.
  Ako taj fajl importaš kao **Export Profile**, redovi Period key / Sort order / Comment filter /
  Attribute filter postaju **override** za buduće exporte s tim profilom (prazna ćelija =
  naslijedi live filter; `_` = eksplicitno obriši filter). Detalji u `docs/help/excel.md`.

### 2.3 Kontekst: `activities` (Activities tab — tablica)

**Vidljivo odmah:**
- Zapisi grupirani po **sesiji** (isti session start = jedan blok); klik na red otvara View
- **User kolona** (kad Area ima shareove): avatar s inicijalima + "You" badge za vlastite zapise
- Add Activity gumb (zelen); disabled za read grantee-a (tooltip objašnjava)

**Skriveno iza akcija:**
- **⋮ meni po redu — stanja:**
  - vlastiti zapis: View / Edit / Delete
  - tuđi zapis (shared Area): samo View
  - orphan zapis (owner): + "Manage orphan events"
- **Checkboxi na redovima** → bulk brisanje odabranih (samo owner)
- **Export / Import gumbi** (na mobitelu unutar filter panela, sekcija "Excel")
- **Orphan banner** (amber, samo owner): "N users no longer have access · M activities" —
  [View events] filtrira samo orphan redove; [Manage] otvara modal s Re-invite / Claim events /
  Delete events po korisniku

**Napredno:**
- Comment search i attribute filter rade **server-side** — možeš pretraživati i po tekstu u
  svim atributima ("In any attribute"); za grantee-e na velikim shared areama ta pretraga može
  biti spora (poznato ograničenje)
- Brisanje zapisa briše **cijelu sesiju** tog lanca (leaf + parent evente)

### 2.4 Kontekst: `add` (Add Activity)

**Vidljivo odmah:**
- Progresivni odabir kategorije do leafa; datum + vrijeme sesije; atributi; Comment; Save

**Skriveno iza akcija:**
- **"N polja skrivena — Prikaži"** na dnu forme: polja čija vrijednost = `default_value`
  automatski su skrivena; klik ih otkriva. Jednom ručno promijenjeno polje ostaje vidljivo.
- **Uvjetna polja (`depends_on`)**: neka polja se pojavljuju tek kad drugi atribut ima određenu
  vrijednost (npr. "Broj rata" tek kad označiš "Na rate?")
- **Suggest dropdown + "Other"**: upis nove opcije — sprema se trajno u listu tek na Finish
- **💾 Save as Shortcut** (ispod atributa): sprema kategoriju + trenutno ispunjene vrijednosti
  kao prefill za buduće unose; nudi Update / Save as new ako shortcut za kategoriju već postoji
- **Post-Finish automatizacije**: za neke kategorije nakon Save iskoči modal (npr. generiranje
  rata); auto-comment template po kategoriji

**Napredno / koncept:**
- Save automatski kreira/ažurira **parent evente** na svim razinama iznad leafa (1 po razini po
  sesiji) — zato i parent kategorije mogu imati atribute (npr. "Trajanje treninga" na razini
  Trening, a serije/kile na leafu)
- Vrijeme sesije zaokružuje se na minutu; dvije aktivnosti u istoj minuti = ista sesija
- Read grantee vidi lock ekran — unos moguć samo s write pristupom

### 2.5 Kontekst: `edit` (Edit Activity)

**Vidljivo odmah:**
- Ista forma kao Add, amber tema; učitane postojeće vrijednosti

**Skriveno iza akcija:**
- **Promjena vremena = delta shift**: svi zapisi sesije (leaf + parenti) pomiču se za istu razliku
- **Collision check**: ako novo vrijeme sudara s postojećom sesijom, dobiješ upozorenje
- Suggest "Other" opcije i ovdje se trajno spremaju na Finish

**Napredno:**
- **Tuđi zapis** (shared Area): umjesto forme prikazuje se "Tuđi zapis" + link na View — tuđe
  zapise možeš gledati, ne uređivati
- P3 pravilo: brisanje vrijednosti u formi NE briše je u bazi ako je polje ostalo netaknuto;
  eksplicitno isprazni polje (touched) da se obriše

### 2.6 Kontekst: `view` (View Details)

- **Prev/Next** navigacija kroz zapise **unutar trenutnog filtera** (radi i na tuđim zapisima);
  na mobitelu swipe lijevo/desno
- Edit gumb — samo za vlastite zapise
- Prikazuje i parent atribute cijelog lanca sesije

### 2.7 Kontekst: `structure` (Structure tab)

**Vidljivo odmah:**
- Tablica hijerarhije (Area → L1 → ... → leaf) ili **Sunburst** grafikon (view switcher)
- Leaf kategorije bez zapisa imaju "no events yet" badge
- Import / Export gumbi (struktura, ne aktivnosti)

**Skriveno iza akcija:**
- Klik na red → **Detail panel** (atributi, broj zapisa, putanja)
- **Edit Mode** (samo owner) — otključava po redu:
  - **Rename** čvora
  - **Uređivanje atributa**: dodavanje (inline forma), brisanje (s upozorenjem ako postoje
    podaci), promjena defaulta, sort, **→ Suggest** konverzija text atributa, uređivanje
    suggest opcija, **depends_on** editor (WhenValue/Options tablica, + Add Dependency)
  - **Add Child** (blokirano na leafu koji već ima zapise)
  - **Delete** — kaskadno; ako grana ima zapise, nudi **Download Backup & Delete** (puni xlsx
    backup prije brisanja)
- **Add Area** — nova top-level Area, opcija **"From template"** (starter struktura iz predloška,
  npr. Demo Area)
- **⋮ meni po redu — stanja:**
  - owner: View / Edit / Add Child / Delete / **Manage Access** (uvijek vidljiv, i izvan Edit Mode)
  - grantee: owner info + copy email + request access

**Napredno:**
- Structure Import je **non-destruktivan**: kreira novo, preskače postojeće (po slugu), ništa
  ne briše; nakon importa dobiješ conflict report
- `depends_on` može referencirati atribut **parent razine** (ancestor) — dropdown grupira
  po razini

### 2.8 Cross-cutting: `sharing`

- **Share Management modal** (3 ulaza: badge u filter baru, ⚙ u Structure owner banneru,
  ⋮ meni na Area redu): aktivni pristupi s inline read↔write dropdownom, pending pozivnice
  (cancel), invite forma po emailu
- **Read vs Write**: read = samo pregled (Add/Edit/bulk disabled); write = dodavanje i
  uređivanje vlastitih zapisa u tuđoj Arei
- **Revoke** opcije kad grantee ima zapise: revoke only (zapisi ostaju kao orphan) →
  vidi Orphan banner u Activities
- Grantee opcije izlaska: Leave without data / Detach with data

### 2.9 Cross-cutting: `excel` — Excel roundtrip (proširena verzija)

Excel je **primarni bulk workflow** aplikacije. Osnovna petlja:

```
1. EXPORT   →  2. UREDI U EXCELU   →  3. IMPORT
   (filter        (dodaj redove,         (diff pregled:
   određuje       ispravi vrijednosti,    zeleno=novo,
   što izlazi)    masovne izmjene)        žuto=izmjena,
                                          sivo=identično/preskočeno)
```

**Zašto ovako:** masovni unos (npr. 50 treninga, godišnje financije) brži je u Excelu nego
klik-po-klik; masovne korekcije (reklasifikacija, ispravci) rade se filter+fill-down pa reimport.

**Što treba znati po koracima:**

1. **Export** poštuje trenutni filter (Area/Category/period/attr filter). Workbook sadrži:
   Events sheet (LEGEND gore — redoslijed LEGEND redaka određuje redoslijed kolona; EVENT DATA
   dolje), Structure sheet (hijerarhija + slugovi), Filter sheet (postavke exporta),
   skriveni DropdownData sheet.
2. **Uređivanje**: suggest atributi imaju prave Excel dropdownove; dependent suggest radi preko
   INDIRECT-a (odabir parent vrijednosti mijenja opcije dependent kolone). Category path u
   Events sheetu je **bez** imena Aree; u Structure sheetu **s** imenom.
3. **Import**: prepoznaje sesije po datum+vrijeme; identični zapisi se preskaču (diff);
   izmijenjeni se ažuriraju po P3 pravilu (**prazna ćelija nikad ne briše** postojeću vrijednost —
   za eksplicitno brisanje upiši **`_`**); nove kategorije u fajlu → modal nudi
   "Create categories & continue"; tuđi zapisi (User email kolona) → Skip ili "Import as mine".
4. **Export Profile**: uredi širine/grupiranje kolona i LEGEND redoslijed u Excelu → Import
   Profile → profil se trajno sprema po imenu za tu Area; Filter sheet redovi tada djeluju kao
   override budućih exporta (vidi 2.2).
5. **Backup**: Delete grane s podacima u Structure tabu nudi isti xlsx format kao backup —
   može se reimportati.

---

## 3. Relevantnost po uređaju i stanju (mobile / desktop / modal)

### 3.1 Prioritetna hijerarhija konteksta

Kad korisnik otvori Help, kontekst se određuje **od najspecifičnijeg prema općem**:

```
1. Otvoren modal/panel     → pričaj o NJEMU (npr. ShareManagementModal, ExcelImportModal,
                              StructureNodeEditPanel, Orphan modal)
2. Expandirana sekcija      → npr. otvoren Filter panel → filter/shortcuts sadržaj
3. Aktivna stranica/tab     → activities / structure / add / edit / view
4. Fallback                 → general: glavni dijelovi aplikacije + koncepti + smjerovi
```

**Implementacija** (proširenje postojećeg D4 patterna iz `HELP_STRUCTURE.md`):
- `HelpContext` dobiva drugi hint: `modalHint: string | null` uz postojeći `pageHint`
- Komponenta koja otvara modal poziva `setModalHint('share-management')` na mount,
  `setModalHint(null)` na unmount (custom hook `useHelpModalHint('share-management')` —
  jedan `useEffect`, opt-in po modalu)
- `useCurrentPage()` u HelpPanelu: `modalHint ?? pageHint ?? route-based`
- "What can I do here?" chip šalje AI-u efektivni kontekst; AI odgovara iz Feature inventory
  sekcije tog konteksta

Opt-in modalne kontekste uvoditi samo za najkompleksnije (redoslijed po vrijednosti):
`share-management`, `excel-import`, `structure-edit-panel`, `export-modal`, `orphan-events`.

### 3.2 Mobile vs desktop

Ne treba odvojen sadržaj — treba **odvojen redoslijed i doza**:

- **Signal uređaja**: `isMobile` već postoji u AppHome; poslati `device: 'mobile' | 'desktop'`
  u help API context (uz postojeći `{ page, areaId }`)
- **Mobile odgovor**: prvo gdje su stvari *na mobitelu* (Import/Export su unutar filter panela,
  ne u toolbaru; swipe gesture u View; tab labele su ikone), kraće liste (top 5 mogućnosti +
  "pitaj za više")
- **Desktop odgovor**: puni inventory, uključivo keyboard/hover detalje (tooltipovi, hover akcije)
- U feature inventory fajlovima označiti razlike inline markerom, npr.
  `(mobitel: unutar Filter panela · desktop: toolbar)` — AI ih onda sam filtrira po `device` polju
- **Broj chipova**: mobile 2, desktop 3 — "What can I do here?" chip uvijek prvi

### 3.3 Fallback "general" sadržaj (kad nema specifičnog konteksta)

Kratka mentalna mapa umjesto liste featurea:
1. **Structure** = definiraj ŠTO pratiš (kategorije + atributi) → jednom, povremeno dorađuješ
2. **Activities** = svakodnevni unos i pregled → Add Activity ili Excel import
3. **Excel** = masovni unos/izmjene → export-uredi-import petlja
4. **Sharing** = pozovi drugoga u svoju Area (read ili write)
5. Smjerovi za dublje: "pitaj me o sesijama", "pitaj me o shortcutima", "pitaj me o Excel workflow-u"

---

## 4. Samodopunjavanje help sistema (bez posebnog podsjećanja)

Cilj: kad se doda novi tab (Analytics) ili sekcija (Tools/Connectors), help se dopuni
**strukturno prisilno**, a ne memorijom/disciplinom.

### 4.1 Konvencija: 1 kontekst = 1 fajl = 1 manifest zapis

Uvesti **frontmatter** u svaki `docs/help/*.md`:

```markdown
---
context: activities            # pageHint/modalHint vrijednost
title: Activities tab
chips:
  - "✨ What can I do on this screen?"
  - "How do I add an activity?"
  - "What is a session?"
updated: 2026-07-05
---
```

- `HelpPanel` **generira CHIPS mapu iz frontmattera** (build-time import preko
  `import.meta.glob('/docs/help/*.md', { as: 'raw' })` ili mali Vite plugin) umjesto
  hardkodiranog `CHIPS` objekta
- Novi tab = novi `docs/help/analytics.md` s frontmatterom → chipovi i AI znanje rade odmah,
  **nula izmjena u HelpPanel.tsx ili help.ts**

### 4.2 Guard koji lomi build kad help fali (ključni dio)

Mali skript `scripts/check-help-coverage.mjs` u `npm run typecheck && npm run build` lancu
(koji se ionako izvršava prije svakog commita + u GitHub Actions):

1. Grep po `src/`: sve literal vrijednosti u `setPageHint('...')`, `setModalHint('...')` i
   route-based hintovima u `useCurrentPage()`
2. Usporedi s `context:` vrijednostima u `docs/help/*.md` frontmatterima
3. Hint bez help fajla → **build fail** s porukom:
   `Missing docs/help/<context>.md — create it with frontmatter (see Help_details.md §4.1)`

Efekt: kad se doda `setPageHint('analytics')`, build pukne dok ne nastane `analytics.md`.
Claude (ili bilo tko) je prisiljen napisati help sadržaj u istoj sesiji — bez podsjećanja.
Trošak: ~50 linija skripte, bez runtime overheada.

### 4.3 Sadržajna svježina (za postojeće kontekste)

Guard hvata *nove* kontekste; za *izmjene postojećih* featurea:

- **CLAUDE.md end-of-session korak 4 ostaje** primarni mehanizam, ali s konkretnijim triggerom:
  "ako je sesija dirala fajl koji je entry point nekog konteksta (AppHome, Add/Edit/View,
  Structure komponente, sharing komponente) → provjeri odgovarajući help fajl"
- Opcionalno pojačanje (kad se skupi potreba): skript uspoređuje `git log -1 --format=%cs`
  ključnih src fajlova s `updated:` frontmatterom pripadnog help fajla i **upozorava** (ne lomi
  build) kad je kod noviji > 30 dana
- **Content Evolution Protocol** (help_log analiza iz HELP_STRUCTURE.md) ostaje feedback petlja
  odozdo: pitanja koja se ponavljaju = rupa u inventoryju → dopuni odgovarajuću sekciju

### 4.4 Što se NIKAD ne dira automatski

- `netlify/functions/help.ts` statički prompt = samo Demo Area putanje, pravila tona, app framing
  (postojeće pravilo — vrijedi i dalje)
- Concepts tab u HelpPanel.tsx = ručno kurirani koncepti; dopunjava se kroz Content Evolution,
  ne kroz feature inventory

---

## 5. Redoslijed implementacije

| # | Korak | Veličina | Ovisi o |
|---|-------|----------|---------|
| 1 | Napisati `## Feature inventory` sekcije u postojećih 7 `docs/help/*.md` (sadržaj iz §2) | M (content) | — |
| 2 | Standing chip "✨ What can I do on this screen?" u `CHIPS` (prvi chip u svim kontekstima) | S | 1 |
| 3 | `device` polje u help API context + mobile/desktop upute u system promptu (2 rečenice) | S | — |
| 4 | Frontmatter + chips iz frontmattera (ukida hardkodirani CHIPS) | M | 1 |
| 5 | `check-help-coverage.mjs` guard u build | S | 4 |
| 6 | `modalHint` + `useHelpModalHint` hook, opt-in za share-management i excel-import | M | 2 |

Koraci 1–3 daju vidljivu vrijednost odmah; 4–5 su mehanizam samodopunjavanja; 6 je finoća.
