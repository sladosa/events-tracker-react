# S107 — Testovi (2026-07-09)

**Sesija:** row_hash skip + update-guard (D7) + `normalize_financije.py` (review Excel)

---

## T-S107-1 — Re-import nediranog exporta = no-op ✅ (E2E, Playwright)

Automatski: `e2e/tests/S107_row_hash_guard.spec.ts`.
Export Cardio → isti file odmah nazad u Import → svi redovi "Unchanged (skipped)",
created=0, updated=0, bez update-guarda.

## T-S107-2 — Update-guard blokira Apply do potvrde ✅ (E2E, Playwright)

Automatski, isti spec. Export → promjena comment ćelije u Excelu → Import:
guard lista "1 existing event will be modified" s promjenom staro→novo,
Apply disabled → checkbox → Apply → updated=1.

## T-S107-3 — Guard za promjenu ATRIBUTA (manualno) ⬜

1. Activities → filter na leaf s brojčanim atributom (npr. Fitness > ... > Cardio)
2. 📥 Export → otvori xlsx → promijeni vrijednost atributa (npr. duration 30 → 45) u jednom redu → snimi
3. 📤 Import → isti file
4. **Očekivano:** update-guard kartica pokazuje `duration: 30 → 45` (crveno staro, zeleno novo);
   Apply disabled dok se ne označi checkbox
5. **Fail:** guard se ne pojavi / promjena polja nije navedena / Apply odmah aktivan

## T-S107-4 — Warning za stare zapise (manualno) ⬜

1. Export nekog područja s poviješću (event stariji od 30 dana)
2. U Excelu promijeni komentar na starom redu → Import
3. **Očekivano:** u guard sekciji crveni banner "⚠️ N of them are older records (event date more
   than 30 days ago)... check carefully!"
4. **Fail:** banner se ne pojavi

## T-S107-5 — Backward kompatibilnost starih exporta (manualno) ⬜

1. Uzmi xlsx exportan PRIJE S107 (bez `row_hash` kolone) — ili obriši row_hash kolonu iz novog
2. Import bez izmjena
3. **Očekivano:** import radi normalno; redovi NISU auto-skippani (nema hasha), identični završe
   kao "Unchanged" kroz DB diff; nema errora
4. **Fail:** parse error / svi redovi tretirani kao promjene

## T-S107-6 — Review Excel dropdowni (manualno) ⬜

1. Otvori `data-prep_data/Financije/Financije_review_*.xlsx` u Excelu
2. Sheet **Review**: kolona Tip (J) ima dropdown sa 14 opcija (uklj. **Namirnice**)
3. Odaberi red, promijeni Tip u `Informatika` → dropdown u Podtip (K) nudi SAMO Informatika podtipove
4. Postavi Tip=`Namirnice`, a Podtip ostavi npr. `parking` → ćelija Podtip **pocrveni** (CF mismatch)
5. Tip prazan ili `N/A` → ćelija **žuta**
6. **Fail:** "We found a problem with some content" pri otvaranju / dropdown ne reagira na Tip /
   CF ne boji krive kombinacije

---

## Napomene za sljedeću sesiju

- **Review Excel podaci:** 3503 reda (Koka 2636 + Saša 867). Pouzdanost: VISOKA 950,
  SREDNJA 259, NISKA 190, **NEMA 2104** (uglavnom Kokini Mastercard redovi 2023–2025-06 bez opisa
  — 82% MC redova nema labelu; Za Sašu pokriva samo 2025-07+). Odluka za Sašu/Koku:
  ostaviti N/A ili ručno klasificirati velike iznose.
- Label-matching Za Sašu → izvodi (datum ±2 dana + iznos): 169 labela preneseno.
- Sheet **Problemi**: 259 zapisa (krivi datumi 2011/2005/2036, prazni smjerovi, nepodudarene labele).
