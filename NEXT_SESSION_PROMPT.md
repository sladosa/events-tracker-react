> Pisano protiv `51e5564` (S184: T-S183-2 ✅) + commita koji nosi ovaj file (S184 zatvaranje, 26.10.).
> **Stanje:** `main` = `f903401` (S183 kod, **PROD od 26.10.**); `test-branch` = `main` + samo docs S184.
> **PROD config razreza je upisan** (`set_breakdown.py`, 26.10.) — PROD i TEST imaju isti razrez.
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md` i `data-prep_tools/CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija (S185) — F2 preuređivanja

> **Ukratko (S184):** pločica „Kamo ide novac" s pogledima Bucketi / Namjena / Tip i stranom Fond je na PROD-u — test na TEST-u prošao u svih deset koraka, deploy `f903401`, PROD config upisan i provjeren u lipu (This Year Izašlo 36.493,49 €, fond 9.534,95 €).

---

# DIO 1 — netehnički (za Sašu)

## Gotovo (S184)
- S183 testiran na TEST-u (svih 10 koraka) i pušten na PROD; config razreza upisan i provjeren. Koka i ti na PROD-u
  vidite prekidač Bucketi | Namjena | Tip i Fond (Nena / Kućište +9.534,95 €).

## Sljedeće: F2 — „uvezi grubo, dotjeraj poslije" za trening
Redoslijed velikih koraka (CLAUDE.md § Strategic Position): korak 3 (alat za preuređivanje) je **napola gotov** —
F1 (opcije: preimenuj, spoji, premjesti, izdvoji) radi i korišten je na PROD-u (Namjena, S180). **F2** su tri
operacije nad **atributima**, i bez njih uvoz `trening.xlsm` ne može ići „grubo pa dotjerati":
- **A1 — promijeni tip atributa** (npr. uvezeno kao tekst ⇒ broj), uz popis redaka koji se ne daju pretvoriti.
- **A2 — izvedi atribut iz teksta** (npr. iz stupca `O` u DIARY-ju puls / kcal / TE; iz `AM` san / HRV).
- **A4 — spoji dva atributa** (npr. raspoloženje iz DIARY-ja i `mood` u Fitnessu).

**Kako predlažem sesiju:** prvo razgovor (ti voliš „nemoj odmah kodirati"), na **stvarnim stupcima DIARY-ja** —
što od toga zaista treba, u kojem redu, i gdje živi A2 (Python alat ili aplikacija). Kod tek kad je spec dogovoren.

## Što treba od tebe
1. Za S185: ništa unaprijed. Ako stigneš — pogledaj u `trening.xlsm` stupce `O`, `AM`, `M`, `I` i reci koji su ti
   najvažniji za analizu (to određuje što F2 mora znati prvo).
2. **Studeni krug (bez razvoja, nepromijenjeno):** T-S175-1 MC ~02.–11.11., T-S175-2 Visa ~05.11., T-S175-3
   ZABA_2026-10, T-S181-3 (Namjena u alatima). To je ispit „Financije su dovoljno gotove".
3. Kad stigneš: T-S174-3 / T-S174-5 (PROD razvrstavanje starije povijesti), Garmin izvoz.

---

# DIO 2 — tehnički (za Claudea)

## Izvedeno (S184)
| Što | Dokaz |
| --- | --- |
| T-S183-1 ✅ | TEST, Saša, 10/10 koraka u brojku; `verify_breakdown` [TEST] 19/19 prije testa |
| deploy | `main` = `test-branch` = `f903401`, Netlify zelen |
| T-S183-2 ✅ | PROD dry run = 9 razlika, `--apply --yes-prod` ✓, `verify_breakdown` [PROD] RPC = Python; model 12 mj = TEST u lipu |
| arhiva | PENDING sekcija S183 → `DONE_HISTORY.md`; `S183_tests.md` → `Claude-temp_R/test-sessions/archive/` |

## Za F2 — što pročitati prije razgovora
- `docs/PREUREDJIVANJE_SPEC.md`: §2 (rupe A1–A4, K1–K4), §3 (invarijante — vrijede i za F2), §6 (faze: F2 = A1, A2,
  A4 + sheet), §7 / §7.1–7.2 (Sašini odgovori: sheet prvi, zapis prije/poslije, **A2 preporuka: Python prvo, app
  tek ako se ponavlja**), §9–§17 (tehnički spec F1 — predložak oblika za F2 spec), §18–§20 (što je kod odstupio,
  i otvoreno: **lista `depends_on` pod `*` — planer je ne zna mijenjati**; prije idućeg preuređivanja Namjene).
- `docs/TRENING_MIGRACIJA.md`: vrh (zaključci 20.10. + Sašini odgovori), §1.3 (kolone), **§1.4 (ere — stupac je
  mijenjao značenje; A2 pravila moraju to znati)**, §3 (predloženi model), §5 (otvorena pitanja).
- Kod F1: `src/lib/restructure/plan.ts` (planer, JEDINO mjesto koje zna gdje u configu stoji vrijednost opcije),
  `sheet.ts`, `apply.ts`, `sql/058_restructure.sql` (apply/undo u jednoj transakciji; **provjeri što 058 zna o
  `value_number`/`value_datetime` i o promjeni `data_type`** — spec: „F1 radi samo s tekstualnim atributima i točnom jednakošću. Sadrži i regex su F2").
- `trening.xlsm` je OneDrive živi file (`C:\0_Sasa\OneDrive\trening.xlsm`) — čitati **read-only / s kopije**.

## Otvorena pitanja za razgovor (prijedlog, ne odluke)
1. **Na čemu se F2 mjeri prije uvoza DIARY-ja?** DIARY još nije u bazi. Opcija: grubi uvoz DIARY-ja na **TEST**
   (sve kao tekst) ⇒ F2 dotjeruje stvarni materijal ⇒ PROD uvoz tek s gotovim alatom. Alternativa: Fitness/Health_Sasa.
2. **A2 u Pythonu ili u appu** (Saša je 20.10. pitao „što je regex"; preporuka u §7.1: Python prvo). Ako Python:
   ide li izlaz kroz isti sheet `Preuređivanje` / Excel uvoz, s istim zapisom prije/poslije i Poništi?
3. **A1 i `058`:** promjena `data_type` seli vrijednost između stupaca `value_*` — povrat mora vratiti i tip i stupac.
   Retci koji se ne daju pretvoriti: ostaju tekst (na kojem atributu?) ili blokiraju operaciju?
4. **A4 sukob** (oba popunjena): prijava + P3 (§2) — tko pobjeđuje kad su različiti i neprazni?
5. Ide li §20 (`depends_on` pod `*`) u F2 ili zasebno.

## Otvoreno (nepromijenjeno)
- BACKLOG (S183): crta stanja fonda kroz vrijeme (migracija) · ušlo/izašlo po računu na pločici salda.
- 056 granica 4 dimenzije — Financije su na njoj.
- Prihodi Podtip = izvor (R6); pravila po trgovcu ne znaju Namjenu; F1b (popis operacija s Poništi); O6 traženje
  u izborniku.
- Klasifikator odbija i read-only PROD alate ⇒ PROD mjerenja pokreće Saša (memorija `prod_writes_blocked`).
