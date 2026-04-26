# Faza 10e — Smart Import (Multi-User Excel Import)

**Status:** Spec — potvrđen, spreman za implementaciju  
**Grana:** `collab`  
**Kontekst:** BUG-2 — importanje Excel fajla koji sadrži granteeove evente duplicira ih pod owner user_id

---

## 1. Problem koji rješavamo

Excel fajl koji exporta **owner** sadrži kolonu G (User/email) s mixed redovima:
- Redovi s owner emailom (npr. `sasa@example.com`)
- Redovi s grantee emailom (npr. `supruga@example.com`)

Trenutni import **ignorira kolonu G** i upisuje sve redove pod `userId` pozivatelja → grantee eventi se dupliciraju pod owner-ovim user_id.

### Koji scenariji postoje

| Tko importa | Što fajl sadrži | Trenutno | Željeno |
|---|---|---|---|
| Owner | Samo owner-ovi eventi | OK | OK (bez promjene) |
| Owner | Mixed: owner + grantee | **BUG** — grantee eventi upisani pod owner | Skip ili "Import as mine" |
| Grantee (write) | Samo grantee-ovi eventi | OK | OK (bez promjene) |
| Grantee (write) | Mixed: owner + grantee | **BUG** — owner eventi upisani pod grantee | Skip tuđih redova |
| Grantee (read) | Bilo što | Blokirano u UI (nije moguće) | — |

---

## 2. Konkretni primjeri

### Primjer A — Owner importa mixed fajl (najčešći bug)

Excel fajl (exportan dok je owner gledao shared Area):

| event_id | Area | Category_Path | event_date | session_start | created_at | User (G) | comment |
|---|---|---|---|---|---|---|---|
| abc-111 | Fitness | Trening > Snaga | 2026-04-01 | 07:00 | … | sasa@test.com | OK |
| abc-222 | Fitness | Trening > Snaga | 2026-04-02 | 07:00 | … | supruga@test.com | Njezin trening |
| abc-333 | Fitness | Trening > Cardio | 2026-04-03 | 08:00 | … | sasa@test.com | — |

Owner (`sasa@test.com`) importa ovaj fajl.

**Trenutno ponašanje:** abc-111, abc-222, abc-333 svi se upisuju pod `sasa@test.com` → abc-222 je duplikat pod krivim user_id.

**Željeno ponašanje (default — SKIP):**
- abc-111 → normalan import (owner-ov event)
- abc-222 → **SKIP** (tuđi red — User email ≠ moj email)
- abc-333 → normalan import (owner-ov event)

**Željeno ponašanje (opt-in — IMPORT AS MINE):**
- abc-222 → novi event_id, upisan pod `sasa@test.com`
- Original abc-222 (supruga@) ostaje netaknut u DB

### Primjer A.1 — Owner editira vlastite redove u mixed fajlu

Owner exporta mixed fajl, editira vrijednosti atributa ili leaf comment na **vlastitim** redovima, pa reimportira.

**Željeno ponašanje:** vlastiti redovi koji imaju `event_id` → UPDATE (kao i dosad). Tuđi redovi → SKIP ili "Import as mine". Nema razlike u tretmanu vlastitih redova — radi normalno.

---

### Primjer B — Grantee importa mixed fajl (edge case)

Supruga (`supruga@test.com`) exporta isti fajl dok gleda shared Area i reimportira.

**Željeno ponašanje:**
- Redovi s `sasa@test.com` → **SKIP**
- Redovi s `supruga@test.com` → normalan import

---

### Primjer C — Single-user fajl (backwards compatibility)

Fajl exportan **prije** Faze 10a (nema User kolone G, attr kolone počinju od H umjesto I).

**Problem:** Breaking change u S43 — stari fajlovi nisu kompatibilni. Ne fixa se u 10e, samo osigurati jasnu grešku.

---

### Primjer D — Fajl s praznom User kolonom

Kolona G postoji ali je u nekim redovima prazna.

**Željeno ponašanje:** Prazna G kolona → tretira se kao owner-ov red (konzervativno, backwards-compatible).

---

## 3. "Import as mine" — opt-in za reconciliaciju podataka

### Zašto

Owner može htjeti napraviti **čistu kopiju** svih podataka (vlastiti + grantee) pod jednim user_id — npr. za finalnu arhivu ili analizu. Ovo je opt-in jer kreira privremene duplikate.

### Preview panel u modalu

```
Pronađeno: 47 redova
  ✅ Tvoji eventi:    38 (importat će se)
  ⏭ Tuđi eventi:     9  (što učiniti?)
     └─ supruga@test.com: 9 redova

  ○ Preskoči (sigurno, default)
  ● Importaj kao moji (novi event_id, moj user_id)
     ⚠ Originali ostaju u bazi — možeš ih obrisati ručno

[Nastavi]  [Odustani]
```

Ako nema tuđih redova (`foreignRowCount = 0`) → ovaj korak se preskače, modal ide direktno na apply.

### "Import as mine" tehničke napomene

- Tuđi red dobiva **novi UUID** kao `event_id` (ne koristi originalni)
- `user_id` = `currentUserId` (importer)
- `session_start` ostaje isti → collision detection se primjenjuje normalno
- Originalni tuđi eventi u DB ostaju **netaknuti**
- Tuđi `event_id` se **ne prosljeđuje u delete logiku** — samo vlastiti event_ids

---

## 4. "Clean Area" workflow (reconciliacija bez RLS promjena)

Preporučeni workflow za finalnu čistu bazu podataka kad dvije strane dijele Area:

```
1. EXPORT mixed Area (npr. "Fitness")
   → fajl ima col G: sasa@ i supruga@

2. IMPORT AS MINE (opt-in u 10e)
   → svi eventi sada i pod sasa@, originali ostaju
   → privremeni duplikati postoje

3. EXPORT opet s filterom na "Fitness" Area
   → sada su svi sasa@ redovi vidljivi

4. EDIT u Excelu (ručno):
   a) Autofilter col G → zadrži samo sasa@ redove (makni stare originale)
   b) Ispravi vrijednosti, komentare po potrebi
   c) Obriši sve event_id-ove (col A) → INSERT novi, ne UPDATE stari
   d) Promijeni col B (Area) iz "Fitness" u "Fitness_Clean"

5. STRUCTURE: kreiraj "Fitness_Clean" Area s istom hijerarhijom
   → Structure Export → preimenuj Area u Excelu → Structure Import
   → ista struktura kategorija, novi Area (bez evenata)

6. IMPORT korigiranog Activities fajla
   → category path-ovi se razriješe pod "Fitness_Clean"
   → čisti eventi pod sasa@ u novom Area

7. REVIEW zajedno (owner + grantee)
   → potvrda da je sve ispravno

8. RENAME za sigurnu zamjenu:
   a) Rename "Fitness"       → "Fitness_OLD"
   b) Rename "Fitness_Clean" → "Fitness"
   → Constraint: ne mogu istovremeno postojati dvije Areas s istim imenom
      → sekvencijalno: prvo preimenuj stari, pa novi

9. DELETE "Fitness_OLD" (s backup downloadom — S27 funkcionalnost)
   → tek kad si siguran, nema žurbe
```

**Sve operacije u koraku 5–9 rade s postojećim alatima** (Structure Export/Import, Activities Import, Rename u Structure Edit, Delete s backup). Jedina nova stvar je korak 2 ("Import as mine").

---

## 5. Predloženi pristup implementacije

### Korak 1 — Detekcija User kolone u `parseExcelFile`

- Pročitati kolonu G (col index 7, 1-based) kao `rowEmail` za svaki red
- Proslijediti `currentUserEmail` kao argument u `parseExcelFile`

### Korak 2 — Klasifikacija redova

Za svaki parsed red:
```
if (rowEmail && rowEmail !== currentUserEmail)
  → označi kao FOREIGN
  → ako je mode = 'skip'       → preskoči
  → ako je mode = 'import_as_mine' → generiraj novi event_id, user_id = currentUserId
```

### Korak 3 — Summary preview u `ExcelImportModal`

Novi `confirm-users` state (isti pattern kao `confirm-structure` u S32):
- Prikazuje se samo kad `foreignRowCount > 0`
- Radio buttons: Skip / Import as mine
- "Nastavi" prosljeđuje odabranu opciju u `applyImportChanges`

### Korak 4 — Apply

- `applyImportChanges` prima sve redove s flagovima
- FOREIGN+skip redovi se ignoriraju
- FOREIGN+import_as_mine redovi ulaze kao INSERT (novi ID, currentUserId)
- Vlastiti redovi rade normalno (UPDATE ako ima event_id, INSERT ako nema)

---

## 6. Gdje se mijenja kod

| Fajl | Promjena |
|---|---|
| `src/lib/excelImport.ts` | `parseExcelFile` dobiva `currentUserEmail` arg; čita col G; vraća `foreignRowCount` + `foreignEmailsSummary` u `ParseResult` |
| `src/lib/excelTypes.ts` | `ParseResult` dobiva: `foreignRowCount: number`, `foreignEmailsSummary: Record<string, number>` |
| `src/components/activity/ExcelImportModal.tsx` | Novi `confirm-users` state; radio Skip/Import-as-mine; prosljeđuje `currentUserEmail` i `foreignMode` |
| `src/pages/AppHome.tsx` | Prosljeđuje `email` prop na `ExcelImportModal` |

---

## 7. Odlučena pitanja

| # | Pitanje | Odluka |
|---|---|---|
| P1 | Odakle `currentUserEmail`? | Opcija A — prop iz `AppHome.tsx` (`email` state, line ~81) |
| P2 | Prazna col G? | Tretira se kao owner-ov red |
| P3 | Prikazati preview uvijek? | Samo kad `foreignRowCount > 0` |
| P4 | Info o "tuđima" za grantee? | Da — ista logika, `currentUserEmail` kao filter |
| P5 | Tuđi event_ids u delete logici? | Ne — filtrirani redovi ne ulaze u delete ni kao skip ni kao import_as_mine |
| P6 | Može li owner editirati grantee evente direktno? | Ne — RLS to ne dopušta, nije u scope 10e |

---

## 8. Što NIJE u scope 10e

- Email → user_id lookup za pisanje eventa u ime nekog drugog
- RLS promjene za owner-update grantee evenata
- Bulk merge dvaju korisničkih fajlova u jedan
- Automatski "Clean Area" wizard (workflow je ručan — koraci 4+ su Excel operacije)
