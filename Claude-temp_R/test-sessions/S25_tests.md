# S25 Tests

**Sesija:** S25 — 2026-03-25
**Branch:** test-branch

---

## T-S25-1

**Opis:** Import Area-only Excel reda → result summary vidljiv, nova Area u filteru

**Koraci:**
1. Structure tab → Import
2. Uvezi Excel koji sadrži samo Area red (bez kategorija)
3. Provjeri: modal ostaje otvoren i prikazuje "Import result" tablicu
4. Provjeri: "Areas created: 1" u result tablici
5. Zatvori modal — provjeri da nova Area postoji u Area filteru (gornji dropdown)

**Očekivano:**
- Modal NE zatvara automatski nakon importa
- Result summary jasno vidljiv
- Nova Area odmah vidljiva u filteru bez refresha stranice

---

## T-S25-2

**Opis:** Leaf kategorija bez evenata → badge "no events yet"

**Koraci:**
1. Structure tab (bez Edit Modea)
2. Pronađi leaf kategoriju koja nema evente
3. Provjeri da uz "leaf" badge postoji i sivi italic badge "no events yet"

**Očekivano:**
- Badge vidljiv inline uz "leaf" badge, sivi/italic stil

---

## T-S25-3

**Opis:** Leaf kategorija s eventima → nema "no events yet" badge

**Koraci:**
1. Structure tab
2. Pronađi leaf kategoriju koja IMA evente
3. Provjeri da je vidljiv samo "leaf" badge, bez "no events yet"

**Očekivano:**
- Samo "leaf" badge, bez "no events yet"
