# Sljedeća sesija — handoff

**Pisano protiv commita:** `S128: dokazani popravci + pregledni workbook tocnosti stanja`
(`5cb220c`, **samo `test-branch`** — `main` je i dalje na `3e9acf6`). Ako `git log`
pokazuje novije, čitaj ovo kao **povijest** — CLAUDE.md je autoritet.

---

# DIO 1 — netehnički (za Sašu)

## Gdje smo

Uvoz je gotov. **Cijela 2023. i 2024. su u PROD bazi** — 2.738 redaka, u komad.

| | |
| --- | --- |
| uvoz 2023.+2024. | ✅ 1.133 + 1.605, nijedan preskočen, nula duplikata |
| predviđanje za 2024. | ✅ potvrđeno **u cent** (`+10,00 / −17,28 / −236,04`) |
| 2023. razlika `15.752,07` | ✅ **objašnjena** — i nije popravljiva radom |
| svih 10 spornih mjeseci | ✅ **svedeno na 1–3 retka**, svaki zbroj daje točno Δ |
| dva popravka | ✅ dokazana izvodom, ⚠ **još neprimijenjena** |
| pregledni workbook | ✅ napravljen |

## ⭐ PRVO ŠTO TREBA NAPRAVITI — jedna naredba

Sesija je stala ovdje: upis na PROD blokirao je auto-mode klasifikator. Dry run
je prošao čisto i sve invarijante stoje.

```
cd c:\0_Sasa\events-tracker-react\data-prep_tools\Financije
..\Tools\venv\Scripts\python.exe fix_parking_i_multisport.py --apply
```

Očekivano: backup u `_arhiva/`, **3 brisanja + 1 pomak datuma**, na kraju
`obrisanih redaka ostalo 0`.

⚠ Javi li `✗ invarijanta ne stoji` — **ne forsiraj.** To znači da je baza
drukčija nego kad je nalaz izmjeren; regeneriraj pregled i pogledaj list
`Sporno`.

Odmah zatim:

```
ET_TARGET=prod ..\Tools\venv\Scripts\python.exe promet_check.py --od=2025-01
```

`2025-02`, `2025-03`, `2026-03` i `2026-04` moraju pasti na **0,00**.

## Što je ostalo od „točnosti stanja"

Nakon tog popravka ostaju **tri** retka, i to je cijeli popis:

| mjesec | Δ | što treba |
| --- | ---: | --- |
| 2025-10 | −150,00 | redak `12.10.` bez opisa (izgleda kao podizanje) — banka ga nema |
| 2025-08 | −46,74 | `−45,94` (Zagrebački holding) + `−0,80` |
| 2025-07 | +0,80 | banka ima `−0,80` @ 07.07., baza nema |

Alat je `uskladi_izvod.py` nad tim izvodom. **Predlažem 2025-10 prvi** —
najveći i jedan jedini redak.

⚠ Tri odstupanja iz 2024. (`+10,00`, `−17,28`, `−236,04`) su **zapečaćena
sidrima** — ne diraju saldo. Popravljaju se zbog kvalitete podataka, ne zbog
stanja, i mogu čekati.

⚠ **Sidra za 2025./2026. tek kad razlika padne na nulu.** Pravilo koje je ova
sesija platila: sidro je **pečat na usklađen mjesec, ne alat za usklađivanje**.
Upisano prije provjere, ono provjeru ne pokvari nego je **učini nemogućom** —
i to bez ijedne greške, jer izlaz izgleda uredno.

## 2023. — pitanje za tebe, ne posao

Tvoje pitanje („Koka je imala formulu koja zatvara točno") imalo je pravi
odgovor: **njen model je ispravan.** Ona tereti račun svakom kartičnom stavkom,
mi jednom skupnom naplatom s izvoda. Prvu takvu naplatu ona ima tek
`11.12.2023.`; za siječanj–studeni tog retka nema **nigdje**, jer ZABA izvoda
prije `2023-12` nemamo.

Dvije opcije, tvoja odluka:
- **(a)** skineš ZABA izvode za 2023. iz e-bankarstva ⇒ 2023. se da zatvoriti
- **(b)** ostaviš — sidro `844,83 @ 01.01.2024.` je već zapečati, a dokaz da ne
  curi dalje je 2024. koja iznad njega zatvara 9/12 u cent

2023. je uvezena zbog analize i AI sloja, ne zbog salda.

## Pregledni workbook

`data-prep_data/Financije/pregled_stanja_20260904_1756.xlsx` — tri lista:
**Pregled** (svi izvodi, sidra, zeleno/crveno, autofilter), **Sporno** (redak
po redak, banka vs baza, autofilter), **2023** (objašnjenje s brojkama).

Regeneriraj kad god:
```
ET_TARGET=prod ..\Tools\venv\Scripts\python.exe pregled_stanja.py
```

⚠ **Tvoja ideja s označavanjem Kokine Excelice je odbačena s razlogom, ne iz
lijenosti:** u njenom fileu nema što označiti (zatvara), a polovica spornog
materijala — skupne naplate i razdvojeni parking — ondje **uopće ne postoji**.
Oznake bi sjele na ispravne retke, a gdje redak fali ne bi bilo ničega.

## Deploy na `main` — čeka jedan test

Današnji commiti **ne diraju aplikaciju**, pa za njih deploy nema smisla.

Ono što čeka je **S127 kod** (4 app filea: `attributeRules.ts`,
`AddActivityPage.tsx`, `EditActivityPage.tsx` + test). Vrijedi ga poslati jer
Koka danas ima zamrzavanje `Datum naplate`. Jedina brana je **T-S127-9**:

> Otvori kartični **Visa** redak u Editu, ne diraj ništa, spremi.
> `Datum naplate` mora ostati **nepromijenjen**.

⚠ Lokalni dev server gađa PROD bazu ⇒ zapiši stari datum prije testa. Pad
mijenja jedan redak i lako se vrati.

Prođe li — merge, i današnji commiti dođu besplatno u istom potezu.

## Ostalo neriješeno od prije (nije naraslo)

- `Status` se u Editu mijenja **pravilom, ne dokazom** — 2.300 redaka nosi
  potvrdu s izvoda, a promjena `Izvora` ih raz-potvrdi. Tri opcije u
  `PENDING_TESTS.md`; preporuka je **potvrda pobjeđuje pravilo**.
- Ručni testovi: T-S127-2/-3/-5/-7/-9/-10, plus stariji iz `PENDING_TESTS.md`.

---

# DIO 2 — tehnički (za Claudea)

## Stanje grana

- `test-branch` = `5cb220c`, pushano.
- `main` = `3e9acf6`. Ispred njega **11 commita**, ali samo **4 app filea**
  (S127: `attributeRules.ts`, `AddActivityPage.tsx`, `EditActivityPage.tsx`,
  `ruleManagedAttrs.test.mjs`). Sve ostalo je `data-prep_tools/` + docs.

## Novi alati (S128)

| file | što radi |
| --- | --- |
| `data-prep_tools/Financije/promet_check.py` | promet po izvodu, app vs banka, **ne prolazi kroz sidro** |
| `data-prep_tools/Financije/pregled_stanja.py` | workbook: `Pregled` / `Sporno` / `2023` |
| `data-prep_tools/Financije/fix_parking_i_multisport.py` | ⚠ **dry run odrađen, `--apply` NIJE** |

## Zašto `promet_check.py` postoji

`make_saldo_anchors.py --report` mjeri **saldo**, a saldo ide kroz
`rpc_area_balance_anchored` (`036`), koja bira najnovije sidro
`confirmed_on <= p_as_of`. Sidro NA close datumu ⇒ `balance == amount`, Δ = 0
**po konstrukciji**. To je zamka 2 iz zaglavlja tog alata, i S127 ju je aktivirao
upisavši sva 2024. sidra **prije** uvoza 2024.

`promet_check.py` mjeri promet u prozoru `(prev_close, close]` preko
`rpc_area_group_agg` s `p_from`/`p_as_of` — ta RPC za sidra ne zna.
Pravilo je upisano u CLAUDE.md („Mjerenje / usklađenje").

## Izmjereno u ovoj sesiji (ne ponavljati)

- PROD Financije_all: **5.157 eventa** (2023: 1.133 · 2024: 1.605 · 2025: 1.462
  · 2026: 957), **5.146** pod Kokinim `eeb78414`, 11 pod Sašinim `768a6056`.
- Raspon 2024-01 → 2026-06: **20 mjeseci u cent, 10 odstupanja.**
- 2023. razlika `15.752,07`; skupnih kartičnih naplata na ZABA 2023.: **1**
  (`926,52 @ 11.12.`), 2024.: **12**. Ostalih 10 iz 2023. je Sašin RF Visa.
- `session_start` na `2025-03-02`: **nema nijednog eventa** (nema kolizije).
- Kokina Excelica `Financije 2026-08-16.xlsx`: listovi `koka EU` / `sasa EU`,
  kolona A = račun (`Mastercard` 1673, `Kokin tekući` 1025, `Sašin tekući` 645,
  `Visa` 227).

## Prvi potez sljedeće sesije

1. `fix_parking_i_multisport.py --apply` (T-S128-1) — ⚠ **traži korisnikov
   pristanak / pokretanje**, klasifikator je blokirao upis na PROD.
2. `promet_check.py --od=2025-01` (T-S128-2) — četiri mjeseca moraju pasti na 0.
3. `pregled_stanja.py` regenerirati, list `Sporno` mora ostati s **tri** retka.
4. Tek onda `uskladi_izvod.py` nad `ZABA_2025-10`.

## Otvoreno / neverificirano

- **T-S128-1…6** — svi ⬜, v. `docs/sessions/tests/S128_tests.md`.
- **T-S127-9** je brana za `main`; T-S127-2/-3/-5/-7/-10 još ⬜.
- Ništa za arhivu (`audit_tests.py`: 0 sesija sa svim ✅).
