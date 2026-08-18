# S102b Test Details — Export Profile filter override bugfixes

**Branch:** test-branch
**Baza:** PROD (Financije area, Koka's data — "Kokin tekući ZABA" / "Sašin tekući RF" računi)
**Kontekst:** Bugovi pronađeni tijekom T-S100-5/T-S102-8..11 manualnog testiranja Export Profile sustava.

---

## T-S102b-1 ✅ Period dropdown nakon "Use" shortcuta prikazuje točan period
1. Učitaj shortcut koji ima spremljen `periodKey: 'this-year'` u `filter_state` (npr. "2026_KokaZABA")
2. Klikni "⚡ Use"
3. **Expected:** Period dropdown pokazuje "This Year", NE "All Time"
4. **Root cause (prije fixa):** `DateRangeFilter.tsx` `activePresetKey` se izvodio usporedbom `localFrom/localTo` s `bounds.minDate/maxDate` umjesto čitanja `filter.periodKey` direktno — lažno pokazivao "All Time" kad se "this-year" raspon slučajno poklopio s punim rasponom podataka u filtriranom setu
5. **Fix:** dropdown sad trusta `filter.periodKey`
6. **Potvrđeno:** screenshot u sesiji

## T-S102b-2 ✅ Export Profile attrFilterRaw stvarno filtrira podatke
1. Postavi live filter na Racun = "Kokin tekući ZABA" (shortcut "2026_KokaZABA")
2. Export Profile = "2026_SasaRF" (ima spremljen `racun: =Sašin tekući RF`)
3. Download Excel
4. **Expected:** Events sheet kolona "Racun" pokazuje "Sašin tekući RF" na SVIM redovima (ne "Kokin tekući ZABA")
5. **Root cause (prije fixa):** `applyProfileFilterOverrides()` u `ExcelExportModal.tsx` zvao `parseAttrFilterRaw()` BEZ `attrDefs` → slug lookup tiho failao → `effectiveFilters.attrFilter` (stvarni DB upit) ostao na live vrijednosti, dok je ODVOJENA, ispravna grana (samo za Filter sheet tekst) parsirala točno → Filter sheet je lagao da je override primijenjen
6. **Fix:** `attrDefs` resolvani PRIJE poziva `applyProfileFilterOverrides`, jedan izvor istine
7. **Potvrđeno:** screenshot — Events sheet redovi pokazuju "Sašin tekući RF"

## T-S102b-3 ✅ Period key = `all-time` stvarno briše datumski filter
1. Edit Filter sheet: Period key = `all-time` (dropdown)
2. Import Profile
3. Postavi uzak live date range (npr. samo zadnja 2 mjeseca)
4. Export s tim profilom
5. **Expected:** Date From/To u rezultatu pokrivaju PUNI raspon podataka (ne uski live raspon)
6. **Root cause (prije fixa):** `resolvePeriodKey('all-time')` namjerno vraća `null`, ali override kod nije imao posebnu granu → datumi nedirani, ostao live raspon
7. **Fix:** eksplicitna `all-time` grana postavlja `dateFrom/dateTo = null`
8. **Potvrđeno:** screenshot — Date From "All time (2026/01/04)", Date To "All time (2026/05/29)"

## T-S102b-4 ✅ Period key = `custom` + Date From/To eksplicitni raspon
1. Edit Filter sheet: Period key = `custom`, Date From = `2026-04-15`, Date To = `2026-05-15` (plain YYYY-MM-DD text)
2. Import Profile (npr. "TEST")
3. Export s tim profilom
4. **Expected:** Filter sheet rezultata pokazuje točno taj raspon (Date From 2026-04-15, Date To 2026-05-15), Events sheet sadrži samo evente iz tog raspona
5. **Potvrđeno:** screenshot — Filter sheet Period key="custom", Date From/To točni; Events sheet redovi 2026-04-15 do 2026-05-15

## T-S102b-5 ✅ "Period label" red uklonjen iz Filter sheeta
1. Export bilo koji fajl
2. Otvori Filter sheet
3. **Expected:** 12 redova (ne 13) — nema "Period label" reda; Date From/To imaju tooltip "Period=custom only"
4. **Potvrđeno:** screenshot

## T-S102b-6 ✅ Period key / Sort order dropdownovi rade u Excelu
1. Export bilo koji fajl, otvori Filter sheet
2. Klikni na Period key ćeliju (red 8) i Sort order ćeliju (red 9)
3. **Expected:** Excel dropdown strelica, lista validnih PeriodKey vrijednosti / Newest-Oldest first
4. **Potvrđeno:** screenshot u sesiji

## T-S102b-7 ✅ HelpEvents sheet "EXPORT PROFILES" odjeljak
1. Export bilo koji fajl, otvori HelpEvents tab
2. **Expected:** Novi odjeljak "📊 EXPORT PROFILES" — LEGEND row order = column order, kako spremiti profil, custom period, `_` sentinel objašnjenje
3. **Potvrđeno:** screenshot

## T-S102b-8 ✅ Attribute filter `_` sentinel eksplicitno briše filter
1. Postavi live filter na Racun = "Kokin tekući ZABA"
2. Edit Filter sheet profila: Attribute filter = `_` (umjesto prazne ćelije), Period key = `all-time`
3. Import Profile (update postojećeg, npr. "FinacijeAll")
4. Export s tim profilom
5. **Expected:** Events sheet sadrži MIJEŠANE račune (Sašin tekući RF I Kokin tekući ZABA), ne samo live vrijednost
6. **Root cause:** prazna ćelija = "nema override, naslijedi live filter" (ne "obriši"); nije bilo načina eksplicitno reći "exportaj sve" kroz profil
7. **Fix:** `_` sentinel (ista konvencija kao Excel Import / Structure Default kolona) eksplicitno postavlja `attrFilter = null`
8. **Potvrđeno:** screenshot — Events sheet redovi pokazuju oba računa

## T-S102b-9 ✅ Excel se otvara bez "We found a problem with some content" greške
1. Export fajl s ažuriranim Filter sheet tooltipovima
2. Otvori u Excelu
3. **Expected:** Fajl se otvara normalno, bez repair dijaloga
4. **Root cause:** Data Validation `promptTitle` (34 znaka, limit 32) i `prompt` (297 znakova, limit 255) na Attribute filter / Date From/To ćelijama premašili Excel hard limite → neispravan OOXML
5. **Fix:** tekstovi skraćeni (title ≤18, prompt ≤191 znakova za sve ćelije); pravilo dodano u CLAUDE.md Critical rules
6. **Potvrđeno:** korisnik potvrdio normalno otvaranje nakon fixa

---

## Preostalo (prebačeno u S103 prioritete)
- **T-S100-6** — `~` partial match i `*` "in any attribute" operator kao Export Profile override (do sad testiran samo `=` exact na "racun")
- **T-S100-7** — Import Profile toast prikazuje column order + widths info
- **T-S95-10** — Add Activity → Finish s praznim atributima u templateu → comment null
