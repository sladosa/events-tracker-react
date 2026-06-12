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

## Faza 3 — Excel Automations sheet (generalni engine)

Novi sheet u Activities xlsx (ili zasebni `Automations.xlsx`).
Strukturirana tablica — **ne DSL**, nego fiksne kolone:

| Area | Category | Rule name | Trigger | Action | Count source | Date source | Date map | Override attrs | Comment template |
|---|---|---|---|---|---|---|---|---|---|
| Financije | Transakcija | Generiraj rate | na_rate=true | create_events | broj_rata | izvor_placanja | Mastercard:11, Visa:3 | status=Planiran\|iznos=iznos/count | {napomena} · rata {i}/{count} |
| Fitness | Snaga | Tjedni plan | ponavljaj=true | create_events | broj_tjedana | — | weekly:7 | status=Planiran | {tip} tjedan {i}/{count} |

**Trigger sintaksa:** `slug=vrijednost` (npr. `na_rate=true`, `status=Planiran`)
**Action:** `create_events` (jedini tip za sada)
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
| Faza 1 — Python rata tool | ⬜ NEXT | ~30 min rada, odmah koristivo za Koku |
| Faza 1 — Post-Finish modal (web) | ⬜ | Nakon Python provjere logike |
| Faza 2 — Auto-comment template | ⬜ | UI + `categories.settings` JSONB |
| Faza 3 — Excel Automations sheet | ⬜ | Nakon Faze 1+2 validacije |
| Faza 4 — Training parser | ⬜ | Čeka `trening.xlsm` analizu |
