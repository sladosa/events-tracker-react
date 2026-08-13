# NEXT SESSION PROMPT — nakon S107y (Pitanja za Koku + batch 2025)

**Zadnja sesija: S107y (2026-08-13).** `test-branch` = `main` = `7239c8d` na kodu (nema promjena
u `src/` od PROD deploya 2026-08-12); Python data-prep + jedan uvoz u TEST bazu su se dogodili.

---

# DIO 1 — Jednostavnim rječnikom (za Sašu)

## Što je gotovo

**Sve iz `Pitanja za Koku` odgovoreno** (14/14) i primijenjeno na Review:
- 3 datuma ispravljena (parking 07.08→07.07.2026; Mirovina+Triglav 07.01→07.02.2025 — pravi
  bankovni datum nađen u izvodima)
- 3 duplikata obrisana (MC 21,88 red 4997, Anjina rata red 3609, druga Mirovina red 2004)
- Ostatak (700€ bankomat, 6 mjesečnih "Saldo kontrola" razlika) ostaje kako jest — Koka se ne
  sjeća, a saldo je danas ionako točan, pa se ne lovi unatrag

**Batch 2025 uvezen u TEST** — 1473 zapisa, provjereno (spot-check prošao). Baza sad ima 2220
zapisa (747 iz 2026 + 1473 iz 2025).

**Odluka:** batch 2024/2023 se NE priprema unaprijed — svaki period prvo prolazi kroz istu
vrstu provjere s Kokom (kao danas), tek onda se generira i uvozi. Iskustvo s 2025 (gdje smo
ispravke morali napraviti PRIJE generiranja, ne poslije, jer se uvezeni redak ne da lako
popraviti) kaže da je to jeftinije nego popravljati poslije.

## Što slijedi

**Dogovor o Fazi 1** — pločica "stanje po računu" na Overview tabu. Ti si ovo htio ostaviti za
sljedeći session. Kratka podsjetnik prije razgovora:
- Model je **dokazan** (S107x Faza 1a, 12.08.): pravilo "saldo miče Izvor, ne Račun" pogađa
  banku u 17/30 mjeseci u cent; naivan zbroj po Računu ne pogađa nijedan.
- Za kod treba: SQL funkcija (RPC) koja to računa u bazi (ne u browseru — inače je presporo
  i krivo zbog Supabase limita na broj vraćenih redaka), plus jedna pločica na Overview tabu.
- Prije nego kreneš, vrijedi razjasniti: koliko brzo želiš to vidjeti (mala pločica odmah vs.
  čekati da imamo više uvezenih godina), i je li 2025 dovoljno podataka za prvu probu ili
  čekamo bar 2024 da bude smislenije.

## Ostalo za Koku (nepromijenjeno)

- **Red 2115** (LJEKARNA OREBIC) — ručna izmjena Medical_Sasa → Medical_Koka, nisi još stigao
- N/A klasifikacija za 2024/2023 — radit ćemo je usput s vettingom prije svakog batcha

---

# DIO 2 — Tehnički dio (za Claudea)

## Stanje

| grana | commit | sadrži |
| --- | --- | --- |
| `test-branch` | v. `git log` | isto kao main + S107y Python/data promjene (nema `src/` diffa) |
| `main` (PROD) | `7239c8d` | S107v+S107w+S107x Faza 1a (2026-08-12 deploy) |

Nema pending `src/` promjena — S107y je bio čisto data-prep + import kroz postojeći UI.
`Review` = `Financije_review_20260710_1448.xlsx`, sad **4992 podatkovna retka** (bilo 4995).

## Novi alat

`data-prep_tools/Financije/fix_pitanja_koka.py` — jednokratni popravak, već izvršen. Čita
Odluka/Njena napomena iz `Financije_review-prolaz-s-Kokom.xlsx` (radna kopija s Kokinim
odgovorima), primjenjuje 3 datuma + 3 brisanja na pravi Review, prepisuje odgovore u
`Pitanja za Koku` sheet pravog Reviewa. Ne treba se ponovo pokretati.

## Batch generiranje — obrazac za 2024/2023

```
python make_financije_import.py --from 2024-01-01 --to 2024-12-31 --dry   # prvo pogledaj report
python make_financije_import.py --from 2024-01-01 --to 2024-12-31         # pravi file
```

⚠ **Prije generiranja:** provjeri ima li za taj period otvorenih pitanja slične vrste kao
`Pitanja za Koku` (neobjašnjeni saldo, sumnjivi duplikati, krivi datumi) — `verify_saldo_model.py`
je alat za to (v. `SALDO_MODEL_NALAZI.md` za obrazac izvještaja). Cilj: ne uvoziti podatke koje
ćeš poslije morati ručno ispravljati kroz app (uvezeni redak se ne da vratiti novim batchom —
`session_start` bi se sudario s već uvezenim danom).

## Faza 1 — što je spremno

- Model dokaz: `data-prep_tools/Financije/SALDO_MODEL_NALAZI.md` §1-2
- Spec: `docs/OVERVIEW_TAB_SPEC.md` §2.4, §2.10, §2.14
- SQL file ide na `sql/035_area_group_agg.sql` (⚠ ne 034, zauzeo ga `034_s107w_test_area.sql`)
- Tri pravila koja se ne smiju prekršiti: `SECURITY DEFINER` mora sam provjeriti pristup;
  P2 parent eventi se nikad ne zbrajaju; čita se `value_number`, ne parse teksta.

## Otvoreno (nepromijenjeno od S107x)

- **T-S107v-7 (PROD):** kad se View opet ne otvori nakon Finish — poslati poruku s ekrana.
- `sql/033_delete_area_cascade.sql` SECTION 2b — jesu li policyji iz `020_orphan_rls.sql` na TEST-u
- `export_profiles` — jedina preostala rupa u `AreaSettings` roundtripu
- `T-S107u-2` — `groupAttributes` uzima `Default` s prvog retka grupe (bezopasno, konvergira)
- **Bulk delete (checkbox) nije ograničen za grantee-a** — stari backlog
- **§2.13 (tri kante planiranog)** — neprovjerljivo do prvog importa s generiranim ratama
