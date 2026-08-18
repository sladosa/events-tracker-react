# S107u — testovi (2026-08-02)

**Tema:** testiranje S107t koda u appu (svih 7 prošlo) + tri buga nađena usput i popravljena
+ `disable_save_plus` u Structure roundtripu.

**Preduvjeti:**
- `cd C:\0_Sasa\events-tracker-react` pa `npm run dev:test`
- login `sasasladoljev59@gmail.com`, TEST baza (`xtnbhmojmffjelsqejpw`)
- `Financije_all` area uvezena iz `Financije_all_structure_20260801_172202.xlsx`

---

## Rezultat sesije

| ID | Status |
| --- | --- |
| T-S107t-1 … T-S107t-7 | ✅ svih 7 (v. `S107t_tests.md`) |
| T-S107u-1 | ✅ |
| T-S107u-3 | ✅ (oba smjera + stari file) |
| T-S107u-4 | ✅ |
| T-S107u-5 | ✅ |
| T-S107u-2 | ⬜ backlog (ne blokira) |

---

## T-S107u-1 — nova Area više ne gubi `comment_template`

**Bug:** `dbAreas` je snapshot učitan **prije** importa, a `findOrCreateArea` novu Areu nije
gurao u njega ⇒ za Areu stvorenu u istom runu i §8 (`comment_template`) i §9 (`Automations`)
rade `{ ...existingArea?.settings }` nad `undefined`, pa §9 piše preko §8. Leaf
`comment_template` je preživio (§9 ne dira kategorije) pa se u appu nije vidjelo — samo je
Area panel imao prazno polje.

**Koraci:**
1. Obriši `Financije_all` → Structure import `Financije_all_structure_20260801_172202.xlsx`
2. Structure → ⋮ na `Financije_all` → Edit

**Očekivano:** „Auto-comment template" = `{racun}/{tip}/{podtip}`, Preview
`[racun]/[tip]/[podtip]`; import javlja Areas 1 / Categories 1 / Attributes 15 /
Automation rules 2 / skipped 0

**Rezultat:** ✅

---

## T-S107u-3 — `disable_save_plus` u roundtripu

**Novo:** kolona **`DisableSavePlus`** (kol. T, vidljiva, DV `TRUE/FALSE`) na **Area** retku
`Structure` sheeta. §8 sad piše `comment_template` i `disable_save_plus` **jednim** upisom.

**Semantika:** kolone nema u fileu = postavka se **ne dira**; prazna ćelija = `FALSE`.

**Koraci:**
1. Area panel → uključi `Disable "Save+"` → Save
2. Structure → Export → ćelija `T8` = `TRUE` (kolona vidljiva bez unhidea)
3. U fileu `TRUE` → `FALSE` → spremi → Structure import
4. Kontrola u tri točke: Area panel (kvačica off), Add Activity (gumb „✓ Save +" prisutan),
   novi export (`T8` = `FALSE`)
5. Obrnuti smjer: `FALSE` → `TRUE` → import → kvačica on, „Save +" nestao
6. Uvezi **stari** `Financije_all_structure_20260801_172202.xlsx` (nema tu kolonu)

**Očekivano:** korak 6 **ne mijenja** postavku (ostaje uključena)

**Rezultat:** ✅ oba smjera + odsutnost kolone ne briše

⚠ **Zamka pri testiranju:** kvačica u panelu je lokalno stanje forme — čim je klikneš, prikazuje
tvoj klik, ne bazu, sve dok ne pritisneš Save. Za provjeru stvarnog stanja koristi **Add Activity
(je li „Save +" tu)** ili novi export, ne panel.

---

## T-S107u-4 — panel više ne prikazuje staru vrijednost nakon importa

**Bug (dva sloja):**
1. `onImported()` u `StructureImportModal` zvao se samo uz `totalCreated > 0 ||
   updated.attributes > 0`. Uvoz koji dira **isključivo** postavke (`comment_template`,
   `disable_save_plus`, automatike) vraća sve nule ⇒ **nema refetcha**, `nodes` ostaju stari.
2. `StructureNodeEditPanel` inicijalizirao je `disableSavePlus`/`commentTemplate` samo kroz
   `useState(...)`, čiji se inicijalizator pri re-renderu istog panela ne zove.

**Zašto je to više od prikaza:** Save iz takvog panela piše **cijeli** `settings` objekt iz stare
snimke (`{ ...node.area.settings }` nosi i `automations`) ⇒ tek uvezena rata konfiguracija bi
tiho nestala. Lost update bez ijedne poruke.

**Koraci:**
1. U izvezenom fileu promijeni samo `T8` → import
2. **Bez reloada** otvori Area panel

**Očekivano:** kvačica odgovara novom stanju; Add Activity se slaže

**Rezultat:** ✅

---

## T-S107u-5 — brojač „Settings updated"

**Bug:** §8 promjene nisu ulazile ni u jedan brojač ⇒ modal je javljao „Nothing to import — all
data already exists" iako je upravo prepisao postavke.

**Uz to popravljeno:** leaf grana §8 pisala je `categories.settings` **bez dirty checka** — svaki
uvoz je prepisivao svaki leaf. Dodan check (+ `settings` u SELECT kategorija).

**Koraci:** uvoz filea u kojem je promijenjena samo `T8`

**Očekivano:** redak **„Settings updated: 1"**, ostali brojači 0, poruka „Import completed
successfully" (ne „Nothing to import")

**Rezultat:** ✅ (Settings updated 1, Automation rules 2, ostalo 0)

---

## T-S107u-2 — backlog, NIJE popravljeno (ne blokira)

**Nalaz:** `groupAttributes` uzima atributske vrijednosti (`Default`, `Unit`, `Description`,
`Sort`) s **prvog retka** grupe. Generator (`make_financije_all_structure.py`) piše `*` redak
**zadnji**, app export piše `*` redak **prvi** ⇒ atributski `default_value` ovisi o redoslijedu
redaka.

**Posljedica:** `Status.default_value` se klacka `Izvrsen` ↔ `null` ovisno o tome uvozi li se
generirani file ili app export. **Bezopasno** — `default_map` (koji stvarno puni `Status` po
Izvoru) ostaje netaknut, i konvergira nakon jednog kruga (EXPORT vs DB = 0 dirty).

**Predloženi fix:** ignorirati `Default` na retku koji ima `DependsOn` — takav default semantički
pripada u `default_map`, ne na atribut. Time atributski default prestaje ovisiti o redoslijedu.

**Kako je izmjereno:** simulacija `groupAttributes` + `buildValidationRules` u Pythonu nad
generiranim fileom i nad exportom, usporedba s DB stanjem (service role read).

---

## Napomene

- `Financije_all` se smije brisati i ponovo uvoziti koliko god puta
- Provjera stvarnog stanja baze bez UI-ja: service role key iz `.env.local`,
  `GET /rest/v1/areas?select=name,settings&name=eq.Financije_all`
- Modalov „Automation rules: N" je brojač **pročitanih** pravila iz sheeta, ne zapisanih;
  stvarni upis bi bio `automations.areasUpdated`, koji se u modalu ne prikazuje
