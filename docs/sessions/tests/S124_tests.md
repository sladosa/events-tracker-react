# S124 — detaljni testovi (2026-09-01)

Tema: usklađenje `Financije_all` s bankovnim izvodima, ispravci i tranša — **sve
primijenjeno skriptama pod `service_role`**, ne Excel importom.

**Zašto skriptom:** Sašina odluka — nijedan od 25 ispravaka ne traži Kokinu odluku,
svaki je dokazan izvodom. Njen prvi uvoz neka bude njezin mjesec, kad ima razlog.
Posljedica koju treba znati: **Excel import put ovim batchom NIJE provjeren.**

**Preduvjeti:** PROD, Area `Financije_all`. Većinu se vidi i Sašinim grantee pristupom.

---

## Strojne kontrole (već prošle, ovdje za ponovno pokretanje)

```
cd data-prep_tools/Financije
python uskladi_izvod.py --izvod ../../data-prep_data/Financije/izvodi/MC_2026-07.pdf --dry
```

Očekivano na svih 7 izvoda: `KONTROLA … == izvod, u cent`, i
`uvoz 0 · duplikat 0 · PITANJA 0`. Preostala 3 `ispravak` su `event_date` pomaci koje
namjerno ne diramo.

⚠ Ako `KONTROLA` ikad pokaže `!=`, **ništa ispod u tom ispisu ne vrijedi** — to znači da
se zbroj sparenog i onog za uvoz ne poklapa s papirom.

---

## T-S124-1 — saldo se nije pomaknuo

1. Overview tab → pločica `Kokin tekući ZABA`.

**Očekivano:** isti iznos kao prije 01.09.2026.

**Zašto:** svih 35 dirnutih redaka je `Izvor = Mastercard`, a saldo miče **samo**
`Izvor = Racun`. Pomakne li se, promijenjeno je nešto što nije trebalo.

---

## T-S124-2 — 1:N pravilo, lipanjske rate

1. Activities → filtriraj 28.06.2026.

**Očekivano:**
- **nema** retka `LH 1/3` (bila su dva, oba obrisana kao duplikat)
- `LUFTHAN2202242474447 RATA 1/3` i `…448 RATA 1/3`, 62,01 svaki, sada nose
  `Rate? = DA · Broj rata 3 · Rata br 1`
- opis im je **i dalje bankin**, nije zamijenjen s `LH 1/3`
- dva retka `NAKNADA ZA OBROČNU OTPLATU` po 1,32, `Domaćinstvo / Bankovni troškovi`

**Pad:** postanu li oba `LH 1/3`, dopuna je prepisala opis — to daje **dva identična
retka** istog dana i iznosa, dakle nešto što izgleda kao duplikat.

---

## T-S124-3 — 1:N pravilo, srpanjske rate

1. Filtriraj 11.07. i 29.07.2026.

**Očekivano:** na 11.07. **nema** `LH 2/3`; na 29.07. postoje `LUFTHAN… RATA 2/3` 62,01 ×2
i `NAKNADA` 1,32 ×2, s `Rate? = DA · 2/3`.

**Zašto zajedno:** brisanje i uvoz išli su **jednim potezom**. Odvojeno bi prvo brisanje
dalo rupu od 126,66, a prvo uvoz duplikat.

---

## T-S124-4 — ⭐ `Status` je prešao samo uz žig

1. Filtriraj `Izvor = Mastercard`, `Datum naplate = 11.08.2026`.

**Očekivano:** 9 rata (`Konzum`, `Keindl`, `Allianz`) su `Izvrsen` i **svaka nosi
`Izvod opis`**.

**Pad — najvažniji u ovoj sesiji:** postoji redak koji je prešao u `Izvrsen` **bez**
`Izvod opis`. To bi značilo da je `Status` promijenjen kao zaključak iz **dospijeća**, a
ne kao posljedica **potvrde izvodom** — pravilo koje je izričito odbačeno.

---

## T-S124-5 — nov Podtip `Wellness`

1. Add Activity → `Financije_all` → `Tip = Zabava` → otvori `Podtip`.

**Očekivano:** `Wellness` je u popisu, odmah iza `Kino/Kazalište/Muzeji`.

2. Provjeri i 6 klasificiranih redaka: `AQUAPARK ADAMOVEC` (59,00 i 48,00),
   `AQUAE VIVAE` 34,00, `TERME TUHELJ` (42,60 i 54,00), `TERME JEZERCICA` 40,00 —
   svi `Zabava / Wellness`.

⚠ Taksonomija živi **samo** u `validation_rules`; u kodu aplikacije nema hardkodiranih
vrijednosti. Ako se `Wellness` ne pojavi, problem je u bazi, ne u buildu.

---

## T-S124-6 — 26 novih redaka nose Kokine opise

1. Filtriraj 10.07.–31.07.2026, `Izvor = Mastercard`.

**Očekivano:** 26 redaka s čitljivim opisima (`Parking`, `Ina`, `The meat`, `Youtube`,
`HBOMax`, `Prime`, `Getaldus`, `Disney`, `Bazen`…), **ne** strojni tekst izvoda.

**Zašto:** izvod je autoritet za iznos i datum, **Kokin file za značenje**. Iznimka su
`LUFTHAN` i `NAKNADA` retci — njih ona vodi spojeno pa nemaju par.

3. Svi imaju popunjen `Tip`/`Podtip`; nijedan nije `N/A`.

---

## T-S124-7 — ista trgovina, drugi trošak

1. Nađi `TERME JEZERCICA-POOL BAR` 9,80 (31.07.2025).

**Očekivano:** `Domaćinstvo / Kave/jelo vani`, **ne** `Zabava / Wellness`.

**Zašto je test:** ključ po trgovcu bi ga pokupio kao wellness. Piće u termama je piće.
Ovo čuva pravilo da rječnik ne smije biti samo po imenu trgovca.

---

## Otvoreno, nije test nego posao

- **Excel import put nije provjeren.** Treba ga dokazati na TEST-u ili na Kokinom prvom
  vlastitom mjesecu — inače ne znamo govore li alat i app isti jezik.
- 3 `event_date` pomaka namjerno nisu dirana (pomicanje mijenja i `session_start`, a
  `useActivities` grupira po njemu).
- 185 MC redaka s `Tip = N/A` — rječnik ih može dohvatiti, nije pušteno.
