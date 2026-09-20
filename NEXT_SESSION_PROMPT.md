# Sljedeca sesija - handoff

**Pisano protiv commita:** `5129f9c` + izmjene zatvaranja S143 (idu istim commitom).
**`main` NIJE diran u S143** - sve stoji na `test-branch`. Deploy nije trazen ni pusten.
Ako `git log` pokazuje novije, citaj ovo kao povijest; CLAUDE.md je autoritet.

---

# DIO 1 - netehnicki (za Sasu)

## Sto je gotovo

**`DELTA_WINDOW_SPEC` je cijeli izveden** - sve cetiri faze. Zastita proslosti vise nije samo
boja: sheet **kaze** (oznaka i ton), **mjeri** (kontrolna tocka po sidru) i uvoz **trazi
pristanak** (druga kvacica koja imenuje sidro).

**Sort te vise ne moze iznenaditi.** Ono sto si nasao - da sort povuce karticne retke u glavni
blok, a drugi put i sazetke - zatvoreno je u tri sloja: prazan redak zaustavlja sort iz vrpce,
brojke su neovisne o redoslijedu, a pomijesan raspored **sam se prijavi** crvenom porukom koja
kaze i **sto uciniti** ("novi izvoz ce srediti").

**Dva upozorenja koja su lagala su maknuta**, ne preformulirana: ono o `created_at` pri uvozu
(hvatalo je mehanizam samog appa) i "ne izvozi svih N dogadjaja" pri izvozu (tvrdilo suprotno
od istine otkad se prozor mjeri sidrima).

**Help je dopunjen** s tri teme koje ti i Koka stvarno trebate: kontrolne tocke, kako sigurno
sortirati, i sto znaci uvoz retka koji je vec potvrdjen.

## /!\ Nalaz koji ceka tvoju odluku

**Faza 3 je na prvom pokretanju nasla stvarnu rupu u povijesti.** ZABA podaci izmedu
02.01.2025. i 30.07.2026. **ne reproduciraju potvrdu** - fali **45,94**.

Svedeno je na tri retka, sa svim dokazima izmjerenim:

| redak | sto s njim |
| --- | --- |
| `17.08.2025. · -45,94 · bez opisa` | **obrisati** - banka ga nema ni u jednom izvodu |
| blizanac iste minute, bez `Izvor`a | odluciti (ne dira saldo, ali je skriveni duplikat) |
| `-0,80` na `07.08.2025.` | pomaknuti na **`07.07.2025.`** - tipfeler u mjesecu |

**Skripta jos nije napisana.** Ide dry run pa `--apply` koji pokreces ti.
/!\ Ispravak **ne mijenja danasnje stanje** (`12.284,32`) - svi su retci prije sidra 30.07.2026.
Mijenja se samo to da povijest pocne reproducirati potvrde.

/!\ Zasto to nitko nije vidio: oba blizanca su u **istoj minuti**, a aplikacija retke te minute
prikazuje kao **jedan**.

## Sto trazi tebe

1. **Nista za push** - `test-branch` je pushan, `main` netaknut.
2. **Cetiri testa cekaju** (`T-S143-12, -13, -14, -16`), detalji u
   `docs/sessions/tests/S143_tests.md`. Najvazniji je **T-S143-12**: uvezi file s izmjenom
   retka **prije 30.07.2026.** i provjeri da Apply trazi **dvije** kvacice.
3. **Odluka o ona tri retka** (gore) - reci i pisem skriptu.
4. Ostalo od prije: **T-S139-10 dio B** (uvoz Structure filea) kad budes kod Kokinog racuna.

## Sto NE treba raditi

- **Ne sortiraj delta file iz vrpce s rucno oznacenim rasponom** - strelica u zaglavlju je
  siguran put. Ako ipak zalutas, crvena poruka ce ti reci.
- **Ne diraj `next:3` / `cutoff:3:5`** - ostaje dok PBZVISA ispravljac ne postoji.

---

# DIO 2 - tehnicki (za Claudea)

## Novo u ovoj sesiji

| sto | gdje |
| --- | --- |
| Okvir praznih redaka (`solid fill` guta gridline-ove) | `src/lib/deltaSheet.ts` |
| Prazan redak ISPOD praznih redaka i IZMEDU naslova i zaglavlja | `deltaSheet.ts`, `excelExport.ts` |
| `calcTo` - `SUMIFS` rasponi neovisni o redoslijedu; `razlika` bez `LOOKUP` | `deltaSheet.ts` |
| Detektor pomijesanog rasporeda (formula, nosi rjesenje) | `deltaSheet.ts` |
| Kontrolne tocke po sidru + `extraHeaderRows` | `deltaSheet.ts`, `excelExport.ts` |
| Pravilo "je li redak potvrdjen" - **cista funkcija** | `src/lib/confirmedPeriod.ts` (nov) |
| Update-guard: `confirmedBy`/`confirmedCount` + druga kvacica | `excelImport.ts`, `ExcelImportModal.tsx` |
| Uvoz trazi zaglavlje **skeniranjem**, ne pomakom od naslova | `excelImport.ts` |
| `created_at >= session_start` provjera **maknuta** | `excelImport.ts` |
| `FILTERS_IZVRSENO` bez `Cash` | `data-prep_tools/Financije/verify_rpc_vs_model.py` |
| 49 -> 95 tvrdnji | `deltaSheetLayout.test.mjs` |
| 27 -> 33 tvrdnji | `importForeignRows.test.mjs` |
| 16 tvrdnji / 3 sabotaze | `confirmedPeriod.test.mjs` (nov) |
| Sonde (read-only, PROD) | `Claude-temp_R/_probes/s143_*.py`, `s143_autofilter.mjs` |

## Otvoreno, po prioritetu

1. **`OTVORENO-S143-4594`** - skripta za tri ispravka (v. DIO 1). Dry run + `--apply` koji
   pokrece Sasa. Poslije: `promet_check` 2025-07/-08 -> `0,00`, kontrolne tocke -> `0,00`.
2. **PBZVISA ispravljac** - cita **dva** izvora (PBZVISA za stavke, **RF izvod** za dan i iznos
   stvarne naplate). Glob mora biti `PBZVI[SZ]A_*`.
3. **Zaglavlje Add Activity po Arei** - unos za jucer i dalje trazi dva ekrana.
4. **Structure fan-out** - `AppHome:122` treba `refetch` bez automatskog dohvata.
5. **E10-2 / E7-2** - uzrok nedovrsenih zahtjeva i dalje nije utvrden.

## Zamke koje su danas ugrizle

- **Excelov sort iz vrpce i `Ctrl+A` gledaju TEKUCU REGIJU, ne `autoFilter`** - omeduje je samo
  redak bez ijedne popunjene celije. Dva jaza su bila lazna: kontrola kosare ispod, i naslov
  `EVENT DATA:` (jedna celija!) iznad.
- **Relativna tvrdnja ne hvata skliznuti raspored** - treba apsolutno sidro.
- **Test koji ne moze pasti**: tvrdnja o sudaru `Potvrda`/`Provjeri` bila je stavljena na sheet
  BEZ sekcije, gdje je sudar nemoguc po konstrukciji.
- **Moja sonda je optuzila ispravan kod** - `FILTERS_IZVRSENO` je nosio filtar od prije S111.
  Prije nego se nalaz pripise kodu, provjeri mjeri li alat istim ravnalom kao app.
- **`sed -i` na fileu s dijakritikom pokvari bajt** - za izmjene koda koristi python s
  eksplicitnim `encoding='utf-8'`.

## Sto je izmjereno, da se ne mjeri ponovo

- **Kontrolna tocka**: `Prozor = 1` -> `0,00`; `Prozor = 2` -> `45,94` na obje tocke, potvrdjeno
  sirovim izracunom iz baze (`3.054,41 + 10.714,98 = 13.769,39` protiv sidra `13.815,33`).
- **Parsiranje `ZABA_2025-07` i `-08`** se poklapa s ispisanim bankinim zbrojevima i
  `NOVO STANJE` u cent -> banka nema redak od 45,94.
- **Gotovinski troskovi** (`Izvor = Cash`): tri retka ukupno, `-66,00` (20.05.2026.),
  `-20,00` (27.08.2026.), `-10,00` (08.09.2026.); samo zadnja dva imaju `racun = ZABA`.
- **Sort Test A**: `Ctrl+A` daje `A25:AB100` - sazeci i kosara izvan.
- **Sort Test B**: nasilni sort -> `razlika` ostaje `0,00`, upozorenje osvane, sazeci ostaju.

## Napomena o ritualu

`audit_tests.py` javlja **S142 spreman za arhivu** (10/10 ✅). Arhiviranje nije napravljeno -
sekcija u PENDING seli **zajedno** s `tests/S142_tests.md` u `DONE_HISTORY.md` odnosno
`Claude-temp_R/test-sessions/archive/`.
