# Sljedeca sesija - handoff

**Pisano protiv commita:** `0eac59a` + izmjene zatvaranja S140 (idu istim commitom).
**`main` NIJE diran u S140** - sve stoji na `test-branch`. Deploy nije trazen ni pusten.
Ako `git log` pokazuje novije, citaj ovo kao povijest; CLAUDE.md je autoritet.

---

# DIO 1 - netehnicki (za Sasu)

## Sto je gotovo

**Dan je prosao na instrumentima, ne na featureima** - i to se isplatilo vise nego sto zvuci.
U `src/` je promijenjeno **24 retka** (jedan novi file), a otkljucane su tri stvari koje su
mjesecima tiho blokirale posao.

**Dva E2E pada koja su se vodila kao nepoznata imala su jedan uzrok, i nije bio u aplikaciji.**
`E7-3` i `E10-2` su ocekivali dijalog `Confirm revoke` koji se pojavljuje **samo kad korisnik
kojem se opoziva pristup ima svoje zapise u toj Arei**. U testu ih nema, pa se opoziv izvrsi
odmah - sto je ispravno ponasanje. Obje tvrdnje dodao je **isti** commit iz S106, zajedno s
trecom (fantomskim toastom) koju je S139 vec maknuo.

**Alat je tri sesije tvrdio da nema sto arhivirati.** `audit_tests.py` je fileu pripisivao
svaki test-ID koji se u njemu **spominje** - ukljucujuci recenice tipa „kao T-S133-8 u S135".
Zbog jednog takvog spomena file s **21 od 21 zavrsenog testa** nije se smio arhivirati.

**`PENDING_TESTS.md` je prepolovljen: 1.198 -> 628 redaka.** Polovica dokumenta bio je
zatvoren posao. Sada se „sto jos treba" vidi bez skrolanja. **Backlog** je dobio tri
podnaslova, pa je dovoljno procitati **prvi**.

**Obsidian navigacija je zatvorena, i bila su dva kvara, ne jedan.** Prvi: rijec u
siljastim zagradama (`<datum>`) Markdown cita kao HTML oznaku, pa se sve iza nje prestane
oblikovati - to je bilo ono „poremetilo se izmedju Critical rules i 1043". Drugi: **dvotocka**
u naslovu lomi skok. ⚠ **Tvoja slutnja da je kriv `+` pokazala se netocnom** - izmjereno je
da naslov s plusom bez dvotocke radi uredno.

**Nasao si i kvar koji je izgledao kao pokvarena aplikacija.** Filtar se pamtio pod jednim
kljucem za **obje** baze, pa je TEST nasljedjivao PROD-ov odabir i prikazivao `Unknown`,
praznu listu i poruku o gresci nad bazom koja je bila posve zdrava. Zatvoreno tako da se
**vise ne moze dogoditi**, ne uputom.

## Sto trazi tebe

1. **`git push origin test-branch`** - ceka vise commita.
2. **T-S140-7** (2 min): `dev:prod` -> odaberi Areu -> ugasi -> `npm run dev` -> TEST **ne
   smije** naslijediti taj odabir. Pa natrag na `dev:prod` - ondje mora stajati tvoj PROD
   odabir. ⚠ **Jednokratni reset filtra je ocekivan**, nije kvar.
3. **T-S140-8** (~20 min, moze bez tebe): `npx playwright test`. ⚠ **Prvo ugasi `dev:prod`
   na portu 5173** - inace guard zaustavi run (i dobro je da zaustavi).
4. **T-S139-10 dio B** - samo kad budes kod **Kokinog** racuna. Koraci 4-5 (generiranje
   filea) mozes i sam, oni ne diraju bazu.
5. **Deploy na `main` NIJE napravljen i ne treba biti** dok ne kazes.

## Sto NE treba raditi

- **Ne popravljaj `E7-2`** - on pada iz drugog razloga (mreza prema TEST bazi), izmjereno.
- **Ne dodavaj evente u `e7`/`e10`** da bi se dijalog pojavio - taj put vec cuva `e15`.
- **Ne kodiraj sidra postotno** (`%2B`, `%3A`) - mjereno je da to **kvari** link koji radi.
- **Ne uvozi Structure file `Financije_all` pod svojim racunom** - dobio bi drugi
  `Financije_all` pod sobom, i izgledalo bi uspjesno.

---

# DIO 2 - tehnicki (za Claudea)

## Novo u ovoj sesiji

| sto | gdje |
| --- | --- |
| `dbScopedKey()` - kljuc `localStorage`-a vezan uz project ref | `src/lib/storageKey.ts` (jedina promjena u `src/`) |
| Guard: `## ` naslov s dvotockom -> stderr | `data-prep_tools/Tools/claude_index.py` |
| Atribucija ID-eva po prefiksu sesije + ispis unakrsnih referenci | `data-prep_tools/Tools/audit_tests.py` |
| `S139_tests.md` (ritual korak 2 bio preskoČen u S139) + `S140_tests.md` | `docs/sessions/tests/` |
| 20 zatvorenih sekcija preseljeno iz PENDING-a | `docs/sessions/DONE_HISTORY.md` |
| Test sidara (11 varijanti) | `Claude-temp_R/_probes/ANCHOR_obsidian_sidra.md` |

## Otvoreno, po prioritetu

1. **T-S140-8** - puni E2E nije pusten (na 5173 je stajao `dev:prod`). Ocekivano ~62/9
   prema baseline-u 60/11 iz S139.
2. **T-S139-10 dio B** - uvoz pod Kokinim racunom. Dio A i generator su **izmjereni**.
3. **`hiddenInAdd` se cita samo iz PRVOG retka atributa**, a `isRequired` iz svih
   (`structureImport.ts:347` protiv `:379`). S131 je to popravio za susjednu zastavicu i
   propustio ovu. `Stanje` ima bas dva retka. **Ne popravljati napamet** - mijenja semantiku
   uvoza; Backlog.
4. **`et_activity_draft`** - isti razred kao filtar, kljuc bez oznake baze. Nije diran jer ga
   dva E2E speca tvrdo kodiraju; Backlog.
5. **E7-2 / T-S135-11** - uzrok nedovrsenih zahtjeva **nije utvrden**.

## Zamke koje su danas ugrizle

- **Bash heredoc jede backslash** - ugrizlo **dvaput u istoj sesiji** iako je stajalo u
  proslom handoffu. Zato je sada u CLAUDE.md § Zamke. Za izmjene fileova: **line-based**
  zamjena + patch u **zasebnom `.py` fileu**, prijelom iz `chr(10)`, backslash iz `chr(92)`.
- **`⬜` u tekstu statusa cini redak OTVORENIM.** Citiranje tog znaka u obrazlozenju
  (`audit ga vidi: 4 ✅, 1 ⬜`) obori vlastiti redak na „otvoren". Piši rijecima.
- **Python `print` na Windows konzoli pada na dijakriticima** (`cp1252`) - ispis ide u file
  pa `cat`, ili `sys.stdout.reconfigure(encoding='utf-8', errors='replace')`.
- **`_db.load_env('test')` pada na anon kljuc** - vidi samo template aree i izgleda kao
  prazna baza. Za pravo stanje TEST-a: `SUPABASE_SERVICE_ROLE_KEY` iz `.env.local`.

## Sto je izmjereno, da se ne mjeri ponovo

- **TEST baza je zdrava**: `areas` 16 redaka kao prijavljen korisnik, **0 padova u 8
  pokusaja**, 0,22-0,91 s.
- **PROD `hidden_in_add`**: tocno **3** atributa - `Stanje`, `Valuta`, `Izvod opis`, svi na
  `Transakcija` u `Financije_all`. U Structure exportu daju **4** retka (`Stanje` ima dva,
  jer `depends_on` daje redak po `WhenValue`).
- **`Financije_all` je Kokina Area**, Sasa je `write` grantee (`data_shares`, PROD).
- **Generator propusta `HiddenInAdd`** - izmjereno sintetickim roundtripom, ukljucujuci oba
  `Stanje` retka.
- **Sidra**: radi `(<#Tocan Naslov>)` i wikilink; **postotno kodiranje NE radi** i kvari
  ono sto inace radi.

## Napomena o E2E

`npx playwright test` traje ~20-23 min. ⚠ Suite **nije determinisitcan izmedju runova** -
isti spec zna dati 0, 1 ili 5 padova ovisno o tome sto je islo prije njega. Prije nego se pad
pripise specu ili appu, **prebroji nedovrsene zahtjeve u traceu** (`0-trace.network`,
`status: -1`).
