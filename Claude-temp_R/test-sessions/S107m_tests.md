# S107m — AI klasifikacija: eval, čišćenje labela, alat (2026-07-26)

**Nema app koda.** Sve je Python data-prep + izmjene u Review workbooku.
Puni kontekst i zamke: `NEXT_SESSION_PROMPT.md`.

---

## Programski verificirano (Claude, u sesiji)

| ID | Što | Rezultat |
| --- | --- | --- |
| T-S107m-A | Eval v1 naslijepo na 2525 klasificiranih redaka | ručne 62,5 % / Tip 79,7 %; $1,91 |
| T-S107m-B | Razlaganje 819 neslaganja po uzroku | 138 par ne postoji u Taksonomiji · 33 velika slova · 40 osoba · 45 koji auto · **563 prave greške**; strop uz tadašnje podatke ~78 % |
| T-S107m-C | `apply_label_fixes.py --dry` = pravi run | 223 retka, brojke se poklopile 1:1 |
| T-S107m-D | Kontrola poslije upisa | nevaljanih parova **171 → 0**; žig `2026-07-26` na točno 223 retka; BIBERON 55/55 `Projekti`; `Investicije\|Dionice` 4 retka |
| T-S107m-E | `sync_taxonomy.py` nakon novog para | dropdowni vide `Investicije: Dionice` |
| T-S107m-F | Eval v2 (+ Sašin kontekst), uzorak 600 | ručne **80,3 %** / Tip 88,3 %; `visoka` 92,7 % na 57 %; $0,57 |
| T-S107m-G | Eval v3 (+ tvrda pravila), **isti** uzorak | ručne **80,8 %** / Tip **91,9 %**; `visoka` **95,0 %** na 47 %; $0,77 |
| T-S107m-H | Store round-trip | `ai_predictions.jsonl` ključan po `source_key`; `--resume` preskače, `--only-conf` filtrira |
| T-S107m-I | Zaštita od nepotpunog odgovora | pri `effort: low` model vratio 1/40 uz `end_turn`; guard doziva i glasno prijavljuje ostatak |
| T-S107m-J | Normalizacija enuma | `Hrana I ostalo` → `Hrana i ostalo` (enum nije obvezujuć) |

---

## Ručni testovi za Sašu

| ID            | Test                          | Kako                                                                                                                                                    | Status |
| ------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **T-S107m-1** | Pregled 223 ispravljena retka | Review → filtriraj `Pravilo run` = `2026-07-26`. Provjeri uzorak po skupinama u koloni `Alternativa / nap.` (`fix-2026-07-26: <pravilo>`)               | ⬜      |
| **T-S107m-2** | Konzum/Radnička granica       | Filtriraj `Alternativa / nap.` sadrži `12 Konzum` — mora biti **30 redaka**, svi 3–7 €, svi `[kartica: SAŠA]`. Retci s `RATA` moraju OSTATI `Namirnice` | ⬜      |
| **T-S107m-3** | BIBERON dosljednost           | Filtriraj Napomena `Biberon` — svih **55** mora biti `Projekti \| Sasa_Informatika`                                                                     | ⬜      |
| **T-S107m-4** | HAK raspored                  | Redovi 710, 2132, 3656 → `auto C5 \| registracija`; 3657 (SS) → `auto Lacetti \| registracija`. Napomena na 710/2132 nosi "66 EUR = oba auta po 33"     | ⬜      |
| **T-S107m-5** | Novi par u dropdownu          | Klikni Tip u bilo kojem retku → mora postojati `Investicije`, a Podtip tada nudi `Dionice`                                                              | ⬜      |
| **T-S107m-6** | Freeze i grupe prežive        | Namjesti freeze iza `Isplata` + collapse grupa, pokreni bilo koju skriptu, otvori ponovo — postavke moraju ostati                                       | ⬜      |

**Ako T-S107m-2 ili T-S107m-3 ne valjaju:** backup je
`Financije_review_20260710_1448.pre-labelfix-20260726_145103.xlsx` — vrati ga i javi što je krivo.

---

## Odluke donesene u sesiji (Saša)

- Model za klasifikaciju: **Sonnet 5** (cijeli posao < 1 € po runu, sigurniji od Haikua)
- Visa → `Transfer | izmedju racuna` · BIBERON sve u Projekti · Konzum+Radnička **< 30 €**
- Putovanja bez Podtipa → `Restoran` (hrana na putu, bez daljnjeg dijeljenja)
- Pričuva → `Transfer` (Koka je novac dobila natrag) · Dionice → **novi Tip** `Investicije`
- Audible prag ostaje **10 €** · SS = Saša Sladoljev, DPS = Dubravka Pavić-Sladoljev
- Staging **prvo u TEST** Supabase, u PROD tek kad UI bude gotov
- Kolone za AI: **`Tip_AI` / `Podtip_AI`** (`_AI` sufiks, konzistentno s `Tip_O`)
  \+ `Pouzdanost_AI` i `AI run` u collapsed grupi. Model nikad ne piše u `Tip`/`Podtip`.
