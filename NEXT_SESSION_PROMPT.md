> Pisano protiv `3c261de` (docs sesija, paralelno) + commita **S173** koji nosi ovaj file („S173: MC alat …“).
> **`main` = `ca496cb` (deploy 17.10., S172).** S173 je samo Python alati — nema deploya ni migracije.
> **PROD baza:** S173 nije pisala ništa (sve mjereno offline nad backupima i `--dry` nad TEST-om).
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md` i `data-prep_tools/CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S173 (2026-10-18)

> **Ukratko (S173):** MC izvod sada sam razlikuje ispravak od novog retka i prijavljuje duplikate, rate nasljeđuju razvrstavanje svog plana, a naknade za rate idu u svoj plan i generiraju se unaprijed — izmjereno nad stanjem od 2. listopada, alat sam proizvodi ono što je S158 složio ručno, u cent.

---

# DIO 1 — netehnički (za Sašu)

## Gotovo (S173)
- **MC izvod (~2.11.) bez ručnog slaganja filea.** Alat iz Delta Exporta i PDF-a sam:
  ispravi postojeći redak kad je iznos malo drukčiji (tečaj, cent, redak bez opisa), prijavi
  duplikate (i cijeli dvostruki plan rata), novu ratu razvrsta po njezinom planu, naknadu 1,32
  stavi uz njezinu ratu i doda buduće naknade koje fale. Na kraju kaže **Σ košare = izvod u cent**
  i **koliko New / Modify / Delete** Koka mora vidjeti u pregledu uvoza.
- Dokaz: nad stanjem baze od 2. listopada alat daje točno ono što smo u S158 složili ručno
  (košara 55 / 1.189,34), a pravi uvoz appa čita file s istim brojkama.

## Paralelno (docs sesija, 18.10.) — ⚠ neverificirano iz ove sesije
- Pospremanje `docs/` (`9e7806a`, `8629f59`, `3c261de`): `FINANCIJE_STATUS`, `DELTA_WINDOW_SPEC`,
  stari backlog i audit u `_archive/`; nov `docs/FINANCIJE_PREGLED.md` (karta dokumenata);
  `CLAUDE.md` § Strategic Position s putom (MC alat do 11.11. → F5 AreaSettings → trening →
  Financije template); `BACKLOG.md` je jedini backlog. Ova sesija to nije čitala ni provjeravala.

## Što treba od tebe
1. **~2.11. MC_2026-10** (T-S173-2..4, koraci u `docs/sessions/tests/S173_tests.md`):
   razvrstač → Delta Export ZABA → `fill_from_izvod.py <delta> --mc MC_2026-10.pdf --dry` →
   odluke `--brisi=<id8>` → bez `--dry` → Koka uvozi (brojke iz zadnjeg retka ispisa) → ponovni
   prolaz `0 New · 0 Modify` → 11.11. traka Potvrdi.
   ✅ `docs/FINANCIJE_PROCES.md` §5 „Mastercard izvod“ prepisan na novi tok (docs sesija, 18.10.) —
   to je trajni mjesečni postupak; `S173_tests.md` nosi očekivane brojke za studeni.
2. Iz S172, i dalje otvoreno: **Koku pitaj** lista bez iznosa od 14.10.? (T-S168-4) · `+` iz prve?
   (T-S154-2) · T-S145-3 zatvoriti? · studeni: Visa traka (T-S170-9), MC traka (T-S171-5), prvi MC
   plan s ostatkom na zadnjoj rati (T-S168-3), ti kao grantee (T-S156-5), izvodi listopad
   (T-S156-7, T-S170-12, T-S161-3, T-S158-5 korak 1), RF N/A (T-S169-6), T-S169-7, T37 Intercar.
3. Odluka iz Backloga: provjera košara u „Review" sheetu.

---

# DIO 2 — tehnički (za Claudea)

## Stanje
- **`_mc_spajanje.py`** (nov): `spari()` odluke (rate po planu = trgovac + N + mjesec početka;
  Kokina rata bez `Rate?` po `n/N` u komentaru; naknade zamjenjive, buduće po dospijeću; `uskladi()`
  za ostalo; T13 s dokazom razvrstavanje > isti dan; duplikat plana POSLIJE svih rata),
  `izmjene()` (žig samo u praznu ćeliju, `Status` samo prazan ⇒ `Planiran`, `Tip` sparenog se ne dira).
- **`fill_from_izvod --mc`:** `mc_odluke()` (izvještaj, novi retci sa slobodnom minutom U BAZI,
  e-mail vlasnice Aree u kol. G) + `upisi_mc()` (ispravci NA retke sekcije po `event_id`, `DELETE`,
  redak kojeg nema dopiše cijeli iz baze). `--brisi=<id8>` samo za prijavljeno.
- **`uskladi_izvod.parse_mc`:** `kupnja`/`ukupno`/`kupnja_ref` iz zagrade, `za_ref` na naknadi
  (33/33 MC izvoda: zagrada = naknada, svaka referenca nađe ratu).
- **Harness** `Claude-temp_R/s173_mc/` (ignoriran): `regresija.sh` iz korijena — 6 provjera offline nad
  `_backup/test/2026-10-07_0836` (prije S158) i `2026-10-17_1013` (poslije). Ovisi o tim snimkama
  (lokalno + `D:`). `synth_nov.py` = sintetički studeni (12 tvrdnji, sabotaže ruše 4 i 2).
- TEST (= PROD 17.10.) košara 11.11. = 35 / 2.264,35 (rate 15 / 493,90, naknade 4, kupnje 16).

## Otvoreno — kod (po prioritetu)
1. **Uz MC_2026-10 (~2.11.):** pratiti T-S173-2; ako se pojavi `NEJASNO` za očito isti trošak —
   dodati `--par=<id8>:<iznos>` (sada je jedini izlaz `--brisi` starog retka).
2. **T17** (pravila po riječi: `GLOVO`, `PARKING`/`GARAZ`) — u MC_2026-09 su Glovo i VPA ostali N/A;
   Visa ima `KLASA` — zajedničko mjesto za oba alata (provjera unatrag prije, S164).
3. **§5 `FINANCIJE_PROCES.md` (MC naredbe)** prepisati na novi tok (`uskladi_izvod` korak 1 više ne
   treba; `rate_alat --only b` samo uz `⚠ NOV PLAN`). Dogovoriti s docs sesijom tko piše.
4. `MOŽDA KRIVO MJESTO` (`--premjesti`) kao Visa — MC još nema.
5. T23 u appu: rata modal za MC plan novog načina ne stvara naknade.
6. Iz S172: Excel uvoz `default_map` kad se roditelj promijeni (BACKLOG vrh) · T-S172-4 (E2E
   S104-3/S107-3 izmjeriti) · „Review" sheet (čeka Sašu) · F5 · delta: retci koje `fill_from_izvod`
   dopiše ispod sekcije nisu u grupi ni u bojanju · ↗ ne vraća `attrFilter`.
7. ~~Zaglavlje korijenskog `CLAUDE.md` na S173~~ ✅ (docs sesija, 18.10.).
