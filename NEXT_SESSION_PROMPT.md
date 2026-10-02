> Pisano protiv commita **`e8afdac`** (S157, = `main` = deploy) + docs commit rituala odmah iza njega na `test-branch`.
> ⚠ Ako `git log` pokazuje noviji commit od S157 rituala, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S157 (2026-10-01)

---

# DIO 1 — netehnički (za Sašu)

## Što je napravljeno

**Traka „Čeka potvrdu" je na PROD-u** (deploy S156 + S157, 01.10.). Testirana uživo na TEST-u,
koji je sada **kopija PROD-a** — svih 6 testova prošlo.
- Popravljena greška zbog koje je traka pokazivala `[object Object]` umjesto provjere.
- **Nova zaštita:** ako je Koka naplatu već upisala sama (npr. opis „MC"), traka je nađe po
  iznosu i pita *„Je li to ova naplata?"* — „Da" je ispravi u dogovoreni oblik, umjesto da
  upiše drugu (saldo bi je brojao dvaput).
- Redak naplate iz trake sada nosi i **Smjer = Isplata** (bez njega Edit nije pokazivao iznos).
- Novi dokument: **`docs/FINANCIJE_KOKA_PROCES.md` §2.2 — mjesečni tok danas**: tko, kada i
  kojom naredbom (MC traka, Visa alat, „kad se ne slaže", ZABA/RF izvod).

## Što dolazi — po datumu

1. **~05.–07.10. — Visa (po starom, bez trake).** Koka pošalje `PBZVIZA_2026-09.pdf` u OneDrive
   `Izvodi` → ti `visa_uvoz_izvoda.py` → Koka uveze. Postupak **B** u §2.2. Javi Claudeu kad
   izvod stigne — zajedno prođemo dry run i brojke.
   ⚠ Naknadu `0,17` na RF-u upiši kao `Bankovni troškovi`, opis `Naknada` — nikad `Visa`.
2. **11.10. — prva prava MC košara u traci (Koka, PROD).** Ona upiše iznos i dan s ekrana banke
   → Potvrdi (ili „Upiši naplatu…" ako se ne slaže). **T-S156-6.** Ti kao grantee pogledaš da
   vidiš usporedbu, ali ne gumb: **T-S156-5**.
   ⚠ Prije toga Koka na mobitelu **zatvori i ponovo otvori karticu** (stari bundle, S118).
3. **Kad stigne ZABA izvod za listopad** — postupak **E**; skupna MC naplata mora biti
   „preskočena": **T-S156-7**.
4. Iz ranije: Koka T-S154-2 (`+` iz prve na iPhoneu), T-S152-7 kad stigne izvod.

## Redoslijed — što slijedi

1. Gore navedeno.
2. **Ako se 11.10. NE slaže** → izmjeriti bi li naznake (Backlog C5 „Gdje bi mogla biti
   razlika?") pogodile uzrok, pa ih tek onda graditi. Postupak „kad se ne slaže" za MC
   (§2.2 **D**, koraci 2–3) još nije izveden uživo — tada ga provjeriti i ispraviti u dokumentu.
3. **Visa u traku** (Backlog C5, cilj ~05.11.): širi prozor dana, `text: "Visa"`,
   `fill_from_izvod.py` čita tekst iz configa, spec ažuriran.
4. **F5** (`Dashboard` sheet — `due` config putuje Excelom) · B5 ostatak · K-1.

---

# DIO 2 — tehnički (za Claudea)

## Stanje grana i baza

`main` = `e8afdac` (S156 + S157, deployano). `test-branch` = isto + ritual S157.
`sql/055` na **TEST i PROD** (izmjereno: `rpc_area_due_basket_members` na PROD-u odgovara
`22023 Group attribute slug … not found` = postoji i provjerava). `sql/SCHEMA_*.sql` osvježeni.
PROD `areas.settings.dashboard.widgets[0].due.settle` = `{tip, smjer: Isplata, podtip, izvorplacanja}`
(Saša SQL-om, izmjereno čitanjem). TEST isto.

## TEST = kopija PROD-a (01.10.2026.)

`data-prep_tools/Tools/prod_to_test.py` (dry run zadano; `--apply` zamijeni TEST `Financije_all`:
eventi s PROD ID-evima, atributi, sidra, `validation_rules`; sve pod TEST vlasnikom; BROJI na
kraju). Backup TEST-a prije: `data-prep_data/_backup/test/2026-10-01_1135`.
Scenarij za ponovno testiranje trake (radni stol, gitignored):
`Claude-temp_R/s156_test_state.py --setup | --plant | --show | --restore` — košara A = MC 11.08.
(prije sidra 06.09.), B = MC 11.09. (poslije). **Stanje sada: `--restore` izveden** — TEST je
točna kopija PROD-a (5.292 / 5.292). `orig.json` + `meta.json` u `Claude-temp_R/s156_state/`;
marka vremena je prvi `--setup` — `--setup` briše sve u prozorima košara nastalo poslije nje.
⚠ Kopija stari: PROD dobiva nove retke, TEST ne. Prije sljedećeg testa nad stvarnim podacima
— novi `backup_db.py --env test`, pa `prod_to_test.py --apply`, pa `s156_state` obrisati
(original se snima nanovo).

## Novo u S157

- `dueConfirm.ts`: `loadCandidates` (FK hint `events_category_id_fkey`; zajednički za pravilo B i
  C), `findSuspectRows`, `attributeNames`, `adoptSettleRow` (atributi pa opis, pod autorom eventa,
  broji), `settleBasket(..., suspectsDismissed)` — brana pravila C; `createSettleRow` staje na
  atributu čiji `depends_on` roditelj nije u configu.
- `dueBaskets.ts`: `findSuspectSettleRows`, `adoptChanges` (uvozi `passesFilters` iz
  `confirmedRowEdit`). `dueSettle.test.mjs` 55 tvrdnji.
- `retry.ts`: `toError` — Supabase `error` objekt → `Error(message (code))`.
- `DueStrip.tsx`: `check` (pravilo C na klik), žuta kutija pitanja, siva kutija ispravka, „tražim…"
  i tijekom osvježavanja.

## Otvoreno / neverificirano

- **Prvi pravi upis iz trake na PROD-u** (11.10.) — sve dosad je bilo na TEST-u.
- `DOSPJELO_SPEC` još navodi Visa `text: "PBZCard d.o.o."` i D4 „Ne — dok se ne objasni" —
  zastarjelo (S148 riješio, Saša odlučio da Koka potvrđuje i Visu); ispraviti kad se Visa radi.
- Visa listopad: 12 redaka `Datum naplate` 03.10. + 20 na 05.10. (staro pravilo `next:3`) —
  `visa_uvoz_izvoda.py` ih poravna na stvarni dan; provjeriti u dry runu.
