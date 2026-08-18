# S110 — detaljni testovi (2026-08-17)

**Tema sesije:** pločica prima datumski filtar (`asOf`) · ispisana bankovna stanja iz ZABA
izvoda → `balance_anchors` · provjera lanca app ↔ banka ↔ Kokin Excel · BUG-S110-DATESHIFT.

**Preduvjeti za sve testove:** TEST baza, Area `Financije_all`, `sql/035`+`036`+`037` puštene.
Sidra u bazi na kraju sesije — **tri**:

| `confirmed_on` | iznos | odakle |
| --- | --- | --- |
| `2025-01-01` | 3.054,41 | ispisano, `ZABA_2024-12.pdf` (skripta) |
| `2025-12-31` | 1.184,86 | ispisano, `ZABA_2025-12.pdf` (**ručno kroz UI**, T-S110-2) |
| `2026-07-01` | 2.255,64 | ispisano, `ZABA_2026-06.pdf` (skripta) |

⚠ Ono na `2025-12-31` mijenja očekivane brojeve u T-S110-1 (podnaslov više ne kaže „od potvrde
01.01.2025."). **Za ponavljanje T-S110-1 ga treba obrisati**, ili čitati očekivane brojeve iz
`make_saldo_anchors.py --report`. Vraćanje sidara iz skripte:

```
Financije\run.bat make_saldo_anchors.py --anchor 2025-01-01
Financije\run.bat make_saldo_anchors.py --anchor 2026-07-01
```

---

## T-S110-1 — Pločica prima `asOf` iz globalnog filtra ✅ (2026-08-17)

1. Overview tab, Area `Financije_all`.
2. Filter → `To` = **31/03/2025**. (`From` je nebitan — v. korak 6.)
3. Prijeđi na Overview.

**Očekivano:**
- podnaslov pločice u **žutom**: „na dan 31.03.2025."
- `Kokin tekući ZABA` = **2.546,55 €**
- podnaslov retka: „od potvrde 01.01.2025. · 3.054,41 € · **64** promjena poslije"
- `Sašin tekući RF` nema sidro ⇒ „od početka podataka" + čip „još nije potvrđeno"

4. U polje „u banci na 31.03.2025." upiši `2546,55` → čip **✓ slaže se**.
5. Makni filtar (`Clear all`) → podnaslov „na dan …" **nestaje**, broj se vraća na današnji.
6. Postavi `From` = 01/01/2025 uz isti `To` → **broj se ne mijenja**. Saldo nema početak,
   akumulira se od sidra; pločica namjerno ignorira `dateFrom`.

**Pad:** broj se ne mijenja s filtrom · podnaslov „na dan …" izostane (⚠ to je *ozbiljan*
pad, ne kozmetika — prošli broj prikazan kao sadašnji je ista klasa greške kao „od početka
podataka" prikazan kao bankovni iznos, OVERVIEW_TAB_SPEC §2.17 t.4).

> **Prošao 2026-08-17.** Usput potvrđeno na dva računa istovremeno (jedan sa sidrom, jedan bez).
> ⚠ Prvi pokušaj je izgledao kao pad jer je filtar bio na `31/03/2026` — pločica je vjerno
> pokazala `591,98` (točan broj za taj datum). **Provjeri godinu prije nego prijaviš pad.**

---

## T-S110-2 — „Potvrdi" sidri na gledani datum, ne na danas ✅ (2026-08-17)

**Što se testira:** NE broj na pločici, nego **mehanizam** — sprema li „Potvrdi" sidro na
*datum koji gledaš* ili na *današnji*. To je jedina stvar koja omogućuje sidrenje unatrag,
a time i provjeru „reproducira li app tuđi lanac" (S109). Bez toga je sidro samo pokrivač.

⚠ **Ovaj test piše u bazu.** Sidra su append-only i iz UI-ja se ne mogu obrisati; čišćenje je
samo kroz SQL Editor:
`DELETE FROM balance_anchors WHERE area_id = '98dd91f3-de77-4619-9d08-d1ade604640a' AND confirmed_on = '2025-12-31';`

### Koraci

1. Filter → `To` = **31/12/2025**. Overview.
2. Pločica pokazuje `Kokin tekući ZABA` = **988,92 €**, podnaslov „na dan 31.12.2025."
3. Gumb mora pisati **„Potvrdi na 31.12.2025."** (ne samo „Potvrdi"), labela polja
   **„u banci na 31.12.2025."**
4. Upiši **`1184,86`** — Kokin `Stanje` na redu 2209 i ispisano `NOVO STANJE` sa
   `ZABA_2025-12`. (Provjereno: između 25.12. i 31.12.2025. banka nema nijednu transakciju,
   pa isti broj vrijedi i na close date izvoda i na kraj godine.)
5. Čip pokazuje **`Δ −195,94`**. ⚠ **To je očekivano, ne pad** — v. „Zašto Δ nije nula".
6. Klikni **Potvrdi**. Toast mora reći **„Potvrđeno na 31.12.2025."**
7. Podnaslov retka prelazi na „od potvrde **31.12.2025.** · 1.184,86 € · N promjena poslije".

**Pad:** gumb piše samo „Potvrdi" · toast kaže današnji datum · u bazi `confirmed_on` je
današnji (`SELECT confirmed_on, amount FROM balance_anchors ORDER BY created_at DESC LIMIT 1;`).

### Zašto Δ nije nula (i zašto to nije pad)

`1.184,86 − 988,92 = 195,94` = `45,94` (17.08.2025.) + `150,00` (12.10.2025.) — dva neopisana
retka u bazi bez bankovne protustavke, **poznato odstupanje** iz `SALDO_MODEL_NALAZI.md` §6.3.
Koka i banka se međusobno slažu; app je niži za točno ta dva retka.

### Što se dobiva — sidro presijeca odstupanje

Poslije koraka 6 postavi `To` = **28/04/2026**:

| | prije sidra | poslije sidra |
| --- | --- | --- |
| app | 1.247,36 | **1.443,30** |
| banka (`ZABA_2026-04`) | 1.447,50 | 1.447,50 |
| Δ | −200,14 | **−4,20** |

`4,20` = `2,80` + `1,40` (ožujak i travanj 2026.). Sve prije 31.12.2025. je odrezano.

**To je poanta sidra: ne popravlja povijest, nego je presijeca.** Isti razlog zbog kojeg
današnji broj stoji točan iako u lancu postoji staro odstupanje.

> **Prošao 2026-08-17.** Sidro `2025-12-31 = 1.184,86` spremljeno s ispravnim `confirmed_on`
> (provjereno u Supabase Table Editoru). Kontrolni korak dao **točno `1.443,30`**, Δ pao s
> `−200,14` na `−4,20`.
>
> ⚠ **Nalaz uz test:** sidro upisano kroz UI ima **`note = NULL`**, dok ona iz
> `make_saldo_anchors.py` nose podrijetlo („ispisano NOVO STANJE, ZABA_2024-12.pdf"). Stupac
> postoji, aplikacija ga ne puni. Smeta baš zbog pravila oko kojeg je mehanizam građen —
> **stanje smije doći samo izvana** — a iz baze se poslije ne vidi je li broj s izvoda, s
> ekrana banke ili izračunat. V. backlog u `CLAUDE.md`.

---

## T-S110-3 — BUG-S110-DATESHIFT: promjena datuma se više ne gomila ✅ (2026-08-17)

**Regresija.** Bug je bio: delta se računala od *fiksnog* originalnog datuma, a primjenjivala
na `createdAt` koji je **već bio pomaknut** ⇒ svaka sljedeća promjena dodala bi cijelu deltu
ponovno. `<input type="date">` javlja `onChange` i na međustanjima dok se tipka godina
(`2026 → 0002 → 0020 → 0202 → 2025`), pa su se nagomilali pomaci od po ~2000 godina.

1. Otvori bilo koju aktivnost → Edit.
2. Promijeni **datum** (npr. na godinu ranije) — tipkaj godinu, ne biraj iz kalendara.
3. Odmah zatim promijeni **vrijeme**.
4. Pa opet promijeni **datum**, pa opet **vrijeme**.
5. Gledaj redak **`Event #1 · …`** iznad atributa.

**Očekivano:** `Event #1` uvijek prati datum u narančastom zaglavlju. Poslije četiri promjene
mora pisati isti datum kao zaglavlje.

**Pad:** `Event #1` odluta (godina u tisućama ili negativna). ⚠ Simptom pada je **tih**:
Save ne javi ništa, samo ne prebaci na View. Baza ostane netaknuta jer Postgres odbije
`-003831-05-29T…`.

> **Prošao 2026-08-17** na pravom slučaju (200,00 s 2026-05-29 na 2025-05-29).

---

## T-S110-4 — Sanity guard: neispravan datum ne ode u bazu tiho ⬜

Teško izazvati sad kad je T-S110-3 popravljen — testirati **samo ako se sumnja na regresiju**.

1. U devtools konzoli forsiraj `sessionDateTime` izvan raspona (ili privremeno vrati stari
   `handleDateTimeChange`).
2. Save.

**Očekivano:** poruka „Datum aktivnosti je neispravan (godina …). Zatvori bez spremanja i
otvori aktivnost ponovno." — **ne** tihi pad.

Guard pokriva raspon **1900–2200**, i sesiju i svaki pojedini event.

---

## T-S110-5 — „planirano" (`split`) također poštuje `asOf` ⬜

1. Filter → `To` = **31/12/2025**, Overview.
2. Broj uz „planirano" mora se razlikovati od onoga bez filtra.

⚠ **Odgovor je namjerno polovičan i to nije pad.** `Status` je **trenutno stanje, ne povijest**
— app ne pamti *kad* je redak prešao `Planiran → Izvrsen`. „Planirano na 31.12.2025." zato može
značiti samo „datirano do 31.12.2025. i **danas još** planirano". Prava retrospektiva traži
povijest statusa (nova stvar, ne sitnica).

---

## T-S110-6 — `make_saldo_anchors.py` ✅ (programski, 2026-08-17)

| Provjera | Rezultat |
| --- | --- |
| ispisano `NOVO STANJE` s 31 ZABA izvoda | ✅ lanac **neprekinut** (`novo[i] == pocetno[i+1]`), 2024-01-01 → 2026-07-01 |
| `--report` app vs banka | ✅ 5 mjeseci u cent nakon popravka podataka |
| tautology guard | ✅ sidro NA datum usporedbe daje `SIDRO (nije provjera)`, ne lažnu kvačicu |
| `--anchor` idempotencija | ✅ ponovni upis istog datuma se preskoči (tablica je append-only) |
| `--load-all` guard | ✅ odbija upisati ako je lanac izvoda prekinut |

⚠ **RF nije pokriven** — njegovi izvodi su išli kroz OCR, `T-S107d-6` je otvoren.

---

## T-S110-7 — Provjera lanca end-to-end ✅ (programski + UI, 2026-08-17)

| Točka | Očekivano | Rezultat |
| --- | --- | --- |
| sidro `2025-01-01` (ispisano `3.054,41`) → 31.03.2025. | `2.546,55` = banka = Kokin red 1641 | ✅ tri svjedoka na istom broju |
| sidro `2026-07-01` (ispisano `2.255,64`) → 08.07.2026. | Kokin `3.403,74` | ✅ **do centa**, nakon oba popravka podataka |

Drugi red je najtješnja provjera koju podaci dopuštaju: **sedam dana, šest transakcija**, bez
ikakvog nakupljenog naslijeđa. Prije popravaka davao je `3.405,34` (fali parking 1,60).

---

## Popravci podataka u ovoj sesiji (nisu testovi — evidencija)

| Što | Gdje | Kako |
| --- | --- | --- |
| 200,00 bankomat: `2026-05-29` → `2025-05-29` | Review + baza | `fix_koka_datum_200.py` + Edit Activity |
| 200,00: `N/A` → `Transfer` / `cash - bankomat` | Review + baza | `align_review_s110.py` + Edit Activity |
| parking 1,60 na `2026-07-07` | baza (novi event) | Add Activity ⚠ prvi pokušaj spremljen na *današnji* datum, ispravljen Editom |
| parking: `Planiran` → `Izvrsen` | Review | `align_review_s110.py` |

⚠ **`Datum naplate` se pri promjeni datuma NE pomiče sam** — delta-shift dira samo vremena
eventa, ne datumske atribute. Oba popravka su ga tražila ručno. Kandidat za budući feature,
zasad zamka.
