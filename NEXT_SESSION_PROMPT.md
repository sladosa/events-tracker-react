> Pisano protiv commita **S162** na `test-branch` (zadnji commit = „S162: …").
> **`main` = `006374c` (deploy S160, 04.10.)**. Na `test-branch` čekaju deploy: S160b (grantee bez
> „Other..."), S161 (samo Python + docs) i S162 (app: View datetime, rename sluga, lista iz keša,
> Structure Delete). Nijedna migracija.
> ⚠ Ako `git log` pokazuje noviji commit od S162, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S162 (2026-10-05)

> **Ukratko (S162):** popravljene četiri tihe greške — View je pokazivao datum naplate pomaknut
> za dva sata, preimenovanje atributa ostavljalo je mrtve veze u automatici i predlošku komentara,
> lista je radila tri nepotrebna kruga do baze, a brisanje kategorije s unosom zapinjalo je na
> skrivenom roditeljskom zapisu; sve potvrđeno testovima na TEST-u.

---

# DIO 1 — netehnički (za Sašu)

## Što je napravljeno u S162

- **View pokazuje isti sat kao Edit.** Datum naplate je u Viewu bio pomaknut za 2 sata, a kasno
  navečer čak na sljedeći dan. Sad pokazuje točno ono što je spremljeno.
- **Preimenovanje sluga u Structure panelu više ne ostavlja mrtve veze.** Uz pločicu i kolone
  liste sada popravlja i pravilo „Datum naplate po Izvoru", rata modal, traku „Čeka potvrdu" i
  predložak komentara. Ti si to izmjerio na `podtip` i `izvod_opis`.
- **Lista se brže puni nakon promjene Aree ili kategorije.** Umjesto tri uzastopna upita bazi prije
  liste, kategorije se računaju iz memorije. Izmjereno: 9 → 2 upita (na PROD-u 1).
- **Brisanje kategorije s eventom sad radi do kraja.** Prije bi obrisalo redak, a kategoriju ne
  („Some records could not be removed"). Našao si to u testu; popravak čuva automatski test.
- Svi testovi S162 i zaostali T-S160b-1 su ✅; S160b i S162 arhivirani.

## Što treba od tebe

1. **11.10.** Koka u traci potvrđuje MC naplatu (1.189,34) — T-S158-1 / T-S156-6.
2. **RF izvod**, kad stigne: `promet_check` za RF.
3. **~03.11. Visa izvod za listopad** — platiš, javiš datum, ista naredba (T-S161-3).
4. **Deploy** S160b + S161 + S162 kad ti odgovara (naredbe: CLAUDE.md § End of session 11). Ništa
   od toga ne traži Koku ni migraciju; Koka dobije bržu listu i ispravan View.
5. **D3 odluke** — `docs/D3_UVOZ_TUDJEG_FILEA_SPEC.md` §7, šest pitanja s prijedlozima. Nisu hitne
   (v. dolje).

## Što je sljedeće — prijedlog iz S162 (nije odlučeno)

Odluke stoje na jednom mjestu: **D3 spec §7**. `BACKLOG.md` „Čeka Sašinu odluku" je prazan
namjerno. Redoslijed koji sam predložio, uz obrazloženje iz CLAUDE.md („Collab se ne širi dok
povijesna ingestija nije gotova" — D3 je baš širenje suradnje):

1. **Sesija održavanja Financija prije ~05.11.:** T2 + T28 „Visa u traku" (s budućim ratama 4 stara
   plana), T24 `rate_alat --only a` (91 redak), T22 MC ostatak na zadnjoj rati, T21, T12. Ima rok.
2. **`trening.xlsm`** — sljedeća velika ingestija (Zdravlje/Fitness povijest). Strateški sljedeći
   korak; Financije su u mjesečnoj rutini.
3. **D3:** prihvatiti prijedloge §7 kakvi jesu, izgraditi samo **D3-F1** (popis razlika, samo čita);
   F2/F3 kad se pojavi stvaran primatelj filea.

---

# DIO 2 — tehnički (za Claudea)

## Stanje grana i baza

`main` = `006374c` (S160). `test-branch` = + S160b, S161, S162. TEST = kopija PROD-a od **01.10.**
(nema S161 uvoza). TEST nakon S162 testova vraćen: slugovi `podtip`/`izvod_opis`, `S162 probe`
obrisan (izmjereno).

## Novo u S162 (kod)

- `src/lib/categoryTree.ts` — `areaCategoryIds` / `descendantIds` / `ancestorIds` / `leafOnly`
  nad `categoryCache` mapom; koriste ih `resolveLeafCategoryIds`, `useDateBounds`, AppHome
  „Filter by". `getCategoryMapContaining` jednom osvježi keš kad tražene kategorije/Aree nema.
  `getCategoryMap` paginiran. `dateBounds.test.mjs` stubira `categoryCache`.
- `src/lib/automationsConfig.ts` — `fixupAutomationsSlug` (Area `automations` + `comment_template`,
  `categories.settings.comment_template`); `dashboardConfig` sad i `due.settle` ključeve.
- `displayDatetime` (`excelDatetime.ts`) u `ViewDetailsPage`.
- `StructureDeleteModal.cascadeDelete` briše i evente s `chain_key ∈ podstablo`.
- Testovi: `slugRenameConfig.test.mjs`, `categoryTree.test.mjs`,
  `e2e/tests/S162_delete_leaf_chain_parent.spec.ts`; S107b-2 spec: natpis iz S152.

## Otvoreno / neverificirano

- **E12-2 pada i na čistom S161:** Templates segment na TEST-u nema predložak `Health` (ima
  Finance/Work/Personal/Demo) — stanje TEST baze, ne kod. Ili seed, ili spec.
- `areas` 3–4 upita po promjeni Aree u devu (dashboard ×2 StrictMode, `FilterContext`, imena) —
  izmjereno, procijenjeno da ne vrijedi.
- `export_profiles` i dalje ne preživi rename (ključ nosi ime atributa).
- Otvoreni testovi: T-S161-3, T-S158-1/2/4/5, T-S156-5/6/7, T-S154-2, T-S152-7, T-S145-3,
  T-S141-1, T-S140-8 (`audit_tests.py`).
- MC alat (`fill_from_izvod --mc`) još bez S161 pravila (T13/T14). `DOSPJELO_SPEC` Visa `text`
  zastario; 2 stara MC plana iz 2025.
