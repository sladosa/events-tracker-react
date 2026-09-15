# S137 — testovi

Sažetak u [PENDING_TESTS.md](../PENDING_TESTS.md) § S137.

---

## T-S137-1 ✅ `audit_tests.py` više nije slijep

**Što se mjeri:** vidi li alat sve oblike ID-a i sve oznake statusa koji postoje
u `PENDING_TESTS.md`, i blokira li arhiviranje kad odluka nije donesena.

**Prije (izmjereno 15.09.2026.):**

```
Za arhivu (0): —
Testova koje PENDING uopce ne spominje: 10
```

**Uzrok — dva slijepa mjesta, oba na mjestu odluke:**

1. **ID u prvoj ćeliji dolazi u pet oblika, alat je poznavao jedan.**

   | oblik | primjer | vidi? |
   | --- | --- | --- |
   | gol | `T-S119-3` | ✔ |
   | backticks | `` `T-S121-1` `` | ✘ |
   | ukras | `**T-S119-1** ⭐` | ✘ |
   | sufiks | `` `T-S122-1` (2 slučaja) `` | ✘ |
   | spojeni | `` `T-S123-1/-2` `` | ✘ |

2. **Rječnik statusa ima pet vrijednosti, alat je poznavao dvije** (`✅`, `⬜`).
   `~ superseded`, `→ T-Sxxx` i `⏸ PARKIRANO` su **donesene odluke**, a čitale su se
   kao „bez oznake" — i, gore, **nisu blokirale arhiviranje**, jer je uvjet glasio
   `open == 0`. Sesija se time mogla arhivirati s neodlučenim testom unutra, tiho.

**Poslije:**

```
Za arhivu (5): S119_tests.md, S120_tests.md, S121_tests.md, S122_tests.md, S123_tests.md
PENDING nema redak za: 0        redak postoji, ali bez ✅/⬜: 0
```

⚠ **Protuprovjera je bila obavezna i uhvatila je regresiju u samom popravku.** Prva
verzija podrške za spojeni oblik `T-S123-1/-2` poništila je sama sebe: provjera „je li
ćelija samo ID-evi ili proza" radila je nad tekstom **iz kojeg fragment `/-2` još nije
maknut**, pa je ostajala gola `2`, ćelija je ispadala proza i **oba** ID-a su se gubila.
Vidjelo se samo po tome što je S123 ostao `3 bez retka` umjesto `1`.

⚠ **Broj otvorenih testova je narastao 20 → 22 i to je ISPRAVAN smjer.** Retci oblika
`✅ u kodu · ⬜ provjera traži deploy` sada se čitaju kao **otvoreni** (⬜ pobjeđuje ✅ u
istom retku). Prije su bili nevidljivi, pa je popis izgledao kraći nego što posao jest.

**Pad bi izgledao ovako:** `Za arhivu` broji sesiju u kojoj `⬜` postoji, ili
`bez oznake` ostaje veći od nule a verdikt svejedno kaže `DA`.

---

## T-S137-2 ✅ PROD ima kolonu `Račun` (zatvara `T-S119-8`)

`T-S119-8` je od S119 stajao kao „TEST je upisan, **PROD nije**". Izmjereno 15.09.2026.:

```
data-prep_tools\Tools\run.bat data-prep_tools\Financije\set_list_columns.py ^
    --env prod --area de8662e6-54f7-4ded-ab42-a786e7456067 --show
```

```json
{ "role": "attr", "label": "Račun", "slugs": ["racun"], "width": "w-32", "mobile": "line1",
  "map": { "Sašin tekući RF": "RF", "Kokin tekući ZABA": "ZABA" } }
```

Dakle kolona **i kratice** su na PROD-u; upisane su negdje između S119 i danas, a redak je
ostao otvoren. Isti razred kao `BUG-S114-REPORTDD` (S136): **posao zatvoren usput ostaje
otvoren dokle god ga netko ne izmjeri**, i troši pažnju svake iduće sesije.

⚠ Zatvoreno **čitanjem PROD-a**, ne pretpostavkom da je deploy to ponio.

---

## T-S137-3 ✅ CLAUDE.md: indeks + razdvojeno pravilo od plana

**Korak 1 — indeks.** Nije ručna tablica nego generator
(`data-prep_tools/Tools/claude_index.py --write`), jer indeks koji laže o broju retka
gori je od nikakvog.

⚠ **Prva verzija je lagala.** Brojeve je računala nad fileom **bez** indeksa, pa su bili
pomaknuti za njegovu duljinu. Sad ide u dva prolaza, uz `assert` da je duljina stabilna.
Isti razred kao S129: *brojka mora opisivati file koji izlazi, ne onaj iz kojeg se računa.*

**Korak 2 — razdvajanje.** Dvije „kvarljive" sekcije (324 retka) nisu bile plan:
unutra je **39 `⚠` pravila**. Bulk move bi ih izvukao iz uvijek-učitanog filea.

| | prije | poslije |
| --- | ---: | ---: |
| `CLAUDE.md` | 2.514 | 2.412 (uklj. +34 indeks) |
| Financije sekcije | 324 | 187 (samo pravila) |
| `docs/FINANCIJE_STATUS.md` | — | 176 |

⚠ **Četiri odlomka su ručno spašena** jer je grep pokazao da nemaju kopiju **nigdje**:
`skupna naplata se NE sintetizira` · `opis mora ostati strojni tekst izvatka` ·
`izvodi su samo PDF` · `provjera mora biti mehanička`.

**Dokaz protiv `HEAD`, ne protiv sjećanja:**

```
1. ⚠ redaka u HEAD: 330   izgubljenih: 0
2. indeks: 18 naslova, netocnih 0
3. ## Critical rules  netaknuta: True
3. ## Zamke           netaknuta: True
```

**Pad bi izgledao ovako:** `izgubljenih > 0`, ili `Critical rules netaknuta: False`.

---

## T-S137-4 ✅ MC košara 11.09. — apply + kontrola

```
primijeni_uskladu.py --apply   ->  69 ispravaka / 0 dopuna / 2 brisanja
uskladi_izvod.py (ponovo)      ->  48 POTVRĐENO / 0 ZA ISPRAVAK
promet_check.py                ->  ✓ 27 / ✗ 5   (NEPROMIJENJENO)
```

⚠ **Kontrola nije „prošlo je bez greške" nego `promet_check` koji se NIJE pomaknuo.**
MC retci ne diraju tekući račun; da se brojka promijenila, nešto je ušlo s `Izvor = Racun`.

⚠ **Ono što je blokiralo — riješilo je vrijeme, ne odluka.** `Provjeri` formula glasi
`Status ≠ Planiran AND dospijeće > TODAY()`. S130 je mjerio 07.09., dospijeće `11.09.`
bilo je u budućnosti ⇒ 46 lažnih upozorenja. Na 15.09. je košara **zatvorena** ⇒ nula.
Odluka o modelu (`T-S130-9`) ostaje otvorena za **buduće otvorene** košare.

---

## T-S137-5 ✅ `Tip`/`Podtip` za 15 redaka košare

Alat: `data-prep_tools/Financije/fix_tip_podtip_S137.py` (dry run zadano).

```
upisano polja: 30   ·   provjera nakon citanja: SVE SE SLAZE
ponovni dry run: 0 za promjenu     (idempotentno)
```

Trinaest vrijednosti je **prebrojano iz povijesti**, tri je odlučio Saša.

⚠ **`AUDIBLE` je razriješen DRUGOM RAZINOM.** Po trgovcu 51:13 za `Audible_Sasa` —
ispod praga; kartica ne pomaže (svih 64 su Mastercard). **Iznos pomaže:** Kokini
`2,55–8,99`, Sašini `13,57–18,65`, redak je `16,82`.

⚠ **`PAYPAL *BANDIFY BANDIF` namjerno ostaje `N/A`** — pitanje za Koku. Pogođen `Tip`
u podacima izgleda **identično** izmjerenom, i sljedeći mjesec postane „presedan".

⚠ **Dva retka su izgledala kao duplikat a nisu** (`LUFTHAN…447` / `…448`, isti dan,
isti iznos). Dokaz je **broj transakcije na izvodu**, ne sličnost opisa — v. „Critical rules".

---

## T-S137-6 ✅ `skriveno ✕` sakriva samo to polje

Sašin nalaz: polje otkriveno klikom na ime **nije se dalo zatvoriti** — „Hide again" je
na dnu forme i **sve-ili-ništa**.

**Koraci:** Add Activity (`Financije_all > Transakcija`) → klikni `Izvod opis` u sažetoj
liniji → polje se otvori s oznakom **`skriveno ✕`** → klikni oznaku → **samo to polje**
nestaje, ostala otkrivena ostaju.

⚠ **Polje otkriveno preko „Show all" mora ostati OBIČAN NATPIS `skriveno`**, bez `✕`.
Ono nije u `revealedIds`, pa bi mu „sakrij" bio **tihi no-op** — klikneš, ništa se ne
dogodi, nigdje ne piše zašto. Ondje je kontrola „Hide again".

**Pad:** `✕` se pojavi i na poljima iz „Show all", ili klik na njega ne napravi ništa.

**Izvedeno 15.09.2026. na PROD-u** (`dev:prod`, `Financije_all > Transakcija`):
otvorena **dva** polja (`Izvod opis` + `Valuta`), klik na oznaku `Izvod opis`a sakrio
**samo njega** -- `Valuta` ostala otvorena. Polja otkrivena preko Show all nose natpis
**bez** ✕. Oba dijela prosla.

/!\ **Dva polja, ne jedno -- inace test ne bi mogao pasti.** Stari Hide again je
sve-ili-nista, pa bi s jednim otvorenim poljem klik izgledao ispravno i pod starim
ponasanjem. Isto pravilo kao S129 (`T-S127-9`): redak se bira tako da se RAZLIKUJE
od ocekivanog rezultata.
