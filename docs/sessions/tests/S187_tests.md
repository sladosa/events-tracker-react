# S187 — testovi (2026-10-28)

Model treninga, korak 1 (`TRENING_MIGRACIJA.md` „Dogovor 28.10.", tablica „Koraci"): **d1** — polje s
`default_value` se u Add/Edit formi prikazuje, popunjeno. Vidljivost određuju samo `HiddenInAdd` (+ „Show all")
i `depends_on`. Kod je na `test-branch`, nije deployan.

---

## T-S187-1 ⬜ (lokalno `npm run dev:prod`, samo gledanje — ništa se ne sprema) Fitness forma i Kokina forma

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
