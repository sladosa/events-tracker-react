# NEXT SESSION PROMPT — nakon S111 (oba lanca salda zatvorena)

**Pisan protiv commita `56617e2`** (zadnji prije S111) **+ commit S111 koji slijedi odmah iza.**
Ako `git log --oneline -1` pokazuje nešto novije, čitaj ovo kao povijest; `CLAUDE.md` je autoritet.

**Stanje grana:** `test-branch` nosi S108 + S109 + S110 + S111. `main` = PROD, nije diran.

---

# DIO 1 — Jednostavnim rječnikom (za Sašu)

## Što je S111 zatvorio

**Oba računa sada reproduciraju banku do centa.** ZABA je bila gotova u S110; sada je i RF:

> **461,82 €** na 06.07.2026. — isto što piše na `RF_2026-06.pdf`, i isto što daje Kokin lanac.

Uz iznos se poklopio i **broj redaka**: pločica kaže 196 promjena, izvod ima 196 transakcija.

Crveni RF nije bio kvar. Nedostajalo mu je sidro — a kad smo ga stavili, ispod se pokazalo
nešto vrjednije od same brojke.

## Ono što je zapravo bilo pokvareno

**Izvodi su bili u redu.** Sumnja u RF (jer je išao kroz OCR) pokazala se neopravdanom: 196
transakcija kroz 18 mjeseci daje razliku **0,00**. Ta je stavka zatvorena.

Pokvareno je bilo **spajanje** tvojih dvaju izvora. Koka i banka isti događaj ponekad opišu
**skoro** istim iznosom — njeno `1.265,59` protiv bankovnog `1.285,59`, zamijenjena znamenka.
Dedup je uspoređivao datum i iznos, pa je propuštao oba retka u bazu.

**Neto je izgledalo bezopasno (`−130,25`), a bruto je bilo `2.609,78`** — dvadeset puta veće.
Višak uplata i višak isplata su se skoro poništili. To je isti obrazac kao lekcija iz S110,
samo grublji, i sad je zapisan kao pravilo: *kad tražiš uzrok, zbroji apsolutne vrijednosti,
ne neto.*

## Gotovina — pravilo koje si promijenio

Našli smo da je Koka 18.05. podigla 150 € s tvog računa i 20.05. platila majstoru 66 €.
Banka je izgubila 150; aplikacija je oduzimala 216.

Odlučio si da **gotovina ne miče bankovni saldo** (podizanje ga već pomakne), umjesto da se
gradi „novčanik" kao poseban račun. Trošak od 66 € **ostaje potpuno vidljiv** u razrezu po
Tipu — samo ne dira bankovnu brojku.

Cijena koju svjesno plaćaš: **aplikacija ne zna koliko gotovine imaš u novčaniku.** Zapisano
je i u dokumentima i u Help tekstu, da to poslije ne izgleda kao propust.

## Dvije stvari koje si tražio, i obje su gotove

1. **Filtar datuma sada postoji i na Overviewu.** Usput je nestao i onaj reset na „All time"
   — imali su isti uzrok, pa ih je popravila jedna linija.
2. **Svaki račun piše dokle podaci sežu** — „zadnji zapis 10.07.2026. · prije 39 dana", i to
   amber kad je razmak velik. Bez toga je broj star 39 dana izgledao kao današnji.

## Što treba od tebe — prije nego išta drugo

**Dvije skripte u Supabase SQL Editoru, na TEST-u:**

1. `sql/037_financije_dashboard.sql` — **ponovno** (idempotentan je; sada bez `Cash` u filtru)
2. `sql/038_balance_last_on.sql` — nov

⚠ Ako ovo nije pušteno, pločica pokazuje **395,82** umjesto **461,82** i nema retka o svježini.
*(Ako si to već napravio na kraju S111, provjeri samo da pločica daje 461,82 na 06.07.2026.)*

**Zatim ručni testovi T-S111-1…6** — koraci su u `Claude-temp_R/test-sessions/S111_tests.md`.
Najvažniji je **T-S111-3** (brojka 461,82); ostali su brzi.

## Što slijedi

**Kokina delta** — njen file od 16.08. Ovo je sljedeći veliki komad i **jedini dio koji raste**.
Bez njega joj fali ~6 tjedana vlastite povijesti.

Nakon toga dvije male stvari koje su **direktno za Koku**: brzi unos (da prefilana polja ne
zatrpaju ekran) i shortcutovi po trgovcu — koji usput rješavaju i Tip/Podtip klasifikaciju,
bez ijedne linije novog koda.

---

# DIO 2 — Tehnički (za Claudea)

## Prvo pročitaj

`docs/OVERVIEW_TAB_SPEC.md` **§2.10** (bitno prepisan — `Cash` van salda, zrcalna tablica
pot↔poravnanje, odbačena `Gotovina` varijanta) · **§2.18** (zatvara `Stanja`) ·
`Claude-temp_R/test-sessions/S111_tests.md` · CLAUDE.md „Zamke" (tri nove).

## ⚠ Prvo provjeri je li TEST u očekivanom stanju

```
Overview → Date To = 06.07.2026. → `Sašin tekući RF` mora dati 461,82 €
```

| Vidiš | Znači |
| --- | --- |
| `461,82` | sve je pušteno, kreni dalje |
| `395,82` | `sql/037` nije ponovno pušten (`Cash` još u filtru) |
| `441,80` | `fix_rf_ostatak.py --apply` nije pokrenut |
| `375,80` | ni jedno ni drugo |
| nema retka „zadnji zapis …" | `sql/038` nije pušten |

## Novo u S111

| Što | Gdje |
| --- | --- |
| `Cash` van filtra salda | `sql/037` (values `['Racun']`) + §2.10 + CLAUDE.md + `docs/help/overview.md` |
| `last_on` po grupi | `sql/038_balance_last_on.sql` (⚠ `DROP FUNCTION` — mijenja se povratni tip) |
| prikaz svježine | `BalanceByGroupTile.tsx` (`STALE_DAYS`, `daysBetween`, `danWord`) |
| `AnchoredBalanceRow.last_on` | `src/lib/overviewApi.ts` |
| filtar datuma na Overviewu | `AppHome.tsx:487` (`activeTab !== 'structure'`) |
| ⚠ `asOf` stegnut na danas (samo saldo, ne `split`) | `BalanceByGroupTile.tsx` (`effectiveAsOf`, `isPast`) — inače „Potvrdi na 30.04.2027." |
| čišćenje 9 duplikata | `data-prep_tools/Financije/fix_rf_duplikati.py` |
| čišćenje ostatka | `data-prep_tools/Financije/fix_rf_ostatak.py` |

Backupi obrisanog: `data-prep_data/Financije/_arhiva/rf_duplikati_obrisano_*.json`,
`rf_ostatak_*.json` (pun `event` + svi `attributes`, dovoljno za ručni povrat).

## Sidra u TEST bazi — pet, i jedno je namjerno krivo

| `confirmed_on` | grupa | iznos | napomena |
| --- | --- | --- | --- |
| `2025-01-01` | ZABA | 3.054,41 | `ZABA_2024-12.pdf` |
| `2025-12-31` | ZABA | 1.184,86 | `ZABA_2025-12.pdf`, ručno kroz UI (T-S110-2) |
| `2026-07-01` | ZABA | 2.255,64 | `ZABA_2026-06.pdf` |
| `2025-01-02` | RF | **3.453,03** | ⚠ tipfelerica, **ostaje kao povijest** |
| `2025-01-02` | RF | **3.458,03** | `RF_2024-12.pdf` — **važeće** (najnoviji `created_at`) |

⚠ Ne „čistiti" ono krivo — ono **je** T-S111-2. `036` nema UPDATE policy namjerno.

## Kokina delta — što je izmjereno, i gdje je mina

`data-prep_data/Financije/Financije 2026-08-16.xlsx`

- `koka EU` +117 redaka (do 13.08.), `sasa EU` +323 (do 11.08.)
- ⚠ **~186 od tih 323 nisu nova potrošnja** nego preformulacija Visa naplata koje baza već
  ima iz PBZ izvoda. Naivan uvoz ih broji dvaput.
- Njena restrukturacija je **provjerena čista**: 911 redaka lanca, 0 puknuća, razina identična
  starom fileu na **svih 376 zajedničkih datuma**. Format joj se **približio** modelu:
  kol. **C = datum naplate**, kol. **G = datum kupovine**, prazan C ⇒ `Status = Planiran`.
- ⚠ Maknula je **skupnu Visa naplatu** — generator je mora **sintetizirati** iz zbroja svake
  skupine po datumu naplate. Kontrola: mora dati iznos s RF izvoda. **Ne mijenjati os salda**
  (`event_date`) — ta je varijanta razmotrena i odbačena, razbila bi model dokazan na ZABA-i.
- ⚠ **Dedup mora imati toleranciju na iznos.** S111 je čistio 9 takvih na 213 redaka; ovdje ih
  je red veličine više.
- Za `koka EU`: 6 puknuća lanca u dvije skupine, **svaka neto 0,00** ⇒ zamijenjeni redoslijedi.
  Ne tražiti novac ondje.

## Otvoreno / neverificirano

- **T-S111-1…6 svi ⬜.** T-S111-3 je onaj koji potvrđuje glavni rezultat.
- **`AppHome.tsx` izmjena nije ručno testirana** (typecheck + build prolaze) — to je T-S111-1.
- **`sql/038` nije pokrenut na PROD-u** (kao ni 035–037; Overview je zasad TEST-only).
- **Preostali poznati Δ:** `−200,14` na ZABA lancu 2025-08 → 2026-04
  (`SALDO_MODEL_NALAZI.md` §6.3, Sašina odluka: ne loviti). RF nema više ništa.
- **Backlog je pomaknut:** UI za popis/brisanje sidara **više ne čeka** odluku o `Stanja`
  (§2.18 ju je zatvorio) i sada ima konkretan povod — dva sidra istog dana, korisnik ne vidi
  koje vrijedi.

## Sitnica

Intelligence layer je sada **S112+**. (Pomican četiri puta: S108, S109, S110, S111.)
