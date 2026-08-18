# S107g — testovi i radni koraci (2026-07-16)

Kontekst sesije: sesija PRATNJE — Saša je radio, Claude vodio kroz testove/objašnjavao
outpute + kodirao sitne fixeve. Detalji: `data-prep_tools/Financije/ENRICH_PLAN.md` §2e.

---

## T-S107g-1 — Prvi pravi `apply_rules.py` run

**Precondition:** Preimenovanja sheet popunjen (4 prazna para + ispravljena 2 auto-prijedloga:
PassSport kokin/sasin smjer, Medical razmak→donja_crta), Pravila sheet ima 7 pravila
(seed primjeri obrisani), Taksonomija ispravljena (duplikat `Sport_Koka` → `Sport_Sasa`).

1. `--dry` run pokazao: 196 preimenovanja, 0 reset, 217 pravilo-pogodaka (7 pravila)
2. Pravi run izvršen — isti brojevi, backup `*.pre-rules-20260716_165928.xlsx`
3. Kontrola (programska): `PREIM` marker 196× u Alternativa (Pouzdanost 153 VISOKA/35
   SREDNJA/8 NISKA, nema NEMA), `TAKS` marker 0×, `Pouzdanost=PRAVILO` 217×

**Status:** ✅ programski verificirano. **Preostaje:** Saša vizualno pregledati u Excelu
(dropdown boje, CF, filter po `Pravilo run`) — v. Korak 5 iz S107f_tests.md T-S107f-2.

---

## T-S107g-2 — `Pravilo run` timestamp kolona (novi feature)

Kreirana kao 25. kolona Review sheeta. Svaki redak koji run promijeni (rename/reset/pravilo)
dobije timestamp `YYYY-MM-DD HH:MM`. Provjera: svih 413 promijenjenih redova (196+217) ima
identičan timestamp `2026-07-16 16:59` — filtriranje po toj vrijednosti u Excelu pokazuje
točno što je taj run dirao.

**Status:** ✅ radi kako treba.

---

## T-S107g-3 — Pravilo nadvladava Preimenovanja (nova arhitektura)

Prioritet za invalid-par retke sad: **Pravilo (ako pogađa) > Preimenovanja rename > reset**.
Testirano sintetički (kopija u scratchpadu, ne pravi file): red s nevaljanim parom
`Zdravlje/Sportski rekviziti` (ima Preimenovanja mapping) + Napomena "konzum test override"
→ ispravno preglasio rename i otišao na pravilo `konzum` → `Namirnice/Hrana i ostalo`.

Na pravom fileu trenutno 0 efekta (nema više invalid parova nakon prvog runa) — mehanizam
će se aktivirati tek kad se sljedeći put pojavi orphaned par koji neko novo pravilo pogađa.

**Status:** ✅ mehanizam potvrđen, čeka buduću priliku za "pravu" upotrebu.

---

## T-S107g-4 — `fix_sportski_rekviziti_split.py` (one-off)

Blanket Preimenovanja rename `Zdravlje/Sportski rekviziti` (29 redova) → `Razno/Odjeća/
obuća..._Sasa` pogodio preširoko — bucket je zapravo bio mješavina: Multisport pretplata
(23), Kreatin/MyProtein (3), Decathlon (3).

1. Multisport ("multisport" u Napomeni) → `Zdravlje/Sport_Sasa` — 23 retka
2. Kreatin (Napomena=="Kreatin") → `Namirnice/Hrana i ostalo` — 3 retka
3. Decathlon → netaknuto (ostaje Razno/Odjeća...) — 3 retka

Spot-check: red 893 (Napomena="Saša multisport") → `Zdravlje/Sport_Sasa` ✓,
Alternativa = `PREIM: bio Zdravlje/Sportski rekviziti | RUČNO S107g: multisport split
(bio Razno/Odjeća)` — trag oba koraka.

**Status:** ✅ verificirano.

---

## T-S107g-5 — `fix_tcom_tmobile_swap.py` (one-off)

Kokin originalni T-com/T-mobile label bio krivo upisan na točno 2 retka (od ukupno 41+40):
Izvod opis ("usluge fiksne mreže" vs "usluge u mobilnoj mreži") otkriva stvarnu uslugu.

- red 2281: bio T-com (label) → stvarno mobilna mreža → `Informatika/Komunikacije_T-mobile`
- red 2282: bio T-mobile (label) → stvarno fiksna mreža → `Informatika/Komunikacije_T-com
  (internet, MaxTv)`

Analiza prije fixa: T-com bucket 28 fiksna/1 mobilna/12 bez teksta; T-mobile bucket
28 mobilna/1 fiksna/11 bez teksta — potvrđuje da je mismatch bio točno ograničen na ta 2 retka,
ne sustavni swap.

**Status:** ✅ verificirano, backup `*.pre-tcomswap-20260716_173652.xlsx`.

---

## T-S107g-6 — Nevenka Pavić uplata (red 2436)

`UPLATA NEVENKA PAVIĆ ... Poklon od majke kćeri`, Smjer=Uplata 500,00 — bio N/A (nema opisa
u Napomeni). Klasificiran ručno: `Tip=Ostali prihodi` (bez Podtipa, isti obrazac kao postojeći
"Uplata mama"/"Nataša povrat"), Napomena netaknuta (Izvod opis dovoljno govori), Pouzdanost=
VISOKA. Pravilo namjerno NIJE napravljeno (samo 1 pojava, drugi spomen "Nevenka" već ispravno
klasificiran kao Medical_Koka).

**Status:** ✅ verificirano, backup `*.pre-nevenka-20260716_174056.xlsx`.

---

## Sažetak N/A stanja

2218 → **2000** N/A redova (218 riješeno: 217 pravilima + 1 ručno). Od preostalih 2000:
1142 ima tekst (čeka sljedeći krug pravila), 858 nema tekst uopće.

## Novi alati (trajno u `data-prep_tools/Financije/`)

- `fix_sportski_rekviziti_split.py` — one-off, siguran za ponovno pokretanje (prepoznaje
  preko `Podtip_O`)
- `fix_tcom_tmobile_swap.py` — one-off, ograničen na `Tip_O=Informatika` + `Podtip_O`
  in (T-com, T-mobile)

## Promjene u `apply_rules.py` (trajno)

- Nova kolona `Pravilo run` (timestamp audit trail)
- Novi prioritet za invalid-par retke: Pravilo > Preimenovanja rename > reset
