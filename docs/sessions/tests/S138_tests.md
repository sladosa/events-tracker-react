# S138 — detaljni testovi (2026-09-15)

> Sesija: deploy na `main`, `cutoff:3:5` + `rata.date_map.Visa = 5` na PROD-u.
> ⚠ Config je **potvrđen čitanjem baze**; ovi testovi provjeravaju da je **živ u aplikaciji**.
> ⚠ Redak za test biraj tako da se **razlikuje** od rezultata pravila (S129) — inače test
> prolazi i nad pokvarenim kodom.

---

## T-S138-1 ⬜ `cutoff:3:5` je živ — obična Visa kupovina

**Preduvjet:** deploy na `main` pušten (✅ S138, `cutoff` potvrđen u PROD bundleu
`index-zSPJZpMY.js`); `areas.settings` nosi `"Visa": "cutoff:3:5"` (✅ potvrđeno čitanjem).

1. Otvori aplikaciju (PROD, ili lokalno `npm run dev:prod`). **Ctrl+Shift+R.**
2. `Financije_all > Transakcija` → **Add Activity**.
3. `Izvor placanja = Visa`, datum **današnji** (15.09.2026. ili kasnije u rujnu).
4. Pogledaj `Datum naplate` **prije** spremanja.

**Očekivano:** `05.10.2026.`
Kupovina 15.09. pada u ciklus koji se zatvara **03.10.** (granica B = 3), a račun se tereti
prvog **5.** nakon granice (D = 5).

**Pad:** `03.10.2026.` ⇒ pravilo nije živo — vrti se stari `next:3`. Provjeri je li preglednik
povukao nov bundle (Ctrl+Shift+R) i je li `areas.settings` doista promijenjen.
**Pad:** `15.10.` ili neki 15. ⇒ token nije prepoznat i pao je na zadanih `15`.

⚠ Ne testiraj na kupovini datiranoj 1.–3. u mjesecu — ondje se `next:3` i `cutoff:3:5`
**poklapaju u mjesecu**, pa test ne razlikuje ispravno od pokvarenog.

---

## T-S138-2 ⬜ `rata.date_map.Visa = 5` je živ — Visa na rate

**Preduvjet:** isti kao T-S138-1; `automations.rata.date_map` nosi `{"Visa": 5, "Mastercard": 11}`
(✅ potvrđeno čitanjem).

1. **Add Activity**, `Izvor placanja = Visa`, datum današnji, iznos npr. `90,00`.
2. `Rate? = da`, `Broj rata = 3` → **Finish** → u rata modalu potvrdi.
3. Pogledaj tri nastala retka u listi.

**Očekivano:** `Datum naplate` = **05.10.2026. / 05.11.2026. / 05.12.2026.**,
svaki `Status = Planiran`, `Rata br` 1..3, isti `event_date` (dan kupnje),
`session_start` pomaknut +1 min po rati.

**Pad:** `03.10./03.11./03.12.` ⇒ `rata.date_map` nije promijenjen ili uvoz nije prošao.
**Pad:** `15.10./15.11./15.12.` ⇒ netko je u rata redak upisao **token** umjesto broja;
`config.date_map[v] ?? 15` ga tiho pretvori u 15.

⚠ Poznat rub koji **nije** kvar: kupovina 1.–3. u mjesecu dobije prvu ratu mjesec prekasno —
`generateRataChargeDates` uvijek kreće od sljedećeg mjeseca. V. Backlog.

---

## T-S138-3 ⬜ (zadatak) MC naplata 11.09. — nedostaje klasifikacija

Izmjereno: redak `2026-09-11 14:32`, `Isplata 1.068,70`, `Izvor = Racun`, `Status = Izvrsen`,
`Racun = Kokin tekući ZABA` — **ali `Tip = N/A`, bez `Podtip`a i bez `comment`a.**
Saldo je zato točan (pločica gleda `Izvor` + iznos), razrez po Tipu nije.

Ispravno je, izmjereno na **32/32** prethodnih mjeseci:

| polje | vrijednost |
| --- | --- |
| Tip / Podtip | `Transfer` / `izmedju racuna` |
| comment | `TROŠKOVI UČINJENI MASTERCARD KARTICOM` (strojni tekst izvatka, doslovno) |

1. Edit tog retka → upiši `Tip`, `Podtip`, `comment`. Ostalo ne diraj.

**Očekivano:** redak prestaje biti `N/A`; pločica se **ne miče** (Transfer i dalje ulazi u saldo).
⚠ Comment mora biti **strojni tekst**, ne „Mastercard" — svih 18 prethodnih ga nosi, a
`klasificiraj_transu.py` broji po opisu.

---

## T-S138-4 ⬜ (zadatak) MC naplata 11.07. — nedostaje samo comment

Redak `2026-07-11 07:00`, `1.244,74`, već je `Transfer` / `izmedju racuna` / `Izvor = Racun`,
ali bez `comment`a i bez `Izvod opis`a. Dopuni comment kao u T-S138-3.

⚠ Zbog toga je u popisu „MC naplata po mjesecima" izgledalo da srpanj **fali** — nije falio,
nego se nije dao naći pretragom po strojnom tekstu.

---

## T-S138-5 ⬜ (zadatak) Tri Visa rate od 15.09. nose stari datum

`Konzum dostava · rata 1/3…3/3`, `25,51` svaka, `Datum naplate` = `03.10. / 03.11. / 03.12.`
Nastale su rata modalom **prije** nego je `rata.date_map.Visa` promijenjen na `5`.

1. Edit svake → `Datum naplate` na `05.10. / 05.11. / 05.12.`

**Nije hitno:** sve tri su `Status = Planiran` i potvrdit će se s PBZVISA izvoda.
⚠ Ovo su ujedno jedina **tri** Visa retka u cijeloj bazi s danom naplate `3.` — sve ostalo
(225 rata, 1.629 Visa redaka) nosi stvarne datume s izvoda.
