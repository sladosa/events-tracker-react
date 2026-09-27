# S152 — detaljni testovi (2026-09-26)

> Sesija: B1 (jedan graditelj `validation_rules`), B2 (alat umirovljen), C1 korak 3
> (razvrstač izvoda), C2 + C3 (datumi rata / Edit datuma) i usput nađen kvar s UTC datumom.
> Sve je na `test-branch`, **nije na `main`** ⇒ ručni testovi idu na lokalnom dev serveru.
> `npm run dev` = **TEST**, `npm run dev:prod` = **PROD** — provjeri banner prije nego vjeruješ ekranu.
> ⚠ Poslije svakog `git pull` / prelaska grane: **Ctrl+Shift+R** (stari bundle, S118).

---

## T-S152-1 ✅ (S153) Structure uvoz nakon Save u panelu ne javlja lažne promjene (B1)

**Što je popravljeno:** `BUG-S117-RULESHAPE`. Panel je spremao pravila u drugom obliku nego
uvoz, pa je svaki uvoz nakon spremanja panela javljao npr. `Attributes updated 9` bez ijedne
promjene. Isto su `Automation rules N` i `List columns N` brojali retke sheeta.

**Gdje:** `npm run dev` (**TEST**), tvoja Area koja ima barem jedan atribut s `DependsOn`
(ako nema — u Edit Mode dodaj jedan s `+ Add Dependency` i spremi, to je ionako korak 2).

1. Structure → Edit Mode → otvori kategoriju s `depends_on` atributom → **Save bez ikakve izmjene.**
2. Structure → **Export** (spremi file).
3. Structure → **Import** istog filea, bez ikakve izmjene u Excelu.
4. **Očekivano:** `Attributes updated` = **0**. Redovi `Automations changed (areas)` /
   `List columns changed (areas)` ili ne postoje ili su **sivi 0**.
5. Protuprovjera (da brojač i dalje vidi pravu promjenu): u fileu jednom atributu dodaj
   opciju u `TextOptions`, uvezi → `Attributes updated` = **1**.

**Pad:** korak 4 pokaže `> 0` ⇒ uvoz i dalje uspoređuje oblik. Otvori DevTools konzolu —
`[Import dirty]` ispisuje `dbRules` i `xlRules` za svaki takav atribut; to je dokaz za popravak.

---

## T-S152-2 ✅ (S153) „Other" ne briše `default_map` ni „Hidden in Add" (B1)

**Što je popravljeno:** upis nove vrijednosti kroz „Other" u Add/Editu gradio je pravilo
atributa **iz nule** i brisao sve osim popisa opcija. Na PROD-u bi to pogodilo `Status`
(default `Mastercard → Planiran` bi nestao) i `Stanje`/`Valuta` (vratili bi se u Add formu).
Automatski test to već čuva; ovo je potvrda u pravom pregledniku.

**Gdje:** `npm run dev` (**TEST**), tvoja Area — nikako `Financije_all` na PROD-u.

**Priprema (panel):** u jednoj kategoriji napravi (ili iskoristi postojeći):
- atribut **A** s `DependsOn` na neki atribut roditelj, s barem jednim `WhenValue` retkom koji
  ima **default** (treće polje);
- atribut **B**, obični `suggest`, s kvačicom **Hidden in Add**.

1. Add Activity u toj kategoriji → odaberi roditelja za A → u A odaberi **Other** i upiši
   `TestNovo` → Finish.
2. Structure → Edit panel te kategorije → **Očekivano:** A još ima svoj **default** u retku
   `WhenValue`, a `TestNovo` je među opcijama za tu vrijednost roditelja.
3. Otvori taj zapis u **Edit** → u B odaberi **Other**, upiši `TestB` → Save.
4. Edit panel → **Očekivano:** B **i dalje ima kvačicu Hidden in Add**, a `TestB` je u opcijama.
5. Add Activity → **Očekivano:** B se i dalje ne prikazuje.

**Pad:** nestao default (2) ili kvačica (4) ⇒ neko mjesto i dalje gradi pravilo iz parsiranog oblika.

---

## T-S152-3 ⬜ Panel: nema više polja „Default options" (B1)

**Što se promijenilo:** polje „Default options (when no WhenValue matches)" je uklonjeno.
Izvoz ga nikad nije nosio, pa ga je prvi Excel roundtrip brisao. Isto radi redak `WhenValue = *`.

1. `npm run dev` → Edit Mode → atribut s `DependsOn`.
2. **Očekivano:** ispod `WhenValue` redaka nema tekstnog polja „Default options"; umjesto njega
   piše *„Fallback: add a row with WhenValue `*` …"*.

---

## T-S152-4 ⬜ Rata na Visi kupljenoj 1.–3. u mjesecu — prva rata ISTI mjesec (C2)

**Što je popravljeno:** rata modal je imao vlastiti rječnik datuma (uvijek „od sljedećeg
mjeseca"), pa je Visa kupovina 1.–3. dobila prvu ratu **mjesec prekasno**. Sada rata koristi
isto pravilo kao `Datum naplate` (`cutoff:3:5`).

**Gdje:** `npm run dev:prod` (**PROD**), pod **tvojim** računom (grantee smije dodati i
obrisati vlastite retke). Visa retci **ne miču saldo**, ali retke ipak obriši na kraju.

1. `+` → `Financije_all / Transakcija` → datum **02.09.2026.**, `Izvor = Visa`,
   `Isplata = 30`, `Rate? = da`, `Broj rata = 3`, opis `TEST S152 rata` → Finish.
2. **Očekivano u rata modalu:** datumi naplate **05.09.2026., 05.10.2026., 05.11.2026.**
   (prije popravka: 05.10., 05.11., 05.12.).
3. Prihvati → u listi 3 retka; svakom `Datum naplate` kao u modalu, iznosi `10,00` × 3.
4. Kontrola (MC se NE smije promijeniti): isto s `Izvor = Mastercard`, datum **26.09.2026.**,
   2 rate → **11.10.2026., 11.11.2026.**
5. **Obriši** sve retke `TEST S152 rata`.

⚠ Test mora koristiti dan **1.–3.** — od 4. nadalje staro i novo daju isto (S129 pravilo:
redak se bira tako da se razlikuje od onoga što je davao stari kod).

**Pad:** prva Visa rata `05.10.` ⇒ modal ne vidi `attribute_rules` (provjeri je li Area
učitala `settings.automations`).

---

## T-S152-5 ⬜ Edit: promjena datuma pomiče `Datum naplate` za Racun, ne za karticu (C3)

**Što je popravljeno:** redak `Izvor = Racun` kojem u Editu promijeniš datum ostajao je sa
starim `Datum naplate`.

**Gdje:** `npm run dev:prod`, **tvoj** redak. **Ništa se ne sprema** — gleda se samo forma.

1. Otvori u **Edit** jedan svoj redak s `Izvor = Racun` (ili `Cash`). Zapamti `Datum naplate`
   (mora biti isti dan kao datum retka).
2. U zaglavlju promijeni **datum** za 2 dana unatrag.
3. **Očekivano:** `Datum naplate` se pomaknuo na novi dan.
4. Promijeni datum još jednom (npr. natipkaj godinu znamenku po znamenku) → **Očekivano:**
   `Datum naplate` prati i na kraju je isti kao datum retka.
5. **Zatvori bez spremanja** (✕ / Cancel).
6. Isto s retkom `Izvor = Visa` ili `Mastercard` → **Očekivano:** `Datum naplate` se **ne mijenja**.
   Zatvori bez spremanja.

⚠ **Poznato uže od tvoje odluke (v. C3b u `BACKLOG_2026-09-26_S152.md`):** odluka je bila
„samo retci bez žiga izvoda, i Racun i kartice". Izvedeno je: samo Racun/Cash, i **bez**
provjere žiga — dakle i ožigosan Racun redak će se pomaknuti. Ovaj test mjeri ono što je izvedeno.

**Pad:** korak 3 ne pomakne ⇒ provjeri je li `Izvor` doista `Racun` i je li stari `Datum
naplate` bio isti dan kao datum retka (ako nije, namjerno se ne dira — ručni unos).

---

## T-S152-6 ⬜ Filtar „This Month" pokriva cijeli mjesec (UTC datum)

**Što je popravljeno:** predlošci perioda računali su dan u UTC-u. Izmjereno 26.09.2026.:
„This Month" = **31.08. → 29.09.** (30.09. izostavljen, 31.08. uključen), „This Year" =
**31.12.2025. → 30.12.2026.** Isti kvar u zaglavlju Add/Edita (između 00:00 i 02:00 pokazuje
jučer) i u `event_date` pri spremanju Edita u tom prozoru.

**Gdje:** `npm run dev` ili `dev:prod`, bilo koja Area.

1. Activities → period **This Month** → **Očekivano:** raspon **01.09.2026. – 30.09.2026.**
2. **This Year** → **01.01.2026. – 31.12.2026.**
3. (ako postoji redak s datumom 30.09. ili 31.08.) 30.09. je u listi, 31.08. nije.

---

## T-S152-7 ⬜ Razvrstač na PRAVOM novom izvodu (C1 korak 3)

**Što je novo:** `razvrstaj_izvode.py` — iz Kokine OneDrive mape `Izvodi` prepozna izvod po
sadržaju i **kopira** ga u `izvodi/TIP_YYYY-MM.pdf`. Kokina mapa se ne dira.

**Kad:** čim Koka pošalje sljedeći izvod (ZABA rujan ili RF).

1. `Financije\run.bat razvrstaj_izvode.py` (dry run) → **Očekivano:** redak `KOPIRAJ` s
   točnim tipom i mjesecom (npr. `ZABA 2026-09, N transakcija -> izvodi/ZABA_2026-09.pdf`);
   PBZ „Detalji transakcije" i dalje `OSTAJE`.
2. `... razvrstaj_izvode.py --apply` → file je u `data-prep_data\Financije\izvodi\`, a u
   `C:\0_Sasa\OneDrive\Izvodi` je original **i dalje**.
3. Ponovi korak 1 → **Očekivano:** isti file je `vec imamo`.

**Pad:** izvod završi kao `OSTAJE … nije izvod koji znamo` ⇒ format se promijenio (ili RF
„Save as PDF" umjesto pravog izvoda) — pošalji mi ispis.

---

## T-S152-8 ✅ `make_financije_all_structure.py` staje nad postojećom Areom (B2)

✅ **Izmjereno u S152:** `--base Financije_all_structure_20260922_S145.xlsx` ⇒
`STOP: BASE vec sadrzi Areu 'Financije_all' (49 redaka)`, exit 1; stari export `Financije`
(31.07.) prolazi kao prije (`--dry`, exit 0).

## T-S152-9 ✅ Razvrstač: stvarni inbox + pješčanik (C1 korak 3)

✅ **Izmjereno u S152:** pravi inbox ⇒ PBZ „Detalji transakcije" `OSTAJE`. Pješčanik (kopije
`ZABA_2026-08` i `MC_2026-08` pod generičkim imenima): `KOPIRAJ` oba; ponovno pokretanje
`vec imamo` (2); isti izvod s drugim bajtovima `vec imamo (iste transakcije)`; podmetnut
drugi sadržaj pod istim imenom `OSTAJE … nista nije prepisano`.
