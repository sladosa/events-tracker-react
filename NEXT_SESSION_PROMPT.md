# Sljedeca sesija - handoff

**Pisano protiv commita:** `1e22746` + izmjene zatvaranja S139 (idu istim commitom).
**`main` NIJE diran u S139** - sve stoji na `test-branch`. Deploy nije trazen ni pusten.
Ako `git log` pokazuje novije, citaj ovo kao povijest; CLAUDE.md je autoritet.

---

# DIO 1 - netehnicki (za Sasu)

## Sto je gotovo

**Napravljene su brane, ne izvjestaji.** Do danas je `npm run typecheck` bila jedina
automatska provjera, i vrtjela se **samo kad kod vec ide na PROD**. Sada postoji
`npm run check` (tri provjere), i GitHub ih vrti **i na `test-branch`** - dakle prije
nego bilo sto krene prema Koki.

**Nasli smo cetiri alata koji su mjerili nesto drugo nego sto tvrde.** To je bio glavni
nalaz dana, i vazniji je od bilo kojeg popravljenog retka:

- **ESLint je pregledavao stare kopije projekta** iz `Claude-temp_R/OLD/`. Od 189
  prijavljenih problema **142 (75 %)** dolazilo je odande. Zato je jucerasnji audit
  pokazao krivu sliku: pripisao je 76 nalaza zivom kodu, a zivih je bilo **25**.
- **Jedan test nije mogao pasti.** `structureExcel.test.mjs` je ispisivao kriz i
  zavrsavao kao da je sve u redu. Dokazano namjernim kvarenjem jedne tvrdnje.
- **`audit_tests.py` je prijavljivao 22 proturjecnosti kojih nema** - protiv popisa
  ukinutog jos u S116.
- **Dva moja vlastita detektora** „mrtvih alata" dala su **100 % laznih pogodaka**.

**Zivi kod je sada na nuli.** `react-hooks` nalaza: 26 -> 0. Od toga 12 popravaka
(nepotpuni popisi ovisnosti - nijedan nije kvario nesto danas, ali svaki je bio mina) i
14 mjesta gdje je obrazac legitiman pa nosi objasnjenje i ime obrasca.

**Ispravio sam vlastitu gresku iz ove sesije.** Jutros sam test E7 zatvorio kao „nije
bug". To je bilo tocno za jedan dio (poruka koja nikad nije postojala), ali E7-3 i dalje
pada. Izmjereno je da pada **i u verziji od prije sesije**, dakle nije nista pokvareno -
ali unos je vracen kao otvoren, jer se uzrok ne zna.

## Sto trazi tebe

1. **`git push origin test-branch`** ako zadnji commit jos nije gore.
2. **Tri rucne provjere u appu** (T-S139-8, -9, -10 u `PENDING_TESTS.md`) - otvaranje
   retka u View + Prev/Next, jedan Excel izvoz s profilom i bez njega, i provjera da
   `hidden_in_add` prezivi Structure roundtrip na PROD-u.
3. **Odluka o `PENDING_TESTS.md`** - v. „Otvorena pitanja" nize. Jedno pitanje, dvije
   minute.
4. **Deploy na `main` NIJE napravljen i ne treba biti** dok ti ne kazes.

## Sto NE treba raditi

- **Ne vjeruj auditu od 16.09.** za brojke o `react-hooks` nalazima - mjerio je stare
  kopije. Ispravak je upisan na vrh samog audit fajla.
- **Ne popravljaj E7-3 napamet.** Prva hipoteza (izgubljena tocka sinkronizacije) je
  izmjerena i **opovrgnuta**.
- **Ne zatvaraj ostale E2E padove kao „poznati artefakt suitea"** na temelju stare
  brojke iz `T-S135-8` - ona je od prije popravka u S136.

---

# DIO 2 - tehnicki (za Claudea)

## Novo u ovoj sesiji

| sto | gdje |
| --- | --- |
| `npm run check` = typecheck + test:unit + lint:ratchet | `package.json` |
| Ratchet nad 3 `react-hooks` pravila, **baseline je 0** | `scripts/lint-ratchet.mjs`, `.lint-baseline.json` |
| Pokretac unit testova + guard „ispisuje pad, izlazi 0" | `scripts/run-unit-tests.mjs` |
| CI se okida i na `test-branch`, + dva nova koraka | `.github/workflows/typecheck.yml` (`name: Checks`) |
| `globalIgnores` za `Claude-temp_R`, `test-results` | `eslint.config.js` |
| `reportUnusedDisableDirectives: 'error'` | `eslint.config.js` - brana nad `eslint-disable` tvrdnjama |
| `formatTimer` / `formatDuration` izdvojeni | `src/lib/timeFormat.ts` (bio byte-identican duplikat) |
| Kolona `HiddenInAdd` u generatoru | `data-prep_tools/Financije/make_financije_all_structure.py` |
| `curated_retired` detekcija | `data-prep_tools/Tools/audit_tests.py` |

## Otvoreno, po prioritetu

1. **E7-3** - `Revoke` ne otvori `confirm revoke`. Nije regresija (izmjereno). Uzrok
   neutvrdjen. **Krece se od punog runa**, ne od ciljanog ponavljanja - v. zamku nize.
2. **`hidden_in_add` se tiho brise na uvozu** kad Structure file nema kolonu. Popravljen
   je **alat**, ne uvoz. Pravi popravak je u `structureImport.ts` i mijenja semantiku
   uvoza za svaki file => trazi test i Sasinu potvrdu. Backlog.
3. **`ViewDetailsPage` immutability** - zatvoreno (efekt premjesten ispod deklaracije),
   ali je usput isplivao `set-state-in-effect` koji je dotad bio **nevidljiv** jer ga je
   skrivao mrtav `eslint-disable` za drugo pravilo.
4. **Ostali E2E padovi** - v. „Stanje E2E" nize.

## Zamke koje su danas ugrizle

- **Alat koji sam bira sto ce citati mora se pitati STO JE PROCITAO**, ne samo koliko je
  nasao. Vrijedi za lint, grep, brojanje redaka - repo drzi stare kopije pored zivog koda.
- **Mrtav `eslint-disable` nije kozmetika nego slijepa mrlja** - plugin preskoci **cijeli**
  efekt koji nosi disable za bilo koje `react-hooks` pravilo.
- **Ponovljen pojedinacni E2E run mjeri bazu koju je prethodni run promijenio.**
  `global-setup` cisti **na pocetku runa**, ne izmedju specova. Izmjereno: `e5-structure`
  pada 1/5 u punom runu, **5/5** nakon tri `e7-share` runa.
- **Usporedba s prijasnjim commitom ide kroz `git worktree`**, ne kroz `checkout` -
  radni direktorij ostaje netaknut. /!\ Put worktreeja mora biti **ASCII**: u putu koji
  sadrzi `Sasa` (s kvacicom) Vite ne razrijesi `/src/main.tsx` i **svaki** test padne iz
  krivog razloga. Prvi pokusaj je danas pao upravo tako.
- **Heredoc u bashu jede backslash**, a `.replace()` u Pythonu ne pogadja CRLF fileove -
  za izmjene CLAUDE.md-a i specova koristi **line-based** zamjenu.

## Stanje E2E

Puni run nad **HEAD** (prije ciljanih ponavljanja): **60 proslo / 11 palo**, 22,7 min.
Nijedan spec koji cuva dirane dijelove nije pao (S121, S122, S123, S133).
Puni run nad **`fd07840`** (prije sesije), kroz `git worktree`: **59 proslo / 12 palo**, 20,3 min. Dakle baseline pada **jedan vise** od HEAD-a.
Padovi: E5-5, E7-2, E7-3, E9-3, E10-2, E11-4, E12-2, E12-4, E13-2, E14-1, E15, T-S104-1.

/!\ **Sto ovo dokazuje, a sto ne.** Dokazuje da S139 nije dodao nijedan pad -- ukupno
ih je **manje** nego prije sesije. Ne dokazuje da su skupovi identicni: HEAD run je u
e5 imao **nula** padova, a baseline pada `E5-5` => skupovi se razlikuju u barem dva
clana u oba smjera, pa negdje postoji pad koji baseline nema. Koji -- ne zna se, jer
je HTML report HEAD runa prepisan kasnijim ciljanim runom.
/!\ I sam taj razlaz je podatak: suite **nije determinisitcan izmedju runova** (isti
e5 daje 0, 1 ili 5 padova ovisno o tome sto je islo prije njega). Zato bi i usporedba
redak-po-redak trazila **ponovljene** pune runove s obje strane, ne jedan par.

/!\ Ogranicenje usporedbe: HTML report mog punog runa je **prepisan** kasnijim ciljanim
runom, pa se usporedjuju **brojke** punih runova i obitelji padova, ne popis test-po-test.
Tko zeli redak-po-redak, mora pustiti oba puna runa iznova.

## Otvorena pitanja

**`PENDING_TESTS.md` je narastao na 1.159 redaka i 34 sekcije, a otvorenih testova ima 24.**
**18 sekcija je 100 % zelenih** i zauzimaju **539 redaka (47 %)**. Ritual arhivira detaljni
`docs/sessions/tests/SXX_tests.md` kad su svi testovi ✅, ali **nitko nikad ne arhivira
odgovarajucu sekciju u PENDING** - pa dokument raste zauvijek i „sto jos treba" se ne vidi.
Prijedlog: zelene sekcije u `DONE_HISTORY.md`, u PENDING ostaje 14 sekcija s 24 otvorena testa.
/!\ Ovo **nije** krsenje pravila „retci se ne brisu, nego dobivaju ✅ + razlog" (S136) -
retci prezive, samo u drugom fileu. Ali **jest** promjena oblika rituala => ceka Sasinu rijec.
