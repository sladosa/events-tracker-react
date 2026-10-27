> Pisano protiv `1d62b33` (S186: T-S186-4 ✅) + commita koji nosi ovaj file (S186 zatvaranje, 27.10.).
> **Stanje:** `main` = `f903401` (S183 kod, PROD od 26.10.); `test-branch` = `main` + S185 + S186 (kod F2 + docs), **nije deployano**.
> **Baze:** `058` je na PROD-u (od 22.10., S180); `059` i `060` su samo na **TEST-u**.
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md` i `data-prep_tools/CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija (S187) — model treninga Activity1: prvo d1 i vidljivost polja

> ⚠ **Plan promijenjen 27.10. poslije zatvaranja S186** (Sašine odluke, `TRENING_MIGRACIJA.md` „Odluke 27.10."):
> model `Activity1` + jedan leaf `Dio` (vrsta je atribut) ide **prije A4**. Redoslijed: d1 (ukinuti implicitno
> skrivanje na defaultu) → „polje vidljivo samo uz vrijednost" → model na TEST-u → notacija snage → unos s
> raspisivanjem + „Ponovi zadnji trening" → Overview za Fitness → A4 / K2. A4 niže ostaje plan za kasnije.

> **Ukratko (S186):** novi Garmin izvoz je spremljen i ima kopiju na vanjskom disku, lista aktivnosti sada pokazuje i podatke s roditeljske razine (raspoloženje treninga), a promjena tipa atributa radi iz aplikacije kroz Structure Excel — na engleskom, korak po korak, s Undo, a ponovljen file prepoznaje što je već napravljeno.

---

# DIO 1 — netehnički (za Sašu)

## Gotovo (S186)
- **Garmin izvoz** je u `data-prep_data\Garmin\2026-10-27\garmin_gdpr_2026-10-27.zip`, s kopijom na `D:`.
  Cjelovit je (podaci do 27.10.2026.). Ne raspakirava se dok ne zatreba.
- **Lista aktivnosti** pokazuje i atribute roditeljske razine (npr. Mood na `Activity`) — do sada je pisala `—`.
- **Promjena tipa atributa iz aplikacije:** sheet `Restructure attributes` u Structure Excelu → Import → pregled
  → Apply → (Undo). Korak po korak; isti file drugi put kaže „Already in this state". Tvoj test na
  `Fitness_Garmin` prošao je u svih 8 koraka.
- **Usput popravljen stari kvar:** Structure uvoz je kvario kratice kolone liste kad vrijednost sadrži `|` (`:-|`).
- Na TEST-u je sve kao prije testa: `mood` broj, `pace` tekst `mm:ss`.

## Što treba od tebe
1. **Studeni krug (bez razvoja, nepromijenjeno):** T-S175-1 MC ~02.–11.11., T-S175-2 Visa ~05.11., T-S175-3
   ZABA_2026-10, T-S181-3. To je ispit „Financije su dovoljno gotove".
2. Kad stigneš: T-S174-3 / T-S174-5 (PROD razvrstavanje starije povijesti).
3. Iz S186 ništa ne čeka tebe.

## Sljedeće (prijedlog)
⚠ **Promijenjeno 27.10.:** prvo model treninga (v. vrh) — tvoje odluke d1, d2a, d2b su u `TRENING_MIGRACIJA.md`.
Ispod je stari prijedlog; A4 dolazi poslije.
**A4 — „merge into"** (spoji atribut B u A na istom eventu): treći korak alata, kroz isti sheet i isti panel.
Poslije toga je F2 alat cijel (A1 + A2 + A4), pa: **deploy F2 na PROD** (tvoja odluka; `059`/`060` ti pustiš u
SQL editoru) i nastavak treninga — model dana (`TRENING_MIGRACIJA.md`), Garmin san iz novog izvoza.

---

# DIO 2 — tehnički (za Claudea)

## Izvedeno (S186)
| Što | Gdje | Dokaz |
| --- | --- | --- |
| Kolona liste čita P2 roditelje | `src/lib/listChainValues.ts`, `useListColumnValues.ts` | unit 17 (sabotaže 5/2/2), E2E `S186_list_parent_attr` |
| Sheet `Restructure attributes` (engleski) | `restructure/attrSheet.ts`, predložak u `structureExcel.ts`, čitanje u `structureImport.ts` §13 | `restructureAttrSheet` 43 |
| A1 korak po korak + „Already in this state" | `restructure/attrApply.ts`, `AttrRestructurePanel.tsx`, `retype.ts` (`state`) | E2E `S186_attr_restructure` (sabotaža ⇒ „Blocked"), `restructureRetype` 44, T-S186-4 ✅ |
| Ćelija `Map` u `ListColumns` | `listColumns.ts` (`serializeColumnMap` / `parseColumnMap`) | `listColumnMap` 8, E2E S119 |

Spec: `PREUREDJIVANJE_SPEC.md` §34 (odluke: engleski, korak po korak, stanje baze umjesto oznake u fileu).

## Za S187 — d1 i vidljivost polja (prvi koraci novog plana)
- **d1:** ukinuti implicitno skrivanje na defaultu — `isHiddenByDefault`, `isRevealedOnly`, `requiredParentSlugs`
  u `AttributeChainForm.tsx` (tri mjesta se mijenjaju ZAJEDNO, zamke S131/S136). Vidljivost = samo `HiddenInAdd`.
  Pogođeno samo `Fitness` (8 atributa) i `Financije_old`; `Financije_all` nijedan (PROD backup 22.10.). CLAUDE.md
  opisuje današnje ponašanje (S117, S131) — prepisati uz kod.
- **Vidljivost uz vrijednost:** novi ključ u `validation_rules` (samo kroz `validationRules.ts`), stupac u
  Structure Excelu (slovo se računa, S160), forma; obavezno + skriveno razrješava se kao kod `hidden_in_add`.
  Prije koda dogovoriti oblik: jedna vrijednost ili popis; samo isti event ili i roditelj.
- Zatim model `Activity1` + `Dio` na TEST-u (`Fitness_Garmin`), pa mjerenje notacije iz PROD `Strength`
  (`sets_reps`, `weight_info`) — Saša pokreće PROD čitanje ili radimo iz backupa.

## Kasnije — A4 „merge into" (spec §25, §27)
- **Planer** `planMerge` (čist), uz `retype.ts`: tablica §25 (prazno/isto/različito ⇒ sukob ostaje u B);
  config prati reference B → A **istim funkcijama kao rename sluga** (`renameSlugInDashboard`,
  `renameSlugInGroupings`, `renameSlugInListColumns`, `renameSlugInAutomations`; `depends_on` kao §12.2);
  izbornik = unija; `export_profiles` ključevi nose IME ⇒ upozorenje. Blokade: različit tip, različita
  kategorija, B je `depends_on` roditelj trećeg.
- **SQL `061`**: `rpc_restructure_merge` — zasebna funkcija, ISTI zapis (`restructure_ops`/`_op_rows`), povrat =
  `rpc_restructure_undo` (058). ⚠ Brisanje atributa B („Delete source") je NOVA vrsta zapisa (cijeli redak
  `attribute_definitions`) ⇒ grana u `_restructure_current` **i** `_restructure_write_config` (zamka S185 u CLAUDE.md).
  `event_attribute` zapis s `before NULL` (redak nije postojao) / `after NULL` (obrisan) već postoji u 058.
- **„Već izvedeno" za merge:** B nema nijedan redak (ili ne postoji) ⇒ `done`. Sukobi ⇒ B ostaje s retcima ⇒
  sljedeći prolaz opet „Next" sa samo sukobima (0 premještanja) — pregled to mora reći, ne nuditi prazan Apply.
- **App:** `previewAttrSteps` danas za `merge` vraća `unsupported` — zamijeniti planom; panel dobiva tablicu
  „Conflicts" (žuto, ne blokira). E2E obrazac: `S186_attr_restructure`.
- Na TEST-u kandidat za dokaz: `Fitness_Garmin` — atributi istog tipa na istoj kategoriji (npr. dva tekstualna
  na `Outdoor`); posijati par sukoba kao S185 za `mood`.

## Otvoreno / zapamti
- `TextOptions` i `DateMap` u Structure uvozu i dalje dijele na golom `|` — opcija s `|` se ne da zapisati.
- Ponovno mjerenje A1 učita cijelu Areu (8,9 s za 1.936 redaka) — suziti na atribut ako zasmeta.
- Deploy F2 na PROD: `059`/`060` (Saša u SQL editoru, `backup_db` prije, `dump_schema --diff` poslije). Bez `060`
  panel A1 pada na RPC — ali tek kad netko popuni sheet; lista-lanac popravak ne treba migraciju.
- Nepromijenjeno: 056 granica 4 dimenzije (Financije na njoj); klasifikator odbija i read-only PROD alate ⇒
  PROD mjerenja pokreće Saša; model dana DIARY (280 dana s više Garmin treninga).
