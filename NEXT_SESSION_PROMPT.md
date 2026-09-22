# Sljedeca sesija - handoff

**Pisano protiv commita:** `bfe83af` (test-branch).
**`main` NIJE diran** - stoji na **S137**, sedam sesija iza. Deploy nije trazen ni pusten.
Ako `git log` pokazuje novije, citaj ovo kao povijest; CLAUDE.md je autoritet.

---

# DIO 1 - netehnicki (za Sasu)

## Sto je gotovo u S144

1. **Fantomski redak obrisan, stanje se slaze.** ZABA reproducira obje potvrde u cent
   (30.07.2026. i 06.09.2026., obje kontrolne tocke `0,00`). Sve kroz Excel roundtrip.
2. **Popravljen kvar koji je sakrio cijelu zastitu.** Upozorenje *"ovaj redak je vec
   potvrden"* (faza 4) **nikad nije radilo**, ni kod koga, ni u jednoj Arei -
   `useCallback` s praznom dep listom. Sada radi, i provjereno je oboje: da se javi gdje
   treba i da **suti** gdje nema sidara.
3. **Trijaza otvorenih testova.** S142, S143 i S129 zatvorene i arhivirane; 17 pod-testova
   zatvoreno dokazom. `PENDING_TESTS.md` pao s **751 na 631** retka.

## Sto ceka tebe - tri stvari, poredane po cijeni

### 1. Hrpa A: sest zivih testova, ~20 min u jednom sjedenju

Sve u aplikaciji, na `npm run dev:prod`. Redoslijed je odabran da se najmanje prekapa:

| red | test | sto napraviti | sto mora biti |
| --- | --- | --- | --- |
| 1 | `T-S138-2` + `T-S138-5` | Financije: nova **Visa** kupovina s `Rate? = 3`; zatim Editom popravi tri stare `Konzum dostava` rate | nova rata: **05.10. / 05.11. / 05.12.**; stare tri s `03.` na `05.` |
| 2 | `T-S108-1b` | Overview tab uz **`All Categories`** | gumb `+` je siv **i nosi hint** zasto |
| 3 | `T-S133-5` | preimenuj/premjesti kategoriju, pa **u istoj kartici** Add | P2 parent po **novoj** hijerarhiji, ne staroj |
| 4 | `T-S133-8` | Edit Mode -> `+ Add Leaf` na kategoriji koja **ima** evente | gumb siv (S24 brava) |
| 5 | `T-S139-10` | Structure import **pod Kokinim racunom** | `hidden_in_add` preživi roundtrip |

/!\ `T-S133-8` mora ici u **Sasinoj** Arei (`Fitness`, `Health_Sasa`) - na `Financije_all`
si samo grantee, pa gumb i tako ne radi i test bi bio neuvjerljiv.
/!\ `T-S138-5` **pise u bazu**.

### 2. Cetiri S107 retka: tvoj "da" ili "ne"

`T-S107c-2`, `T-S107d-4`, `T-S107i-6`, `T-S107j-1` su testovi **migracijskog puta kroz
Review workbook** (`Pravila` sheet, `Nematchano_v2`, N/A petlja). Migracija je izvedena -
5.237 redaka je na PROD-u, a klasifikacija danas ide kroz `presedani.py` / `uvezi_transu.py`
/ `uskladi_izvod.py`.

**Prijedlog: zatvoriti ih kao "nadidjeno upotrebom".** Nisu zatvoreni bez tvoje rijeci jer
je to tvoj pipeline, a krivo zatvoren test sakrije pravi posao.

### 3. Odluka o deployu

`main` je na **S137**. Produkcijska aplikacija - ona koju koristi Koka - **nema nista** od
S138-S144: ni kontrolne tocke, ni kolonu `Potvrda`, ni faza-4 guard, ni tri nove Help teme.
Sve sto si testirao vidi samo tvoj lokalni `dev:prod`.
Naredbe su u CLAUDE.md, § Session workflow, korak 11. **Ti ih pokreces.**

---

# DIO 2 - tehnicki (za Claudea)

## Stanje

- `test-branch`: `bfe83af` (S144). `main`: `4e223f2` (S137).
- Jedina izmjena u `src/` u S144: `ExcelImportModal.tsx:246` - dep lista `analyzeFile`-a.
- `npm run check` zelen (typecheck + 13 test fileova + ratchet `0 -> 0`).
- `audit_tests.py`: **0 za arhivu, 0 razilazenja naslova**, 19 otvorenih redaka.

## Otvoreno - 19, u tri hrpe

**A. Zivi testovi (6):** `T-S138-2`, `T-S138-5`, `T-S133-5`, `T-S133-8`, `T-S139-10`,
`T-S108-1b`. Koraci su u DIO 1.

**B. Podaci / Sasina domena (6):** `T-S130-10` (uskladiti rujansku MC kosaru), `T-S130-9`
(odluka o modelu), i cetiri S107 retka koja cekaju da/ne.

**C. Pravi posao, ne test (7):** `T-S141-1` (Structure fan-out: 39 zahtjeva x 3 instance
hooka), `T-S135-11` (E2E se gusi sam), `T-S131-34` (BUG-S131-VIEWSTALE, neponovljen),
`T-S140-8` + `E15-full` (traze puni E2E run), `T-S108-9` (regresijska brava za paginaciju),
`T-S137-8` (rijetka grana auto-odabira preseta).

## Izmjereno u S144 - ne ponavljati

- ZABA kontrolne tocke `30.07.2026.` i `06.09.2026.`: **obje `0,00`**.
- Plocice 22.09.2026.: ZABA `12.302,70`, RF `942,59`.
- `Financije_all`: **5.237** `Transakcija` eventa, **svi** imaju `izvorplacanja`.
- Sidra: 19, sva u `Financije_all`. Dashboard config ima **samo** ta Area.
- Aree bez sidara s podacima: `Fitness` 572, `Financije_old` 2.774, `Health_Sasa` 3.719 -
  sve **Sasine** (Koka je vlasnica samo `Financije_all`).
- MC kosara s dospijecem `11.09.2026.`: **47 redaka, Σ `1.055,35`** naspram `1.068,70`
  s izvoda ⇒ manjak **`13,35`** (to je `T-S130-10`, brojka `19,98` iz S130 je zastarjela).
- Visa kupovine nakon promjene configa (16.-19.09.): **4/4** nose `2026-10-05`.

## Zamke potvrdjene u S144

- **Upit bez filtra po Arei laze na PROD-u** - `Financije_all` i `Financije_old` obje imaju
  kategoriju `Transakcija`. Iz toga su u jednoj sesiji izvedene **dvije** krive tvrdnje.
- **`p_from` u `rpc_area_group_agg` je ISKLJUCIV** - dan pomaka daje laznih `-49,00`.
- **Odsutnost zahtjeva u Network tabu je mjerenje** - jedino sto razlikuje "nije ni
  pokusao" od "pokusao pa dobio prazno".
- **`datum_naplate` je datetime** - upit koji dohvati samo `value_text`/`value_number`
  vrati `None` i to izgleda kao prazno polje.
- **Help funkcija cita `docs/help/*.md` iz radnog stabla**, pa se testira s
  `npx dotenv -o -e .env.local -e .env.prod.local -- netlify functions:serve --port 8888`.
  /!\ `npm run dev:netlify` bi digao **TEST** aplikaciju na 8888 i ostao bez
  `ANTHROPIC_API_KEY` (projekt nije linkan na Netlify, nema plain `.env`).

## Backlog dodan u S144

**Help ne zna u kojoj si Arei.** `help.ts:118` cita `context.areaName`, klijent salje
`context.areaId` (`HelpPanel.tsx:164`) ⇒ redak `area:` nikad ne udje u prompt. Mrtva grana,
ne nedostajuca zamisao. `FilterContext` vec drzi `selectedArea` s `name` i `settings`.
/!\ Ne filtrirati koje se teme ucitavaju po Arei - v. Backlog za razlog.
