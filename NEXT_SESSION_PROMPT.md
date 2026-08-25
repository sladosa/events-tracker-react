# NEXT SESSION PROMPT — nakon S119 (uska lista popravljena, čeka deploy)

**Pisan protiv commita `5d0af14`** (+ commit zatvaranja S119 koji slijedi odmah iza).
Ako `git log --oneline -1` pokazuje nešto puno novije, čitaj ovo kao povijest; `CLAUDE.md` je autoritet.

**Stanje grana:** `main` nosi S108–S117 (pushano 24.08.). `test-branch` je ispred za S118
(dokumentacija + SQL) i S119 (**prve promjene koda nakon migracije**).
⚠ **Deploy nije napravljen** — Koka na PROD-u još ima staru listu.

> S119 je bio dan mjerenja. Prva dijagnoza bila je točna u mehanizmu i **opovrgnuta** prvim
> pokusom, jer je mjeren krivi element. Popravak je krenuo tek kad se broj poklopio sa slikom.

---

# DIO 1 — Jednostavnim rječnikom (za Sašu)

## 1. Što je gotovo

**Lista na mobitelu više ne bježi ustranu.** Iznos stoji uz desni rub, odmah lijevo od ⋮.

Izmjereno u pravoj aplikaciji (ne na oko): tablica je bila **709 px u 367 px prostora** —
iznos je stajao 342 px izvan ekrana. Sada je **367 / 367**. Snimke prije/poslije su u
`Claude-temp_R/S119_lista_prije.png` i `…_poslije.png`.

Uz to, sve po tvom izboru:

- **kratica računa** u gornjem redu (`ZABA`, `RF`), sitno i sivo kao druga linija
- **opis se prelama u dva reda** umjesto da bježi ustranu
- **kratki datum** `25.08. ut`; **godina se pojavi sama** kod lanjskih redaka (`25.08.25. po`)
- **dvostrani iznos** (`Anja 73/96`) složi se u dva reda — obje strane ostaju vidljive

Kratice žive u konfiguraciji, ne u kodu, i prolaze kroz Excel (`ListColumns` → kolona `Map`).
Račun koji nema kraticu prikaže se **punim imenom** — namjerno: to se vidi, a pogođena
kratica bi mogla pokazati krivi račun i to se **ne bi** vidjelo.

## 2. Što stoji na tebi

1. **Odluka o deployu.** Koka ovo neće vidjeti dok `main` ne ode na Netlify. Ja to ne radim
   bez tvoje riječi. Kad kažeš, u isti deploy ide i **BUG-S118-PREVIEWMODE** (jedan argument,
   čekao je baš da migracija prođe).
2. **Provjera na telefonu** nakon deploya — 7 kratkih testova, `T-S119-1…7`, detalji u
   `docs/sessions/tests/S119_tests.md`. Najvažnija su prva tri: iznos bez scrolanja, kratica
   računa, i redak `Anja 73/96` (25.08.2025.) gdje moraju ostati **obje** strane iznosa.
3. **Nakon deploya upisati kolonu `Račun` na PROD** — TEST je upisan, PROD nije.
4. Ono iz S118 što i dalje stoji: reći Koki za retke s krivom godinom (`2036-04-08`,
   `2028-05-16`), `07.08. Parking 1,60`, i 5 spornih lipanjskih redaka (Σ `373,11`).

## 3. Dvije nove stvari koje si prijavio (zapisane, nedirane)

Oboje je zapisano u `CLAUDE.md` i čeka sljedeću sesiju — ovdje ukratko:

**a) Filter se gubi pri povratku iz View Details.** Uđeš u tablicu s Overview pločice
(filtriran je `Racun`), otvoriš jedan redak da ga pogledaš, vratiš se — i lista pokazuje
**sve račune**. Konfuzno je jer si samo htio pogledati redak, a izgubio si pogled u koji se
vraćaš. Zapisano kao **BUG-S119-FILTERBACK**, **neprovjereno**: sve `/app/*` rute dijele
jedan filter, pa se stanje ne bi *trebalo* gubiti — najvjerojatnije ga briše ponovno
učitavanje filter panela. Isti razred kao onaj raspon datuma iz S111 koji se „povremeno
resetirao", a resetirao se zapravo uvijek. **Prvo mjerenje, pa popravak.**

**b) Shortcuts — toggle po Arei.** Popis je predugačak da bi bio koristan. Ideja: toggle u
Filter panelu koji pokaže samo shortcutove **odabrane Aree**; isključen toggle ostavlja one
napravljene s isključenim togglom. Oni iz Add Activity po prirodi pripadaju Arei.
Zapisano u backlog uz dva pitanja koja treba razriješiti prije koda (nose li stari
shortcutovi uvijek `area_id`, i što „globalan" znači kad se Area promijeni).

## 4. Što bi mogao primijetiti

Vodoravno povlačenje liste **više ne postoji**. Dosad si tako čitao kraj dugačkog opisa; sada
se opis prelama u dva reda, a ako ni to ne stane, kraj dobije `…` (puni tekst je u ⋮ → View
Details). Ako ti to smeta kod jako dugih opisa, reci — ima alternativa.

---

# DIO 2 — Tehnički (za Claudea)

## 1. Prvo pročitaj

`docs/sessions/DONE_HISTORY.md` **S119** · `CLAUDE.md` → prošireni blok
**„Kolone Activities liste"** (tri nova pravila) · `docs/sessions/tests/S119_tests.md`.

## 2. Što je dirano

| file | što |
| --- | --- |
| `ActivitiesTable.tsx` | `w-full max-w-0` na mobilnoj ćeliji · `line-clamp-2` na liniji 2 · `cellContent(c, 'desktop'\|'line1'\|'line2')` · `PairCell stack` · `AttrCell map/plain` |
| `useActivities.ts` | nov `formatDateCompact()` — `formatDate` **netaknut** (desktop) |
| `types/database.ts` | `ListColumn.map?: Record<string,string>` |
| `structureExcel.ts` / `structureImport.ts` | kolona `Map` u `ListColumns` sheetu (+ HELP redak) |
| `set_list_columns.py` | kolona `Račun` + `RACUN_MAP` · `--env test\|prod` · `--area` · ispis vrijednosti bez kratice |

`npm run typecheck && npm run build` prolaze. TEST baza je **upisana** (`--write`), PROD nije.

## 3. Zamke iz ove sesije (šire od nje)

- **Kad jedan smjer ima `overflow: auto`, drugi prestaje biti `visible`.** Pravi horizontalni
  scroller bio je **unutarnji** `div.overflow-y-auto`, ne `div.overflow-x-auto` iznad njega —
  zato je prvo mjerenje reklo „nema scrolla" nad listom koja očito scrolla.
- **Harness nije dokaz dok se ne poklopi sa stvarnošću.** Pojednostavljena replika dala je
  „bez scrolla"; puna je dala 490 px; prava aplikacija 709 px. Mjeri u aplikaciji kad god je
  moguće — `git stash` daje pošten prije/poslije nad istim podacima.
- **Backslash sekvence se gube kroz shell** (`\n` u patch skripti postane pravi novi red).
  Isti razred kao backtickovi (S118) i `git commit -m` (S117). Piši patch u file pa ga izvrši.
- **TEST račun `owner@test.com` ne vidi `Financije_all`** (druga vlasnica) i njegova
  `Financije` area je prazna — svaka provjera koja treba te podatke ide ručno, s telefona.

## 4. Prvo što bih uzeo sljedeći put

1. **Deploy** (kad Saša kaže) + **BUG-S118-PREVIEWMODE** u istom paketu.
2. **Faza 3 — `set_attribute` na Import putu** („popuni ako je prazno"). Jedna rupa drži tri
   featurea; s Kokom koja radi kroz app i roundtrip, sad je najpraktičnija.
3. **Faza 2 — brzi unos** (skupljanje prefilanih polja, shortcut dropdown).

⚠ I dalje vrijedi: **batch 2024 i 2023 idu na PROD**, i to je okidač za preimenovanje
`Financije_all` → `Financije` (rename **kroz UI**, nikad importom — v. CLAUDE.md backlog).
