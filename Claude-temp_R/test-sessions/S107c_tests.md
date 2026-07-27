# S107c — Testovi (2026-07-12)

Feature: **klasifikacijski alati za Financije review Excel** (Python, `data-prep_tools/Financije/`).
NEMA app koda — samo data-prep alati + docs. Handoff za sljedeću sesiju:
`data-prep_tools/Financije/ENRICH_PLAN.md`.

**Zajednički preduvjeti za sve testove:**
- Review file: najnoviji `Financije_review_*.xlsx` u `data-prep_data/Financije/` — **ZATVOREN u Excelu**
- Pokretanje iz repo roota: `data-prep_tools\Financije\run.bat <skripta.py> [--dry]`
- Svaki alat radi backup prije snimanja (`*.pre-sync-*` / `*.pre-rules-*` / `*.pre-izvod-*`) —
  ako nešto krene krivo, samo preimenuj backup natrag.

---

## T-S107c-1 — sync_taxonomy.py ✅ (potvrđeno 2026-07-12, "ok radi tool")

1. Editiraj `Taksonomija` sheet (dodaj/preimenuj Tip ili Podtip) → snimi → zatvori Excel.
2. `run.bat sync_taxonomy.py`
3. **Očekivano:** konzola ispiše sve Tipove s podtipovima; otvori Excel → Tip dropdown
   sadrži izmjene, Podtip dropdown se prilagođava, krivi Podtip pocrveni.

## T-S107c-2 — apply_rules.py (Pravila sheet)

1. `run.bat apply_rules.py`
   - **Očekivano (1. put):** poruka "Kreiran Pravila sheet" — otvori Excel, sheet `Pravila`
     (iza Taksonomije) ima header, 4 primjera i sive upute.
2. Upiši vlastito pravilo, npr. `Ključne riječi: printink | Tip: Informatika | Podtip: Saša projekti`.
   Snimi, zatvori Excel.
3. `run.bat apply_rules.py --dry`
   - **Očekivano:** "Bi se promijenilo: N redova" + breakdown po pravilu + primjeri redova.
     0 promjena na ručno klasificiranim redovima (dira SAMO Tip prazan ili N/A).
4. `run.bat apply_rules.py` (bez --dry)
   - **Očekivano:** isti brojevi + "Snimljeno. Backup: ...". U Excelu: filtriraj
     Pouzdanost=`PRAVILO` → pogođeni redovi imaju Tip/Podtip iz pravila i `pravilo #N` u
     koloni Alternativa / nap.
   - **Fail:** promijenjen neki red koji je već imao Tip ≠ N/A.
5. Validacija: upiši pravilo s nepostojećim Tipom → **Očekivano:** warning "Tip ne postoji
   u Taksonomiji — preskočen", ostala pravila normalno rade.

## T-S107c-3 — enrich_from_izvoda.py (ZABA uzorak)

Preduvjet: `data-prep_data/Financije/izvodi/` sadrži `ZABA_2024-01.pdf` (+ RF PDF-ovi).

1. `run.bat enrich_from_izvoda.py --dry`
   - **Očekivano:** RF fileovi preskočeni uz objašnjenje (nema tekst-sloja);
     `ZABA_2024-01.pdf: 18 transakcija`; `Matchano: 15/18`; 3 nematchana ispisana
     (Mastercard lump 926,52 + 2× Triglav 33,98 — očekivano).
2. `run.bat enrich_from_izvoda.py` (bez --dry)
   - **Očekivano:** "Snimljeno. Backup: ...". U Excelu: Review dobio kolone
     **`Izvod opis`** i **`Izvod file`** (na kraju, iza source_key); 15 redova iz
     prosinca 2023 (Kokin račun) popunjeno; npr. red s Napomenom `T-com` ima
     Izvod opis `...Hrvatski Telekom d.d. ...`.
   - **Fail:** promijenjena bilo koja postojeća kolona (Tip/Podtip/Napomena...).

## T-S107c-4 — lanac izvod → pravilo

1. Nakon T-S107c-3: u `Pravila` dodaj pravilo koje postoji SAMO u izvod tekstu,
   npr. `kamata & prekoracenje | Domaćinstvo | Bankovni troškovi`.
2. `run.bat apply_rules.py --dry`
   - **Očekivano:** pogođen red "Redovna kamata na prekoračenje" (Napomena mu je prazna —
     match je došao iz `Izvod opis` kolone).
   - **Napomena:** generičke riječi (`zaba`, `eu`, `on-line`) su LOŠI keywordi — bankovni
     opisi sadrže "on-line bankarstvom (m-zaba)" pa bi palile posvuda. Koristiti merchant
     imena ili `&` kombinacije.

---

## Verificirano ovom sesijom (na scratchpad kopiji review filea)

- sync_taxonomy: named ranges + DV + CF regenerirani, ručne vrijednosti netaknute, DV formula 79 znakova
- apply_rules: 4 reda "Mirovinski*" (koje je regex pipeline promašio) → Mirovina/Koka; write-path OK
- enrich: 15/18 match; kontra-test potvrdio da se `Izvod reda`/`Izvod file` kolone NE pretražuju
  (inače bi "zaba"/"koka" keywordi lažno matchali sve)
- pdfplumber instaliran u OBA venva (events-tracker + Tools za run.bat)
