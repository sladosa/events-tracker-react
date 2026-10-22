> Pisano protiv `0b4c9cf` (S177) + commita koji nosi ovaj file (S178, 22.10.).
> **`main` = `07361eb` (deploy 19.10.):** uvozni guard (S174) i Košare ↗ oznaka (S175) su na PROD-u.
> **Na `test-branch`, NIJE na PROD-u:** F5 (`AreaSettings`), „Create categories & continue" ne dira
> postojeću Areu, i **S178: F1 jezgra** (planer, sheet, prazan sheet u exportu). Deploy čeka F1 (jedan build).
> **PROD baza:** S174–S178 nisu pisale ništa. **`058` je SAMO na TEST-u.**
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md` i `data-prep_tools/CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — F1 preuređivanja, drugi dio: modal + apply.ts + E2E (nakon S178)

> **Ukratko (S178):** jezgra alata za preuređivanje radi i dokazana je na kopiji PROD-a — deset koraka (Audible → Namjena, Kuća/Osiguranje, Sasa → Saša, Visa → VISA, preimenovan račun sa sidrima, zadana Namjena za 5.348 redaka) primijenjeno u 2,5 s i poništeno u 1 s, a svih 12 tablica je nakon toga bajt za bajt isto kao prije; UI za to dolazi sljedeće.

---

# DIO 1 — netehnički (za Sašu)

## Gotovo (S178)
- **Baza zna preurediti i poništiti** (na TEST-u): jedan potez mijenja retke, izbornik, pločice,
  buckete, košare, kolone liste, shortcute i sidra — ili ništa. Poništi vraća sve, i odbije ako je
  netko u međuvremenu dirao iste retke (izmjereno).
- **Smije samo vlasnik Aree** (Koka) ili alat sa service ključem — izmjereno sondom; ti kao
  grantee ne možeš ni primijeniti ni poništiti.
- **Structure export ima novi, prazan sheet `Preuređivanje`** s uputom. Ako ga popuniš i uvezeš
  **sada**, uvoz kaže „N koraka NIJE primijenjeno" — primjena dolazi sa sljedećom sesijom.

## Što slijedi
Pregled u Structure uvozu (tablica koraka, što se mijenja, kvačica, **Primijeni**, **Poništi**) i
jedan E2E test. Nakon toga puštanje na PROD (§16 spec-a): backup, `058` u SQL editoru, deploy,
atribut `namjena`, sheet s koracima iz §8.2 pod Kokinim računom.

## Što treba od tebe
1. **Za F1 ništa prije koda.** Na kraju idućeg dijela: naredbe za PROD dobiješ gotove.
2. ✅ **Ime atributa: `namjena`** (Saša 22.10.), s izbornikom Zajedničko · Koka · Saša · Kućište.
   Otvoreno za Koku: vrijednost `Nena` ili „Nena / Kućište" (Nenin fond, spec §8.2) — može pri puštanju.
3. Ostalo nepromijenjeno: **T-S174-3/5** (PROD razvrstavanje), **Garmin** izvoz, **studeni**
   (T-S175-1 MC ~02.–11.11., T-S175-2 Visa ~03.–11.11., T-S175-3 ZABA_2026-10).

---

# DIO 2 — tehnički (za Claudea)

## Dokazano (S178, TEST = kopija PROD-a 22.10., `prod_to_test --settings --apply`)
| Što | Kako | Rezultat |
| --- | --- | --- |
| apply + undo vraća sve | `backup_db` 10:55 → apply → undo → `backup_db` 10:58 | **`sha256` 12/12 tablica jednak** |
| promjena između pregleda i primjene | 1 redak `Audible_Koka`→`_Sasa`; zatim naslov pločice | oba odbijena, `restructure_ops` 0 |
| promjena poslije operacije | 1 redak `Audible`→`Audible X` | povrat odbijen, ništa vraćeno; drugi povrat „već poništena" |
| prava | `rls_probe.py --env test` (privremeni write-share, obrisan) | vlasnik DA · grantee NE · stranac NE · service DA |
| izravni upis / interne funkcije | psql kao vlasnik / anon | `permission denied` |
| vrijeme | 9.743 promjena + 12 config | apply 2,5 s, undo 1 s (**service** preko PostgREST-a) |
| planer | `restructurePlan.test.mjs` 58, `restructureSheet.test.mjs` 24 | 5 + 3 sabotaže hvataju |

Skripta dokaza: `Claude-temp_R/s178/dokaz_058.mjs` (`plan|drift|apply|undo-drift|undo`, staje ako
nije TEST). Privremeni atribut `namjena` je s TEST-a **obrisan**; ostao je zapis `undone S178 dokaz_058`.

## NIJE dokazano / nije napravljeno
- **Pod Kokinim JWT-om (`authenticated`, `statement_timeout` 8 s) nije mjereno** vrijeme punog plana
  — sonda je zvala samo prazan (noop) plan. Isti posao kao service (2,5 s), ali izmjeriti kroz
  modal na TEST-u prije tvrdnje.
- **Sonda na bazi BEZ `058`** (oznaka `-` „nema u bazi") nije izvedena — prvi put na PROD-u prije
  puštanja `058`; očekivano `-` za sve tri RPC probe.
- **`058` NIJE na PROD-u**; `SCHEMA_PROD.sql` nema promjena. `SCHEMA_TEST.sql` osvježen.
- Snimka za planer u appu (`apply.ts`) ne postoji — dokaz je snimku gradio u skripti (paginacija s
  `order=id`, `event_attributes` filtrirani po ID-evima tekstualnih atributa). Predložak za `apply.ts`.
- `preuredjivanje_grep.py`, faza u `StructureImportModal`, E2E — ništa.

## Sljedeći koraci (redom)
1. **`src/lib/restructure/apply.ts`**: snimka Aree (kao `snapshot()` u skripti dokaza, kroz
   `fetchAllPaged`) → `planRestructure` → `supabase.rpc('rpc_restructure_apply', plan.rpc)` →
   ponovna snimka + planer (stari = 0) → `areas-changed`. Undo isto.
2. **Faza u `StructureImportModal`** POSLIJE §1–§11 uvoza (korak smije koristiti atribut koji je isti
   uvoz stvorio): tablica koraka (broj, promjena, 3 primjera), `plan.changes`, upozorenja (žuto),
   greške (crveno, gase Primijeni), kvačica „Vidio sam što se mijenja", rezultat s `op_id` + **Poništi**.
   Tada makni upozorenje „NIJE primijenjeno" iz `structureImport.ts` §12.
3. **E2E** jedan spec (sheet s preimenovanjem ⇒ lista novi naziv ⇒ Poništi ⇒ stari).
4. **`Tools/preuredjivanje_grep.py <file.xlsx>`** — stare vrijednosti po Python rječnicima.
5. Puštanje §16. ⚠ Prije `058` na PROD: deploy F5 (isti build).

## Otvoreno pri izvedbi
- Brisanje opcije s retcima u Structure uvozu ⇒ upozorenje koje upućuje na sheet (§17).
- `default_value` atributa jednak preimenovanoj vrijednosti planer samo **javlja** (§18) — odluči
  hoće li F1 pisati i taj stupac (treba nova vrsta zapisa u `058`).
- Kad F1 preimenuje Tip/Podtip, **`pravila_trgovca.PRAVILA` ide po grep popisu** (S177).

## Otvoreno — ostalo (po prioritetu, nepromijenjeno od S177)
1. **Mali, neovisni:** traženje u izborniku po oba nivoa (O6) · prekidač Bucketi | Namjena (RAZREZ R5).
2. **Trening:** F2 (tip atributa, izvođenje iz teksta) pa generator — tek poslije F1.
3. **Pregled razlika prije Structure uvoza** (BACKLOG „Napredak Aree između korisnika").
4. Iz S173: `--par=<id8>:<iznos>` ako MC_2026-10 da `NEJASNO` · `MOŽDA KRIVO MJESTO` za MC · T23 u appu.
5. Iz S172: Excel uvoz `default_map` kad se roditelj promijeni · „Review" sheet · delta retci ispod
   sekcije · ↗ ne vraća `attrFilter`.
