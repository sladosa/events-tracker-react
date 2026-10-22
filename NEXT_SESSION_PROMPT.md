> Pisano protiv `4082c7b` (S176, nastavak 22.10.) + commita koji nosi ovaj file.
> **`main` = `07361eb` (deploy 19.10.):** uvozni guard (S174) i Košare ↗ oznaka (S175) su na PROD-u.
> **Na `test-branch`, NIJE na PROD-u:** F5 (`AreaSettings`, Structure export = jedna Area) i
> „Create categories & continue" ne dira postojeću Areu — čekaju T-S175-6 i deploy (bez migracije).
> **PROD baza:** S174, S175 i S176 nisu pisale ništa (S176 samo čitao, service ključ).
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md` i `data-prep_tools/CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S176 (2026-10-20)

> **Ukratko (S176):** razgovor o treningu pokazao je da je pravi problem krutost strukture, ne sam uvoz — pa je odlučeno da prije treninga dođe alat za preuređivanje (preimenuj, spoji, premjesti, izdvoji os; jedna transakcija u bazi, s poništavanjem), da trening ide u Fitness / Health_Sasa / Life_Sasa, a mjerenje Financija je pokazalo da Tip/Podtip u dva polja nosi tri pitanja, pa Koka pristaje na novi atribut Namjena.

---

# DIO 1 — netehnički (za Sašu)

## Gotovo (S176) — samo dokumenti, ništa u bazi
- **Trening:** tvoje ambicije (periodi, AI, usporedbe između Area) i odgovori na Q1–Q17 su na vrhu
  `docs/TRENING_MIGRACIJA.md`. Raspodjela: `Fitness` (dnevni trening), `Health_Sasa` (san, HRV,
  noćni puls, koraci — Koka smije vidjeti), `Life_Sasa` (nova, privatna: periodi, trenuci, dnevnik).
- **Alat za preuređivanje strukture** — dolazi **prije** treninga: `docs/PREUREDJIVANJE_SPEC.md`.
  Jednim potezom preimenuje / spoji / premjesti opcije i izdvoji „za koga" u novi atribut; prvo
  pokaže što će promijeniti, radi u jednoj transakciji i može se poništiti.
- **Financije:** izmjereno da Tip/Podtip u dva polja nosi tri pitanja (na što / za koga / kakav
  trošak). **Koka se složila** s novim atributom `Namjena` (Zajedničko · Koka · Saša · Kućište) i
  čišćenjem preklapanja (T38).

## Što treba od tebe
1. ✅ **T-S175-6 prošao (22.10.).** **Deploy ČEKA — odluka 22.10.:** F5 ide na PROD **zajedno s F1**
   (jedan Netlify build); ranije samo ako zatreba mijenjati buckete Excelom na PROD-u.
2. **Ništa za preuređivanje prije koda** — sitni izbori (Decathlon → Sport, Anja → Transfer,
   `Kuća/Osiguranje` → `Osiguranje / Kuća`, `Sasa` → `Saša`) imaju prijedlog i potvrđuješ ih u suhom
   prolazu alata (PREUREDJIVANJE §8.2).
3. **Garmin:** ako stigneš, zahtjev Garminu za izvoz do danas (podaci u bazi staju 14.02.2025.).
4. **T-S174-3 (PROD)** kad nastaviš ručno razvrstavanje, pa **T-S174-5**; odluka `PARKING` (12/13) / `GLOVO`.

## Studeni (`S175_tests.md`)
- **~03.–11.11. T-S175-2 Visa** · **~02.11. → 11.11. T-S175-1 MC** · **ZABA_2026-10 T-S175-3**.

---

# DIO 2 — tehnički (za Claudea)

## Stanje
- **S176 = samo dokumenti:** `docs/PREUREDJIVANJE_SPEC.md` (nov; DIO 2 §9–§17 je spec za kod F1),
  `docs/TRENING_MIGRACIJA.md` (vrh: zaključci i odgovori 20.10. — **imaju prednost** nad §3/§5 niže,
  koji su djelomično zastarjeli; prepisati ih kad krene generator). `Diary.md` → `docs/_archive/`.
- **Izmjereno na PROD-u 20.10. (samo čitanje):** Financije_all 5.443 transakcije, 18 Tipova, 69 parova;
  36/136 trgovaca na više parova; `groupings["Vrsta troška"]` 52 retka. Fitness / Health_Sasa
  struktura i brojke: TRENING_MIGRACIJA „Što sam izmjerio". Skripte su bile jednokratne (scratchpad).
- **F5 (S175):** `areaSettingsSheet.ts`, `writeAreaSettingsSheet`, §11 u `importStructureExcel`;
  E2E `S175_area_settings_roundtrip`. Korak 7: `existingAreasUntouched`.
- Kopija trening filea: `Claude-temp_R/trening/trening.xlsm` (19.10.).
- **22.10. (nastavak S176, samo dokumenti):** T-S175-6 ✅; PREUREDJIVANJE §8.2 dopunjen — Anja
  **ostaje prihod** (46 rata `NN/96`; jedna, 25.09.2026. `Rata 86/96`, krivo kao Transfer), prihodi po
  osobi = os Namjena (ne bucketi), **Nenin novac**: 50.000 € je prolaz Nena→Koka→Igor (Transfer,
  ispravno), a fond su 7.000 + 5.000 (25./28.07.) **krivo kao `Prihodi / Koka`** ⇒ prijedlog Namjena
  `Nena` na obje strane (Koka bira ime). BACKLOG: opis po retku `AreaSettings` sheeta, os datuma
  samo na Troškovima (uz prekidač Bucketi | Namjena).
- **Deploy:** `test-branch` (F5 + Korak 7) čeka F1 — v. DIO 1 točka 1.

## Otvoreno — kod (po prioritetu)
1. **`po_pravilu` u `fill_from_izvod` (MC/ZABA/RF) i `visa_uvoz_izvoda`** — **prije studenog**
   (rok MC 11.11.). Postojeći rječnici/presedan prvo; provjera unatrag prije (S164).
   ⚠ Ne smije pomaknuti T-S173-1 harness (`Claude-temp_R/s173_mc/regresija.sh`) osim u `Tip`u.
2. **F1 preuređivanja** po PREUREDJIVANJE DIO 2 — redoslijed izvedbe:
   `058_restructure.sql` (TEST kroz psql; PROD pušta Saša) → `src/lib/restructure/plan.ts` + unit
   testovi nad `areaSettings_prod_2026-10-18.json` (sabotaže) → `sheet.ts` + prazan sheet u exportu →
   faza u `StructureImportModal` → `apply.ts` → dokaz povrata `sha256` na TEST-u (kopija PROD-a,
   `prod_to_test.py --settings`) → `rls_probe.py` probe → E2E → `Tools/preuredjivanje_grep.py`.
   ⚠ Otvoreno pri izvedbi: oblik filtra u `export_profiles` (`exportProfile.ts`), §17.
   ⚠ Prije `058` na PROD: F5 deploy (T-S175-6), jer puštanje §16 koristi Structure uvoz.
3. **Mali, neovisni:** traženje u izborniku po oba nivoa (O6) · prekidač Bucketi | Namjena u razrezu
   (poslije `Namjene`; RAZREZ R5 = jedno grupiranje).
4. **Trening:** F2 (tip atributa, izvođenje iz teksta) pa generator — tek poslije F1.
5. **Pregled razlika prije Structure uvoza** (BACKLOG „Napredak Aree između korisnika") — Financije-template.
6. Iz S173: `--par=<id8>:<iznos>` ako MC_2026-10 da `NEJASNO` · `MOŽDA KRIVO MJESTO` za MC · T23 u appu.
7. Iz S172: Excel uvoz `default_map` kad se roditelj promijeni · „Review" sheet · delta retci ispod
   sekcije · ↗ ne vraća `attrFilter`.
