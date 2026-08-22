# NEXT SESSION PROMPT — nakon S115 (dan je isplaniran unaprijed: kolovoz, kolone, pa deploy)

**Pisan protiv commita `ee261ae`** (+ commit zatvaranja S115 koji slijedi odmah iza).
Ako `git log --oneline -1` pokazuje nešto puno novije, čitaj ovo kao povijest; `CLAUDE.md` je autoritet.

**Stanje grana:** `test-branch` nosi S108–S115. `main` = PROD, **nije diran od S107**.

> S115 je bio razgovor i mjerenje, bez koda. **Sljedeća sesija ima dogovoren plan** (DIO 1 §2) —
> ne treba je otvarati pitanjem „što ćemo danas".

---

# DIO 1 — Jednostavnim rječnikom (za Sašu)

## 1. Što je jučer riješeno

**`845,12` je obrisan, i sad znamo što je bio.** Postoji **samo** u tvojoj najstarijoj snimci
Kokinog filea (08.07.), i to kao redak **bez datuma i bez opisa** — dakle zaostatak, ne
transakcija. U bazi je bio `Tip = N/A`, bez datuma naplate. Pet tjedana je stajao kao jedina
stavka „planirano" na ZABA pločici i tvrdio da će pomaknuti stanje. Nema ga više.

**Retci iz 2036. se NE smiju ispraviti i uvesti.** Provjerio sam: `1.323,64` i `47,76` **već su
u bazi** kao 08.04.2026., uredno klasificirani — ušli su travanjskim izvodom. Da smo „popravili
tipfeler i uvezli", dobio bi ih dvaput, i to **tiho** (padaju prije sidra pa ne bi pokvarili
nijednu kontrolnu brojku). Popravak ide **u njen file**, reci joj.

**Sidro ZABA je krivo datirano.** Stoji na **22.08.** umjesto na **30.07.** Iznos je točan
(`13.815,33`, s izvoda) — datum je od klika. Trenutno ne šteti ništa jer u tom prozoru nema
ZABA redaka, ali **sljedeći uvoz pada točno u njega**. Popravak je prvi zadatak.

## 2. Plan za sljedeći dan — dogovoren, ovim redom

1. **Traži od Koke zadnju verziju filea** (ima još unosa poslije 16.08.).
2. **Popravi sidro** — obriši ono od 22.08., provjeri da app sam dođe do `13.815,33` na 30.07.,
   pa upiši sidro na 30.07.
3. **Uvezi kolovoz** u miru. ⚠ Njen file je otišao dalje nego što smo mislili: **87 redaka
   poslije 30.07.** na njenom računu, **68** na tvom; u bazi ih je **6**.
4. **Napravi kolone po Arei** za Financije: `Datum | Smjer + iznos | Tip / Podtip | Opis | ⋮`.
   Na uskom ekranu u dva reda. Ostale Aree ostaju kakve jesu.
5. **Testiraj**, posloži stvari.
6. **Tek onda deploy na `main`** — i to na tvoj izričit „idi".
7. Ti se prijaviš na **njen PROD račun kod sebe lokalno**, provjeriš da sve radi, pa joj javiš
   da može s mobitela.

## 3. Ono što plan čini jednostavnijim nego što je izgledao

Pitao si može li se na PROD staviti sidro da Koka vidi stanje koje prepoznaje. **Može — i to
znači da joj povijest uopće ne treba.** Provjerio sam u kodu: pločica prikazuje račun i kad
iza njega nema **nijednog** zapisa, samo na temelju sidra.

Praktično: ona otvori bankovnu aplikaciju, prepiše stanje u polje „u banci", pritisne Potvrdi —
i od tog trenutka je **saldo = njen broj + ono što ona upiše**. Prepoznat će ga odmah, jer ga je
sama upisala.

⚠ To još **nije provjereno uživo** (T-S115-2). Ako padne, plan se mijenja iz temelja — zato je
taj test među prvima.

## 4. Što ostaje na tebi

- **Zadnja verzija Kokinog filea.**
- **Reci joj za retke iz 2036.** (`Mirovina 1.323,64`, `Netdomena Igor 47,76` — trebalo je 2026.).
- **Onih 5 spornih lipanjskih redaka** (Σ `373,11`) i 11 kartičnih stavki bez para iz S113 —
  i dalje pitanja za nju.
- **Kad dođe dan prelaska: jedna rečenica njoj** — *„kad počneš upisivati u app, u Excelicu
  više ne."* Radi li oboje, sve dobijemo dvaput, i to se neće vidjeti dok se saldo ne raziđe.

---

# DIO 2 — Tehnički (za Claudea)

## 1. Prvo pročitaj

`docs/sessions/DONE_HISTORY.md` **S115** · `CLAUDE.md` → „Sljedeći koraci" (§ Plan za PROD),
„Mjerenje / usklađenje" (dvije nove zamke o sidru), Backlog → „Kolone Activities liste po Arei" ·
`docs/sessions/tests/S115_tests.md`.

## 2. Stanje — sve izmjereno u S115, ne procijenjeno

| Što | Vrijednost |
| --- | --- |
| sidara u TEST bazi | 6 · ZABA `22.08. = 13.815,33` **(krivi datum)** · RF `11.08. = 799,12` |
| zadnji zapis u bazi | ZABA **2026-07-30** · RF **2026-08-11** |
| Kokin file `Financije 2026-08-16.xlsx` nakon 30.07. | „koka EU" **87**, „sasa EU" **68**; u bazi **6** |
| MC naplata `1.332,52` | **nije u bazi** |
| travanj 2026. | **111 eventa** (referenca za T-S115-3) |

Nema promjena u `src/`. Jedina promjena podataka: obrisan event `2831e332-ad4b-46c5-894d-f0da08c9d826`.

## 3. Redoslijed rada i zamke uz svaki korak

1. **Sidro** — ⚠ novo sidro na **stariji** datum **ne poništava** krivo na novijem (`036` bira
   najnovije `confirmed_on <= as_of`). Krivo se mora **obrisati**, a to danas ide samo skriptom
   ili SQL-om. Redoslijed je *provjera pa sidro*: prvo pusti app da iz sidra `01.07. = 2.255,64`
   sam dođe do `13.815,33` na 30.07., **pa tek onda** upiši novo — inače je provjera tautološka.
2. **Uvoz kolovoza** — D-2 („Koka sada, izvod potvrda"), uz **izričitu oznaku da vanjske potvrde
   nema** dok ne stigne kolovoški izvod. ⚠ Retci iz 2036. ne smiju ući (T-S115-3).
   ⚠ Delta export: zadanih 40 praznih redaka je premalo, treba 110+.
3. **Kolone po Arei** — spec u Backlogu `CLAUDE.md`. Uloge, ne imena iz domene. Tip i Podtip su
   **jedna spojena kolona**. Mora proći Structure roundtrip (Sašin princip „sve ide importom").
4. **Deploy** — ⚠ **nikad bez izričitog Sašinog traženja.** Uz merge idu i `035`–`038` na PROD,
   `dashboard` config u njenu Areu (**ne putuje** roundtripom), Structure import **pod njenim
   računom** (D6: email u koloni G mora biti račun koji uvozi).

## 4. Otvoreno / neverificirano

- **T-S115-2 nosi cijeli plan za PROD** — „sidro prikazuje račun i bez ijednog eventa" je
  pročitano u `036`, **nije viđeno uživo**.
- **BUG-S115-ANCHORDATE** — popravak nije napisan. Smjer: kad je izvor „ispisano stanje s
  izvoda", tražiti **datum zatvaranja izvoda** umjesto da se žigoše dan koji se gleda. Uz to
  popis sidara + brisanje u UI-ju (backlog, sad ima drugi dokazani slučaj).
- **`PENDING_TESTS.md` sam sebi proturječi** — kurirani redak „Otvoreno:" i ⬜ oznake u tijelu
  navode različite skupove. Zbog toga **ritual arhiviranja nije izveden** u S115: kriterij
  „svi testovi ✅" se ne može primijeniti mehanički. Uskladiti, pa arhivirati.
- **Izvodi su samo PDF** (potvrđeno) ⇒ „app čita izvod" je imenovano i **odloženo**; vrijednost
  te ideje nosi Faza 3 (pravila u bazi + evaluacija na uvozu), koja PDF ne dira.
- Kontrolna brojka `ZABA 09.08. = 14.722,84` iz Kokinog lanca i dalje nije dohvaćena — traži
  njene kolovoške retke, kojih izvod ne pokriva.
