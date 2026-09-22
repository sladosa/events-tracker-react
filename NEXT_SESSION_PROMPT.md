# Sljedeca sesija - handoff

**Pisano protiv commita:** S145 (test-branch, 2026-09-22).
**`main` NIJE diran** - stoji na **S137**, osam sesija iza. Deploy nije trazen ni pusten.
Ako `git log` pokazuje novije, citaj ovo kao povijest; CLAUDE.md je autoritet.

---

# DIO 1 - netehnicki (za Sasu)

## Sto je gotovo u S145

**Hrpa A je odradjena - svih sest testova prolazi.** Ali su usput ispala **cetiri kvara**
kojih nije bilo na popisu, i tri su popravljena isti dan.

1. **Koka nije mogla ostati na Overviewu.** Svaki F5, svaki povratak iz `View details` i
   svaki povratak nakon Finisha bacao ju je na Activities - i to *zapamtio*, pa izbor nije
   bio preskocen nego obrisan. Popravljeno i izmjereno.
2. **Generator bi uvozom vratio Visa pravilo unatrag.** `make_financije_all_structure.py`
   je konfiguraciju imao ukucanu u kodu (`next:3`), a baza ima novu (`cutoff:3:5`) - uvoz bi
   tiho ponistio popravke iz S138, a vidjelo bi se tek za mjesec dana. Popravljeno **prije**
   nego je file uvezen.
3. **Rate su gubile lipe.** `117,32 / 6` je davalo 6 x `19,55` = `117,30`. Sada ostatak nosi
   prva rata, kao kod banke, pa se zbroj slaze u cent.
4. **Jedan kvar se nije dao ponoviti** - kvacica `Rate?` je dvaput pokazala prazno nad
   retkom koji u bazi ima `da`. Izmjereno je da do nje stize ispravna vrijednost; zapisan je
   kao otvoren, s uputom sto provjeriti ako se vrati.

Usput potvrdjeno, a bilo je otvoreno pitanje: **popravak Visa datuma iz S138 doseze do
produkcije bez deploya.** Koka je istog dana unijela plan od 6 rata i sve su dobile tocan
dan (`05.` u mjesecu, zadnja `05.03.2027.`).

## Sto ceka tebe

### 1. Dva testa, ~5 min (T-S145-1 i T-S145-2)

| test | sto napraviti | sto mora biti |
| --- | --- | --- |
| `T-S145-1` | s Overviewa udji u `View details` pa natrag; zatim s Overviewa unesi redak i Finish -> `Go to Home` | oba puta se vracas na **Overview**, ne na Activities |
| `T-S145-2` | Visa kupovina `100,00`, `Rate? = da`, `Broj rata = 3` | modal pokazuje `33.34 / 33.33 / 33.33` + zutu napomenu; spremljeni retci nose te iznose |

/!\ Oba testa **pisu u bazu** - obrisi retke poslije. Redak s `Izvor = Racun` **mice saldo**,
karticni ne.

### 2. Odluka o deployu - sada je veca nego jucer

`main` je na **S137**. Produkcijska aplikacija nema nista od S138-S145, a to sada ukljucuje
i **popravak Overview taba** - dakle Koka i dalje ne moze ostati na tabu zbog kojeg app
otvara. Naredbe su u CLAUDE.md, § Session workflow, korak 11. **Ti ih pokreces.**

### 3. Cetiri S107 retka: tvoj "da" ili "ne" (stoji od S144)

`T-S107c-2`, `T-S107d-4`, `T-S107i-6`, `T-S107j-1` testiraju migracijski put kroz Review
workbook. Migracija je izvedena, klasifikacija danas ide drugim alatima.
**Prijedlog: zatvoriti ih kao "nadidjeno upotrebom".** Cekaju samo tvoju rijec.

---

# DIO 2 - tehnicki (za Claudea)

## Stanje

- `test-branch`: S145. `main`: `4e223f2` (S137).
- `npm run check` zelen: typecheck + **14** test fileova + ratchet `0 -> 0`.
- `audit_tests.py`: **0 za arhivu, 0 razilazenja**. `PENDING_TESTS.md` 631 -> **542** retka.
- Izmjene u `src/` (S145): `useAreaDashboard.ts` (loaded se izvodi u renderu),
  `AppHome.tsx` (uvjet zastite), `rataAutomation.ts` (`splitRataAmounts`),
  `RataModal.tsx`, `AddActivityPage.tsx`. Nov test: `src/lib/__tests__/rataAmounts.test.mjs`.
- Izmjena u alatu: `make_financije_all_structure.py` (`read_base_automations`).
- Arhivirano: `S133`, `S138`, `S139` (sekcija + detaljni file).

## Otvoreno - 21 redak

**A. Zivi testovi (5):** `T-S145-1`, `T-S145-2` (koraci u DIO 1), `T-S130-10`,
`T-S140-8`, `E15-full`.

**B. Cekaju Sasinu rijec (5):** cetiri S107 retka + `T-S130-9` (odluka o modelu).

**C. Pravi posao, ne test (7):** `T-S141-1` (Structure fan-out: 39 zahtjeva x 3 instance
hooka), `T-S135-11` (E2E se gusi sam), `T-S131-34` (BUG-S131-VIEWSTALE, neponovljen),
`T-S108-9` (regresijska brava za paginaciju), `T-S137-8` (rijetka grana auto-odabira
preseta), `T-S145-3` (BOOLEDIT pracenje), + Backlog stavke.

## Izmjereno u S145 - ne ponavljati

- `Financije_all`: **5245** `Transakcija` eventa (S133 popravak brojanja radi; s odrezanih
  1000 redaka bi pisalo `1000`).
- UI rename **ne mijenja slug**: `Gym -> GYM` ostavio `slug=gym`. Vazno za planirani
  rename `Financije_all -> Financije`.
- Na PROD-u postoje **dvije** aree imena `Fitness` (Sasina + template demo
  `10000000-...-0002`) - isti razred kao `Financije_all` / `Financije_old`.
- P2 roditelji se pisu **pri spremanju**: umetanje razine **ne** popravlja povijesne evente
  (stariji unos ostaje bez roditelja za novu razinu).
- Generirani Structure file: `HiddenInAdd = TRUE` na **4 retka = 3 atributa**
  (`Stanje` ima dva jer `depends_on` daje redak po `WhenValue`).

## Zamke potvrdjene u S145

- **Zastavica `loaded` koja ne kaze ZA STO je ucitano prezivi promjenu ulaza** - v. CLAUDE.md,
  § Zamke / UI (React). Prvi popravak (uvjet u potrosacu) **nije bio dovoljan**.
- **Alat koji konfiguraciju drzi ukucanu vraca je unatrag pri svakom uvozu** - v. CLAUDE.md,
  § Zamke / Python alati.
- **Backtick u bash stringu je command substitution** (S141) - ugrizlo **ponovo**, i opet u
  markdownu. Markdown se ne pise kroz `python -c "..."`, nego kroz zaseban `.py` file.
- **Test koji ne moze pasti** - `T-S133-5` je trebao **tri** pokusaja da uopce pocne mjeriti.
  Prije izvodjenja testa pitaj: *sto bi ovdje znacilo PAD?*

## Sto NIJE napravljeno, a blizu je

- **`BUG-S145-BOOLEDIT`** ostaje otvoren i **nereproduciran**. Recept je u
  `docs/sessions/tests/S145_tests.md`, `T-S145-3`. **Prvi potez je hard refresh**, ne debugiranje -
  cetiri hipoteze su vec oborene mjerenjem, pa ih ne treba ponavljati.
- **Generirani Structure file** je uvezen i arhiviran u
  `data-prep_data/Financije/_arhiva/izlazi/` (ritual, korak 3).
- **`T-S141-1` (Structure fan-out)** je i dalje najveci neiskoristen dobitak: hook se
  zove na tri mjesta, a jedna instanca (`AppHome`) rezultat **nikad ne procita** -
  39 zahtjeva po mountu u prazno.
