# `krug` — jedna naredba za mjesečni krug Financija

**Stanje na:** 2026-11-07 (S195) — **faza A izvedena i izmjerena na TEST-u** (§8); PROD prvi put u prosinačkom
krugu (T-S195-1..4) · **Stavka:** T4 u [`FINANCIJE_PROCES.md`](FINANCIJE_PROCES.md) §5
**Za:** Sašu i Claudea · **Susjedni:** [`FINANCIJE_PROCES.md`](FINANCIJE_PROCES.md) §3 (današnji ručni tok, koji
`krug` zamjenjuje) · [`DOSPJELO_SPEC.md`](DOSPJELO_SPEC.md) (traka) · [`data-prep_tools/CLAUDE.md`](../data-prep_tools/CLAUDE.md)
(pravila alata — vrijede i unutar `krug`a, nijedno se ne ukida)

> **Cilj (Saša, S194):** jedna naredba koju Saša pokrene bez razgovora s Claudeom. Jasno riješi sama, nejasno
> stavi u Excel kao odluku za Koku, na kraju izvještaj na hrvatskom. Smije se pustiti i sutra opet, dok sve ne
> bude riješeno. **Kriterij „Financije dovoljno gotove"** (Strategic Position) prolazi kroz ovaj alat.

---

## 1. Odluke (S194–S195)

| # | odluka | tko, kada |
| --- | --- | --- |
| K1 | Izlaz (Excel + izvještaj) ide u Kokinu mapu **`C:\0_Sasa\OneDrive\Izvodi\Za uvoz`**; alat ondje samo **dodaje** nove fileove, nikad ne briše, ne prepisuje i ne premješta | Saša, 06.11. |
| K2 | **Stanje „gotovo" se izračuna iz baze** (žigovi, košare, sidra), nikad iz posebnog filea | Saša, 06.11. |
| K3 | Nejasno ide u Excel (stupac `Delete?` + `Napomena`) umjesto zastavica `--brisi` / `--premjesti` | Saša, 06.11. |
| K4 | ZABA i RF **bez Delta Exporta** — alat čita bazu, kao Visa alat | Saša, 06.11. |
| K5 | **Opseg = PDF-ovi u korijenu `izvodi\`**; izvod koji je gotov `krug` sam premjesti u `Analizirani_izvodi\` (naša mapa, alati ionako čitaju cijelo stablo). `--izvod <ime>` za iznimku | Saša, 07.11. |
| K6 | **Sidro ZABA/RF iz izvoda upisuje `krug` sam** — samo kad je promet prozora izvoda ✓ u cent, iz **ispisanog** stanja s izvoda, na datum zadnje transakcije izvoda. Prvi upis u bazu mimo uvoza; na PROD-u ga pokreće Saša. Sidro s ekrana banke (kad izvoda nema) ostaje u appu | Saša, 07.11. |
| K7 | **Visa prije plaćanja:** `krug` ne radi Visa Excel nego kaže „plati X (Novi saldo)"; file tek kad je naplata na RF-u (Koka je upiše u traci) ⇒ jedan uvoz | Saša, 07.11. |
| K8 | **Gumb „Pokreni krug" i izvodi kroz app idu u oblak** (§7), ne `etracker://` — Koka mora moći sama ako laptopa nema, a isti put treba i drugom korisniku | Saša, 07.11. |
| K9 | **Jezgra bez putanja i bez ukucanih računa** — config istog oblika kakav će biti u `areas.settings` (§6), da se `krug` dade preseliti u oblak i otvoriti drugom korisniku bez prepisivanja | Saša, 07.11. |

---

## 2. Kako `krug` zna što je gotovo (K2)

Za svaki izvod u opsegu `krug` pusti **istu analizu kao alat** (bez upisa). Izvod je gotov kad analiza nema što
predložiti — **0 New · 0 Modify · 0 odluka** — i kontrola se slaže u cent. To je postojeće mjerilo „ponovni prolaz
= 0 · 0", pa je ponovljivost posljedica, ne dodatak.

| izvod | gotov kad | inače |
| --- | --- | --- |
| **MC** | svaka stavka sparena i ožigosana (`Izvod opis`), Σ košare dospijeća = UKUPNO s izvoda | Excel (ispravci, novi, odluke). Poslije: košara čeka traku 11. — čita se iz skupnog retka (`due.baskets[k].text`) i `Izvrsen` |
| **Visa** | isto + naplata na RF-u postoji; **datum naplate čita se iz baze** (redak iz trake), ne zadaje se | nema naplate ⇒ „Saša plati X do <dospijeće>", bez filea (K7). Na RF-u ±3 dana redak koji liči na naplatu, a nije ⇒ **stani i reci** (pravilo `visa_uvoz_izvoda`, jer drugi redak naplate dvaput miče saldo) |
| **ZABA / RF** | `promet_check` za prozor izvoda ✓ u cent **i** sidro na datum zadnje transakcije izvoda (ili kasnije) | ✓ bez sidra ⇒ `krug` upiše sidro (K6). ✗ ⇒ Excel (retci koji fale, krivo mjesto, odluke). ✗ bez prijedloga ⇒ **stani**: „Δ, traži na drugim izvodima istog mjeseca" (S161, S192) — sidro se tada ne upisuje |

**Svi izvodi u jednom prolazu** — jedan `load_db`, pa se odluke spoje:
- **jedan redak baze smije mijenjati samo jedan izvod**; traže li ga dva (S161: ZABA „višak" = Visa kupnja na krivom
  računu) ⇒ odluka, nikad dvije izmjene istog retka u jednom fileu;
- **višak jednog izvoda koji je par na drugom nije pitanje** (pravilo „filtrira se tek kad su svi izvodi obrađeni");
- redoslijed: kartični (MC, Visa) pa bankovni (ZABA, RF) — krivo mjesto se razrješava protiv oba.

**Seljenje (K5):** izvod je gotov ⇒ `krug` ga premjesti iz korijena u `Analizirani_izvodi\` i to kaže u izvještaju.
Mapa određuje samo *koje* izvode `krug` gleda, nikad *jesu li* gotovi; vrati li ih netko u korijen, `krug` ih
ponovo izmjeri i ponovo premjesti.

---

## 3. Excel s odlukama (K3)

Jedan file po pokretanju: `Za uvoz\krug_<YYYY-MM-DD_HHMM>.xlsx` (jedan uvoz za Koku — T1 je najskuplji korak).

```
A event_id | … | H leaf comment | atributi (žuto = mijenja se) | Delete? | Izvod        | Napomena
-----------+---+----------------+------------------------------+---------+--------------+----------------------------------
3f1a…      |   | Konzum 2/6     | Izvod opis, Datum naplate    |         | MC_2026-10   | ISPRAVAK — rata 2/6, žig
(prazno)   |   | Studenac       | Visa, 11,75, žig             |         | PBZVISA_2026-10 | NOVO — s izvoda; opis i Tip s retka ispod
8c02…      |   | Studenac       | (ništa)                      | [▼]     | PBZVISA_2026-10 | ODLUČI: ako je ovo ista kupnja kao redak
           |   |                |                              |         |              | iznad, odaberi DELETE. Ako nije, ostavi.
```

- Pisač je `visa_popravak.pisi()` (kol. G = autor retka iz baze, Tip/Podtip/Namjena izbornici, `provjeri()`),
  proširen stupcima **`Izvod`** i **`Napomena` iza `Delete?`**. Uvoz appa čita samo stupce iz `ATTRIBUTE LEGEND`
  (`colToAttr`, `excelImport.ts`) — oba stupca prolaze bez učinka, kao `Result`/`Changed` u izvještaju uvoza
  (`ANNOTATION_HEADERS`, `excelExport.ts`). ⚠ Provjeriti pravim parserom prije prvog uvoza (§5).
- **`Delete?` je izbornik (`DELETE` / prazno) i `krug` ga nikad ne popuni sam** — brisanje je nepovratno, a alat
  sam radi samo jasan slučaj (Saša, S194).
- **Svaka nejasna situacija ima isti oblik:** NOVI redak s izvoda (iznos, datum, žig banke; opis, Tip, Namjena
  prepisani s našeg retka) + naš STARI redak s ponudom DELETE. To je pravilo 1:N (`data-prep_tools/CLAUDE.md`:
  „bankini retci su kostur, Kokin dopunjava i nestaje"). Ne odluči li Koka, ostaju oba ⇒ kontrola sljedećeg
  `krug`a pokaže razliku, a stari redak dođe kao `DUPLIKAT?` s istom ponudom — neodlučeno se ne zatvara tiho.
  ⚠ Za redak koji miče saldo (ZABA/RF) to znači saldo dvaput dok Koka ne odluči — vidljivo na pločici (Δ prema banci).
- Redoslijed retka: po izvodu; unutar izvoda **ODLUČI → NOVO → ISPRAVAK** (odluke su jedini posao, idu gore).
- List `Pregled`: isti sadržaj kao izvještaj (za ispis).
- **Dvostruki uvoz** (stari pa novi file): slobodna minuta novog retka računa se **iz baze**, deterministički ⇒ isti
  redak u dva filea dobije istu minutu i drugi uvoz udari u koliziju (postojeća brana). Rub: promijeni li se baza
  baš tog dana između dva pokretanja, minuta se pomakne. Zato izvještaj kaže „uvozi samo najnoviji", a sljedeći
  `krug` takav duplikat prijavi.

---

## 4. Izvještaj

`Za uvoz\krug_<YYYY-MM-DD_HHMM>.html`, otvori se sam u pregledniku; prvi redak nosi bazu (`[PROD]` / `[TEST]`).

```
Mjesečni krug · 07.11.2026. 09:30 · [PROD]

ZA UVOZ (Koka): krug_2026-11-07_0930.xlsx
  U pregledu uvoza mora pisati: 5 New · 92 Modify · 0 Delete
  (ako odabereš DELETE u stupcu Delete?, Delete raste za toliko)
  Uvozi samo ovaj file — stariji krug_*.xlsx su zastarjeli.

ODLUKE U FILEU (2) — stupac Delete?
  Studenac 11,75 (Visa izvod 03.10.) — u bazi kao Mastercard/ZABA …

✓ GOTOVO
  MC_2026-10   54/54 potvrđeno · košara 11.11. 2.783,26 = izvod u cent
  ZABA_2026-10 promet ✓ · sidro 10.529,31 na 30.10. UPISANO (ispisano stanje)
⏳ ČEKA
  MC košara 11.11. — Koka u traci, 11.11. (iznos 2.783,26)
  Visa — Saša plati 1.751,12 („Novi saldo") do 12.11. → Koka u traci → pusti krug
  ZABA_2026-11 — izvod još nije stigao
  RF — bez izvoda za 10/2026; zadnje sidro 05.11. (ekran)
SLJEDEĆI KORAK: nakon uvoza pusti krug ponovo — mora javiti 0 New · 0 Modify.
```

---

## 5. Test

- **Zlatni test bez baze** (ponavlja se nakon svake izmjene alata, sekunde): snimka baze iz `data-prep_data/_backup/`
  kroz harness iz S173 (`fixdb.py` glumi `_db.rest`) + izvodi 10/2026 ⇒ brojke iz S192. Lokalno — izvodi su osobni
  podaci i ne idu u git ni u CI.
- **Studeni na TEST-u** (izmjereno 07.11., samo čitanje): MC košara 11.11. = 43 retka, **0 žigova**, svi `Planiran`
  ⇒ za MC TEST = stanje prije kruga. Visa košara 05.11. = 30 redaka, 0 žigova, ali na RF-u već stoji naplata
  **1.349,52** (ostatak testa trake T48, S194) dok izvod traži **1.751,12** ⇒ na TEST-u se Visa ne provjerava „kao u
  studenom" nego kao **„stani i reci"**. MC košara 11.10. ima žig na 22/55 (način iz S158) — zato opseg nije „zadnja
  dva mjeseca" (K5).
- **Očekivano** (S192 kao točan odgovor): MC **0 New · 54 Modify**, dvije kupnje 29./30.10. same u košaru 11.12. (T47);
  ZABA parking 1,60 kao krivo mjesto (T45; na TEST-u provjeriti postoji li redak); Visa: stani na 1.349,52.
  Zatim uvoz na TEST-u (Claude sam, uz backup TEST-a prije — memorija „run_manual_tests_myself_on_test") ⇒ drugi
  `krug` = MC gotov, 0 · 0.
- Prije uvoza: file kroz pravi parser uvoza (`Claude-temp_R/s173_mc/parse_import.mjs`) ⇒ pregled = OČEKIVANO.

---

## 6. Config jezgre (K9) — oblik budućeg `areas.settings.statements`

Jezgra ne zna imena računa ni Aree; dobiva ih iz configa. Do faze C to je Python rječnik u omotaču, istog oblika:

```python
STATEMENTS = {
  'area': 'Financije_all',
  'accounts': [
    {'racun': 'Kokin tekući ZABA', 'bank': 'zaba',
     'cards': [{'izvor': 'Mastercard', 'statement': 'zaba_mc'}]},
    {'racun': 'Sašin tekući RF', 'bank': 'rf',
     'cards': [{'izvor': 'Visa', 'statement': 'pbz_visa'}]},
  ],
}
```

- `bank` / `statement` imenuje **čitač izvoda** (danas četiri: ZABA, ZABA MC, PBZ Visa, RF) — jedini dio koji se
  piše iznova za svaku novu banku.
- Pravila specifična za račun (`RF_RULES`, `KLASA`, naknada 0,17) ostaju u kodu dok ne dobiju mjesto u bazi
  (BACKLOG „Financije za drugog korisnika").
- Autor novog retka (kol. G) = **vlasnik Aree iz baze** (`areas.user_id` → `profiles`, kao MC alat od S173), nikad konstanta.

---

## 7. Faze

| faza | što | kada |
| --- | --- | --- |
| **A** | jezgra (izvlačenje logike iz `visa_uvoz_izvoda.main`, `fill_from_izvod` MC/ZABA/RF protiv baze; CLI alata ostaje isti — regresija: isti ispis nad 08–10/2026 prije i poslije) → `krug.py` (razvrstač, opseg, jedan `load_db`, spajanje i sukobi, sidro K6) → pisač Excela → izvještaj + `krug.bat` + `Za uvoz` + seljenje → test §5 | S195, prije prosinačkog kruga (~01.–03.12.) |
| **B** | pločica **„Mjesečni krug"** na Overviewu — kontrolna lista iz podataka: košara MC/Visa (žigovi n/m, Σ prema naplati), zadnje sidro po računu, je li izvod mjeseca obrađen (bilješka sidra) | uz fazu C ili prvi deploy poslije A |
| **C** | **`krug` u oblaku** (K8): izvodi se dodaju **u appu** (Supabase Storage, zaseban spremnik `izvodi` — NE `event_attachments`, jer izvod pripada Arei i mjesecu, ne eventu; prava **samo vlasnik Aree**) → gumb „Pokreni krug" → Netlify funkcija → **GitHub Actions** (isti Python, ključ u secretima) → Excel i izvještaj u Storage → Koka ih otvori i uveze u appu. Otvoreno: RF je OCR ⇒ tesseract na runneru; provjera vlasništva prije pokretanja | poslije lokalnog Supabasea (Strategic Position) |

`etracker://` (gumb samo na Sašinom laptopu) **se ne gradi** (K8) — do faze C Saša pokreće `krug.bat` ručno.

---

## 8. Izvedeno i izmjereno (S195, faza A)

**Fileovi** (`data-prep_tools/Financije/`): `krug.py` (omotač: putanje, razvrstač, sidro, seljenje, Excel,
izvještaj) · `krug.bat` (PROD, dvoklik) · `_krug.py` (jezgra: stanje izvoda, veze, sukobi, sažetak) ·
`_krug_excel.py` (jedan file, jedan redak po `event_id`) · `_krug_izvjestaj.py` (HTML). Logika izvoda je
**izvučena** iz alata, ne kopirana: `visa_uvoz_izvoda.analiza`, `fill_from_izvod.mc_odluke(db=)`,
`zaba_odluke`, `rf_odluke`, `spojeni_retci`, `postojeci_iz_baze`, `klasificiraj`; CLI alata je isti
(regresija 14 slučajeva, ispis i fileovi identični).

**Što je mjerenje dodalo specu** (nije bilo u planu, a bez toga bi krug pitao Koku krivo):
- **pomaknut dan** — stavka izvoda i redak baze bez para, isti smjer i iznos, ≤ 3 dana, oba u prozoru izvoda ⇒
  isti redak (napomena, ne izmjena). ZABA_2026-09: parking 0,70 ×2 (07.09. / 09.09.); ZABA_2026-10: Zoran 94,47;
- **veza među izvodima** (§2) je izmjerena kao stvarna: Youtube 9,55 upisan kao `Racun` = MC stavka; Studenac
  11,75 u MC košari = Visa stavka (S192). Jasna veza = izmjena istog retka, kontrola obiju strana „poslije veza";
- **kontrola poslije uvoza** i za banku (app + novi retci ± premješteni) — ZABA_2026-10 Δ −360,10 je točno zbroj
  11 novih redaka i 9,55 koji odlazi;
- **sidro se upisuje tek kad je saldo pločice na dan izvoda = ispisano stanje**, ne samo promet ✓ — inače bi
  sidro sakrilo grešku stariju od izvoda;
- **TEST file nikad u Kokinu mapu**: TEST i `--suho` pišu u `data-prep_data/Financije/krug_lokalno/`;
- **minuta novog retka jedinstvena u cijelom fileu** — MC i Visa bi istog dana nezavisno dali 14:00.

**Studeni na TEST-u** (T-S195-5): 34 New · 73 Modify + 1 odluka ⇒ uvoz kroz app 34 · 73 · 1 (25 s) ⇒ drugi krug
3/3 gotovo + sidro ⇒ treći krug bez promjene. Harness (radni stol): `Claude-temp_R/s195/` — `regresija.py`,
`grane.py`, `krug_proba.py` (scenariji u memoriji), `gluma_traka.py`.
⚠ TEST nakon toga: MC/Visa/ZABA 10/2026 obrađeni, Visa naplata 05.11. = 1.751,12, sidro ZABA 01.11. Vraćanje:
`restore_db.py` sa snimkom `_backup/test/2026-11-07_1205`, ili `prod_to_test.py`.
