# S107g Session Prompt — Sašini testovi + Preimenovanja run (pratnja)

**Datum:** 2026-07-15, kraj S107f
**Branch:** test-branch (= main = PROD, commit cdbdff9; deploy izvršen, E2E 12/12)
**Preporučeni model za ovu sesiju: Sonnet** (pratnja/objašnjenja/mali fixevi —
NE velike implementacije; za njih vidi "NIJE za ovu sesiju" dolje)

---

## Prompt za copy-paste

```
Nastavljam Financije migraciju (S107g) — ovo je sesija PRATNJE: radim testove i
Preimenovanja run, trebam objašnjenja i pomoć pri čitanju outputa, eventualno
sitne fixeve. Kontekst pročitaj ovim redom:
1. Claude-temp_R/test-sessions/S107f_tests.md — moji zadaci (T-S107f-1/2/3)
2. data-prep_tools/Financije/ENRICH_PLAN.md — §2d (stanje S107f) + §3 SLJEDEĆI KORACI

STANJE (kraj S107f, 2026-07-15, commit cdbdff9 — main == test-branch, PROD deployan):
- Datum naplate backfill IZVRŠEN (1631 Racun/Cash = event_date; Visa 220 prazno namjerno)
- Preimenovanja sheet kreiran u Financije_review_20260710_1448.xlsx, pred-popunjen
  (test na kopiji: 135 preimenovano + 61 reset = 196); JA popunjavam 4 prazna para
  i brišem seed pravila, pa apply_rules --dry → run
- UI fix (shortcut/skriveni atributi) na PROD-u — testiram T-S107f-3 na mobitelu

ŠTO OČEKUJEM OD TEBE:
- vodi me kroz korake iz S107f_tests.md kad zapnem; objasni outpute skripti
- ako javim "pao T-S107f-X" → analiziraj i predloži; sitne fixeve smiješ kodirati
  (typecheck+build prije commita), commit SAMO na test-branch
- zapiši rezultate testova u PENDING_TESTS.md (⬜→✅/❌)

PRAVILA: run.bat + PYTHONUTF8=1; Review file ZATVOREN u Excelu prije skripti;
backup nastaje automatski; cmd guši zarez u argumentima (jedan substring po pozivu);
NIKAD ne pushati/mergati na main; NE dirati vrijednosti u Review sheetu iz koda
osim kroz postojeće skripte.

NIJE ZA OVU SESIJU (čeka jaču sesiju, plan u ENRICH_PLAN §2d/§3):
PBZVISA split po Kartica koloni, Izvod kandidat kolona, reconcile report,
Visa generator novih redaka, import generator.
```

---

## Kontekst za model (ne mora u prompt)

- **Preimenovanja mehanika:** apply_rules.py na pravom runu radi (redom): Tip_O/Podtip_O
  snapshot (jednom) → preimenovanja (Pouzdanost se ČUVA, `PREIM:` u Alternativa) →
  reset nevaljanih parova bez mappinga (N/A + `TAKS:`) → keyword pravila (samo na
  Tip prazan/N/A). Prazan Pravila sheet je OK (renames su dovoljni za run).
- **Očekivane brojke --dry runa:** preimenovano ≥135 (više ako Saša popuni 4 para:
  Sportski rekviziti 29, PassSport 12, AudibleSasa 11, Saša projekti 9), reset =
  ostatak do 196. Ukupno preimenovano+reset = 196.
- **Ako Saša pita za PBZ Visa:** odluke su pale (dodati 1538 tx; lump→Transfer;
  per-osoba Podtip; Kokina Visa se skida sa SAŠINOG RF računa) — implementacija NIJE
  u ovoj sesiji.
- **Deploy procedura** (samo na izričit zahtjev): CLAUDE.md → Session workflow → End of session.
