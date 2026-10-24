> Pisano protiv `a51def4` (S181) + commita koji nosi ovaj file (S181, 24.10.).
> **`main` = `1f53e90` (deploy 22.10., S179).** Na `test-branch`, NIJE na PROD-u — **Saša deploya 25.10.:**
> `ca7fa08` (klik sa strane ne zatvara Structure Import), `5dd4c96` (Excel izbornici po atributu, BUG-S181-DEPNAME;
> zadana Namjena u alatima za izvode), `a51def4` (Excel uvoz: `default_map` na prazan NOVI redak).
> **PROD:** profil `Kokin_format` s Namjenom iza Podtipa (24.10., T-S181-1 ✅). Inače kao poslije S180.
> **TEST:** = PROD (kontrola 24.10. prije/poslije testnog uvoza ISTA; profil isti).
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md` i `data-prep_tools/CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S181 (Namjena u Excel roundtripu)

> **Ukratko (S181):** profil `Kokin_format` dobio je Namjenu iza Podtipa (na PROD-u, Saša pod Kokom), roundtrip i delta sheet izmjereni na TEST-u bez ijedne razlike, a usput nađen i popravljen bug zbog kojeg je Excel izbornik Namjene nudio Podtipove; alati za izvode i Excel uvoz sada novom retku upisuju zadanu Namjenu kao forma — deploy sutra.

---

# DIO 1 — netehnički (za Sašu)

## Gotovo (S181)
- **Kokin Excel ima Namjenu odmah iza Podtipa** (profil na PROD-u). Ništa se drugo nije pomaknulo; uvoz
  nepromijenjenog filea ne mijenja ništa, a promjena samo Namjene ne traži kvačicu „potvrđeno stanje".
- **Bug:** u Excelu je izbornik Namjene nudio Podtipove, a pod `auto C5`/`auto Lacetti` ni Podtip nije
  imao izbornik (od 22.10.). Popravljeno — **vrijedi tek poslije deploya**; do tada Namjenu upisivati rukom.
- **Prazna Namjena više ne ostaje prazna** na novim retcima: alati za izvode i Excel uvoz upišu
  Zajedničko (C5 → Koka, Lacetti → Saša), kao forma. Upisano se nikad ne mijenja.

## Što treba od tebe
1. **Deploy** (PowerShell, CLAUDE.md „End of session" 11) — pa **Ctrl+Shift+R** i:
   - **T-S181-2:** Export `Kokin_format` (Download Excel) ⇒ Namjena pod `Razno` nudi 4 namjene, Podtip pod
     `auto C5` gorivo · leasing · popravci · registracija.
   - **T-S181-4:** uz prvi Excel uvoz s novim retkom bez Namjene ⇒ pregled kaže „Zadano iz pravila …".
2. **Studeni** (nepromijenjeno + T-S181-3): T-S175-1 MC ~02.–11.11., T-S175-2 Visa ~03.–11.11., T-S175-3
   ZABA_2026-10 — alat sada ispiše i redak `Namjena [PROD]: …`.
3. Ostalo: **T-S174-3/5** (PROD razvrstavanje), **Garmin** izvoz.

## Plan sljedeće sesije (ostatak iz S180)
- **„Kamo ide novac" po Namjeni** (RAZREZ R5): prekidač **Bucketi | Namjena** + odluka o bucketima
  „Koka razno"/„Saša razno" (ista os dvaput) i „Nena / Kućište" na strani Prihoda.
- **Planer i lista `depends_on` pod `*`** (spec §20) — **prije** idućeg preuređivanja Namjene.

---

# DIO 2 — tehnički (za Claudea)

## Izvedeno (S181)
| Što | Gdje | Dokaz |
| --- | --- | --- |
| izbornik po ovisnom atributu | `excelExport.ts` `rangePrefix` / `dependentRanges` | `excelDependentRanges.test.mjs` (stari 8/10 pada); TEST izvoz 42 raspona, 0 s dva područja |
| isto u Pythonu | `_excel_izbornici.py` (`Dep_podtip`, `Dep_namjena`, `provjeri(…, namjena)`) | `t_pisi.py`; sabotaža ⇒ `provjeri` staje |
| zadana Namjena u alatima | `_db.namjena_pravilo/namjena_za`, `fill_from_izvod.write_rows`, `visa_uvoz_izvoda`, `rate_alat.ATTRS` | `t_fill.py` ⇒ Saša/Zajedničko/Koka, pregled `3 New` |
| `default_map` na uvozu | `importDefaults.ts`, `excelImport.fillImportDefaults` (pregled + upis) | `importDefaults.test.mjs` 16; TEST uvoz ⇒ baza ✓, obrisano, kontrola ISTA |
| alati mjerenja | `Claude-temp_R/s181/` (`export_profile.mjs`, `import_preview.mjs [--apply]`, `verify_dd.mjs`, `inspect_delta.mjs`, `compare.mjs`, `test_rows.mjs [--delete]`, `prod_profile.mjs`) | — |

## Otvoreno
- **Planer i lista `depends_on` pod `*`** (spec §20) — mina naoružana (Namjena ima vrijednosti).
- **Pravila po trgovcu ne znaju Namjenu** (ENRICH_PLAN S181) — ljekarna na Visi ⇒ `Medical` + Zajedničko.
- **Bucketi „Koka razno"/„Saša razno"** — zalihost uz Namjenu; odluka uz R5.
- Iz S179: F1b popis operacija s Poništi u Structure tabu; brisanje opcije s retcima u Structure uvozu ⇒
  upozorenje (§17).

## Otvoreno — ostalo (po prioritetu, nepromijenjeno)
1. **Mali, neovisni:** traženje u izborniku po oba nivoa (O6) · prekidač Bucketi | Namjena (RAZREZ R5).
2. **Trening:** F2 (tip atributa, izvođenje iz teksta) pa generator. ⚠ Uvoz sada primjenjuje `default_map`
   (ne `default_value`) na nove retke — nova Area s `default_map` ga dobiva sama.
3. **Pregled razlika prije Structure uvoza** (BACKLOG „Napredak Aree između korisnika").
4. Iz S173: `--par=<id8>:<iznos>` ako MC_2026-10 da `NEJASNO` · `MOŽDA KRIVO MJESTO` za MC · T23 u appu.
5. Iz S172: Excel uvoz `default_map` kad se roditelj promijeni (postojeći redak — S181 pokriva samo nove) ·
   „Review" sheet · delta retci ispod sekcije · ↗ ne vraća `attrFilter`.
