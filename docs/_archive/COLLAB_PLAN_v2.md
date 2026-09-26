# COLLAB_PLAN_v2.md
# Events Tracker — Definitivni plan implementacije kolaboracije

**Datum:** 2026-04-03
**Status:** Faze 0–9 implementirane — testiranje u toku
**Branch:** `collab` (već kreirana iz `test-branch`)
**Prethodni plan:** `docs/COLLAB_PLAN_v1.md` (referenca za Faze 0–4, sve ✅)
**UX dizajn:** `docs/COLLAB_UX_DESIGN_v1.html`

---

## Sharing model

| Rola | Može | Ne može |
|------|------|---------|
| **Owner** | Sve + Share + Manage access | — |
| **Grantee write** | Add/Edit vlastite evente, Export | Edit strukturu, Manage shares, Delete tuđih eventa |
| **Grantee read** | View evente, Export | Add, Edit, struktura |

- Sharing je uvijek na razini **cijele Area** (ne category-level)
- Korisnici su u istom Supabase projektu (ne federation)
- RLS automatski filtrira što korisnik smije vidjeti/pisati

---

## Status faza

| Faza | Opis                                                        | Status |
| ---- | ----------------------------------------------------------- | ------ |
| 0    | TEST Supabase setup                                         | ✅ S34  |
| 1    | SQL migracije 008+009                                       | ✅ S34  |
| 2    | useDataShares + FilterContext.sharedContext                 | ✅ S35  |
| 3    | Structure tab guard (Edit Mode sakriven za grantee)         | ✅ S35  |
| 4    | Activity guards (AddActivity lock, EditActivity isOwnEvent) | ✅ S35  |
| 5    | Structure tab UX + Edit Mode fix                            | ✅ S36  |
| 6    | User indicator (Activities lista)                           | ✅ S38  |
| 7    | Share Management UI Modal                                   | ✅ S40+S41 |
| 8    | Profile settings modal                                      | ✅ S42  |
| 9    | Help panel (u Share Management modalu + grantee banneri)    | ✅ S42  |
| 10   | Excel Export/Import — novi format                           | ⬜      |
| 11   | Merge na main                                               | ⬜      |

---

## Finalizirane UX odluke

| #   | Odluka                               | Odabrano                                          |
| --- | ------------------------------------ | ------------------------------------------------- |
| D1  | Add Activity za read grantee         | Greyed out + disabled (Opcija A)                  |
| D2  | Share Management smještaj            | Modal (Opcija B)                                  |
| D3  | User indicator stil                  | Avatar + ime                                      |
| D4  | ⋮ menu na tuđim eventima             | Samo "View" opcija                                |
| D5  | Export za read grantee               | Da — RLS određuje što vidi                        |
| D6  | Profile settings smještaj            | Modal iz header avatara                           |
| D7  | User kolona u Excelu                 | Email (stabilan identifikator)                    |
| D8  | Import User kolona                   | Smart import (vidi Faza 5)                        |
| D9  | User kolona — uvijek ili samo shared | Uvijek (breaking change prihvaćen — DB je testna) |
| D10 | Export za read grantee               | Duplikat D5 — Da                                  |

---

## Faza 5 — Structure tab UX + Edit Mode fix

### 5a — Edit Mode fix

**Bug:** Edit Mode gumb prikazuje se samo za "All Areas" — treba biti dostupan i za filtrirane Areas.

**Fix:** Ukloniti uvjet koji skriva Edit Mode gumb kad je specifična Area odabrana.

**Fajl:** `src/components/structure/StructureTableView.tsx`

### 5b — Banners

**Owner + specific shared Area selected:**
- Structure tab: purple banner
  > 🔗 **This Area is shared** — Ana (write). Structure changes affect all users.
  > `[⚙ Manage Access]`

**Write grantee + specific shared Area selected:**
- Activities tab: green banner
  > ✅ **Fitness** — shared Area (write access). Owned by **Saša** · usera@test.com `[Copy email]`
  > Structure is read-only for you.
- Structure tab: green banner (isti tekst)

**Read grantee + specific shared Area selected:**
- Activities tab: amber banner
  > 👁 **Fitness** — shared Area (read only). Owned by **Saša** · usera@test.com `[Copy email]`
  > `[✉ Request write access]`

**All Areas filter:** Nema bannera. Umjesto toga:
- Inline `🔗` badge na Area-level redu u Structure tablici
- Sunburst: vizualni marker (npr. drugačiji stil segmenta) + tooltip "🔗 Fitness — shared Area"

### 5c — ⋮ menu po roli

**Owner — Area-level red:**
- Edit, Delete, Add Child
- `⚙ Manage Access` (otvara Share Management modal)

**Write grantee — Area-level red:**
- 👁 View details
- 👤 Owner: Saša · `[Copy email]`

**Write grantee — Category/child red:**
- 👁 View details
- 👤 Owner info (s napomenom da je sharing na Area razini)

**Read grantee — Area-level red:**
- 👁 View details
- ✉ Request write access → modal s owner emailom + Copy email
  > Modal: "Fitness > [Kategorija] je dio Area **Fitness**. Sharing je uvijek na razini cijele Area."

**Read grantee — Category/child red:**
- 👁 View details
- ✉ Request write access → isti modal s Area-level scope objašnjenjem

---

## Faza 6 — User indicator (Activities lista)

### 6a — User kolona u UI

**Kada prikazati User kolonu:**
| Situacija | Prikaži? |
|-----------|---------|
| Owner, non-shared Area | ❌ Sakrij |
| Owner, shared Area (active shares) | ✅ Prikaži |
| Grantee (write ili read) | ✅ Prikaži |

**Stil:** Avatar (inicijali iz display_name, hash user_id → konzistentna boja) + ime
- "You" badge za vlastite evente
- Ime iz `profiles.display_name` za tuđe evente

**Signal:** `useDataShares` hook provjerava active shares za trenutnu Area.

### 6b — D1 i D4 implementacija

**D1:** Add Activity gumb za read grantee — `disabled` + tooltip "Read only access"

**D4:** ⋮ menu na tuđim eventima — samo "View" opcija (Edit/Delete sakriveni)

---

## Faza 7 — Share Management UI Modal

### 7a — Entry points

1. `🔗 Shared with N` badge u filter baru (uz Area dropdown, samo kad area ima active shares)
2. `⚙ Manage Access` u Structure tab banneru (samo kad specific Area selected + shared)
3. `⚙ Manage Access` u ⋮ meniju Area-level reda u Structure tablici (uvijek za ownera)

### 7b — Modal sadržaj

```
Share "Fitness"                                    [✕]
─────────────────────────────────────────────────────
Active access
  [AN] Ana  ana@example.com          [write]  [Revoke]

— Pending invites —
  marko@example.com  (Waiting for registration)   [Cancel]

Invite someone
  [email@example.com]  [write ▼]  [Invite]
```

**Responsive:** Na malom ekranu help tekst sakriven iza ❓ ikone u modal headeru.

**Share promjene ne zahtijevaju Edit Mode** — modal je dovoljna zaštita (intentional akcija).

**Novi komponent:** `src/components/sharing/ShareManagementModal.tsx`
**Hook:** `useDataShares.ts` već postoji (S35) — nadograditi za invite/revoke UI

---

## Faza 8 — Profile settings modal

**User kolona:**
- Pozicija: između `created` i `leaf comment` (bila G, sad postaje nova kolona, leaf comment prelazi na F+1)
- Format: email (npr. `usera@test.com`)
- Excel column grouping, default open (može se zatvoriti radi prostora)
- Uvijek prisutna (i za non-shared Areas — isti email u svakom redu)
- **Samo u EVENT DATA sekciji** — nije u ATTRIBUTE LEGEND sekciji (nije atribut definicija)

Novi redosljed kolona u EVENT DATA:
```
event_id | Area | Category_Path | event_date | session_start | created | User | leaf comment | atributi...
```

**Stari format napušten** — DB je testna, nema backward compatibility. Samo novi format.

**Fajlovi za izmjenu:**
- `src/lib/excelExport.ts` — dodati User kolonu, ažurirati indekse svih ostalih kolona
- `src/lib/excelImport.ts` — čitati novi raspored kolona

### 5b — Structure sheet — novi format

**SharedWith kolona:**
- Pozicija: odmah iza `Area` kolone (nova kolona C, ostale se pomiču)
- Širina: ~9 (uska, čisto informativna)
- Format: `email1|email2` (`|` separator — konzistentno s TextOptions/Val.Min kolonom)
- Samo na **Area-level redovima** (Type = "Area") — na Category i Attribute redovima prazno
- **Export only — ignorirana na importu** (sharing se managea kroz UI, ne kroz Excel)

**Fajlovi za izmjenu:**
- `src/lib/structureExcel.ts` — dodati SharedWith kolonu na Area redove
- `src/lib/structureImport.ts` — ignorirati SharedWith kolonu na importu

### 5c — Help sheetovi

**HelpEvents sheet** — ažurirati popis kolona s novom User kolonom i njenom pozicijom.

**HelpStructure sheet** — dodati dokumentaciju za SharedWith kolonu:
> `SharedWith` — List of emails with access to this Area at time of export, separated by `|`.
> **Informational only — ignored on import.** Sharing is managed through the app's Share Management UI.

### 5d — Export logika

Za shared Area (owner ili grantee): ukloniti `.eq('user_id', userId)` filter u export queryu.
RLS automatski filtrira što korisnik smije vidjeti — nema posebne logike za različite role.

**Fajlovi za izmjenu:**
- `src/lib/excelExport.ts` — uvjetno ukloniti user_id filter kad je shared Area

### 5e — Smart import

**Detekcija multiple users:** Kad import detektira više različitih emaila u User koloni → Smart import modal.

**Import modal opcije:**
1. 🔘 **Smart import** (default) — matchaj email po DB; fallback s prefixom u leaf commentu
2. ⬜ **Only my events** — importiraj samo redove gdje `User = trenutni korisnik email`
3. ⬜ **All as mine** — sve → current user account

**Smart import logika po redu:**
| Situacija | Akcija |
|-----------|--------|
| Email = current user | Import normalno pod current user_id |
| Email postoji u DB + Area shared s njim | Import pod ispravnim user_id ✅ |
| Email ne postoji u DB | Import pod current user + prefix `[email \| Not in DB]` u leaf commentu ⚠️ |
| Email postoji ali Area nije shared s njim | Import pod current user + prefix `[email \| Not shared]` u leaf commentu ⚠️ |

**Summary preview prije commita** (prikazuje se uvijek za smart import s više korisnika):
```
• usera@test.com: 45 events → your account ✅
• userb@test.com: 23 events → your account (Not in DB) ⚠️
```

**Warning za single-user fajl:** nema posebnog warninga (nema multiple users).

**Fajlovi za izmjenu:**
- `src/lib/excelImport.ts` — smart import logika, email lookup u profiles tablici
- `src/components/activity/ExcelImportModal.tsx` — nova opcija selekcija + summary preview

## Faza 9 — Help panel

Help je integriran u Share Management modal (Faza 7) — nema zasebnog Help taba.

Sadržaj je role-aware:
- Owner vidi owner pravila
- Grantee vidi svoja pravila

Smještaj u modalu: kompaktan tekst ispod invite forme (uvijek vidljiv na desktopu, ❓ ikona na mobilnom).

---

## Faza 10 — Excel Export/Import — novi format

### 10a — Events sheet

**User kolona:**
- Pozicija: između `created` i `leaf comment`
- Format: email (npr. `usera@test.com`)
- Excel column grouping, default open
- Uvijek prisutna (i za non-shared Areas — isti email u svakom redu)
- **Samo u EVENT DATA sekciji** — nije u ATTRIBUTE LEGEND sekciji

Novi redosljed kolona u EVENT DATA:
```
event_id | Area | Category_Path | event_date | session_start | created | User | leaf comment | atributi...
```

**Stari format napušten** — DB je testna, nema backward compatibility.

**Fajlovi:** `src/lib/excelExport.ts`, `src/lib/excelImport.ts`

### 10b — Structure sheet

**SharedWith kolona:**
- Pozicija: odmah iza `Area` kolone
- Širina: ~9 (uska, informativna)
- Format: `email1|email2` (`|` separator)
- Samo na Area-level redovima — na Category/Attribute redovima prazno
- **Export only — ignorirana na importu**

**Fajlovi:** `src/lib/structureExcel.ts`, `src/lib/structureImport.ts`

### 10c — Help sheetovi

**HelpEvents:** ažurirati popis kolona s novom User kolonom i pozicijom.

**HelpStructure:** dodati dokumentaciju za SharedWith:
> `SharedWith` — List of emails with access to this Area at time of export, separated by `|`.
> **Informational only — ignored on import.** Sharing is managed through the app's Share Management UI.

### 10d — Export logika

Za shared Area: ukloniti `.eq('user_id', userId)` filter u export queryu.
RLS automatski filtrira — nema posebne logike za različite role.

**Fajl:** `src/lib/excelExport.ts`

### 10e — Smart import

**Detekcija multiple users:** Kad import detektira više različitih emaila u User koloni → Smart import modal.

**Import modal opcije:**
1. 🔘 **Smart import** (default) — matchaj email po DB; fallback s prefixom u leaf commentu
2. ⬜ **Only my events** — importiraj samo redove gdje `User = trenutni korisnik email`
3. ⬜ **All as mine** — sve → current user account

**Smart import logika po redu:**
| Situacija | Akcija |
|-----------|--------|
| Email = current user | Import normalno pod current user_id |
| Email postoji u DB + Area shared s njim | Import pod ispravnim user_id ✅ |
| Email ne postoji u DB | Import pod current user + prefix `[email \| Not in DB]` u leaf commentu ⚠️ |
| Email postoji ali Area nije shared s njim | Import pod current user + prefix `[email \| Not shared]` u leaf commentu ⚠️ |

**Summary preview prije commita:**
```
• usera@test.com: 45 events → your account ✅
• userb@test.com: 23 events → your account (Not in DB) ⚠️
```

**Fajlovi:** `src/lib/excelImport.ts`, `src/components/activity/ExcelImportModal.tsx`

---

## Faza 11 — Merge na main

### Checklist:
- [ ] Sve faze testirane na TEST Supabase s 2 korisnika (owner + grantee)
- [ ] Smart import testiran sa shared Area Excel fajlom
- [ ] `npm run typecheck` prolazi
- [ ] `npm run build` prolazi
- [ ] SQL migracije 008+009 revizija gotova
- [ ] `HelpEvents` i `HelpStructure` sheetovi ažurirani
- [ ] CLAUDE.md backlog ažuriran
- [ ] PENDING_TESTS.md ažuriran

### Redosljed za produkciju:
1. Pokrenuti `008_profiles.sql` na PROD Supabase (ako nije)
2. Pokrenuti `009_sharing.sql` na PROD Supabase (ako nije)
3. Verifikacija: postojeći single-user korisnici rade normalno
4. `git checkout main && git merge collab`
5. `git push origin main` → Netlify deploy

---

*Plan kreiran: 2026-04-03 — na osnovu UX review sesije*
*Kodirati u svježem chatu, grana `collab`*
