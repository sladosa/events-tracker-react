# Sljedeća sesija — handoff

**Pisano protiv commita:** `1b9a7fc` + nespremljene izmjene zatvaranja S137
(idu istim commitom). **`main` = `e3f8968`** (deployano 14.09.), a `test-branch` je
**10 commitova ispred** — deploy nije pušten jer se radilo lokalno preko `dev:prod`.
Ako `git log` pokazuje novije, čitaj ovo kao povijest; CLAUDE.md je autoritet.

---

# DIO 1 — netehnički (za Sašu)

## Što je gotovo

**MC košara 11.09. je zatvorena na PROD-u.** Svih 48 redaka je potvrđeno izvodom,
`Status` prebačen u `Izvrsen`, a 15 neklasificiranih redaka dobilo `Tip`/`Podtip`.
Kontrola: promet po izvodu se **nije pomaknuo** (`27 u cent / 5 razilaženja`) — MC ne
dira tekući račun, pa je to dokaz da apply nije ništa polomio.

**CLAUDE.md je dobio sadržaj na vrhu** i više se ne mora skrolati da se nađe sekcija.
Plan i povijest migracije Financija su izmaknuti u `docs/FINANCIJE_STATUS.md`; pravila
su ostala gdje jesu. Ništa se nije izgubilo — provjereno brojanjem (330 upozorenja
prije, 0 izgubljenih).

**Popis otvorenih testova je pao s 21 na 11**, a arhivirano je pet sesija.

## Što traži tebe

1. **Pogledaj saldo u aplikaciji banke.** Pločica tvrdi `13.962,38 €`, a trebala bi
   pokazivati ~`12.893,68 €` — fali skupna MC naplata od 11.09. (`1.068,70`), koja
   dolazi tek s rujanskim ZABA izvatkom. **Ne upisuj je ručno.**
2. **`PAYPAL *BANDIFY BANDIF`, 19,95 €, 07.08.** — pitanje za Koku, što je to bilo.
   Jedini redak košare koji je ostao `N/A`, namjerno.
3. **Provjeri `skriveno ✕`** (`T-S137-6`): u Add Activity klikni ime skrivenog polja pa
   klikni oznaku `skriveno ✕` — treba nestati **samo to polje**.
4. **Odluči želiš li deploy.** Na `test-branch` stoji 10 commitova; ništa od toga nije
   hitno jer `dev:prod` radi s PROD podacima.

## Što NE treba raditi

- **Ne brisati `LUFTHAN…447` i `…448`** — izgledaju kao duplikat (isti dan, isti iznos),
  a to su **dvije karte**. Izvod ih nosi pod različitim brojevima transakcije.
- **Ne postavljati sidro** dok rujanski ZABA izvadak ne stigne. Sidro tvrdo zaključava
  početak prozora, pa bi retke tog mjeseca izbacilo iz svakog budućeg delta sheeta.

---

# DIO 2 — tehnički (za Claudea)

## Novi alati

| alat | čemu |
| --- | --- |
| `data-prep_tools/Tools/claude_index.py` | generira `<!-- INDEX -->` blok u CLAUDE.md-u. **Dva prolaza** — jedan daje brojeve pomaknute za duljinu indeksa |
| `data-prep_tools/Financije/fix_tip_podtip_S137.py` | jednokratni; dry run zadano, backup u `_arhiva/`, cilja po `event_id`, staje na write koji pogodi 0 redaka |
| `docs/FINANCIJE_STATUS.md` | plan/stanje migracije izmaknuto iz CLAUDE.md-a. **Kvarljivo** — provjeri datum |

`audit_tests.py` je prepravljen: vidi **pet** oblika ID-a i **pet** oznaka statusa,
`unclear` blokira arhiviranje **i imenuje se**.

## Otvoreno, po prioritetu

1. **`T-S137-6`** — `skriveno ✕`, u kodu i buildano, **neprovjereno uživo**.
2. **`T-S136-7`** — poruka o grešci u Export modalu crta se ~200 redaka JSX-a niže od
   gumba ⇒ izvan vidljivog dijela skrolanog modala. **Nije popravljeno.**
3. **Pet ZABA mjeseci** (`2024-03 +10,00`, `2024-07 −17,28`, `2024-10 −236,04`,
   `2025-07 +0,80`, `2025-08 −46,74`). ⚠ `uskladi_izvod.py` prima **samo MC**
   (`Zasad samo MC izvodi`), pa idu izravnom usporedbom kao u S129.
   `T-S129-A9` pokriva ona dva iz 2025.
4. **`T-S130-9`** — model `Provjeri`. U S137 se **nije morao riješiti** jer je košara
   zatvorena pa formula šuti; vraća se čim iduća košara bude otvorena.
5. **Pet pipeline testova** drži po jedan file: `T-S107c-2`, `T-S107d-4`, `T-S107i-6`,
   `T-S107j-1`, `T-S108-9`. ⚠ **Nisu testovi nego zadaci** — S136 ih je tako i svrstao.
   Čeka Sašinu odluku jesu li još živi; prijedlog je da idu u `**Otvoreno:**` redak.
   ⚠ `T-S108-9` je poseban: izmjereno da **svih 8 pozivatelja `fetchAllPaged*` ima
   `.order('id')`**, ali `supabasePaging.ts:40` kaže *„This helper cannot add the order
   itself"* ⇒ invarijanta je **komentar, ne brava**. Zatvoriti grep-guardom, ne kvačicom.

## Zamke koje su danas ugrizle (sve su u CLAUDE.md)

- **`ET_TARGET` bez `prod` gađa TEST**, a ispis izgleda uvjerljivo: isti `promet_check`
  daje `12/20` na TEST-u i `27/5` na PROD-u. Zaglavlje se čita **prije** brojke.
- **`git mv` u `Claude-temp_R/` ne izbacuje iz gita** — `.gitignore` ne vrijedi za već
  praćeno. Treba `git rm --cached`.
- **Heredoc kroz `python - <<'EOF'` jede jedan sloj backslasha i dijakritiku.**
  `\\b` je završio kao **pravi backspace znak** u regexu. Piši patch u file (`cat > f`),
  pa ga pokreni — ili uređuj po brojevima redaka bez ne-ASCII literala.
- **Redak se AŽURIRA ondje gdje živi, ne duplicira u novoj sekciji.** Audit uzima
  **zadnje** pojavljivanje, pa novi ✅ u sekciji iznad ne nadjača stari ⬜ ispod.

## Stanje brojki (PROD, izmjereno 15.09.2026.)

```
promet_check      ✓ 27 / ✗ 5        cijela 2026. u cent
MC kosara 11.09.  48 / 1.068,70     == izvod, u cent
eventi            5.198             2 bez `Status`a -> Sasa ispravio
sidra             ZABA 12.772,86 @ 06.09.  ·  RF 690,79 @ 07.09.
```
