# Sljedeca sesija - handoff

**Pisano protiv commita:** `920af09` + izmjene zatvaranja S142 (idu istim commitom).
**`main` NIJE diran u S142** - sve stoji na `test-branch`. Deploy nije trazen ni pusten.
Ako `git log` pokazuje novije, citaj ovo kao povijest; CLAUDE.md je autoritet.

---

# DIO 1 - netehnicki (za Sasu)

## Sto je gotovo

**Delta prozor vise ne staje na sidru.** Dosad je sidro bilo **tvrd pod**: trazio si 60 dana,
a file je nosio **12** - i **47 ZABA redaka** je nestajalo bez ijedne poruke. Sada prozor
krece dan poslije **predzadnje** potvrde, kako si predlozio. Polje u panelu vise ne pita
"koliko dana" nego **"koliko potvrda unatrag"**, zadano 1.

Zasto bas sidra a ne dani: samo tako je otvarajuce stanje **broj koji je potvrden izvana**, a ne
izracun. Provjerio sam to na PROD-u umjesto da procitam iz koda - **sest provjera, sest
prolaza, u cent** (ZABA `13.815,33`, RF `799,12`), i uz **nula** zapisa koji bi se zbrajali.

**Retci koji su vec unutar potvrdjenog stanja sada se vide.** Dobili su kolonu `Potvrda`
(`potvrdjeno 06.09. · ZABA_2026-07.pdf`) i **sivi ton**. Prazni retci za unos dobili su
**topao zuckast ton** - ono sto si trazio.

Dvije stvari koje vrijedi znati o toj oznaci:
- **Ziva je.** Promijenis li datum retka, oznaka nestaje istog trena. Nije upisan tekst.
- **Stoji i na praznim retcima.** Upises li u prazan redak datum u proslost, oznaka iskoci
  sama - to je **jedini** trenutak u kojem se takav unos moze uhvatiti prije uvoza.

**Poslao sam ti primjerak filea u razgovoru** (`PRIMJER_delta_ZABA.xlsx`, izmisljeni retci).
Vrijedi ga otvoriti prije nego trosis vrijeme na provjeru uzivo.

## /!\ Sto NIJE gotovo, a tice se tvoje bojazni

Rekao si da te **strah korumpiranja vrijednosti u proslosti**. Ono sto je sada napravljeno to
**kaze**, ali ne **brani**: uvoz i dalje prihvaca izmjenu potvrdjenog retka bez pitanja.

Prava brana je **faza 4** (update-guard na uvozu) i nije radjena. Dok je nema, boja se ne smije
citati kao zastita. Ako ti to smeta, faza 4 je sljedeci red - **ne jaca boja**.

Do tada postoji i izlaz bez koda: postavi **Prozor = 0** i ponasanje je tocno kao prije.

## Sto trazi tebe

1. **Nista za push** - `test-branch` je pushan. `main` netaknut.
2. **Sedam testova ceka provjeru** (`T-S142-1` do `-7`), detalji u
   `docs/sessions/tests/S142_tests.md`. Najvazniji je **T-S142-1**: panel mora pisati
   `Od 31.07.2026. … pociva na potvrdi 30.07.2026. = 13.815,33`, a file nositi taj iznos u cent.
   ⚠ Samo **T-S142-7** pise u bazu (uvoz); ostalih sest su citanje i gledanje filea.
3. **Deploy na `main` NIJE napravljen i ne treba biti** dok ne kazes.
4. Kad budes kod **Kokinog** racuna: **T-S139-10 dio B** (uvoz Structure filea) - jos stoji.

## Sto NE treba raditi

- **Ne citaj sivi ton kao zastitu** - v. gore.
- **Ne popravljaj E10-2 u specu** - pada prije mjesta koje spec testira (stoji iz S141).
- **Ne diraj `next:3` / `cutoff:3:5`** - ostaje dok PBZVISA ispravljac ne postoji.

---

# DIO 2 - tehnicki (za Claudea)

## Novo u ovoj sesiji

| sto | gdje |
| --- | --- |
| `pickDeltaWindow` - izbor prozora, cista funkcija | `src/lib/deltaWindow.ts` (nov) |
| Kolona `Potvrda`, tonovi, biljeska potvrdjeno/izracunato | `src/lib/deltaSheet.ts` |
| Polje "sidara unatrag", ispis raspona, prag 200 | `src/components/activity/ExcelExportModal.tsx` |
| 25 tvrdnji + 3 sabotaze | `src/lib/__tests__/deltaWindow.test.mjs` (nov) |
| 37 -> 49 tvrdnji + 5 sabotaza | `src/lib/__tests__/deltaSheetLayout.test.mjs` |
| Uvoz sada trci nad fileom KOJI NOSI novu kolonu | `src/lib/__tests__/importForeignRows.test.mjs` |
| Dokaz na PROD-u (read-only) | `Claude-temp_R/_probes/faza1_otvarajuce_stanje.py` |
| Generator primjerka + citac | `Claude-temp_R/_probes/demo_delta.mjs`, `check_demo2.mjs` |

## Otvoreno, po prioritetu

1. **`DELTA_WINDOW_SPEC` faza 4 - update-guard na uvozu.** Jedina **prava** brana; sve
   ostalo je oznaka. Prosirenje postojeceg `row_hash` guarda **jednim** uvjetom (*„a taj je
   redak unutar potvrdjenog stanja"*), uz poruku koja **imenuje sidro**. Dira `excelImport.ts`.
   ⚠ Odbijanje uvoza je **odbaceno** (lomi „sve ide importom") - guard trazi potvrdu, ne brani.
2. **Faza 3 - kontrolne tocke u zaglavlju**, po jedna za svako sidro u prozoru
   (`sidro · sheet racuna · razlika`). ⚠ `ROUND(…,2)` obavezan (S112).
   ⚠ `anchorsInWindow` vec stize do `deltaSheet` - podatak je tu, treba ga samo ispisati.
3. **Structure fan-out** - `AppHome:122` treba `refetch` bez automatskog dohvata (39 upita
   cijim rezultatom se nitko ne koristi). ⚠ Prije koda prebrojati koliko poziva ostane.
4. **PBZVISA ispravljac** - cita **dva** izvora (PBZVISA za stavke/rate, **RF izvod** za dan i
   iznos stvarne naplate). ⚠ Glob mora biti `PBZVI[SZ]A_*` (31x `PBZVISA_`, 1x `PBZVIZA_`).
5. **E10-2 / E7-2** - uzrok nedovrsenih zahtjeva i dalje **nije utvrden** (stoji iz S141).

## Zamke koje su danas ugrizle

- **Test koji hardkodira POLOZAJ kolone ne razlikuje „pomaknuto" od „pokvareno".**
  `deltaSheetLayout` je `Provjeri` trazio na `ctrl + 1`; kad je do njega sjela nova kolona,
  pao je - ali bi pao jednako i da je stupac nestao. Sada se trazi **po naslovu**.
- **`ws.autoFilter` se upisuje kao objekt `{from,to}`, a cita kao string `"A14:R30"`** nakon
  `wb.xlsx.load()`. Tvrdnja pisana prema upisanom obliku daje `undefined`.
- **Obrazac za zamjenu nije nadjen jer je u tekstu stajao obican `"` umjesto `“`** - ista
  zamka kao u S141. ⇒ tekst se prvo ispise kroz `ascii()`, pa onda mijenja.
- **Efekt koji cita `const` deklariran nize u komponenti** je `react-hooks/immutability`, a
  ratchet je na **nuli**. Rijeseno **premjestanjem bloka**, ne `disable`-om.

## Sto je izmjereno, da se ne mjeri ponovo

- **Otvarajuce stanje**: `rpc_area_balance_anchored` s `as_of` = dan sidra vraca **sam iznos
  sidra uz `n = 0`**, oba racuna, K = 0/1/2. Sest provjera, sest prolaza, u cent.
- **Sidra**: ZABA **16** (06.09. `12.772,86` · 30.07. `13.815,33` · 01.01.2025. `3.054,41`),
  RF **3** (07.09. `690,79` · 11.08. `799,12` · 31.12.2022. `12.712,28`).
- **Prozori**: ZABA K=0 **12 dana** / K=1 **51** / K=2 **625**; RF K=0 **12** / K=1 **39**.
- **Biljeske sidara**: 41-90 znakova; 13 od 16 su `ispisano stanje s izvoda · ZABA_*.pdf`.
- **Uvoz**: parser cita delta file s novom kolonom normalno (sekcija, prazni retci, `row_hash`).

## Napomena o ritualu

`audit_tests.py` je uhvatio da naslov `T-S141-4` u `S142_tests.md` kaze **done** dok PENDING
kaze **open** - pravilo je da **⬜ pobjedjuje ✅**, pa je naslov ispravljen. **Brana radi, ali
samo ako se audit pokrene.** Trenutno nema nista za arhivu (15 session fileova, svi s barem
jednim otvorenim testom).
