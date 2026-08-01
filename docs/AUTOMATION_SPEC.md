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
Sve rate ostaju na danu kupnje — razlikuje ih datum naplate.
rata 1/3   naplata 11.07.2026.   150.00
rata 2/3   naplata 11.08.2026.   150.00
rata 3/3   naplata 11.09.2026.   150.00
[Kreiraj rate]   [Preskoči]
```

**⚠ Model datuma promijenjen u S107t** (poništava raniju D1 iznimku za rate):

- **sve rate dijele `event_date` = dan kupnje.** Kartična kupovina na rate ponaša se
  identično kao obična kartična kupovina — jedna kupnja, samo više datuma naplate.
- **`Datum naplate`** (`charge_date_slug`) nosi raspored: 11. odn. 3. u svakom sljedećem
  mjesecu. Set_attribute pravilo popuni ga za prvu ratu; rata automatika ga za rate 2..N
  pregazi.
- **`session_start` +1 min po rati** — `useActivities` grupira listu po
  `user+category+session_start`, pa bi se bez pomaka cijela kupovina slijepila u **jedan**
  redak liste.
- **`Rata br`** (`index_slug`) = 1..N; iznos svake rate = ukupno / N.
- Originalni (uneseni) event se briše — rate nose sve podatke, pa nema stavke s punim
  iznosom koja bi se dvaput brojala.
- Posljedica: stanje na budući datum traži pogled sortiran po `Datum naplate`, ne po
  `event_date`.

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

## Faza 3 — Excel Automations sheet — ✅ gotovo (S107b + S107t)

`Automations` sheet u Structure exportu/importu. Strukturirana tablica — **ne DSL**,
fiksne kolone; `Action` određuje koje se kolone čitaju:

| Kolona | `set_attribute` | `rata` |
|---|---|---|
| `Area` | ✔ | ✔ |
| `RuleName` | opis | opis |
| `Action` | `set_attribute` | `rata` |
| `TargetAttr` | slug atributa koji se puni | slug koji prima **datum naplate** te rate |
| `MapAttr` | slug čija vrijednost bira pravilo | slug po kojem se bira dan naplate |
| `DateMap` | `vrijednost=same` / `vrijednost=next:N` | `vrijednost=DAN` (DAN = **broj** 1–31) |
| `TriggerAttr` | — | boolean slug koji pali modal |
| `CountAttr` | — | slug s brojem rata |
| `AmountAttr` | — | slug s iznosom |
| `OverrideAttrs` | — | `slug=vrijednost \| ...` nametnuto svakoj rati |
| `CommentAttr` | — | slug za prefiks komentara (neobavezno) |
| `IndexAttr` | — | number slug koji prima redni broj rate (1..N) |

Primjer (`Financije_all`):

```
Area           Action          TargetAttr     MapAttr         DateMap
Financije_all  set_attribute   datum_naplate  izvorplacanja   Racun=same | Cash=same | Mastercard=next:11 | Visa=next:3
Financije_all  rata            datum_naplate  izvorplacanja   Mastercard=11 | Visa=3
               TriggerAttr=rate  CountAttr=brojrata  AmountAttr=isplata
               OverrideAttrs=status=Planiran  IndexAttr=rata_br
```

**Semantika importa:** zamjenjuje navedene automatike **svake Aree koja se pojavi** u sheetu.
**Odsutnost ne briše** — stariji export bez `rata` kolona ne može pobrisati postojeću rata
konfiguraciju. Najviše **jedna** `rata` konfiguracija po Arei; višak se preskače uz warning.
Svaki slug se provjerava protiv atributa te Aree — mrtvo pravilo se ne uvozi.

Import sprema u `area.settings.automations` JSONB
(`attribute_rules: [...]` + `rata: {...}`).

⚠ Preostala roundtrip rupa: **`export_profiles`** (ključ kolone je
`attr:Area||CatPath||AttrName` pa profil ne preživi promjenu imena aree ni atributa).

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
| Faza 3 — Excel Automations sheet | ✅ S107t | `set_attribute` (S107b) + **`rata`** (S107t) prolaze Structure roundtripom; rata više ne treba SQL |
| Faza 4 — Training parser | ⬜ | Čeka `trening.xlsm` analizu |
