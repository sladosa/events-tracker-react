# Faza 1a — dokaz modela salda (S107x)

**Datum:** 2026-08-12 · **Alat:** `verify_saldo_model.py` · **Ulaz:** `Financije_review_20260710_1448.xlsx` (4.996 redaka, READ-ONLY)
**Spec:** `docs/OVERVIEW_TAB_SPEC.md` §2.10, §2.13, §2.14, „Faza 1a"

> Cilj: dokazati formulu salda nad stvarnim podacima **prije** pisanja RPC-a i pločice.
> Skripta ništa ne piše u Review — nema `.save()`. Nalazi idu u `saldo_model_nalazi.xlsx` (nov file).

Pokretanje:

```
Financije\run.bat verify_saldo_model.py            # tri provjere
Financije\run.bat verify_saldo_model.py --rows     # detalj rezidualnih mjeseci
Financije\run.bat verify_saldo_model.py --nalazi   # + popis loših redaka u TSV
```

⚠ `run.bat` guši zarez u argumentima — jedan argument po pozivu.

---

## 1. Presuda

| provjera | ishod |
|---|---|
| **§2.10 — saldo miče `Izvor`, ne `Racun`** | ✅ **POTVRĐENO** |
| **§2.14 — transfer jednom ili dvaput** | ✅ **DVAPUT** (90,6 % iznosa) |
| **§2.13 — planirano po kantama** | ⏸ **NEPROVJERLJIVO** na ovim podacima |

**Faza 1 (`sql/034` RPC + pločica) može krenuti.**

---

## 2. Što smo naučili

### 2.1 Pravilo §2.10 je točno, i to mjerljivo

Mjeren je **pomak po izvatku** (ne razina), protiv bankovnog `NOVO STANJE`:

| pravilo | reproducira banku |
|---|---|
| `Izvor ∈ {Racun, Cash}` | **17 / 30 mjeseci u cent** |
| naivni zbroj po `Racun`u | **0 / 30** |

Razmjer dvostrukog brojanja (bruto, cijelo razdoblje): **56.894 €** na ZABA, **81.591 €** na RF.
Naivna pločica ne bi bila „malo netočna" — bila bi besmislena.

### 2.2 Test razine je bio nemoguć — i to je samo po sebi nalaz

Prvotni plan („model mora dati istih 7 razlika kao `Saldo kontrola`") **nije izvediv**:

- `Saldo kontrola` uspoređuje **Kokin ručno vođeni `Stanje`** s bankom (razina).
- Njen `Stanje` je lanac iz **izvornog redoslijeda njenog workbooka** (`Izvor reda` = `koka EU:N`).
- Review je presortiran po `event_date` (S107i, Opcija B) ⇒ **lanac puca na 969 od 2.564 mjesta.**

Svaka usporedba razine mjerila bi artefakt sortiranja. Zato mjerimo pomak, koji je **neovisan
o sidru** — jedna rana greška ne razmazuje se na svih 31 mjesec.

Presjek s onih 7 iz sheeta je samo `2026-05` — očekivano, jer su to **različite veličine**
(razina njenog ručnog broja vs pomak modela). Popisi se ne trebaju poklapati.

**➡ Posljedica za OQ-5:** stupac `Stanje` u ovom stanju **nije upotrebljiv kao istina**.
Potvrđuje odluku da se prestane pisati čim saldo postane izračunat.

### 2.3 Transfer se piše dvaput — ali tek nakon razvrstavanja po ulozi

Nemaju svi `Transfer` retci protupartiju, pa ih prvo treba razdvojiti:

| uloga | n | protupartija je |
|---|---|---|
| naplata kartice (MC/PBZ lump) | 108 | kartica — **nije** naš račun |
| bankomat / gotovina | 78 | novčanik — **nije** račun |
| druga osoba (Anja, Nataša…) | 38 | tuđi račun |
| **međuračunski** | **73** | **drugi naš račun ⇒ smije postojati** |

Od 73 međuračunska: **90,6 % iznosa je dvostrano** (23.789 € od 26.270 €) ⇒ **oba salda točna,
ništa se ne dupla.** Preostalih 42 (Σ 2.481 €, prosjek 59 €) su **pogrešna labela**, ne rupa
u modelu — v. `TRANSFER-BEZ-PARA`.

⚠ Mjerodavan je udio **po iznosu**, ne po komadima (42,5 % kom. zvuči loše, 90,6 % iznosa je istina).

### 2.4 Kanta „planirano" se na ovim podacima ne može provjeriti

`Status=Planiran` ima **15 redaka i svih 15 je dospjelo**; `Uskoro` i `Kasnije` su prazne —
**ne zato što model griješi**, nego jer nijedan planirani redak nema `Datum naplate` u
budućnosti. Buduće rate u Reviewu **ne postoje kao retci** (generira ih rata modal nakon
importa). Anjinih 96 rata iz §2.13 su ovdje 45 **povijesnih** redaka, svi `Izvrsen`.

**Dobra vijest:** od 629 `Rate?=DA` samo **11** stoji kao `Planiran` ⇒ povijesni uvoz **ne**
nosi davno naplaćene rate kao planirane. Bojazan iz §2.13 se nije obistinila.

### 2.5 Zamka u čitanju vlastitog broja

RF *neto* višak naivnog zbroja je samo **−1.101 €**, što izgleda kao da tamo nema problema.
Uzrok: 32 retka `PRIMLJENA UPLATA` nose **`Izvor=Visa`** (strana kartice, Σ +40.244,88), pa se
potrošnja i podmirenje međusobno skrate. **Bruto je prava mjera** (81.591 €). Stupac je dodan
u ispis da se broj ne čita krivo.

---

## 3. Retci koji nisu u redu

Puni popis: **`data-prep_data/Financije/saldo_model_nalazi.xlsx`** (filtriraj po `sifra`).
Brojke dolje su stanje **pri mjerenju** (115 redaka); nakon popravaka istog dana ostalo je **69** — v. §4b.
File se regenerira svakim `--nalazi` runom, pa uvijek prikazuje trenutno stanje.

| šifra | n | pouzdanost | što nije u redu i zašto je bitno |
|---|---|---|---|
| `NAPLATA<KUPNJA` | 28 | **visoka** | `Datum naplate` je **prije** `event_date` — nemoguće. Jedan od dva datuma je kriv. Bitno jer `Datum naplate` određuje **u kojem mjesecu** iznos tereti karticu ⇒ kriva vrijednost pomiče iznos u krivi mjesec. |
| `OBJE-KOLONE` | 3 | **visoka** | `Uplata` **i** `Isplata` popunjene. `row_amount()` čita Isplatu prvo ⇒ vidi **0,30 umjesto 450**. Uzrok već poznatog S107r §10b. |
| `BEZ-IZNOSA` | 4 | **visoka** | Nema što uvesti. **2 su legitimna početna stanja** (redovi 32/33, sidra), 2 su prazni zapisi (1521, 4983). |
| `BANKA-NE-VIDI` | 10 | srednja | Model i banka se u tom mjesecu razilaze **točno za iznos ovog retka** ⇒ redak je dvaput, krivo datiran, ili ga banka nema. |
| `DUPLI-IZVOR` | 12 | niska | Isti iznos+datum+račun stigao iz **dva ulazna toka** (Kokin file / izvod / PBZ). Može biti i stvarno dvije iste kupnje — treba pogled. |
| `TRANSFER-BEZ-PARA` | 42 | srednja | Označeni `izmedju racuna`, ali odredište nije naš račun (Seka, Nena, Revolut, APN porez). **Saldo ne kvare**, ali po §2.14 `Transfer` ispada iz razreza po Tipu ⇒ **trošak nestaje iz statistike**. |
| `PLANIRAN-DOSPIO` | 16 | n/p | **Po dizajnu** (§2.5a) — traži ljudsku potvrdu, nije greška. |

### 3.1 Imenovani slučajevi vrijedni ispravka

| mjesec | iznos | što je |
|---|---|---|
| **2025-01 / 2025-02** | `+2.385,65` / `−2.434,65` | **Poništavaju se.** Mirovina `1.125,07` (red 2787) + Triglav `1.260,58` (red 2788) datirani u siječanj, banka ih vidi u veljači. Ostatak `−49,00` = poznati multisport. |
| **2025-07** | `+450,80` | Anjina rata 72/96 **dvaput**: Kokinih `450,00` (red 3609) **i** bankovni split `400+50` (redovi 3612/3613). To su retci iz S107r §10b, sad kao duplikat. |
| **2024-10** | `−236,04` | Allianz Lacetti (red 2368) — banka ga nema u tom prozoru. |
| **2024-07** | `+1.141,71` | Dvije Mirovine isti dan (redovi 2001/2004, `koka EU:1176` i `1859`) — različiti iznosi, treba Kokin pogled. |

Poznati loši retci iz S107v se potvrđuju: **4997** (naplata 10 mjeseci prije kupnje) i **4996**
(parking, kriv datum) — oba su namjerno izostavljena iz batcha 2026.

---

## 4. Što ovo znači za Fazu 1

1. **Formula ide u RPC kakva jest** — `Izvor ∈ {Racun, Cash}` = izvršeno, `Visa`/`Mastercard`
   = planirano. Dokazana na 4.996 redaka.
2. **13 rezidualnih mjeseci znači da će `✓/Δ` čip pokazivati Δ i kad je model točan.**
   To je **potvrda dizajna iz §2.11**, ne problem: Δ je signal da nešto fali, je dvaput ili je
   krivo — i ovdje je već izbacio 4 konkretna slučaja. Ne pokušavati „ugoditi" model da Δ nestane.
3. **§2.13 (tri kante) ostaje neprovjeren** do prvog importa s generiranim ratama. Nije rizik za
   `balance_by_group`, ali ne smatrati ga potvrđenim.
4. **`TRANSFER-BEZ-PARA` (42) popraviti prije `breakdown` pločice**, ne prije `balance_by_group` —
   saldo ne dira, razrez po Tipu da.

---

## 4b. Popravljeno 2026-08-12 (isti dan, nakon nalaza)

| alat | što | rezultat |
| --- | --- | --- |
| `fix_datum_naplate_statement.py` | `Datum naplate` preračunat iz `Izvod file` | **49 redaka** (48× 2025, 1× 2026) |
| `fix_keks_trener.py` | 20 KEKS Pay uplata treneru → `Zdravlje\|Sport_Sasa` | **20 redaka**, 400 € |

**Nalaz koji je popravak otkrio: „nemogući" retci bili su samo vidljivi vrh.** Usporedba
protiv statementa (`Izvod file`) pokazala je **57** neslaganja, od čega je 30 bilo *tiho*
krivo (naplata poslije kupnje pa izgleda uredno). Jezgra: **cijeli statement `MC_2025-10`**
(40 redaka) nosio je 11.10. umjesto 11.11.

**Uzrok:** `kartice_datum_naplate.py` namjerno ne dira retke koji već imaju popunjen
`Datum naplate`. Stara vrijednost je preživjela, `enrich_from_izvoda.py` je poslije
pridružio statement, a `date_accuracy.py` (S107k) pomaknuo `event_date` — naplatu nitko
nije preračunao.

**⚠ 8 redaka namjerno NIJE dirnuto** iako je odobren opseg od 57. Provjera po statementu
pokazala je da su to **manjinska odstupanja unutar statementa koji inače slijedi pravilo**
(npr. `MC_2025-05`: 32 retka točno, 6 odstupa), dakle drukčiji obrazac od veleprodajne
greške. Jedan je pomak od jednog dana (11.04.2026. je **subota**) — vjerojatnije stvarni
datum knjiženja nego greška. Šest su koherentna skupina rata kupljenih 29.05.2025.
**Ostaju za Sašin/Kokin pogled;** pokreće ih `--include-obrnute`.

**Kontrola nakon oba popravka:** 49 promijenjenih ćelija, sve u `Datum naplate`; 80 ćelija
za KEKS (20 redaka × Tip/Podtip/Alternativa/Pravilo run); **Σ Uplata i Σ Isplata nepromijenjeni
u cent**; broj redaka i kolona isti. Model salda i dalje **17/30** (ni jedan popravak ne dira
iznos ni `event_date`), a dvostranost transfera **90,6 % → 91,9 %**.

**Označenih redaka ukupno: 115 → 69.** `NAPLATA<KUPNJA` 28 → **1** (ostaje red 4997, poznati
loši redak iz S107v — pitanje za Koku); `TRANSFER-BEZ-PARA` 42 → **23**.

## 5. Zamke zabilježene

- **Ime skripte ne smije biti ime stdlib modula.** `inspect.py` je odmah srušio `openpyxl`
  (`partially initialized module` — circular import preko `numpy` → `import inspect`).
- **Udio po komadima ≠ udio po iznosu.** Saldo se mjeri u eurima; kod transfera je razlika
  između „42 %" i „91 %" i vodi u suprotan zaključak.
- **Neto zbroj isključenih redaka može podcijeniti problem** kad isključeni skup sadrži obje
  strane iste stvari (Visa potrošnja + Visa podmirenje). Mjeriti bruto.
- **`Stanje` stupac se ne smije hodati u ovom fileu** — sortiranje po datumu ga je rasparilo.

---

## 6. Provjera lanca protiv ISPISANIH bankovnih stanja (S110, 2026-08-17)

Faza 1a je mjerila model nad Excelom. Ovdje se mjeri **app** (RPC nad bazom) protiv
**ispisanog `NOVO STANJE`** s 31 ZABA izvoda — alat `make_saldo_anchors.py --report`.

**Presuda: model reproducira banku.** Sa sidrom `2025-01-01 = 3.054,41` (ispisano) app
pogađa **u cent** siječanj, ožujak, travanj, svibanj i lipanj 2025. Provjera od tjedan dana
(sidro `2026-07-01 = 2.255,64` → 08.07.2026.) daje **3.403,74** — Kokin broj, bez korekcije.

### 6.1 Zamke otkrivene mjerenjem

- **⚠ Izvod se NE zatvara na kraju mjeseca.** `ZABA_2024-12` ima zadnju tekuću transakciju
  `2025-01-01`, `ZABA_2025-12` ima `2025-12-24`. Ispisano stanje pripada TOM datumu. Sidro
  datirano na kalendarski kraj mjeseca dvostruko broji sve iz preklopa (pravilo je
  „promjene **strogo nakon**"). Plan je izvorno govorio „sidro na 31.12.2024." — krivo.
- **⚠ Mjesečna sidra ubijaju provjeru na svojim datumima.** Sidro NA datum usporedbe daje
  `balance == amount` po konstrukciji ⇒ Δ = 0 bez ikakve informacije. `--report` takav redak
  označi `SIDRO (nije provjera)`. **Prvo provjera, sidra poslije.**
- **⚠ Poništavanje može lažirati zdravlje.** Ostatak na 28.04.2026. bio je `−0,14` i izgledao
  kao dokaz ispravnosti. Nije bio: nedostajućih `+200` iz svibnja 2025. slučajno je poništavalo
  nepovezanih `−200,94` iz kasnijih mjeseci. Tek kad je 200 sjela na mjesto, ostatak se pokazao.
  **Mali zbirni Δ nije dokaz da nema grešaka — može biti dokaz da ih ima parni broj.**

### 6.2 Ispravljeno

**Kokina tipfelerica u godini** (`fix_koka_datum_200.py`): podizanje `200,00` s bankomata
datirano `2026-05-29` umjesto `2025-05-29`. Dokaz: `ZABA_2025-05` ima DVA podizanja po 200
(19.05. i 29.05.), Review je imao samo prvo; `ZABA_2026-05` nema nijedno; Kokin redak `EU:1780`
je osam redaka iza `EU:1772` a njeno vlastito `Stanje` (925,33) ga smješta u svibanj 2025.

### 6.3 POZNATO ODSTUPANJE — ne tražiti ponovno

**`−200,14` na ZABA lancu, 2025-08 → 2026-04.** Četiri retka u bazi **bez opisa** i **bez
protustavke u izvodu**:

| datum | iznos | provjereno |
|---|---|---|
| 2025-08-17 | `−45,94` | iznos se **nikad** ne pojavljuje ni u jednom ZABA izvodu 2023-12…2026-06 |
| 2025-10-12 | `−150,00` | banka ima `150,00` na 12.11.2025., ali app tu već ima (studeni `Δpromet = 0,00`) ⇒ **nije pomaknuta kopija** |
| 2026-03 | `−2,80` | nikad se ne pojavljuje u izvodima |
| 2026-04 | `−1,40` | nikad se ne pojavljuje u izvodima |

Uz njih `±0,80` (naknada za kreditni transfer, 19 pojava kroz izvode) — granica mjeseca, šum.
Kolovoška `Anja 73/96`: Koka knjiži `449,30`, banka `450,00` + naknada `0,70` — **poništava se,
nije greška**, samo drukčije knjiženje.

Iz izvoda se ovi retci više ne mogu razriješiti — nemaju bankovnu protustavku, pa bi odgovor
znala samo Koka. Iznosi su mali i stari. **Odluka (Saša, 2026-08-17): ne loviti dalje.**

⚠ Odstupanje **ne dodiruje današnji broj** — sidro od 01.07.2026. ga presijeca.
