# S114 — detaljni testovi (2026-08-22)

**Tema sesije:** tranša 3 (ZABA) uvezena i potvrđena **ispisanim** `NOVO STANJE` ·
`--koka` spojen na ZABA retke s uskim prozorom · `klasificiraj_transu.py` (Tip/Podtip iz
izbrojane povijesti, parovi provjereni protiv `DropdownData`).

**Prošlo uživo, bez zasebnog testa:**

- **T-S113-3 ✅** — tranša 3: 38 transakcija na `ZABA_2026-07.pdf`, 7 već u bazi, 31 novih.
  Uvoz `31 New / 1 Modify / 7 Unchanged`, kontrolni stupac na 30.07. = **13.815,33**, u cent
  jednako ispisanom `NOVO STANJE`.
- **Klasifikacija** — drugi uvoz `0 New / 28 Modify / 4 Unchanged`.

---

## T-S114-1 ⭐ Sidro ZABA na 30.07.2026. = 13.815,33

**Zašto:** lanac je zatvoren protiv vanjskog broja, ali sidro **možda nije postavljeno** — na
kraju sesije nije potvrđeno. Bez njega saldo i dalje putuje kroz cijeli srpanj unatrag, a
sljedeći delta prozor kreće od izračunatog stanja umjesto od potvrđenog.

1. Overview → Area `Financije_all` → pločica `Kokin tekući ZABA`.
2. Provjeri prikazuje li čip sidro s datumom **30.07.2026.**
   - **Očekivano:** sidro postoji, iznos `13.815,33`, u bilješci stoji izvor
     (*ispisano `NOVO STANJE`, `ZABA_2026-07.pdf`*).
   - **Pad:** nema sidra ⇒ postavi ga sada; ⚠ **broj mora doći s izvoda, nikad iz pločice**
     (§2.17 — inače Δ postane trajno nula i usklađenje je mrtvo bez ijedne greške).
3. Izvezi delta sheet za taj račun.
   - **Očekivano:** prozor kreće **31.07.** (dan nakon `confirmed_on`), otvarajuće stanje
     `13.815,33` i **označeno kao potvrđeno**, ne kao izračunato.
   - **Pad:** prozor kreće 30.07. ⇒ redak datiran na dan sidra bi se dvostruko brojao.

---

## T-S114-2 ⭐ Klasifikacija je stvarno u bazi (a ne samo u Excelu)

**Zašto:** uvoz je javio `28 Modify`, ali `Tip`/`Podtip` su atributi — a P3 kaže da prazno
nikad ne prepisuje puno. Ako bi guard negdje preskočio atribut, izvještaj bi svejedno rekao
„updated".

1. Activities → filtar na `Financije_all`, raspon **01.07.–31.07.2026.**
2. Nađi redak `2026-07-14` s iznosom `225,79`.
   - **Očekivano:** `leaf comment` = `T-mobile`, `Tip` = `Informatika`,
     `Podtip` = `Komunikacije_T-mobile`.
   - **Pad:** `Tip` prazan ili `N/A`.
3. Nađi bilo koji od šest redaka po `0,70` (13., 27. ili 30.07.).
   - **Očekivano:** `leaf comment` = **`Parking`** (opis je namjerno prepisan),
     `Tip / Podtip` = `Prijevoz / Taksi, Zet, Parking`.
   - **Pad:** ostao `Kreditni transfer nacionalni u eurima…` ⇒ upisan bi bio krivi razred
     (`Domaćinstvo / Bankovni troškovi`, 12× u povijesti).
4. Nađi `2026-07-11`, isplata `1.244,74`.
   - **Očekivano:** `Status` = `Izvrsen`, `Tip / Podtip` = `Transfer / izmedju racuna`.
   - **Pad:** `Planiran` ⇒ kontrolni stupac sljedećeg prozora bit će viši za točno `1.244,74`.

---

## T-S114-3 Uski prozor sparivanja ne krade opise (regresija)

**Zašto:** `--koka` je na ZABA retcima dobio prozor `0/+1` dana umjesto kartičnih `−3/+45`.
Da je ostao široki, `Cash 100,00` bi pokupio opis nekog kasnijeg podizanja — tiho, jer se iznos
i dalje slaže.

**Preduvjet:** `transa3.xlsx` (netaknut original) i `ZABA_2026-07.pdf`.

1. Iz korijena projekta (⚠ **ne** iz `data-prep_data\Financije` — putanje su relativne prema
   korijenu):
   ```
   data-prep_tools\Financije\run.bat fill_from_izvod.py data-prep_data\Financije\transa3.xlsx --zaba data-prep_data\Financije\izvodi\ZABA_2026-07.pdf --koka "data-prep_data\Financije\Financije 2026-08-16.xlsx" --dry
   ```
2. Pogledaj završnu liniju.
   - **Očekivano:** `Kokini opisi: 30 spareno, 8 bez para`.
   - **Pad na 0 spareno:** `zaba_rows()` opet ne zove `koka.find()` — ⚠ ispis tada **ne javlja
     grešku**, nego `0 spareno, 0 bez para`, što se čita kao „pokušano i ništa nije našlo".
   - **Pad na >30:** prozor je opet širok ⇒ provjeri je li koji `Cash`/`Parking` redak dobio
     opis s krivog datuma.
3. Provjeri redak `2026-07-17` `9,51`.
   - **Očekivano:** `Zoran povrat` (kod nje je datiran 18.07. — zato prozor ide do `+1`).
   - **Pad:** ostao strojni tekst ⇒ prozor je stegnut na `0/0`.

---

## T-S114-4 Brana taksonomije u `klasificiraj_transu.py`

**Zašto:** podtip koji ne postoji u `validation_rules` uveze se kao **običan tekst** i ne javi
grešku; vidi se tek kad ga dropdown poslije odbije — a tada je već u bazi.

1. U `PO_OPISU` privremeno pokvari jedan podtip (npr. `Komunikacije_T-mobile` →
   `Komunikacije_T-mobil`).
2. Pokreni s `--dry`.
   - **Očekivano:** `✗ Par ne postoji u taksonomiji: Informatika / Komunikacije_T-mobil` i
     **izlaz prije nego se target uopće otvori**.
   - **Pad:** skripta nastavi i ispiše redak za upis.
3. Vrati original.

---

## T-S114-5 Izvještaj o uvozu nema dropdowne (nalaz, ne popravak)

**Zašto:** izvještaj je mišljen kao radni file u kojem se dorađuje uvezeno. Bez `DropdownData`
lista Koka bi `Tip`/`Podtip` tipkala kao slobodan tekst, bez ijedne provjere.

1. Otvori bilo koji `import_report_*.xlsx`.
   - **Zatečeno stanje (S114):** listovi su `Events / HelpEvents / ImportReport / Filter` —
     **nema** `DropdownData`, pa ćelije `Tip`/`Podtip` nemaju padajući izbornik.
2. Usporedi s običnim exportom (`transa3.xlsx`): ondje `DropdownData` postoji.

**Ovo je trenutno u „Open bugs", nije popravljeno.** Test služi da se zna kad se popravi.
