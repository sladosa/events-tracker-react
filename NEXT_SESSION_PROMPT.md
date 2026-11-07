> Pisano protiv `2d56406` (S195) i commita koji nosi ovaj file (S195 zatvaranje).
> **Stanje:** `main` = `c232ee5` (S185–S193, **PROD od 06.11.2026.**); `test-branch` = `main` + S194 (alati, T46, T42) +
> S195 (`krug`, samo alati i docs), **nije deployano** (S195 ne traži deploy).
> **Baze:** bez migracije u S195. **TEST je promijenjen testom kruga** (v. DIO 2). PROD `Visa=cutoff:2:5`, TEST `3:5`.
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md` i `data-prep_tools/CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija (S196) — lokalni Supabase za razvoj i E2E (Strategic Position, korak 2)

> **Put (07.11., Saša):** 1 `krug` faza A ✅ S195 → **2 lokalni Supabase (prije treninga koraka 6)** → 3 `krug` u
> oblaku (izvodi kroz app, gumb, pločica) → 4 trening korak 6 → 5 Financije za drugog korisnika (Igor).
> Detalji koraka 2: `docs/sessions/BACKLOG.md` „Dogovor 07.11." — Saša instalira Docker Desktop, ostalo Claude.

> **Ukratko (S195):** `krug` (T4) postoji — razvrstač, svi izvodi, stanje iz baze, jedan Excel s odlukama za Koku i
> izvještaj na hrvatskom, sidro iz izvoda — i prošao je studeni na TEST-u od početka do kraja (34 New · 73 Modify ·
> 1 Delete kroz app, pa 0 · 0 i sidro), a strateški put je prepisan: krug → lokalni Supabase → krug u oblaku →
> trening → drugi korisnik.

---

# DIO 1 — netehnički (za Sašu)

## Gotovo (S195, 07.11.)
- **`krug`** — jedna naredba za mjesečni krug: `data-prep_tools\Financije\krug.bat` (dvoklik = PROD). Pokupi nove
  izvode iz Kokine mape, obradi sve, napiše **jedan Excel** za Kokin uvoz (odluke su redovi „ODLUČI", ona bira
  DELETE ili ostavlja prazno) i **izvještaj** koji se sam otvori: što uvesti, koje brojke pregled mora pokazati,
  što čeka (traka, plaćanje Vise), što ne štima. Sidro iz izvoda upiše sam kad se sve slaže u cent.
  Smije se pustiti i sutra opet. Upute: `docs/FINANCIJE_PROCES.md` §3.0, spec `docs/KRUG_SPEC.md`.
- Na TEST-u izveden cijeli studeni: krug → uvoz kroz app (25 s) → drugi krug sve ✓ + sidro → treći bez promjene.
- **Zapisan put** (Strategic Position) i ideje za Igora i „Koka bez Saše" (BACKLOG).

## Što treba od tebe / Koke (sve: blok „Na redu" u `docs/sessions/PENDING_TESTS.md`)
1. **Koka: osvježi app prije 11.11.**; **11.11.** traka MC 2.783,26 (T-S193-1/2, T-S175-1).
2. **Deploy prije prosinačkog kruga (~1.12.)** — T46 i T42 (iste naredbe kao 06.11., bez SQL-a).
3. **Prosinački krug kroz `krug`** (T-S195-1..4): prvo `.\krug.bat --suho` (ništa ne upisuje), pa `krug.bat`,
   Koka uveze, pa `krug.bat` opet (mora 0 · 0). Ručni put (§3.1–3.5) ostaje rezerva. To je ispit „Financije
   dovoljno gotove".
4. **Za S196: instaliraj Docker Desktop** (Windows 11 Home ide preko WSL2; u BIOS-u mora biti uključena
   virtualizacija; jedan restart) — prije sesije ili na njenom početku.
5. Čeka i dalje (trening, korak 4 puta): **P-2** skica View-a, **P-1** Gibljivost export, **T-S191-5**.

---

# DIO 2 — tehnički (za Claudea)

## Izvedeno (S195)
| Što | Gdje | Dokaz |
| --- | --- | --- |
| Odluke K1–K9, put prepisan | `docs/KRUG_SPEC.md`, CLAUDE.md Strategic Position, BACKLOG | `6c25c5d` |
| Logika izvoda u funkcije (CLI isti) | `visa_uvoz_izvoda.analiza`, `fill_from_izvod` (`mc_odluke(db=)`, `zaba_odluke`, `rf_odluke`, `spojeni_retci`, `postojeci_iz_baze`, `klasificiraj`), `visa_popravak.pisi(stupci=…)` | `Claude-temp_R/s195/regresija.py` 14/14 identično, `grane.py` |
| Jezgra + omotač + Excel + izvještaj | `_krug.py`, `krug.py`, `krug.bat`, `_krug_excel.py`, `_krug_izvjestaj.py` | `krug_proba.py` (memorija), parser uvoza 0 grešaka |
| Studeni na TEST-u od početka do kraja | T-S195-5 | 34 · 73 · 1 kroz app ⇒ 3/3 ✓ + sidro ⇒ bez promjene |

## Otvoreno / zapamti
- **TEST je nakon testa kruga promijenjen:** MC/Visa/ZABA 10/2026 uvezeni (34 nova retka, 73 ispravka, 3,80
  obrisan), Visa naplata 05.11. = 1.751,12 (bila 1.349,52), sidro ZABA 10.664,71 na 01.11. Snimka prije:
  `_backup/test/2026-11-07_1205` (`restore_db.py`) ili `prod_to_test.py` za svježu kopiju PROD-a.
- `krug` na PROD-u još nije pušten (Claude ga ne smije — PROD upisi blokirani); prvi put Saša u prosincu.
  `--suho` na PROD-u čita bazu i ništa ne piše (Excel i izvještaj lokalno).
- RF grana `krug`a nije izmjerena na pravom RF izvodu (nema RF 10/2026); `_prethodni_close` za RF čita OCR keš.
- T51 (šum „Rate?: true → true" u pregledu) — nisko.
- Puni E2E i dalje nije pušten serijski poslije S194 — lokalni Supabase (S196) je mjesto za to.
- E2E global-setup „COULD NOT delete leftover area S189 serije proba" (iz S193) — riješiti uz lokalnu bazu ili korak 6.
- Klasifikator blokira Claudeove PROD pozive ⇒ deploy, backup, PROD mjerenja i `krug` na PROD-u radi Saša.
