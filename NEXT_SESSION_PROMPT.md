# NEXT SESSION PROMPT — nakon S120 (sve spremno, čeka se odluka o deployu)

**Pisan protiv commita `3ed210c`** (+ commit zatvaranja S120 koji slijedi odmah iza).
Ako `git log --oneline -1` pokazuje nešto puno novije, čitaj ovo kao povijest; `CLAUDE.md` je autoritet.

**Stanje grana:** `main` nosi S108–S117 (pushano 24.08.). `test-branch` je ispred za S118, S119 i S120.
⚠ **Deploy i dalje nije napravljen** — Koka na PROD-u ima staru listu.

> S120 je bio dan lova na krive tragove. Četiri puta sam imenovao uzrok, i **tri puta me mjerenje
> opovrglo.** Sve što je u dokumentaciji zapisano kao „izmjereno" prošlo je kroz pokus.

---

# DIO 1 — Jednostavnim rječnikom (za Sašu)

## 1. Što je gotovo

**Četiri popravka, sva mala, sva provjerena:**

- **Filtar se više ne gubi** kad iz liste odeš u View Details pa se vratiš. Uzrok nije bio ondje
  gdje je S119 sumnjao — bio je u `AppHome`, u efektu koji se okidao i pri otvaranju ekrana.
- **`N/A` se piše jednom**, ne `N/A/N/A`. Redak kojem je Tip poznat a Podtip `N/A` pokazuje samo Tip.
- **Uvoz tuđeg filea („Import as mine") sada prijavljuje kolizije.** Prije nije prijavljivao
  nijednu — dakle nije bilo zaštite od dvostrukog uvoza istog filea. To je bilo ozbiljnije od
  krivih brojki koje si vidio.
- **Plava oznaka retka** pri povratku iz View Activities traje punih 5 sekundi. Prije je
  odbrojavanje kretalo dok se lista još učitavala, pa je od tih 5 s ostajalo ono što pretekne.
  Ako ti i sad bude prekratko — trajanje je jedna konstanta (`HIGHLIGHT_MS`), reci broj.

**Testovi:** zatvoreno 22 (78 → 56 otvorenih), četiri nova automatska testa, pet fileova
arhivirano. Detalji: `docs/sessions/PENDING_TESTS.md`, sekcija „S120".

## 2. Što stoji na tebi

1. **ODLUKA O DEPLOYU.** Sve je spremno i ništa se više ne čeka. Kad kažeš, ide na `main`.
2. **Odmah nakon deploya:** hard refresh (**Ctrl+Shift+R**) — stari keširani bundle je u S118
   tiho osakatio uvoz i to se vidjelo tek po brojačima koji su falili.
3. **Pa upisati kolonu `Račun` na PROD:** `set_list_columns.py --env prod --area … --write`.
   ⚠ Tek **poslije** deploya — stari bundle ne zna za kratice, pa bi Koka do tada vidjela
   `Kokin tekući ZABA` u cijelosti.
4. **Prolaz na telefonu** — 12 testova odjednom (T-S119-1…5, -7, T-S118-6, T-S108-12,
   T-S120-1…4). Detalji: `docs/sessions/tests/S120_tests.md` i `S119_tests.md`.
5. Ono iz S118 što stoji: reći Koki za retke s krivom godinom (`2036-04-08`, `2028-05-16`),
   `07.08. Parking 1,60`, i 5 spornih lipanjskih redaka (Σ `373,11`).

## 3. Što NE treba istraživati (izmjereno u S120)

- **Atributni filtar nije spor.** Indeks postoji od S97. TEST 0,38–0,73 s, PROD 0,31–0,52 s.
  Ono što je izgledalo kao njegov timeout bili su paralelni testni workeri.
- **Uvoz ne griješi areu** kad dvije aree imaju kategoriju istog imena. Provjereno pokusom.

---

# DIO 2 — Tehnički (za Claudea)

## 1. Prvo pročitaj

`docs/sessions/DONE_HISTORY.md` **S120** · `CLAUDE.md` → nova sekcija **„Izmjereno i nije
problem"** i prošireni blokovi **„UI (React)"** i **„E2E (Playwright)"**.

## 2. Što je dirano

| file | što |
| --- | --- |
| `AppHome.tsx` | BUG-S119-FILTERBACK — usporedba s **prethodnom** Areom/kategorijom umjesto vjere da se efekt okida samo na promjenu |
| `ActivitiesTable.tsx` | `AttrCell` izbacuje ponovljenu vrijednost · odbrojavanje highlighta kreće kad je redak na ekranu (`HIGHLIGHT_MS`) |
| `ExcelImportModal.tsx` | `analyzeFile(file, mode)` — ponovna analiza nakon izbora „Import as mine" |
| `excelImport.ts` | `getHierarchyLevels` izostavlja **dvosmislenu** golu putanju |
| `playwright.config.ts` | `workers: 1` + `globalSetup` |
| `e2e/setup/global-setup.ts` | **nov** — vraća seed Areu na seed stanje prije svakog runa |
| 4 nova spec filea | v. „Testovi" u DONE_HISTORY |

`npm run typecheck && npm run build` prolaze.

## 3. Stanje E2E-a

Pojedinačno **sve zeleno**. U batchu **9/10 s rotirajućim padom** — pod opterećenjem neki spec
prekorači `waitFor`/timeout. Nije ostatak (to je riješio `global-setup`) i nije regresija.
Ako smeta: dizati timeoute ili pokretati po fileu.

## 4. Prvo što bih uzeo sljedeći put

⚠ **Ne deployati samoinicijativno.**

1. **Ako deploy prođe:** kolona `Račun` na PROD + prolaz na telefonu.
2. **T-S100-4 prije batcha 2024** — provjera na pravim podacima da uvoz ne pogađa `Financije_old`.
3. **Faza 3 — `set_attribute` na Import putu.** Jedna rupa drži tri featurea.
4. **Faza 2 — brzi unos.**
5. **`T-S107-3/-4/-5`, `T-S107b-5/-6`, `T-S110-5`** — proširenja postojećih specova, ~20 linija po komadu.

⚠ I dalje vrijedi: **batch 2024 i 2023 idu na PROD**, i to je okidač za preimenovanje
`Financije_all` → `Financije` (rename **kroz UI**, nikad importom).
