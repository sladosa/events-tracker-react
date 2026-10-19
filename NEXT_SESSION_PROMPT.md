> Pisano protiv `463aca4` (S174) + commita **S175 docs** koji nosi ovaj file.
> **`main` = `ca496cb` (deploy 17.10., S172).** S174 ima promjenu appa (uvozni guard, `6720662`) — **nije na PROD-u**.
> **PROD baza:** ni S174 ni S175 nisu pisale ništa. S175 je samo čišćenje dokumenata (bez koda).
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md` i `data-prep_tools/CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S175 (2026-10-19)

> **Ukratko (S175):** otvorenih test sesija bilo je jedanaest, a većina je čekala isti događaj — prvi mjesečni krug u studenom — pa su ti testovi sažeti u tri (MC, Visa, ZABA) i jedno pitanje Koki, i sada su otvorene samo dvije: S174 i S175.

---

# DIO 1 — netehnički (za Sašu)

## Gotovo
- **S175:** PENDING je očišćen. Umjesto 11 test sesija i 21 otvorenog testa sada su **2 sesije i 7 testova**.
  Studeni krug je jedan popis: `docs/sessions/tests/S175_tests.md`.
- **S174:** uvoz razvrstavanja pita za „potvrđeno stanje" samo kad se mijenja bankino polje (nije na
  PROD-u do deploya). 31 pravilo po trgovcu: starija povijest ZABA 70 / RF 90 prijedloga.

## Što treba od tebe — sad
1. **T-S174-2 (TEST, lokalno, ~5 min):** uvoz `na_razvrstavanje_kokin_tekuci_zaba_202401-202509_20261018_1628.xlsx`
   ⇒ pregled `0 · 70 · 0` **bez** kutije potvrđenog stanja; isti file s promijenjenim iznosom jednog
   Racun retka ⇒ kutija pita za 1. Koraci: `S174_tests.md`.
2. **Deploy** kad hoćeš (guard je jedina app promjena od 17.10.). Bez deploya uvoz u T-S174-3 i dalje pita (smiješ kvačnuti).
3. **T-S174-3 (PROD):** starija povijest s Kokom (ZABA) i ti (RF), pa **T-S174-5** (Nenini retci, tek poslije).
4. **T-S175-4:** jedno pitanje Koki (tekst u `S175_tests.md`): lista bez iznosa / `+` dvaput — od sredine listopada?
5. **Odluka iz S174:** `PARKING` (12/13) kao pravilo? `GLOVO` ostaviti ručno?

## Što treba od tebe — studeni (`S175_tests.md`)
- **~03.–11.11. T-S175-2 Visa:** traka (ti kao grantee: usporedba bez gumba), Koka upiše naplatu, `visa_uvoz_izvoda`.
- **~02.11. → 11.11. T-S175-1 MC:** `fill_from_izvod --mc`, Koka uvozi, ponovni prolaz 0/0, 11.11. traka.
- **ZABA_2026-10 T-S175-3:** `fill_from_izvod --zaba`, MC naplata 11.10. se ne smije dodati drugi put.

---

# DIO 2 — tehnički (za Claudea)

## Stanje
- **S175:** samo dokumenti. 10 PENDING sekcija (S145, S154, S156, S158, S161, S168, S170–S173) preseljeno
  u `DONE_HISTORY` uz svoje sesije; detaljni fileovi u `Claude-temp_R/test-sessions/archive/` (naslovi
  `✅ S175 — sažeto u T-S175-x`). T-S172-4 je sada stavka u BACKLOG-u (E2E padovi S104-3/S107-3);
  T-S145-3 prati BUG-S145-BOOLEDIT u CLAUDE.md. Audit: S174 3 ⬜, S175 4 ⬜, 0 neslaganja.
- **Guard (`6720662`):** `isBankKey(spec, key)` u `confirmedRowEdit.ts` je jedino pravilo; uvoz ga
  zove kroz `importBankChanges(changes, categoryId, attrByCatName, spec)` u `analyzeUpdates`
  (`confirmed.bank`). `useAreaDashboard` vraća i `automations`; `ExcelImportModal` gradi
  `bankFieldSpec({dashboard, automations})` i ima ga u dep listi `analyzeFile`. Bez `bank` ⇒ staro ponašanje.
- **`pravila_trgovca.py` (`568b7c5`):** `PRAVILA` (31), `kljuc_trgovca(tekst, izvor)` (kartica =
  `uvezi_transu.kljuc` bez adrese; račun = bez uvoda naloga i IBAN-a), `po_pravilu(tekst, izvor)`.
  `razvrstaj_na.iz_pravila` = 4. ključ (kartica: iza trgovac+iznos; račun: iza `Presedani`);
  `pisi(boje={j: 'E4DFEC'})`; `--provjera` ispisuje po pravilu.
- **Radni stol** `Claude-temp_R/s174_pravila/` (ignoriran): `fixdb.py` + `_snap.py` (PROD snimka
  18.10.), `skupi.py` → `ulaz.json`, `predlozi_ai.py` → `ai_pravila.json`, `provjeri_pravila.py` →
  `provjera.json`, `lista_md.py`, `gen_modul.py`, `na_fix.py`. Novo pravilo = isti put, nikad ručni
  upis bez brojanja.

## Otvoreno — kod (po prioritetu)
1. **`po_pravilu` u `fill_from_izvod` (MC/ZABA/RF) i `visa_uvoz_izvoda`** — **prije studenog**, da
   T-S175-1/2 već dobiju prijedloge (Glovo/VPA iz MC_2026-09). Redoslijed isti: postojeći
   rječnici/presedan prvo. Prije: provjera unatrag na tim tokovima (S164). Visa `KLASA` i
   `uvezi_transu.RUCNO` možda preseliti u isti modul (jedno mjesto). ⚠ Ne smije pomaknuti
   T-S173-1 harness (`Claude-temp_R/s173_mc/regresija.sh`) osim u `Tip`u.
2. Ako Saša odluči: `\bparking\b` (12/13) u `PRAVILA`.
3. **F5 — sheet `AreaSettings`** (Strategic Position korak 2; MC alat iz koraka 1 je gotov, čeka samo studeni).
4. Iz S173: `--par=<id8>:<iznos>` ako MC_2026-10 da `NEJASNO` · `MOŽDA KRIVO MJESTO` za MC · T23 u appu
   (rata modal bez naknade).
5. Iz S172: Excel uvoz `default_map` kad se roditelj promijeni (BACKLOG vrh) · E2E padovi (BACKLOG) ·
   „Review" sheet · delta: retci koje `fill_from_izvod` dopiše ispod sekcije nisu u grupi ni bojanju ·
   ↗ ne vraća `attrFilter`.
6. Uvozni guard još **ne** pita za redak sa žigom (`Izvod opis`) bez sidra — Edit pita. Svjesno izvan
   opsega; otvoriti samo ako se pokaže potreba.
