> Pisano protiv `e7e7a8a` (S177, 22.10.) + commita koji nosi ovaj file.
> **`main` = `07361eb` (deploy 19.10.):** uvozni guard (S174) i Košare ↗ oznaka (S175) su na PROD-u.
> **Na `test-branch`, NIJE na PROD-u:** F5 (`AreaSettings`, Structure export = jedna Area) i
> „Create categories & continue" ne dira postojeću Areu — T-S175-6 ✅, **deploy čeka F1** (jedan build).
> **PROD baza:** S174–S177 nisu pisale ništa. S177 je mijenjao samo Python alate (nema deploya).
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md` i `data-prep_tools/CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — F1 preuređivanja (nakon S177, 2026-10-22)

> **Ukratko (S177):** pravila po trgovcu iz S174 sada rade i u mjesečnom krugu (MC, ZABA, RF, Visa) kao zadnji ključ kad povijest šuti — unatrag 12 mjeseci to je 64 retka koja više nisu N/A, 62 točno — a Saša je dodao pravilo „parking" za kartice i odbio pravilo za Glovo.

---

# DIO 1 — netehnički (za Sašu)

## Gotovo (S177)
- **Mjesečni krug sam razvrstava više:** kad povijest ne zna trgovca, alat pita 31+2 pravila
  (S174 + `parking`). U studenom ćeš u ispisu vidjeti razlog „pravilo „…"" uz ~5 redaka mjesečno —
  pogledaj ih pri pregledu filea (ljekarne znaju biti poklon).
- **`parking`** ⇒ Prijevoz / Taksi, Zet, Parking (kartice). **Glovo** bez pravila.

## Što slijedi: F1 — alat za preuređivanje strukture
Jedan potez koji preimenuje / spaja / premješta opcije izbornika i izdvaja „za koga" u novi
atribut (`Namjena`) — u **svim** mjestima odjednom (retci, izbornik, pločice, bucketi, košare,
kolone liste, shortcuti, sidra), uz pregled prije, jednu transakciju u bazi i **Poništi**.
Prvi korisnik: Financije (`Namjena`, T38 — Koka se složila 20.10.).

## Što treba od tebe
1. **Za F1 ništa prije koda.** Na kraju: `058` u Supabase SQL editoru (PROD), deploy, i Kokin
   (ili service) uvoz sheeta — naredbe dobiješ gotove.
2. **T-S174-3 (PROD)** kad nastaviš ručno razvrstavanje, pa **T-S174-5**.
3. **Garmin:** zahtjev za izvoz do danas (u bazi staje 14.02.2025.).
4. **Studeni** (`S175_tests.md`): ~02.11. → 11.11. **T-S175-1 MC** · ~03.–11.11. **T-S175-2 Visa** ·
   **T-S175-3 ZABA_2026-10**.

---

# DIO 2 — tehnički (za Claudea)

## Stanje
- **S177:** `pravila_trgovca.prijedlog()` (posrednik + par izvan izbornika, `POSREDNIK` preseljen iz
  `razvrstaj_na`) zovu `fill_from_izvod` (blok presedana) i `visa_uvoz_izvoda` (`klasa()`, rata s
  N/A 1. ratom). Regresija `Claude-temp_R/s173_mc/regresija.sh` nepromijenjena. Provjera unatrag:
  scratchpad skripta (jednokratna) — ponovi istim postupkom ako se pravila mijenjaju.
- ⚠ Kad F1 preimenuje Tip/Podtip, **`pravila_trgovca.PRAVILA` ide po grep popisu** (§16 korak 7);
  `prijedlog()` par izvan izbornika ne predlaže nego javi, pa zaostalo pravilo ne kvari podatke.

## F1 — redoslijed izvedbe (`docs/PREUREDJIVANJE_SPEC.md` DIO 2, §9–§17)
1. **`sql/058_restructure.sql`**: `restructure_ops` + `restructure_op_rows` (RLS samo SELECT
   vlasniku), `rpc_restructure_apply` (DEFINER, vlasnik ili `service_role`, `FOR UPDATE`, provjera
   „ništa se nije promijenilo" = config „prije" `jsonb =` + očekivani broj po koraku, UPDATE na
   mjestu, `events` se ne dira) i `rpc_restructure_undo` (sve ili ništa, trenutno = `after`).
   TEST kroz psql (Session pooler); PROD pušta Saša.
2. **`src/lib/restructure/plan.ts`** (čist) + `restructurePlan.test.mjs` nad
   `areaSettings_prod_2026-10-18.json`, sa sabotažama. Izbornik kroz `validationRules.ts` (sirovo
   pravilo, nikad parsirano), postavke po tablici §12.3, upozorenja §12.5, greške §12.6.
3. **`sheet.ts`** + prazan sheet `Preuređivanje` u Structure exportu (slova se računaju — S160).
4. **Faza u `StructureImportModal`** (poslije ostatka uvoza, vlastiti pregled + kvačica + Poništi).
5. **`apply.ts`** (snimka → RPC → ponovno mjerenje → `areas-changed`).
6. **Dokaz povrata na TEST-u** (kopija PROD-a: `backup_db.py --env test --no-files`, pa
   `prod_to_test.py --settings --apply`): primijeni → poništi → `sha256` po tablici = prije;
   promjena između pregleda i primjene ⇒ 0 redaka; promjena poslije ⇒ povrat odbijen.
7. **`rls_probe.py`** probe za obje funkcije (vlasnik DA, write-grantee NE, stranac NE, service DA).
8. **E2E** jedan spec; **`Tools/preuredjivanje_grep.py`**.
⚠ Otvoreno pri izvedbi (§17): oblik filtra u `export_profiles` (`exportProfile.ts`); brisanje opcije
s retcima ⇒ upozorenje koje upućuje na sheet; ime `namjena` (Koka bira).
⚠ Prije `058` na PROD: deploy F5 (puštanje §16 koristi Structure uvoz) — ide u isti build.

## Otvoreno — ostalo (po prioritetu)
1. **Mali, neovisni:** traženje u izborniku po oba nivoa (O6) · prekidač Bucketi | Namjena u razrezu
   (poslije `Namjene`; RAZREZ R5).
2. **Trening:** F2 (tip atributa, izvođenje iz teksta) pa generator — tek poslije F1.
3. **Pregled razlika prije Structure uvoza** (BACKLOG „Napredak Aree između korisnika").
4. Iz S173: `--par=<id8>:<iznos>` ako MC_2026-10 da `NEJASNO` · `MOŽDA KRIVO MJESTO` za MC · T23 u appu.
5. Iz S172: Excel uvoz `default_map` kad se roditelj promijeni · „Review" sheet · delta retci ispod
   sekcije · ↗ ne vraća `attrFilter`.
