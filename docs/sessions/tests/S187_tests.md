# S187 — testovi (2026-10-28)

Model treninga, korak 1 (`TRENING_MIGRACIJA.md` „Dogovor 28.10.", tablica „Koraci"): **d1** — polje s
`default_value` se u Add/Edit formi prikazuje, popunjeno. Vidljivost određuju samo `HiddenInAdd` (+ „Show all")
i `depends_on`. Kod je na `test-branch`, nije deployan.

---

## T-S187-1 ✅ (lokalno `npm run dev:prod`, samo gledanje — ništa se ne sprema) Fitness forma i Kokina forma

> ✅ **28.10.:** Saša na `dev:prod`, 4 slike — svih 7 polja s defaultom na ekranu i popunjeno, `Financije_all`
> ista. Sašina opaska „čini mi se da je bilo i prije": stara forma ih je skrivala u blok „na defaultu …" (osim
> `Strength_type`, kojeg je čuvao `exercise_name`). Saša je zatim isti Add otvorio na Netlify PROD-u (stara
> verzija): „na defaultu: Cardio_type = Z2 · equipment = orb · intensity = light" + Show all — razlika potvrđena.

**Izmjereno prije (PROD backup 22.10.):** default ima 7 atributa, svi u `Fitness`: `intensity = light`
(na `Activity`), `Cardio_type = Z2`, `equipment = orb` (`Gym > Cardio`), `Strength_type = Core`
(`Gym > Strength`), `Outdoor_type = Hiking`, `Trening_type = easy`, `terrain = brda` (`Outdoor`).
`Financije_all` nema nijedan `default_value`.
**Automatski (TEST):** E2E `S187_default_visible` — polja s defaultom na ekranu, `HiddenInAdd` polje
skriveno i imenovano; nad starom formom pada (polje s defaultom nije na ekranu).

**Koraci:**
1. `npm run dev:prod` (banner mora reći PROD), prijava pod svojim računom.
2. `Fitness > Activity > Gym > Cardio` → **+** (Add). Ne diraj ništa.
3. Otvori i roditelja `Activity` (klik na naslov) ako je sklopljen.
4. Isto za `Gym > Strength` i `Outdoor` (Back, pa Discard ako pita).
5. Pod Kokinim računom (ili kao grantee): `Financije_all > Transakcija` → **+**.
6. Izađi bez spremanja (Back / Discard).

**Očekivano:**
- Cardio: polja `Cardio_type` = Z2 i `equipment` = orb **na ekranu**, odabrana; na `Activity` `intensity` = light.
- Strength: `Strength_type` = Core i `intensity` = light na ekranu. Outdoor: `Outdoor_type` = Hiking,
  `Trening_type` = easy, `terrain` = brda, `intensity` = light.
- U Fitnessu **nema** isprekidanog bloka „na defaultu …" ni gumba „Show all".
- `Financije_all`: forma **ista kao prije** — dolje „prazna po pravilu: Izvod opis, Valuta" + „Show all";
  Isplata/Uplata se pojave tek uz Smjer.

**Pad:** bilo koje od 7 polja nije na ekranu, ili je na ekranu prazno; ili se Kokina forma promijenila
(npr. nestala linija „prazna po pravilu", ili se Isplata/Uplata prikazuju bez Smjera).

---

## T-S187-2 ⬜ (TEST, lokalno `npm run dev`) Pravilo vidljivosti — panel, forma, Excel

Korak 2 dogovora: `validation_rules.visible_when` („polje vidljivo samo uz vrijednost X atributa Y").
**Automatski (TEST):** unit `visibleWhen.test.mjs` (53) i E2E `S187_visible_when` (Add: vrsta mijenja polja,
upisano se briše, obavezno samo vidljivo, skriveni default se ne sprema; Edit: „izvan pravila").
Ovaj ručni test pokriva ono što automatski ne: **panel** i **Excel roundtrip** na tvojoj strukturi.

**Koraci:**
1. `npm run dev` (banner TEST). Structure → Edit Mode → `Fitness > Activity > Gym > Strength` → Edit.
2. Atribut `weight_info` → **Visible only when** = `Strength_type`, kvačica **Upp** → Save.
   (Nema li TEST-ov Fitness tih atributa, uzmi bilo koji tekstualni atribut i dropdown istog leafa.)
3. View panel istog čvora: uz `weight_info` piše „visible only when: strengthtype = Upp".
4. Add na `Strength`: `Strength_type` = Core ⇒ `weight_info` **nije** na ekranu. Promijeni u Upp ⇒ pojavi se;
   upiši nešto; vrati na Core ⇒ nestane; opet Upp ⇒ **prazno**.
5. Structure export (Area Fitness) ⇒ stupac **L `VisibleWhen`** (u skupini uz HiddenInAdd) na retku
   `weight_info`: `strengthtype = Upp`. Uvezi file **nepromijenjen** ⇒ `Attributes updated` se ne pojavi (0).
6. U fileu promijeni ćeliju u `strengthtype = Upp | Low`, uvezi ⇒ `Attributes updated 1`; Add: uz Low se
   `weight_info` vidi.
7. U fileu upiši `nepostoji = x`, uvezi ⇒ upozorenje „no attribute "nepostoji" … rule left as it was",
   pravilo ostaje `Upp | Low`.
8. Počisti: panel → Visible only when = „— always shown —" → Save.

**Očekivano:** kako piše u koracima. **Pad:** polje vidljivo uz krivu vrijednost; upisano ostaje nakon
skrivanja; nepromijenjen roundtrip javlja promjenu; loša ćelija obriše pravilo bez upozorenja.
