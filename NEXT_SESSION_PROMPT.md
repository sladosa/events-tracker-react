# NEXT SESSION PROMPT — Financije: batch import 2026

**Zadnja sesija: S107u (2026-08-02, Opus).** Sav app kod iz S107t je **odtestiran u appu — 7/7
prolazi**. Usput su nađena i popravljena tri buga u Structure importu; `disable_save_plus` je
dodan u roundtrip. **Ništa više ne stoji na putu batch importu.**

**Trajni plan prelaska:** `data-prep_data/Financije/FINANCIJE_MIGRACIJA.md` **§13**.

---

# DIO 1 — Jednostavnim rječnikom (za Sašu)

## Gdje smo stali

Prošla sesija je bila testiranje i sve je prošlo. Rate rade, uvoz zapisa radi, izvoz i ponovni
uvoz ne prave lažne izmjene. Tri sitna kvara koja su iskočila usput su popravljena i provjerena.

**Sljedeći korak je pravi posao: uvoz 2026. godine u TEST bazu.**

To je proba mehanizma na najmanjem batchu (~750 redaka). Ako 2026. prođe čisto, ide se unatrag
po godinama.

| korak | što |
| ----- | --- |
| 1 | generiraj uvozni file za 2026. |
| 2 | uvezi u TEST (`Financije_all`) |
| 3 | spot-check: par redaka usporediti s Reviewom, provjeriti broj zapisa |
| 4 | ako je čisto → sljedeća godina unatrag |

Pokretanje appa: `cd C:\0_Sasa\events-tracker-react` pa `npm run dev:test`.
(`npm` mora ići **iz direktorija projekta**. Browserslist poruka je upozorenje, ne greška.)

## Dvije stvari koje treba znati prije uvoza

1. **Batchevi se ne smiju preklapati po datumima.** Vrijeme zapisa se dodjeljuje po danu
   (`09:00`, `09:01`, `09:02`…), pa bi isti dan u dva batcha sudario vremena. Rez uvijek na
   granici dana.
2. **Ne uvoziti sve odjednom.** ~50k redova atributa u jednom naletu je ono što je u srpnju
   srušilo PROD (S105). Godina po godina.

## Što još čeka tebe (ne blokira uvoz)

1. 700 € bankomat 26.11.2025. — pitanje za Koku (nije na izvodu)
2. `Saldo kontrola` — 7 razlika, pitanja za Koku (2026-01 +359, 2024-09 +149, 2×±49 multisport)
3. 15 nemarkiranih rata (banka zapisala `RATA n/m`, Koka nije) — izmjereno, neizvršeno

---

# DIO 2 — Tehnički dio (za Claudea)

## Stanje

`test-branch`, sve commitano i gurnuto. `typecheck` + `build` čisti.

| područje | stanje |
| --- | --- |
| S107t app testovi | **7/7 PASS** (`Claude-temp_R/test-sessions/S107t_tests.md`) |
| S107u testovi | T-S107u-1/3/4/5 ✅; **T-S107u-2 ⬜ backlog** (`S107u_tests.md`) |
| `Financije_all` u TEST-u | uvezena, 15 atributa, 2 automatike, 10 test zapisa + rate |
| Review | 4996 redaka; `Rate?=DA` 629; `Datum naplate` 100 % popunjen |
| roundtrip `AreaSettings` | 3 od 4 ključa; ostaje **`export_profiles`** |

## Prvo: batch import 2026

```
python data-prep_tools/Financije/make_financije_import.py --from 2026-01-01 --to 2026-12-31
```

Generator ima guard koji uspoređuje svih 15 imena **i tipova** atributa protiv generirane
strukture i prekida ako se ne poklapaju — to je jedina obrana od tihog preskakanja
(`excelImport.ts:836` nema `else`).

Nakon uvoza spot-check: broj zapisa vs broj redaka u Reviewu za 2026., par redaka usporediti
po `Tip`/`Podtip`/`Datum naplate`, i provjeriti da dani s više transakcija daju **više redaka**
u listi (ne jedan slijepljeni — `useActivities.ts:242` grupira po `session_start`).

**Batchevi moraju biti datumski disjunktni** (`session_start` = `09:00 + n` po danu).
Redoslijed: 2026 (najmanji) → pa unatrag.

## Četiri tihe rupe u `excelImport.ts` (ugrađene u generator, NE otkrivati ponovo)

1. `session_start` mora biti **tekst `"HH:MM"`** — inače svi redovi dobiju 09:00 bez upozorenja
2. krivo ime atributa se **tiho preskoči** (`:836`, nema `else`) → guard u generatoru
3. `Rate?` je `boolean` — `'DA'` bi se spremio kao **FALSE**
4. email u kol. G mora biti račun koji **izvodi** import (`foreignMode='skip'`)

## Odluke koje se ne otvaraju ponovo

- **D1** `event_date` = datum kupnje; `Datum naplate` = zaseban atribut (kad novac ode)
- **D1b** sve rate jedne kupovine dijele `event_date` = dan kupnje; razlikuje ih `Datum naplate`
  + pomak `session_start`-a za 1 min; `Rata br` = 1..N
- **D1a POVUČEN** — `Datum kupovine` izbačen iz strukture
- **D6** import pod **Kokinim** accountom na PROD-u (kol. G = njen email)
- Nema `staging_financije`; nema trećeg storea između Excela i baze (S107q)

## Zamke pri testiranju (naučene S107u)

- **Kvačica u Area panelu je lokalno stanje forme** — pokazuje klik, ne bazu, dok se ne pritisne
  Save. Stvarno stanje: **Add Activity** (je li „Save +" tu) ili novi export.
- Modalov **„Automation rules: N" je brojač pročitanih** pravila iz sheeta, ne zapisanih.
- Provjera baze bez UI-ja: service role key iz `.env.local`,
  `GET /rest/v1/areas?select=name,settings&name=eq.Financije_all`.
- Generirani structure/import fajlovi se brišu čim nastane novi; pazi da ne gledaš u **BASE**
  `events_export_preview` umjesto u generirani file.

## Backlog

- **T-S107u-2** — `groupAttributes` uzima `Default` s prvog retka grupe ⇒ atributski
  `default_value` ovisi o redoslijedu redaka (`Status.default_value` `Izvrsen`↔`null`).
  Bezopasno, konvergira. Fix: ignorirati `Default` na retku koji ima `DependsOn`.
- **`export_profiles`** ne prolazi Structure roundtripom (ključ `attr:Area||CatPath||AttrName`)
  ⇒ `ExportProfiles` sheet, isti obrazac kao `DisableSavePlus`/`Automations`
- `BUG-S103-ANYATTR` — SECURITY DEFINER RPC (4–6 h)
- E2E za rata tok ne postoji — kandidat sad kad je T-S107t-3 prošao ručno
- `npx update-browserslist-db@latest` — namjerno odgođeno
