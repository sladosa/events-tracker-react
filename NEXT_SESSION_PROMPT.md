# Sljedeca sesija - handoff

**Pisano protiv commita:** `8aba8bc` + izmjene zatvaranja S144 (idu istim commitom).
**`main` NIJE diran** - sve stoji na `test-branch`. Deploy nije trazen ni pusten.
Ako `git log` pokazuje novije, citaj ovo kao povijest; CLAUDE.md je autoritet.

---

# DIO 1 - netehnicki (za Sasu)

## Sto je gotovo

**Fantomski redak je obrisan i stanje se slaze.** ZABA sada reproducira obje potvrde
**tocno u cent** - i onu od 30.07.2026. i onu od 06.09.2026. Ranije je prva pokazivala
manjak od `45,94`. Nista nije radjeno skriptom: sve je proslo kroz Excel roundtrip, isti
put kojim Koka ionako radi.

**Nadjen je i popravljen kvar koji je sakrio cijelu jednu zastitu.** Upozorenje
*"ovaj redak je vec potvrden"* (faza 4 iz S143) **nikad nije radilo** - ni kod tebe ni kod
bilo koga, ni u jednoj Arei. Nije se vidjelo jer izostanak upozorenja izgleda isto kao
"nema se sto upozoriti". Sada radi, i provjereno je oboje: da se javi gdje treba i da
**suti** gdje nema sidara.

**Svi testovi iz S142 i S143 su zatvoreni** (10/10 i 13/13) i arhivirani.

## Sto treba od tebe

1. **Odluka o deployu.** `main` je i dalje na **S137**. To znaci da produkcijska aplikacija
   - ona koju koristi Koka - **nema nista** od zadnjih sedam sesija: ni kontrolne tocke, ni
   kolonu `Potvrda`, ni ovaj guard, ni tri nove Help teme. Sve sto si testirao vidi samo
   tvoj lokalni `dev:prod`.
   Naredbe su u CLAUDE.md, § Session workflow, korak 11. **Ti ih pokreces.**

2. **Nista drugo ne ceka tvoju akciju.** Nema otvorenih testova.

## Sto je vrijedno znati

- **Pocetak dana je odlucio ishod.** Pitanje *"ti potvrdi"* prije Applyja je otkrilo kvar
  koji bi inace ostao skriven jos dugo - jer se guard koji ne radi **ne vidi**.
- **Tvoje zapazanje o Help-u je bilo tocno i konkretno.** Help doista ne zna u kojoj si
  Arei; zapisano u Backlog. Funkcija je **vec** pripremljena za to, samo klijent salje
  krivi kljuc.

---

# DIO 2 - tehnicki (za Claudea)

## Stanje grana

- `test-branch`: S144 (`8aba8bc` + zatvaranje sesije)
- `main`: **S137** (`4e223f2`) - sedam sesija iza. Deploy nije trazen.

## Sto je promijenjeno u kodu

Jedan zahvat: `src/components/activity/ExcelImportModal.tsx:246` - dep lista
`analyzeFile`-a s `[]` na `[balanceWidget?.group_by, filter.areaId]`.

/!\ **Prije nego pomislis da je to kozmetika:** s praznom listom faza 4 nije radila
**nijednom, nikome**. Pravilo je u CLAUDE.md § Zamke / UI (React).

## Sto je izmjereno, da se ne ponavlja

- ZABA kontrolne tocke: `30.07.2026.` i `06.09.2026.` obje **`0,00`**.
- Plocica ZABA `12.302,70`, RF `942,59` (22.09.2026.).
- `Financije_all`: **5.237** `Transakcija` eventa, **svi** imaju `izvorplacanja`.
- Sidra: 19 u `Financije_all`, nijedno drugdje. Dashboard config ima **samo** ta Area.
- Aree bez sidara s podacima (za testiranje sutnje guarda): `Fitness` 572, `Financije_old`
  2774, `Health_Sasa` 3719 - sve Sasine.

## Otvoreno

- **Backlog: Help ne zna u kojoj si Arei.** `help.ts:118` cita `context.areaName`, klijent
  salje `context.areaId` (`HelpPanel.tsx:164`) => redak `area:` nikad ne udje u prompt.
  `FilterContext` vec drzi `selectedArea` s `name` i `settings`, pa popravak ne trazi nov
  upit. /!\ Ne filtrirati koje se teme ucitavaju po Arei - v. Backlog za razlog.
- **Nema otvorenih testova.** `audit_tests.py`: 0 za arhivu, 0 razilazenja naslova.

## Zamke potvrdjene ovom sesijom

- **Upit bez filtra po Arei laze na PROD-u** - `Financije_all` i `Financije_old` obje imaju
  `Transakcija`. Iz toga su izvedene **dvije** krive tvrdnje u jednoj sesiji.
- **`p_from` u `rpc_area_group_agg` je ISKLJUCIV** - dan pomaka daje laznih `-49,00`.
- **Odsutnost zahtjeva u Network tabu je mjerenje**, i jedino sto razlikuje "nije ni
  pokusao" od "pokusao pa dobio prazno".
- **Help funkcija cita `docs/help/*.md` iz radnog stabla**, pa se Help testira s
  `npx dotenv -o -e .env.local -e .env.prod.local -- netlify functions:serve --port 8888`.
  /!\ `npm run dev:netlify` bi digao **TEST** aplikaciju na 8888 i vjerojatno ostao bez
  `ANTHROPIC_API_KEY` (projekt nije linkan na Netlify, nema plain `.env`).
