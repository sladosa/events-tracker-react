# NEXT SESSION PROMPT — nakon S117 (sve provjereno, kolovoz uvezen, čeka se „idi" za merge)

**Pisan protiv commita `f9448b9`** (+ commit zatvaranja S117 koji slijedi odmah iza).
Ako `git log --oneline -1` pokazuje nešto puno novije, čitaj ovo kao povijest; `CLAUDE.md` je autoritet.

**Stanje grana:** `test-branch` nosi S108–S117. `main` = PROD, **nije diran od S107**.

> S117 je bio dan izvođenja, ne planiranja. Kod je prvi put **cijeli viđen uživo**, kolovoz
> je uvezen u cent, a pet stvari popravljeno — **nijedna nije bila planirana, sve su ispale
> iz testiranja.**

---

# DIO 1 — Jednostavnim rječnikom (za Sašu)

## 1. Što je gotovo

**Kolovoz je u bazi.** ZABA `13.239,31` na 13.08., RF `796,43`. Oba u cent, i to je prava
potvrda jer dolazi iz **dva različita modela**: Kokin lanac tereti račun svakom kartičnom
stavkom (59 redaka), naš s 15. Isti broj iz istog modela ne bi značio ništa.

**Sve provjere prošle.** Kolone po Arei, sidro s izvoda, guard, roundtrip. Ništa neviđeno
nije ostalo — što je bio uvjet za merge.

**Tri stvari koje bi Koku svakodnevno gnjavile su maknute:**
- unos za prošli dan više ne traži dva ekrana (birač datuma u zaglavlju, bez štoperice)
- `Valuta`, `Izvod opis` i `Stanje` više nisu u formi (7 polja umjesto 15)
- dogovorena je oznaka `~` za „ne znam točan iznos", s pretragom kroz Comment filtar

## 2. Što slijedi

**Merge `test-branch` → `main`, pa PROD.** Čeka **samo tvoj izričit „idi"**. Redoslijed
je u `CLAUDE.md` („Plan za PROD"), a bitno je da se ne preskoči:

1. SQL `035`–`038` na PROD
2. Structure import **pod Kokinim računom** (D6) — stvara areu, kategorije, dropdowne
3. `set_list_columns.py --write` i `add_header` config protiv `.env.prod.local`
   ⚠ oba vuku hardkodiran `AREA_ID` iz `verify_rpc_vs_model` — treba im novi id
   ⚠ `037` traži slug `financije-all`; ako se PROD area drukčije nazove, ne nađe je
4. Uvoz kolovoza istim fileom
5. **Ti odglumiš Koku na svom laptopu** — Add od nule, dropdowni, sidro, saldo
6. Ona upiše stanje s ekrana banke → Potvrdi → javiš joj

## 3. Što stoji na tebi

- **Reci Koki za retke s krivom godinom** — `2036-04-08` (`Mirovina 1.323,64`,
  `Netdomena Igor 47,76`) i `2028-05-16` (`HLK 5/26`). Ispravak ide **u njen file**.
- **Redak `07.08. Parking 1,60`** je tipfeler u mjesecu (treba `07.07.`) — kod nas isključen,
  kod nje i dalje krivo.
- **Onih 5 spornih lipanjskih redaka** (Σ `373,11`) — kolovoz ih nije razriješio.
- **Odluka o siročadi:** 57 testova iz `S99`–`S104` bez retka u `PENDING_TESTS.md`.
- **Jedna rečenica njoj kad dođe dan:** *„kad počneš upisivati u app, u Excelicu više ne."*

---

# DIO 2 — Tehnički (za Claudea)

## 1. Prvo pročitaj

`docs/sessions/DONE_HISTORY.md` **S117** · `CLAUDE.md` → nova sekcija **„Unos u aplikaciji"**
u Critical rules · `docs/sessions/tests/S117_tests.md`.

## 2. Otvoreno (4 testa, nijedan ne blokira merge)

| test | zašto stoji |
| --- | --- |
| **T-S117-1** ⭐ | **Jedina grana novog koda koju testiranje nije okinulo** — slobodna minuta pri unosu unatrag. Traži namješten uvjet (zauzeta minuta; uvezeni ZABA retci su na 14:00–14:13). |
| T-S117-2 | Birač datuma u Healthu — config upisan 24.08., nije viđen |
| T-S117-3 | Konvencija `~` puni ciklus (upiši → nađi → **uredi isti redak** → popis prazan) |
| T-S117-4 | Grantee slučaj za `add_header` / `HiddenInAdd` |

## 3. Novo u kodu

`AddHeaderConfig` (`areas.settings.add_header`) · `validation_rules.hidden_in_add` ·
`sessionStart` **razdvojen** od `eventAt` u `AddActivityPage` · `normalizeSlug()` izvučen ·
`findFreeSessionStart()` · Structure kolone `AddTimer`, `AddDatePicker`, `HiddenInAdd`.

⚠ **Ako ikad netko opet spoji `sessionStart` i `eventAt`, vraća se „unos za jučer traži dva
ekrana".** To je bila jezgra cijele izmjene, a izgleda kao bezopasno pojednostavljenje.

## 4. Nova zamka koju vrijedi znati

**BUG-S117-RULESHAPE** (zapisan u Open bugs): panel i import pišu **različit oblik**
`validation_rules` za `depends_on` atribut. Posljedica: prvi import nakon spremanja panela
javi **9 „attributes updated"** koji nisu promjena nego poravnanje. Bezopasno za ponašanje,
ali **šum koji skriva pravu promjenu** — a taj brojač je jedini signal da je import nešto dirnuo.
Ozbiljniji dio: panelova fallback lista se **ne izvozi**, pa je prvi roundtrip briše
(danas neopasno — 0 od 12 `depends_on` atributa je ima).

## 5. Metodološki ispravak iz S117, vrijedi ga ne ponoviti

Tvrdio sam da kartični redak treba `Status = Izvrsen`, brojeći povijest (Visa **855/855**).
Bilo je krivo: config već ima `default_map` `Visa → Planiran`, i to je točno — onih 855 je
`Izvrsen` jer su **svi došli s izvoda**, dakle već naplaćeni.

**`Status` je trenutno stanje, ne povijest.** Brojanje zatečenih vrijednosti ne govori kakvo
stanje redak treba **na početku**. Za `Tip`/`Podtip` je brojanje pravi alat; za `Status` nije.

## 6. Sitnice koje su pojele vrijeme

- `git commit -m "…"` s **backtickovima** u poruci: bash ih izvrši i pojede tekst
  (`Stanje: command not found`). Poruke idu kroz `-F -` heredoc.
- Hrvatski navodnici `„…"` unutar Python `"…"` literala prekinu string — koristi `'''…'''`.
- `Supa._call` prima `body=` kao **dict**, ne bytes; `select_all` odbija upit bez `order=`
  (ugrađena S108 zaštita).
