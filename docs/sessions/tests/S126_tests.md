# S126 — detalji testova (2026-09-03)

Popis: [PENDING_TESTS.md](../PENDING_TESTS.md)

---

## Kontekst

Sesija je krenula od „Koka je poslala kolovoške izvode, uskladi joj ZABA-u", a
završila s **usklađenim računom u cent**, novim rasporedom delta sheeta i alatom
koji `Tip`/`Podtip` predlaže **brojanjem povijesti**, ne pravilima pisanim rukom.

⚠ Sve je izvedeno **na PROD-u**, pod Kokinim (owner) računom, lokalnim dev
serverom protiv PROD baze. `main` je i dalje na `bb13153` (S124) — ništa od ovoga
Koka na svom laptopu **još ne vidi**.

**Ključni nalaz sesije nije kod nego mjerenje:** zaključak „ZABA izvod nema sidro
za sparivanje, tekst je uvijek isti" bio je posljedica **ispisa skraćenog na 60
znakova**. ZABA prefiks ima 66. Primatelj stoji iza njega, na svakom retku.

---

## Izmjereno strojno — ne traži nikoga

| kontrola | rezultat |
| --- | --- |
| lanac izvoda: `POČETNO` na `ZABA_2026-08.pdf` | ✅ **13.815,33** = naše sidro od 30.07., u cent |
| kontrola izvoda: `13.815,33 − 1.030,97` | ✅ **12.784,36** = ispisano `NOVO STANJE` |
| uvoz (75 novih / 16 izmjena / 1 nepromijenjen) | ✅ točno kako je preview najavio |
| saldo na pločici nakon uvoza | ✅ **12.784,36 €** = banka, u cent |
| `Izvod opis` na ZABA retcima od 31.07. | ✅ **46 / 46** |
| **`fix_as_owner` uživo** (`dnevna karta C5`, 26.08.) | ✅ autor `sasasladoljev59@…`, `edited_by` `dubravka.pavic-sladoljev@…` |
| izmjene su dirnule **samo** `Izvod opis` | ✅ izvještaj o uvozu: svih 16 nosi `Changed: Izvod opis` |
| košara 11.09. | ✅ 46 redaka / 1.048,72; raspon `Σ` pokriva 84..129 |
| `deltaSheetLayout.test.mjs` | ✅ **36 / 36** (bila 33) |
| `npm run typecheck && npm run build` | ✅ |

⚠ **`T-S125-5` je time potvrđen uživo** — Excel put za ispravak tuđeg retka dosad
je bio pokriven samo unit testom.

---

## T-S126-1 — ⭐ novi raspored delta sheeta

**Zašto:** kontrola košare (`Σ košara` / `naplaceno s izvoda` / `razlika`) bila je
**ispod** sekcije. Sekcija raste (MC košara ima 47 stavki), pa bi se kontrola pri
svakom dopisivanju morala pomicati, a s njom i raspon njezine formule.

**Koraci**

1. Activities → Export → Delta sheet za `Kokin tekući ZABA`.
2. Otvori file, skrolaj ispod praznih redaka predloška.

**Očekivano**

```
r…      zadnji prazan redak predloška
r+1     Σ košara (dolje) ->
r+2     naplaceno s izvoda ->
r+3     razlika ->
r+4     KOSARA -- … (razdjelnik)   + „Provjeri" u stilu zaglavlja
r+5…    sekcija — zadnji blok na listu
```

**Pad:** kontrola i dalje ispod sekcije · `Σ košara (gore) ->` (stari tekst) ·
razdjelnik kaže „v. dno" umjesto „v. gore".

⚠ Broj koji drži raspored živi na **dva mjesta**: `gapRows = blankRows + 4` u
`createDeltaExcel` i pomaci u `addDeltaHelpersTo`. Raziđu li se, kontrola se
upiše **preko prvih redaka sekcije**.

---

## T-S126-2 — „Provjeri" nosi stil zaglavlja

**Koraci:** u istom fileu pogledaj ćeliju `Provjeri` u retku-razdjelniku.

**Očekivano:** plava podloga `FF4472C4`, bijeli bold tekst, centrirano — identično
zaglavlju lista (izmjereno usporedbom s ćelijom zaglavlja).

**Pad:** obična bold ćelija bez podloge.

---

## T-S126-3 — ⭐ kontrola košare nakon dopisivanja MC-a

**Zašto:** raspon `Σ` je fiksan iz trenutka izvoza. Dopiše li alat retke ispod
sekcije, oni u zbroj ne uđu — a kontrola tada pokazuje **uvjerljiv broj koji ne
pokriva sve retke**, što je gore od nikakvog.

**Preduvjeti:** file napravljen s `--mc`.

**Koraci**

1. U ćeliju `naplaceno s izvoda` upiši **1.068,70** (`UKUPNO (EUR)` s `MC_2026-08.pdf`).
2. Pogledaj `razlika`.

**Očekivano:** **19,98**, crveno. To **nije greška** nego dva retka koja alat
namjerno nije uvezao (`PAYPAL *AC WALKFT 9,99`, `APPLE.COM/BILL 9,99` — isti iznos
već postoji u bazi 13 odnosno 20 dana ranije).

**Pad:** `razlika` pokazuje nešto drugo ⇒ raspon `Σ` ne pokriva sve retke sekcije.

---

## T-S126-4 — skraćen `Izvod opis` u aplikaciji

**Zašto:** iz `Izvod opis` je izbačen uvod `Kreditni transfer nacionalni u eurima
on-line bankarstvom` (66 znakova, nula informacije); `(m-zaba)` ostaje.

**Koraci:** Activities → otvori bilo koji kolovoški ZABA redak → View details.

**Očekivano:** `Izvod opis` počinje s `(m-zaba) <ime primatelja>`.

⚠ Redak **bankine vlastite naknade** mora ostati **cijel** (`Naknada za kreditni
transfer nacionalni u eurima on-line bankarstvom (m-zaba) M160…`) — ondje ta
riječ nije uvod nego sadržaj. Provjeri jedan od tri retka po `0,35` (19. i 21.08.).

**Pad:** i redak naknade je skraćen ⇒ pravilo nije usidreno na početak.

---

## T-S126-5 — ⭐ prijedlozi iz izbrojane povijesti su točni

**Zašto:** 22 od 30 ZABA redaka i 25 od 45 MC redaka došlo je već klasificirano,
brojanjem povijesti. Ako je ijedan kriv, kriv je **uvjerljivo** — a krivo-ali-valjano
klasificiran redak `apply_rules.py` više ne može popraviti.

**Koraci:** u Activities provjeri ove retke (svi 16.–17.08.2026.):

| redak | očekivano | dokaz |
| --- | --- | --- |
| `207,26` | `T-mobile` · Informatika / Komunikacije_T-mobile | 13/13 |
| `75,24` | `T-com` · Informatika / Komunikacije_T-com | 13/13 |
| `20,11` | `Saša Holding` · Kuća / Holding (smeće) | 19/19, poziv `12045603` |
| `57,19` | `Nataša Holding` · Kuća / Holding (smeće) | 19/19, poziv `03879097` |
| `13,31` | `Bulatova plin` · Kuća / Plin | 11/11 |

⚠ `20,11` i `57,19` dijele **istog primatelja** (`ZAGREBAČKI HOLDING`) a različit
**poziv na broj**. Ključ bez poziva slio bi ih i svakom ponudio češći komentar —
dakle uvjerljivo krivo ime stana.

**Pad:** oba nose isto ime stana.

---

## T-S126-6 — komentar koji NIJE upisan

**Zašto:** par `Tip/Podtip` može biti jednoglasan a komentar ne. Alat tada par
upiše, a komentar **ostavi** i prijavi izbor.

**Koraci:** pogledaj dva retka po `22,90` od **21.08.**

**Očekivano:** oba imaju `Zdravlje / PP (Posmrtna pripomoc)` (12/12), ali komentar
je **strojni tekst izvoda**, ne `PP Saša` — jer povijest zna i `PP Saša` i
`PP Koka`, a ovdje stoje dva retka istog dana (vjerojatno jedan svakome).
Isto vrijedi za `28,06` od 19.08. (`Saša` / `Nataša` / `Nena Holding`).

**Pad:** oba nose `PP Saša` ⇒ alat je pogodio umjesto da prijavi.

---

## T-S126-7 — 33 retka s `Tip = N/A`

**Koraci:** filtriraj Financije_all od 30.07. po `Tip = N/A`.

**Očekivano:** 33 retka. Osam ZABA (svaki se **sam imenuje** u `Izvod opis`:
E.ON ×2, HRT, TELEMACH ×2, NP vodovod, KTD Bilan, NUV) i ostatak MC.

⚠ **Sidro se ne pomiče dok se ovi ne razvrstaju.** Delta prozor kreće
`max(dan nakon sidra, danas − N)` — sidro na 26.08. zatvorilo bi im prozor i Koka
ih ne bi mogla dohvatiti delta sheetom.

⚠ Razvrstavanje je **neutralno za saldo** (`Tip`/`Podtip` ne diraju iznose), pa je
odgoda sidra sigurna. Promijeni li se ijedan **iznos ili datum** u kolovozu prije
nego sidro sjedne, to prođe **bez ijedne kontrole**.

---

## T-S126-8 — sumarni retci ne prekidaju uvoz

**Zašto:** kontrola košare sad stoji **između** praznih redaka i sekcije, pa iza
nje ima pravih redaka. Oznake (`Σ košara ->`) sjede u koloni **`Delete?`**.

**Očekivano:** uvoz filea s tim rasporedom pročita i sekciju ispod kontrole.
Potvrđeno danas: 75 novih uključuje 45 MC redaka iz sekcije.

⚠ Bezopasno je **samo** zato što parser prvo provjerava kolonu B (`Area`) i redak
bez nje uopće ne gleda — inače bi tri oznake bile tri greške „samo DELETE ili
prazno". Čuva `deltaSheetLayout.test.mjs` (dva nova slučaja).
