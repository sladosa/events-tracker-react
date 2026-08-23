# S116 — detaljni testovi

**Sesija:** 2026-08-23 · kolone Activities liste po Arei · `--iz-koke` izvor · **popravak BUG-S115-ANCHORDATE**
**Commiti:** `3e0af00` (kolone), `7f562a4` (--iz-koke), + commit s kontrolama sidra

---

## T-S116-1 ⭐ — Kolone po Arei: Financije

**Preduvjet:** `test-branch`, TEST baza, Area `Financije_all`, config već upisan
(`set_list_columns.py --write`, izvedeno u S116).

1. Otvori app, Activities tab, filter Area = **Financije_all**.
2. Pogledaj zaglavlje tablice na širokom ekranu.

**Očekivano:** `Datum | Iznos | Tip / Podtip | Opis | User | Stanje | ⋮`
(kolona `User` samo ako je Area podijeljena; `Stanje` samo kad je lista filtrirana
na jedan račun i sortirana najnovije-prvo — inače se sama sakrije).

**Pad:** i dalje `Date | Time | Category | Events | Comment`. Znači da
`settings.list_columns` nije pročitan — provjeri
`python set_list_columns.py --show` i `useAreaDashboard`.

3. Pogledaj vrijednosti u koloni `Iznos`.

**Očekivano:** uplate zeleno s `+`, isplate crveno s `−`, hr format `1.234,56 €`.
Redak bez ijednog iznosa prikazuje `—`, **nikad `0,00`**.

**Pad:** `0,00` na praznom retku ⇒ `PairCell` čita `?? 0` umjesto `!= null`.

4. Nađi redak koji ima **i uplatu i isplatu** (ZABA `Anja 73/96`, 25.08.2025.).

**Očekivano:** obje strane u istoj ćeliji, `+450,00 € · −0,70 €`.

**Pad:** prikazana samo jedna ⇒ pola transakcije je nevidljivo, a to nije greška
u podacima nego vjeran spoj dvaju redaka izvoda.

---

## T-S116-2 — Generička Area ostaje netaknuta

1. Prebaci filter na bilo koju drugu Areu (npr. `Health_Saša`, `Fitness_Garmin`).

**Očekivano:** `Date | Time | Category | Events | Comment | ⋮` — točno kao prije
S116, uključujući to da `Comment` i `User` nestaju ispod `lg` širine.

**Pad:** promijenjen izgled bilo koje druge Aree ⇒ `resolveColumns` ne pada na
`DEFAULT_COLUMNS`, ili je `desktopHide` primijenjen krivo.

---

## T-S116-3 — Uski ekran, dva reda

1. Suzi prozor ispod 640 px (ili otvori na mobitelu) uz Areu `Financije_all`.

**Očekivano:** dva reda po transakciji —
red 1: `datum` lijevo, `iznos` **desno uz rub**, avatar ako je Area podijeljena;
red 2: `Tip / Podtip · Opis`.
`Stanje` se ne prikazuje. `⋮` je sticky uz desni rub.

**Pad:** iznos u drugom redu ili razlomljen ⇒ `mobile` uloga nije primijenjena
(`ml-auto` na `align: right`).

---

## T-S116-4 ⭐ — Roundtrip: `ListColumns` sheet

**Ovo je test principa „sve ide importom", ne kozmetike.**

1. Structure tab → Export (scope: `Financije_all`).
2. Otvori xlsx, nađi list **`ListColumns`**.

**Očekivano:** 7 redaka (`date`, `pair`, `attr`, `comment`, `user`, `balance`,
`actions`), kolone `Area | Role | Label | Slugs | Plus | Minus | Sep | Unit |
Mobile | Width | Align`. Ispod podataka HELP blok sivim kurzivom.

3. U `Label` retka `comment` promijeni `Opis` → `Opis transakcije`. Snimi.
4. Structure tab → Import tog filea.

**Očekivano:** u rezultatu piše `List columns 7`; nakon zatvaranja modala
Activities lista ima zaglavlje `Opis transakcije`.

**Pad A:** `List columns 0` ⇒ import ne nalazi sheet (ime lista je case-insensitive
`listcolumns`) ili zaglavlje.
**Pad B:** `List columns skipped` > 0 ⇒ pogledaj konzolu, ispisuje razlog po retku
(nepoznata uloga / nepoznat slug / nepoznata Area).

5. **Obriši sve retke** `ListColumns` sheeta za `Financije_all` i uvezi ponovno.

**Očekivano:** lista se vraća na zadanu (`Date | Time | Category | …`) —
prazan popis znači „vrati zadano", a ključ `list_columns` se iz `settings` **briše**,
ne piše kao `{columns: []}`.

⚠ **Nakon ovog koraka vrati config:** `python set_list_columns.py --write`.

---

## T-S116-5 — Rename sluga povlači kolone

1. Structure tab → Edit Mode → `Financije_all > Transakcija` → atribut `Tip`.
2. Promijeni slug `tip` → `tip_transakcije`. Snimi.

**Očekivano:** toast `Kolone liste: 1 reference updated to "tip_transakcije"`,
i kolona `Tip / Podtip` u Activities i dalje pokazuje vrijednosti.

**Pad:** kolona ostane prazna ⇒ `fixupListColumnsSlug` se ne poziva ili ne hvata
`slugs[]`. ⚠ Prazna kolona zbog mrtve reference izgleda **isto** kao prazna zbog
nedostatka podatka — zato je ovo test, a ne pretpostavka.

3. **Vrati slug natrag** na `tip`.

---

## T-S116-6 ⭐ — Sidro ZABA na 30.07.

**Konkretan slučaj; mehanizam pokrivaju T-S116-10…13.**
⚠ Saša je ispravio redak ručno u Supabase editoru (izmjena postojećeg retka, ne novo sidro),
pa je provjera samo očitanje stanja.

1. `python anchors.py` — `►` mora stajati na `2026-07-30 = 13.815,33` s bilješkom
   `ispisano stanje s izvoda · ZABA_2026-07.pdf (izvod zatvoren 30.07.)`; sidra na `22.08.` nema.
2. Otvori Overview za `Financije_all`, filter „All time”.

**Očekivano:** pločica `Kokin tekući ZABA` pokazuje `13.815,33 €` uz kvačicu,
a zaglavlje navodi potvrdu od **30.07.2026.**

**Pad:** i dalje 22.08. ⇒ brisanje nije prošlo (`--delete` javlja ako je DELETE
vratio 0 redaka; RLS-blokiran DELETE inače „uspije").

---

## T-S116-7 ⭐ — Uvoz kolovoza ZABA (14 redaka)

**Kontrolni broj: `13.239,31` na 13.08.2026.**

**Preduvjet:** T-S116-6 prošao (sidro na 30.07.).

1. Activities → filter Area `Financije_all`, atribut `Racun = Kokin tekući ZABA`.
2. Export → **Delta sheet**, prozor koji pokriva 31.07.–danas,
   **broj praznih redaka ≥ 60** (⚠ zadanih 40 nije dosta; redak koji ne stane u
   pripremljene prazne pada izvan raspona kontrolnog stupca i brojka ostane
   uvjerljiva i nepotpuna).
3. Pokreni:

```
cd C:\0_Sasa\events-tracker-react\data-prep_tools\Financije
python fill_from_izvod.py "<delta sheet>.xlsx" ^
  --iz-koke "..\..\data-prep_data\Financije\Financije 2026-08-23.xlsx" ^
  --sheet "koka EU" --tip-racuna "Kokin tekuci" ^
  --od 2026-07-31 --do 2026-08-13 --osim 2564 --klasificiraj ^
  --lanac 2026-07-30=13815.33 --dry
```

**Očekivano na `--dry`:** `14 novih, 0 vec na listu` i
`Kokin lanac: 13815.33 @ 2026-07-30 + 59 redaka do 2026-08-13 = 13239.31`.

**Pad:** broj različit od 14 ⇒ njen file se promijenio otkad je mjeren; **stani**
i usporedi verzije prije nego išta uđe.

4. Ponovi bez `--dry`, uvezi `_filled.xlsx` kroz app.
5. Overview, filter do 13.08.2026.

**Očekivano:** ZABA pločica `13.239,31 €`.

**Pad:** `13.240,91` (= +1,60) ⇒ ušao je redak 2564. Isti razred kao retci iz 2036.

⚠ **Skupna MC naplata `1.332,52` NIJE u ovih 14 redaka.** Ona dolazi s
`MC_2026-07.pdf` i uvozi se zasebno (`--zaba`/`--visa` put) — ne sintetizira se.
Bez nje pločica na 13.08. neće dati `13.239,31`.

---

## T-S116-8 — Uvoz kolovoza RF (1 redak)

**Kontrolni broj: `796,43`.**

1. Export delta sheet za `Racun = Sašin tekući RF`.
2. Pokreni isto, sa `--sheet "sasa EU" --tip-racuna "Sasin tekuci"
   --racun "Sašin tekući RF" --od 2026-08-12 --lanac 2026-08-11=799.12`.

**Očekivano:** `1 novih`, redak `red 977  2026-08-18  Isplata 2,69  RF naknada`,
lanac `= 796.43`.

3. Uvezi, provjeri pločicu.

**Očekivano:** RF `796,43 €`.

---

## T-S116-9 — Zaštita: krivi račun u delta sheetu

1. Uzmi **ZABA** delta sheet i pokreni alat sa `--tip-racuna "Sasin tekuci"`.

**Očekivano:** alat **stane** s porukom
`File je za račun 'Kokin tekući ZABA', a izvor traži 'Sašin tekući RF'.`

**Pad:** alat piše retke ⇒ tuđi retci pod tvojim računom, plus kontrolni stupac
koji ih ne broji. (Provjereno da radi u S116 — ovo je regresijski test.)

---

## T-S116-10 ⭐ — Datum potvrde dolazi iz izvora, ne iz klika

**Ovo je popravak BUG-S115-ANCHORDATE. Prije S116 je gumb uvijek nudio dan koji gledaš.**

**Preduvjet:** Overview za `Financije_all`, write pristup.

1. U polje „u banci" upiši bilo koji broj. **Ne diraj „odakle".**

**Očekivano:** gumb `Potvrdi` je **onemogućen**, a ispod stoji žuti tekst da treba
odabrati odakle je broj.

**Pad:** gumb aktivan ⇒ izvor nije obavezan, pa app opet mora pogađati datum.

2. Odaberi **`ekran bankovne aplikacije`**.

**Očekivano:** polja za datum **nema**, gumb piše samo `Potvrdi`, a ispod se pojavi
sivi okvir s računicom (v. T-S116-14).

3. Prebaci na **`ispisano stanje s izvoda`**.

**Očekivano:** pojavi se **prazno** polje za datum, **žuto obrubljeno**; gumb se
**ugasi** i piše samo `Potvrdi`. Ispod stoji objašnjenje da izvod ne završava na kraju
mjeseca.

**Pad A:** polje prefilano bilo kojim datumom ⇒ to je isti pogodak koji je proizveo bug.
**Pad B:** gumb ostane aktivan ⇒ potvrda bi prošla bez datuma.

4. Upiši `2026-07-30`.

**Očekivano:** gumb piše `Potvrdi na 30.07.2026.`

5. Pokušaj upisati datum u budućnosti (npr. `2027-01-01`).

**Očekivano:** `input[type=date]` ima `max=danas`; ako ga zaobiđeš, `saveAnchor()`
odbija s porukom „Datum potvrde ne može biti u budućnosti."

---

## T-S116-11 — Rečenica o posljedici prije klika

1. Uz upisan broj i datum, pročitaj sivi tekst ispod reda.

**Očekivano:** *„Saldo će se računati ovako: **13.815,33 €** plus sve što je datirano
**nakon 30.07.2026.** Sve prije toga smatra se da je **već uključeno** u ovaj broj…"*

**Zašto je to test, a ne kozmetika:** ta bi rečenica uz datum `22.08.` tvrdila da su
retci od 31.07. nadalje već uključeni — što je bilo očito netočno. Rečenica je provjera.

**Pad:** rečenica ne spominje datum ili ne spominje „prije toga" ⇒ ne prenosi pravilo
„strogo nakon" i test nema vrijednosti.

---

## T-S116-12 ⭐ — Upozorenje kad novija potvrda već postoji

**Ovo je trap koji je ugrizao dvaput (S111 tipfeler, S115 krivi datum).**

1. Na računu koji ima potvrdu na noviji datum, pripremi potvrdu na **stariji** datum.

**Očekivano:** crveni tekst — *„Za ovaj račun već postoji potvrda na <datum> (<iznos>).
Nova na <stariji datum> je **neće** nadjačati…"*

**Pad:** nema poruke ⇒ korisnik upiše ispravak koji ništa ne ispravlja, a izgleda kao da je
prošao. `036` bira najnoviju potvrdu s `confirmed_on <= as_of`.

---

## T-S116-13 ⭐ — Povijest potvrda + brisanje iz aplikacije

1. Ispod pločice klikni **„povijest potvrda (N)"**.

**Očekivano:** popis svih potvrda tog računa, najnovija prvo. **▸** označava onu od koje
saldo trenutno kreće (najnovija s datumom ≤ danas). Uz svaku stoji bilješka
(`ispisano stanje s izvoda · ZABA_2026-07.pdf`) ili *bez podrijetla* za stare zapise.

Za `Kokin tekući ZABA` očekuj **4**: `01.01.2025.`, `31.12.2025.`, `01.07.2026.`,
**▸ `30.07.2026. = 13.815,33`**.

2. Klikni ✕ na nekoj **test** potvrdi (⚠ ne na pravoj).

**Očekivano:** toast s datumom i iznosom, pločica se osvježi, saldo se prilagodi.

**Pad:** „obrisano" a redak ostane ⇒ RLS-blokiran DELETE „uspije" s 0 redaka;
`deleteAnchor()` to hvata i baca grešku — ako ne baci, guard je pao.

3. Kao **read-only grantee** otvori istu pločicu.

**Očekivano:** popis se vidi, ✕ **nema**.


---

## T-S116-14 ⭐⭐ — Očitanje s ekrana sidri se na JUČER

**Ovo je Sašin nalaz iz S116: sidro na *danas* baca današnje transakcije iz salda.**
`confirmed_on` je `date`, pa „strogo nakon" zna samo granicu *kraj dana* — a očitanje
s ekrana vrijedi za *trenutak*.

**Preduvjet:** Area `Financije_all`, write pristup, filtar **bez** datuma („All time").

### Dio A — računica se vidi prije klika

1. Zapamti današnji datum i **jučerašnji**.
2. Upiši broj u „u banci", odaberi `ekran bankovne aplikacije`.

**Očekivano:** sivi okvir s tri stvari —
(a) objašnjenje da očitanje vrijedi za trenutak a potvrda za cijele dane,
(b) računica `<očitano> + <današnji promet> = <iznos> na <jučer>`,
(c) upozorenje da app mora znati **sve** današnje transakcije.

⚠ Predznak: ako je danas bilo **troška**, mora pisati `+` (oduzimanje negativnog prometa
JEST zbrajanje). Ako piše `− −40,00`, prikaz je pao.

**Pad:** računice nema ⇒ `todayMove` se nije učitao; gumb mora biti **ugašen** uz crvenu
poruku „Osvježi pločicu", nikad aktivan.

### Dio B — današnja transakcija ostaje u saldu (jezgra testa)

3. Provjeri da danas **nema** zapisa na tom računu; potvrdi stanje s ekrana.

**Očekivano:** pločica pokazuje **točno očitani broj**; sidro je na **jučer**.

4. Dodaj novu aktivnost **s današnjim datumom**, iznos npr. `40,00` isplata,
   `Izvor = Racun`, `Status = Izvrsen`, isti račun.
5. Vrati se na Overview, osvježi (↻).

**Očekivano:** saldo je **manji za 40,00**.

**Pad — i to je cijeli razlog ovog testa:** saldo se **ne pomakne**. Znači da je sidro
palo na *danas*, pa redak datiran danas ne prolazi uvjet „strogo nakon" i **nikad neće**.

### Dio C — bilješka čuva sirovo očitanje

6. Otvori „povijest potvrda".

**Očekivano:** bilješka oblika
`ekran bankovne aplikacije · očitano 13.815,33 na 23.08.; oduzet promet toga dana −40,00 (1 zapisa)`
ili `…; toga dana nije bilo zapisa`.

**Zašto je to test:** spremljeni `amount` više **nije** broj koji je čovjek vidio. Bez sirovog
očitanja u bilješci sidro se za pola godine nema s čim usporediti — a §2.17 traži da potvrđeno
stanje bude sljedivo do nečega izvana.

### Dio D — prošli filtar

7. Postavi datumski filtar „do" na neki prošli datum i odaberi `ekran bankovne aplikacije`.

**Očekivano:** žuto upozorenje da je Δ iznad vezan za taj prošli datum i **nije usporediv** s
današnjim očitanjem. Gumb **ostaje aktivan** — potvrda je i dalje ispravna, samo usporedba nije.

**Pad:** nema upozorenja ⇒ kvačica „✓ slaže se" može se pojaviti nad dvama brojevima iz
različitih dana.

### Dio E — redoslijed koji jamči točnost

8. Simuliraj krivi redoslijed: **potvrdi s ekrana**, pa tek onda upiši transakciju koja se
   danas dogodila **prije** nego si pogledao banku.

**Očekivano:** saldo se pomakne za taj iznos — a **ne bi trebao**, jer je već bio u očitanom
broju. **To nije bug nego granica mehanizma** i zato uputa glasi: *prvo upiši današnje, pa
pogledaj banku i potvrdi.* Test postoji da se granica zna, ne da se popravi.
