# S192 — testovi (2026-11-05)

Studeni krug Financija (ispit „Financije su dovoljno gotove"). Rezultati T-S175-1..3 i T-S181-3 su upisani u
njihove retke u `PENDING_TESTS.md`. Nalazi kruga su T39–T49 u `docs/FINANCIJE_PROCES.md` §4.

---

## T-S192-1 ⬜ (PROD, Koka; kad Keks 22 € sjedne na RF) RF sidro s ekrana

**Polazno (05.11. ~11:00):** pločica Sašin tekući RF **253,15** (sidro 11.10. = 878,09, 12 promjena poslije).
Banka **231,15**; razlika 22,00 je Keks (Dru vraća karte) koji je u appu 05.11., a banka ga knjiži tijekom dana.

1. Saša u RF aplikaciji: stanje računa (knjiženo, ne „raspoloživo") = **253,15**. Ako je na RF-u u međuvremenu bilo
   još nešto, prvo to upisati u app.
2. Koka: Overview, filtar **This Year** (ne Custom — saldo je na zadnji dan filtra, T46) → Sašin tekući RF →
   „u banci" `253,15`, izvor *ekran banke* → **Potvrdi**.
3. **Očekivano:** prije spremanja ispis računice (jučer = očitano − današnji promet); poslije pločica i dalje **253,15**,
   „od potvrde <jučer>".

**Pad:** pločica se pomakne nakon potvrde; ili banka ≠ 253,15 (tada ne potvrđivati — tražiti razliku kao u S192:
Delta Export RF, prozor 1, usporedba s bankom).
