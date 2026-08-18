# S107p — harvest `visoka` trake (2026-07-28)

**Nema app koda.** Python data-prep + upis u Review workbook.
Puni kontekst: `data-prep_tools/Financije/ENRICH_PLAN.md` §2n.

Kratka sesija: Saša prošao `visoka` traku (i dio `srednja`/`niska`) u Excelu, upisao
`OK`/ispravke u `AI odluka`. Claude pokrenuo harvest.

---

## Programski verificirano (Claude, u sesiji)

| ID | Što | Rezultat |
| --- | --- | --- |
| T-S107p-A | `apply_ai.py --harvest --dry` prije pisanja | 347 redaka bi se prenijelo, 3 preskočena (861/887/3166 — već imali ručni `Tip`) |
| T-S107p-B | `apply_ai.py --harvest` pravi run nakon Sašine potvrde | 347 preneseno, backup `*.pre-aiapply-20260728_171029` napravljen, isti brojevi kao dry |
| T-S107p-C | `--report` nakon harvesta | `AI odluka`: `(prazno)` 1586 · `?` 3 · `OK` 3 (3 preskočena ostaju OK — očekivano) |
| T-S107p-D | Remaining N/A po traci (ad-hoc skripta) | visoka 2, srednja 205, niska 1023 — potvrđuje da je `visoka` gotovo završena |

## Ručni testovi za Sašu

| ID | Test | Kako | Status |
| --- | --- | --- | --- |
| **T-S107p-1** | Vizualni pregled 347 novoklasificiranih redaka | Filter `Labela iz` počinje s `AI:` i datum 2026-07-28 — Tip/Podtip izgledaju ispravno | ⬜ |
| **T-S107p-2** | 3 preskočena retka (861, 887, 3166) | Provjeri da im je `Tip` isti kao prije (ručna labela netaknuta), `AI odluka` i dalje `OK` (namjerno, ne popravljati) | ⬜ |

**Backup:** `Financije_review_20260710_1448.pre-aiapply-20260728_171029.xlsx`

## Sljedeće

`srednja` traka (205 preostalo) → `niska` (1023 preostalo). V. `NEXT_SESSION_PROMPT.md`.
