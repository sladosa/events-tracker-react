# S134 — testovi: backup, shema u gitu, čišćenje RLS-a

**Datum:** 2026-09-10
**Grana:** `test-branch` (commitovi `513a1cc`, `7be1e02`, `f374851`, `a56cbdc`, `336a2e7`)

> ⚠ **Migracije `046`–`050` puštene su SAMO na TEST-u.** Na PROD-u je pušten samo
> `sql/045` (poravnanje vlasništva). Kod je na `test-branch` i **nije deployan**.

---

## A. Backup — izvedeno i izmjereno

### T-S134-1 ✅ Snimka PROD-a
```
Tools\run.bat Tools\backup_db.py --env prod
```
**Izmjereno 10.09.:** 107.772 retka / 12 tablica, **6,79 MB** gzip, **53 s**, plus
46 fotografija (5,59 MB). Izlaz: `data-prep_data/_backup/prod/2026-09-10_1245/`.

**Provjera sadržaja (ne samo brojeva):** `areas.settings` sa svih 6 ključeva,
8 kolona liste, profil `Kokin_format`, sidra s bilješkama, `Podtip` options_map
(11 Tipova / 48 parova).

### T-S134-2 ✅ `--verify` hvata pokvarenu snimku
Protuprovjera: iz kopije snimke maknut **jedan** redak `events` i promijenjen
**jedan** iznos u `balance_anchors` → alat javio `[X] 2 tablica ne odgovara
manifestu`. Nad ispravnom snimkom: `[OK] Snimka je citljiva i odgovara manifestu.`

### T-S134-3 ✅ Guard na ključ
Pet slučajeva: `sb_publishable_*` → **STAO**, ključ nedostaje → **STAO**,
JWT `role=anon` → **STAO**, JWT `role=service_role` → prošao, `sb_secret_*` → prošao.

⚠ Ovo nije akademski: prvo mjerenje TEST-a dalo je `events: 0` jer je
`_db.load_env('test')` pao na anon ključ. Backup napravljen tako bio bi **prazan
i izgledao uredan**.

### T-S134-4 ⬜ Backup se pokreće redovito
**Koraci:** pusti backup, pa `backup_to_external.bat` s priključenim `D:`.
**Očekivano:** `data-prep_data/_backup/` završi na vanjskom disku.
**Pad:** ako `_backup` nije ondje — provjeri je li robocopy obuhvatio novi poddirektorij.

---

## B. Shema u gitu

### T-S134-5 ✅ `pg_dump` obje baze
```
Tools\run.bat Tools\dump_schema.py --env prod
Tools\run.bat Tools\dump_schema.py --env test
```
**Izmjereno:** PROD 117 KB / **107 politika** / 8 triggera / 23 funkcije;
TEST 62 KB / 50 / 2 / 10. Lozinka se iz zaglavlja čisti (`grep` = 0 pojavljivanja).

### T-S134-6 ⬜ `--diff` nakon PROD migracija
**Koraci:** nakon `046`–`050` na PROD-u pusti `dump_schema.py --env prod --diff`.
**Očekivano:** razlika **samo** u politikama koje su migracije dirale.
**Pad:** bilo što drugo ⇒ netko je mijenjao shemu izvan migracija.

---

## C. Vlasništvo strukture

### T-S134-7 ✅ `sql/045` na PROD-u
**Izmjereno:** `Transakcija.user_id` 768a6056 (Saša) → eeb78414 (Koka);
15/15 atributa isto; **slugovi netaknuti** (`isplata`, `uplata`, `stanje`,
`valuta`, `smjer`) — potvrda da `042` trigger doista ne dira UPDATE.

⚠ Supabase SQL editor prikazuje rezultat **prvog** SELECT-a, pa je izgledalo kao
da UPDATE nije prošao. Provjereno mjerenjem baze, ne čitanjem ekrana.

### T-S134-8 ⬜ ⭐ Vlasništvo se više ne prepisuje
**Preduvjet:** kod deployan (`7be1e02`).
**Koraci:** pod **Kokinim** računom otvori Structure → `Financije_all` →
`Transakcija` → Edit → promijeni opis → Save. Zatim provjeri `categories.user_id`.
**Očekivano:** i dalje `eeb78414`. Isto nakon Sašinog pokušaja (koji sada ne prolazi).
**Pad:** ako se `user_id` promijeni, `ownedBy()` ne radi — provjeri šalje li se
`user_id` u payloadu.

---

## D. RLS — izvedeno na TEST-u

### T-S134-9 ✅ Sonda prije/poslije na TEST-u
```
Tools\run.bat Tools\rls_probe.py --env test
```
**Izmjereno:** 45 proba, promijenjene **točno 4** — sve zatvaranje INSERT rupe
(`categories`, `attribute_definitions` za granteea i stranca), poslije još
`events` (`050`). Ništa drugo se nije pomaknulo.

**Stanje poslije se poklapa s `docs/RLS_INVENTORY.md` red po red:**

| uloga | smije |
| --- | --- |
| vlasnik Aree | sve |
| write grantee | SELECT svugdje + `events INSERT svoj` |
| stranac | **ništa** |

### T-S134-10 ✅ Rupa je bila stvarna
Tri nezavisna dokaza prije migracije: `INSERT 0 1` u psql-u pod tuđim korisnikom;
**`HTTP 201`** preko REST-a s `Prefer: return=minimal` (redak počišćen);
`rls_probe` → `stranac → categories INSERT → DA`.

⚠ S `return=representation` (što supabase-js šalje) isti INSERT vraća **403** —
zato je rupa izgledala zatvoreno.

---

## E. PROD — čeka Sašu

### T-S134-11 ⬜ ⭐⭐ Migracije na PROD-u
**Preduvjet:** svjež backup (`backup_db.py --env prod`).
**Koraci, redom, sa sondom između:**
```
Tools\run.bat Tools\rls_probe.py --env prod     ← spremi izlaz (mjera "prije")
   046_rls_helpers.sql
   047_rls_areas.sql
   048_rls_categories.sql
   049_rls_attribute_definitions.sql
   050_rls_events_insert.sql
Tools\run.bat Tools\rls_probe.py --env prod     ← usporedi
Tools\run.bat Tools\dump_schema.py --env prod   ← shema natrag u git
```
**Očekivano:** vlasnik sve DA · write grantee samo SELECT + `events INSERT svoj` ·
stranac sve NE.
**Pad:** ostane li ijedan `DA` gdje inventura kaže `NE`, preživjela je stara
politika — provjeri ispis „POSLIJE" u samoj migraciji.

### T-S134-12 ⬜ ⭐⭐ **Koka i dalje može raditi** (najvažniji test)
**Koraci (Kokin račun):** Structure → `Financije_all` → Edit kategorije → Save ·
Edit atributa → Save · Add Activity → Finish · Excel Structure import.
**Očekivano:** sve prolazi kao i dosad.
**Pad:** ako bilo što tiho ne radi — **odmah vrati politike** iz
`sql/SCHEMA_PROD.sql` (commit `f374851`) i javi što je palo.

### T-S134-13 ⬜ Saša kao grantee — zabrana je **vidljiva**, ne tiha
**Koraci (Sašin račun):** Structure → `Financije_all` → View panel na
`Transakcija`.
**Očekivano:** gumb **Edit je siv**, tooltip *„Struktura pripada vlasniku ove
Aree…"*. Ako se panel ipak nekako otvori i klikne Save → **poruka**
*„Nemaš pravo mijenjati strukturu ove Aree… Ništa nije spremljeno."*
**Pad:** „Saved!" bez ikakve promjene u bazi = `assertWrote()` ne radi.

### T-S134-14 ⬜ Unos podataka nije dirnut
**Koraci (Sašin račun, grantee):** Add Activity u `Financije_all` → Finish.
**Očekivano:** prolazi (write-share pokriva unos — Sašina odluka S134).
**Pad:** ako padne, `050` je presiroko sužen — provjeri `app_can_write_area`.

---

## F. E2E

### T-S134-15 ⬜ Guard staje kad na :5173 stoji `dev:prod`
**Izmjereno djelomično:** logika provjerena nad živim serverom — servirano
`zdojdazosfoajwnuafgx` (PROD) protiv očekivanog `xtnbhmojmffjelsqejpw` ⇒ guard
bi bacio. **Pravi run nije pokrenut** jer bi to bio baš rizik koji zatvara.
**Koraci:** (1) s `npm run dev:prod` na :5173 pusti `npx playwright test` →
mora stati s porukom; (2) ugasi ga i pusti opet → mora normalno krenuti.

### T-S134-16 ⬜ ⭐ Cijeli E2E prolazi nakon RLS migracija
**Preduvjet:** ugašen `dev:prod`.
**Koraci:** `npx playwright test`
**Očekivano:** kao i prije migracija.
**Pad:** spec koji piše strukturu pod nevlasnikom sada legitimno pada —
provjeri je li to test koji treba prilagoditi ili stvarna regresija.
⚠ TEST baza **već ima** nove politike, pa ovo mjeri stvarno stanje.

---

## G. Higijena — `search_path` na SECURITY DEFINER funkcijama

### T-S134-17 ✅ `sql/051` na TEST-u
**Izmjereno:** PROD ima **9** SECURITY DEFINER funkcija bez `SET search_path`,
TEST samo **2** — ostalih 6 na TEST-u **uopće ne postoji**. Prva verzija
migracije nabrajala ih je po imenu i pala je na TEST-u
(`function … does not exist`); prepisana da popis vadi iz `pg_proc`.
Nakon puštanja: sve funkcije obje baze imaju `search_path`. Sonda nakon toga
nepromijenjena ⇒ ništa nije puklo.

⚠ **Nije rupa nego higijena.** Izmjereno da `authenticated` i `anon` **nemaju**
CREATE ni na shemi ni na bazi, pa podmetanje nije izvedivo. Zatvara se put
prije nego postane prohodan.

### T-S134-18 ⬜ `sql/051` na PROD-u
**Očekivano:** `ukupno popravljeno: 9`, pa svi `bez_search_patha = f`.
⚠ `handle_new_user` i `handle_pending_invites` su triggeri na **registraciji** —
provjerava ih tek sljedeća stvarna registracija. Do tada stoji da su
promijenjene, ne da su provjerene.
