> Pisano protiv `2f55653` (S192 prije puta: ✕ na sličici) i commita koji nosi ovaj file (S192 zatvaranje — studeni krug Financija).
> **Stanje:** `main` = `f903401` (S183 kod, PROD od 26.10.); `test-branch` = `main` + S185 … S192, **nije deployano**.
> **Baze:** `058` je na PROD-u (od 22.10., S180); `059` i `060` su samo na **TEST-u**. S187–S192 nemaju migraciju.
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md` i `data-prep_tools/CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija (S193) — sesija održavanja Financija: T39–T49

> **Ukratko (S192):** prvi mjesečni krug „ispita" — Visa, ZABA i MC izvod za listopad zatvoreni su u cent bez ručnog
> slaganja uvoznog filea, RF je usklađen usporedbom s bankom, a jedanaest mjesta trenja zapisano je za sesiju održavanja.

---

# DIO 1 — netehnički (za Sašu)

## Gotovo (S192, 05.11.)
- **Visa:** plaćeno 1.751,12; traka + alat + Kokin uvoz (5 novih, 37 ispravaka); obje Visa košare zatvorene.
- **ZABA:** listopad u cent; razlika 1,60 bila je parking upisan kao Mastercard; sidro 10.529,31.
- **MC:** svih 54 stavki izvoda spareno, uvezeno, ponovni prolaz 0/0. Dvije Kokine kupnje s kraja listopada idu na
  prosinački izvod (naplata 11.12.).
- **RF:** nađeno što je falilo (mirovina 2. stup, naknada paketa, naknada Vise, Keks na krivi dan) — 253,15.
- Kod se u krugu nije mijenjao; sve trenje je zapisano kao **T39–T49** u `docs/FINANCIJE_PROCES.md` §4.

## Što treba od tebe / Koke
1. **Kad Keks 22 € sjedne:** RF banka mora pokazati **253,15** ⇒ Koka potvrdi s ekrana (T-S192-1). Filtar This Year!
2. **11.11., Koka:** traka MC — Σ **2.783,26** → dan → „Da, upiši" (zadnji korak T-S175-1).
3. Odluka u S193: **deploy** — popravci appa (T39, T48, T43…) idu na PROD samo zajedno s trening radom S185–S191
   (već testiran na TEST-u) i migracijama `059`/`060`.

## Sljedeće (prijedlog redoslijeda za S193) — sve prije prosinačkog kruga (MC ~02.12., Visa ~03.12.)
1. **T48** Namjena na retku koji upisuje traka (malo, odlučeno: kroz `default_map`).
2. **T39** grantee u traci vidi usporedbu (malo).
3. **T43** brži Excel uvoz + trajanje na završnom ekranu — najveći dobitak za Koku; prvo izmjeriti na TEST-u.
4. **T45, T41, T47** alati (Python, bez deploya): storno i krivi Izvor u ZABA alatu, blizak iznos u Visa alatu,
   „pomakni u sljedeću košaru" umjesto `--brisi`.
5. **T40** izmjeriti Visa kupnje od 2./3. u mjesecu ⇒ `cutoff:2:5` (samo config) — mjerenje PROD-a pokrećeš ti.
6. T42, T46, T44, T49 (sitnije).

Trening (ostaje otvoreno iz S191): T-S191-5, T-S191-6 koraci 4–6, T-S190-5, Gibljivost (PROD Structure export
`Health_Sasa`), skica View-a, pa korak 6.

---

# DIO 2 — tehnički (za Claudea)

## Izvedeno (S192)
| Što | Gdje | Dokaz |
| --- | --- | --- |
| ✕ na sličici vidljiv na dodiru | `PhotoGallery` (`2f55653`) | T-S191-6 k1–3 ✅, k4–6 ⬜ |
| Studeni krug — samo podaci (Saša/Koka uvozi, Claude čitao PDF-ove i Excel lokalno) | PROD | T-S175-2/3 ✅, T-S175-1 A–C ✅, T-S181-3 ✅ |
| Nalazi T39–T49, §5 Visa s trakom | `docs/FINANCIJE_PROCES.md` | — |

## Što je izmjereno (ulaz za S193)
- **T39:** `basketAction` vraća `none/no-date` bez datuma (`dueBaskets.ts:233`); datum polje samo `isOwner`
  (`DueStrip.tsx:411`); `no-date` poruka i rečenica „Potvrđuje vlasnica" također iza `isOwner`/`act.kind`.
- **T48:** `dueConfirm.ts` i `insertEntry.ts` ne spominju `default_map` (grep); pravilo živi u `importDefaults.ts`
  (uvoz) i formi. Lijek u `insertEntry.ts` (svaki „redak iz appa"), test: traka upiše ⇒ Namjena Zajedničko.
- **T43:** F12 na PROD-u: po retku `events?select=…` (~0,5 s), `events?id=eq…&select=id` (~0,4 s), pa
  `event_attributes?id=eq.<uuid>` **po atributu** (204, 0,5–1,1 s), pa insert (201). Redom, s preflightom.
  42 retka ≈ 2–3 min. Izmjeriti na TEST-u (kopija PROD-a) prije i poslije.
- **T45:** `fill_from_izvod.py` ZABA dedup je skup `(datum, iznos)` bez Izvora i bez smjera (`:1494`); parser daje
  storno kao `Isplata -0.1` (`enrich_from_izvoda.parse_zaba_racun`). Visa alat ima „MOŽDA KRIVO MJESTO" (korak 4).
- **T41:** `visa_uvoz_izvoda.py` korak 3: `sum(... k[0] in kand[t2]) == 1` odbija kad je redak kandidat za dvije
  stavke; prednost „istog dana" postoji samo sa strane izvoda.
- **T40:** dokazi 03.10. (0,94 + 33,80) i 03.11. (9,40) na sljedećem izvodu; PBZ: „Sljedeći izvadak 03.12.".

## Otvoreno / zapamti
- Klasifikator i dalje blokira Claudeove PROD pozive (i read-only) ⇒ PROD alate pokreće Saša; PDF/Excel u
  `izvodi\` i `Downloads\` Claude smije čitati lokalno (venv python, `-I` nije potreban — naši alati).
- Visa naplata 1.751,12 (05.11., iz trake) nema Namjenu — popravit će je T48 + jednokratni Edit ili alat.
- Iz S191: deploy F2 + S187–S192 (`059`/`060` u SQL editoru, `backup_db` prije, `dump_schema --diff` poslije);
  `S190 Trening proba` i `S189 serije proba` brisati kad korak 6 ima pravu Areu.
