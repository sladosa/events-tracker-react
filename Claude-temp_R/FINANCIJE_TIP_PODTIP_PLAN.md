# Financije — Tip / Podtip reorganizacija

**Datum:** 2026-06-28
**Status:** DRAFT v2 — Kokine izmjene + odluke o Rate i Povrat

---

## Trenutno stanje

Atribut **Tip** (suggest, flat lista):
`Dom/hrana | Prevoz | Zdravlje | Osobni projekt | Zabava | N/A | Rate | PP | Transfer | Ostalo | Povrat | Naknada`

Atribut **Napomena** — slobodan tekst (originalni opis iz izvoda)

---

## Prijedlog: Tip (L1) + Podtip (L2, depends_on Tip)

**Svi Tip-ovi su zajednički za Isplatu i Uplatu** — filter po Tip-u prikazuje kompletnu sliku
(troškovi + povrati). Podtip opcije uključuju i Isplata i Uplata stavke.

### Tip (L1) opcije — kompletna lista

| Tip (L1)         | Podtip (L2) opcije                                                                                     | Smjer    | Napomena                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------ |
| **Domaćinstvo**  | Struja · Voda · Holding (smeće) · Plin · Bankovni troškovi · Popravci i održavanje · Investicije · **Povrat Nataša** · **Povrat Zoran** | oba | Povrat = Uplata kad susjedi vrate svoj dio |
| **Informatika**  | T-mobile · T-com · HP · Saša projekti · Disney · Sky · Prime · HBOmax · Youtube · AudibleKoka · AudibleSasa · Cloud backup · Microsoft | Isplata  | U Napomenu: detalji                        |
| **Ostavine**     | Advokati                                                                                                | Isplata  | Pravni troškovi                            |
| **Zdravlje**     | Medical · Lječnička komora · PP · PassSport · Sportski rekviziti                                        | Isplata  | PP = Posmrtna pripomoć                     |
| **auto C5**      | gorivo · registracija · parking · popravci                                                              | Isplata  | U Napomenu: detalji                        |
| **auto Lacetti** | gorivo · registracija · parking · popravci                                                              | Isplata  | U Napomenu: detalji                        |
| **Putovanja**    | karte · smještaj · restoran                                                                             | Isplata  | U Napomenu: detalji                        |
| **Ostalo**       | Odjeća/obuća · Pokloni · Kave/jelo vani · Temu · Taksi · Kino/Kazalište/Muzeji                         | Isplata  | U Napomenu: detalji                        |
| **Mirovina**     | Saša · Koka                                                                                             | Uplata   | Redovni mjesečni prihod                    |
| **Najam**        | Anja                                                                                                    | Uplata   | Rata pozajmice koju Anja vraća             |
| **Transfer**     | *(bez podtipa)*                                                                                         | oba      | Interni prijenos između računa             |
| **Povrat**       | *(slobodan tekst u Napomeni)*                                                                           | Uplata   | Ostali povrati koji ne spadaju u kategoriju |
| **Ostali prihodi** | *(slobodan tekst u Napomeni)*                                                                         | Uplata   | Povrat poreza, naknada, ostalo             |

### Primjer: Domaćinstvo filter prikazuje kompletnu sliku

```
Filter: Tip = Domaćinstvo

Isplata  Domaćinstvo / Holding       -300 EUR  (za cijelu kuću)
Isplata  Domaćinstvo / Struja        -150 EUR
Uplata   Domaćinstvo / Povrat Nataša +100 EUR
Uplata   Domaćinstvo / Povrat Zoran  +100 EUR
                              NETO:  -250 EUR
```

---

## Odluke (potvrđene)

### ✅ D1: Rate zadržava originalni Tip/Podtip
Rata eventi dobivaju isti Tip i Podtip kao originalna transakcija.
Leaf comment: `rata 1/3 · 150 od 450`. Atributi Rate?=Yes i Broj rata ostaju.
Stari Tip="Rate" se **briše** iz opcija — nije potreban jer Rate? atribut služi za filtriranje.

### ✅ D2: Domaćinstvo uključuje Povrat Nataša/Zoran
Filter po Domaćinstvo prikazuje i troškove i povrate — neto izračun vidljiv.
Zasebni Tip="Povrat" ostaje za ostale povrate koji ne spadaju u specifičnu kategoriju.

### ✅ D3: Auti razdvojeni po vozilu
auto C5 i auto Lacetti su zasebni Tip-ovi (ne jedan "Prevoz" s podtipom za auto).
Isti Podtip opcije za oba (gorivo, registracija, parking, popravci).

### ✅ D4: Domaćinstvo objedinjeno
Jedan Tip "Domaćinstvo" (ne Normal/Specijalno). Podtip razlikuje
redovne (Struja, Voda...) od specijalnih (Popravci, Investicije).

### ✅ D5: Zdravlje dodano
Slučajno izbrisano u Kokinoj reviziji — vraćeno s: Medical, Lječnička komora,
PP, PassSport, Sportski rekviziti.

---

## Mapiranje starih Tip vrijednosti → novi Tip

| Stari Tip      | → Novi Tip (L1)  | Podtip (L2)                 | Smjer   |
| -------------- | ---------------- | --------------------------- | ------- |
| Dom/hrana      | Domaćinstvo      | *(odrediti po Napomeni)*    | Isplata |
| Prevoz         | auto C5 ili Lacetti ili Ostalo/Taksi | *(po Napomeni)*  | Isplata |
| Zdravlje       | Zdravlje         | *(po Napomeni)*             | Isplata |
| Osobni projekt | Informatika      | *(po Napomeni)*             | Isplata |
| Zabava         | Ostalo           | *(po Napomeni)*             | Isplata |
| PP             | Zdravlje         | PP                          | Isplata |
| Rate           | *(originalni Tip)* | *(originalni Podtip)*     | Isplata |
| Transfer       | Transfer         | —                           | oba     |
| Povrat         | Domaćinstvo ili Povrat | Povrat Nataša/Zoran ili *(po Napomeni)* | Uplata |
| Naknada        | Ostali prihodi   | —                           | Uplata  |
| N/A            | *(klasificirati)* | —                          | oba     |
| Ostalo         | Ostalo           | *(po Napomeni)*             | oba     |

---

## Otvorena pitanja

1. **N/A redovi (~2400)** — najveći posao. Opcije:
   - a) Ostaviti N/A kao validan Tip (= neklasificirano) — Koka klasificira postepeno
   - b) Bulk klasificirati po ključnim riječima u Napomeni (Python skripta)
   - c) Kombinacija: skripta za očite, ostalo N/A

2. **Smjer-aware dropdown** — Tip prikazuje SVE opcije (Isplata + Uplata zajedno).
   Korisnik vidi Mirovina kad upisuje Isplatu i obrnuto. Prihvatljivo?
   (2-uvjetni depends_on ne postoji, alternativa je prihvatiti mješoviti dropdown.)

3. **Stare Rate transakcije** — postojeći eventi s Tip=Rate trebaju remapiranje
   na originalni Tip. Moguće po Napomeni (npr. "HLK 5/26" → Informatika/HP).
   Ili ostaviti N/A i Koka ručno klasificira?

---

## Implementacija (kad je plan odobren)

1. SQL: UPDATE `validation_rules` za Tip atribut (nove suggest opcije)
2. SQL: INSERT Podtip atribut (`data_type='text'`, `validation_rules` s depends_on tip)
3. SQL: UPDATE `event_attributes` — remapirati stare Tip vrijednosti
4. SQL: UPDATE rata_config — Tip/Podtip attrs dodati u override logiku (ako treba)
5. Opcionalno: Python skripta za bulk klasifikaciju N/A redova po Napomeni
6. Re-export → novi profil s Podtip kolonom
