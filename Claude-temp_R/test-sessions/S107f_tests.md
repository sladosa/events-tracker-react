# S107f — testovi i radni koraci (2026-07-15)

Kontekst sesije: backfill `Datum naplate` IZVRŠEN (1631 redova); `Preimenovanja` sheet
kreiran u Review fileu (apply_rules.py dorada); UI fix za shortcut/skrivene atribute
(AttributeChainForm) na test-branchu. Detalji: `data-prep_tools/Financije/ENRICH_PLAN.md` §2d.

---

## T-S107f-1 — Kontrola backfilla `Datum naplate` (Excel, 2 min)

**Precondition:** `Financije_review_20260710_1448.xlsx` (backup postoji:
`*.pre-naplata-20260715_112019.xlsx`)

1. Otvori Review sheet, filtriraj `Izvor = Racun` → kolona `Datum naplate` mora biti
   popunjena i **jednaka `event_date`** (spot-check 3–4 reda, i neki stari iz 2023.)
2. Filtriraj `Izvor = Visa` → `Datum naplate` mora ostati **prazan** (220 redova)
3. Filtriraj `Izvor = Mastercard` → `Datum naplate` ima STARE vrijednosti (netaknuto)

**Fail:** bilo koji Visa/MC red promijenjen, ili Racun red s naplatom ≠ event_date.

---

## T-S107f-2 — Preimenovanja sheet: popuna + prvi apply_rules run (GLAVNI POSAO)

**Precondition:** Review file ZATVOREN u Excelu prije svakog pokretanja skripte.

### Korak 1 — pregledaj auto-prijedloge (sheet `Preimenovanja`)
Svaki red s komentarom "auto-prijedlog — PROVJERI":
- `T-com` → `Komunikacije_T-com (internet, MaxTv)`, `T-mobile` → `Komunikacije_T-mobile`
- `PP` → `PP (Posmrtna pripomoc)`; streaming (Youtube/Disney/HBOmax/Sky/Prime) → Tip `Zabava`
- **Per-osoba redovi** (Medical, Odjeća/obuća): 2 reda s `Racun uvjet` = `kokin` / `sasin`
  — provjeri da su parovi dobro raspoređeni (kokin → _Koka/Koka varijanta itd.)

Ako se s prijedlogom ne slažeš — jednostavno prepiši `Novi Tip`/`Novi Podtip`.

### Korak 2 — popuni 4 para bez prijedloga
| Stari par | Redova | Tvoja odluka |
|---|---|---|
| Zdravlje / Sportski rekviziti | 29 | → `Sport_Koka`? (upiši Tip pod kojim je u Taksonomiji) |
| Zdravlje / PassSport | 12 | ? |
| Informatika / AudibleSasa | 11 | ? |
| Informatika / Saša projekti | 9 | ? |

**Pravila igre:** `Novi Tip`+`Novi Podtip` moraju biti TOČNO kako pišu u Taksonomija
sheetu (copy-paste!). Ostaviš li red prazan → ti redovi idu na N/A reset (original se
čuva u `Tip_O`/`Podtip_O`, oznaka `TAKS:`). Redovi se čitaju odozgo — prvi koji
odgovara (stari par + Racun uvjet) pobjeđuje.

### Korak 3 — očisti seed primjere u `Pravila` sheetu ⚠ VAŽNO
Obriši 4 seed reda (ili ih zamijeni pravim pravilima). Probni run je pokazao da bi
`mirovinsk → Mirovina/Koka` uhvatio i TVOJU mirovinu, a `holding` matcha i "D životno"
preko izvod opisa. Prazan Pravila sheet je OK — run će napraviti samo
preimenovanja + validaciju (prava pravila radimo zajedno u sljedećem koraku).

### Korak 4 — dry run pa pravi run
```
data-prep_tools\Financije\run.bat apply_rules.py --dry
```
Očekivano: "Preimenovanja: N valjanih mappinga"; "Bi se preimenovalo: ~135+" (više ako
si popunio 4 para); "Bi se resetiralo: ostatak do 196"; snapshot najava. Ako brojke
imaju smisla:
```
data-prep_tools\Financije\run.bat apply_rules.py
```
Backup nastaje automatski (`*.pre-rules-*`).

### Korak 5 — kontrola u Excelu
1. Nove kolone `Tip_O`/`Podtip_O` na kraju (original prije svega)
2. Filter `Alternativa / nap.` sadrži `PREIM:` → preimenovani redovi; **Pouzdanost
   mora ostati VISOKA/SREDNJA** (ne NEMA!)
3. Filter sadrži `TAKS:` → resetirani na N/A, Pouzdanost NEMA
4. Dropdown Tip/Podtip na par preimenovanih redova — vrijednost više nije crvena (CF)

**Fail:** preimenovani red izgubio Pouzdanost; reset reda koji je imao valjan par;
ukupno preimenovano+resetirano ≠ 196 (± redovi koje si ručno mijenjao u međuvremenu).

### Korak 6 — javi mi brojke (preimenovano / resetirano / eventualne čudne slučajeve)

---

## T-S107f-3 — UI fix: shortcut + skriveni atributi (test-branch, localhost)

**Bug (uočen na PROD/main):** Shortcut Strength → 12 polja skriveno "na defaultu",
uključujući `Strength_type` o kojem ovisi `exercise_name`; expand kategorije Activity
izgledao "mrtav" (svi atributi na defaultu → prazan panel). Fix na test-branchu (S107f).

**Precondition:** `npm run dev` na test-branchu; Fitness area sa shortcutom Strength
(ili bilo koji leaf s default vrijednostima + depends_on atributom).

1. Otvori Add Activity preko shortcuta Strength
2. **`Strength_type` dropdown mora biti vidljiv ODMAH** (jer `exercise_name` ovisi o
   njemu) — bez klika na "Show all"
3. `exercise_name` dropdown nudi opcije po `Strength_type` vrijednosti; promjena
   `Strength_type` resetira `exercise_name` (staro ponašanje, ne smije se pokvariti)
4. Expand kategorije **Activity** (▶): ako su svi atributi na defaultu, prikazuje se
   poruka *"All fields hidden (at default values) — use "Show all" below"* umjesto praznine
5. Stringovi su engleski: "N fields hidden (at default)" / "Show all" / "Hide fields
   at default"
6. "Show all" → sva polja vidljiva; "Hide fields at default" → natrag
7. Regresija bez shortcuta: običan Add Activity na leaf bez defaulta — ništa skriveno,
   nema gumba

**Fail:** Strength_type i dalje skriven; expand kategorije i dalje prazan; hrvatski stringovi.

**Deploy napomena:** fix je na test-branchu; na PROD (main) ide tek kad izričito
zatražiš deploy — do tada na mobitelu koristi "Prikaži sve" workaround.
