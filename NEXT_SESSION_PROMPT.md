# Sljedeća sesija — handoff

**Pisano protiv commita:** `S127: ishodisna sidra 2022-12-31 upisana na TEST i PROD`
(`b5b3293`, **samo `test-branch`** — `main` je i dalje na `3e9acf6`). Ako `git log`
pokazuje novije, čitaj ovo kao **povijest** — CLAUDE.md je autoritet.

---

# DIO 1 — netehnički (za Sašu)

## Gdje smo

Krenulo je od Kokinog mobitela (`Datum naplate` nije reagirao na `Izvor`), a
završilo s **pripremljenim uvozom cijele 2023. i 2024.**

| | |
| --- | --- |
| BUG-S127-PRESETFREEZE | ✅ popravljen — shortcut više ne zamrzava izvedene vrijednosti |
| Edit evaluira `set_attribute` | ✅ novo, ali **samo kad ti promijeniš `Izvor`** |
| sidra na PROD-u | **2 → 17** (cijela 2024. + dva ishodišna) |
| `−200,14` | ✅ **lokaliziran na pet mjeseci** |
| fileovi za uvoz 2023.+2024. | ✅ **2.738 redaka, sve provjere prošle** |

## Što čeka tebe — po redu

**1. ⭐ UVOZ. Ovo je jedini korak koji ja ne mogu napraviti.**

Prijavi se **kao Koka** (email u koloni G je njezin — uvezeš li pod svojim
računom, svih 2.738 redaka je „tuđe" i preskočeno). **Hard refresh** prije prvog
filea. Onda redom, i **provjeri preview prije Applyja**:

| file | mora pisati |
| --- | --- |
| `import_2024H1.xlsx` | **800 New**, 0 Modify |
| `import_2024H2.xlsx` | **805 New**, 0 Modify |
| `import_2023H1.xlsx` | **575 New**, 0 Modify |
| `import_2023H2.xlsx` | **558 New**, 0 Modify |

Svi su u `data-prep_data/Financije/`. ⚠ Bilo koji „Modify" ili manji broj —
**stani i javi**, ne klikaj Apply.

**2. Provjeri predviđanje.** Nakon 2024. pokreni:
`ET_TARGET=prod ..\Tools\venv\Scripts\python.exe make_saldo_anchors.py --report`

Mora pokazati **točno** ovo i nule drugdje:
`2024-03 +10,00` · `2024-07 −17,28` · `2024-10 −236,04`
Bilo što drugo znači da uvoz nije prošao kako treba, ne da su podaci lošiji.

⚠ Za 2023. **već znamo da neće zatvoriti**, i to za ~16.000 — Koki nedostaje 11
skupnih MC naplata (ima samo jednu, `926,52`). Nije greška uvoza; sidro
`844,83 @ 01.01.2024.` to izolira pa 2024. ostaje čista.

**3. Pet mjeseci koji se razilaze s bankom** — `2025-08 −46,74`, `2025-10
−150,00`, `2025-07 +0,80`, `2026-03 −2,80`, `2026-04 −1,40`. Alat je
`uskladi_izvod.py` nad tim izvodima. Predlažem redom 2025-10 (najveći i
najčišći), pa 2025-08.
⚠ `2025-02 −49,00` i `2025-03 +49,00` se **poništavaju** — to je jedan redak s
krive strane zatvaranja izvoda, dakle popravak **datuma**, ništa se ne dodaje.

**4. Sidra za 2025./2026. tek nakon toga.** Pravilo koje je ova sesija iznjedrila:
**popravi → razlika je nula → tek onda sidro.** Sidro je pečat na usklađen mjesec,
ne alat za usklađivanje.

**5. Deploy na `main` nije napravljen.** Dok ne bude, Koka i dalje ima staro
ponašanje (`Datum naplate` se zna zamrznuti). Testovi `T-S127-1/-4/-6/-8` su
potvrđeni uživo; **`T-S127-9` još nije, a najvažniji je** — provjerava da
otvaranje retka u Editu ne mijenja ništa (štiti 855 Visa redaka).

**6. Odluka koja čeka:** `Status` se u Editu mijenja **pravilom, ne dokazom**.
2.300 redaka nosi potvrdu s izvoda; promjena `Izvora` na takvom retku okrene
`Status` u `Planiran` iako potvrda stoji. Tri opcije su u `PENDING_TESTS.md`;
preporuka je da **potvrda pobijedi pravilo**.

## Što se pokazalo vrijednim

**Njen model je bio ispravan cijelo vrijeme.** Jedina skupna MC naplata koju ima
za 2023. (`926,52` @ 11.12.) je **točno studeni**, na 11. u sljedećem mjesecu.
Nije pogriješila pravilo — samo nije upisivala ostale.

**Ishodišna sidra su se dala provjeriti.** RF-ovo `12.712,28` kroz dvije godine i
158k prometa zatvara na **−11,49**. Nije se moralo vjerovati na riječ.

**Pitanje „kako se njeno stanje slaže s izvodima" bilo je pravo pitanje** — bez
njega bi 2023. ušla kao neobjašnjen manjak od 15.752 umjesto kao poznata rupa od
11 naplata s ostatkom od 273,81.

---

# DIO 2 — tehnički (za Claudea)

## Stanje

- `test-branch` je **8 commita ispred `main`** (`3e9acf6` … `b5b3293`).
  **Deploy nije napravljen** — Netlify deploya samo `main`.
- **PROD i TEST su dobili sidra ovom sesijom** (upis, ne kod): PROD 17
  (15 ZABA + 2 RF), TEST 18. Migracije nisu trebale.
- TEST i dalje **nema `044`** (`split.due_slug`) — bitno samo za delta sheet.
- PROD je **ispred TEST-a** po podacima (2.419 vs 2.311 eventa prije uvoza).

## Novo u alatima

```
ET_TARGET=test|prod         varijabla okoline, dijeli je SEST alata koji uvoze
                            AREA_ID/ENV_FILE iz verify_rpc_vs_model.py
make_saldo_anchors.py       + --until DATE (rasponski upis, uz check_chain)
                            + target_banner() u zaglavlju oba ispisa
make_structure_guard.py     NOV — structure guard iz ZIVE baze, ne iz Reviewa
make_financije_import.py    event_date se pise u PODNE (bio ponoc)
```

## Otvoreno

- **`Status` u Editu** (v. DIO 1, t. 6) — traži odluku, ne kod.
- **Nacrt (`Resume`) ima ista vrata kao preset** — `T-S127-7` je **mjerenje**, ne
  popravak: nacrt ne pamti je li datum upisao čovjek ili pravilo, pa se ne smije
  popravljati napamet.
- **Promjena datuma u Editu ne miče `Datum naplate`** (`T-S127-10`) — poznata
  rupa, svjesno nedirnuta; nosi isti rizik kao `T-S127-9`.
- **Migracijski ledger ne postoji.** Nigdje nije zapisano koja je migracija gdje
  puštena, pa se stanje mora *pipkati* (postoji li stupac, postoji li ključ).
  Isti razred kao S118. Mala tablica `schema_migrations` + provjera zatvorila bi to.
- **2022. batch (30 redaka)** — nije uvezen i plan ga nigdje ne spominje.
