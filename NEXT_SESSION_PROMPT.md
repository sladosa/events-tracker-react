# Next session — handoff

**Pisano protiv commita `5533420`** (`main` = `test-branch` = `5533420`, S122, 2026-08-29).
Ako `git log` pokazuje nešto novije, čitaj ovo kao **povijest**, ne kao stanje.
Trajna pravila su u `CLAUDE.md` — ovdje je samo ono što je **u letu**.

---

# DIO 1 — netehnički (za Sašu)

## Što je jučer/danas otišlo na PROD

Dvije stvari, obje vidljive:

1. **Nema više „Resume Previous Session?" nad praznim ekranom.** Nacrt se sad piše tek kad
   si stvarno nešto utipkao. Zaštita od gubitka unosa ostaje potpuna.
2. **Shortcutovi su po Arei.** Uz `⚡ Shortcuts` stoji kvačica **„samo ova Area"**
   (uključena zadano). Isključiš li je, vidiš sve, **grupirano po Arei**. Svaki redak nosi
   `0× · 25.06.` — koliko puta je korišten i kad zadnji put.

⚠ **Koka će promjenu dropdowna vidjeti bez najave.** Za nju je poboljšanje (u `Financije_all`
više neće vidjeti tuđe shortcutove), ali je to ekran koji koristi svaki dan.

## Što čeka tebe

**Tri testa, sva tri na PROD-u** (detalji: `docs/sessions/tests/S122_tests.md`).
**Prvo Ctrl+Shift+R** — stari keširani bundle je u S118 tiho osakatio uvoz.

| test | u jednoj rečenici |
| --- | --- |
| **T-S122-2** | otvori Add, **ništa** ne tipkaj, 10 s, back → sljedeći Add **nema** dijaloga |
| **T-S122-3** | isto, ali **utipkaj** nešto prije backa → dijalog **mora** iskočiti i Resume vratiti polja |
| **T-S122-4** | ⭐ shortcutovi **na mobitelu** — kvačica, grupe, `0× · 25.06.` |

T-S122-3 nije formalnost: on jedini hvata da guard nije pretjerao i pojeo pravu zaštitu.

## Jedna brojka koja nam treba za sljedeći korak

**Koliko shortcutova ukupno imaš?** Isključi kvačicu i pogledaj popis. O tome ovisi treba li
skraćena lista uopće granicu — a ako treba, prijedlog je da mjera ne bude broj nego **Area**
(1–2 najkorištenija po Arei, pa se samo skalira).

## Otvoreno prema tebi, nije hitno

- **Ono „pričekaj pol minute"** koje si spomenuo — nije reproducirano i u kodu nema nijedne
  takve poruke. Ako iskoči, uslikaj.
- **Financije, tranša 4** stoji od S116 (MC paket + cijeli kolovoz iz Kokinog filea). Nije na
  kritičnom putu — sidra drže saldo — ali je najveći komad koji je ostao.
- **Koka: kad počne upisivati u app, u Excelicu više ne.** Radi li oboje, sve dobijemo dvaput,
  a vidjet ćemo tek kad se saldo raziđe.

---

# DIO 2 — tehnički (za Claudea)

## Stanje grana

`main` i `test-branch` oba na **`5533420`**. Netlify je deployao `main` 29.08.
Nema nespojenih grana koje nešto čekaju.

## Što je S122 napravio

| commit | što |
| --- | --- |
| `fd849b4` | guard protiv fantomskog nacrta (`userTouchedRef`) + `S122_no_phantom_draft.spec.ts` |
| `b7acc3a` | `e16` popravljen u specu (⋮ izbornik, `toPass`) — **T-S121-6 zatvoren** |
| `8d2f3d3`…`e40f5b9` | `docs/FILTER_SPEC.md` + Sašine odluke |
| `f4b7ce5` | shortcutovi po Arei (faza 1) |
| `5533420` | `0×` umjesto praznog sufiksa |

## Prvo sljedeće (prijedlog reda)

1. **Rezultati T-S122-2/-3/-4** — ako padnu, imaju prednost pred svime.
2. **`FILTER_SPEC` faza 0** — izbrojati refetch kaskadu. Izmjereno: **šest** `events?select=…`
   u ~500 ms na jednu promjenu filtra. ⚠ **Uzrok nije utvrđen** — kandidati su `useDateBounds`
   settle, `areas-changed` i promjena `attrFilter`. **Prvo brojati, pa popravljati.**
   To je i uzrok „⋮ izbornik se sam zatvori".
3. **Faza 1b** (skraćena lista) — tek kad Saša javi broj shortcutova.
4. **Faza 2** (RPC s N uvjeta) — najveći komad, i jedini koji dira bazu.

## Zamke koje su danas potvrđene, a lako se zaborave

- **Auto-popunjena forma nije korisnikov sadržaj.** `canSave` je `true` i za formu koju nitko
  nije dotaknuo, jer defaulti nose `touched: true`. Svaki budući guard tipa „ima li sadržaja"
  mora pitati **je li čovjek dirao**, ne **ima li vrijednosti**.
- **„Flaky test" je opis, ne dijagnoza.** `e16` je cijelu sesiju stajao zapisan kao „S120
  popravak nije čuvan", a padao je na sasvim drugom mjestu. **Prvo pročitaj trace.**
- **`areas.settings` je vlasnikov.** Grantee ne može spremiti Export profil ni s `write`
  dozvolom — app ga zaustavi, a i RLS bi. Vrijedi za svaku buduću per-Area konfiguraciju.

## Sitno, zabilježeno, nepopravljeno

- Poruka „(read-only access)" prikazuje se i **write** grantee-u pri spremanju Export profila
  (`ExcelExportModal.tsx:557`) — neistina o njegovim pravima, jedna rečenica popravka.
- `audit_tests.py`: **0 fileova spremno za arhivu**, 37 testova koje `PENDING_TESTS` ne
  spominje, 62 testa označena ⬜ u tablici a ne navedena u „Otvoreno". Nije nastalo danas i
  nije dirano — ali raste.
