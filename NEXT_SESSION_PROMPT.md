> Pisano protiv `568b7c5` (S174 alati) + commita **S174 docs** koji nosi ovaj file.
> **`main` = `ca496cb` (deploy 17.10., S172).** S174 ima promjenu appa (uvozni guard, `6720662`) — **nije na PROD-u**.
> **PROD baza:** S174 nije pisala ništa (sve mjereno offline nad backupom `prod/2026-10-18_1157`; TEST samo čitan).
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md` i `data-prep_tools/CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S174 (2026-10-18)

> **Ukratko (S174):** uvoz razvrstavanja više ne traži kvačicu „potvrđeno stanje" (pita samo kad se mijenja bankino polje, kao Edit), a 31 pravilo po trgovcu — AI ga je predložio, baza prebrojala, Saša odobrio — udvostručilo je prijedloge za stariju povijest: ZABA 38 → 70, RF 29 → 90, uz 98 % pogodaka unatrag.

---

# DIO 1 — netehnički (za Sašu)

## Gotovo (S174)
- **Uvoz razvrstavanja više ne pita „X redaka unutar POTVRĐENOG stanja"** kad se mijenja samo
  Tip/Podtip (lažnih 9 iz RF uvoza). Pita i dalje za iznos, datum, račun, Izvor, tekst izvoda.
  ⚠ To je promjena **appa** — na PROD-u radi tek nakon deploya (dotad kutija i dalje iskače; smiješ je kvačnuti).
- **Pravila po trgovcu (T17):** 31 pravilo koje si odobrio (npr. sve INA/Petrol na Mastercardu = C5
  gorivo, parkirališta/garaže, Bmove, Dubravica, ljekarne na Visi…). U fileu za razvrstavanje su
  **lila** — prijedlog iz pravila, ne iz povijesti tog trgovca; razlog piše u listu `Pregled`.
  Unatrag pogađaju 144 od 147.
- **Starija povijest (2024-01…2025-09)** sada ima prijedlog za ZABA **70** od 257 i RF **90** od 384
  (prije 38 i 29). Ostatak su većinom jednokratni trgovci s putovanja — za njih nema pravila.

## Što treba od tebe
1. **T-S174-2 (TEST, lokalno, ~5 min):** uvoz `na_razvrstavanje_kokin_tekuci_zaba_202401-202509_20261018_1628.xlsx`
   ⇒ pregled `0 · 70 · 0` **bez** kutije potvrđenog stanja; pa isti file s promijenjenim iznosom
   jednog Racun retka ⇒ kutija pita za 1. Koraci: `docs/sessions/tests/S174_tests.md`.
2. **Deploy** kad hoćeš (guard je jedina app promjena od 17.10.) — inače T-S174-3 uvoz i dalje pita.
3. **T-S174-3 (PROD):** starija povijest s Kokom (ZABA, od najvećeg iznosa) i ti (RF) — file s PROD-a,
   `--preuzmi`, uvoz pod Kokinim računom. Očekivane brojke u `S174_tests.md`. T37 (Intercar duplikati) prije uvoza.
4. **T-S174-5 (PROD, TEK POSLIJE uvoza T-S174-3):** Nenini retci — dvije naredbe iz
   `Claude-temp_R\s174_pravila\nena_naredbe.ps1` ⇒ Koka uvozi `0 · 36 · 0` (Transfer / Nena, prije
   25.07.2026.) i `0 · 5 · 0` (Nena's funds: pričuva od 18.08. + uplate 7.000/5.000).
   Usput (S174, nakon rituala): pravilo `^miele` (4/4) dodano; iz pravila plina maknut Međimurje-plin (Nenin).
5. **Odluka:** tvoja pravila iz T17 izmjerena — `PARKING` 12/13 (dodati? koristi mjesečnom krugu, npr.
   `VPA PARKING`); `GLOVO` povijest ne potvrđuje (Kave 1 · Hrana 1 · Temu 1) — ostaviti ručno?
6. Iz S173, i dalje: **~2.11. MC_2026-10** (T-S173-2..4) · Koku pitaj: lista bez iznosa od 14.10.?
   (T-S168-4) · `+` iz prve? (T-S154-2) · studeni trake (T-S170-9, T-S171-5), T-S168-3, T-S156-5,
   izvodi listopad (T-S156-7, T-S170-12, T-S161-3, T-S158-5). Odluka: provjera košara u „Review" sheetu.

---

# DIO 2 — tehnički (za Claudea)

## Stanje
- **Guard (`6720662`):** `isBankKey(spec, key)` u `confirmedRowEdit.ts` je jedino pravilo; uvoz ga
  zove kroz `importBankChanges(changes, categoryId, attrByCatName, spec)` u `analyzeUpdates`
  (`confirmed.bank`). `useAreaDashboard` vraća i `automations`; `ExcelImportModal` gradi
  `bankFieldSpec({dashboard, automations})` i ima ga u dep listi `analyzeFile`. Bez `bank` ⇒ staro ponašanje.
- **`pravila_trgovca.py` (`568b7c5`):** `PRAVILA` (31), `kljuc_trgovca(tekst, izvor)` (kartica =
  `uvezi_transu.kljuc` bez adrese; račun = bez uvoda naloga i IBAN-a), `po_pravilu(tekst, izvor)`.
  `razvrstaj_na.iz_pravila` = 4. ključ (kartica: iza trgovac+iznos; račun: iza `Presedani`);
  `pisi(boje={j: 'E4DFEC'})`; `--provjera` ispisuje po pravilu.
- **Radni stol** `Claude-temp_R/s174_pravila/` (ignoriran): `fixdb.py` + `_snap.py` (PROD snimka
  18.10.), `skupi.py` → `ulaz.json`, `predlozi_ai.py` (Opus 5.5, high, 0,70 $) → `ai_pravila.json`,
  `provjeri_pravila.py` → `provjera.json`, `lista_md.py` → `PRAVILA_PRIJEDLOG.md`, `gen_modul.py`,
  `na_fix.py` (razvrstaj_na nad snimkom). Novo pravilo = isti put, nikad ručni upis bez brojanja.
- S169 arhiviran (sekcija u `DONE_HISTORY`, file u `Claude-temp_R/test-sessions/archive/`).

## Otvoreno — kod (po prioritetu)
1. **`po_pravilu` u `fill_from_izvod` (MC/ZABA/RF) i `visa_uvoz_izvoda`** — retci koje mjesečni krug
   ne zna razvrstati (Glovo/VPA iz MC_2026-09). Redoslijed isti: postojeći rječnici/presedan prvo.
   Prije: provjera unatrag na tim tokovima (S164). Visa `KLASA` i `uvezi_transu.RUCNO` možda preseliti
   u isti modul (jedno mjesto).
2. Ako Saša odluči: `\bparking\b` (12/13) u `PRAVILA`.
3. Iz S173: `--par=<id8>:<iznos>` ako MC_2026-10 da `NEJASNO` · `MOŽDA KRIVO MJESTO` za MC · T23 u appu
   (rata modal bez naknade).
4. Iz S172: Excel uvoz `default_map` kad se roditelj promijeni (BACKLOG vrh) · T-S172-4 · „Review"
   sheet · F5 (Strategic Position korak 2) · delta: retci koje `fill_from_izvod` dopiše ispod sekcije
   nisu u grupi ni bojanju · ↗ ne vraća `attrFilter`.
5. Uvozni guard još **ne** pita za redak sa žigom (`Izvod opis`) bez sidra — Edit pita. Zasad
   svjesno izvan opsega (sidro je ono što uvoz čuva); otvoriti samo ako se pokaže potreba.
