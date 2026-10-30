# S189 — testovi (2026-10-30)

Poruke planera preuređivanja prevedene na engleski (stavka BACKLOG-a iz S188). Mijenja se samo tekst:
`src/lib/restructure/plan.ts` (greške, upozorenja, popis „Also changes", `(prazno)` → `(empty)`) i
`apply.ts` (greške čitanja, upozorenje o shortcutima, primjeri ponovnog mjerenja). Navodnici `„…"` →
`"…"`, kao na strani `Restructure attributes`. Vrijednosti iz baze (`Transfer`, `Stanje po računu`)
ostaju kakve jesu. Financije koje Koka vidi nisu dirane.

Automatski: `npm run check` (58 fileova, 0 palo), build, E2E `S179` i `S186` prolaze.

---

## T-S189-1 ⬜ (TEST, Saša) Pregled `Restructure options` je cijeli na engleskom

**Izmjereno planerom nad snimkom PROD-a od 18.10.** (fixture `restructure_prod_2026-10-18.json`) — ovo
treba vidjeti, uz moguću razliku u broju redaka jer je TEST noviji:

- korak 1: rows **305**, changes **305**
- crveni okvir: `✗ step 3: value "Zabava " for "tip" has a leading/trailing space or is empty.`
- žuti okvir: `⚠ step 2: matches no rows.`
- **Also changes (6):**
  - `Menu tip: "Transfer" → "Prijenos"`
  - `Menu podtip: key "Transfer" → "Prijenos"`
  - `Settings: dashboard "Stanje po računu" · due.settle: tip "Transfer" → "Prijenos"`
  - `Settings: dashboard "Kamo ide novac" · outside: tip "Transfer" → "Prijenos"`
  - `Settings: dashboard "Kamo ide novac" · adjustment: tip "Transfer" → "Prijenos"` (dvaput — dvije korekcije)

**Ništa se ne primjenjuje:** greška u koraku 3 gasi „Apply restructure" (gumba nema), pa je test bezopasan
i na kopiji PROD-a.

**Koraci:**
1. `npm run dev` (TEST — provjeri banner) → **Ctrl+Shift+R**.
2. Area `Financije_all` → Structure → Export (jedna Area).
3. U fileu, sheet **`Restructure options`**, IZNAD retka `HELP` (redovi 2–4), u stupce `Step`, `Category`,
   `when: tip`, `set: tip`:

   | Step | Category | when: tip | set: tip |
   | --- | --- | --- | --- |
   | 1 | Transakcija | Transfer | Prijenos |
   | 2 | Transakcija | Nepostoji | X |
   | 3 | Transakcija | Zabava | `Zabava ` (s razmakom na kraju) |

4. Structure → Import tog filea → skrolaj do panela **Restructure — preview**.

**Očekivano:** svi tekstovi u panelu na engleskom (natpisi su bili i prije; nove su poruke u crvenom i
žutom okviru i u „Also changes"). Nijedan `korak`, `Izbornik`, `Postavke`, `„`.
Ako Area ima dijeljenog korisnika, u žutom okviru je i
`⚠ Shortcuts: the preview sees only YOUR shortcuts in this Area — …`.

**Pad:** bilo koja hrvatska riječ izvan citiranih vrijednosti (osim imena pločica i bucketa, koja su
vrijednosti iz configa) — javi tekst.

**Na kraju:** Close bez primjene; po želji isprazni retke 2–4 u fileu.

---

## Mjerenje koraka 4 treninga (izmjereno u sesiji, bez Sašinih koraka)

Probna Area `S189 serije proba` na TEST-u (`data-prep_tools/Trening/proba_serije.py`, pod `owner@test.com`,
podijeljena Saši read): 402 treninga, 7.936 zapisa serija, 46.919 vrijednosti; ekstremi 120 i 220 serija.
Mjereno Playwrightom (`Claude-temp_R/s189/_probe_S189_serije.spec.ts`, nije u suiteu) + brojanjem u bazi.
Svi brojevi i sud: `docs/TRENING_MIGRACIJA.md` „Mjerenje za korak 4".

## T-S189-2 ✅ Izvoz ne udvostručuje ni ne gubi retke na granici stranice

- **Prije** (`.order` bez `id`): file 7.936 redaka, od toga 10 dvaput (retci ~1017, ~2020, ~3024), 10 izostalo;
  uvoz istog filea: 7.926 nepromijenjenih + **3 sukoba sesije** + 10 upozorenja „copied row".
- **Poslije** (`excelDataLoader.loadEventsForExport` + `.order('id')`; roditelji paginirani): 7.936 nepromijenjenih,
  0 sukoba, 0 upozorenja.

## T-S189-3 ✅ View/Edit čitaju SVE vrijednosti treninga

- **Prije:** REST upit View-a za trening od 220 serija: `content-range 0-999/1102`, 20 serija bez ijedne vrijednosti.
  Edit + pomak vremena (+1 min) + Save: u bazi 1.102 → **1.000**, 20 serija prazno, ekran „uspjeh".
- **Poslije** (`fetchAllPagedIn` u `activityViewCache.ts` i `EditActivityPage.tsx`): isti potez ⇒ 1.102 → 1.102.
- Regresija: E2E e3, e4, e6, e14, S107, S186 prolaze (e6-3 popravljen u specu — od S175 traži odabranu Areu).
