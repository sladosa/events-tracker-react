# S88 Test Sessions

**Datum:** 2026-06-08
**Branch:** test-branch
**Baza:** TEST Supabase

---

## T-S88-1: Save as Shortcut iz Add Activity (s atributima)

**Preduvjet:** Bilo koja leaf kategorija s atributima (npr. Financije_3 > Transakcija)

1. Otvori Add Activity, odaberi kategoriju, ispuni nekoliko atributa (touched)
2. Klikni "💾 Save as Shortcut (with these attribute values)"
3. Ako kategorija nema postojeći shortcut → upiši ime → Save
4. **Očekivano:** toast "Shortcut '<ime>' saved"; shortcut se pojavljuje u Shortcuts dropdownu
5. **Fail:** shortcut se ne pojavi, ili `default_attributes` ostane prazan u DB

---

## T-S88-2: Update postojeći vs Save as new (choice modal)

**Preduvjet:** Kategorija već ima shortcut s `default_attributes`

1. U Add Activity na toj kategoriji promijeni vrijednosti atributa
2. Klikni "💾 Save as Shortcut..."
3. **Očekivano:** modal nudi izbor — "Update postojećeg" / "Save as new" / Cancel
4. Update → potvrdi → toast success, isti shortcut update-an (provjeri ponovnim odabirom — nove vrijednosti pre-filled)
5. Save as new → upiši DRUGAČIJE ime → kreira se novi shortcut (oba ostaju u dropdownu)
6. **Fail:** duplikat update-a postojeći umjesto kreiranja novog (ili obrnuto)

---

## T-S88-3: Pre-fill vrijednosti pri odabiru shortcuta

**Preduvjet:** Shortcut s `default_attributes` postoji (iz T-S88-1)

1. U filter baru odaberi taj shortcut
2. Otvori Add Activity (gumb "Add Activity" ili "⚡ Use")
3. **Očekivano:** atributi koji su bili spremljeni u shortcutu su pre-filled i `touched`
   (Save gumb odmah aktivan bez dodatnog unosa); statički `default_value` vrijedi
   samo za atribute BEZ shortcut defaulta
4. **Fail:** prazna polja, ili `default_value` prepisuje preset vrijednost

---

## T-S88-4: Filter-bar info nudge (prvi put)

**Preduvjet:** localStorage flag `ui:shortcutAttrTipDismissed` NIJE postavljen (ili obriši ga ručno)

1. U filter baru, na leaf kategoriji, klikni 💾 (Save Shortcut ikona pored dropdowna)
2. **Očekivano:** prikaže se "💡 Did you know?" dijalog koji objašnjava da ovaj save pamti
   samo Area+Category, i da za atribute treba koristiti Add Activity
3. "No, Area + Category is enough" → ide na postojeći name-input save modal (sprema bez atributa)
4. Ponovi s "Don't show this again" čekiranim → flag se sprema, dijalog se više ne pojavljuje
5. **Fail:** dijalog se uvijek/nikad ne pojavljuje, ili checkbox ne perzistira

---

## T-S88-5: "⚡ Use" fast-lane gumb

**Preduvjet:** Odabran VALJAN shortcut koji vodi do leaf kategorije

1. U filter baru odaberi shortcut iz dropdowna
2. **Očekivano:** "⚡ Use" gumb postaje aktivan (emerald boja); klik odmah otvara Add Activity
   za tu Area+Category (preskače Activities tablicu)
3. Gumb je disabled kad: nije odabran shortcut, shortcut ne vodi do leafa, ili read-only grantee
4. **Fail:** gumb uvijek aktivan/neaktivan, ili navigira na krivu kategoriju

---

## T-S88-6: Broken shortcut detekcija (BUGFIX)

**Preduvjet:** Shortcut čija Area/Category je naknadno obrisana u Structure

1. U filter baru odaberi taj (sad nevažeći) shortcut
2. **Očekivano:**
   - toast error "Shortcut '<ime>' points to a category that no longer exists"
   - filter se resetira (NE ostaju stare vrijednosti od prethodno odabranog shortcuta)
   - amber banner: "⚠ This shortcut's Area/Category no longer exists..." s "Delete shortcut" linkom
   - "⚡ Use" ostaje disabled (nema valjanog leafa)
3. Klikni "Delete shortcut" → shortcut nestaje, banner nestaje
4. **Fail:** "⚡ Use" navigira na krivu/staru kategoriju (stale state); nema banner/notifikacije

---

## T-S88-7: Mobile — filter ostaje otvoren nakon odabira shortcuta (BUGFIX)

**Preduvjet:** Browser širina < 768px (DevTools mobile emulation ili pravi telefon)

1. Hodaj do leaf kategorije RUČNO kroz Area/Category dropdownove → filter sekcija se kolabira (postojeće ponašanje, netaknuto)
2. Otvori filter ponovo, odaberi shortcut iz dropdowna
3. **Očekivano:** filter sekcija OSTAJE otvorena (ne kolabira) — "⚡ Use" gumb ostaje vidljiv i klikabilan
4. **Fail:** filter se zatvori odmah nakon odabira shortcuta, "⚡ Use" nestane iz vidljivog prikaza

---

## T-S88-8: Delete Shortcut button — vizualni kontrast (BUGFIX)

1. Bez odabranog shortcuta (ili nakon "Clear all") → 🗑 gumb izgleda blijedo/neaktivno (`bg-red-50`, prozirna granica, `opacity-40`)
2. Odaberi bilo koji shortcut → 🗑 gumb postaje vidljivo "aktivan" (tamniji `bg-red-100`, crvena granica `border-red-200`, tekst `text-red-700`)
3. **Fail:** gumb izgleda identično (blijedo) u oba stanja

---

## T-S88-9: Duplikat imena shortcuta — blokiran (BUGFIX)

1. U filter baru ili Add Activity pokušaj spremiti novi shortcut s imenom koje VEĆ postoji
   (case-insensitive — npr. "trening" kad već postoji "Trening")
2. **Očekivano:** toast error `A shortcut named "<ime>" already exists — choose a different name`;
   save se NE izvrši, modal ostaje otvoren
3. Promijeni ime na jedinstveno → save prolazi normalno
4. **Fail:** kreira se drugi shortcut s istim imenom (duplikat u dropdownu)

---

## T-S88-10: Help panel — Add Activity chips + docs

1. Otvori Add Activity, klikni Help (FAB ❓ donji desni kut)
2. **Očekivano:** chip "How do I save my values as a Shortcut?" prikazan među prijedlozima za `add` kontekst
3. Pitaj AI o shortcutima → odgovor referencira novu sekciju "Shortcuts" iz `docs/help/activities.md`
   (Update vs Save as new, "⚡ Use" gumb, default_attributes)
4. **Fail:** chip nedostaje, ili AI ne zna za novi feature
