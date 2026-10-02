> Pisano protiv commita **S158** na `test-branch` (zadnji S158 commit: ovaj, iza `02a03ca`; `main` = `e8afdac`, deploy S157 — S158 nije dirao app).
> ⚠ Ako `git log` pokazuje noviji commit od S158, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S158 (2026-10-02)

---

# DIO 1 — netehnički (za Sašu)

## Što je napravljeno

- **Dokument procesa je prepisan:** [`docs/FINANCIJE_PROCES.md`](docs/FINANCIJE_PROCES.md) —
  model u jednoj stranici, **tri aktivnosti** (unos · potvrda naplate · usklađenje s izvodom),
  §4 popis onoga što škripi, §5 naredbe. **§4 je sada JEDINI popis otvorenog posla Financija**
  (T1–T32): u njega su preseljene i financijske stavke backloga (C1, C5, PBZVISA, RF `Izvod
  opis`…, puni tekst §8). U backlogu je ostao samo pokazivač i K0–K5.
- **Razvrstač sada preimenuje izvod i u Kokinoj OneDrive mapi** (`Obavijest o učinjenim
  troškovima.pdf` → `MC_2026-10.pdf`) — ništa ne briše, zauzeto ime ne prepisuje.
- **Rujanski MC izvod je obrađen i uvezen:** košara za **11.10. = 55 stavki / 1.189,34 €**, točno
  kao izvod. Nađena i riješena dva duplikata (Plitvice, Hlace), Audible upisan u dolarima, 15 rata
  starih planova koje nitko nije upisao.
- **Buduće MC rate su u bazi** (37 rata + 7 naknada): košara 11.11. = 499,18, 11.12. = 434,05.
  Traka 11. u mjesecu više ne čeka izvod da bi znala za rate.
- **Alati su ujednačeni:** jedna naredba za bazu (`$env:ET_TARGET='prod'`), PDF samo imenom,
  Visa uvijek `PBZVISA_`, mapa `data-prep_data/Financije/` pospremljena (ništa obrisano).

## Što dolazi — po datumu

1. **~05.–07.10. — Visa izvod za rujan.** Javi kad stigne. To je sesija za **Visa buduće rate**
   (v. dolje, korak 1). Naknadu `0,17` na RF-u upiši kao `Bankovni troškovi`, opis `Naknada`.
2. **11.10. — Koka u traci:** upiše iznos i dan s ekrana banke. Ako je banka skinula 1.189,34 →
   **✓ slaže se → Potvrdi**. Prije toga zatvori i ponovo otvori karticu na mobitelu.
   (T-S158-1 = T-S156-6.)
3. **Kad stigne ZABA izvod** — §5 „ZABA"; T-S156-7 i T-S158-5.
4. Koka/ti: obrađeni PDF u OneDriveu → podmapa `Obrađeno` (prijedlog T25, vaša odluka).

## Daljnji koraci — prijedlog (Saša je tražio jasan mjesečni algoritam umjesto sesije svaki mjesec)

**Načelo:** razdvojiti **rutinu** od **razvoja**. U mjesečnom krugu se alati **ne mijenjaju** —
što zapne, ide na popis §4. Jednom mjesečno, kad se krug zatvori (~15.), jedna sesija održavanja
uzme vrh popisa. Tako svaki mjesec ne postaje novi projekt.

1. **Visa buduće rate (uz Visa izvod, ~05.–07.10.).** Nisu napravljene jer Visa nema stalan dan
   naplate (5. je najčešći, ali i 4., 6., 7.). Plan: generirati 19 rata (7 planova) s danom **5.**
   kao procjenom — `visa_uvoz_izvoda` ionako upisuje **stvarni dan** kad izvod stigne. ⚠ Uvjet:
   `visa_uvoz` mora prepoznati generiranu ratu (nema `Izvod opis`), inače bi je dodao drugi put —
   isti kvar koji je danas uhvaćen u `rate_alat`. Zato rate + rujanski izvod u **istoj** sesiji:
   generiraj → `visa_uvoz` dry run → mora ih spariti, ne dodati.
2. **Mjesečni algoritam kao alat, ne kao sjećanje:** `mjesec.py` — jedna naredba koja samo čita i
   kaže **što je sljedeće**: koji PDF čeka u inboxu, koji izvod nije obrađen, stanje košara (Σ vs
   naplata), ima li planova bez budućih rata, `N/A` redaka, koliko je staro zadnje sidro po računu.
   Ti pokreneš `mjesec.py` i napraviš ono što piše; §5 dokumenta se svede na tablicu koraka.
3. **Jedna naredba po izvodu** (`obradi_izvod.py`, T4 + T13–T19 + T23 + T24): prepozna vrstu,
   napiše gotov uvozni file (ispravci malih pomaka umjesto duplikata, duplikati prijavljeni,
   rate klasificirane po prethodnoj rati, naknade, `Status` ostaje `Planiran`) i kaže očekivane
   brojke pregleda. **Test je spreman:** rujanski MC slučaj ima poznat točan odgovor (17 novih,
   5 ispravaka, 1 duplikat) — alat ga mora reproducirati.
4. **App (zasebno, traži deploy):** T12 Σ košare u delta sheetu po jednom dospijeću, T22 rata
   modal za MC (ostatak na zadnjoj rati), Visa u traku (~05.11.).

Ciljni mjesečni krug kad je 1–3 gotovo: **izvod stigne → `razvrstaj` → `obradi_izvod` → Koka uveze
→ 11. traka Potvrdi** (+ `mjesec.py` kad nisi siguran gdje si).

---

# DIO 2 — tehnički (za Claudea)

## Stanje grana i baza

`main` = `e8afdac` (deploy S157). `test-branch` = S157 ritual + S158 (samo Python alati i docs,
**bez promjene u `src/`**). PROD podaci promijenjeni uvozima (Saša kao Koka): `MC_2026-09_uvoz.xlsx`
(17 novih / 6 izmjena / 1 brisanje), `rate_2026-10_B.xlsx` (37), `naknade_rata_2026-10.xlsx` (7);
Kokin dupli plan Plitvice (3 retka) obrisan u appu. TEST = kopija PROD-a od **01.10.** (prije svega
ovoga) — za test nad današnjim stanjem: `backup_db.py --env test` → `prod_to_test.py --apply`.

## Novo u S158

- `_db.py`: `target()` (ET_TARGET, krivo ime pada), `cat_transakcija()` (kategorija po imenu),
  `load_env('test')` → `.env.local` + traži service ključ (bio anon ⇒ RLS bez `Financije_all`).
- `_izvodi.py` (novo): `svi`/`nadji`/`put` — cijeli `izvodi/` osim `duplikati/`.
- `uskladi_izvod`, `rate_alat`: `--env` zadano `target()` (bili `prod`!). `uskladi_izvod --koka`
  opcionalno. `fill_from_izvod`: PDF imenom, `--presedan` zadano iz `ET_TARGET`, regex
  `\x08RATA` → `\bRATA` (T24). `visa_uvoz_izvoda`, `visa_kosare`, `make_saldo_anchors`,
  `pregled_stanja` (izlaz `Financije/izlazi/`) na `_izvodi`. `kosara_naplate.py` → `Obsolete/`.
- `rate_alat.plans()`: ključ (trgovac, N, mjesec početka, iznos); `prolaz_b` prepoznaje generirane
  rate; `slobodne_minute` lokalno + dijeljeno; zadnja rata `~`.
- PDF-ovi: `PBZVIZA_2026-07/08` → `PBZVISA_`; `MC_2026-09` u `Analizirani_izvodi/`.
- CLAUDE.md: S145 pravilo ispravljeno (Visa prva / MC zadnja rata), zamka „Analizirani" zatvorena,
  ET_TARGET vrijedi za sve alate. `data-prep_tools/CLAUDE.md`: blok „Rate i MC izvod (S158)".

## Otvoreno / neverificirano

- **T24 higijena:** 38 MC rata bez `Rate?`/`Rata br` (12 iz 02.10.); `rate_alat --only a` nudi
  91 ispravak (i Visa, mnogo Sašinih redaka ⇒ „fix as owner"). Nije pušteno.
- **T-S158-2:** prepoznaje li `uskladi_izvod`/`fill_from_izvod` generirane MC rate u studenom
  (sparivanje po iznosu unutar košare — trebalo bi; neizmjereno). Zadnje rate s `~` mogu odstupati
  za cent ⇒ isplivaju kao par „ZA UVOZ" + „PITANJA" (T13).
- **Visa listopad:** 12 redaka `Datum naplate` 03.10. + 20 na 05.10. — `visa_uvoz` poravna.
- `DOSPJELO_SPEC` još navodi Visa `text: "PBZCard d.o.o."` i D4 — zastarjelo, ispraviti s Visom.
- 2 zastarjela MC plana iz 2025. (Bauhaus 8/12, Inter Cars 2/6) — rupa u analizi, ne u saldu.
- Uvozni fileovi su u `C:\Users\Saša\Downloads\` (izvan repoa); skripte kojima su složeni su u
  scratchpadu sesije (nestaju) — logika je opisana u `DONE_HISTORY` § S158.
