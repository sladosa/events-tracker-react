# S193 — testovi (2026-11-05)

Sesija održavanja Financija nakon studenog kruga. Kod je izmjeren na TEST-u automatskim testovima
(E2E `S193_due_settle_defaults`, `S193_import_speed`, `S168` grantee, `S119` sep — sve sabotaže padaju).
Ovdje su samo provjere na **PROD-u**, i to one koje se dogode same u prirodnom tijeku — bez posebnog sjedenja.
Sve tri traže **deploy** (`test-branch` → `main`).

---

## T-S193-1 ⬜ (PROD, Koka, 11.11.) Skupni redak iz trake nosi Namjenu (T48)

**Preduvjet:** deploy prije 11.11.; banka je skinula MC naplatu (Σ košare **2.783,26**, T-S175-1).

1. Overview → traka „Čeka potvrdu" → Mastercard → dodir dana kad je banka skinula → „Da, upiši".
2. Activities → novi redak `TROŠKOVI UČINJENI MASTERCARD KARTICOM` (11.11.) → Edit.
3. **Očekivano:** `Namjena` = **Zajedničko** (pravilo `*`), `Tip`/`Podtip` kao prije (iz configa trake).

**Pad:** `Namjena` prazna — kao Visa 1.751,12 (05.11.). Tada je PROD vrtio stari bundle (Ctrl+Shift+R, S118)
ili `Namjena` na PROD-u nema `default_map` (`Structure → Export`, stupac DependsOn/WhenValue `*`).

## T-S193-2 ⬜ (PROD, Saša kao grantee, 11.11.) Grantee u traci vidi usporedbu (T39)

**Preduvjet:** deploy; MC košara 11.11. još nije potvrđena (prije Kokinog koraka iz T-S193-1).

1. Saša, svoj račun: Overview `Financije_all` → traka → u polje „banka skinula" upiši `2783,26`.
2. **Očekivano:** odmah „✓ slaže se" i rečenica „Potvrđuje vlasnica Aree — ti vidiš usporedbu, ali ne upisuješ";
   **nema** polja za dan ni gumba. Upiši `2783` ⇒ „razlika 0,26".

**Pad:** traka šuti nakon upisa iznosa (stanje prije S193, T-S175-2 k2).

## T-S193-3 ⬜ (PROD, Koka, prvi Excel uvoz poslije deploya) Brz uvoz + trajanje + razdoblje (T43, T50)

**Preduvjet:** deploy; filtar **This Year**.

1. Koka uvozi svoj uobičajeni file (ispravci s izvoda, 30–60 redaka) → Apply.
2. **Očekivano:** završni ekran pod „Import successful!" piše **„Trajanje: …"** — za 40-ak ispravaka do ~1 min
   (prije 2–3 min). Ako ima grešaka, crveni okvir ih nabraja (do S193 se greška upisa atributa gubila).
3. Close ⇒ filtar i dalje **This Year**, `From`/`To` = 01.01.–31.12. (ne prazni).

**Pad:** trajanje nije prikazano (stari bundle); filtar prazan a oznaka This Year (T50 nije stigao);
„redak ispravljen, ali NIJE upisano: …" u okviru — tada zapisati poruku i javiti (to je prije bila tiha greška).
