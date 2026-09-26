# Kokin rad s `Financije_all` — kako radi danas i kamo idemo

**Prepisano:** 2026-09-26 (S151) · **Za:** Sašu (i Claudea pri planiranju Kokinih plohe)
**Prije:** `KOKA_PRVI_MJESEC.md` (S125, pisan „prije nego Koka počne"); stari tekst je u gitu.
**Susjedni dokumenti:** `DOSPJELO_SPEC.md` (potvrda košare) · `OVERVIEW_TAB_SPEC.md` (saldo, sidra)
· `sessions/BACKLOG_2026-09-26.md` C1 (izvodi od inboxa do žiga) · `CLAUDE.md` (trajna pravila)

---

## 0. Mjerilo koje vrijedi i dalje

Sašin zahtjev iz S125: *„bilo bi mi važno da ne izgubi povjerenje i volju."*

> **Tihi gubitak njenog rada košta više od deset vidljivih smetnji.**
> Klikne, ništa se ne dogodi, nigdje ne piše zašto ⇒ aplikaciji se ne može vjerovati.
> Klikne i dobije poruku (i neugodnu) ⇒ povjerenje ostaje.

Svaka nova Kokina ploha se mjeri time, ne time „radi li".

---

## 1. Kako Koka radi DANAS (S151, 2026-09-26)

- **Mobitel, Add i Edit Activity.** Troškove upisuje po računima dok nastaju.
- **Zanima je saldo računa** — Overview pločica „Stanje po računu" je razlog zbog kojeg upisuje.
- **Stara Excelica je napuštena.** Rečeno joj je da više nema smisla i prihvatila je — mobitel joj
  je praktičniji. (Stavka „kad počneš upisivati u app, u Excelicu više ne" iz S125 je time
  **zatvorena**.)

⚠ **Ovo mijenja pretpostavku iz S125** („Excel roundtrip joj je dom, važniji od aplikacije").
Excel roundtrip **ostaje** — kao put za bulk ispravke i za Sašine alate — ali **nije njen
svakodnevni put**. Nove Kokine funkcije se projektiraju **za mobitel, u aplikaciji**.
Posljedica za prioritete: sve što traži da ona otvori Excel je za nju skupo.

---

## 2. Njen mjesečni krug — ciljni oblik

Dva trenutka u mjesecu, oba na **istoj pločici** Overviewa, po računu:

| kada | izvor istine | što radi | mehanizam |
| --- | --- | --- | --- |
| **naplata kartice je prošla**, izvoda još nema | ekran bankovne aplikacije | potvrdi **košaru** jednim brojem | „Dospjelo → potvrdi" (`DOSPJELO_SPEC.md`, C5) |
| **stigao je PDF izvod** | izvod | prođe **iznimke** redak po redak, na kraju sidro | **Raščišćavanje izvoda** (§3, novo) |

Između toga: svakodnevni unos na mobitelu (§1). Saldo je točan cijelo vrijeme; izvod ga samo
**potvrđuje** i čisti ono što se nakupilo (krivi iznosi, propušteno, duplikati).

### 2.1 Put izvoda do nje (C1, dogovoreno 26.09.)

1. Koka spremi PDF u svoju OneDrive mapu `Izvodi` → kod Saše `C:\0_Sasa\OneDrive\Izvodi`.
2. **Razvrstač** preimenuje po **sadržaju** (`ZABA_YYYY-MM.pdf`, `PBZVISA_…`) i premjesti u `izvodi/`.
   Ne-izvod (npr. PBZ „Detalji transakcije") **odbije**, ne pogađa.
3. Jedna naredba obrade: parsiranje + sparivanje s bazom + prijedlozi (`Tip`/`Podtip` iz
   brojane povijesti, `Izvod opis` za žig).
4. Rezultat stiže **Koki u aplikaciju** (§3) — ne kao Excel.
5. Obrađen PDF → `Analizirani_izvodi/`.

Podsjetnik na pločici **iz podataka**, ne iz kalendara: *„rujanski izvod ZABA još nije obrađen"*.

---

## 3. Raščišćavanje izvoda — nova ploha (PRIJEDLOG, ništa nije izgrađeno)

**Otvara se s Overview pločice**, iz retka računa, kad za taj račun postoji obrađen a
nepregledan izvod:

```
┌ Stanje po računu ─────────────────────────────────┐
│ Kokin tekući ZABA        13.815,33 €   ✓           │
│   📄 Izvod 2026-09 · 44 stavke · 5 za pregled  [›] │
│ Sašin tekući RF             690,79 €   ✓           │
└────────────────────────────────────────────────────┘
```

**Na plohi se vide samo iznimke**; ono što se slaže u cent se samo ožigoše (`Izvod opis`)
i prikaže kao jedan redak *„39 slaže se — ožigosano"*. Na mobitelu je razlika između 5 i 44
redaka razlika između „odradim na kavi" i „ostavit ću za poslije".

| vrsta | značenje | njen potez |
| --- | --- | --- |
| ✎ **razlika** | redak postoji, iznos ili datum se ne slaže | **Prihvati bankin** (iznos je autoritet izvoda) ili ostavi |
| ＋ **nema u bazi** | banka ima, app nema | **Dopiši** — `Tip`/`Podtip` predložen iz povijesti, ona potvrdi ili promijeni |
| ？ **nema na izvodu** | app ima, banka ne (razdoblje pokriveno) | duplikat? kriv račun? kupovina još nije sjela? — **odluka je njena** |
| ⇄ **1:N** | jedan njen redak = više bankinih (ili obrnuto) | prihvati spoj koji alat predlaže (pravilo S124: bankini retci su kostur) |

**Na kraju:** *„Izvod kaže 13.815,33 na 30.09. — app kaže 13.815,33 ✓"* → **`Potvrdi stanje`**
upiše sidro s datumom **zatvaranja izvoda** i bilješkom `ZABA_2026-09.pdf`. Datum i broj dolaze
s papira, nikad iz klika (pravilo S115/S116). Ne slaže li se, sidro se **ne nudi** — ploha kaže
koliko fali i koji su retci još otvoreni.

⚠ Pravila koja ploha mora nositi, jer su već plaćena:
- **Autoritet za iznos je izvod, za opis i klasifikaciju njen redak** (S113/S114). „Prihvati
  bankin" mijenja iznos, **ne** njen opis.
- **Ispravak ide Editom postojećeg retka**, nikad novim retkom (dedup `(datum, iznos)`, S111).
- **Sličan opis nije duplikat** — ？ se nikad ne briše automatski; dokaz je redak **izvoda** (S137).
- **Rata se veže brojem rate, ne datumom** (S124).
- **Redak prije postojećeg sidra** — izmjena ne miče saldo; ploha to mora reći (S143 faza 4).

---

## 4. Odluke prije koda — ✅ PRIHVAĆENE (Saša, S151, 2026-09-26: „prijedlozi ok“)

| # | pitanje | prijedlog | zašto |
| --- | --- | --- | --- |
| **K1** | Gdje žive stavke izvoda između Sašinog alata i Kokine plohe? | **Nova tablica** (npr. `statement_lines`: račun, izvod, redak, iznos, datum, opis, prijedlog, sparen s `event_id`, stanje pregleda) | Ploha na mobitelu ne može čitati Excel; tablica je i trag *što je koji izvod potvrdio* |
| **K2** | Tko parsira PDF? | **Ostaje Sašin Python alat** (odluka S115: „app čita izvod" je odložen) | Alat već zna ZABA/MC/Visa; ploha prima gotove prijedloge |
| **K3** | Redoslijed prema C5 | **C5 faza 1 prvo** (traka samo za čitanje) | Manja, dijeli istu pločicu; ploha izvoda se onda nasloni na isti raspored |
| **K4** | Kartični izvodi (MC/Visa) kroz istu plohu? | **Da, ali kao košara** — kontrola je Σ košare = naplata, ne redak po redak | Isti model kao C5 |
| **K5** | Tko smije potvrditi | **Vlasnica Aree** (Koka), kao D5 u C5 | Grantee (Saša) pokreće alat, ne potvrđuje |

⚠ **Dok ploha ne postoji**, izvodi i dalje idu Sašinim alatima + Excel uvozom (Saša ili Koka
uvozi). To je prijelazno stanje, ne cilj.

---

## 5. Još otvoreno iz S125 (provjereno 2026-09-26)

- ✅ **Deploy** — davno na PROD-u.
- ✅ **`DropdownData` u izvještaju o uvozu** — zatvoreno (BUG-S114-REPORTDD, S136).
- ✅ **Visa dan naplate** — značenje odlučeno (S141: stvarni dan terećenja; `cutoff:3:5` je
  privremena pretpostavka). Ispravljač još ne postoji (Backlog „PBZVISA prolaz").
- 🟡 **Sumnjiv redak u izvještaj o uvozu** (preskočen `row_hash` a promijenjen u appu) — vrijedi
  i dalje, ali **niže** nego u S125: pogađa Excel put, koji više nije njen svakodnevni.
- 🟡 **Gotovina 99 % neevidentirana** — svjesno; kad se gradi razrez po `Tip`u, mora nositi
  redak `gotovina, nerazvrstano` = Σ(`Transfer / cash - bankomat`) − Σ(`Izvor = Cash`).
  ⚠ **Taj redak pločica RAČUNA, nikad se ne sprema** (Sašino pitanje S151: „je li to
  `Izvor = Cash`, `Tip = N/A`?" — ne): spremljen bi zastario prvim novim gotovinskim troškom i
  dvostruko ga brojao, a `N/A` znači „odluka još nije donesena", ne „svjesno ne pratimo".
  Koka ne radi ništa novo — upisuje gotovinu kad joj se da, a redak se sam smanjuje.
- 🟡 **Sumnjivo vidljivo u listi** („promijenjeno nakon <datum>") — dodiruje filtar s dva uvjeta,
  svjesno odgođen.

---

## 6. Što joj treba reći, njenim jezikom

1. ~~Kad počneš upisivati u app, u Excelicu više ne.~~ ✅ rečeno, prihvaćeno.
2. **Redak se potvrđuje kad se zbroj složi s bankom, ne kad datum dođe.** Dospjeli datum nije
   dokaz da je banka naplatila.
3. **Stanje na pločici uvijek uspoređuj s bankom, a razliku prijavi.** Δ znači da nešto fali,
   nešto je dvaput ili je iznos kriv — nikad grešku u izračunu.
4. **Ako nešto ispraviš, a ništa se ne dogodi — javi.** To je greška aplikacije, ne tvoja.

⚠ Četvrta je najvažnija za povjerenje: daje joj dopuštenje da prijavi tišinu umjesto da zaključi
da je nešto krivo napravila.
