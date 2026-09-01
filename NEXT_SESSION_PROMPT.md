# Sljedeća sesija — handoff

**Pisano protiv commita:** `S124: uvezi_transu.py -- 26 redaka s MC_2026-07 upisano`
(grana `test-branch`). Ako `git log` pokazuje novije, čitaj ovo kao **povijest** —
CLAUDE.md je autoritet.

---

# DIO 1 — netehnički (za Sašu)

## Gdje smo

**Cijela Mastercard 2026. je u bazi i zatvara se u cent — svih sedam izvoda.** Obje strane
stoje: baza zna da je 1.332,52 otišlo s računa **i** zna svih 47 kupovina koje to čine.

| | |
| --- | --- |
| eventa u `Financije_all` | **2.338** |
| košara 11.07. | **48 redaka · 1.244,74** = banka |
| košara 11.08. | **47 redaka · 1.332,52** = banka |
| svih 7 MC izvoda | `uvoz 0 · duplikat 0 · pitanja 0` |
| **pitanja za Koku** | **nula** |

Sedam „pitanja" ispalo je sedam duplikata. Saldo se nije pomaknuo ni za cent — sve dirnuto
je `Izvor = Mastercard`.

## Što čeka tebe

**1. Koki je ostalo jedno pitanje, i nije o podacima.** Rečenica koju joj još nitko nije
rekao: **kad počne upisivati u app, u Excelicu više ne.** Radi li oboje, sve dobijemo
dvaput, a to se neće vidjeti dok se saldo ne raziđe.

**2. `043` + merge na main** — svjesno odgođeno na kraju S124. `043` je gated na
`BUG-S123-EDITMARK`; migracijino vlastito obrazloženje kaže da nevidljiva izmjena tuđeg
retka nije prihvatljiva. Redoslijed kad dođe vrijeme: **migracija prije koda.**

**3. Odluka o opsegu:** Visa i ZABA istim postupkom? MC je gotov, ali Visa je **855 redaka**
i zanimljivija — nema fiksan dan naplate, pa kontrola po košari ondje ne radi.

## Što se pokazalo vrijednim, za ubuduće

Tvoj potez „zbroji cijeli mjesec i usporedi s izvodom" razriješio je ono što moje sparivanje
redak-po-redak nije moglo. **Zbroj košare je jači signal od parova** — ide u alat kao prvo
što ispiše.

---

# DIO 2 — tehnički (za Claudea)

## Stanje

- `test-branch` **15 commitova ispred `main`**. `main` je na S117 kodu.
- **`043` samo na TEST-u** (`events.edited_by` na PROD-u vraća 400). PROD ima 035–042.
- S124 nije dirao kod aplikacije — sve je `data-prep_tools/` + docs.
- Backupi: `_arhiva/backup_usklada_*.json`, `_arhiva/backup_transa_*.json`,
  `_arhiva/izlazi/uskladjenje_MC_2026_primijenjeno_20260901.xlsx`

## Alati (svi na `test-branch`)

```
uskladi_izvod.py      izvod ↔ baza ↔ Kokin file; --dry ispis, --file review workbook
primijeni_uskladu.py  upisuje nalaz (ispravci + dopune + brisanja) jednim potezom
uvezi_transu.py       uvozi retke kojih baza nema; rječnik Izvod opis → Tip/Podtip
```

⚠ Sva tri imaju dry run i **mjere broj promijenjenih redaka, ne HTTP status.**
⚠ `uskladi_izvod.py` radi **samo MC**; Visa/ZABA imaju drugi format i parser staje.

## ⭐ IZOŠTRENJA ALATA — prvo na redu

Šest stavki, svaka iz konkretnog promašaja ove sesije:

1. **Obrnuti 1:N smjer** — `N` redaka baze = **jedan** redak izvoda (`34,08 + 0,90 =
   KEKS PAY 34,98`). Detektor danas gleda samo suprotan smjer.
2. **Zbroj košare kao prvo što se ispiše**, prije sparivanja — ne ovisi o pogađanju parova.
3. **Populacija po `Izvod opis`, ne po košari.** Danas sekcija 5 gleda `Datum naplate ==
   dospijeće`, pa 4 MC retka s dospijećem koje ne postoji **uopće ne uđu u vidno polje**
   (i 855 Visa redaka).
4. **Tražiti po SVIM izvodima**, ne po jednoj kartici. `Izvodi_transakcije.xlsx` ima 3.595
   parsiranih redaka (MC 1.092 · Visa 1.539 · RF 264 · ZABA 700).
5. **Provjera „isti dan, ±0,10"** — tri od sedam pitanja bila su točno to.
6. **Ključ trgovca + rezanje `[kartica: X]`** — danas žive samo u `uvezi_transu.py`,
   a pripadaju i `uskladi_izvod.py`.
7. **Prag „sitno, ne pitamo"** (< ~2 €, bez para igdje) — inače se 0,90 vraća svaki mjesec.

## Zatim

- **185 MC redaka s `Tip = N/A`** — rječnik postoji i može se pustiti preko njih.
  ⚠ Ne pisati automatski gdje ključ nije jednoglasan; posrednici (`KEKS PAY`, `PAYPAL`)
  se ne smiju ni pokušati.
- **Visa** (855 redaka, PBZVISA izvodi) pa **ZABA** — ondje retci **diraju saldo**, pa
  greška ima veću cijenu.
- **`043` + main**, gated na `BUG-S123-EDITMARK` (sljedeći korak je izmjeriti mrežni
  odgovor s `page.on('response')`, **ne** mijenjati locator).
- **Koka prvi put sama uvozi** — treba joj mjesec za koji ima razlog. Time se testira i da
  alat i app govore isti jezik, što ovaj batch **nije** provjerio (išao je skriptom).

## Neverificirano

- **T-S124-1…8** (`docs/sessions/tests/S124_tests.md`) — ⚠ dio ih je zastario: T-S124-3
  je pretpostavljao da Koka uvozi `Events` list, a to je odrađeno skriptom. Treba ih
  prepisati u „provjeri ishod na PROD-u".
- Review file je regeneriran i sada pokazuje **0 ispravaka / 0 pitanja** — to je i njegova
  kontrola.

## Zamke potvrđene ovom sesijom (detalji u CLAUDE.md)

- **Sparivanje samo po iznosu je promašilo tri puta u jednoj sesiji.** `Izvod opis` nije
  jedinstven kroz vrijeme; `LH 2/3` je „prošao" jer iznosi 62,01/1,32 postoje kao lipanjske
  rate; `34,08` sam pripisao `IGO MAT 34,17` na temelju 9 centi razlike. **Iznos treba
  drugu potvrdu — datum, tekst, ili broj rate.**
- **openpyxl string koji počinje s `=` sprema se kao formula** i Excel ne otvori file.
