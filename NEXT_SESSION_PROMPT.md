> Pisano protiv commita **`3380459`** (S149) + commit S150 koji nosi ovaj file (samo docs).
> ⚠ Ako `git log` pokazuje noviji commit od S150, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S150 (2026-09-26)

---

# DIO 1 — netehnički (za Sašu)

## Što je danas napravljeno

1. **Prolaz kroz cijeli backlog.** Svaka stavka ima odluku i jednostavan opis:
   `docs/sessions/BACKLOG_2026-09-26.md` (sekcija „Odluke" na vrhu). Gotove stavke su
   izbačene iz CLAUDE.md-a.
2. **Izvodi više ne idu preko WhatsAppa.** Koka ima OneDrive mapu `Izvodi`, dijeljenu s tobom;
   kod tebe je na disku u `C:\0_Sasa\OneDrive\Izvodi` (uvijek lokalno). Test PDF je stigao.
3. **`trening.xlsm` je u OneDriveu** (`C:\0_Sasa\OneDrive\`), s AutoSaveom i povijesti verzija.
   Stara kopija na `C:\0_Sasa\` je preimenovana — ne otvaraj nju.

## Što treba od tebe / Koke

- **Koka:** instalirati OneDrive na mobitel (svoj račun, **bez** backupa fotografija), pa ZABA
  izvod slati *Podijeli → OneDrive → Izvodi*. RF na laptopu: *Save as PDF* u `OneDrive\Izvodi`.
- **Ti:** provjeri ima li RF aplikacija **gotov PDF izvod** (stavka „Izvodi") — bolji od
  *Save as PDF*. I zatraži novi **Garmin export** (tvoji podaci završavaju prerano).
- **Koka, OneDrive Desktop ima crveni ✕** (greška sinkronizacije) — pogledati, možda se njena
  Excelica ne sprema u oblak.

## Tvoj redoslijed — što slijedi

1. **B1 + B2** — Structure uvoz: brojila koja lažu + alat koji briše podtipove.
2. **C1** — izvodi od inboxa do žiga; **prvi korak razvrstavač** (preimenovanje po sadržaju).
3. **C2 + C3** — točni datumi rata; `Datum naplate` prati promjenu datuma u Editu.
4. Ostatak B (Help zna Areu, pitanje prije bacanja izmjena, sitni ispravci podataka, `—` dok se učitava).
5. Zatim: C4 performanse, D-sitnice, F4 filtar za brojeve, C5 „Dospjelo → potvrdi",
   pa **migracija `trening.xlsm`** kao sljedeći veliki projekt.

---

# DIO 2 — tehnički (za Claudea)

## Stanje grana

`main` = `515df05` (S149 deploy). `test-branch` = S150 commit (samo docs; nema deploya potrebe).

## S150 promjene (bez koda)

- CLAUDE.md backlog očišćen; izbačeni tekst doslovno u `DONE_HISTORY.md` § S150.
- Nova stavka na vrhu backloga: popis novih/preformuliranih stavki iz prolaza.
- Open bugs: VIEWSTALE i BUG-1 zatvoreni; „bulk delete" zamijenjen D2 (pokus na TEST-u).
- Memorija: `izvodi_onedrive_inbox.md` (putevi OneDrive/trening).

## Otvoreno — iz handoffa S149, i dalje vrijedi

- ⭐ `make_financije_all_structure.py` **ne pokretati** dok taksonomija ne dolazi iz `--base`.
- 1 loš par `Hlace i carape` `Razno / Poklon`; rata 1/6 `117,32` (atribut 19,57 / komentar 19,55);
  MC par `+105,30 / −105,30` `Planiran` — B5, jedan roundtrip.
- E8-2: treba trace pada, ne novu hipotezu.
- Razvrstavač: testni ne-izvod već leži u inboxu (PBZ „Detalji transakcije") — mora ga odbiti.
  Imena izvoda: `PBZVISA_`/`PBZVIZA_` nered — razvrstavač ga gasi.
- Preimenovanje `Financije_all` → `Financije`: odluka **nakon C1** (alati pišu ime Aree u Excel).
