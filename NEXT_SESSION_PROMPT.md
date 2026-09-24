> Pisano protiv commita **`44c295a`** (S146) + commit S147 koji nosi ovaj file.
> ⚠ Ako `git log` pokazuje noviji commit od S147-ice, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S147 (2026-09-24)

---

# DIO 1 — netehnički (za Sašu)

## Što je danas napravljeno

- **Hrpa B je prošla u cijelosti** na `dev:prod`: Overview preživi povratak, rata `100/3`
  daje `33.34/33.33/33.33`, sivi `+` s hintom, View nakon pomaka datuma. Uz to preset
  „izjednačeno" na TEST-u i ponovljeni E2E run (11/11).
- **PENDING 299 → 113 redaka.** Otvorena su još **3** stavke i nijedna nije test za odraditi:
  boolean `Not set` (samo praćenje) i dvije o Structure fan-outu (posao, ne test).
- **Odlučio si što znači `Planiran`:** kupovina je uvijek odrađena, `Planiran` = račun još
  nije teretio. Time je zatvoren sukob pravila koji je stajao od S130.
- **Prijedlog „Dospjelo → potvrdi"** (`docs/DOSPJELO_SPEC.md`), svih šest odluka prihvaćeno.
  Kod još nije pisan.

## Tvoj redoslijed za dalje (S147)

1. **Baza što točnija** — prvo **Visa istraga**.
2. **Bugovi.**
3. **Prolaz kroz backlog** — što smo sve htjeli dovršiti.

## Što je važno znati prije S148

- **Visa košara se slaže s PBZ naplatom 16 mjeseci u cent, a od veljače 2026. ne.**
  Razlike: `123,33 · 35,00 · 195,00 · 126,84 · 304,64 · −45,53`. Nešto se promijenilo oko
  veljače; to je prvi posao. Trebat će `PBZVISA` izvodi od 2026-01 nadalje.
- **✅ PROD je deployan na kraju S147** (`main` = `7ef95ac`, 63 commita od S137). Provjereno
  dvaput: Netlify bundle nosi S145 kod, i ti si na mobitelu osvježio Overview i ostao na njemu.
  Koka sada ima popravak Overview taba i rata — neka jednom povuče stranicu dolje.
- Na TEST-u ostali tvoji test-zapisi: shortcuti `Lab Results1`, `Lab Results2`, `Medical Visit`
  i zapis „TODO /" od 24.09. 11:53 — obriši kad stigneš.

---

# DIO 2 — tehnički (za Claudea)

## Stanje grana

`test-branch` = `main` = `7ef95ac` (S147) — **deploy pušten na kraju S147** (Saša, PowerShell;
prije toga `npm run check` 15/0, ratchet 0, build ✓; **nijedna SQL migracija** od S137).
Potvrđeno: Netlify bundle sadrži S145 tekst rata modala; Overview + osvježi na mobitelu ostaje.
⚠ Pri provjeri deploya prvi `curl` bundlea je puknuo na mreži i **prazan rezultat pročitan je
kao „stara verzija"** — provjera sadržaja mora provjeriti i da je file stigao cijeli
(`size_download` ≈ lokalni build).

## S148, korak 1 — Visa istraga (Sašin prioritet „baza što točnija")

Mjerenje je u `docs/DOSPJELO_SPEC.md` §2 i CLAUDE.md Backlog (prva stavka „Otvoreno").
Skripta za ponavljanje stoji samo u scratchpadu S147 — **napiši je iznova kao alat** u
`data-prep_tools/Financije/` (npr. `visa_kosare.py`), jer će trebati i poslije popravka:
- Visa retci grupirani po **mjesecu `Datum naplate`**, **bruto `isplata`** (zrcalni
  `PRIMLJENA UPLATA - HVALA` redak je `uplata` s `Izvor = Visa` — ne smije ući u Σ);
- protiv `Izvor = Racun` retka čiji `Izvod opis` (bez razmaka, velika slova) sadrži `PBZCARD`;
- ⚠ `ET_TARGET=prod` i **pročitaj zaglavlje prije brojke** (S137 zamka).
Kreni od `2026-02 · 123,33`: usporedi retke košare s `PBZVISA_2026-01/02` izvodom
(glob `PBZVI[SZ]A_*` — jedan file se zove `PBZVIZA_`). Hipoteza (ne nalaz): retci upisani
punim iznosom **uz** rate. Popravak ide **fix skriptom + backup + `--apply` pod Sašom**
(PROD upisi su mu blokirani za Claudea).

Druge stavke istog prioriteta (točnost baze), iz CLAUDE.md:
- 10 Visa `Planiran` redaka s `Datum naplate 03.09.` — generacija `next:3`; stvarna naplata
  **07.09. `1.218,38`** već je u bazi. Riješiti uz istragu.
- MC par `+105,30`/`−105,30` (`Planiran`, dospio 07.09./12.09.) — pogledati što je.
- `oznaci_iz_presedana.py --apply` nikad pušten (45/71, S129).
- `Izvod opis` za RF retke (Backlog, Sašin izričit zahtjev S131).
- **PITANJE ZA SAŠU:** `PP (Posmrtna pripomoc)` **8,60 · 23.09.** na RF-u nosi `Izvor = Visa`.
  U povijesti su PP bili **bankovni nalozi** (`Izvor = Racun`). Ako je i ovaj nalog, saldo RF-a
  ga **ne broji**. Pitati prije ispravka.
- Kokin plan `117,32 / 6` (22.09., prije popravka rata): rata 1/6 ima atribut `19.57`, a
  komentar `19.55 od 117.32` — redak sam sebi proturječi. Jedan Edit komentara.

## Bugovi (korak 2) — kandidati, redom po šteti

- **Pločica: „zadnji zapis" znači „zadnja promjena SALDA", a natpis to ne kaže** (S147, Saša
  na mobitelu). RF pokazuje narančasto *„15.09. · prije 9 dana"* dok lista ima retke od danas —
  svi su `Visa/Planiran` (22) ili `Cash` (1), dakle ispravno izvan salda. Za račun koji se
  plaća karticom to je **stalno** stanje ⇒ upozorenje koje uvijek pali. Prijedlog: natpis
  „zadnja promjena salda".
- „Restoring filter" bez timeouta (+ hipoteza da je to E8-2) — Backlog.
- `hidden_in_add` se briše uvozom bez kolone; `HiddenInAdd` samo iz prvog retka — Backlog.
- `et_activity_draft` bez oznake baze — Backlog (dira dva E2E speca u istom commitu).
- `ViewDetailsPage` efekt prije deklaracije — Backlog.
- Open bugs: BUG-S117-RULESHAPE, bulk delete za grantee-a, BUG-S103-ANYATTR.

## Otvoreni testovi

T-S145-3 (praćenje), T-S140-8 + T-S141-1 (Structure fan-out — posao). Sekcije S140/S141/S145
čekaju samo njih.

## Zamke koje je S147 platio — sve su u CLAUDE.md

- § E2E: `ENOTFOUND`/`ECONNRESET` = run nije mjerio ništa; `dev:prod` između runova blokira drugi run.
- § Unos u aplikaciji: `Status` kartičnog retka (odluka S147).
- ⚠ **Mali uzorak kao dokaz o modelu**: „Visa 0/3" je bio točan broj i krivi zaključak dok se
  nije izmjerila cijela povijest. Kad brojka kaže „model ne radi", izmjeri **cijelo** razdoblje
  prije nego zapišeš.

## Što NE dirati

- **`main`** — merge pušta Saša (PowerShell oblik iz CLAUDE.md).
- **PROD upisi** — `--apply` pokreće Saša.
- `DOSPJELO_SPEC` kod ne počinje dok Visa istraga ne završi? — **ne**: MC faza 1 (samo čitanje)
  je neovisna o Visi. Ali Sašin redoslijed je baza → bugovi → backlog, pa pitaj prije.
