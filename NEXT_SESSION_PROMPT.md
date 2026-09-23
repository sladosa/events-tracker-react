> Pisano protiv commita **`4028ca1`** (S145) + neispisane izmjene S146.
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S146 (2026-09-23)

---

# DIO 1 — netehnički (za Sašu)

## Što je jutros napravljeno

Sesija trijaže. **Osam sekcija testova je zatvoreno i arhivirano**, popis otvorenog
je s 543 pala na **277 redaka**, a otvorenih testova s 18 na **8**.

Tvoje dvije primjedbe sa slika:

- **Dva naslova u `PENDING_TESTS`** — nije kvar. Obsidian prikazuje ime filea iznad
  naslova; file ima točno jedan.
- **Otvoreno pitanje u `DONE_HISTORY`** — bilo je **već odgovoreno u S140**. Kvar je
  bila *selidba*: tekst je pisan dok je stajao u PENDING-u, pa je preseljenjem
  „o samom ovom dokumentu" počelo pokazivati na krivi dokument. Ispravljeno, i
  zapisano kao pravilo.

Tvoje dvije ideje su obje ušle u alat:

- **`check_links.py` iz drugog alata** — zovu ga sad `audit_tests.py` i
  `claude_index.py --write`, pa **ne ovisi o tome da ga se netko sjeti**. Odmah se
  dokazao: uhvatio je 3 mrtva linka koja ova sesija nije napravila.
- **„Zastarjelo — nije relevantno"** — postalo je **šesti kriterij zatvaranja**, tvojim
  riječima: *zanima nas trenutna kontrola, ne zastarjela*. Uz dvije granice, da ne
  postane koš za sve nezgodno.

## Što čeka tebe — hrpa B, ~20 min u aplikaciji

Svjesno si je odgodio da ne uđeš u konflikt s mojim E2E runovima nad istom TEST
bazom. Detalji: `docs/sessions/tests/S145_tests.md` i `S146_tests.md`.

| test | potez | gdje |
| --- | --- | --- |
| **T-S145-1** | Overview → `View details` → natrag; pa Overview → Finish → `Go to Home` | `dev:prod` ili PROD |
| **T-S145-2** | rata `100 / 3` ⇒ modal **33.34 / 33.33 / 33.33** + žuta napomena; isti broj u atributu **i** komentaru | isto |
| **T-S108-1b** (korak 5) | uz `All Categories`: gumb **siv** + **žuti hint** | isto |
| **T-S131-34** | Edit koji **pomakne datum** retka → odmah View (bez F5) | isto |

⚠ **T-S145-3** (boolean piše `Not set`) **ne traži namjerno** — nije reproduciran, četiri
hipoteze su oborene. Ako iskoči: **prvo Ctrl+Shift+R**, pa javi.

⚠ Kod **T-S145-2** biraj iznos koji se **razlikuje** od onoga što automatika inače da
(`100/3` je dobar) — inače test prolazi i nad pokvarenim kodom (pravilo iz S129).

## Što NIJE napravljeno, i zašto

- **Ništa nije commitano ni pushano** — sve je stageano i čeka tvoj `git commit`.
- **PROD nije diran** nijednom.
- Ostaju **T-S140-8** i **T-S141-1** — ista tema (E2E fan-out), i nisu test nego posao.

---

# DIO 2 — tehnički (za Claudea)

## Stanje grana

`test-branch`, zadnji commit `4028ca1` (S145). **Sve izmjene S146 su stageane,
necommitane.** `main` netaknut.

`npm run check` ✅ · `check_links.py` 56 linkova / 0 mrtvih · `audit_tests.py` bez
proturječnosti · unit **15 fileova / 0 palo**.

## Novo u repou

| file | što |
| --- | --- |
| `data-prep_tools/Tools/check_links.py` | **nov.** Brana mrtvih linkova; `find_dead()`/`report()` su uvozivi — zovu ih `audit_tests.py` i `claude_index.py --write`. `--fix` preusmjeri na arhivu |
| `src/lib/__tests__/pagingOrderGuard.test.mjs` | **nov.** Svaki `.range()` u `src/` mora imati `.order()`. 10/10 danas |
| `e2e/fixtures/auth.ts` | REST fallback sad šalje `?on_conflict=` |
| `e2e/tests/e15-revoke-with-events.spec.ts` | E15-3 klikne `Info` prije tvrdnje o tekstu |
| `audit_tests.py`, `claude_index.py` | zovu `check_links.report(quiet_when_clean=True)` |

## Otvoreno — točno dvije stvari koje traže Claudea

**T-S146-1 ⬜ (prvo)** — popravljen je **dijeljeni** helper `supabaseUpsert`, a izmjeren
**samo `e15`**. Isti helper koriste `e8`, `e9`, `e10`, `S123`.
⚠ Spec se mora pustiti **dvaput zaredom** — prvi run ne dokazuje ništa, jer je kvar bio
baš u *ponovljenom* runu (409 u `beforeAll`).
⚠ Ako 409 i dalje pada: `on_conflict` pretvara INSERT u UPSERT, pa sad treba i **UPDATE**
pravo na `data_shares` — provjeri RLS, ne helper.

**T-S146-5 ⬜ (jeftino, ~1 min)** — uz sljedeće arhiviranje provjeri da marker
`**Otvoreno:` nije opet nestao. Alat ga vidi **samo ako redak počinje** s `**Otvoreno:`;
u blockquoteu ga ne vidi.

## Zamke koje je ova sesija platila — sve su u CLAUDE.md, ovdje samo pokazivač

- **§ Zamke / E2E:** `supabaseUpsert` ispuštao `onConflict` (5 specova, svaki ponovljen
  run) · E15-3 očekivao tekst info modala na baneru (treći slučaj E7-3/E10-2)
- **§ Session workflow:** šesti kriterij **ZASTARJELO** + njegove dvije granice ·
  `check_links.py` u koraku 3
- **§ Key files:** `check_links.py`

⚠ **Dvije regresije koje je izazvala selidba, ne izmjena** — vrijedi zapamtiti kao
obrazac, jer se obje vraćaju tiho:
1. blok umetnut na koloni 0 usred `if/else` u `audit_tests.py` ⇒ `try/except` preuzeo
   `else:` na sebe, `py_compile` prošao, alat prijavio **10 fantomskih proturječnosti**
2. arhiviranje S120 odnijelo marker `**Otvoreno:` koji je živio **unutar te sekcije**
   ⇒ još **8** fantomskih

Oba su razred koji je **S139 već zatvorio**. Pouka: *provjeri alat pokretanjem nakon
svake izmjene dokumenta koji taj alat čita* — `py_compile` i „izgleda uredno" nisu brana.

## Što NE dirati

- **`main`** — merge pušta Saša, i to PowerShell oblikom iz CLAUDE.md (nema `&&`)
- **PROD** — `--apply` i upisi idu pod njegovim računom
- **T-S130-9** je *odluka o modelu*, ne test — živi u CLAUDE.md § Delta sheet; ne vraćati
  ga u PENDING
