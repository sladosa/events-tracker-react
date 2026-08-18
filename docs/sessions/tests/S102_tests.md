# S102 Test Details — default_map + attr filter slug + Structure Import fix

**Branch:** test-branch
**Baza:** TEST ili PROD (Financije area)
**Preconditions:** SQL 030 pokrenut, Structure importirana s default_map redovima za Status

---

## T-S102-1 ✅ default_map: Izvor=Visa → Status=Planiran
1. Add Activity → Financije > Transakcija
2. Odaberi Izvor plaćanja = Visa
3. **Expected:** Status dropdown automatski prikazuje "Planiran"
4. **Potvrđeno:** screenshot u sesiji

## T-S102-2 ✅ default_map: Izvor=Račun → Status=Izvršen
1. Add Activity → Financije > Transakcija
2. Odaberi Izvor plaćanja = Račun
3. **Expected:** Status dropdown automatski prikazuje "Izvršen"

## T-S102-3 ⬜ default_map: promjena Izvor mijenja Status default
1. Add Activity → Financije > Transakcija
2. Odaberi Izvor = Račun → Status = "Izvršen"
3. Promijeni Izvor na Visa
4. **Expected:** Status se resetira na "Planiran" (ne ostaje "Izvršen")

## T-S102-4 ⬜ default_map: ručno editiran Status NE resetira se
**Napomena:** Trenutna implementacija UVIJEK resetira dependent na default_map vrijednost kad se parent promijeni. Ovo je by-design za sad — isti pattern kao depends_on reset. Ako korisnik ručno promijeni Status, pa onda promijeni Izvor, Status će dobiti novi default.
1. Add Activity → Izvor = Visa → Status = Planiran
2. Ručno promijeni Status na "Izvršen"
3. Promijeni Izvor na Račun
4. **Expected:** Status = "Izvršen" (iz default_map za Račun) — resetira se jer se parent promijenio

## T-S102-5 ✅ Structure Import slug grouping
1. Importaj Structure xlsx gdje bazni red ima ime "Izvor placanja" a DependsOn redovi ime "Izvor", ali svi imaju slug "izvorplacanja"
2. **Expected:** Svi redovi se grupiraju u jedan atribut, depends_on opcije sačuvane
3. **Potvrđeno:** screenshot u sesiji (Izvor dropdown radi s Racun/Visa/Cash)

## T-S102-6 ✅ Structure Export: default_map u Default koloni
1. Exportaj Structure
2. Nađi Status atribut redove
3. **Expected:** Cash→Izvršen, Visa→Planiran, Račun→Izvršen, Mastercard→Planiran u Default koloni
4. **Potvrđeno:** screenshot Edit panela

## T-S102-7 ✅ StructureNodeEditPanel: default polje
1. Structure tab → Edit Mode → klikni Transakcija → Edit panel
2. Nađi Status atribut → expand
3. **Expected:** Svaki WhenValue red ima treće polje "default" s vrijednošću
4. **Potvrđeno:** screenshot u sesiji

## T-S102-8 ⬜ Export Filter sheet: slug format
1. Postavi Attribute filter na "Račun = Sašin tekući RF"
2. Export xlsx
3. Otvori Filter sheet
4. **Expected:** Red "Attribute filter" prikazuje `racun: =Sašin tekući RF` (ne UUID)

## T-S102-9 ⬜ Export Filter sheet: Comment/Attr filter uvijek prisutni
1. Export bez ikakvih filtera (ili samo Area filter)
2. Otvori Filter sheet
3. **Expected:** "Comment filter" i "Attribute filter" redovi postoje s praznom B ćelijom

## T-S102-10 ⬜ Import Profile: slug-based attr filter
1. Export xlsx s attr filterom (slug format)
2. Promijeni filter u xlsx (npr. `tip: ~Dom`)
3. Import kao profil
4. Download s tim profilom
5. **Expected:** Export sadrži samo evente gdje Tip sadrži "Dom"

## T-S102-11 ⬜ Data Validation input message
1. Export xlsx → otvori Filter sheet
2. Klikni na Attribute filter ćeliju (B red)
3. **Expected:** Input message popup objašnjava format: slug: =exact, slug: ~partial, *: ~text

## T-S102-12 ⬜ Shortcut pre-fill default_map
1. Kreiraj shortcut koji sprema Izvor plaćanja = Visa
2. Koristi shortcut za novi Add Activity (⚡ Use)
3. **Expected:** Status automatski = "Planiran" (default_map second pass)
