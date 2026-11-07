# Financije — kako Koka i Saša vode `Financije_all`

**Stanje na:** 2026-11-07 (S195, dodan §3.0 `krug`) · **Zadnji krug izveden po ovim uputama:** studeni 2026. (izvodi 10/2026, S192)
**Za:** Koku i Sašu (§1, §2, §4) · Sašu i Claudea (§3, §5)
**Ovo je JEDINI popis otvorenog posla Financija (§5).** Povijest — puni tekst zatvorenih stavki T1–T50, nalazi
krugova S158 i S192, stari backlog — je u [`_archive/FINANCIJE_PROCES_do_S194.md`](_archive/FINANCIJE_PROCES_do_S194.md);
oznake T-n su iste, pa stara poveznica nađe svoju stavku ondje.
**Susjedni:** [`FINANCIJE_PREGLED.md`](FINANCIJE_PREGLED.md) (ulazna točka) · [`DOSPJELO_SPEC.md`](DOSPJELO_SPEC.md) (traka) ·
[`OVERVIEW_TAB_SPEC.md`](OVERVIEW_TAB_SPEC.md) (saldo, sidra) · [`data-prep_tools/CLAUDE.md`](../data-prep_tools/CLAUDE.md) (pravila alata)

> **Mjerilo (Saša, S125):** *„bilo bi mi važno da ne izgubi povjerenje i volju."* Tihi gubitak rada košta više
> od deset vidljivih smetnji. Klikne, ništa se ne dogodi ⇒ aplikaciji se ne može vjerovati.

---

## 1. Model u jednoj stranici

| račun | čiji | kartica koja se s njega naplaćuje |
| --- | --- | --- |
| Kokin tekući ZABA | Koka | **Mastercard** — skupna naplata 11. u mjesecu |
| Sašin tekući RF | Saša | **PBZ Visa** — Saša plaća fotonalogom ~5.–7. |

Svaka transakcija ima **dva datuma**: dan kad se **potrošilo** (datum retka) i dan kad je **račun teretio**
(`Datum naplate` — app ga računa iz `Izvor`a: `Racun`/`Cash` isti dan, Mastercard 11. idući mjesec,
Visa `cutoff:2:5` = kupnja do 2. ⇒ 5. istog mjeseca, od 3. ⇒ 5. idućeg).

| vrsta | `Izvor` | miče saldo? | broji se u analizi („kamo ide novac")? |
| --- | --- | --- | --- |
| plaćanje s računa, uplata | `Racun` | **da** | da |
| prijenos, podizanje gotovine | `Racun` (`Transfer`) | **da** | ne |
| skupna naplata kartice | `Racun` | **da** | ne (inače dvaput) |
| kartična kupnja, rata | `Mastercard` / `Visa` | ne | **da** |
| gotovinski trošak (kad nas zanima) | `Cash` | ne | **da** |

- **Svaki euro točno jednom u svakom pogledu.** Saldo = Kokino pitanje „koliko imam"; analiza = Sašino „na što".
- Kartična kupnja je `Planiran` dok banka ne skine skupnu naplatu, onda `Izvrsen` — prijelaz radi **čovjek koji
  gleda banku** (traka), nikad automat po datumu.
- **Izvod je autoritet za iznos i datum; naš redak za opis, `Tip`/`Podtip`/`Namjena`.** Usklađenje naš redak
  potvrđuje (žig `Izvod opis`) i ispravlja, ne zamjenjuje ga.
- **Bankovni izvod (ZABA, RF) završava sidrom** — stanje s izvoda, na datum **zadnje transakcije izvoda**.
  **Kartični izvod (MC, Visa)** potvrđuje košaru (Σ kupnji = naplata) i donosi zaboravljene kupnje.

---

## 2. Svaki dan — unos (oboje, mobitel)

- **`Izvor` točno** — on odlučuje ulazi li redak u saldo. **`Tip`/`Podtip` odmah**; `Namjena` se predloži sama.
- Kupnja na rate: nakon **Finish** app ponudi rate.
- Nesiguran iznos: **`~` na početak opisa** (`~ gorivo, Ina`); strana valuta — iznos u eurima iz bankovne aplikacije.
- **Ispravak uvijek Editom postojećeg retka**, nikad novim retkom (novi = duplikat).
- **Skupnu naplatu kartice ne upisuj rukom** — upisuje je traka (§3, korak 3).
- Saldo na pločici = bankovna aplikacija. Razliku prijavi: nešto fali, nešto je dvaput ili je iznos kriv.

**Što reći Koki, njenim jezikom:** kartica se potvrđuje kad se zbroj složi s bankom, ne kad datum dođe ·
stanje na pločici uspoređuj s bankom, a razliku prijavi · **ako nešto ispraviš, a ništa se ne dogodi — javi;
to je greška aplikacije, ne tvoja** (najvažnije za povjerenje).

---

## 3. Mjesečni krug — upute korak po korak

> ⚠ **Kvarljivo:** vrijedi za alate na dan u zaglavlju. Poslije svakog kruga koji je nešto promijenio — prepiši
> ovaj odjeljak (v. §6). **Plan:** jedna naredba `krug` ([`KRUG_SPEC.md`](KRUG_SPEC.md), §5 T4) — kad bude gotova,
> ovaj odjeljak se svodi na „pokreni krug, pročitaj izvještaj".

### 3.0 Novi način — `krug` (od S195; prvi PROD prolaz = prosinački krug)

1. Saša: `data-prep_tools\Financije\krug.bat` (dvoklik = PROD; prvi put `.\krug.bat --suho` iz PowerShella —
   ništa ne upisuje, izvještaj lokalno). Razvrstač pokupi nove izvode, `krug` obradi sve u korijenu `izvodi\`.
2. Izvještaj se otvori sam (i stoji u Kokinoj mapi `OneDrive\Izvodi\Za uvoz` uz Excel): **Za uvoz** (OČEKIVANO),
   **Odluke**, **Stani** (što popraviti u appu), **Čeka** (plaćanje Vise, traka 11.).
3. Koka: u Excelu odluči redove „ODLUČI" (stupac `Delete?`: DELETE ili prazno) i uveze; pregled = OČEKIVANO.
4. Pusti `krug` ponovo — mora javiti 0 · 0; ZABA/RF sidro iz izvoda upiše sam (samo kad je promet ✓ u cent i saldo
   na dan izvoda = ispisano stanje). Traka 11. i plaćanje Vise ostaju kako su opisani dolje (3.2, 3.3).

Ako `krug` stane ili se ponaša čudno — ručni put ispod vrijedi i dalje (isti alati). Poslije prosinačkog kruga
ovaj se odjeljak prepisuje (§6).

**Kalendar**

| kada | što | tko |
| --- | --- | --- |
| ~2. | **MC izvod** stigne (prije naplate) | Saša obradi → Koka uveze |
| ~3. | **Visa izvod** stigne → Saša plati fotonalogom → obradi | Saša, Koka uveze |
| 11. | **MC naplata** — traka „Čeka potvrdu" | Koka |
| kad stigne | **ZABA izvod** | Saša (često samo sidro) |
| kad stigne | **RF izvod** (ne dolazi svaki mjesec) | Saša |
| kraj | **sidra** ZABA i RF ⇒ dnevni unos do idućeg mjeseca | Koka / Saša |

**Prije svega, jednom po prozoru PowerShella** (iz `C:\0_Sasa\events-tracker-react\data-prep_tools`):
```powershell
$env:ET_TARGET='prod'
Financije\run.bat razvrstaj_izvode.py --apply
```
Razvrstač kopira nove PDF-ove iz Kokine OneDrive mape `Izvodi` u `izvodi\` i preimenuje ih po sadržaju
(`MC_2026-11.pdf`…), a i one bačene ravno u `izvodi\` (S194). **Ispis svakog alata počinje s `[PROD]` — zaglavlje
se čita prije brojke** (bez `ET_TARGET` alat gađa TEST i brojke izgledaju jednako uvjerljivo).

### 3.1 Mastercard (~2. u mjesecu)
1. App → Activities → filtar na **Kokin tekući ZABA** → Excel **Delta Export** (sekcija košare mora biti u fileu).
2. `Financije\run.bat fill_from_izvod.py <delta.xlsx> --mc MC_YYYY-MM.pdf --presedan prod --dry`
3. Čitaj: **`KONTROLA košare … ✓ u cent`** · rate starih planova i naknade su u ISPRAVCI, nikad u NOVI ·
   kupnje s kraja izvoda alat **sam** pomakne u iduću košaru (`→ POMAKNUTO`) · `DUPLIKAT?` / `U KOŠARI … NE
   POTVRĐUJE` / `NEJASNO` su odluke: pravi višak ⇒ ponovi s `--brisi=<id8>`.
   KONTROLA ✗ je u redu samo uz „razlika je točno Σ prijavljenih" — inače **stati**.
4. Isto bez `--dry` ⇒ `<delta>_filled.xlsx`; zapiši **`OČEKIVANO U PREGLEDU UVOZA (MC): N New · M Modify`**.
5. **Koka uveze** (Sašine retke: „Ispravi kao vlasnik Aree"); pregled mora pokazati te brojke.
6. Provjera: nov Delta Export ⇒ korak 2 ⇒ **0 New · 0 Modify**. `⚠ NOV PLAN` u ispisu ⇒ `rate_alat.py --only b`.

### 3.2 Visa (~3., Saša plaća)
1. **Plati** fotonalogom s RF-a iznos **„Novi saldo" s izvoda** — NE Σ trake (traka ne zna neupisane kupnje
   ni rate starih planova; 05.11.: traka 1.526,07, izvod 1.751,12).
2. **Koka u traci:** Visa → „Ne — iznos ili dan je drukčiji" → iznos s izvoda i dan plaćanja → „Upiši
   naplatu kako ju je banka skinula" (košara ostaje „neusklađeno" do uvoza).
3. `Financije\run.bat visa_uvoz_izvoda.py PBZVISA_YYYY-MM.pdf <dan plaćanja> --file`
   Čitaj: `RF naplata … ✓ već upisana` · **KONTROLA ✓** · `MOŽDA KRIVO MJESTO` (⇒ `--premjesti=<id8>` ako je to
   ta kupnja) · `DUPLIKAT?` (⇒ `--brisi=<id8>`). `N/A` (narančasto) razvrstati u fileu.
   ⚠ **Naknadu plaćanja** (05.11.: 0,30) alat uz naplatu iz trake NE dodaje — upisati je u appu.
4. Koka uveze (javi joj OČEKIVANO); ponovni prolaz = **0 New · 0 Modify**.

### 3.3 Traka 11. — MC naplata (Koka, u aplikaciji)
Bankovna aplikacija: koliko je skinuto i kojeg dana → Overview, traka „Čeka potvrdu" → **slaže se** ⇒ dodir
dana ⇒ **Da, upiši** (naplata + kupnje u `Izvrsen`, Namjena sama). **Ne slaže se** ⇒ „Ne — iznos ili dan…" ⇒
iznos i dan s ekrana banke ⇒ saldo odmah točan, košara „neusklađeno" do MC izvoda. Saša kao grantee u traci
vidi usporedbu (upiše iznos ⇒ ✓ ili razlika), potvrđuje Koka.

### 3.4 ZABA (kad stigne)
1. **Prvo** `Financije\run.bat promet_check.py` — mjesec izvoda **✓ u cent** ⇒ samo **sidro** (§3.6), gotovo.
2. ✗ ⇒ razliku prvo tražiti **na drugim izvodima istog mjeseca** (S161: ZABA višak = Visa kupnja na krivom
   računu; S192: parking m-zaba upisan kao Mastercard). **Sidro tek kad je ✓** — sidro preko greške je sakrije.
3. Ako na izvodu ima redaka kojih baza nema: Delta Export ZABA (prozor obuhvaća mjesec) ⇒
   `Financije\run.bat fill_from_izvod.py <delta.xlsx> --zaba ZABA_YYYY-MM.pdf --zigosi`
   Čitaj: `≈ … isti redak u bazi na …` (dan pomaknut ili storno — ispravlja se datum u appu, ne dodaje redak) ·
   `MOŽDA KRIVO MJESTO` (jasan slučaj alat **sam** prebaci kartični redak na račun) · „Za upis" = pravi novi.
4. Koka uveze; kontrolni stupac mora završiti na ispisanom stanju ⇒ sidro.

### 3.5 RF (kad stigne; ne dolazi svaki mjesec)
Kao ZABA, s `--rf RF_YYYY-MM.pdf` (`--od <datum>` za početak prozora). **Bez izvoda** (S192): Delta Export RF
(prozor 1) i usporedba redak po redak s bankovnom aplikacijom — tipično fali mirovina 2. stup, naknada paketa,
naknada plaćanja Vise; Keks se knjiži dan-dva kasnije.

### 3.6 Sidro — kraj kruga
Pločica „Stanje po računu" → **u banci** → broj → izvor:
- **izvod** — broj i datum **s papira** (datum zadnje transakcije izvoda, ne kraj mjeseca);
- **ekran banke** — app sam sidri na jučer i oduzme današnji promet. Prvo upiši današnje, pa pogledaj banku.

Potvrditi smije Koka (ZABA, RF) i Saša (write grantee — RF s mobitela, S194). **Gotovo kad:** saldo = banka na
oba računa, košare zatvorene ⇒ dnevni unos do idućeg mjeseca. Kontrola unatrag: `promet_check.py`.

---

## 4. Kad nešto ne štima — kamo gledati

| simptom | prvo provjeri |
| --- | --- |
| pločica ≠ banka, a krug je zatvoren | čip „na dan …" uz naslov (filtar na prošlom danu) · nedostaje današnji/jučerašnji redak · `~` iznosi |
| traka „neusklađeno" | kupnja upisana na krivi `Izvor`/račun · kupnja s kraja ciklusa u krivoj košari · duplikat ±2 dana |
| uvoz pokazuje drukčije brojke od OČEKIVANO | stari bundle (Ctrl+Shift+R) · file iz krive baze (TEST/PROD) · kriv e-mail u kol. G |
| uvoz traje / javlja „NIJE upisano" | poruku zapisati i javiti — prije S193 bila je tiha |

---

## 5. Otvoreno — jedini popis

Jedan redak po stavci; puni tekst u arhivi pod istim T-n. **„provjeriti"** = stanje nije sigurno, treba jedan
pogled (Saša / Claude) da se zatvori ili potvrdi — ne pogađati.

| # | što | stanje |
| --- | --- | --- |
| **T4** | **`krug` — jedna naredba za mjesec.** Spec i odluke K1–K9: [`KRUG_SPEC.md`](KRUG_SPEC.md) (07.11.). Ukratko: svi izvodi iz korijena `izvodi\`, stanje „gotovo" izračunato iz baze, nejasno kao odluka u Excelu (`Delete?` + `Napomena`), ZABA/RF bez Delta Exporta, sidro iz izvoda upisuje `krug` kad je promet ✓, Visa tek nakon plaćanja; izlaz u Kokin **`Izvodi\Za uvoz`** (samo dodaje). Pločica „Mjesečni krug" i gumb „Pokreni krug" idu **u oblak** (faza C), `etracker://` se ne gradi | faza A **✅ S195 na TEST-u** (studeni od početka do kraja, T-S195-5); PROD prvi put u prosincu (T-S195-1..4); faze B/C kasnije (Strategic Position) |
| T51 | pregled uvoza MC ispravaka javlja „Rate?: true → true" (MC alat piše `Rate?` i kad je već `true`) — redak se broji u Modify, promjene nema | otvoreno, nisko (S195) |
| T42, T46 | upozorenje „older records" bez rata · čip „na dan … ↺ This Year" | ✅ test-branch, **čeka deploy** (T-S194-5/6) |
| T1 | uvoz Excela na mobitelu je najskuplji korak | parkirano: [`parked/RASCISCAVANJE_IZVODA.md`](parked/RASCISCAVANJE_IZVODA.md) — okidač: `krug` radi, a odluka i dalje puno |
| T3 | traka „neusklađeno" ne kaže gdje tražiti | čeka prvu stvarnu razliku (S157) |
| T11 | Visa: 7 starih planova / 19 rata nisu unaprijed generirane; 2 zastarjela plana iz 2025. (Bauhaus, Inter Cars) | provjeriti (Visa traka i alat od S192 — trebaju li još?) |
| T18 | komentar se ne upisuje kad povijest nije jednoglasna | provjeriti (rate od S173 nose `<Trgovac> n/N`) |
| T19 | `uskladi_izvod` predlaže `Izvrsen` prije naplate | provjeriti — vjerojatno zastarjelo (MC tok od S173 je `fill_from_izvod --mc`) |
| T20 | retci bez `Status` nakon Excel uvoza | provjeriti — `default_map` na uvozu od S181 |
| T22 | MC ostatak rate na zadnjoj rati (`remainder_map`) | provjeriti je li `set_rata_ostatak_S168.py` pušten na PROD |
| T23 | rata modal ne generira MC naknadu 1,32 po rati | otvoreno (alat ih generira od S173) |
| T24 | `rate_alat.py --only a` — higijena oznaka rata (91 redak, i Visa) | provjeriti |
| T25 | podmapa „Obrađeno" u Kokinom inboxu | otvoreno, nisko |
| T28, T29 | Visa buduće rate; PBZVISA ispravljač `Datum naplate` | provjeriti — većinu radi `visa_uvoz_izvoda` (S161) |
| T30 | `Izvod opis` za RF retke | otvoreno — ide uz T4 (RF put) |
| T31 | `oznaci_iz_presedana.py --apply` | provjeriti (pravila trgovca S174–S177) |
| T32 | dva zaostatka Excel puta iz S125 | otvoreno, nisko |
| T36 | starija povijest bez `Tip` (2024.–09/2025.) | posao: T-S174-3 / T-S174-5 (PENDING „Posao") |
| T37 | Intercar rate 2025. udvostručene? | Saša, protiv MC izvoda 2025-05…10 |
| — | „Financije dovoljno gotove" | prosinački krug bez ručnog slaganja i bez razvojne sesije (Strategic Position) |

---

## 6. Kako se ovaj dokument održava

- **Zatvorena stavka seli isti dan** u arhivu (dopiše se u `_archive/FINANCIJE_PROCES_do_S194.md`, ili novi
  arhivski file kad taj naraste), ovdje nestaje. Nova stavka = jedan redak + puni tekst gdje treba.
- **Poslije svakog kruga:** ako se ijedan korak promijenio, §3 se **prepiše** (ne dopisuje) i datum u zaglavlju
  osvježi. Nalazi kruga idu u DONE_HISTORY sesije, ne ovamo.
- Pravila alata (zašto alat radi tako) su u `data-prep_tools/CLAUDE.md`; ovdje samo **što čovjek radi**.
