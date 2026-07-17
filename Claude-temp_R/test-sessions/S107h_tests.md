# S107h — testovi i radni koraci (2026-07-17)

Kontekst sesije: drugi krug pisanja Pravila (nakon S107g prvog pravog runa) — pregled
reda po redu sa Sašom (+ Koka za osiguranje/Audible pitanja). Detalji: `ENRICH_PLAN.md` §2e/§3.

---

## T-S107h-1 — Kod review novih Pravila redova (prije bilo kakvog runa)

Saša je sam dodao ~15 novih redova u Pravila (Osiguranje/Porezi placeholderi, Apple/Amazon/
Audible/Kindle/HP/Anja/OTP Leasing/parking/cash). Claude review protiv `apply_rules.py`
matching logike + stvarnog teksta u Review sheetu:

1. `*osiguranje*`/`*porez*` — zvjezdica NIJE wildcard (doslovan substring, kao `google*youtube`
   koji radi jer Google stvarno ispisuje literalnu zvjezdicu) → 0 stvarnih pogodaka provjereno.
2. `APPLE.COM` → Podtip "Apple" ne postoji u Taksonomiji (Zabava nema taj Podtip) → pravilo
   bi bilo preskočeno.
3. Napomena polja s upitnikom ("odredi koje?", "TV zabava?", "Sasa i Koka?") — hrane pravi
   `comment` u appu, ne smiju biti privremeni podsjetnici.

**Status:** ✅ nalazi potvrđeni programski (scan stvarnog teksta), doveli do koda (T-S107h-2)
i do redizajna Osiguranje kategorizacije (T-S107h-3/4).

---

## T-S107h-2 — Komentar → Alternativa mehanizam (kod, `apply_rules.py`)

Na Sašin zahtjev: kolona `Komentar` (već postojala, nikad se nije čitala) sad se dopisuje uz
`pravilo #N: <kw>` marker u `Alternativa / nap.` koloni Reviewa kad pravilo pogodi — sigurno
mjesto za "TODO razdvoji po X" bilješke koje trebaju kasnije filtriranje, bez diranja pravog
`comment` polja. Docstring + in-sheet help tekst ažurirani (upozorenje o zvjezdici, upozorenje
o Napomeni koja hrani comment).

**Status:** ✅ `py_compile` čist. Funkcionalno potvrđeno kroz T-S107h-6 (dry run, 0 warninga).

---

## T-S107h-3 — Osiguranje/Porezi kategorizacija redizajn (odluke s Kokom)

Kroz chat s Kokom razjašnjeno stvarno stanje "osiguranje" redova (48 ukupno, plus 26 Allianz
bez riječi "osiguranje" u tekstu):
- Allianz → auto osiguranje za C5 i Lacetti, Koka: nema pouzdane oznake koji auto → ide u
  postojeći Podtip `registracija` (Hrvatska praksa: registracija+osiguranje jedna transakcija).
  Jedini eksplicitno označeni red ("Allianz Lacetti") ide u auto Lacetti, ostatak (25×,
  rate-serije bez oznake) pretpostavka → auto C5 (prihvaćen rizik, nema boljeg signala).
- Generali → kuća, Koka: ide u postojeći `Domaćinstvo`/`Popravci, održavanje, osiguranje`
  (NE novi Tip) — pokriva i Kokin i Sašin račun (različita nekretnina/polica, isti bucket).
- Triglav (životno/investicijsko) → "prošlost" (Koka), ne treba dalje dijeliti D/I inicijale
  → postojeći `Osiguranje`/`Osiguranje` (generic, 0 prijašnjih redova).
- Taksonomija red `Osiguranje`/`allianz/triglav/zivotno/investicijsko` (kombinirani placeholder)
  — obrisan (Saša), više ne treba.
- Porezi placeholder red ostaje neriješen (odgođeno, nije bio dio ovog kruga).

**Status:** ✅ nema potrebe za novim Taksonomija redovima — sve ide u postojeće kategorije.

---

## T-S107h-4 — Iznos min/Iznos max uvjet (novi feature, `apply_rules.py`)

Koka: Audible_Koka i Audible_Sasa se razlikuju po cijeni (Sasin je skuplji). Provjera stvarnih
iznosa (53 redova) potvrdila jasan razmak: 7.92–8.99€ (niži tier) vs 13.21–18.71€ (viši tier),
prag 10 odvaja čisto. Skripta prije nije podržavala iznos kao uvjet — dodana 2 opcionalna
stupca (`Iznos min`/`Iznos max`) u Pravila; `read_rules` parsira, `rule_amount_ok()` provjerava
uz keyword matching (na oba mjesta: `find_rule` override grana + glavna pravila petlja).
Isti mehanizam otkrio da APPLE.COM (60 redova) NIJE "Zabava" nego iCloud pretplata — dva
jasna mjesečna price-pointa (2.99€ i 7.99→9.99€, potonji price-increase sredinom 2025),
potvrđeno postojećim ručno klasificiranim redom (2291, 2.99€, Napomena "iCloude" →
`Informatika`/`Cloud backup`). AMAZON (samo 2 retka, 48.45€/52.41€) — cijena ne odgovara
Amazon Prime pretplati (89.90€/god na amazon.de), format reference izgleda kao obična
narudžba → pravilo maknuto, ostaje ručno.

**Status:** ✅ `py_compile` čist. Funkcionalno potvrđeno kroz T-S107h-6 (0 kršenja praga).

---

## T-S107h-5 — `update_pravila_s107h.py` (novi one-off) — Pravila sheet regeneriran

Claude je (na Sašin zahtjev "možeš li ti izmijeniti Pravila sheet") napisao i pokrenuo
one-off skriptu koja cijeli Pravila body regenerira iz `FINAL_RULES` liste (idempotentno):
- AMAZON red obrisan
- APPLE.COM zamijenjen s 2 Iznos-range reda → `Informatika`/`Cloud backup` (Napomena "iCloud")
- AUDIBLE razdvojen na 2 reda (Iznos max 10 → Audible_Koka, Iznos min 10 → Audible_Sasa)
- Header 'Iznos min'/'Iznos max' dodan (F/G), help nota pomaknuta u H2 (ažuriran tekst)
- Sva ostala pravila (17) netaknuta

Backup: `Financije_review_20260710_1448.pre-pravilaS107h-20260717_130818.xlsx`.

**Status:** ✅ verificirano (`openpyxl` dump nakon runa = točno 25 redova kako dogovoreno).

---

## T-S107h-6 — Pravi `apply_rules.py` run (drugi pravi run ukupno)

`--dry` prvo (294 bi se promijenilo, 0 warninga) → pravi run (identični brojevi):
- 24+20 apple.com → Cloud backup, 4 Audible_Koka + 38 Audible_Sasa, 22 spotify, 10 KINDLE,
  4 Anja, 2+1 Claude/Anthropic, 1 allianz&lacetti + 25 allianz, 5 generali, 16 triglav,
  15 OTP Leasing, 45 parking, 19+37 cash, 6 HP INC. = **294 redova, +46 Napomena popunjeno**
- Backup: `Financije_review_20260710_1448.pre-rules-20260717_130940.xlsx`

**Programska kontrola nakon runa:**
1. Audible threshold: 0 kršenja (nijedan Audible_Koka red ≥10€, nijedan Audible_Sasa red <10€)
2. `Pravilo run` = "2026-07-17 13:09" na točno 294 retka (poklapa se s "Promijenjeno: 294")
3. Cloud backup redovi s Napomena="iCloud": 43/44 (1 već imao drugačiju Napomenu, P3 ju je
   ispravno preskočio)

**Status:** ✅ sve tri kontrole prošle. Preostaje: Sašin vizualni pregled u Excelu (filter
Pouzdanost=PRAVILO ili Pravilo run=2026-07-17 13:09).

---

## Sažetak N/A stanja

Prije ovog kruga: 2000 N/A. Nakon: 2000 − 294 = **1706 N/A** (od toga dio su redovi bez ikakvog
teksta, netaknuti; dio čekaju sljedeći krug pravila).

## Novi/izmijenjeni alati

- `apply_rules.py` — Komentar→Alternativa dopisivanje (S107h); novi `Iznos min`/`Iznos max`
  uvjet (`rule_amount_ok`, `row_amount`); docstring + HELP_TEXT ažurirani
- `update_pravila_s107h.py` (novo, one-off) — regenerira Pravila body iz `FINAL_RULES`,
  siguran za ponovno pokretanje (idempotentan), automatski backup
