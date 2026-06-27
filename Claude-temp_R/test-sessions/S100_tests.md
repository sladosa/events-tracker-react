# S100 Tests — Export Profile + BUG-S99-IMPORT + Dropdown fix

**Branch:** `test-branch`
**Datum:** 2026-06-27

---

## T-S100-1: BUG-S99-IMPORT fix — import ne matcha krivu kategoriju kad 2 aree imaju isti path

**Preduvjet:** PROD ili TEST baza s 2 aree koje imaju kategoriju s istim path-om (npr. "Transakcija" u Financije i Financije_old)

**Koraci:**
1. Exportaj evente iz jedne aree (npr. Financije, kategorija "Transakcija")
2. Importaj taj xlsx natrag
3. Provjeri da se eventi mapiraju na ispravnu kategoriju (u ispravnoj arei)

**Očekivano:** Import koristi composite key `area_name||full_path` — ako 2 aree imaju "Transakcija", svaka se matcha na svoju po Area koloni (col B).

**Fail kriterij:** Import greškom matcha na krivu area-u, duplikati nastanu u krivoj arei

---

## T-S100-2: Dependent dropdown za 'Izvor placanja' — dijakritici u opcijama

**Preduvjet:** Financije area s atributom "Izvor placanja" koji depends_on "racun" s opcijama koje sadrže dijakritike (Kokin tekući ZABA, Sašin tekući RF)

**Koraci:**
1. Exportaj Financije evente
2. Otvori xlsx u Excelu/LibreOfficeu
3. Na koloni "Izvor placanja" klikni dropdown

**Očekivano:** Dropdown prikazuje opcije (Direktno s racuna, Visa, Cash itd.) bazirano na odabranom računu. INDIRECT formula ispravno transliterira dijakritike (č→c, ć→c, š→s, ž→z, đ→d) u named range lookupu.

**Fail kriterij:** Dropdown ne radi, prikazuje #REF error, ili nema opcija

---

## T-S100-3: Export Profile — column order iz LEGEND-a

**Preduvjet:** Area s export profilom koji ima promijenjeni raspored kolona (npr. DPS_KokinZABA.xlsx)

**Koraci:**
1. Kreiraj xlsx s ručno pomaknutim kolonama + ažuriranim ATTRIBUTE LEGEND redovima (Col kolona odražava novu poziciju)
2. Import Profile u Export modalu
3. Exportaj s tim profilom

**Očekivano:** Kolone u exportanom xlsx-u su poredane prema redoslijedu LEGEND redova iz profila, NE prema defaultnom sort_order-u.

**Fail kriterij:** Kolone su i dalje u defaultnom redoslijedu (po Area > CategoryPath > sort_order)

---

## T-S100-4: Export Profile — column widths iz profila

**Preduvjet:** Profil importan iz xlsx-a koji ima custom column widths

**Koraci:**
1. U preview xlsx-u promijeni širine kolona (npr. "Uplata" šire, "Napomena" uže)
2. Import Profile
3. Exportaj s profilom

**Očekivano:** Kolone u exportanom xlsx-u imaju širine iz profila (ne defaultnih 13 za sve attr kolone)

**Fail kriterij:** Sve kolone imaju istu defaultnu širinu (13)

---

## T-S100-5: Export Profile — Filter sheet override

**Preduvjet:** Profil importan iz xlsx-a koji ima Filter sheet s podacima (Period key, Attribute filter itd.)

**Koraci:**
1. Exportaj xlsx s filtrom (npr. Period: this-year, Attribute filter: Racun = Sašin tekući RF)
2. U xlsx-u promijeni Filter sheet: Attribute filter = "Racun" = "Kokin tekući ZABA"
3. Import Profile s tim xlsx-om
4. Provjeri da profil prikazuje "📋 Profile includes filter overrides" u modalu
5. Exportaj s tim profilom

**Očekivano:** Export koristi filter override iz profila (Racun = Kokin tekući ZABA umjesto iz UI-a). Exportani podaci odgovaraju novom filteru.

**Fail kriterij:** Export koristi UI filter umjesto profil overridea

---

## T-S100-6: Export Profile — Filter sheet format za Attribute filter

**Preduvjet:** xlsx s Filter sheetom

**Koraci:**
1. U Filter sheetu, red "Attribute filter" postavi na: `<attrDefId>: =<value>` za exact match
2. Ili: `<attrDefId>: ~<value>` za partial match
3. Ili: obriši red za resetiran filter
4. Import Profile

**Očekivano:**
- `=` prefix → exact match (`isExact: true`)
- `~` prefix → partial match (`isExact: false`)
- Prazan/obrisan → nema attr filter overridea

**Fail kriterij:** Parser ne prepoznaje format, attr filter se ignorira

---

## T-S100-7: Import Profile toast prikazuje column order + widths info

**Preduvjet:** Bilo koji xlsx za import profila

**Koraci:**
1. Import Profile u Export modalu

**Očekivano:** Toast poruka kaže "N hidden cols, column order + widths" (ne samo "N hidden columns")

**Fail kriterij:** Toast nema "column order + widths" ili "filter overrides" tekst kad je primjenjivo
