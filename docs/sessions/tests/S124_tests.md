# S124 — detaljni testovi (2026-09-01)

Tema sesije: usklađenje baze s bankovnim izvodima (`uskladi_izvod.py`) i prvi
Excel file koji **Koka sama uvozi**.

**Preduvjeti za sve testove**
- PROD, Area `Financije_all`, Koka prijavljena svojim računom
  (`dubravka.pavic-sladoljev@dps-perceptum.com`) — ona je vlasnica retka i jedina
  ga kroz app može mijenjati (Saša je grantee; `043` je samo na TEST-u)
- file `data-prep_data/Financije/uskladjenje_MC_2026.xlsx`
- ⚠ **Backup prije T-S124-3.** Uvoz mijenja 27 i briše 2 retka.

---

## T-S124-1 — file se otvara bez popravka

1. Otvori `uskladjenje_MC_2026.xlsx` dvoklikom u Excelu.

**Očekivano:** file se otvori normalno.

**Pad:** dijalog „Excel was able to open the file by repairing or removing the
unreadable content" i u logu `Removed Records: Formula from /xl/worksheets/sheetN.xml`.

⚠ Ako padne — **ne spremaj popravljenu verziju**, izgubila je sadržaj te ćelije.
Uzrok je uvijek isti razred: openpyxl string koji počinje s `=`, `+`, `-` ili `@`
sprema se kao formula. Popravlja se u `uskladi_izvod.tekst()`, ne u Excelu.

---

## T-S124-2 — kontrolna tablica

1. List `Pregled`, tablica na vrhu.

**Očekivano:** sedam redaka (`MC_2026-01` … `MC_2026-07`), stupac „slaže se?"
sedam puta **zeleno „DA, u cent"**.

**Pad:** bilo koje crveno „NE — provjeriti". Tada **ništa ispod ne vrijedi** i uvoz
se ne radi — znači da se zbroj sparenog i onog za uvoz ne poklapa s papirom.

---

## T-S124-3 — Koka uvozi list `Events`  ⚠ glavni test

1. App → Activities → Area `Financije_all`.
2. Import → odaberi `uskladjenje_MC_2026.xlsx`.
3. **Stani na previewu i pročitaj brojke prije Apply.**

**Očekivano na previewu:**
- **29 Modify, 0 New**
- 2 retka označena za brisanje (`Delete?` = `DELETE`)
- **nula kolizija**

4. Apply.

**Očekivano poslije:** poruka o 29 izmijenjenih i 2 obrisana retka.

**Pad A — preview pokazuje `New` umjesto `Modify`:** `event_id` nije pročitan i uvoz
bi napravio **duplikate**. **Ne primjenjuj.** Prijavi s brojkama.

**Pad B — „All skipped" ili kolizije:** netko je u međuvremenu dirao te retke, ili
email u koloni `User` ne odgovara računu koji uvozi.

**Pad C — prođe, ali 0 obrisanih:** `Delete?` kolona nije prepoznata.

⚠ Ovo je prvi uvoz koji Koka radi sama. Ako nešto zapne — **ne popravljaj u Excelu**,
nego javi; file se regenerira alatom.

---

## T-S124-4 — saldo se NIJE pomaknuo

1. Overview tab, pločica `Kokin tekući ZABA`.

**Očekivano:** isti iznos kao prije uvoza.

**Zašto:** svi dirnuti retci su `Izvor = Mastercard`, a saldo miče **samo**
`Izvor = Racun`. Pomakne li se saldo, promijenjeno je nešto što nije trebalo.

---

## T-S124-5 — košara se zatvorila

1. Ponovo pusti alat:
   `python uskladi_izvod.py --izvod ...MC_2026-06.pdf --izvod ...MC_2026-07.pdf --dry`

**Očekivano:**
- `MC_2026-06`: košara **48 redaka / 1.244,74** (prije: 73 / 2.231,02),
  sekcija „za ispravak" **0**, „duplikat" **0**
- `MC_2026-07`: košara narasla na 21 redak, „za ispravak" **0**

**Pad:** ostane li „za ispravak" > 0, uvoz nije primijenio sve — usporedi koja polja.

---

## T-S124-6 — sedam pitanja za Koku

List `Pitanja`. Za svaki redak treba jedno „da, to je bilo" ili ispravak:

| datum | iznos | Kokin redak |
| --- | ---: | --- |
| 2025-02-27 | 10,94 | koka EU r.2396 — ⚠ vjerojatno tipfeler u **godini** |
| 2026-02-05 | 16,29 | koka EU r.2339 |
| 2026-02-28 | 17,19 | koka EU r.2370 — `Konzum 4/6`, rata koju banka nema |
| 2026-04-01 | 20,01 | koka EU r.2453 |
| 2026-05-12 | 34,08 | koka EU r.2521 |
| 2026-05-28 | 0,90 | koka EU r.2533 |
| 2026-06-11 | 51,24 | koka EU r.2513 |

⚠ Šest od sedam nema **nikakav** opis — vjerojatno isti uzrok. Pitanje za nju nije
samo „je li bilo" nego i „znaš li odakle retci bez opisa".

---

## T-S124-7 — 1:N pravilo je provedeno

1. Activities, filtriraj na 28.06.2026.

**Očekivano:**
- **nema** retka `LH 1/3` (bila su dva, oba obrisana)
- `LUFTHAN2202242474447 RATA 1/3` i `…448 RATA 1/3` postoje, **62,01** svaki,
  i sada nose `Rate? = DA`, `Broj rata = 3`, `Rata br = 1`
- opis im je **i dalje bankin** (`LUFTHAN…`), nije zamijenjen s `LH 1/3`
- dva retka `NAKNADA ZA OBROČNU OTPLATU PO RATI` po 1,32, `Domaćinstvo / Bankovni troškovi`

**Pad:** ostane li ijedan `LH 1/3`, brisanje nije prošlo. Postanu li oba LUFTHAN retka
`LH 1/3`, dopuna je prepisala opis — to je bug, jer daje dva identična retka.

---

## T-S124-8 — `Status` je prešao samo uz žig

1. Filtriraj `Izvor = Mastercard`, `Datum naplate = 11.08.2026`.

**Očekivano:** 9 rata (`Konzum`, `Keindl`, `Allianz`) su `Izvrsen` i **svaka nosi
`Izvod opis`**.

**Pad — i to je najvažniji pad u ovoj sesiji:** postoji redak koji je prešao u
`Izvrsen` **bez** `Izvod opis`. To znači da je `Status` promijenjen kao zaključak iz
dospijeća, a ne kao posljedica potvrde izvodom — točno pravilo koje je odbačeno.

⚠ `LH 2/3` (2 retka, 63,33) **ostaju `Planiran` i ostaju u bazi** — namjerno. Brišu se
tek kad tranša 4 donese bankine razdvojene retke, jednim potezom.
