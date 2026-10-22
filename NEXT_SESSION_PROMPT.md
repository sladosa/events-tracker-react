> Pisano protiv `d5f07c2` (S179) + commita koji nosi ovaj file (S180, 22.10.).
> **`main` = `1f53e90` (deploy 22.10., S179).** Na `test-branch`, NIJE na PROD-u: `ca7fa08` (klik sa strane ne
> zatvara Structure Import dok postoji pregled) + S180 (samo Python alati i docs).
> **PROD (22.10., 14:40):** `namjena` postoji, nijedan redak je nema; preuređivanje još NIJE pušteno (T-S180-2).
> **TEST:** kopija PROD-a 22.10. 14:15 + sheet S180 **primijenjen** (op `2b200967`) — TEST izgleda kako će PROD.
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md` i `data-prep_tools/CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — Kokin uvoz preuređivanja na PROD-u (T-S180-2), nakon S180

> **Ukratko (S180):** sheet s 24 koraka za Financije (osoba iz imena Podtipa u Namjenu, Nenin fond, Decathlon, Anja, osiguranje kuće, auti, zadano Zajedničko) složen je alatom i izmjeren na kopiji PROD-a — 6.066 promjena u 2,4 s, saldo i ukupni zbroj isti u cent, povrat vraća sve — a Python rječnici su ispravljeni istog dana; na PROD čeka deploy i Kokin uvoz.

---

# DIO 1 — netehnički (za Sašu)

## Gotovo (S180)
- **Sheet za Financije je složen i izmjeren** na kopiji PROD-a, s tvojim odlukama:
  - osoba iz imena ide u **Namjenu**: `Audible_Koka` i `Audible_Sasa` postaju `Audible`, a Namjena kaže čije je.
    Isto za Kindle, Sport, Medical, Lječničku komoru i Odjeću. Prihodi i Projekti dobiju samo Namjenu.
  - `Projekti / Sasa` → `Projekti / Saša` (ručkovi u Radničkoj, Konzum, Claude: trošak projekta).
  - Nenine uplate 7.000 + 5.000 → `Prihodi / Nasljedstvo`, Namjena **„Nena / Kućište"**. U fondu je
    **9.534,95 €** (ušlo 12.000, izašlo 2.465,05).
  - Decathlon → `Zdravlje / Sport` · Anja 25.09. → `Povrat Anja` · osiguranje kuće → Tip `Osiguranje`.
  - Lacetti → Saša, C5 → Koka, sve ostalo → **Zajedničko**.
- **Izmjereno:** 6.066 promjena u 2,4 s, saldo oba računa i ukupni zbroj **isti u cent**, a N/A je 13 manje
  (Decathlon). Poništi je vratio sve.
- **Python alati su ispravljeni** (pravila po trgovcu, bucketi), pa nakon Kokinog uvoza predlažu nove nazive.
- **Nađeno:** tvoj shortcut **`AI_rucak`** nosi stari `Projekti / Sasa`, a Kokin uvoz ga ne vidi.
  Alat ga ispravi poslije njezinog uvoza (korak 6 ispod).

## Što treba od tebe — redom (PROD)

```powershell
cd C:\0_Sasa\events-tracker-react

# 1) Deploy — donosi „klik sa strane ne zatvara modal" (inače slučajan klik odnese Undo)
git checkout main
if ($?) { git merge test-branch --no-edit }
if ($?) { git push origin main }
git checkout test-branch
if ($?) { git merge main --no-edit }
if ($?) { git push origin test-branch }

# 2) Backup PROD-a + svježe kontrolne brojke PRIJE (samo čitanje)
cd data-prep_tools
.\Tools\run.bat Tools\backup_db.py --env prod
cd ..
node Claude-temp_R\s180\kontrola.mjs prije --env prod
```
Očekivano za korak 2: `saldo {"Kokin tekući ZABA":"10304.61","Sašin tekući RF":"905.45"} | N/A 1392 | eventa 5455`
(ako su u međuvremenu upisani novi retci, brojke se razlikuju — to je u redu, mjeri se razlika).

**3) Kad Netlify završi** (Ctrl+Shift+R): Area `Financije_all` → **Structure** → **Export** →
```powershell
node Claude-temp_R\s180\build_sheet.mjs "<putanja do exporta>.xlsx"
```
Očekivano: `makni rows[39] (Razno / Odjeća/obuća/ostalo_Sasa)`, `makni rows[44] (Kuća / Osiguranje)`,
`namjena: 3 retka`, `Preuređivanje: 24 koraka`.

**4) Koka (vlasnica), na računalu:** Ctrl+Shift+R → Structure → **Import** → `…_preuredjivanje.xlsx`.
Očekivano: `Attributes updated 1`, `Area settings changed 1 · groupings` → pregled
**`24 steps · 6.066 changes · 5.455 rows`** (svaki novi redak +1) + **žuto upozorenje o shortcutima**
(očekivano) → kvačica → **Apply** → „exactly what the preview predicted ✓". Brojke po koraku: T-S180-2.

```powershell
# 5) Kontrola poslije — očekivano: saldo ISTO, N/A 1392 → 1379, ukupno isto, „Nena / Kućište" 16 redaka
node Claude-temp_R\s180\kontrola.mjs poslije --env prod
node Claude-temp_R\s180\kontrola.mjs --diff Claude-temp_R\s180\kontrola_prod_prije.json Claude-temp_R\s180\kontrola_prod_poslije.json

# 6) Tvoj shortcut AI_rucak (dry run pa upis) + provjera bucketa
cd data-prep_tools
$env:ET_TARGET='prod'; .\Financije\run.bat fix_shortcuti_S180.py
$env:ET_TARGET='prod'; .\Financije\run.bat fix_shortcuti_S180.py --apply --yes-prod
$env:ET_TARGET='prod'; .\Financije\run.bat set_breakdown.py
```
Očekivano za korak 6: `AI_rucak … Projekti / Sasa ⇒ Projekti / Saša · Namjena Saša` (1 od 5), pa
`set_breakdown`: **grupiranje: ISTO**, nesvrstano: ništa.

**7) Koka, na mobitelu:** Add → Tip `Zabava` ⇒ Podtip nudi `Audible` (bez `_Koka`), Namjena nudi „Nena / Kućište".

Ostalo nepromijenjeno: **T-S174-3/5** (PROD razvrstavanje), **Garmin** izvoz, **studeni**
(T-S175-1 MC ~02.–11.11., T-S175-2 Visa ~03.–11.11., T-S175-3 ZABA_2026-10).

---

# DIO 2 — tehnički (za Claudea)

## Izvedeno (S180)
| Što | Gdje | Dokaz |
| --- | --- | --- |
| builder sheeta | `Claude-temp_R/s180/build_sheet.mjs <export>` (Namjena lista, −2 bucketa u `AreaSettings`, 24 koraka) | TEST: 24 / 6.066, bez upozorenja |
| kontrola | `Claude-temp_R/s180/kontrola.mjs <tag> [--env prod]`, `--diff a b` (samo čitanje) | TEST prije/poslije/povrat; PROD prije 14:40 = TEST |
| pokretač | `Claude-temp_R/s180/run.mjs <file> [--keep]` (modal kao vlasnik, TEST) | apply 2,4/2,1 s, undo 1,1 s |
| grep | `Tools/preuredjivanje_grep.py`: korak s `event_id` preskočen | 106 → 29 → 8 (S107 skripte) |
| rječnici | `set_breakdown`, `pravila_trgovca`, `uvezi_transu`, `klasificiraj_transu` | `set_breakdown` dry run na TEST-u: ISTO |
| shortcuti | `Financije/fix_shortcuti_S180.py` (staje ako izbornik ima stari naziv) | TEST: podmetnut → 1 → 0 |

Event ID-evi u builderu su PROD-ovi (TEST je kopija s istim ID-evima). Koraci po retku nose i uvjet Tip/Podtip.

## Otvoreno
- **T-S180-2** (gore). Ako Kokin pregled pokaže **grešku** ili brojke jako odstupaju — prvo
  `kontrola.mjs prije --env prod` vs TEST, pa tek onda kod.
- **Planer i lista `depends_on` pod `*`** (spec §20, CLAUDE.md): korak koji mijenja POSTOJEĆU Namjenu bi
  stvorio ključ po Tipu samo s ciljem. Popravak + test u `restructurePlan.test.mjs` **prije** idućeg
  preuređivanja Namjene (npr. C5 putovanja → Zajedničko).
- **Namjena na novim retcima s izvoda:** `fill_from_izvod` / `visa_uvoz_izvoda` je ne pišu (forma da, Excel
  uvoz ne). Prije prekidača Bucketi | Namjena (RAZREZ R5): alati upisuju zadano po Tipu, ili razrez
  prazninu broji kao Zajedničko.
- **Bucketi „Koka razno" / „Saša razno"** su namjena-bucketi — s Namjenom postaju zalihost; odluka uz R5.
- Iz S179: zalihost vremena (8 s) — S180 plan 2,4 s, OK; F1b popis operacija s Poništi u Structure tabu;
  brisanje opcije s retcima u Structure uvozu ⇒ upozorenje (§17).

## Otvoreno — ostalo (po prioritetu, nepromijenjeno)
1. **Mali, neovisni:** traženje u izborniku po oba nivoa (O6) · prekidač Bucketi | Namjena (RAZREZ R5).
2. **Trening:** F2 (tip atributa, izvođenje iz teksta) pa generator — tek poslije F1 na PROD-u.
3. **Pregled razlika prije Structure uvoza** (BACKLOG „Napredak Aree između korisnika").
4. Iz S173: `--par=<id8>:<iznos>` ako MC_2026-10 da `NEJASNO` · `MOŽDA KRIVO MJESTO` za MC · T23 u appu.
5. Iz S172: Excel uvoz `default_map` kad se roditelj promijeni · „Review" sheet · delta retci ispod
   sekcije · ↗ ne vraća `attrFilter`.
