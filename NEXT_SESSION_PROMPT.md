# Sljedeća sesija — handoff

**Pisano protiv commita:** `7009fa2` (`S133: broj eventa na Structure tabu`).
`main` je u S133 podignut na isto stanje. Ako `git log` pokazuje novije, čitaj
ovo kao povijest — CLAUDE.md je autoritet.

---

# DIO 1 — netehnički (za Sašu)

## Što je danas napravljeno

| | stanje |
| --- | --- |
| Jučerašnji popravak auto-komentara — **provjeren i pao** | ✅ dobro da smo provjerili |
| Pravi popravak (keš se briše bez obzira gdje si u appu) | ✅ potvrđen na PROD-u, u oba smjera |
| `no events yet` na kategoriji s 5.173 eventa | ✅ popravljeno |
| Deploy na PROD (S132 + S133) | ✅ |
| Zaštita podataka / backup | ⬜ **tema za sljedeći put** |

## Ono što je zapravo bila poanta dana

Jučerašnji popravak **nije radio**. Izgledao je ispravno, imao je test koji
prolazi, i bio bi otišao na PROD kao gotov posao. Pao je čim smo ga stvarno
isprobali u aplikaciji.

Isto se ponovilo s testom koji sam napisao danas: prošao je, pa sam namjerno
vratio pokvareni kod — i **opet je prošao**. Dakle nije čuvao ništa. To se vidi
samo tako da se pokvari kod i provjeri pada li test.

Dvaput u jednom danu, ista pouka: **ono što izgleda gotovo nije gotovo dok se ne
pokuša srušiti.**

## Što tebe čeka

1. **Ctrl+Shift+R** na PROD-u nakon što Netlify završi. Nije higijena nego dio
   postupka — stari keširani bundle je već jednom tiho osakatio uvoz.
2. **Jednom zatvori karticu** aplikacije, ti i Koka. Posljednji put: nakon toga
   pravilo „zatvori karticu nakon svake izmjene Structurea" **više ne vrijedi**.
3. **Provjeri Structure tab** — `Financije_all > Transakcija` mora pisati
   `5173 events`, ne `no events yet` (T-S133-7).
4. **Provjeri bravu** (T-S133-8): Edit Mode → ⋮ na toj kategoriji → `+ Add Leaf`
   mora biti **blokiran**. To je razlog zbog kojeg se popravljalo.
5. ⭐ **Pogledaj u Supabase dashboardu ima li PROD projekt automatske backupe.**
   To je prvo pitanje sljedeće sesije, i na njega samo ti možeš odgovoriti.
6. ⭐ **Neka Koka proba promijeniti opis kategorije** `Financije_all > Transakcija`
   (Structure → Edit → Save). Ne treba ništa zaključivati s ekrana — samo javi je
   li probala, pa provjerim u bazi je li se išta stvarno promijenilo. Razlog je
   dolje u DIO 2.

## Što treba od Koke

Ništa. Samo ono jednokratno zatvaranje kartice.

---

# DIO 2 — tehnički (za Claudea)

## Stanje grana

- `main` = `test-branch` = `7009fa2` (+ merge commit). Netlify deployao S132+S133.
- Nema SQL migracija u tom rasponu. Kod aplikacije dirnut u **dva** hooka.

## Novo u kodu

- **`clearChainCache()` je MODULE-LEVEL** (`useCategoryChain.ts`), na
  `areas-changed` i `structure-deleted`. Listener u hooku ostaje, ali samo
  osvježava React state dok je Add/Edit otvoren — **on nije brana**.
  ⚠ Ovisi o tome da rute nisu lazy-loadane (`App.tsx:12-13`). Uvede li se code
  splitting, `clearChainCache` mora u modul koji se učitava bezuvjetno.
- **`useStructureData` više ne broji u pregledniku** — `count: 'exact', head: true`
  po kategoriji, usporedno, `withRetry` pa throw.

## Otvoreno

- **T-S133-4** Structure **import** (ne panel) probije keš — neprovjereno.
- **T-S133-5** ⭐ **rename/premještanje pa Add u istoj kartici.** Keš ne hrani samo
  `comment_template`: `categoryChain.map(c => c.id)` gradi **P2 parent evente**
  (`AddActivityPage.tsx:1178`). Stara snimka upisala bi roditelje po **staroj**
  hijerarhiji. Nije provjereno ni prije ni poslije popravka.
- **T-S133-7/-8/-9** uživo na PROD-u nakon deploya.
- **T-S133-9** brzina Structure taba **kao grantee** — 0,46 s je izmjereno na
  TEST-u kao vlasnik; PROD grantee ide kroz skupu RLS granu (join na `data_shares`).
- **T-S133-10** E2E s `reuseExistingServer: true` može preuzeti `dev:prod` na 5173.
  Prijedlog: provjera u `global-setup` da posluženi build nosi `VITE_SUPABASE_URL`
  iz `.env.testing`, inače stani s greškom. **Nije izvedeno.**
- **T-S132-7** `--restore` i dalje netestiran. Backup od 11 komentara postoji.
- **T-S133-11** ⭐ **Vlasništvo nad kategorijom `Financije_all > Transakcija`.**
  Izmjereno 10.09. na PROD-u: Saša je **write grantee** na toj Arei, a ipak je
  spremio `comment_template` na leaf — jer politika `categories_update` glasi
  `user_id = auth.uid()` i gleda **vlasnika retka kategorije**, ne Aree. Taj redak
  nosi `categories.user_id = 768a6056` (Saša), dok `areas.user_id = eeb78414`
  (Koka). Jedina takva neusklađenost na PROD-u.
  ⚠ **Neizmjereno i važnije:** po istoj politici **Koka vjerojatno ne može pisati
  po vlastitoj kategoriji.** Prvo pokus, tek onda popravak. Ako se potvrdi, lijek
  je `UPDATE categories SET user_id = <Koka> WHERE id = ...` — pisanje po PROD-u,
  dakle preko Saše i s backupom (v. tema ispod, sad je konkretnija).
  ⚠ Usput izmjereno: `comment_template` **bez placeholdera** upisuje se doslovno
  (guard pali samo kad template ima `{...}`), pa je `Test` 2,5 minute bio živo
  pravilo nad Kokinom Areom. Nula pogođenih redaka — samo zato što u tom prozoru
  nitko nije unosio.

## ⭐ Prva tema sljedeće sesije: zaštita podataka

Sašin prijedlog je bio **Excel export All Time po Areama kao backup**. Nije
dovoljno, iz dva razloga:

1. **Ne pokriva sve** — izvan njega su `balance_anchors` (sidra namjerno nikad ne
   putuju), `activity_presets`, `data_shares`, `event_attachments` i `dashboard`
   config; `export_profiles` ne preživi rename.
2. **Uvoz nije restore** — non-destruktivan je i radi po P3, pa ne može obrisati
   redak koji ne bi smio postojati; „Import as mine" forsira **nove ID-eve**
   (S123), dakle vraćanje bi proizvelo duplikate s drugim autorstvom.

Predloženo (nije napravljeno): **dump svih tablica u JSON preko REST-a** sa
service ključem, nad `_db.py` koji već postoji. Čisto čitanje, ~20 redaka, ID-evi
i autorstvo očuvani. Za 12.199 eventa i ~69k atributa to je nekoliko desetaka MB.

⚠ Prije toga treba znati **ima li PROD projekt uopće automatske backupe** — free
tier ih povijesno nema, a instanca se od S105 zna gušiti pod opterećenjem. Ako ih
nema, jedina kopija PROD podataka danas je nijedna, i to je veći problem od svega
što smo danas popravljali.

## Nepromijenjeno od S132

Financije pipeline, sidra, delta sheet, tranše — ništa od toga danas nije dirano.
Za to stanje vrijedi CLAUDE.md i `DONE_HISTORY` S129–S132.
