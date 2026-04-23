# Events Tracker — Help System Concepts

Ovaj fajl je izvor istine za AI help system prompt.
Ažuriraj ga kad se dodaju ili mijenjaju feature-i.

---

## Struktura podataka

**Areas → Categories (hijerarhija) → Activities/Events + Attributes (EAV)**

- **Area**: najviša razina grupiranja (npr. Fitness, Health, Financije)
- **Category**: podkategorija unutar areae, može biti više razina duboko
  - npr. `Fitness > Strength Training > Bench Press`
- **Leaf category**: najdublja razina — ovdje se logiraju individualne aktivnosti
- **Activity/Event**: upisani zapis s `session_start` timestampom i vrijednostima atributa
- **Attribute**: tipizirano polje (text, number, datetime, boolean, link, image)
- **Session**: grupa eventova na isti `session_start` (datum+vrijeme, zaokruženo na minutu)
- **Parent event**: roditeljna kategorija automatski dobiva 1 event po sesiji (sažetak)

## Ključna pravila

- P1: Svaka razina kategorije (ne samo leaf) može imati attribute definitions
- P2: Leaf = N eventa po sesiji; svaki parent = točno 1 event po sesiji (upsert)
- P3: Zadnja neprazna vrijednost pobjeđuje — prazno nikad ne overwritea neprazno
