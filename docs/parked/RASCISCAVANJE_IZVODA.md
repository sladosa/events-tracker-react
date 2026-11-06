# Ploha „Raščišćavanje izvoda" — prijedlog (parkirano)

**Parkirano:** S194 (2026-11-06), iz `FINANCIJE_PROCES.md` §6 (S151–S158). **Ništa nije izgrađeno.**
**Okidač za ponovno otvaranje:** `krug` (T4, S195+) radi, a odluka po izvodu i dalje ima toliko da je Excel
na mobitelu glavno trenje (T1). U studenom 2026. bilo ih je 3–4 po izvodu, S194 je većinu pretvorio u automatske.
Puni kontekst: [`_archive/FINANCIJE_PROCES_do_S194.md`](../_archive/FINANCIJE_PROCES_do_S194.md).


Zatvara T1. Otvara se s Overview pločice, iz retka računa, kad za račun postoji obrađen a
nepregledan izvod:

```
┌ Stanje po računu ─────────────────────────────────┐
│ Kokin tekući ZABA        13.815,33 €   ✓           │
│   📄 Izvod 2026-09 · 44 stavke · 5 za pregled  [›] │
│ Sašin tekući RF             690,79 €   ✓           │
└────────────────────────────────────────────────────┘
```

**Vide se samo iznimke**; što se slaže u cent samo se ožigoše i prikaže kao *„39 slaže se"*. Na
mobitelu je razlika između 5 i 44 retka razlika između „odradim na kavi" i „ostavit ću za poslije".

| vrsta | značenje | potez |
| --- | --- | --- |
| ✎ razlika | redak postoji, iznos ili datum se ne slaže | **Prihvati bankin** (mijenja iznos, ne opis) ili ostavi |
| ＋ nema u bazi | banka ima, app nema | **Dopiši** — `Tip`/`Podtip` predložen iz povijesti |
| ？ nema na izvodu | app ima, banka ne | duplikat? kriv račun? — odluka je vlasnice, nikad automatski |
| ⇄ 1:N | jedan naš = više bankinih (ili obrnuto) | prihvati predloženi spoj |

Na kraju: *„Izvod kaže 13.815,33 na 30.09. — app kaže 13.815,33 ✓"* → **Potvrdi stanje** upiše sidro
s datumom i brojem s papira. Ne slaže li se, sidro se ne nudi.

**Odluke prihvaćene (S151):** K1 stavke izvoda u novoj tablici (`statement_lines`) · K2 PDF i dalje
parsira Sašin alat · K3 prvo traka (✅ izvedeno S155–S157) · K4 kartični izvodi kroz istu plohu,
ali kao košara · K5 potvrđuje vlasnica Aree.

Pravila koja ploha mora nositi (već plaćena): ispravak Editom postojećeg retka · sličan opis nije
duplikat · rata se veže brojem rate, ne datumom · izmjena retka prije sidra ne miče saldo i ploha
to mora reći.
