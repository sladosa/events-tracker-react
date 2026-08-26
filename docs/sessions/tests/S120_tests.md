# S120 — detaljni testovi (2026-08-26)

**Kontekst:** dan prije deploya na `main`. Tri popravka koda, četiri nova E2E testa,
17 zatvorenih redaka u `PENDING_TESTS.md` i dvije greške u testnoj infrastrukturi
koje su se cijeli dan predstavljale kao bugovi u aplikaciji.

> ⚠ **Sve što je ovdje ⬜ traži telefon ili tvoj račun** — sve što se dalo izmjeriti
> strojno već je zatvoreno i dokaz stoji uz redak u `PENDING_TESTS.md`.

---

## Automatizirano u ovoj sesiji (ne traži ništa od tebe)

| test | file | što drži |
| --- | --- | --- |
| `E16-1` | `e2e/tests/e16-filter-persistence.spec.ts` | filtar, Area i kategorija prežive put u View Details i natrag |
| `E17-1` | `e2e/tests/e17-import-foreign-preview.spec.ts` | „Import as mine" prijavi kolizije (prije popravka: nijednu) |
| `T-S119-6` | `e2e/tests/S119_list_columns_map.spec.ts` | `Map` preživi Structure roundtrip, a brisanje ćelije ga ukloni |
| `T-S100-1` | `e2e/tests/S100_same_path_two_areas.spec.ts` | redak ide u areu koju imenuje kolona `Area`, ne u blizanca s istim pathom |

**Svaki je provjeren i u drugom smjeru** — namjerno pokvaren kod, test padne, kod vraćen.
Test koji nikad ne pada ne čuva ništa.

---

## T-S120-1 ⭐ Filtar preživi View Details — na telefonu ⬜

**Zašto ⭐:** ovo je jedina promjena iz S120 koju Koka osjeti svaki dan. E2E to pokriva na
desktopu; ovdje se provjerava da se na uskom ekranu ponaša isto.

1. Overview → klikni na račun (`ZABA`) da te odvede u filtriranu listu.
2. Otvori bilo koji redak: ⋮ → **View Details**.
3. Vrati se natrag (gumb ili gesta unatrag).

**Očekivano:** lista je i dalje filtrirana na **isti račun**, kategorija i raspon datuma
nepromijenjeni.
**Pad:** lista pokazuje sve račune ⇒ javi, i reci **kako** si se vratio (gumb ili gesta) —
E2E koristi `goBack()`, a gesta na iOS-u ide drugim putem.

---

## T-S120-2 `N/A` se pojavljuje jednom ⬜

1. Lista `Financije_all`, nađi neklasificiran redak (`Tip` i `Podtip` oba `N/A`).

**Očekivano:** u drugoj liniji piše **`N/A`**, ne `N/A/N/A`.
**Napomena (nije pad):** redak kojem je `Tip` popunjen a `Podtip` je `N/A` pokazat će
**samo Tip**. Namjerno — `N/A` ne nosi informaciju.

---

## T-S120-3 Uvoz tuđeg filea prijavi kolizije ⬜

**Zašto:** do S120 je preview za „Import as mine" računao po `skip` ⇒ pokazivao
`0 New / 0 Modify` **i provjeravao kolizije nad praznim skupom**. Zaštita od dvostrukog
uvoza istog filea time nije postojala.

1. Uzmi Excel koji je exportao **drugi** račun (ili prepiši kolonu `User`).
2. Import → modal javi „Multi-user file detected" → odaberi **Import as mine** → Continue.

**Očekivano:** preview se **ponovno izračuna** (kratko „checking") i pokaže **stvarne**
brojke; ako ti retci već postoje, pojavi se lista kolizija s Replace/Add/Skip.
**Pad:** i dalje `0 New / 0 Modify` bez ijedne kolizije.

---

## T-S120-4 Uvoz u areu s istim imenom kategorije ⬜ (samo prije batcha 2024)

**Zašto:** na PROD-u `Financije_all` i `Financije_old` **obje** imaju `Transakcija`.
E2E to pokriva na TEST-u; ovo je provjera na pravim podacima, prije velikog uvoza.

1. Uvezi mali file (2–3 retka) s `Area = Financije_all`.
2. Provjeri gdje su retci završili — Activities filtar na `Financije_old`.

**Očekivano:** u `Financije_old` **nema** novih redaka.
**Pad:** ako ih ima, **stani i javi** — batch 2024 ne smije krenuti.

---

## Zamke iz ove sesije (za sljedeći put, ne test)

- **`fullyParallel: false` ne čini run sekvencijalnim.** Drži redoslijed samo *unutar* filea;
  fileovi i dalje idu u zasebne workere. Šest specova nad istom seed Areom = 9 od 10 padova,
  a svaki prolazi sam. Popravljeno s `workers: 1`.
- **Specovi su brisali leaf, ali ne i P2 parente.** Siročići se nakupljaju, uđu u sljedeći
  export i sudare se s uvozom — što izgleda kao pokvaren feature, ne kao ostatak.
  Popravljeno s `e2e/setup/global-setup.ts`.
- **Ostaje neriješeno:** `S100-1` i `E16` padaju u batchu na `waitFor` (Area select se ne
  pojavi u 15 s pod opterećenjem). Nije ostatak; ili se dižu timeouti, ili ostaju izolirani.
