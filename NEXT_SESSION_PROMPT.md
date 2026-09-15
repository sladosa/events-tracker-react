# Sljedeća sesija — handoff

**Pisano protiv commita:** `c859ed8` + izmjene zatvaranja S137 (idu istim commitom).
**`main` = `e3f8968`** (deployano 14.09.), a `test-branch` je **14 commitova ispred** —
deploy nije pušten jer se cijela sesija radila lokalno preko `dev:prod`.
Ako `git log` pokazuje novije, čitaj ovo kao povijest; CLAUDE.md je autoritet.

---

# DIO 1 — netehnički (za Sašu)

## Što je gotovo

**MC košara 11.09. je zatvorena na PROD-u** — 48 redaka potvrđeno izvodom, `Status` prebačen,
15 neklasificiranih dobilo `Tip`/`Podtip`. Kontrola: promet po izvodu se **nije pomaknuo**
(`27 u cent / 5 razilaženja`).

**Prošli smo testove jedan po jedan, i to je dalo više od čitanja** — pet stavki je bilo
otvoreno a posao gotov, tri kvara su se pokazala tek u aplikaciji, jedan je opovrgnut.

**Viza je razriješena mjerenjem.** Ima tri datuma: izvod se zatvara **2.–3.**, račun se tereti
**4.–7.**, dospijeće je **11.** Novo pravilo `cutoff:3:5` pogađa i mjesec i dan — ali
**vrijednost na PROD-u još nije promijenjena** (v. niže, redoslijed je bitan).

**CLAUDE.md ima sadržaj na vrhu** i više se ne mora skrolati.

## Što traži tebe

1. **Pogledaj saldo u aplikaciji banke.** Pločica tvrdi `13.962,38 €`, a trebala bi
   ~`12.893,68 €` — fali skupna MC naplata od 11.09. (`1.068,70`), koja dolazi tek s rujanskim
   ZABA izvatkom. **Ne upisuj je ručno.**
2. **`PAYPAL *BANDIFY BANDIF`, 19,95 €, 07.08.** — pitanje za Koku, što je to bilo. Jedini
   redak košare koji je namjerno ostao `N/A`.
3. **Odluči o deployu.** Na `test-branch` stoji 14 commitova. Ništa nije hitno jer `dev:prod`
   radi s PROD podacima — ali `cutoff:3:5` **ne može** na PROD prije deploya.

## Što NE treba raditi

- **Ne mijenjati `Visa: next:3` u `cutoff:3:5` prije deploya.** Uvoz odbija nepoznat token i
  **preskoči pravilo** uz samo poruku u konzoli — vidjelo bi se tek kad datum prestane biti
  izračunat.
- **Ne postavljati sidro** dok rujanski ZABA izvadak ne stigne.
- **Ne brisati `LUFTHAN…447` i `…448`** — izgledaju kao duplikat, a to su **dvije karte**.

---

# DIO 2 — tehnički (za Claudea)

## Novo u ovoj sesiji

| | |
| --- | --- |
| `cutoff:B:D` | nov oblik u `attributeRules.ts`; rječnik je na **jednom** mjestu pa `structureImport` dobiva proširenje besplatno. `dateRuleCutoff.test.mjs` 20/20, protuprovjereno |
| `claude_index.py` | generira sadržaj CLAUDE.md-a (dva prolaza — jedan daje brojeve pomaknute za duljinu indeksa) |
| `audit_tests.py` | vidi **pet** oblika ID-a i **pet** oznaka statusa; `unclear` blokira arhivu; mjeri i **razliku PENDING ↔ naslov** u detaljnom fileu |
| `fix_tip_podtip_S137.py`, `obrisi_test_shortcute_S137.py` | jednokratni, dry run zadano |
| `docs/FINANCIJE_STATUS.md` | plan/stanje migracije, izmaknuto iz CLAUDE.md-a. **Kvarljivo** |

## Otvoreno, po prioritetu

1. **`T-S137-9` druga polovica** — `Visa: next:3 → cutoff:3:5` na PROD-u, **tek nakon deploya**.
2. **`T-S136-7` / `T-S108-1b` / `T-S137-6`** su zatvoreni, ali popravci su **samo na
   `test-branch`** — Koka ih ne vidi do deploya.
3. **Pet ZABA mjeseci** (`2024-03 +10,00`, `2024-07 −17,28`, `2024-10 −236,04`,
   `2025-07 +0,80`, `2025-08 −46,74`). ⚠ `uskladi_izvod.py` prima **samo MC**, pa idu
   izravnom usporedbom kao u S129.
4. **Krug 2 testova** (`dev:test`, destruktivni): `T-S133-5`, `T-S133-8`, `E15-full`.
   ⚠ `T-S133-8` je u S135 pokušan na PROD-u i **nije vrijedio** — ondje je Saša grantee, pa ga
   zaustavi S134 zabrana, a ne S24 brava.
5. **`T-S131-34`** (`BUG-S131-VIEWSTALE`) — neponovljen; ako se u 10 min ne ponovi, zatvoriti
   kao neponovljiv umjesto da visi.
6. **Pet pipeline stavki** (`T-S107c-2`, `-d-4`, `-i-6`, `-j-1`, `T-S108-9`) — **nisu testovi
   nego zadaci**, čekaju Sašinu odluku jesu li još živi.
   ⚠ `T-S108-9`: izmjereno da svih 8 pozivatelja `fetchAllPaged*` ima `.order('id')`, ali
   `supabasePaging.ts:40` kaže *„This helper cannot add the order itself"* ⇒ invarijanta je
   **komentar, ne brava**. Zatvoriti grep-guardom, ne kvačicom.

## Zamke koje su danas ugrizle

- **`ET_TARGET` bez `prod` gađa TEST**, a ispis izgleda uvjerljivo: isti `promet_check` daje
  `12/20` na TEST-u i `27/5` na PROD-u. **Zaglavlje se čita prije brojke.**
- **`git mv` u `Claude-temp_R/` ne izbacuje iz gita.** Ispravno: `git rm --cached` **pa** `mv`.
- **Heredoc kroz `python - <<'EOF'` jede sloj backslasha i dijakritiku** — `\\b` je završio kao
  **pravi backspace znak** u regexu. Piši patch u file (`cat > f`) pa ga pokreni, ili uređuj po
  brojevima redaka bez ne-ASCII literala.
- **Redak se ažurira ondje gdje živi**, ne duplicira u novoj sekciji — audit uzima **zadnje**
  pojavljivanje.
- **`.mjs` testovi nisu u `tsconfig`u**, pa `npm run typecheck` ne vidi da je test file
  neispravan. `structureExcel.test.mjs` je tako **od S17** bio mrtav uz 37 tvrdnji unutra.

## Stanje brojki (PROD, izmjereno 15.09.2026.)

```
promet_check      ✓ 27 / ✗ 5        cijela 2026. u cent
MC kosara 11.09.  48 / 1.068,70     == izvod, u cent
eventi            5.198             sva 2 bez `Status`a ispravio Sasa
sidra             ZABA 12.772,86 @ 06.09.  ·  RF 690,79 @ 07.09.
otvorenih testova 17                (bilo 23 na pocetku sesije)
```
