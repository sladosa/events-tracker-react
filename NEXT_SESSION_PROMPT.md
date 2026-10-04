> Pisano protiv commita **S160b** na `test-branch` (zadnji commit = „S160b: kraj sesije").
> **`main` = `006374c` (deploy S160, 04.10.)** — svih 8 testova S160 ✅ i arhivirano. Na `test-branch` je POSLIJE deploya još **S160b** (grantee bez „Other...") + dvije sitnice (Import se ne nudi nakon odbijanja; `---` u Helpu) — idu s idućim deployem (Saša: zasebni nije potreban).
> ⚠ Ako `git log` pokazuje noviji commit od S160, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S160 (2026-10-04)

---

# DIO 1 — netehnički (za Sašu)

## Što je napravljeno u S160

- **Tihi gubici (P1):** zapamćeni filtar više ne prelazi na drugi račun u istom pregledniku ·
  Structure Export na grešci kaže „no file saved" umjesto praznog filea · Activities uvoz imenuje
  atribute koje Area nema („NEĆE biti upisane …") · Structure uvoz **staje** kad bi obrisao opciju
  koju retci nose (popis + kvačica) i kad je file tuđe Aree (prije: tihi duplikat Aree).
- **UX (P3):** Filter by za **datum** (operator, cijeli dan) i **da/ne** · Help odgovor bez `#`/`**`
  · Structure panel pita „Discard unsaved changes?", kartice atributa zadano sklopljene, opcije
  odmah u „New attribute".
- **Iz tvog testiranja (6 nalaza, svi popravljeni):** „Load next" kad je sve učitano · „Filter by"
  skakao na Comment · ukupan broj vidljiv odmah („20 loaded · 653 events total") · prazna Structure
  tablica uz filtar na leaf · kartice zadano sklopljene · pomoćni list Structure filea slao u krivi stupac.
- **D3 spec** napisan: `docs/D3_UVOZ_TUDJEG_FILEA_SPEC.md` — šest odluka (D3-1..6) čeka tebe.
- **F5 odlučeno:** `dashboard` i `export_profiles` idu u Structure Excel kao jedan sheet
  `AreaSettings` (redak = Area | Putanja | Vrijednost). Nije izgrađeno.
- **S160b (nakon deploya, samo `test-branch`):** grantee više nema „Other..." ni na jednom
  izborniku — umjesto njega siva stavka „Nova opcija? Dodaje je vlasnik Aree (…)". Nove
  Tipove/Podtipove dodaje Koka (ili ti pod njezinim računom).

## Što treba od tebe

1. ✅ Merge S160 napravljen 04.10. (`006374c`), T-S160-7 i T-S160-8 prošli na PROD-u.
   S160b + dvije sitnice su na `test-branch` — **nema zasebnog deploya**, idu s idućim
   (naredbe: CLAUDE.md § End of session 11).
   **T-S160b-1** (ostatak): kad si idući put pod Kokinim računom — Add → Podtip ⇒ „Other..." postoji.
2. Koka: zatvori/otvori karticu (novi bundle).
3. **D3 odluke** (spec §7) kad stigneš — bez njih se D3 dalje ne gradi.
4. **Financije — nepromijenjeno od S158:** ~05.–07.10. Visa izvod za rujan (javi kad stigne) ·
   11.10. Koka u traci (1.189,34) · ZABA izvod (`FINANCIJE_PROCES.md` §5).

## Što je sljedeće u backlogu (prioriteti dogovoreni S160)

- **P2 Financije po kalendaru:** Visa buduće rate uz rujanski izvod (T28) + `rate_alat --only a`
  (T24, 91 ispravak) · prije/poslije 11.10.: T22 (MC ostatak na ZADNJOJ rati), T21 (guard za
  kartice), T12 (Σ košare po jednom dospijeću).
- **P3 ostatak:** F5 `AreaSettings` (format odlučen) · Help chip „What can I do here?" · D3-F1
  (nakon tvojih odluka).
- **P4:** promjena Aree čita `categories` 7× / `areas` 4× · Edit `datetime` u UTC satu ·
  rename sluga ne popravlja `attribute_rules`.

---

# DIO 2 — tehnički (za Claudea)

## Stanje grana i baza

`main` = `006374c` (S160). `test-branch` = S160 + S160b + 2 sitnice (app + `help.ts`, **bez migracije**). TEST =
kopija PROD-a od **01.10.**; `Financije_all` na TEST-u pripada **sasasladoljev59@gmail.com** i
**nije dijeljena** (`owner@test.com` ima seed `Financije`) — test grantee puta na TEST-u traži share.

## Novo u S160

- `src/lib/storedFilter.ts` (`parseStoredFilter`) — FilterContext zapis nosi `userId`; zapis bez
  njega se odbacuje.
- `useStructureData` → `{ refetch, load }`: `load` baca (Export, review file), `refetch` hvata (prikaz).
  `retry.ts` izvozi `toError`.
- `excelImport.ts`: `findDroppedAttributes` / `droppedAttributesWarning` (pregled + apply).
- `structureImport.ts` § 5b: K-1 (tuđa Area ⇒ throw; `confirmOptionRemovals` opcija; rezultat
  `blocked` + `optionRemovals`). `validationRules.ts`: `allOptions`, `removedOptions`.
- `src/lib/helpMarkdown.ts` + `components/help/HelpMarkdown.tsx`; `help.ts` pravilo formatiranja.
- `StructureNodeEditPanel`: `dirty`/`pendingLeave`/`edited()`, `onDeletedSaved`, `attrCardWarnings`,
  ključ `structure-attr-expanded` (stari `structure-attr-collapsed` se briše).
- `attrFilterNumeric.ts`: `AttrFilterKind`, `dateFilterBounds` (UTC), `booleanFilterValue`,
  `isTypedFilterReadable`, `describeTypedFilter`; `eventQueryBuilder` `valueColumn`.
- `useActivities`: `hasMore` iz `count`; dep liste s `attrFilter?.kind` (pet polja).
- `AppHome`: `clearAttrFilterKeepField` + `keepFilterFieldRef`.
- `StructureTableView`: sklapanje Aree samo kad je njezin redak prikazan.
- `structureExcel.ts`: `colOf(key)` u `HelpStructure`.
- Testovi (svi provjereni sabotažom): `storedFilter`, `importDroppedAttrs`, `structureOptionRemoval`,
  `helpMarkdown`, `attrFilterTyped`, `structureHelpLetters`. `npm run check` = 35 fileova, 0 palo.

## Otvoreno / neverificirano

- `test-branch` ispred `main`: S160b (`noNewOptionsHint`, `failedOptionsMessage`), `StructureImportRefused`, `hr` u Help markdownu.
- T-S160b-1 vlasnička strana neizmjerena (na TEST-u nema lozinke za vlasnika `Health_Sasa`).
- T-S140-8 + T-S141-1: puni E2E run nakon S159 fan-out popravka nije pokrenut (E12-2 pada na
  podacima TEST-a — dva `Health_Sasa`).
- `Rate? = No` broji samo spremljeno Ne (TEST: 1 od 659); „nema vrijednosti" bi tražio NOT EXISTS.
- Brana „atribut koji Area nema" je upozorenje, ne zabrana — vlastita kvačica je odluka uz D3-F1.
- Financije (iz S158, nepromijenjeno): T24 higijena, T-S158-2, Visa listopad, `DOSPJELO_SPEC`
  Visa `text` zastario, 2 stara MC plana iz 2025.
