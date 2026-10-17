# S172 — testovi (2026-10-17)

## T-S172-1 ✅ (17.10., Saša, lokalno TEST) Povratak na Overview vraća razdoblje od prije ↗ (PROD, nakon deploya)

**Što je novo:** „Isti dan u Activities ↗" u Košarama postavlja filtar na jedan dan. Do sada je
Overview nakon povratka ostajao na tom danu — saldo je pokazivao stanje NA TAJ DAN, ne danas.

1. `Ctrl+Shift+R`. `Financije_all`, Overview, razdoblje **This Year**. Zapiši ZABA saldo.
2. Otvori **Košare**, rasklopi košaru, na kupnji klikni **↗**.
   **Očekivano:** Activities, filtar `Custom` na dan te kupnje.
3. Klikni tab **Overview**.
   **Očekivano:** filtar opet **This Year · 01.01.–31.12.2026.**; ZABA saldo isti kao u koraku 1.
4. Ponovi korak 2, ali u Activities ručno odaberi **This Month**, pa tab Overview.
   **Očekivano:** ostaje **This Month** (tvoj izbor se ne gazi).
- **Pad:** u koraku 3 filtar ostane `Custom` na tom danu, ili saldo različit od koraka 1.
- F5 između ↗ i povratka **briše** pamćenje (namjerno, kao harmonika) — nije pad.

## T-S172-2 ✅ (S172: TEST očišćen, global-setup brana, puni run 84/3) E2E: četiri stalna pada zbog podataka na TEST-u

Puni run 17.10.: 80 prolaz / 7 pad. Pojedinačno prolaze E4-1, S104-3, S165 (uski), S171 (s novim
specom). Stalno padaju **E11-4, E12-2, E13-2** (E12-5 povremeno).

Izmjereno u TEST bazi (čitanje, service ključ): E2E vlasnik (`eef0d779…`) ima
- **share `write`** na Sašin `Health_Sasa` (`040adf55…`, slug **`health`**, od 18.05.2026.), i
- vlastiti zaostali `Health_Sasa` (`c8b9794d…`, slug `health-sasa`, 10.07.2026.).

⇒ E11-4: dvije opcije „Health…" u izborniku Area (strict mode); E12-2: predložak `health` se ne
nudi jer korisnik već vidi Areu sa slugom `health`. E13-2 (poruka „children move up…" se ne
pojavi) nije razjašnjen — u trenutku pada otvoren je Help panel.

**Odluka (Saša, 17.10.): sve što olakšava E2E — ništa na TEST-u nije posebno važno.** Izvedeno:
backup TEST-a; obrisano 8 Area E2E računa koje seed nije stvorio + 2 tuđa sharea; `global-setup`
to sada radi prije svakog runa i ispisuje (pokus prošao). E13-2: app piše „… will become direct
children of Gym", spec je tražio „move up" ⇒ popravljen spec. S133-1 je posuđivao `Garmin_data`
iz tuđe Aree preko sharea ⇒ sada sije vlastitu Areu s 1.100 eventa (protuprovjera pada).
Puni run nakon toga: **84 / 3** (S104-3, S107-3 povremeni — T-S172-4; S133-1 popravljen poslije).

## T-S172-4 ⬜ E2E povremeni padovi u punom runu

S104-3: Area `Fitness` odabrana, a izbornik kategorija stoji na „Loading…" dulje od 10 s (`waitFor`
na `option`). Pojedinačno 2/2 prolaz. S107-3 pojedinačno prolazi. Prije produljenja čekanja
izmjeriti zašto se kategorije ponekad učitavaju > 10 s (Network u traceu).

## T-S172-3 ⬜ Zaglavlje košare na malom iPhoneu (PROD, nakon deploya)

**Što je novo:** na Kokinom iPhoneu „· 35 kupnji" se podvlačio pod iznos košare (razmak ispred
njega bio je u dijelu koji se ne lomi, a iOS font je širi od Androidova). Sada dva retka s obje strane.

1. Koka: zatvori karticu i otvori app iznova (stari bundle). Overview → **Košare**.
2. **Očekivano:** svaka košara
   ```
   ▸ Mastercard · 11.11.          −2.264,35 €
     35 kupnji                ostaje +8.911,48 €
   ```
   — broj kupnji nikad ispod iznosa; „dospjelo, čeka potvrdu" u drugom retku uz broj kupnji.
- **Pad:** bilo koji tekst preko iznosa.

