# S95 Test Session — depends_on bugfixes + comment_template

**Datum:** 2026-06-21
**Branch:** test-branch

---

## T-S95-1: parseValidationRules — mapping format parsira depends_on

**Preduvjet:** Atribut u bazi ima `validation_rules` u dropdown.mapping formatu, npr.:
```json
{"dropdown":{"type":"static","depends_on":{"field":"smjer","mapping":{"Uplata":"show","Isplata":"show"}}}}
```
Ako nema takvog atributa u bazi, testiraj preko Structure Edit panela (postavi depends_on na boolean atribut — vidi T-S95-2 prvo) ili direktno SQL.

**Koraci:**
1. Otvori app (TEST), ulogiraj se
2. Navigiraj na Add Activity za kategoriju koja ima atribut s mapping-format depends_on
3. Provjeri konzolu — NE smije biti "Old mapping format detected" warning
4. Promijeni vrijednost parent atributa (smjer/rate/etc.) → zavisno polje se treba prikazati/sakriti

**Očekivano:**
- `parseValidationRules` konvertira `mapping` u `optionsMap` (svaka vrijednost omotana u array)
- `result.dependsOn` je postavljen — visibility check u `AttributeChainForm` funkcionira
- Polje se skriva/prikazuje kad se parent atribut promijeni

**Fail:** Polje je uvijek vidljivo bez obzira na parent vrijednost; konzola loguje "Old mapping format" warning

---

## T-S95-2: Boolean atributi u depends_on dropdownu (Structure Edit)

**Preduvjet:** Area s barem jednim boolean atributom (npr. Demo Area → Exercise → Has Warmup; ili Financije_3 → Rate?)

**Koraci:**
1. Otvori app (TEST), navigiraj na Structure tab
2. Uključi Edit Mode
3. Klikni ⋮ na kategoriji koja ima boolean atribut → Edit
4. Odaberi neki atribut tipa text/suggest → sekcija "Depends on"
5. Otvori dropdown za depends_on parent

**Očekivano:**
- U dropdownu se vide **svi** atributi iste razine i predaka, uključujući boolean i number atribute
- Prije fixa: boolean/number atributi nisu bili u listi (filtrirani na `data_type === 'text'`)
- Sada: atribut `Rate?` (boolean) pojavljuje se u "Same level" ili "↑ [parent]" optgroup-u
- Ancestor (↑) optgroupe također prikazuju sve tipove, ne samo text

**Fail:** Boolean ili number atributi i dalje nedostaju iz dropdown liste

---

## T-S95-3: "→ true" hint uklonjen iz AttributeInput

**Preduvjet:** Atribut koji ima depends_on na boolean parent (ili bilo koji parent)

**Koraci:**
1. Otvori app (TEST), navigiraj na Add Activity za kategoriju s depends_on atributom
2. Postavi parent atribut na neku vrijednost (npr. Rate?=Da/true)
3. Zavisno polje se prikazuje
4. Provjeri da **ispod** zavisnog polja NEMA sivi tekst "→ true" ili "→ [vrijednost]"

**Očekivano:**
- Nema "→ {dependencyValue}" teksta ispod polja
- Polje se i dalje normalno prikazuje/skriva prema parent vrijednosti

**Fail:** "→ true" ili slični tekst i dalje vidljiv ispod zavisnog polja

---

## T-S95-4: Console cleanup — nema debug logova iz parseValidationRules

**Preduvjet:** Bilo koja stranica koja učitava atribute (Add Activity, Edit Activity, View Activity)

**Koraci:**
1. Otvori DevTools konzolu (F12)
2. Otvori Add Activity za bilo koju kategoriju s atributima
3. Provjeri konzolu

**Očekivano:**
- Nema `[parseValidationRules]` logova u konzoli
- Nema `[useAttributeDefinitions]` debug logova za exercise_name/Strength_type
- Normalne greške/warningovi (ako ih ima) ostaju

**Fail:** Debug logovi i dalje prisutni u konzoli

---

## T-S95-5: depends_on visibility radi za non-text atribute (regression check)

**Preduvjet:** Financije_3 area s konfiguracijom: Uplata/Isplata/Stanje ovise o Smjer atributu

**Koraci:**
1. Otvori Add Activity → Financije_3 > Transakcija
2. Smjer = "Uplata" → provjeri da je Uplata polje vidljivo, Isplata skriveno
3. Smjer = "Isplata" → provjeri da je Isplata polje vidljivo, Uplata skriveno
4. Smjer = prazan → oba polja skrivena
5. Stanje polje nikad vidljivo (WhenValue=SKRIVENO)

**Očekivano:**
- Identično ponašanje kao prije bugfixa — depends_on visibility za text atribute nije regresirala
- Hide-if-default logika i dalje radi (Status/Valuta skriveni ako su na defaultu)

**Fail:** Visibility ne radi, ili polja koja su prije bila ispravno skrivena/prikazana sad ne rade

---

## T-S95-6: Comment template — Structure Edit UI (Area)

**Preduvjet:** `sql/026_category_settings.sql` pokrenut na TEST bazi

**Koraci:**
1. Otvori Structure tab → Edit Mode
2. Klikni ⋮ na **Financije_3** area → Edit
3. Ispod "Disable Save+" trebao bi se vidjeti "Auto-comment template" polje
4. Klikni "**+ slug**" dropdown → vidi listu svih atribut slugova iz areae
5. Odaberi `napomena` → u input se doda `{napomena}`
6. Rukom dodaj ` ({tip})` → template je `{napomena} ({tip})`
7. Preview ispod: `[napomena] ([tip])`
8. Klikni Save → toast success

**Očekivano:**
- Template polje vidljivo samo za Area nodove (i leaf — vidi T-S95-7)
- Slug dropdown sadrži sve slugove iz svih kategorija u areji
- Preview prikazuje resolved slugove u uglatim zagradama
- Save sprema u `areas.settings.comment_template`

**Fail:** Polje nije vidljivo, slug dropdown prazan, Save ne sprema template

---

## T-S95-7: Comment template — Structure Edit UI (Leaf override)

**Preduvjet:** T-S95-6 prošao (area ima template)

**Koraci:**
1. Klikni ⋮ na **Transakcija** leaf → Edit
2. "Auto-comment template" polje vidljivo
3. Placeholder prikazuje `Inherited: {napomena} ({tip})`
4. Hint: "Inherited from Area. Set a value here to override."
5. Upiši `{napomena} · {iznos}` → hint promijeni na "Overrides Area template"
6. Obriši override (vrati na prazno) → hint se vrati na "Inherited from Area"
7. Ostavi prazno → Save

**Očekivano:**
- Leaf koristi area template ako nema vlastiti override
- Kad leaf ima vlastiti template, prikazuje "Overrides Area template"
- Slug dropdown prikazuje slugove iz leaf + ancestor atributa

**Fail:** Inheritance ne radi, override se ne sprema, slug dropdown prazan

---

## T-S95-8: Comment template — evaluacija na Finish (happy path)

**Preduvjet:** Area Financije_3 ima template `{napomena} ({tip})` (postavljen u T-S95-6)

**Koraci:**
1. Add Activity → Financije_3 > Transakcija
2. Popuni: Smjer=Isplata, Isplata=50, Tip=Dom/hrana, Napomena=Kruh i mlijeko
3. **NE upisuj ništa u Event Note** (ostavi prazno)
4. Klikni Finish

**Očekivano:**
- Event se spremi s comment = "Kruh i mlijeko (Dom/hrana)"
- Provjeri View Activity → comment prikazuje evaluirani template

**Fail:** Comment je prazan (template se ne evaluira), ili sadrži literal `{napomena}`

---

## T-S95-9: Comment template — user note ima prednost

**Preduvjet:** Isti template kao T-S95-8

**Koraci:**
1. Add Activity → Financije_3 > Transakcija
2. Popuni atribute (Napomena=Test, Tip=Restoran)
3. Upiši u Event Note: "Moj komentar"
4. Klikni Finish

**Očekivano:**
- Event comment = "Moj komentar" (korisnički unos, ne template)
- Template se ignorira kad korisnik ručno upiše note

**Fail:** Comment je template rezultat umjesto korisnikovog unosa

---

## T-S95-10: Comment template — prazni atributi u templateu

**Preduvjet:** Isti template `{napomena} ({tip})`

**Koraci:**
1. Add Activity → Financije_3 > Transakcija
2. Popuni: Smjer=Isplata, Isplata=20
3. **NE popunjavaj** Napomena ni Tip (ostavi prazne)
4. Event Note ostavi prazan
5. Klikni Finish

**Očekivano:**
- Template evaluira u ` ()` → trimmed to `()` ili prazan
- Ako je rezultat prazan/beznačajan → comment ostaje null (ne sprema se prazni string)

**Fail:** Comment sadrži literal `{napomena}` ili besmisleni string

---
