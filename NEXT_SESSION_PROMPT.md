# NEXT SESSION PROMPT — Financije: pregled AI prijedloga + 3 odobrena popravka

**Prethodna sesija: S107n (2026-07-27).** AI `--run` je napisan i **izvršen** — 1593 N/A retka ima
prijedlog Tip/Podtip u Reviewu. Usput je ispao nalaz koji nitko nije tražio: **8 duplikata rata,
636 €**. Tri popravka su odobrena ali **nisu izvršena** jer je Saša morao otići.

## Kontekst pročitaj ovim redom
1. `CLAUDE.md` — blok "Done 2026-07-27 (S107n)"
2. **ovaj file** — što je odlučeno, što čeka
3. `data-prep_tools/Financije/ENRICH_PLAN.md` **§2l** — puni nalazi, tablice, zamke
4. `Claude-temp_R/test-sessions/S107n_tests.md` — kontrole i ručni testovi
5. `data-prep_tools/Financije/ai_classify.py` — docstring + `SYSTEM` prompt

---

## GDJE SMO

**AI klasifikacija je gotova i upisana.** `ai_classify.py --run --only-text --effort high`:

| | |
| --- | --- |
| Upisano | **1593 retka** → `Tip_AI` / `Podtip_AI` (vidljive, uz `Tip`/`Podtip`) + `Pouzdanost_AI` / `AI run` (collapsed grupa) |
| Pouzdanost | **visoka 261 (16,4 %)** · srednja 239 (15,0 %) · niska 1093 (68,6 %) · NEPOZNATO 196 |
| Trošak | $1,17 |
| Kontrola | 0 promjena u starim kolonama · 0 AI upisa na već klasificiran redak |
| Backup | `Financije_review_20260710_1448.pre-aiclass-20260727_092128.xlsx` |

**`Tip`/`Podtip` su netaknuti i tako mora ostati** — prijenos prijedloga u prave kolone je zaseban,
svjestan korak i **skripta za to još ne postoji**.

⚠ **`visoka` je 16 %, a eval je davao 57 %.** Nije regresija: eval je mjeren na *već klasificiranim*
redcima (prepoznatljivi merchanti), a N/A hrpa je po definiciji ostatak koji ni Koka ni keyword
pravila nisu uhvatili. Bulk-accept traka je zato tanka — pregled je pretežno ručni.

---

## ŠTO JE ODOBRENO A NIJE IZVRŠENO (tri stvari, redom)

### 1. Fix 8 duplikata rata — 636,36 €
Kad Koka ratu vodi mjesečno, a izvod sve rate knjiži na datum kupovine, rate 2..N se **udvostruče**.
Dedup i v3 Verdikt (±2 dana) to strukturno ne mogu uhvatiti — rata je mjesec dana odmaknuta.
Detekcija ide po **`Datum naplate` + iznos**. Tablica 8 parova: ENRICH_PLAN §2l.

**Odluka:** zadržati **Kokin** redak + prepisati `Izvod opis`, izvodni u `V3 preskočeno` — ista `DUP`
semantika kao S107k. `--dry` prvo, pokazati popis, čekati potvrdu.
**Ne dirati redove 929 i 933** — provjereni lažni pozitivni (ZAKS 7,96 € vs e-Zaba).

### 2. `reconcile_izvoda.py` — matcher po `Datum naplate` + iznos
Uz postojeći ±2 dana, da se ova klasa ne vrati pri sljedećem importu. Moguće tek otkad je
`Datum naplate` 100 % popunjen (S107k).

### 3. Pravilo `voce i povrce` → `Namirnice / Hrana i ostalo`
Umetnuto **IZNAD** #43 `AGRAM` (priority-order pattern iz S107l). Red 4512 je vočarna koja se
slučajno zove Agram, a pravilo ju je stavilo u `auto Lacetti / registracija`.

---

## ČEKA SAŠIN PREGLED (blokira 4. popravak)

**Agram — koji auto.** Pravilo #43 `AGRAM` ne može odrediti auto: oba se servisiraju kod istog
merchanta. Obrazac iz podataka (**hipoteza**): **ožujak = C5** (2026. eksplicitno "Reg C5" +
"Tehnički C5"; 2025. identična struktura, isti iznos tehničkog 50,63), **listopad = Lacetti**
(50,05 + 82,73, isti par 2024. i 2025.).

Ako Saša potvrdi → na `auto C5` idu **1463, 3038, 3039, 3040, 3041, 4499**; listopadski
(2435, 2436, 3953, 3956) ostaju Lacetti; pravilo #43 dobiva `Iznos min/max` split (S107h feature),
jer datum nije dostupan kao uvjet.

---

## ⚠ ZAMKE (plaćene otkrićem — ne ponavljati)

1. **Prekinut run se ne smije tiho izgubiti.** Kredit je pao na 19/64 batcheva i cijeli je posao
   propao pri izlasku, iako je 491 predikcija bila u storeu. Sad: `is_fatal()` (400/401/403 +
   "credit balance") preskače retry, pali batch ne ruši run, djelomičan rezultat se upiše, ostatak
   ide s `--resume`.
2. **`BATCH` je 25, ne 40** — potpunost pada s effortom. Pomaže, ali nije lijek: jedan batch je i na
   25 vratio 11/25. **Guard prijavljuje broj poslanih vs vraćenih — ne ignorirati tu poruku.**
3. **Prvi prijedlog je zamalo bio kriv.** Redovi 4505/4506 izgledali su kao pogrešno klasificirani
   (`auto Lacetti` umjesto `auto C5`); da su prebačeni, uredno bi se kategorizirao dvostruki trošak.
   `Datum naplate` je otkrio da su duplikati. **Kod svake "krive kategorije" prvo provjeriti postoji
   li par.**
4. **`openpyxl`**: `ColumnDimension.customWidth` je read-only; `insert_cols` **ne pomiče**
   `column_dimensions` (širine/outline treba prenijeti ručno); DV i CF se ne pomiču — zato se AI
   kolone umeću **desno** od `J`/`K`.
5. Skripta se ne smije zvati `inspect.py` (sjeni stdlib, ruši openpyxl).
6. Sve što nosi status **mora biti unutar autofiltera** (sad `A1:AC`) — inače se pri sortu raspari.

---

## ODLUKA: kako označavati "PREGLEDAJ RUČNO"

**Ne** nova flag-kolona (zastava kaže *da* treba pogledati, nikad *jesi li gotov* — tiho truli).
**Ne** `Problem` kolona (zauzeta parse-problemima iz importa, 37 redaka).

**Kad naraste:** sheet `Za pregled` po uzoru na `Nematchano_v3` (radio: 41 → 0) —
`red | datum | iznos | Napomena | Izvod opis | Tip/Podtip sada | Prijedlog | Odluka ▾ | Ispravak Tip |
Ispravak Podtip | Zašto`; `Odluka` = `POTVRDI`/`ODBIJ`/`ISPRAVAK`, pre-popunjena gdje je stroj
siguran; `--harvest` primijeni i **isprazni** sheet (prazan = nema ničega za odlučiti); trag kroz
postojeće `Alternativa / nap.` + `Pravilo run`. **Nula novih kolona.** Za šačicu redaka ne graditi.

---

## DALJE (nepromijenjeno od S107m)

- **Skripta za prijenos** `Tip_AI`/`Podtip_AI` → `Tip`/`Podtip` s pragom pouzdanosti — ne postoji
- **`source_key` nije stabilan** (`normalize_financije.py:202`, `seq_per_day` = redoslijed u fileu) →
  Kokin ubačeni redak mijenja ključeve svih redaka tog dana iza njega. Preduvjet za ponovljiv
  re-ingest. NIJE napravljeno.
- **`sql/0NN_staging_financije.sql`** za TEST Supabase — nije napisan. Store ≠ UI je korijen frikcija;
  odbačeni: SQLite (ne rješava Koku na drugom laptopu), nova Area (EAV je krivi model za ravnu tablicu).
- **Review ekran** (prijedlog + ✓OK toggle + override kolone) = Kokin prvi kontakt s aplikacijom.
- **Pravi gate nije postotak N/A nego mehanizam na koji Koka prelazi.** "2026-first → PROD" je napušten.
- Merge-by-source_key alat (~40 linija) da Saša ne mora zatvarati Excel.
- Za Koku: 700 € bankomat 26.11.2025; `Saldo kontrola` 7 razlika (2026-01 +359, 2024-09 +149, 2×±49).

## PRAVILA OKRUŽENJA

Python `data-prep_tools/Tools/venv/Scripts/python.exe` (NE `run.bat` — `pause` visi non-interactive);
`PYTHONUTF8=1`; `ANTHROPIC_API_KEY` je u `.env.local`. Review mora biti **zatvoren** samo za pisanje.
**`--dry` prvo, pokazati brojke, čekati potvrdu prije upisa u Review.**
**NIKAD ne pushati/mergati na `main` bez izričitog Sašinog zahtjeva.**

⚠ **`data-prep_data/` i `Claude-temp_R/` su gitignorirani = postoje SAMO na Sašinom disku, u jednom
primjerku.** Git čuva alate, ne podatke. Vanjska kopija Reviewa i dalje nije napravljena.
