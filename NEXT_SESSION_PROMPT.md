# NEXT SESSION PROMPT — nakon S108 (Faza 1: Overview tab, pločica sa sidrom)

**Pisan protiv commita `231694f`** (S108, 2026-08-15) **+ zadnji commit S108 koji slijedi
odmah iza.** Ako `git log --oneline -1` pokazuje nešto novije, čitaj ovo kao povijest;
`CLAUDE.md` je autoritet.

**Stanje grana:** `test-branch` nosi cijeli S108 — prvi `src/` diff od PROD deploya
2026-08-12. `main` = PROD, **nije diran** i ne smije biti dok testovi ne prođu.

---

# DIO 1 — Jednostavnim rječnikom (za Sašu)

## Gdje smo stali

Faza 1 je **napisana i brojevi su provjereni**, ali **testiranje nije dovršeno** — ostalo je
bez vremena. Prošlo je T-S108-1, -2, -3. Sve ostalo čeka tebe.

## Što trebaš napraviti, po redu

1. **T-S108-4 — sidro.** Ovo je najvažnije i **nije isprobano**: u bazi je 0 sidara, dakle
   „Potvrdi" nikad nije kliknut do kraja. Koraci su u
   `Claude-temp_R/test-sessions/S108_tests.md` i **ispravljeni su** (v. niže zašto).
   Ako „Potvrdi" javi crveni toast — **prepiši ga doslovno**, to je jedini podatak koji treba.
2. **T-S108-1b** — Add Activity i „⚡ Use" iz Overviewa (novo, na tvoj zahtjev).
3. **T-S108-5…13** — ostalo: Δ, drill, kolona `Stanje`, rename sluga, paginacija,
   „From template", grantee, mobitel, **Help**.
4. **Poslije testova obriši testne zapise i sidra** — inače brojevi iz T-S108-2 više neće
   odgovarati (`150,80` / `−1.978,32`).

## Dvije stvari koje sam pogriješio u S108, pa ispravio

**Prva:** rekao sam ti da u bazi ima 45 eventa bez atributa i da je to rupa u uvozu.
**Nema ih.** Moj alat je čitao bazu po stranicama bez zadanog redoslijeda pa je svaki put
„gubio" druge retke. Uvoz je vjeran Excelu: od 2222 retka razlikuju se 2 (ukupno 1,60 €).
Prva tablica brojeva koju si vidio (`1.792,46`) je iz istog pokvarenog čitanja — **točno je
`150,80`**. Isti bug je bio i u aplikaciji na 6 mjesta, popravljen.

**Druga:** uputa za T-S108-4 bila je **nemoguća**. „Potvrdi" datira sidro na danas, a pravilo
je „strogo nakon" — pa transakcija datirana **danas** po definiciji ne ulazi u saldo. Moj
korak je tražio da uđe; ne bi prošao ni s ispravnim kodom. Sad korak 4 koristi **sutrašnji**
datum („mora ući"), a korak 5 današnji ili raniji („ne smije ući").

## Što slijedi nakon testova

**Faza 2 — brzi unos.** Nije nov ekran: mehanizam postoji (Shortcuts, S88). Fale dvije sitnice
iz `OVERVIEW_TAB_SPEC.md` §2.9 — prefilana polja se ne skupljaju, i dropdown shortcuta je ravan
popis bez grupiranja po Arei.

**Faza 3 — Koka proba na mobitelu.** Prava vaga. Ako i tada bira Excel, mijenja se plan.

**Tvoja odluka koja još stoji otvorena:** spremljeni atribut `Stanje` sad ima dvojnika —
izračunatu kolonu istog imena. Treba ga prestati pisati u `make_financije_import.py`
(to je OQ-5). U aplikaciji sudara nema, u Excel exportu ga ima.

---

# DIO 2 — Tehnički (za Claudea)

## Prvo pročitaj

`docs/OVERVIEW_TAB_SPEC.md` (§2.4, §2.10, §2.12, §2.15, §2.16, §2.17),
`data-prep_tools/Financije/SALDO_MODEL_NALAZI.md`. Kronologija S108 je u `DONE_HISTORY.md`.

## Stanje baze

Na **TEST-u** puštene `sql/035` ✅, `sql/036` ✅ (**dvaput** — druga verzija ispravlja
`FULL JOIN`), `sql/037` ✅ (config je i izravno upisan u `areas.settings.dashboard`).
`balance_anchors` je **prazan**. Na **PROD-u nema ničega** od Faze 1 — ni SQL ni `src/`.

## Prihvatni test se ponavlja

```
data-prep_tools\Financije\run.bat verify_rpc_vs_model.py
```

Troslojno: **A** Review (Python model) · **B** baza (sirovi retci) · **C** RPC.
`B vs C` je kriterij prihvaćanja. `A vs B` je stanje uvoza — razlika tamo se popravlja
**uvozom, nikad ugađanjem SQL-a**. Prozor se uzima iz baze pa se sam pomiče s novim batchom.

⚠ Alat baca iznimku ako paginirani upit nema `order=`. Ne uklanjati.

## Verificirano programski

`rpc_area_group_agg` (B vs C, A vs B, `p_from`) i `rpc_area_balance_anchored` (P-7…P-12):
sidro zbraja, **granica dokazano isključiva protiv stvarnog retka na granici**, grupa sa
sidrom bez prometa se i dalje prikazuje, poziv bez prava → 401, nepoznat slug → 400 koji
imenuje slug. `typecheck` + `build` prolaze.

## Neverificirano (ništa nije prošlo ljudski test)

„Potvrdi" kroz UI, drill, kolona `Stanje`, fixup slugova pri renameu, „From template"
settings copy, 6 `.order('id')` popravaka, Help chipovi na Overviewu, mobitel, grantee.

⚠ Ako „Potvrdi" padne: **nije baza.** Insert je reproduciran kao stvarno prijavljeni korisnik
(magic-link sesija na `sasasladoljev59@gmail.com`, TEST) → **HTTP 201**. RLS i table grantovi
su u redu. Traži uzrok u `BalanceByGroupTile.confirm()` / `overviewApi.saveAnchor()`.

## Poznata ograničenja (dizajn, ne bugovi)

- **Drill nosi jedan `attrFilter`**, a uvjet pločice ima dva (`Izvor` + `Status`) ⇒ drill znači
  „pokaži mi ovaj račun". §2.16 je to predvidio kao test; ispalo je da **filtru fali
  mogućnost**, ne da je widget izmislio nešto.
- **Datum potvrde nije izbor** — uvijek danas. Namjerno (čovjek gleda banku *sada*), ali sidro
  se ne može unijeti unatrag. Polje za datum je mala izmjena ako zasmeta.
- **Tri kante planiranog** (§2.13) i **traka „Dospjelo → potvrdi"** (§2.5a) trebaju granicu po
  `Datum naplate`; RPC filtrira po `event_date`. Faza 4.
- **`dashboard` još ne ide kroz Structure roundtrip** — Faza 4 (`Dashboard` sheet, isti obrazac
  kao `Automations`). Do tada config putuje samo kroz `sql/037` ili „From template".
- **Konfigurator UI se namjerno ne gradi** dok ne postoji druga gusta Area (§2.15).

## Zamke koje ne ponoviti (obje su u CLAUDE.md „Critical rules")

- **Range-paginacija bez `.order()`** je tiho pogrešna — retci se između stranica preklope i
  istovremeno preskoče. Iz toga je proizašla lažna prijava od 45 nepostojećih eventa.
- **Nov tab bez `CHIPS` unosa** → Help ne prikaže nijedan chip i **ne javi grešku**. Nova tema
  u `docs/help/` mora ići i u `HELP_DOC_NAMES` (`netlify/functions/help.ts`).

## Sitnica

Oznaka `S108` zauzela je broj koji je CLAUDE.md rezervirao za „Intelligence layer" —
Intelligence layer je od sada **S109+**.

`Claude-temp_R/DONE_HISTORY.md` **nije praćen gitom** iako su `test-sessions/*` praćeni;
povijest živi samo lokalno. Nisam mijenjao — ali vrijedi odluke.
