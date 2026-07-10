# Post-Finish Automation — Design & Implementation Plan

Cilj: nakon što korisnik klikne **Finish** u Add Activity, sustav može automatski:
- generirati buduće evente (rate, plan treninga...)
- prefillati leaf comment iz vrijednosti atributa

---

## Arhitektura

| Kontekst | Gdje živi | Kada |
|---|---|---|
| Bulk/historijska obrada | Python skripta u `data-prep_tools/` | Offline, output = import xlsx |
| Runtime (web app) | Netlify funkcija u `netlify/functions/` | Post-Finish, direktni Supabase INSERT |
| Konfiguracija pravila | Excel "Automations" sheet + `area.settings` JSONB | Jednom po Areai, import/export |

**Redoslijed razvoja:**
1. Python skripta (brzo, odmah koristivo za historijske podatke)
2. Iz skripte → definiramo točne kolone za Excel Automations sheet
3. Netlify funkcija (runtime verzija iste logike)

---

## Faza 1 — Rata tool (PRIORITET)

**Zašto prvo:** Koki omogućuje unos transakcija na mobilnom i generiranje "Pogled prema naprijed" (svi Planirani eventi sortirani po datumu i računu).

### Python skripta: `data-prep_tools/Financije/generate_rata.py`

**Ulaz:** exported Activities xlsx (ili direktno iz baze via Supabase)

**Logika:**
- Za svaki event gdje `Na rate? = true` i `Broj rata > 1`:
  - `iznos_po_rati = Iznos / Broj rata`
  - Dan naplate ovisi o `Izvor plaćanja`:
    - `Mastercard kartica` → 11. u sljedećem mjesecu
    - `Visa kartica` → 3. u sljedećem mjesecu
  - Generira N eventa s:
    - `Status = Planiran`
    - `Iznos = iznos_po_rati`
    - `comment = "{Napomena} · rata {i}/{N}"`
    - `Na rate? = false` (rata sama po sebi nije na rate)
    - ostali atributi kopirani s originala (Račun, Izvor plaćanja, Tip...)

**Izlaz:** standardni import xlsx (isti format kao ostale Financije skripte)

### Post-Finish modal u web app (Netlify funkcija — faza 2)

Nakon Finish, app detektira `na_rate = true` i prikazuje modal:
```
Kreirati rate?
Iznos po rati: 150.00 EUR (450.00 / 3)
→ 2026-07-11  rata 1/3  150.00 EUR
→ 2026-08-11  rata 2/3  150.00 EUR
→ 2026-09-11  rata 3/3  150.00 EUR
[Kreiraj rate]   [Preskoči]
```

Detalji u `data-prep_data/Financije/FINANCIJE_MODEL.md` → sekcija "Korak 3".

---

## Faza 2 — Auto-comment template

Svaka leaf kategorija može imati `comment_template` string (pohranjeno u `categories.settings` JSONB — novi field, ili u `area.settings`).

**Format:** `"{napomena} ({tip}) — {iznos} EUR"`
- Vitičaste zagrade = slug atributa
- Evaluira se na Finish → prefilla comment polje
- Korisnik može override-ati prije Save

**UI:** jedno text polje u Structure Edit panelu na leaf kategorijama ("Auto-comment template").

**Primjeri:**
- Financije/Transakcija: `"{napomena} ({tip})"`
- Fitness/Snaga: `"{tip} — {trajanje} min"`

---

## Faza 2b — `set_attribute` pravila (derive attribute) — SPEC (2026-07-10, odobreno)

**Motiv (Financije, D1 dopuna):** `Datum naplate` je obavezan atribut, ali deterministički izračunljiv
iz event_date + `Izvor`: kartica → fiksni dan sljedećeg mjeseca; `Racun`/`Cash` → = event_date.
Korisnik ga nikad ne tipka. Mehanizam je generičan — treći user s trećom karticom = drugačija mapa, nula koda.

**Konfiguracija** — `area.settings.automations.attribute_rules` (JSONB lista, uz postojeći `rata`):

```json
{
  "automations": {
    "attribute_rules": [
      {
        "action": "set_attribute",
        "target_slug": "datum_naplate",
        "map_slug": "izvor",
        "date_map": { "Mastercard": "next:11", "Visa": "next:3", "Racun": "same", "Cash": "same" }
      }
    ]
  }
}
```

**Vokabular vrijednosti u `date_map`** (mali, fiksni — NE izrazi/DSL; širi se po potrebi):
- `same` — target = event_date (session date)
- `next:N` — N-ti dan sljedećeg mjeseca od event_date (month-overflow guard kao u `generateRataDates`)

**Semantika:**
- **Add Activity — live prefill:** čim korisnik odabere vrijednost `map_slug` atributa (ili promijeni
  session date), target polje se auto-popuni. Korisnik može override-ati; čim ga ručno edita,
  auto-update za taj event prestaje (form state flag `autoFilled`). Ručna vrijednost se NIKAD ne gazi.
- Map vrijednost bez ključa u `date_map` → pravilo se preskače (target ostaje kako jest).
- **Edit Activity: ne evaluira se** (povijesni zapisi se ne diraju automatikom).
- **Excel import: ne evaluira se** (import nosi svoje vrijednosti; migracija ih računa u Pythonu).
- Više pravila u listi = neovisna, svako sa svojim target/map slugom.

**Editing surface — ✅ implementirano (S107b):** `Automations` sheet u Structure Excel roundtripu:
- **Export** (`structureExcel.ts`): sheet s kolonama `Area | RuleName | Action | TargetAttr | MapAttr |
  DateMap`; jedan red po pravilu; DateMap format `Mastercard=next:11 | Visa=next:3 | Racun=same`
  ('=' odvaja ključ od pravila jer pravilo samo sadrži ':'); sheet se uvijek piše (i prazan je
  template) + help blok ispod podataka.
- **Import** (`structureImport.ts` § 9): redovi ZAMJENJUJU sva set_attribute pravila navedene Aree;
  Aree koje se ne spominju ostaju netaknute; validacija (target/map slug mora postojati u toj Arei,
  DateMap sintaksa) — nevaljani redovi se preskaču i broje u "Automation rules skipped".
  Stariji exporti bez sheeta = no-op. SQL ostaje fallback za ručni setup.

**Implementacija — ✅ gotovo (S107b, 2026-07-10):** `src/lib/attributeRules.ts` (čisti util);
`AttributeRuleConfig` u `database.ts`; live-prefill useEffect u `AddActivityPage`
(`autoFilledValues` ref — sve odluke izvan setState updatera, StrictMode-safe);
E2E `e2e/tests/S107b_set_attribute.spec.ts` (T-S107b-1/2 PASS).

---

## Faza 3 — Excel Automations sheet (generalni engine)

Novi sheet u Activities xlsx (ili zasebni `Automations.xlsx`).
Strukturirana tablica — **ne DSL**, nego fiksne kolone:

| Area | Category | Rule name | Trigger | Action | Count source | Date source | Date map | Override attrs | Comment template |
|---|---|---|---|---|---|---|---|---|---|
| Financije | Transakcija | Generiraj rate | na_rate=true | create_events | broj_rata | izvor_placanja | Mastercard:11, Visa:3 | status=Planiran\|iznos=iznos/count | {napomena} · rata {i}/{count} |
| Fitness | Snaga | Tjedni plan | ponavljaj=true | create_events | broj_tjedana | — | weekly:7 | status=Planiran | {tip} tjedan {i}/{count} |
| Financije_all | Transakcija | Datum naplate | (uvijek) | set_attribute | — | datum_naplate ← izvor | Mastercard:next:11, Visa:next:3, Racun:same, Cash:same | — | — |

**Trigger sintaksa:** `slug=vrijednost` (npr. `na_rate=true`, `status=Planiran`)
**Action:** `create_events` | `set_attribute` (Faza 2b)
**Date map:** `IzvorPlacanjaOpcija:dan` (npr. `Mastercard:11`)
**Override attrs:** `slug=vrijednost|slug2=izraz` (pipe-separator)
**Izraz:** `iznos/count`, `iznos*0.1` (jednostavna aritmetika, reference na attr slugove)

Import ovog sheeta sprema pravila u `area.settings.automations` JSONB.

---

## Faza 4 — Training parser (zasebna, složenija tema)

Compact notacija → eventi (parser) i eventi → compact notacija (inverz).

```
3x/tjedan: Pon(Snaga 60min), Sri(Cardio 30min), Pet(Snaga 60min)
→ 12 eventa kroz 4 tjedna počevši od 2026-06-16
```

Inverz: korisno za **pregled i edit plana na visokoj razini** — umjesto row-by-row u tablici.
Dizajn tek kad vidimo strukturu trening tablice (`trening.xlsm` analiza).

---

## Status

| Faza | Status | Napomena |
|---|---|---|
| Faza 1 — Python rata tool | ✅ | `generate_rata.py` |
| Faza 1 — Post-Finish modal (web) | ✅ | `RataModal.tsx` + `rataAutomation.ts`; config u `area.settings.automations.rata` |
| Faza 2 — Auto-comment template | ✅ S95 | `commentTemplate.ts`; roundtrip kroz Structure sheet |
| Faza 2b — set_attribute pravila | ✅ S107b | `attributeRules.ts` + live prefill u AddActivityPage; T-S107b-1/2 Playwright PASS |
| Faza 3 — Excel Automations sheet | ◐ djelomično (S107b) | `Automations` sheet u Structure exportu/importu pokriva `set_attribute` retke; rata konfiguracija još ide SQL-om |
| Faza 4 — Training parser | ⬜ | Čeka `trening.xlsm` analizu |
