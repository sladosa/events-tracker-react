# NEXT SESSION PROMPT — nakon S118 (Koka je na PROD-u)

**Pisan protiv commita `3cef973`** (+ commit zatvaranja S118 koji slijedi odmah iza).
Ako `git log --oneline -1` pokazuje nešto puno novije, čitaj ovo kao povijest; `CLAUDE.md` je autoritet.

**Stanje grana:** `main` nosi S108–S117 (pushano 24.08.), `test-branch` je jedan
dokumentacijski commit ispred. **U S118 nije mijenjan nijedan `.ts`/`.tsx` file** — sav
posao je bio SQL (`039`–`042`), podaci i dokumentacija. Deploy zato nije potreban.

> S118 nije bio dan pisanja koda nego dan **useljenja**. Tri kvara koja su izašla imaju
> zajedničko svojstvo: svaki od njih **javi uspjeh** i ne napravi ono što piše.

---

# DIO 1 — Jednostavnim rječnikom (za Sašu)

## 1. Što je gotovo

**Koka radi na PROD-u.** Njena area `Financije_all` ima **2.312 eventa** (2025-01-01 do
danas), saldo `ZABA 13.239,31` i `RF 796,43` — isti brojevi kao na TEST-u, u cent.

Povijest nije išla kroz pipeline nego **Excel roundtripom s TEST-a** (tvoja ideja, i bila je
bolja od mog plana — TEST nosi sve ispravke iz S110–S117 kojih u Review workbooku nema).

Stara `Financije` je obrisana, ali tek nakon što je izmjereno da **ne nosi ništa novo**.
`Financije_old` ostaje dok 2023./2024. ne prođu pipeline — to je jedina kopija tih godina.

## 2. Što slijedi

**Ništa hitno.** Sve što je ostalo je provjera uživo, a ne posao:

- **Ona neka radi par dana** i javi što joj smeta
- Kad prvi put upiše stanje s ekrana banke → to je **T-S118-3**, jedini put kroz sidro koji
  na PROD-u nikad nije izveden
- Shortcutove treba složiti iznova (stari su otišli sa starom areom — bili su vezani na
  njene stare atribute i nisu se dali preseliti)

**Jedna rečenica njoj:** *kad počneš upisivati u app, u Excelicu više ne.* Radi li oboje,
sve dobijemo dvaput, a to se neće vidjeti dok se saldo ne raziđe.

## 3. Što stoji na tebi

- **Reci Koki za retke s krivom godinom** — `2036-04-08` (`Mirovina 1.323,64`,
  `Netdomena Igor 47,76`) i `2028-05-16` (`HLK 5/26`). Ispravak ide **u njen file**.
- **Redak `07.08. Parking 1,60`** je tipfeler u mjesecu (treba `07.07.`) — kod nas isključen,
  kod nje i dalje krivo.
- **Onih 5 spornih lipanjskih redaka** (Σ `373,11`) — i dalje neriješeno.
- **Odluka o siročadi:** 57 testova iz `S99`–`S104` bez retka u `PENDING_TESTS.md`.

---

# DIO 2 — Tehnički (za Claudea)

## 1. Prvo pročitaj

`docs/sessions/DONE_HISTORY.md` **S118** · `CLAUDE.md` → nove sekcije **„PROD ≠ TEST"** i
**„Uvoz — tri načina da uspije a ne napravi što misliš"** · `docs/sessions/tests/S118_tests.md`.

## 2. PROD — činjenice koje trebaš prije nego išta diraš

| | |
| --- | --- |
| area | `Financije_all`, id `de8662e6-54f7-4ded-ab42-a786e7456067`, slug `financije-all` |
| vlasnica | Koka — `dubravka.pavic-sladoljev@dps-perceptum.com` (`eeb78414`) |
| Saša | **write grantee** na toj arei |
| migracije | `035`, `036`, `038`, `039`, `040`, `041`, `042` — sve puštene |
| eventi | 2.312 (`2025-01-01 … 2026-08-25`) |
| sidra | ZABA `13.815,33 @ 30.07.` · RF `799,12 @ 11.08.` (oba s izvoda) |
| stare aree | Kokina `Financije` **obrisana**; Sašina `Financije_old` (2.774, 2023–2025) **ostaje** |

⚠ **Alati i dalje nose hardkodiran TEST `AREA_ID`** (`verify_rpc_vs_model.py:57`).
Za PROD treba proslijediti gornji id — nijedan alat to još ne prima kao argument.

## 3. Tri kvara iz S118 (dva popravljena, jedan nije)

**✅ Slug trigger** (`042`) — `generate_slug_from_name()` je na INSERT-u gazio proslijeđeni
slug. TEST taj trigger uopće nema. Sada „popuni ako ga nema". Slugovi poravnati u `040`.
⚠ **Nije viđeno kroz aplikaciju** (T-S118-1) — provjereno je `service_role` putem.

**✅ Stari keširani bundle** — nije bug nego postupak: **hard refresh prije Structure importa**.
Prvi uvoz je izgubio `comment_template`, `add_header`, `list_columns`, `hidden_in_add` i drugo
automation pravilo, a javio uspjeh.

**❌ BUG-S118-PREVIEWMODE** — `ExcelImportModal.tsx:106` zove `parseExcelFile` bez
`foreignMode`, pa „Import as mine" u previewu pokaže `0 New / 0 Modify`. Apply radi.
Fix je jedan argument. **Nije napravljen** jer bi tražio deploy usred migracije —
sad ga nema što blokirati.
⚠ Uz krivu brojku otpada i **provjera kolizija** (računa se u previewu), dakle za taj put
nema zaštite od dvostrukog uvoza istog filea.

## 4. Prvo što bih uzeo sljedeći put

1. **BUG-S118-PREVIEWMODE** — jedan argument, jedini otvoreni kvar iz S118
2. **Faza 3 — `set_attribute` na Import putu** („popuni ako je prazno"). Jedna rupa drži tri
   featurea; sad je i praktičnija nego prije, jer Koka radi kroz app i roundtrip.
3. **Faza 2 — brzi unos** (skupljanje prefilanih polja, shortcut dropdown)

⚠ **Batch 2024 i 2023** sada idu **na PROD**, ne na TEST — i to je okidač za preimenovanje
`Financije_all` → `Financije` (v. CLAUDE.md backlog: rename **kroz UI**, nikad importom).

## 5. Sitnice koje su pojele vrijeme

- **Backtickovi u `python -c "…"` kroz Bash** — bash ih izvrši i pojede sadržaj. Isti razred
  kao `git commit -m` iz S117. Rješenje: napiši sadržaj u file pa ga učitaj, ili heredoc.
- `event_attributes?event_id=in.(…)` s 2.300 id-eva **probije duljinu URL-a** (ne max-rows).
  Serije po ~60 id-eva.
- `attribute_definitions` nema `display_order` nego **`sort_order`**.
