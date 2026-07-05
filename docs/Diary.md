# DIARY migracija — strategija (trening.xlsm)

**Datum:** 2026-07-04
**Izvor:** `trening.xlsm`, sheet DIARY (sličice 1, 2), ~7000 redaka, od ~2015 (vjerojatno ranije)
**Status:** Strategija — nije počето. U `MIGRATION_STATE.md` = red "trening.xlsm (ručni log)".
**Povezani dokumenti:** `data-prep_tools/DATA_PIPELINE_PLAN.md` (Dirty Excel Workflow, PROD checklist),
`data-prep_tools/Tools/excel_import_template.py` (referentni generator)

---

## 1. Odgovor na centralno pitanje: gdje je granica "sirovo vs. modeliraj prvo"

**Granica ide točno po onome što sudjeluje u identitetu importa i po tipovima podataka.
Sve ostalo smije ući sirovo.**

Zašto: Excel Import matcha evente po **`session_start` + area/category path**. Dok god su ti
stabilni između dva pokretanja generatora, re-import istog raspona = UPDATE (import diff,
`hasChanges()`), ne duplikat. To znači da je **generator skripta re-runnable** — možeš je
popravljati i re-importati koliko god puta želiš, jeftino. P3 ("last non-empty wins") + `_`
sentinel dodatno znače da se pojedine vrijednosti mogu korigirati naknadnim roundtripom.

Iz toga slijedi asimetrija troška:

| Odluka | Trošak promjene NAKON importa | Zaključak |
|---|---|---|
| Area / leaf kategorija (gdje event živi) | Visok — delete + reimport, ili restructure alati | **Odluči prije** |
| Granularnost (što je 1 event) | Visok — split/merge eventa je ručni posao | **Odluči prije** |
| `session_start` pravilo (datum + fiksno vrijeme) | Visok — mijenja identitet, reimport = duplikati | **Odluči prije** |
| `data_type` atributa (text/number/datetime) | Srednji — migracija vrijednosti (pace lekcija iz Garmina) | **Odluči prije** |
| Vrijednosti atributa | Nizak — P3 roundtrip, `_` sentinel | Sirovo je OK |
| Suggest opcije, defaulti, depends_on | Nizak — Structure Edit ili Structure import | Sirovo je OK |
| Imena i slugovi atributa | Nizak — slug rename je siguran (S56) | Sirovo je OK |
| Comment tekst | Nizak — roundtrip | Sirovo je OK |

**Dakle: NE treba puni "Dirty Excel Workflow" staging (`raw_col_A`, `raw_col_B`...) iz
`DATA_PIPELINE_PLAN.md`** — on je za slučaj kad mapiranje kolona NIJE poznato. Ovdje ti možeš
objasniti što je koja kolona značila po eri, pa idemo direktno s tipiziranim atributima +
sigurnosnom mrežom za neparsirano (vidi §5).

---

## 2. Ključne dizajn odluke (zona "modeliraj prvo")

### 2.1 Granularnost: 1 redak DIARY = 1 dan = 1 event

Leaf "Dan" u dnevničkoj kategoriji. **Aktivnost je suggest atribut** (snaga, Z2, track, ODMOR,
recovery, PUT, istezanje, putovanje...), NE odvojene leaf kategorije po tipu aktivnosti.

Obrazloženje:
- DIARY je **subjektivni dnevni sloj** (mood, intenzitet, komentari, projekti). Objektivni
  per-aktivnost sloj **već postoji** — `Fitness_Garmin` (3134 aktivnosti, 2015–2025).
  Razdvajanje po aktivnostima dupliciralo bi Garmin strukturu bez koristi.
- Idealni scenarij korisnika je "rekonstruirati sličnu tabelu" — tabela je dnevna, red po red.
  Jedan leaf = jedna tablica u Activities viewu i u Excel exportu.
- ODMOR/PUT dani **se importaju** (aktivnost=ODMOR itd.) — bez njih se tjedna analiza i
  rekonstrukcija tabele raspadaju.

### 2.2 Tjedni summary redovi: NE importati

"Summary for week", Total time, Running km... su **izvedeni podaci** — rekonstruiraju se
exportom (SUBTOTAL redovi već postoje u export headeru od S68) ili pivotom u Excelu.
Importati ih znači zauvijek održavati dva izvora istine.

### 2.3 Vlastita, privatna Area — NE u Health_Saša, NE u Fitness_Garmin

Kolona **Private comment** (AM) sadrži osobni dnevnik (HRV, body battery, privatne bilješke).
`Health_Saša` je **shared read s Kokom** — dnevnik tamo ne smije. Sharing je per-area, pa
privatnost = vlastita area:

```
Dnevnik (Area — privatna, nikad ne dijeliti)
└── Trening dnevnik (L1, leaf) — svi atributi ovdje
```

Minimalno: jedna area, jedan leaf. Kasnije se može Add Between / restrukturirati ako zatreba
(alati postoje od S55/S64).

### 2.4 `session_start` pravilo

`datum + fiksno vrijeme`, npr. **06:00**, zaokruženo na minutu (kritično pravilo). Fiksno
vrijeme mora biti **konzistentno zauvijek** — to je identitet. Ako se iz Comment kolone da
parsirati stvarno vrijeme treninga ("9:45 CleverFIT...") — **ne koristiti ga za session_start**
(nekonzistentno popunjeno → identitet bi ovisio o parsiranju), nego spremiti kao zaseban
atribut ako uopće treba (Garmin ionako ima točna vremena).

Kolizija s Garmin Daily Metrics eventima istog dana nije problem — različita kategorija =
različit chain.

### 2.5 Tipovi atributa (jedina skupa "čistoća" prije importa)

Prijedlog seta, na temelju sličica (finalizirati u koraku arheologije, §4):

| Atribut | Tip | Napomena |
|---|---|---|
| `aktivnost` | text + suggest | snaga, Z2, track, ODMOR, recovery, PUT, istezanje... |
| `intenzitet` | text + suggest | light / moderate / hard |
| `mood` | text + suggest | :-) / :-| / ... (normalizirati na fiksni set) |
| `teren` | text + suggest | brda, ... |
| `duljina_km` | **number** | za SUM/AVG analize |
| `trajanje_min` | **number** (minute) | konverzija iz h:mm:ss; number omogućuje tjedne sume |
| `pace` | **text** "MM:SS" | ustaljena lekcija iz Garmin importa — nikad number |
| `hr_avg`, `hr_max` | number | parse iz "HR 107(131)" |
| `t_ef` | text | "t.ef.2,1/0" — kompozitni format, ostaviti text |
| `kcal` | number | parse iz HR_comment kolone |
| `opt` | number | ako je konzistentan; inače text |
| `privatni_komentar` | text | kolona AM |
| `projekti` | text | kolona DS (PROJEKTI log) |
| — Comment (M) | → **event comment** | glavni opis treninga, ostaje slobodni tekst |

Odluke koje NE treba donositi sada: suggest opcije (dopunjive), defaulti, depends_on,
redoslijed kolona (Export Profile to rješava naknadno).

### 2.6 Preklapanje s Fitness_Garmin: svjesno prihvatiti duplikaciju

Length/time/pace postoje i u dnevniku i u Garminu. **Zadržati dnevničke vrijednosti** —
to su korisnikove kurirane brojke i trebaju za rekonstrukciju tabele. Analize su ionako
per-area, pa duplikacija ne smeta. Odluka je svjesna, ne slučajna.

---

## 3. Minimalni set koraka

**Korak 0 (preduvjet, isplativ prije 7000-redčanog importa):** batch INSERT za
`event_attributes` u `excelImport.ts` + progress indikator u `ExcelImportModal`
(Fable review Q3+Q4; rješava i UX-Import-1). Bez toga: 7000 redaka × ~10 atributa ≈ 70k+
sekvencijalnih poziva = potencijalno 30+ min "frozen" importa. Alternativa ako se korak 0
preskače: **import po godinama** (isti savjet kao Garmin Daily Metrics PROD, S77).

**Korak 1 — Kolonska arheologija (1 sesija, zajedno u chatu):**
- Python audit skripta (pattern: `garmin_full_field_audit.py`): za svaku kolonu po godini —
  fill rate, distinct vrijednosti, type guess. Otkriva točno **gdje je kolona promijenila svrhu**.
- Korisnik objašnjava značenja po eri → output: **mapping tablica**
  `kolona → era (raspon redaka/datuma) → značenje → target atribut + tip + transformacija`.
- Ova tablica ide u ovaj dokument (§6) i jedini je "spec" koji generator treba.

**Korak 2 — Identitetske odluke:** potvrditi §2.1–2.5 (granularnost, area, session_start
pravilo, tipovi). Ovo je jedina zona gdje greška košta.

**Korak 3 — Kostur strukture:** generator piše i Structure sheet (kao svi dosadašnji importeri)
→ "Create categories & continue" flow sam kreira strukturu pri prvom importu. Ništa ručno.
⚠️ Suggest atributi: `AttrType='text'` + `Val.Type='suggest'` (ne 'suggest' kao data_type).

**Korak 4 — Generator skripta:** `data-prep_tools/Fitness/diary_to_xlsx.py`, kopija
`excel_import_template.py`. Per-era mapiranje iz tablice (§6). Sve što se ne da parsirati
→ sigurnosna mreža (§5), redak se NE preskače.

**Korak 5 — TEST import + iteracija:** import (po godinama), spot check
(`db_inspector.py --area "Dnevnik"` + app), PROD-ready checklist iz `DATA_PIPELINE_PLAN.md`.
Generator se popravlja i re-runna slobodno — identitet je stabilan pa je re-import UPDATE.

**Korak 6 — Čišćenje NAKON importa (jeftina zona):** Excel roundtrip po periodima —
export → ispravke u Excelu → reimport (P3 + `_`). Ili AI-assisted cleaning recepti
(db_inspector → SQL/Python) za sistematske uzorke.

**Korak 7 — PROD + ažurirati `MIGRATION_STATE.md`.**

---

## 4. Sigurnosna mreža za neparsirano (umjesto staging area)

Ustaljeni house pattern (Financije_3 `[DATUM_GREŠKA: ...]`):

- Vrijednost koja ne prolazi parse za svoj target atribut → **ostaje u event commentu** s
  markerom, npr. `[RAW hr: "HR12?(131)"]`, atribut ostaje prazan.
- Markeri su **pretraživi comment filterom** u appu → lako se nađu, poprave u Excelu, reimport.
- Redak se nikad ne preskače — svaki dan iz dnevnika postoji kao event, pa i "prljav".

Time se dobiva ono najbolje od "importaj sirovo": ništa se ne gubi, čišćenje je odgodivo i
inkrementalno — bez troška staging area i druge migracije staging → final.

---

## 5. Rekonstrukcija "slične tabele" + analize (idealni scenarij)

Već postojeći alati pokrivaju cilj bez novog koda:

- **Tabela:** Excel Export + **Export Profile** (S100/S102b) — redoslijed kolona, širine,
  filter overridi (period, sort) spremljeni u `area.settings.export_profiles`. Jednom se
  posloži "DIARY layout" profil → svaki export reproducira poznatu tabelu.
- **Periodi:** period filteri (this-year, last-3-months, custom...) + `periodKey` u
  Export Profile Filter sheetu.
- **Tjedne/mjesečne sume:** SUBTOTAL redovi u export headeru (S68) + pivot u Excelu.
  Dugoročno: Analytics tab (Fable F2 ideja — Plotly je već u bundleu).
- **Analize pojedinih područja:** `aktivnost` suggest atribut + attribute filter u filter baru
  (npr. aktivnost=track za sve trail treninge kroz godine).

---

## 6. Mapping tablica po erama (popuniti u Koraku 1)

| Kolona | Era (redci/datumi) | Značenje | Target atribut | Tip | Transformacija |
|---|---|---|---|---|---|
| C (Date) | sve | datum | `session_start` | — | datum + 06:00 |
| E (Length) | ? | km | `duljina_km` | number | — |
| F (time) | ? | trajanje | `trajanje_min` | number | h:mm:ss → min |
| G (pace) | ? | tempo | `pace` | text | MM:SS |
| I (Mood) | ? | raspoloženje | `mood` | suggest | normalizacija |
| J (Intensity) | ? | intenzitet | `intenzitet` | suggest | — |
| K (Activity) | ? | tip aktivnosti | `aktivnost` | suggest | — |
| L (Terrain) | ? | teren | `teren` | suggest | — |
| M (Comment) | ? | opis treninga | event comment | — | — |
| O/P (HR_com...) | ? | HR/kcal/opt | `hr_avg`,`hr_max`,`kcal`,`opt`,`t_ef` | mix | regex parse |
| AM (Private comment) | ? | privatni dnevnik | `privatni_komentar` | text | — |
| DS (PROJEKTI) | ? | projektni log | `projekti` | text | — |
| ... | | | | | |

*(? = popuniti tijekom arheologije; kolone koje su mijenjale svrhu dobivaju više redova)*

---

## 7. Otvorena pitanja

1. Ime area: "Dnevnik" / "Trening_dnevnik" / drugo?
2. Fiksno vrijeme za `session_start` — 06:00 ili drugo? (Nakon odluke — zauvijek.)
3. Sličice 1 i 2 su **isti sheet** (potvrđeno 2026-07-04) — dvije slike jer ima jako puno
   kolona. Neke su **grupirane i zatvorene**: u njima se pratilo **sate po pojedinim poslovnim
   projektima po danima**. Audit skripta (Korak 1) čita xlsm direktno pa će uhvatiti i skrivene
   kolone — ali mapiranje projektnih sati treba posebnu odluku (vidi točku 5).
4. Kolona AL (52,7% ...) i ostale nevidljive kolone — ima li još sadržaja za mapiranje?
5. **Projektni sati po danima** — ovo je strukturiran vremenski niz (dan × projekt × sati),
   ne slobodni tekst. Kandidat za **vlastiti leaf** ("Dnevnik > Projekti" ili čak zasebna
   area "Posao"), s atributima `projekt` (suggest) + `sati` (number) — jer se sigurno želi
   analizirati po projektu i periodu (SUM sati). Alternativa (1 red = 1 dan, projekti kao
   N number atributa po projektu) loše stari: svaki novi projekt = novi atribut. Odlučiti
   u Koraku 2. Postojeća kolona DS (PROJEKTI, slobodni tekst) ostaje atribut `projekti`
   na trening leafu.
