# S185 — testovi (2026-10-26)

F2 preuređivanja na TEST-u: A2 (izvedi atribut, `059`), jezgra A1 (promijeni tip, `060`), §20 popravak
planera. Spec: `docs/PREUREDJIVANJE_SPEC.md` §21–§33. PROD nije diran.

Stanje TEST-a koje testovi pretpostavljaju (napravljeno u S185):
- Area `Fitness_Garmin` prebačena s testnog računa `sasasladoljev59@outlook.com` na **`sasasladoljev59@gmail.com`**
  (vlasništvo i autorstvo: 1 Area, 5 kategorija, 25 atributa, 6.267 eventa, 27.004 vrijednosti). Backup prije:
  `data-prep_data/_backup/test/2026-10-26_1621`.
- `kcal` treninga pretvoren iz kJ u kcal (op `a000241e`, 3.124 retka).
- `mood`: posijano 30 smajlića na `Activity` treninzima od 06.2024. + kolona liste „Mood" s mapom u sličice,
  pa pretvoreno u broj 1–5 (op `9f749b3d`). ⚠ Kolona liste je postavljena samo za ovaj test — zato lista
  `Fitness_Garmin` sada ima kolone Date · Category · Mood · Comment umjesto zadanih.
- `pace` ostaje tekst `mm:ss` (odluka S185).

---

## T-S185-1 ⬜ (TEST lokalno, Gmail) Kalorije treninga u kcal, ne kJ

**Preduvjet:** `npm run dev` (TEST — žuta traka „TEST DATABASE"), prijava `sasasladoljev59@gmail.com`,
**Ctrl+Shift+R**.

**Koraci:**
1. Area → **`Fitness_Garmin`**. Ako je nema u izborniku: test pao na koraku 1 (prijenos vlasništva).
2. Kategorija `Activity` (ili All Categories), razdoblje **Custom 01.12.2024. – 01.12.2024.**
3. Otvori trening tog dana (View).

**Očekivano:** `kcal` = **630** (prije pretvorbe je bilo 2.636). Za provjeru još jedan dan po izboru:
elliptical od oko sat vremena ⇒ `kcal` ~300–400, ne 1.200–1.600.

**Pad:** 2.636 ili ~4× veći broj ⇒ pretvorba nije u bazi (javi; Claude provjerava op `a000241e`).

---

## T-S185-2 ⬜ (TEST lokalno, Gmail) `mood` kao broj, lista i dalje pokazuje sličicu

**Preduvjet:** isti kao T-S185-1.

**Koraci:**
1. `Fitness_Garmin` → Activities, razdoblje **od 01.06.2024.** do danas, sortiranje Oldest.
2. Pogledaj kolonu **Mood** na prvih ~30 treninga.
3. Otvori jedan trening sa sličicom (View).
4. Edit istog treninga → pogledaj polje `mood`. **Ne spremaj** (Cancel).

**Očekivano:**
- 2.: sličice 🙂 😐 😀 🙁 ☹ redom kako su posijane (ponavljaju se svakih 5 treninga).
- 3.: `mood` je **broj** 1–5 (🙂 = 4, 😐 = 3, 😀 = 5, 🙁 = 2, ☹ = 1).
- 4.: `mood` je polje za **broj**, bez izbornika smajlića.

**Pad:** kolona prazna ili pokazuje broj umjesto sličice ⇒ mapa kolone nije prevedena; izbornik smajlića u
Editu ⇒ pravila izbornika nisu promijenjena. U oba slučaja javi — povrat je `node Claude-temp_R/s185/a1_runner.mjs undo 9f749b3d-906f-4740-85e3-97b2dde95732`.

---

## T-S185-3 ✅ Automatske brane i dokaz na TEST-u

Izmjereno u sesiji (detalji: spec §32, §33):

| Brana | Ishod |
| --- | --- |
| `restructurePlan.test.mjs` (§20, Namjena pod `*`) | 78/78; 5 novih blokova, nad starim kodom pada 8 tvrdnji |
| `restructureRetype.test.mjs` (A1 planer) | 43/43; sabotaža (`mm:ss` + blokada pločice) ruši 4 |
| `pravila.py --test` | 30/30 |
| SQL `_restructure_convert` = TS `convertValue` | 15/15 zajedničkih primjera |
| A2 `kcal_kj` na TEST-u | brana prije upisa ✓ · upis 3.124 = predviđanje · jednokratno ne pušta dvaput · brana povrata ✓ · povrat, otisak = prije |
| A1 `mood` (mapa) i `pace` (`mm:ss`) na TEST-u | obje brane prije upisa ✓ · upis = predviđanje · brana povrata ✓ · povrat, otisak = prije |
