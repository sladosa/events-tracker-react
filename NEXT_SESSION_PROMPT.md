> Pisano protiv commita **`cd5afeb`** (S156, `test-branch`) + docs commit rituala odmah iza njega.
> ⚠ Ako `git log` pokazuje noviji commit od S156 rituala, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S156 (2026-09-30)

---

# DIO 1 — netehnički (za Sašu)

## Što je napravljeno

**Traka „Čeka potvrdu" sada i upisuje (C5 faza 2), zasad samo na `test-branch`.**
- **Slaže se** → „Potvrdi": upiše redak naplate (TROŠKOVI UČINJENI MASTERCARD KARTICOM, bankin
  iznos i dan) i prebaci kupovine `Planiran → Izvrsen`. Saldo točan isti dan.
- **Ne slaže se** → „Upiši naplatu kako ju je banka skinula": samo redak naplate s bankinim
  brojem; kupovine ostaju `Planiran`, košara stoji kao „naplaćeno — neusklađeno · razlika X".
- Naplatu upisanu rukom ili s izvoda traka prepozna i ne nudi drugu. Traži i **dan** s ekrana
  banke. Uvijek prvo pokaže „što ću upisati", pa „Da, upiši". Gumb vidi samo Koka.
- `fill_from_izvod.py --zaba` više ne donosi drugu naplatu ako je Koka dan upisala za 1–3 dana krivo.

## Što treba od tebe / Koke

1. **Ti, na računalu (TEST, `npm run dev`):** T-S156-1 → 2 → 3 → 4 redom
   (`docs/sessions/tests/S156_tests.md`). **Između 2 i 3, i nakon 3, reci „vrati"** — Claude
   vraća 11 statusa na `Planiran` i briše redak naplate (snimka je u
   `Claude-temp_R/S156_planiran_ids.txt`).
2. **Ti, bilo kad prije merge-a:** pusti `sql/055_due_basket_members.sql` na **PROD** (SQL editor).
   Bezopasno i prije deploya — postojeća traka dobiva isti odgovor. Claude poslije izmjeri isto
   (samo čitanje).
3. **11.10. — Koka, PROD:** košara ~40 stavki / Σ 859,58. S kodom na `main` (faza 1) ona samo
   **usporedi** broj s bankom (dogovor iz S155).
4. **Nakon 11.10. — merge na `main`** (naredbe u CLAUDE.md § End of session 11). Košara ostaje u
   traci dok je `Planiran`, pa je Koka odmah potvrdi (T-S156-6). Ti kao grantee pogledaš da nemaš
   gumb (T-S156-5).
5. Iz ranije: Koka T-S154-2 (`+` iz prve na iPhoneu), T-S152-7 kad stigne izvod.

## Redoslijed — što slijedi nakon testova

1. Testovi gore + `055` na PROD + 11.10. + merge.
2. **Ako se 11.10. NE slaže** → **C5 faza 3** (nagovještaji uz razliku: „razlika = redak X",
   „razlika = kupovine iz susjedne košare"). Tada Koki odmah treba pomoć da nađe uzrok.
   **Ako se slaže** → **F5** (`Dashboard` sheet): `due` config od S156 nosi i upisne podatke
   (`text`, `settle`, `done`), a živi samo u bazi i ne putuje Excelom.
3. B5 ostatak (rata 117,32; `Hlače i čarape`) · K-1 (brana na Structure uvozu) · poravnati Excel
   guard/`Potvrda` sa sidrom samo za retke u saldu · Visa u traku (faza 4) kad se objasni 2026-02.

---

# DIO 2 — tehnički (za Claudea)

## Stanje grana

`main` = `b5020d6` (S155). `test-branch` = `cd5afeb` + ritual (S156, **nije na main**).
`sql/055` pušten **samo na TEST-u**; `SCHEMA_TEST.sql` **nije** osvježen (`dump_schema.py --env test`
kad se pusti i na PROD — oba odjednom).

## Novo u S156

- `sql/055`: `app_due_rows` (interni, REVOKE), `app_due_check` (pristup + slugovi),
  `rpc_area_due_baskets` preko njih (izlaz izmjeren identičan), `rpc_area_due_basket_members`.
- `dueBaskets.ts`: `daysBetween`, `SETTLE_WINDOW_DAYS = 3`, `matchSettleRow`, `basketAction`,
  `settleValues`. Test `dueSettle.test.mjs` (38; sabotaže 2/2/1).
- `dueConfirm.ts`: `fetchBasketMembers`, `findSettleRow`, `settleBasket` (svježe čitanje Σ,
  redak pa statusi, broji prebačene).
- `insertEntry.ts`: `findFreeSessionStart` (preseljen iz Adda, sada **baca** na grešku čitanja),
  `insertLeafEvent` (Add ga koristi), `insertEntry` (P2 roditelji + leaf).
- `DueStrip` prima `isOwner` (`!sharedContext`) i `onSettled`; `BalanceByGroupTile.reloadToken`.
- `fill_from_izvod.py`: `skupna_vec_upisana` u `--zaba` grani.

## Kako vratiti TEST između testova („vrati")

Kao vlasnik (`request.jwt.claims`) ili service: `UPDATE event_attributes SET value_text='Planiran'`
za status-definiciju `Financije_all` i `event_id` iz `Claude-temp_R/S156_planiran_ids.txt`
(11 redaka — provjeri broj), pa obriši redak(e) `comment = 'TROŠKOVI UČINJENI MASTERCARD KARTICOM'`
na `event_date` 2026-07-08…14 u `Financije_all` (prvo `event_attributes`, pa `events`,
`.select`/`RETURNING` i broj). TEST DB: `psql` + `SUPABASE_DB_URL` iz `.env.local`
(`C:\Program Files\PostgreSQL\17\bin`).
⚠ Na TEST-u 11.07. **nema** pravog skupnog retka (PROD ga ima: 1.244,74) — ne briši ništa izvan
onoga što je test upisao (provjeri `created_at` = dan testa).

## Otvoreno

- **UI faze 2 nije kliknut** (sesija s mobitela) — T-S156-1…4 su prvi pravi ispit.
- PostgREST `max-rows` 1000 vrijedi i za `rpc_area_due_basket_members`; košara ima ~40–75 redaka.
- Write-grantee bi kroz RLS smio prebaciti statuse Kokinih redaka (`event_attributes_update_policy`)
  — brana je samo UI (D5). Isto svjesno otvoreno kao `events UPDATE` (S134).
- Status flip ne dira `events.edited_by` — ✎ oznaka ga ne prikazuje. Namjerno zasad.
- Iz S155: Excel guard / kolona `Potvrda` i dalje sidre kartične retke; rename sluga ne popravlja
  `attribute_rules`; Edit prikazuje `datetime` u UTC satu; K-1, K0; C1 korak 4; B3–B6; C4; E8-2.
