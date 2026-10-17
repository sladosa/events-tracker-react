# S172 — testovi (2026-10-17)

## T-S172-1 ⬜ Povratak na Overview vraća razdoblje od prije ↗ (PROD, nakon deploya)

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

## T-S172-2 ⬜ E2E: četiri stalna pada zbog podataka na TEST-u

Puni run 17.10.: 80 prolaz / 7 pad. Pojedinačno prolaze E4-1, S104-3, S165 (uski), S171 (s novim
specom). Stalno padaju **E11-4, E12-2, E13-2** (E12-5 povremeno).

Izmjereno u TEST bazi (čitanje, service ključ): E2E vlasnik (`eef0d779…`) ima
- **share `write`** na Sašin `Health_Sasa` (`040adf55…`, slug **`health`**, od 18.05.2026.), i
- vlastiti zaostali `Health_Sasa` (`c8b9794d…`, slug `health-sasa`, 10.07.2026.).

⇒ E11-4: dvije opcije „Health…" u izborniku Area (strict mode); E12-2: predložak `health` se ne
nudi jer korisnik već vidi Areu sa slugom `health`. E13-2 (poruka „children move up…" se ne
pojavi) nije razjašnjen — u trenutku pada otvoren je Help panel.

**Odluka (Saša):** ukinuti share i obrisati zaostatak na TEST-u (share je služio T-S160b-1, zatvoren),
ili spec učiniti otpornim na tuđe Aree. Popravak ide u spec/podatke, ne u app.
