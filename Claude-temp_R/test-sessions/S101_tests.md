# S101 Tests — Financije PROD fixes + Tip/Podtip

**Datum:** 2026-06-28
**Branch:** main (PROD changes via SQL)

---

## T-S101-1: Broj rata depends_on fix ✅
**Preduvjet:** Kokina Financije area na PROD
**Koraci:**
1. Otvori Structure tab → Edit Mode → Transakcija → Broj rata atribut
2. Provjeri DependsOn slug — trebao je biti `na_rate`, ispravljen na stvarni slug Rate? atributa
3. Otvori Add Activity → Smjer=Isplata → čekiraj Rate? → Broj rata polje se pojavi
**Rezultat:** Polje Broj rata vidljivo kad je Rate?=Yes ✅

## T-S101-2: Rata config na novoj Financije area-i ✅
**Preduvjet:** SQL rata config pokrenut na PROD (oba area-e)
**Koraci:**
1. Refreshaj stranicu (F5) nakon SQL-a
2. Add Activity → Smjer=Isplata, Rate?=Yes, Broj rata=3, Isplata=450
3. Finish → Rata modal se pojavi
**Rezultat:** Modal prikazan s ispravnim iznosom ✅

## T-S101-3: date_map_slug=racun ✅
**Preduvjet:** SQL update date_map_slug na "racun" + date_map ključevi = račun imena
**Koraci:**
1. Add Activity → Racun=Kokin tekući ZABA, Rate?=Yes, Broj rata=3, Isplata=450
2. Finish → Modal prikazuje datume na 11. (Mastercard dan za ZABA)
**Rezultat:** Datumi 11.07, 11.08, 11.09 ✅

## T-S101-4: Rata modal — 3 rate ispravno ✅
**Koraci:**
1. Iz T-S101-3: modal prikazuje 3 × 150.00 = 450.00
2. Klikni "Kreiraj 3 rata" → 3 eventa kreirana
3. View Activity → rata 1/3, Status=Planiran
**Rezultat:** Sve 3 rate kreirane s ispravnim iznosima i datumima ✅

## T-S101-5: SQL 030 — Tip opcije + Podtip atribut ⬜
**Preduvjet:** Pokrenuti sql/030_financije_tip_podtip.sql na PROD
**Koraci:**
1. Pokreni SQL Step 1 — Verify prikazuje nove Tip opcije
2. Pokreni SQL Step 2 — Verify prikazuje Podtip s depends_on=tip
3. Provjeri da postoji Podtip za obje area-e (Financije + Financije_old)
**Očekivano:** Oba verify querija vraćaju ispravne podatke

## T-S101-6: Add Activity — novi Tip dropdown ⬜
**Preduvjet:** T-S101-5 prošao, stranicu refreshati
**Koraci:**
1. Add Activity za Financije > Transakcija
2. Klikni Tip dropdown
3. Provjeri da prikazuje: Domaćinstvo, Informatika, Ostavine, Zdravlje, auto C5, auto Lacetti, Putovanja, Ostalo, Mirovina, Najam, Transfer, Povrat, Ostali prihodi, N/A
**Očekivano:** Svi novi Tip-ovi vidljivi u dropdownu

## T-S101-7: Add Activity — Podtip depends_on Tip ⬜
**Preduvjet:** T-S101-6 prošao
**Koraci:**
1. Odaberi Tip=Domaćinstvo → Podtip dropdown se pojavi
2. Provjeri opcije: Struja, Voda, Holding (smeće), Plin, Bankovni troškovi, Popravci, Investicije, Povrat Nataša, Povrat Zoran
3. Promijeni Tip=Informatika → Podtip opcije se promijene na: T-mobile, T-com, HP, itd.
4. Promijeni Tip=Transfer → Podtip prazni (wildcard fallback)
**Očekivano:** Podtip opcije se mijenjaju ovisno o Tip-u

## T-S101-8: Export — Podtip kolona ⬜
**Preduvjet:** T-S101-5 prošao
**Koraci:**
1. Export Financije (All Time)
2. Otvori xlsx → Events sheet
3. Provjeri da postoji kolona "Podtip (Transakcija)" — prazna za sve redove
4. Structure sheet → provjeri Podtip atribut s DependsOn=tip
**Očekivano:** Podtip kolona vidljiva, prazna; Structure prikazuje depends_on
