# NEXT SESSION PROMPT — nakon S116 (kolone su gotove, kolovoz je pripremljen ali NIJE uvezen)

**Pisan protiv commita `6f8e235`** (+ commit zatvaranja S116 koji slijedi odmah iza).
Ako `git log --oneline -1` pokazuje nešto puno novije, čitaj ovo kao povijest; `CLAUDE.md` je autoritet.

**Stanje grana:** `test-branch` nosi S108–S116. `main` = PROD, **nije diran od S107**.

---

# DIO 1 — Jednostavnim rječnikom (za Sašu)

## 1. Što je jučer napravljeno

**Kolone po Arei su gotove.** Financije lista sada pokazuje
`Datum | Iznos | Tip / Podtip | Opis | User | Stanje | ⋮`, a na mobitelu dva reda
(datum i iznos gore, tip/podtip i opis dolje). Ostale Aree izgledaju točno kao prije.
Postava putuje Structure Excelom (`ListColumns` list), pa se može mijenjati bez mene.

**Sidro je provjereno prije nego što je dirano.** Srpanjski ZABA izvod se zatvara
**30.07.** i ispisuje `13.815,33`. App iz lipanjskog sidra sam dođe do te brojke, u cent —
dakle lanac je čist, a sidro na 30.07. nije „provjera same sebe".

**Kolovoz je izmjeren do kraja.** Njen file od 23.08. ima **175 redaka poslije 30.07.**,
ali saldo dira samo **23** (ZABA 17, RF 6) — ostalo su kartične stavke, koje račun terete
tek skupnom naplatom. Od tih 23, **stvarno novih je 15**: 14 na ZABA-i, 1 na RF-u.

**Njen lanac daje točno onu brojku koju smo očekivali.** `13.815,33` na 30.07. plus njeni
retci do 13.08. = **`13.239,31`**. To je vrijedno jer ona broji **drukčije** od nas
(svaka kartična stavka joj tereti račun, nama tereti tek skupna naplata) — a ispadne isto.

## 2. Što čeka tebe, tim redom

1. **Obriši krivo sidro** — blokirao mi je to sigurnosni filter, jedna linija:
   ```
   cd C:\0_Sasa\events-tracker-react\data-prep_tools\Financije
   python anchors.py --delete eef47ad7-3fce-41cc-ace4-1bd3791b2376
   ```
   Pa `python anchors.py` da vidiš popis. Strelica `►` pokazuje koje sidro **danas vrijedi**.
   Zatim upiši ispravno: `python make_saldo_anchors.py --anchor 2026-07-30`
   (⚠ prvo prebaci `ZABA_2026-07.pdf` u `izvodi\Analizirani_izvodi\`, inače ga alat ne vidi).

2. **Pogledaj kolone** i reci što ne valja — redoslijed i širine se mijenjaju jednim retkom.

3. **Uvezi kolovoz.** Koraci i kontrolni brojevi su u `docs/sessions/tests/S116_tests.md`,
   testovi T-S116-7 (ZABA, mora dati `13.239,31`) i T-S116-8 (RF, `796,43`).
   ⚠ Delta sheet izvezi s **najmanje 60 praznih redaka** — zadanih 40 nije dosta.
   ⚠ Prvo pusti `--dry` i provjeri da i dalje piše **14 novih**. Njen file se mijenja
   svakih par dana; između `08-16` i `08-23` pojavilo se 20 novih redaka poslije 30.07.

## 3. Jedna stvar koju treba znati o kolovozu

**Skupna MC naplata `1.332,52` NIJE među tih 14 redaka** i ne smije se izmisliti.
Ona piše na `MC_2026-07.pdf` i uvozi se zasebno. Bez nje pločica na 13.08. **neće**
dati `13.239,31` nego `14.571,83` — i to će izgledati kao greška u podacima, a bit će
samo redak koji fali.

## 4. Što i dalje stoji na tebi

- **Reci Koki za retke s krivom godinom** — osim poznatih `2036-04-08`
  (`Mirovina 1.323,64`, `Netdomena Igor 47,76`) našao se i `2028-05-16` (`HLK 5/26`).
  Ispravak ide **u njen file**, ne u naš uvoz.
- **Redak `07.08. Parking 1,60`** je tipfeler u mjesecu — treba biti `07.07.` Provjereno
  na tri načina; kod nas je isključen, ali kod nje je i dalje krivo.
- **Onih 5 spornih lipanjskih redaka** (Σ `373,11`) i 11 kartičnih bez para iz S113.
- **Kad dođe dan prelaska: jedna rečenica njoj** — *„kad počneš upisivati u app, u
  Excelicu više ne."*

---

# DIO 2 — Tehnički (za Claudea)

## 1. Prvo pročitaj

`docs/sessions/DONE_HISTORY.md` **S116** · `CLAUDE.md` → „Critical rules" (nova sekcija
**Kolone Activities liste**, pet novih zamki pod „Python alati") · `docs/sessions/tests/S116_tests.md`.

## 2. Što je izmjereno u S116 (ništa procijenjeno)

| Što | Vrijednost |
| --- | --- |
| `ZABA_2026-07.pdf` | close **2026-07-30** · POČETNO `2.255,64` · NOVO **`13.815,33`** |
| app iz sidra 01.07. → 30.07. | **`13.815,33`** (38 eventa), Δ = 0 — netautološka provjera |
| Kokin file `2026-08-23` | 3.735 redaka · **175** nakon 30.07. · saldo dira **23** |
| novih za uvoz | ZABA **14**, RF **1** |
| njen lanac ZABA → 13.08. | **`13.239,31`** ✓ · RF → **`796,43`** |
| retci s tekstualnim datumom | **103**, svi 2023. |
| sidara u TEST bazi | **6** (⚠ ZABA `22.08.` još nije obrisano — čeka Sašin `--delete`) |

## 3. Stanje koda

Nove datoteke: `src/lib/listColumns.ts`, `src/hooks/useListColumnValues.ts`,
`data-prep_tools/Financije/anchors.py`, `data-prep_tools/Financije/set_list_columns.py`.
Dirani: `ActivitiesTable.tsx` (render po configu, uklj. skeleton), `useAreaDashboard.ts`
(vraća i `listColumns` iz istog `settings` upita), `structureExcel.ts` + `structureImport.ts`
(§10, `ListColumns`), `StructureNodeEditPanel.tsx` (fixup), `StructureImportModal.tsx`,
`types/database.ts`, `fill_from_izvod.py` (izvor `--iz-koke`).

`npm run typecheck && npm run build` prolaze. **Ništa nije viđeno uživo** — T-S116-1…13 su svi ⬜.

Dodatno dirano u drugom dijelu sesije: `BalanceByGroupTile.tsx` (datum iz izvora, povijest
potvrda, brisanje), `overviewApi.ts` (guard), `docs/help/overview.md`.

## 4. Otvoreno / neverificirano

- **T-S116-1…5 i 10…13 nisu viđeni u pregledniku.** Config je u bazi (`set_list_columns.py --write`),
  kod je commitan, ali nitko nije otvorio Activities. Prvo to.
- **T-S115-2 i dalje nosi plan za PROD** — „sidro prikazuje račun i bez ijednog eventa"
  pročitano u `036`, **nije viđeno uživo**.
- **✅ BUG-S115-ANCHORDATE popravljen** (commit `6f8e235`): datum potvrde dolazi iz izvora
  (ekran ⇒ danas, papir ⇒ ručno), izvor je obavezan, rečenica o posljedici prije klika,
  upozorenje o novijoj potvrdi, povijest + brisanje u pločici, guard protiv budućeg datuma.
  **Neverificirano uživo: T-S116-10…13.**
- **✅ RF sidro `11.08. = 799,12` je TOČNO** — `RF_2026-07.pdf` se zatvara 11.08.
  (zadnja tx `Mirovina III stup 254,33`). Pitanje iz paralelne sesije je zatvoreno.
- **`PENDING_TESTS.md` si i dalje proturječi** (kurirani „Otvoreno:" redak vs ⬜ oznake u
  tijelu). S116 je dodao svoj blok i osvježio „Otvoreno:", ali **stara neusklađenost stoji**
  i ritual arhiviranja opet nije izveden. Uskladiti, pa arhivirati.
- **Tranša 4 je narasla:** MC paket + cijeli kolovoz. Rujanski izvod će ga provjeriti.
- **Batch 2023 ima novu prepreku** — 103 retka s datumom kao tekstom, u tri različita formata.
