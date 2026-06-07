# S87 Test Sessions

**Datum:** 2026-06-07
**Branch:** test-branch
**Baza:** TEST Supabase

---

## T-S87-1: Financije_3 leaf comment prefiks u Activities tablici

**Preduvjet:** Financije_3 importana u TEST (3163 eventi)

1. Odaberi Area = Financije_3
2. Pregledaj Activities tablicu
3. **Očekivano:** Svaki red prikazuje leaf comment s prefiksom:
   - Kokin tekući ZABA → `ZABA: Parking`, `ZABA: Konzum 2/12`, itd.
   - Sašin tekući RF → `RF: Mirovina I stup`, `RF: Povrat poreza`, itd.
   - Redovi bez Napomene → samo `ZABA` ili `RF`
4. **Fail:** prazan comment, ili comment bez prefiksa

---

## T-S87-2: View Activity — flat Transakcija

**Preduvjet:** Financije_3 importana, barem 1 event vidljiv

1. Klikni na bilo koji event u Financije_3
2. **Očekivano:**
   - Path: `Financije_3 > Transakcija`
   - Jedna sekcija "Transakcija" s `leaf` badge
   - 8 atributa: Racun, Uplata, Isplata, Stanje, Valuta, Napomena, Smjer, Tip
   - Event Note sekcija prikazuje `ZABA: Napomena` ili `RF: Napomena`
   - NEMA druge sekcije (Kategorija više ne postoji)
3. **Fail:** dvije sekcije (Transakcija + Kategorija), ili missing atributi

---

## T-S87-3: Comment filter za DATUM_GREŠKA redove

**Preduvjet:** Financije_3 importana

1. Odaberi Area = Financije_3, All Categories
2. U filter baru — "Comment contains" → upiši `DATUM_GREŠKA`
3. **Očekivano:** tablice prikazuje samo redove s tim markerom (41 kom — koka EU + sasa EU)
4. Klikni × chip ili obriši filter → svi eventi vidljivi natrag
5. **Fail:** 0 rezultata, ili filtar ne radi

---

## T-S87-4: Delete Area s aktivnim shortcutom (activity_presets FK fix)

**Preduvjet:** Neka Area u TEST bazi ima barem 1 shortcut (activity_preset)

1. Idi u Activities tab → odaberi neku kategoriju → spremi shortcut (floppy/+ ikona)
2. Idi u Structure tab → pokušaj Delete te iste kategorije (ili njenog parenta/Aree)
3. **Očekivano:** brisanje uspijeva bez error poruke (shortcut automatski obrisan)
4. **Fail:** FK constraint greška `activity_presets_category_id_fkey` u error boxu
