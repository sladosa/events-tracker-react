> Pisano protiv commita **`e039fec`** (S148) + commit rituala S148 koji nosi ovaj file.
> ⚠ Ako `git log` pokazuje noviji commit od S148 rituala, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S148 (2026-09-24)

---

# DIO 1 — netehnički (za Sašu)

## Što je danas napravljeno

- **Visa košare su u cent od listopada 2024. do rujna 2026.** Banka je cijelo vrijeme bila
  točna. Višak od 784,81 € bili su tvoji ručni retci (sheet `sasa EU`) uvezeni **uz** iste
  retke s izvoda — isti dan dvaput, datum mjesec ranije, tipfeler u iznosu, ručna rata uz
  bankinu. Obrisano ili prebačeno u `Cash` prema tvojim odlukama.
- **Kolovoški Visa izvod je uvezen**: 37 redaka koje nitko nije upisao (~1.010 €).
- **PP 8,60 (23.09.)** je sada na Kokinom ZABA, kako si rekao — ZABA saldo pao za 8,60.
- Sve je išlo **Excel uvozom pod Kokinim računom**, nijedna skripta nije pisala u bazu.
- Jedan uvoz je napravio 7 duplikata — **moja greška** (krivi e-mail u koloni G), popravljeno
  istim putem. Zapisano da se ne ponovi.

## Što treba od tebe

1. **6 redaka bez Podtipa** (AGS Tuhelj, AZM Mokrice, Kvatric, GLS Stupnik, Jadrolinija,
   Studenac Orebić) — **Edit u appu** (nisu u import reportu jer ih zadnji uvoz nije dirao).
   Javi pa provjerim.
2. **`Wellness` natrag u taksonomiju** — Kokin račun, Structure → `Transakcija` → `Podtip`
   → redak `Zabava` → dodaj `Wellness`. Izbrisao ga je naš Structure alat (v. DIO 2).
3. **Komentar PP retka** i dalje glasi `Sašin tekući RF/Zdravlje/PP (Posmrtna pripomoc)` —
   ostatak predloška, spominje krivi račun. Što da piše?
4. Kad stigne **Visa izvod za rujan** (naplata ~05.10.), spremi ga u `izvodi/` — ide istim
   alatom kao kolovoz, sada bez duplikata.

## Tvoj redoslijed (S147) — gdje smo

1. ~~Baza što točnija — Visa~~ ✅ · ostaje: **loši Tip/Podtip parovi** (v. DIO 2) i RF `Izvod opis`.
2. **Bugovi.**
3. **Prolaz kroz backlog.**

---

# DIO 2 — tehnički (za Claudea)

## Stanje grana

`test-branch` = `e039fec` + ritual S148. `main` = `7ef95ac` (S147) — **u `src/` se od
deploya ništa nije promijenilo**, S148 je samo `data-prep_tools/` + dokumenti. Deploy ne treba.

## Novi alati (S148) — svi u `data-prep_tools/Financije/`

- `visa_kosare.py [YYYY-MM ...]` — mjera; kriterij „svi mjeseci 0,00". Naplatu na RF-u
  prepoznaje po `PBZCARD` u `Izvod opis` **ili** po `Transfer/izmedju racuna` + komentar
  `Visa…` (07.09. `Visa racun` nema `Izvod opis` dok RF izvadak za rujan ne stigne).
- `visa_uvoz_izvoda.py <PBZVI?A_YYYY-MM.pdf> <naplata YYYY-MM-DD> [--file]` — izvod → app
  Excel. Za rujanski izvod: dopuni `RUCNO` (približni `~` iznosi) i `KLASA` ako treba.
- `visa_popravak.py` — S148 jednokratni popisi + **zajednički pisac `pisi()`**
  (e-mail autora u kol. G iz `EMAIL`, dropdowni). ⚠ Dropdown `Podtip` je **ravan** (ne
  ovisi o Tipu) — Saša je to primijetio; ako se pisac ponovo koristi za klasifikaciju,
  napravi ovisni (INDIRECT + imenovani rasponi, kao app export) ili pošalji Sašu na app export.

## Otvoreno — točnost baze (prioritet 1)

- **T-S148-4:** 6 redaka `Tip / N/A` (v. DIO 1). Provjera: skripta koja za svaki redak traži
  `Podtip ∈ validation_rules.depends_on.options_map[Tip]` (`visa_uvoz_izvoda.taksonomija()`).
- **14 starijih loših parova u Arei** (ista provjera, 24.09.):
  `Zabava / Wellness` **×10** (2025-03 → 2026-09) — **uzrok nađen**:
  `make_financije_all_structure.py` regenerira `Tip`/`Podtip` iz Review `Taksonomija`
  sheeta (10.07.), pa je Structure uvoz iz alata izbrisao `Wellness` dodan u S124.
  Saša ga vraća rukom (panel, Kokin račun) — **provjeri da je vraćen**.
  ⭐ **Popravak alata** (S149): taksonomija iz `--base` (unija s Reviewom, ispis razlike),
  isti obrazac kao `read_base_automations` (S145). Dok nije popravljen — alat se ne pokreće.
  Ostali: `Zabava / N/A`
  (Spotify 28.08.), `Razno / Balon`, `Razno / Poklon` ×2 (valjano je `Pokloni`),
  `Razno / None` (Graviranje 200,00).
- **RF `Izvod opis`** (Backlog, Sašin izričit zahtjev S131) — i `Visa racun` 07.09. čeka
  RF_2026-09.
- MC par `+105,30`/`−105,30` (`Planiran`) i `oznaci_iz_presedana.py --apply` — iz S147, nediran.
- Kokin plan `117,32 / 6` (22.09.): rata 1/6 atribut `19.57`, komentar `19.55` — jedan Edit.

## Bugovi (prioritet 2)

- **BUG-S148-G** (nov, Open bugs): postojeći redak s krivim e-mailom u kol. G uvoz tiho
  upiše kao nov (`smartReclassify`, `excelImport.ts:820`), poruka „not found in database"
  laže. Prijedlog: `found && !canUpdateExisting` ⇒ stani i javi, nikad INSERT. Test:
  `importForeignRows.test.mjs` već ima okruženje.
- Pločica „zadnji zapis" = zadnja promjena **salda** (S147 prijedlog natpisa).
- „Restoring filter…" bez timeouta (+ hipoteza E8-2).
- `hidden_in_add` / `HiddenInAdd`, `et_activity_draft`, `ViewDetailsPage` — Backlog.
- „signal is aborted without reason" u Export modalu (S148, jednom, mreža) — sirova poruka
  `AbortError`-a; ako se ponovi, prevesti u „veza je prekinuta — pokušaj ponovo".

## Zamke koje je S148 platio — sve su u CLAUDE.md

- Kolona G = autor retka, ne uvoznik (§ Collab — Excel put za tuđi redak).
- Rata se sparuje po planu i broju, nikad po datumu (zaglavlje `visa_uvoz_izvoda.py`).
- ⚠ Profil `Kokin_format` pregazi raspon iz panela (`last-3-months`) — pri izvozu starijih
  redaka isključi „Koristi filtre iz profila". Pravilo je već u CLAUDE.md (S129).

## Što NE dirati

- **`main`** — merge pušta Saša (PowerShell oblik iz CLAUDE.md).
- **PROD upisi** — sve kroz Excel uvoz (Koka) ili `--apply` koji pokreće Saša.
