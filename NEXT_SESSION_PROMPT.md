# Sljedeca sesija - handoff

**Pisano protiv commita:** `cc886fe` + izmjene zatvaranja S141 (idu istim commitom).
**`main` NIJE diran u S141** - sve stoji na `test-branch`. Deploy nije trazen ni pusten.
**U `src/` nije promijenjen nijedan redak.**
Ako `git log` pokazuje novije, citaj ovo kao povijest; CLAUDE.md je autoritet.

---

# DIO 1 - netehnicki (za Sasu)

## Sto je gotovo

**Dan je prosao na mjerenju, i tri stvari koje su bile zapisane kao istina pokazale su se
netocnima.** Sve tri su bile moje tvrdnje, ne tvoje.

**`Datum naplate` za kartice - odluceno, i uz put je pala jedna tvrdnja stara 17 sesija.**
U CLAUDE.md-u je stajalo da se Visa retci „ne grupiraju" i da ih kontrola po kosari ne vidi.
Grupiraju se: gledano po **ciklusu** umjesto po danu, **35 od 37** ciklusa ima tocno jedan
dan, a **1.616 od 1.639** redaka uredno sjeda u svoj. Ne sjeda **23** retka koje je napravila
aplikacija. Dakle problem je bio ~40x manji nego sto je pisalo, i bio je u **ravnalu**, ne u
podacima.
Tvoja odluka je zapisana kao pravilo: **stupac znaci dan kad je novac stvarno otisao**; dok se
ne zna, app upisuje pretpostavku, a izvod je ispravlja. App se time ne mijenja - treba mu
ispravljac.

**Tvoj prijedlog za delta sheet je usvojen, i tvoje pitanje je oborilo moju verziju.**
Predlozio si „jedno sidro ranije". Ja sam to poopcio u „prozor od N dana" - a ti si pitao
imamo li problema sa stanjem tog dana. Imamo: „danas - 60" pada na 20.07.2026., a najblize
sidro **prije** toga je na ZABA-i **01.01.2025.**, na RF-u **31.12.2022.** Otvarajuce stanje
bilo bi sidro **plus 565 odnosno 1.297 dana izracuna**. Tvoja verzija daje **13.815,33** i
**799,12** - potvrdjene brojeve, bez ijednog dijela izracuna.
⇒ Spec je `docs/DELTA_WINDOW_SPEC.md`, i **nista vise ne ceka tvoju odluku** - faza 1 se moze
kodirati.

**E2E je pusten (22 min): 54 proslo / 17 palo**, baseline je bio 60/11. **E7-3 prolazi** i u
punom runu, dakle popravak iz S140 drzi. **E10-2 pada, ali ne ondje gdje smo mislili** - ne na
dijalogu opoziva nego prije njega, jer se Structure redak nikad ne pojavi.

**Nadjen je trosak koji stoji sam za sebe:** Structure tab broji evente s jednim upitom po
kategoriji (39 upita), a to se u jednom toku dogodi **6-8 puta**. Jedan od tih poziva dolazi
iz ekrana koji rezultat **nikad ne procita**.

## Sto trazi tebe

1. **Nista za push** - `test-branch` je pushan na kraju S141 (7 commita). `main` netaknut.
2. **Nista drugo.** Nijedan test ne ceka tvoju ruku; T-S141-4 ceka **kod**, ne tebe.
3. Kad budes kod **Kokinog** racuna: **T-S139-10 dio B** (uvoz Structure filea) - jedini
   preostali rucni korak iz ranijih sesija.
4. **Deploy na `main` NIJE napravljen i ne treba biti** dok ne kazes.

## Sto NE treba raditi

- **Ne popravljaj E10-2 u specu** - pada prije mjesta koje spec testira; uzrok je drugdje.
- **Ne proglasavaj Structure fan-out uzrokom E2E padova** - izmjereno je da 7 od 17 padova
  nema **nijedan** zahtjev bez odgovora.
- **Ne diraj `next:3` / `cutoff:3:5`** - `cutoff:3:5` je dobar privremeni pogodak i ostaje
  dok ispravljac ne postoji.
- **Ne uvozi Structure file `Financije_all` pod svojim racunom.**

---

# DIO 2 - tehnicki (za Claudea)

## Novo u ovoj sesiji

| sto | gdje |
| --- | --- |
| `DELTA_WINDOW_SPEC` - prozor se mjeri sidrima, ne danima | `docs/DELTA_WINDOW_SPEC.md` (nov) |
| Odluka o znacenju `Datum naplate` + ispravak tvrdnje o kosari | `CLAUDE.md` § Financije, § Backlog |
| Nalaz o Structure fan-outu | `CLAUDE.md` § Backlog, `T-S141-1` |
| Skripte mjerenja (read-only, PROD) | `Claude-temp_R/_probes/*.py` (izvan gita) |
| Log punog E2E runa | `Claude-temp_R/_probes/S141_e2e_full_run.log` |

## Otvoreno, po prioritetu

1. **`DELTA_WINDOW_SPEC` faza 1** - `K` (sidara unatrag) umjesto `N` dana. Mice se
   `dayAfterAnchor` iz `Math.max` (`ExcelExportModal.tsx:440`) i bira se **K-to** sidro.
   ⚠ `fetchAnchoredBalance` se **ne mijenja** - RPC sam bira sidro po `asOf`, pa je tocan za
   bilo koji pocetak prozora. Provjera: otvarajuce stanje mora izaci **jednako iznosu sidra u
   cent** (ZABA `13.815,33`). Test je `T-S141-4`.
2. **Structure fan-out** - `AppHome:122` treba `refetch` bez automatskog dohvata, ili
   modul-level kes kao `categoryCache`. ⚠ Prije koda prebrojati **koliko poziva ostane**;
   vjerojatno isti uzrok kao „lista se preupita sest puta".
3. **PBZVISA ispravljac** - sada ima definirano znacenje stupca, pa se moze graditi. Cita
   **dva** izvora: PBZVISA za stavke/rate, **RF izvod** za dan i iznos stvarne naplate.
   ⚠ Glob mora biti `PBZVI[SZ]A_*` (31x `PBZVISA_`, 1x `PBZVIZA_`).
4. **T-S139-10 dio B** - uvoz pod Kokinim racunom.
5. **E10-2 / E7-2** - uzrok nedovrsenih zahtjeva i dalje **nije utvrden**.

## Zamke koje su danas ugrizle

- **Backtick u dvostrukim navodnicima u bashu je command substitution** - ``audit_tests.py``
  u `python -c "..."` je **nestao iz filea**, a skripta je javila `OK`. Isti razred kao
  heredoc/backslash iz S140. ⇒ Patch pisi u **zaseban `.py` file**, backtick iz `chr(96)`.
- **Prvi obrazac zamjene nije nasao blok jer je u tekstu stajao obican `"` umjesto `“`** -
  assert je pao glasno i to je bilo ispravno ponasanje, ali trazi da se tekst prvo ispise
  kroz `ascii()`.
- **`print` na Windows konzoli pada na dijakriticima** (`cp1252`) -
  `sys.stdout.reconfigure(encoding='utf-8', errors='replace')` na vrhu svake skripte.
- **`npx playwright test > log; echo EXIT=$?`** daje exit kod **echa**, ne Playwrighta -
  „completed (exit code 0)" ondje ne znaci da su testovi prosli.

## Sto je izmjereno, da se ne mjeri ponovo

- **Visa `Datum naplate`**: 1.639 redaka, **35/37** ciklusa ima jedan dan; **23** retka su
  `next:3` iz aplikacije; otvorena kosara `2026-10` je **3.x13 + 5.x5** (dvije generacije
  configa). Zivi config: `Visa: cutoff:3:5`, `rata.date_map.Visa: 5`.
- **Mastercard**: **1.802 od 1.806** na 11. ⇒ za MC se pitanje znacenja ne postavlja.
- **Sidra**: ZABA **16** (zadnje 06.09. `12.772,86`, predzadnje 30.07. `13.815,33`, rupa
  **575 dana** prema 01.01.2025.); RF **3** (07.09. `690,79`, 11.08. `799,12`, pa
  31.12.2022.). Biljeske sidara su **41-90 znakova**.
- **Delta prozor danas**: ZABA 12 dana / 18 `Racun` iza sidra (od trazenih 60); RF **2**
  retka koja micu saldo (18 od 20 su Visa i odlaze u sekciju).
- **E2E**: 54/17; 2.601 fan-out zahtjev kroz 17 padova; E10-2 trace 39+39, **11 od 78**
  odgovoreno; **10 od 17** padova ima zahtjeve bez odgovora, **7 nema nijedan**.

## Napomena o ritualu

`audit_tests.py` je uhvatio da sam `T-S140-8` oznacio tako da izgleda zatvoren dok E10-2 jos
pada - vracen je na otvoren, inace bi se `S140_tests.md` arhivirao prerano. **Brana radi, ali
samo ako se audit pokrene.** Trenutno nema nista za arhivu.
