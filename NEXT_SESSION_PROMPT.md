> Pisano protiv `cd9e439` (S193, puni E2E) i commita koji nosi ovaj file (S193 zatvaranje).
> **Stanje:** `main` = `f903401` (S183 kod, PROD od 26.10.); `test-branch` = `main` + S185 … S193, **nije deployano**.
> **Baze:** `058` je na PROD-u (od 22.10., S180); `059` i `060` su samo na **TEST-u**. S187–S193 nemaju migraciju.
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md` i `data-prep_tools/CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija (S194) — prvo Saša pregleda S193 i odluči o deployu; zatim alati Financija (T45, T41, T47) i sitnice

**Početak S194 (Saša, 05.11.):** *„idem vidjet što je napravljeno"* ⇒ prvo kratak pregled S193 za Sašu (što se
promijenilo, kako to vidi u appu na TEST-u: `npm run dev`), odgovori na pitanja, pa deploy po koracima niže ako
kaže da. Tek onda posao S194.

> **Ukratko (S193):** četiri trenja studenog kruga popravljena na test-branch (T48, T39, T50, T43 — uvoz 42 ispravka
> na TEST-u s više od 300 s na 11 s), T-S190-5 izveden bez Saše i usput našao kvar u Structure uvozu, a deploy je
> spreman za odluku.

---

# DIO 1 — netehnički (za Sašu)

## Gotovo (S193, 05.11.)
- **Traka upisuje Namjenu** (T48): skupni redak dobiva „Zajedničko" kao forma i uvoz.
- **Ti kao grantee u traci vidiš usporedbu** (T39): upišeš iznos ⇒ „✓ slaže se" ili razlika.
- **Uvoz više ne briše datume filtra** (T50).
- **Excel uvoz ispravaka je brz** (T43): 42 retka na TEST-u **11 s** (prije više od 5 min); završni ekran kaže
  „Trajanje". Usput: stari uvoz je **prešućivao** grešku upisa pojedinog polja — sada je kaže.
- **T-S190-5 izveden umjesto tebe** (Structure roundtrip, i za `Financije_all`): baza nepromijenjena. Usput nađen i
  popravljen kvar: uvoz je razdjelnik kolone liste `" + "` pretvarao u `"+"`.
- **Puni E2E (106):** 97 u prvom prolazu; 9 palih bilo je zagušenje TEST baze — svi prolaze ponovljeno.

## Odluka: DEPLOY — preporuka DA, prije 11.11.
Zašto prije 11.11.: Kokina MC traka (Σ 2.783,26) tada već upisuje Namjenu, a ti vidiš usporedbu — to su ujedno
testovi T-S193-1/2, bez posebnog sjedenja. Prosinački krug (MC ~02.12., Visa ~03.12.) dobiva brz uvoz.
Što još ide s deployem: trening rad S185–S192 (Koki se forma Financija ne mijenja — izmjereno: `Financije_all` nema
`default_value`; slobodna tekstualna polja postaju polje koje raste) i migracije `059`/`060` (samo tvoj alat
preuređivanja atributa).

**Koraci (ti, PowerShell, ovim redom):**
1. Backup PROD-a (iz `data-prep_tools`):
   ```powershell
   Tools\run.bat Tools\backup_db.py --env prod
   ```
2. Supabase **SQL editor PROD**: pokreni sadržaj `sql/059_restructure_values.sql`, pa `sql/060_restructure_retype.sql`
   (oba idempotentna, ovise o `058` koji je na PROD-u).
3. Merge i push (iz korijena repoa):
   ```powershell
   git checkout main
   if ($?) { git merge test-branch --no-edit }
   if ($?) { git push origin main }
   git checkout test-branch
   if ($?) { git merge main --no-edit }
   if ($?) { git push origin test-branch }
   ```
4. Kad Netlify završi: **Ctrl+Shift+R** kod tebe, i reci Koki da i ona osvježi (stari bundle, S118).
5. Shema u git (iz `data-prep_tools`): `Tools\run.bat Tools\dump_schema.py --env prod --diff` — javi mi ispis.

## Što treba od tebe / Koke (sve otvoreno: blok „Na redu" u `docs/sessions/PENDING_TESTS.md`)
1. **11.11., Koka:** traka MC → „Da, upiši" (T-S175-1 zadnji korak) ⇒ u Editu novog retka Namjena = Zajedničko (T-S193-1).
   Ti prije nje u traci upiši 2783,26 ⇒ „✓ slaže se" (T-S193-2).
2. **Prvi Kokin Excel uvoz poslije deploya:** pogledaj „Trajanje" i da filtar ostane This Year (T-S193-3).
3. Keks na RF ⇒ sidro 253,15 (T-S192-1); mobitel s kamerom tek na PROD-u (T-S191-6).
4. **T40** (Visa `cutoff:3:5` dan preširok): mjerenje PROD-a pokrećeš ti — naredbu dam u S194.

## Sljedeće (S194) — sve prije prosinačkog kruga
1. **T45** `fill_from_izvod --zaba`: storno („−0,10") sparivati s povratom ±1 dan; dedup bez Izvora ⇒ „MOŽDA KRIVO MJESTO".
2. **T41** Visa alat: prednost „istog dana" i sa strane retka u bazi (TEDI 10,85 ↔ 10,59).
3. **T47** kupnje zadnjih dana prije zatvaranja izvoda ⇒ predložiti „pomakni u sljedeću košaru" umjesto `--brisi`.
4. **T40** mjerenje (ti) ⇒ eventualno `cutoff:2:5` (samo config).
5. Sitnice: **T46** (čip „Custom · do X" na pločici salda), **T42** („older records" ne broji samo žig/Status/Datum
   naplate), **T44** (Visa „ISPRAVCI (n)" broji stvarne), **T49** (razvrstač i nad korijenom `izvodi\`).
6. Moguće: **uvoz NOVIH redaka** (MC/Visa) — provjera kolizija u pregledu ide upit po sesiji, redom; izmjeriti kao T43.

Trening (iz S191): T-S191-5, Gibljivost (P-1), skica View-a (P-2), pa korak 6.

---

# DIO 2 — tehnički (za Claudea)

## Izvedeno (S193)
| Što | Gdje | Dokaz |
| --- | --- | --- |
| T48 traka + `default_map` | `resolveDefaultMaps` (`importDefaults.ts`), `createSettleRow` (`dueConfirm.ts`) | E2E `S193_due_settle_defaults` (prava košara), sabotaža pada |
| T39 grantee usporedba | `basketAction({dateRequired})` (`dueBaskets.ts`), `DueStrip` | unit `dueSettle` +3, E2E `S168` grantee, sabotaža pada |
| T50 | `AppHome` onSuccess bez `setDateRange` | E2E `S193_import_speed`, sabotaža pada |
| T43 update put | `applyImportChanges` (`excelImport.ts`): samo promijenjeni, skupno čitanje, `UPDATE_POOL = 3`, greške; `ExcelImportModal` „Trajanje" | E2E `S193_import_speed`: 11 s / 103 poziva (sabotaža 124 s / 642) |
| `Sep` se ne reže | `structureImport.ts` ListColumns | E2E `S119` (sabotaža pada) |
| T-S190-5 | UI pod Sašinim TEST računom, snimka prije/poslije | `Claude-temp_R/s193/S193_tmp_structure_roundtrip.spec.ts` (izvan gita; ponovljiv) |

## Što je izmjereno (ulaz za S194)
- **PATCH jednog `event_attributes`** kao vlasnik: 75–250 ms u bazi (TEST) — RLS „area owner" grana gradi hash svih
  eventa Aree (15.495 za Sašin TEST). Pool 6 ⇒ `57014 statement timeout`; pool 1 = 62 s, pool 3 = 10–11 s (42 retka).
  ⚠ Na PROD-u (free instanca, incident 2026-07-06) pool 3 nije izmjeren — T-S193-3 to pokaže.
- **Puni E2E na TEST-u je na rubu:** pri kraju 50-min runa `statement timeout` već na seedu (S104, S162, S165, S175,
  S190, S191, S193 pali, svi prolaze ponovljeno). Teške uvoze (S193_import_speed) ne vrtjeti neposredno prije punog runa.
- **Create put uvoza (novi retci)** nije mjeren; `checkImportCollisions` ide upit po sesiji redom (+ upit slika).

## Otvoreno / zapamti
- E2E global-setup svaki put pokuša obrisati `S189 serije proba` (pod E2E vlasnikom `eef0d779`) i ne uspije
  (8.339 eventa, 46.921 atribut — izmjereno netaknuto; `.in()` s 1000 id-jeva vjerojatno pada na duljini URL-a).
  Dodati je u `SEED_AREAS` ili preseliti dok korak 6 ne krene — inače jednom kad brisanje „uspije", proba nestaje.
- Klasifikator i dalje blokira Claudeove PROD pozive ⇒ deploy, backup PROD-a i `dump_schema --env prod` radi Saša.
- `S190 Trening proba` i `S189 serije proba` brisati kad korak 6 ima pravu Areu (iz S191).
