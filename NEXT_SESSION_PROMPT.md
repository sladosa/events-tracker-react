# NEXT SESSION PROMPT — nakon S110 (provjera lanca zatvorena)

**Pisan protiv commita `7bd6ee2`** (S110, 2026-08-17) **+ commit zatvaranja sesije koji slijedi
odmah iza i sadrži samo dokumentaciju.** Ako `git log --oneline -1` pokazuje nešto novije,
čitaj ovo kao povijest; `CLAUDE.md` je autoritet.

**Stanje grana:** `test-branch` nosi S108 + S109 + S110. `main` = PROD, nije diran.

---

# DIO 1 — Jednostavnim rječnikom (za Sašu)

## Što se dogodilo u S110

**Provjera je prošla.** App sada reproducira i banku i Kokinu tablicu **do centa**:

- na **31.03.2025.** daje `2.546,55` — isti broj kao bankov izvod i kao Kokin red 1641
- na **08.07.2026.** daje `3.403,74` — točno Kokin broj, **bez ikakve napomene uz brojku**

Drugi je posebno jak jer je mjeren preko samo sedam dana i šest transakcija, od bankovnog
broja s izvoda. Nema mjesta da se greška slučajno poništi.

## Dvije greške u podacima koje smo usput našli i popravili

**1. Kokina tipfelerica u godini.** Podizanje `200,00` s bankomata upisala je na `29.05.2026.`
umjesto `29.05.2025.` Banka pokazuje da je tog svibnja 2025. bilo **dvoje** podizanja po 200,
a u bazi je bilo samo jedno. Njen vlastiti stupac `Stanje` (925,33) potvrđuje gdje redak
pripada — dakle kriva je bila samo ćelija s datumom, ne njen saldo.

**2. Parking 1,60** — unesen kroz app na `07.07.2026.`

Oba su popravljena i u bazi i u Reviewu, pa se sljedećim uvozom neće vratiti.

## Nešto što sam ti rekao krivo, pa ispravio

Nakon prvog popravka rekao sam da je „bila jedna greška plus šum" jer je ostatak bio `−0,14`.
**To je bila slučajnost, ne dokaz.** Nedostajućih `+200` poništavalo je nepovezanih `−200,94`
iz kasnijih mjeseci. Kad je 200 sjela na svoje mjesto, ostatak se pokazao kao stvaran.

Pouka je zapisana u `CLAUDE.md` jer vrijedi šire od Financija: **mali zbroj razlike nije dokaz
da nema grešaka — može značiti da ih ima paran broj.**

## Poznato odstupanje — tvoja odluka, zapisana

`−200,14` kroz kolovoz 2025. → travanj 2026.: četiri retka u bazi **bez opisa** kojima banka
nema protustavku. Provjerio sam da nisu pomaknute kopije — ti se iznosi u izvodima **nikad**
ne pojavljuju. Odgovor bi znala samo Koka, a iznosi su mali i stari.

**Odlučio si ne loviti dalje.** Zapisano s datumom i razlogom u `SALDO_MODEL_NALAZI.md` §6.3
da se za mjesec dana ne krene iznova. **Ne dodiruje današnji broj** — sidro od 01.07.2026. ga
presijeca.

## Bug koji smo našli usput

Kad si mijenjao datum u Editu, app je tiho gomilao pomak i jedan zapis je završio na godini
**−3831**. Save je padao **bez poruke** — samo te ne bi prebacio na View. Baza je ostala
netaknuta. Popravljeno i provjereno na pravom slučaju; dodana je i poruka za slučaj da se
ikad opet dogodi nešto slično.

## Što slijedi

**Razgovor o `Financije_all > Stanja`** — tvoj zahtjev, svježa glava. Provjera je tu odluku
oslobodila: model je dokazan, pa se ne bira pod pritiskom točnosti nego po tome gdje je
stanjima ugodnije živjeti.

## Što treba od tebe

- **Ništa prije sesije.**
- Tijekom: odluka o `Stanja` (skica atributa je spremna, v. DIO 2).
- Ništa od testova — **svi ⭐ testovi iz S110 su prošli** (T-S110-2 zatvoren 17.08.2026.).

---

# DIO 2 — Tehnički (za Claudea)

## Prvo pročitaj

`docs/OVERVIEW_TAB_SPEC.md` §2.10, §2.13, §2.17 · `data-prep_tools/Financije/SALDO_MODEL_NALAZI.md`
**§6** (nov — provjera protiv ispisanih izvoda, tri zamke, poznato odstupanje) ·
`Claude-temp_R/test-sessions/S110_tests.md`.

## Stanje — što je novo u S110

| Što | Gdje |
| --- | --- |
| Pločica prima `asOf` + „na dan …" + „Potvrdi na `<datum>`" | `BalanceByGroupTile.tsx`, `OverviewTab.tsx` |
| `THEME.overview.asOfNote` | `src/lib/theme.ts` |
| BUG-S110-DATESHIFT fix + sanity guard 1900–2200 | `EditActivityPage.tsx` (`handleDateTimeChange`, `handleSave`) |
| Ispisana bankovna stanja → `balance_anchors` | `data-prep_tools/Financije/make_saldo_anchors.py` |
| One-off popravci Reviewa | `fix_koka_datum_200.py`, `align_review_s110.py` |

**Sidra u TEST bazi — tri:** `2025-01-01 = 3.054,41`, `2025-12-31 = 1.184,86` (upisano ručno
kroz UI u T-S110-2) i `2026-07-01 = 2.255,64`. Sva tri **ispisana** s izvoda.
⚠ Ono na `2025-12-31` mijenja očekivane brojeve u T-S110-1 — v. `S110_tests.md` preduvjete.

## Tri zamke koje S110 dodaje (sve su u `CLAUDE.md`)

1. **Izvod se ne zatvara na kraju mjeseca.** `confirmed_on` = close date izvoda, nikad
   kalendarski kraj. Inače dvostruko brojanje preklopa.
2. **Sidro NA datum usporedbe čini provjeru tautološkom** (`balance == amount`). Zato dva
   sidra, ne trideset. `--report` to detektira i označi.
3. **Mali zbirni Δ može značiti paran broj grešaka.** Mjeri po razdoblju (Δ prometa), ne samo
   na kraju.

Plus: **baza drži UTC, UI prikazuje lokalno** (+2h ljeti) — bitno kad se traži slobodan
`session_start`.

## Aktivna nit — odluka o `Financije_all > Stanja`

Argumenti izvagani u S109 (`DONE_HISTORY.md`), odluka odgođena do brojeva; brojevi su sada tu
i **ne prisiljavaju ni na jednu stranu**. Model je dokazan sa zasebnom tablicom, pa je selidba
pitanje ergonomije, ne točnosti.

**Skica atributa** (dogovorena u razgovoru, nije implementirana):

| Atribut | Tip | Zašto |
| --- | --- | --- |
| `Racun` | text, dropdown | isti slug kao `group_by` pločice — inače pivot ne radi |
| `Stanje` | number | sam iznos |
| `Izvor podatka` | text, dropdown: `Izvod` / `Bankovna aplikacija` | **pravilo pretvoreno u polje**: nema opcije „izračunato", pa je prekršaj strukturno nemoguć umjesto samo zabranjen |

`event_date` = datum potvrde (ne treba atribut), komentar = ugrađeno polje.

**Provjeriti prije implementacije:**

- `rpc_area_balance_anchored`: `anchors` CTE prelazi s tipiziranih stupaca na **pivot tri EAV
  atributa po slugu** (~20 redaka SQL-a). Još jedno mjesto koje puca na rename sluga —
  `dashboardConfig.ts` fixup mora pokriti i te slugove.
- **Zaštita pisanja slabi.** `036` traži vlasnika ili write grantee **na razini baze**; eventi
  se oslanjaju na `user_id = auth.uid()` + provjeru u aplikaciji (S43). Svjesno prihvatiti ili
  kompenzirati.
- **Sidra ulaze u tok aktivnosti**: Excel export, brojači, filtri, Kokino stablo kategorija.
- Sidro trenutno ne upada u zbroj jer nema `izvorplacanja`, a `op: in` pada kad vrijednosti
  nema. ⚠ **Sreća, ne jamstvo** — sa zasebnom tablicom je strukturno nemoguće.
- ⚠ `useActivities` grupira po `(kategorija, session_start)` ⇒ dva stanja istog dana trebaju
  **različit `session_start`** (+1 min, kao rate).

**Ako selidba prođe:** `INSERT ... SELECT` iz `balance_anchors`, pa automat iz izvoda
(`make_saldo_anchors.py` već zna čitati ispisana stanja — mijenja se samo odredište).

## Otvoreno izvan te teme

- **Kokina delta** — Koka je poslala svoj Excel 16.08.2026. Saša je tražio da se **prvo**
  odradi sve nad postojećim stanjem (učinjeno), pa delta. Sidro ju je maknulo s kritičnog puta
  za saldo; ostaje zbog analize i zbog toga što Koki fali ~6 tjedana povijesti.
- **OQ-5** — `make_financije_import.py` treba prestati pisati atribut `Stanje`. Potvrđeno kao
  odluka u S109, **nije izvršeno**. ⚠ Postojećih 2220 zapisa se ne dira — Kokin lanac je
  neovisni svjedok. (S110 ga je upravo tako i koristio.)
- **T-S110-4, -5** i cijeli neverificirani rep iz S108 (`PENDING_TESTS.md`).
- **`balance_anchors.note` je `NULL` za sidra iz UI-ja** — podrijetlo broja se gubi. Odgođeno
  do odluke o `Stanja`, gdje ga atribut `Izvor podatka` rješava strukturno. V. backlog.
- **`Datum naplate` ne prati delta-shift** — v. backlog u `CLAUDE.md`.

## Sitnica

Intelligence layer je i dalje **S111+**. (Pomican triput: S108, S109, S110.)
