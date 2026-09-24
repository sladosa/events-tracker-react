# Dospjelo → potvrdi — prijedlog prije koda (S147, 2026-09-24)

> **Status: PRIJEDLOG, svih šest odluka (D1–D6) prihvaćeno u S147.** Ništa od ovoga nije izgrađeno.
> Proširuje `OVERVIEW_TAB_SPEC.md` §2.5a (traka „Dospjelo → potvrdi", zamišljena u kolovozu,
> nikad izvedena) i ispravlja je u jednoj točki: **potvrđuje se košara, ne redak** (§3).

---

## 1. Što je odlučeno prije ovog dokumenta

**Značenje `Status`a na kartičnom retku (Saša, S147):**

> *Kupovina je uvijek odrađena. `Planiran` znači da skidanje s računa još nije bilo;
> u `Izvrsen` prelazi kad rata ili odgođeno plaćanje stvarno skine novac s računa.*

Time se zatvara pitanje iz S130 („`Provjeri` prijavljuje normalno stanje otvorene košare"),
gdje su se sudarala dva zapisana pravila. Pobjeđuje **delta tok**: `Status` je prekidač
*„banka je naplatila"*. Pravilo *„`Status` kartičnog retka je `Izvrsen`"* (Visa 855/855)
opisuje **zatvorene** košare i ostaje istinito za njih. Povijesni retci se ne diraju.

**Što ostaje zabranjeno (OVERVIEW §2.5a):** automat *„dospjelo ⇒ izvršeno"*. Dospijeće nije
dokaz naplate. Zato potvrđuje **čovjek koji gleda banku**, a app mu samo pokaže što čeka potvrdu.

---

## 2. Izmjereno na PROD-u, 24.09.2026. (`Financije_all`, samo čitanje)

| | |
| --- | --- |
| `Planiran` ukupno | **81**: Mastercard 40, Visa 41, **`Racun` 0** |
| od toga dospjelo (`Datum naplate ≤ danas`) | **12**: Visa 10 (košara 03.09.), MC 2 (par `+105,30`/`−105,30`) |

⚠ **`Racun`/`Planiran` = 0 ⇒ redak „planirano" na pločici danas ne pokazuje ništa.** Nadolazeće
kartične naplate nigdje se ne vide (CLAUDE.md, „`Status` kartičnog retka…").

**Košara ↔ skupna naplata na računu** (Σ isplata − Σ uplata košare, protiv retka `Izvor = Racun`):

| košara | Σ košare | banka skinula | razlika |
| --- | ---: | ---: | ---: |
| MC 11.06. | 1.768,00 | 1.768,00 (ZABA) | **0,00** |
| MC 11.07. | 1.244,74 | 1.244,74 | **0,00** |
| MC 11.08. | 1.332,52 | 1.332,52 | **0,00** |
| MC 11.09. | 1.068,70 | 1.068,70 | **0,00** |
| Visa 05.06. | 1.409,63 bruto | 1.282,79 (RF) | **126,84** |
| Visa 06.07. | 1.800,42 | 1.495,78 | **304,64** |
| Visa 07.08. | 1.126,06 | 1.171,59 | **−45,53** |

⇒ **Mastercard je spreman danas.** Visa se ne slaže **nijedan put od tri** — ali to je
**ISPRAVLJENO istog dana** mjerenjem cijele povijesti, jer je gledanje zadnja tri mjeseca
vodilo na krivi zaključak (*„Visa model ne radi"*):

| razdoblje (mjesec naplate, bruto isplata košare vs PBZ naplata na RF-u) | ishod |
| --- | --- |
| **2024-10 → 2026-01**, 16 mjeseci | **u cent** — osim dva **susjedna para** koji se poništavaju: 2025-04/05 `∓100,00`, 2025-07/08 `∓0,99` |
| **2026-02 → 2026-08** | 6 od 7 se razilaze: `123,33 · 35,00 · 195,00 · 126,84 · 304,64 · −45,53` (2026-04 `0,00`) |
| prije 2024-10 | nema PBZ naplate s `Izvod opis` u bazi — nema s čim usporediti |

⇒ **Visa model radi; pokvarilo se nešto oko veljače 2026.** To je ograničen posao
(šest mjeseci, počevši od `2026-02 · 123,33` protiv `PBZVISA` izvoda), ne svojstvo kartice.
Okrugli iznosi (`35,00`, `195,00`) **sugeriraju** retke upisane punim iznosom uz rate — to je
hipoteza, ne nalaz. Dok razlika nije objašnjena, traka za Visu bi svaki mjesec prijavljivala
nešto što nitko ne zna objasniti — upozorenje koje uvijek pali nauči se otklikati (S143).

⚠ **Dva susjedna para su dokaz za nagovještaj iz §5.2** („razlika je redak susjedne košare"):
ista razlika, suprotan predznak, susjedni mjesec — potpis kupovine u krivom ciklusu.

⚠ Usput: Visa košara 05.06. nosi redak `PRIMLJENA UPLATA - HVALA` (`uplata 1.282,79`,
`Izvor = Visa`). To je **zrcalo skupne naplate unutar pota**. Zato mjera mora biti **bruto
isplata**, inače ga Σ košare pojede (neto bi pokazao `126,84` umjesto `1.409,63`).

---

## 3. Model: košara, ne redak

**Košara** = svi retci s istim `(Izvor, Datum naplate)`, gdje je `Izvor` kartica.
**Dospjela košara** = barem jedan redak joj je `Planiran`, a `Datum naplate ≤ danas`.

Zašto košara: kartični redak **nikad** ne miče saldo, nego račun tereti **jedna** skupna
naplata. Koka u bankovnoj aplikaciji vidi **jedan** broj (*„07.10. PBZ Card −412,30"*), a ne
18 kupovina. Uspoređuje se jedan broj s jednim brojem. To je najjača kontrola koju imamo
(„zbroj košare je jači signal od sparivanja po retku", S124), i ne ovisi o tome jesu li
parovi pogođeni.

Rate na `Racun`u (danas ih nema, ali mehanizam ih podržava) i planirani prihodi (mirovina)
idu **pojedinačno**: tamo je redak ujedno i naplata.

`Dospjelo` je **izvedeno, nikad spremljeno** (OVERVIEW §2.13): nema treće vrijednosti `Status`a.

---

## 4. Kako to Koka vidi (mobitel)

Traka je **iznad** „Stanje po računu", i postoji **samo kad ima čega** (isto načelo kao OQ-4).
Redoslijed je namjeran: potvrdiš gore, saldo ispod se odmah pomakne.

```
┌ Čeka potvrdu (2) ─────────────────────────────────┐
│ Mastercard · naplata 11.10. · 32 stavke            │
│ Σ 714,01 €   →  s računa Kokin tekući ZABA         │
│ banka skinula [ 714,01 ]  dana [ 11.10. ]          │
│ ✓ slaže se                     [ Potvrdi ]         │
├────────────────────────────────────────────────────┤
│ Mastercard · naplata 12.09. · 1 stavka  … …        │
└────────────────────────────────────────────────────┘
```

- Polje **„banka skinula"** mora biti upisano **rukom**, isto kao „u banci" na pločici. Unaprijed
  popunjeno sa Σ, provjera bi bila tautološka (§2.17).
- **Datum** je dan s bankovne aplikacije. Ne nudi se zadani, jer pogođen datum koji izgleda kao
  podatak je upravo ono što je proizvelo `BUG-S115-ANCHORDATE`.
- Tekst je *„provjeri u banci"*, nikad *„naplaćeno"*. Visa `Datum naplate` je procjena
  (`cutoff:3:5`), a banka stvarno skida 6.–7.

---

## 5. Procedura — i što kad se NE slaže (Sašina briga)

### 5.1 Slaže se u cent → `Potvrdi`

Jedan potez radi dvoje:

1. svim `Planiran` retcima košare postavi `Status = Izvrsen`;
2. **stvori skupni `Racun` redak** (`Transfer / izmedju racuna`, `Isplata` = broj koji je Koka
   upisala, datum = dan koji je upisala, opis = strojni tekst izvatka iz configa, npr.
   `TROŠKOVI UČINJENI MASTERCARD KARTICOM`).

Drugi korak zatvara zamku iz S137 („pločica precjenjuje saldo između naplate i izvatka"): saldo
je točan **istog dana**, a ne tek kad stigne izvadak. Kad izvadak stigne, `uvezi_transu.py` redak
preskoči (dedup po `(datum, iznos)`), a `--zigosi` mu upiše `Izvod opis`. Nijedan redak nije dvaput.

⚠ Zato **datum mora biti bankin**. Ako je Koka upiše na 10.10., a banka na 11.10., dedup ga ne
prepozna i izvadak donese **drugi** skupni redak. Zato se datum čita s ekrana banke, a alat
dobiva uski drugi prolaz (**isti iznos + strojni tekst + ≤ 3 dana**), isti oblik kao kod
`Izvod opis` sparivanja (S124).

### 5.2 NE slaže se → saldo slijedi banku, košara ostaje otvorena

Načelo koje već vrijedi za cijeli projekt: **autoritet za iznos je banka.** Zato:

1. traka pokaže **razliku** (`Σ 714,01 · banka 736,51 · razlika −22,50`) i **nema** gumb `Potvrdi`;
2. nudi **`Upiši naplatu kako ju je banka skinula`**. To stvori skupni `Racun` redak s **bankinim**
   brojem ⇒ saldo je točan odmah, jer skupni redak jedini miče saldo;
3. retci košare **ostaju `Planiran`**, a košara ostaje u traci kao **„razlika −22,50"** dok se ne
   razriješi. Ništa se ne prešućuje i ništa se ne upija u zbroj.

Tako neusklađenost ne može **pokvariti** saldo, a ne može ni **nestati**. Ostaje vidljiva kao
otvoreno pitanje o košari, dakle o podacima kartice, a ne o računu.

**Kako se razlika razrješava**, redom po tome što je najčešće (sve već viđeno u ovoj bazi):

| uzrok | kako se prepozna | primjer iz povijesti |
| --- | --- | --- |
| kupovina **nije upisana** | razlika < 0, nijedan redak ne objašnjava | Sašina briga |
| kupovina u **krivoj košari** (kriv `Datum naplate`) | razlika = točno jedan redak **susjedne** košare | 12 MC kupovina s `11.07.` umjesto `11.08.` (S112) |
| **krivi iznos** (tipfeler) | mala razlika, jedan redak blizu | Koka `1.265,59` / banka `1.285,59` (S111) |
| **duplikat** | razlika = točno jedan redak košare | 9 skoro-duplikata (S111) |
| **naknada banke** koju nitko nije upisao | razlika = `1,32` × broj rata | `NAKNADA ZA OBROČNU OTPLATU` (S124) |
| rata **zaokružena** | razlika ≤ 0,05 | `117,32 / 6` (S145, popravljeno) |

App može sam ponuditi **dva** jeftina nagovještaja, bez pogađanja:
- *„razlika je jednaka retku X"* (točan pogodak po iznosu, unutar ili iz susjedne košare);
- *„razlika je jednaka zbroju retaka susjedne košare s datumom kupnje ≤ 3 dana od granice
  ciklusa"* (kriv ciklus).

Sve ostalo ide **drillom**: klik na košaru ⇒ Activities filtriran na tu karticu i taj
`Datum naplate`. Ispravak se radi **Editom postojećeg retka** ili **novim retkom za propuštenu
kupovinu**. Kad Σ padne na bankin broj, traka nudi `Potvrdi`, ali **bez** stvaranja drugog
skupnog retka (već postoji iz koraka 2), dakle samo prebaci statuse.

⚠ **Propuštena kupovina ubačena kasnije ne dira saldo** (kartični redak), pa ne treba ni sidro
ni ispravak salda. Popravlja se samo košara. Upravo zato je sigurno pustiti saldo da slijedi banku.

---

## 6. Konfiguracija, ne kod (test generičnosti)

Novi blok u `settings.dashboard` widgetu, uz postojeći `split` (koji već nosi `due_slug`):

```json
"due": {
  "basket_by": "izvorplacanja",
  "baskets": {
    "Mastercard": { "account": "Kokin tekući ZABA", "text": "TROŠKOVI UČINJENI MASTERCARD KARTICOM" },
    "Visa":       { "account": "Sašin tekući RF",   "text": "PBZCard d.o.o." }
  },
  "status_slug": "status", "pending": "Planiran", "done": "Izvrsen",
  "settle": { "izvorplacanja": "Racun", "tip": "Transfer", "podtip": "izmedju racuna" }
}
```

- Kartica koja **nije** u `baskets` ne ulazi u traku ⇒ **Visa se isključuje brisanjem jednog
  ključa**, bez deploya. Faza 1 kreće samo s Mastercardom.
- Blok **mora** ući u Structure roundtrip (`Dashboard` sheet još ne postoji, v. Backlog
  „Roundtrip completeness"). Dok ne uđe, uvoz Structure filea ga **ne smije brisati**.
- `text` je vrijednost koju pravilo „opis skupne naplate ostaje strojni tekst izvatka" danas drži
  **samo u dokumentaciji**. Ovdje dobiva prvo mjesto u bazi.

---

## 7. Kod — što se dira

| komad | što | napomena |
| --- | --- | --- |
| `sql/053_due_baskets.sql` | RPC `rpc_area_due_baskets(area, basket_slug, due_slug, status_slug, pending, as_of)` → `(basket, due_date, n, n_pending, gross_minus, gross_plus)` | agregacija u Postgresu, ne u pregledniku (Faza 1 pravilo). `SECURITY DEFINER` sam provjerava pristup. P2 parenti se ne broje |
| `src/lib/overviewApi.ts` | `fetchDueBaskets()` | `withRetry`; neuspjelo čitanje **nije** „nema dospjelog" (S121) — traka tada kaže da nije učitala |
| `src/lib/dueBaskets.ts` | čista funkcija: usporedba, razlika u **lipama**, nagovještaji iz §5.2 | testabilna bez baze, isto kao `splitRataAmounts` |
| `src/components/overview/DueStrip.tsx` | traka | mobilna širina prva; `w-full max-w-0` na tekstu (S119) |
| potvrda | batch `UPDATE event_attributes` (status) + INSERT skupnog retka | **broji promijenjene retke** (`assertWrote`), RLS-blokiran upis „uspije" s 0 (S133) |
| `uvezi_transu.py` | drugi prolaz: isti iznos + tekst + ≤ 3 dana | inače datum koji se razlikuje za dan daje duplikat |
| `docs/help/overview.md` | tema | Help mora znati za traku |

⚠ **Prava.** Košara miješa Kokine i Sašine retke (košara 03.09. je bila **7 od 10 Sašinih**, S125).
Prebacivanje `Status`a na tuđem retku smije **samo vlasnica Aree** (`043`); write-grantee
bi dobio djelomičan uspjeh. Zato je **`Potvrdi` samo za vlasnicu** (`canWrite` ⇒ vlasnik), a
grantee traku vidi, ali bez gumba, uz rečenicu *zašto*.

⚠ **Bez push obavijesti u prvoj verziji.** Web app bez servisnog workera ne može probuditi
mobitel. Koka ionako otvara Overview kad gleda banku, a traka je ondje. Push (PWA ili tjedni
e-mail preko Netlify scheduled funkcije, v. Backlog „Netlify scheduled maintenance") ide tek
ako se pokaže da traku ne vidi na vrijeme.

---

## 8. Odluke — ✅ PRIHVAĆENE (Saša, S147, 2026-09-24: „po tvojim prijedlozima", D6 zasebno)

| # | pitanje | odluka |
| --- | --- | --- |
| **D1** | Stvara li `Potvrdi` skupni `Racun` redak? | **Da.** Zatvara zamku S137, a dedup ga poslije prepozna |
| **D2** | Kad se ne slaže: saldo po banci, košara otvorena? | **Da.** Saldo ne smije čekati da se nađe propuštena kupovina |
| **D3** | Tolerancija usporedbe | **0,00**, u cent. MC se već slaže u cent 4 od 4; svaka tolerancija bi progutala naknadu od 1,32 |
| **D4** | Visa u prvoj verziji? | **Ne** — dok se ne objasni razilaženje od 2026-02 (§2). Model sam po sebi radi (16 mjeseci u cent) |
| **D5** | Tko potvrđuje | **Samo vlasnica Aree** (Koka) |
| **D6** | Treća vrijednost `Status`a za „banka skinula, košara se ne slaže"? (Sašino pitanje) | **Ne sprema se — izvodi se.** Košara sa skupnim retkom i Σ ≠ banka ⇒ oznaka **„naplaćeno — neusklađeno"** u traci (i, ako zatreba, kao formula u Excelu, isto kao `Potvrda`). ✅ Saša potvrdio (S147) |

**Zašto D6 ne sprema vrijednost** (Saša je predložio `Očekivanje potvrde`):
- `Planiran` je tvrdo upisan na **najmanje pet** mjesta — delta `SUMIFS <>"Planiran"`, stupac
  `Provjeri`, `split` pločice, `FILTERS_IZVRSENO` u alatima, `primijeni_uskladu`. Treća
  vrijednost mora ući u svako; zaboravljeno mjesto broji krivo **bez poruke** (razred S143
  `FILTERS_IZVRSENO`).
- Spremljeno stanje netko mora **vratiti** kad se razlika riješi; izvedeno nestane samo.
- Nova vrijednost živi i u `validation_rules` i u `value_text` svakog retka (rizik S105d).
- Isti razlog je već odlučen za `Dospjelo` (OVERVIEW §2.13).

**Sašino drugo pitanje — status na tri Visa razlike: ne.** Povijesni retci su `Izvrsen` i
točno je da je novac otišao; *„istražujemo"* je svojstvo **košare**, ne retka. Istraga je
posao iz §2 (od 2026-02), a traka ih pokaže sama kad Visa uđe u config.

---

## 9. Faze

1. **Traka samo za čitanje, samo MC.** Bez ijednog upisa. Već sama pokaže dospjele košare i
   Σ uz polje za bankin broj. Vrijednost: Koka vidi što čeka, i razlika postaje vidljiva.
   *Prvi stvarni ispit su 2 MC retka `+105,30`/`−105,30` koji su danas dospjeli.*
2. **`Potvrdi` + skupni redak** (D1, D2) + drugi prolaz u `uvezi_transu.py`.
3. **Nagovještaji** iz §5.2.
4. **Visa**, kad se objasni razilaženje od 2026-02 (§2): jedan ključ u configu.

## 10. Kako će se testirati

- `dueBaskets.test.mjs`: Σ u lipama, bruto (zrcalni redak `PRIMLJENA UPLATA` ne smije pojesti
  Σ), nagovještaj „razlika = jedan redak" i **protuprovjera** (pokvarena usporedba mora pasti).
- Uživo na `dev:prod`, **pod Kokinim računom** (D5): MC košara 11.10. (32 stavke, `714,01`) kad
  dospije. ⚠ Test mora koristiti bankin broj koji se **razlikuje** od Σ barem jednom, inače
  grana §5.2 nikad nije izvedena (S129 pravilo).
