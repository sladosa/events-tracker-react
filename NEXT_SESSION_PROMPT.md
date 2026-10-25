> Pisano protiv `af6b691` (zadnji S183 kod; prije njega `5fc3a98`, `839387c`) + commita koji nosi ovaj file (S183 zatvaranje, 25.10.).
> **Stanje u letu:** S183 je na `test-branch`, **netestiran ručno i nije na PROD-u** — Saša testira (T-S183-1) i deploya kasnije.
> **`main` = `1ed9798` (S181, PROD od 25.10.).** `test-branch` = `main` + docs S182 + **S183 (kod, nije na PROD-u)**.
> **TEST:** `Financije_all` ima novi config razreza (`set_breakdown.py --apply`, 25.10.): `views`, `sides`, bucketi 1A.
> **PROD:** stari config razreza (Koka razno / Saša razno); novi ide tek POSLIJE deploya (T-S183-2).
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md` i `data-prep_tools/CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija (S184)

> **Ukratko (S183):** pločica „Kamo ide novac" dobila je tri pogleda na iste retke — Bucketi, Namjena (čiji je trošak i prihod) i Tip — i stranu Fond, koja krupno kaže koliko je u Neninom fondu od početka (9.534,95 €), a „Koka razno" / „Saša razno" su raspušteni po vrsti troška, N/A ima ↗ za razvrstavanje; bez migracije, na TEST-u upisano i izmjereno, PROD čeka deploy.

---

# DIO 1 — netehnički (za Sašu)

## Gotovo (S183)
- „Kamo ide novac" ima prekidač **Bucketi | Namjena | Tip**. Brojke su iste u sva tri pogleda (Izašlo
  This Year na TEST-u 36.148,05), mijenja se samo raspored.
- **Namjena** radi i na Prihodima (ravno na Podtip, bez međurazine „Prihodi").
- **Fond** (treći izbor uz Troškovi | Prihodi, u pogledu Namjena): krupno koliko je u Neninom fondu **od
  početka** (9.534,95), traka potrošeno / ostaje, razdoblje iz filtra, kamo je otišlo / odakle je ušlo.
- **↗ na „nerazvrstano (N/A)"** — popis za razvrstavanje (retci bez Tipa ↗ nemaju; filtar ne zna „prazno").
  Tip pod bucketom ima ↗ samo kad je cijeli u tom bucketu (Razno nema, njegovi Podtipovi imaju).
- **Bucketi:** nema više „Koka razno" / „Saša razno". Gorivo, leasing i Lječnička komora su u Mjesečnima,
  registracija i popravci auta u Povremeno nužno, Projekti su svoj bucket.
- Na **Prihodima** nema izbora „po kupnji / po naplati" (bio bi isti broj).
- ↗ u pogledu Namjena: samo uz Namjenu (sve Kokine retke itd.), ispod nje ne.

## Što treba od tebe
1. **T-S183-1 — TEST lokalno** (`npm run dev`, tvoj račun): brojke po koracima su u
   `docs/sessions/tests/S183_tests.md`. Kad prođe ⇒ deploy.
2. **Deploy** (PowerShell, kad T-S183-1 prođe):
   ```powershell
   git checkout main
   if ($?) { git merge test-branch --no-edit }
   if ($?) { git push origin main }
   git checkout test-branch
   if ($?) { git merge main --no-edit }
   if ($?) { git push origin test-branch }
   ```
3. **T-S183-2 — PROD poslije deploya:** `set_breakdown.py` dry run (mora pokazati točno 9 razlika iz
   testa) ⇒ `--apply --yes-prod` ⇒ `verify_breakdown.py` ⇒ pošalji ispis. Migracije nema.
   Dok config ne ode, PROD pločica izgleda kao prije (novi kod bez `views` radi po starom).
4. Studeni (nepromijenjeno): T-S175-1 MC ~02.–11.11., T-S175-2 Visa, T-S175-3 ZABA_2026-10, T-S181-3.
5. T-S174-3 / T-S174-5 (PROD razvrstavanje starije povijesti), Garmin izvoz.

---

# DIO 2 — tehnički (za Claudea)

## Izvedeno (S183)
| Što | Gdje / dokaz |
| --- | --- |
| tipovi | `BreakdownWidget.views[]` (`BreakdownView`: `grouping` \| `by` \| ravno, `funds`), `date_axes[].sides`, `BreakdownSide` |
| model | `resolveViews`, `buildBreakdown(rows, w, grouping, view)`: `facet` čvorovi (obje strane), `scoped` ispod (drill none), `funds`; dims + `views[].by` |
| pločica | `BreakdownTile`: prop `groupings` (sva), prekidač pogleda u `lastView`, `sideAxes` / `axisOnSide`, redak fonda |
| config | `set_breakdown.py` (TEST upisano): 49 parova, `views`, `sides`, provjere ≤ 4 dims i fond ∈ opcije; `grouping` ostaje za stari bundle |
| testovi | unit §10–11 105/105 (sabotaže 1/4/1), `verify_breakdown` 4D ✓ + `EXPECTED_12` (TEST 25.10.) 19/19, E2E S183 2/2 + S165 5/5, `AreaSettings` roundtrip ISTO, `npm run check` ✓, build ✓ |
| dopune (Saša) | N/A po vrsti s ↗, `splitAcross` (Tip pod bucketom), strana Fond (`allModel` = 056 bez granica, `renderFund`), `LevelTree.skip` (Prihodi bez stalne razine); unit 125/125, E2E 7/7 (sabotaža stanja fonda s granicama ruši) |
| docs | RAZREZ §18, PREUREDJIVANJE §8.3/§20, help `overview.md`, CLAUDE.md § Overview, BACKLOG (2 stavke ✅) |

## Otvoreno
- **T-S183-2:** prvi pravi PROD ispis `verify_breakdown.py` s novim bucketima — PROD brojke (This Year) zapisati
  u T-S183-2 kad Saša pošalje. Claude ih ne može izmjeriti: klasifikator odbija i čisto read-only PROD alat (memorija).
- BACKLOG (S183): crta stanja fonda kroz vrijeme (migracija, mjesečno grupiranje) · ušlo/izašlo po računu na pločici salda.
- **056 granica 4 dimenzije** — Financije su na njoj. Ako zatreba `racun` (gotovina po vlasniku) ili nova os: migracija.
- **Prihodi Podtip = izvor** (R6, „plaća / mirovina") — tek tada pogled Namjena na Prihodima daje novu informaciju.
- Nepromijenjeno iz S181/S182: planer i lista `depends_on` pod `*` (PREUREDJIVANJE §20 — prije idućeg preuređivanja
  Namjene sheetom); pravila po trgovcu ne znaju Namjenu; F1b; O6 traženje u izborniku; Trening F2.
