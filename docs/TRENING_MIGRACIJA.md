# TRENING_MIGRACIJA — `trening.xlsm` → aplikacija

> **Status:** analiza i prijedlog, **bez koda i bez upisa u bazu** (2026-10-19, paralelna sesija uz S175).
> **Zamjenjuje** `docs/Diary.md` (strategija od 04.07.) kao **jedini** plan migracije treninga
> (CLAUDE.md § Strategic Position, korak 3). Preusmjeravanje uputnica (`Diary.md`,
> `AUTOMATION_SPEC.md` Faza 4, `DATA_PIPELINE_PLAN.md` Prioritet 5, BACKLOG, `MIGRATION_STATE.md`)
> **nije napravljeno u ovoj sesiji** — drugi prozor mijenja te dokumente. Ide u sljedeću sesiju.
>
> **Izvor:** `C:\0_Sasa\OneDrive\trening.xlsm` (OneDrive, živi file — **nikad ga ne otvarati za
> pisanje**). Sve brojke ovdje izmjerene su na **kopiji** `Claude-temp_R/trening/trening.xlsm`
> od 19.10.2026., čitanjem `openpyxl`-om (formule **i** keširane vrijednosti).
> ⚠ Brojke su **kontrolni zbrojevi za uvoz**: kad TEST uvoz prođe, broj eventa i popunjenost
> po atributu moraju se poklopiti s §1 — inače je generator nešto tiho izgubio.

---

## 0. Ukratko

- **DIARY je čišći nego što je `Diary.md` pretpostavljao**: točno **jedan redak po danu** od
  29.05.2006. do danas, **bez rupa i bez duplikata** (+ dvije utrke iz 2005.) — 7.451 dan do
  19.10.2026. Identitet „datum + fiksno vrijeme" je zato besplatan.
- **Ali kolone su mijenjale značenje**, i to u **izmjerenim, oštrim rezovima**: `I` je do
  02.2014. bio *napor/zona*, od 22.12.2014. *raspoloženje*; `O` je do 2015. slobodna bilješka, od
  2016. strukturiran zapis s Garmina (`HR 110(134), t.ef.2,3/0 394kcal, opt35`, 98–100 % retka);
  `N` je do 2023. oznaka dana (G.O., P.H.), od 07.2024. broj koraka.
- **Od 126 kolona trening nosi ~15.** Ostalo su: izvedene formule (tjedni sažeci, tempo,
  brojači), **privatni dnevnik** (`AM`, 2016.→, od 2024. s prefiksom san % / HRV / body battery),
  **posao** (`AP`–`DQ`, 2016.–2025., zatvoren skup) i **osobni projektni log** (`DS`, 2023.→ —
  `P5` je upravo ovaj projekt).
- **Prijedlog:** privatna Area `Dnevnik` s L1 leafovima `Trening` (1 event/dan, svi dani) i `Dan`
  (zdravlje + privatni zapis, samo dani sa sadržajem); posao i projekti su **odluka opsega**, ne
  dio prvog uvoza. 17 pitanja u §5 — prva tri su identitetska i blokiraju generator.

---

## 1. Inventar (izmjereno)

### 1.1 File

| | |
| --- | --- |
| Veličina | 17,1 MB, 15 sheetova, svi vidljivi |
| Makroi | `xl/vbaProject.bin` 51 KB. Po imenima u binarnom streamu (`Training_Menu`, `SelectToday`, `SelectRowNo`, `TimeInCell`, `copyRow`, `Unhide_Ungroup`, `Auto_open`) — **navigacija i izbornik**, ne logika podataka. ⚠ Nije dekompilirano; zaključak je iz identifikatora |
| Imenovani rasponi | `TrainData = DIARY!A21:M7535`, `SDiary = A21:O3525`, `todaycell = C17`, `RowNoCell = C13`, `HRz`, `mileKm` |
| Zamrznuto / filtar | freeze `AL7455`, autofilter `A21:T7535` |

### 1.2 Sheet `DIARY` — oblik

- **Retci 1–20 su kontrolna ploča, ne podaci:** tablica HR zona (`B2:K6` ← sheet `HRZone`),
  brojači (današnji redak, ukupno km, km/tjedan), legenda projekata `P1–P8` (`DS9:DT17`),
  metapodaci poslovnih projekata (`CG7:DL20` — šifra, klijent, broj naloga, opseg, ljudi,
  početni/završni redak, planirani/stvarni sati, razlika, status).
  ⚠ **Redak 20 nosi STARA zaglavlja** (`H = HR`, `I = Exert.`) — dokaz da je `I` nekad značio
  nešto drugo (v. §1.4).
- **Redak 21 je zaglavlje**, podaci od retka 22.
- **7.513 redaka s datumom:** 09.10.2005. i 13.11.2005. (dvije utrke), pa **neprekinuto**
  29.05.2006. → 20.12.2026. Datumi strogo rastu, **0 duplikata, 0 rupa** nakon 29.05.2006.
  Od toga **7.451 do danas** (19.10.2026.) i **62 unaprijed pripremljena buduća retka** (imaju
  samo `F = 0:00` i jedan `DS`) ⇒ **ne uvoze se**.
- Datum (`C`) je u 5.852 retka formula `=C(prethodni)+1`, dan u tjednu (`D`) `=WEEKDAY`.

Redaka po godini: 2005: 2 · 2006: 217 · 2007–2025: 365/366 · 2026: 292 do danas (+62 buduća).

### 1.3 Kolone — što nose (redci do 19.10.2026.)

**Trening (jezgra)**

| Kol. | Zaglavlje | Popunjeno | Što je izmjereno |
| --- | --- | ---: | --- |
| `A` | Period | 7.451 | **47 trenažnih blokova** (`00 - prvi polumaraton` … `44 - popustilo koljeno`, od 21.02.2021.); formula `=A(prethodni)` |
| `E` | Length (km) | 4.275 | 532 su formule tipa `=5+3`; 2010–2020 ~300/god, 2022–2026 30–70/god |
| `F` | time | 7.446 | **5.068 ≠ 0:00**; 2.378 je `0:00` (ODMOR 872, SICK 214, prazan K 920…) |
| `G` | pace | 7.423 | **formula** `=F/E` u 7.411 redaka ⇒ izvedeno |
| `H` | HR | 812 | 2006–2011 brojevi (~500), 2013. i 2016. zone `z1–z5`, 2015. brojevi |
| `I` | Mood | 4.261 | **dvije ere** (§1.4): do 02.2014. zone/brojevi, od 22.12.2014. smajlići `:-)` 2.309 · `:-|` 794 · `:-D` 103 · `:-/` 78 · `:-(` 42 |
| `J` | Intensity | 5.714 | **čisto, 5 vrijednosti:** light 2.329 · hard 1.452 · moderate 1.247 · RACE 349 · recovery 337 |
| `K` | Activity type | 4.654 | 51 vrijednost (48 bez razlike u veličini slova) — mapiranje u §3.4 |
| `L` | Terrain | 4.260 | **čisto, 3 vrijednosti:** ravno 2.413 · valovito 943 · brda 904 |
| `M` | Comment | 7.097 | glavni opis; od 2024. često počinje vremenom (`9:00 …`, `16h …`) — 128 / 194 / 194 redaka 2024/25/26 |
| `O` | HR_comment | 3.434 | **dvije ere** (§1.4); od 2016. strukturiran Garmin zapis |
| `P` | p | 569 | 2007–2015 faza/stanje (`baza`, `zavrsnica`, `tapering`, ozljeda, bolovanje, G.O.); 2018–2021 ~30 brojeva |
| `X` | Teka | 7.451 | **33 vrijednosti `t-025` … `t007`, strogo uzastopna razdoblja** od 81 do 465 dana, bez preklapanja (`t007` od 13.06.2026.) |

**Dan / zdravlje / privatno**

| Kol. | Zaglavlje | Popunjeno | Što je izmjereno |
| --- | --- | ---: | --- |
| `N` | GO | 1.310 (+6.097 `.`) | 2015–2023 oznaka dana (G.O., P.H., „free - Corona", 2016. smajlići); **od 07.2024. koraci** `11,1kk` — 728 redaka, 2025. 363/363 |
| `AL` | — | 816 | brojevi **39–52**, od **25.07.2024.**, gotovo svaki dan |
| `AM` | Private comment | 3.359 | od 2016.; **prefiks** `NN%` (san) 2023. 133/360, 2024.→ ~100 %; `NN HRV` 2024.→; `bb NN` (body battery) 2024.→ (2025.: 364/365) |
| `AN`, `AO` | — | 127 / 184 | rijetke oznake od 2022. (tjedan `w44`, lijek, P.H., grad) |
| `DR`, `DT`–`DV` | — | 10 / 29 / 10 / 9 | rijetke bilješke 2023–2026 |

**Posao (zatvoren skup — `AQ` završava 2025.)**

| Kol. | Zaglavlje | Popunjeno | Što je izmjereno |
| --- | --- | ---: | --- |
| `AP` | office | 357 | 2021–2025, brojevi (sati?) i oznake |
| `AQ` | Work comment | 2.569 | 2016–2025, slobodni tekst |
| `AT`–`CB` | (projekti) | ~900 ćelija | **sati po projektu po danu**, 2022–2024, 32 kolone; svaka kolona ima metapodatke u `CG`–`DL` (veza je zapisana: `CG13 = "AV"` itd.) |
| `CD`, `CE` | — | formule | dnevni / tjedni zbroj sati ⇒ izvedeno |
| `CF` | — | 64 | 2022–2024 bilješke i brojevi |
| `DM`–`DQ` | — | ~110 | 2023–2025 brojač: `DQ = DQ(preth.) + DP − DO` (`DO` gotovo uvijek 20) |

**Osobni projekti**

| Kol. | Zaglavlje | Popunjeno | Što je izmjereno |
| --- | --- | ---: | --- |
| `DS` | PROJEKTI: | 545 | 2023: 23 · 2024: 11 · 2025: 224 · 2026: 287; oblik `P5 - tekst` u 185/224 (2025.) i 216/286 (2026.); legenda `P1–P8` u `DS9:DT17` (P5 = AI / vibe coding — ovaj projekt) |

**Izvedeno ili smeće — ne uvozi se**

`B` (period-tjedan), `C`→`event_date`, `D`, `G`, `Q` (intenzitet u broj), `R` (vrijeme trčanja),
`S`–`V` (tjedni sažetak svakih 7 redaka — 1.064 tjedna, s `#DIV/0!`/`#VALUE!`), `W` (7.513 `.`),
`CD`, `CE`, `DQ`. Kolone `Y`–`AI` (2013–2016, ≤ 262 ćelije po koloni, mješavina bilješki,
programa trenera i formula s `#VALUE!`) — v. pitanje Q15.

### 1.4 Ere — gdje je kolona promijenila značenje

| Kol. | Era 1 | Era 2 | Rez |
| --- | --- | --- | --- |
| `I` | 2006 – **02.02.2014.**: zone `z1–z5` (~470) + brojevi (~440) — stari naslov `Exert.` | **22.12.2014.** →: raspoloženje, 5 smajlića | 10 mjeseci prazno između |
| `O` | 2006–2014: slobodna bilješka o danu (~515) | 2015.→: `t.ef` (97 %), 2016.→ `HR a(b)` (98–100 %), `kcal` 2016.→, `VO2max` 2015–2021, `opt` 2022.→ | 2015. prijelazna |
| `H` | 2006–2011 brojevi (puls) | 2013. i 2016. zone | rijetko u obje |
| `N` | 2015–2023 oznaka dana | 07.2024.→ koraci `NN,Nkk` | čist rez |
| `AM` | 2016–2022 čisti tekst | 2023.→ san %, 2024.→ + HRV + bb | prefiks uvijek na početku |
| `K` | 2006–2021: prazan K + km = trčanje (2.493 retka) | 2021.→ K gotovo uvijek popunjen | nakon ozljede koljena (blok 44) trčanja skoro nema |

### 1.5 Ostali sheetovi

| Sheet | Redaka | Što je | Prijedlog |
| --- | ---: | --- | --- |
| `Krv` | 161 | nalazi krvi + zdravstveni događaji, **2003.–2026.** | Q16 — preklapa li se s `Bloodwork.xlsx` (već u `Health_Saša`, S68/S74) |
| `trkaceDionice` | 2.634 | planovi treninga po dionicama, 2011–2018 | ostaje u Excelu (alat za planiranje, ne zapis) |
| `Snaga` | 56 | popis vježbi snage | izvor za `suggest` opcije, ne uvoz |
| `HRZone`, `MAF`, `RunFormula` | — | kalkulatori (zone, MAF, Daniels) | ne |
| `Janko` | 42 | trenerov program 2015/16 | ne |
| `Pivot` | 147 | pivot nad DIARY | ne (izvedeno) |
| `LinksA` | 94 | **„ORGANIZACIJA DNEVNIKA (staro)"** — Sašin raniji model (v. §2) + bilješke | čita se kao input za model |
| `ToDo`, `Starship`, `staz`, `LinksP` | — | nevezano uz trening | ne |

---

## 2. Usporedba s `Diary.md` (04.07.)

| `Diary.md` tvrdi | Izmjereno | Posljedica |
| --- | --- | --- |
| ~7000 redaka, od ~2015 | **7.451 dan od 29.05.2006.** (+2 iz 2005.) | 20 godina, ne 10 |
| 1 redak = 1 dan = 1 event | ✅ potvrđeno — 0 duplikata, 0 rupa | identitet je siguran |
| `H` → `hr` | `H` ima **812** redaka; puls je u `O` (2016.→) | izvor pulsa je `O` |
| `I` Mood, „normalizirati" | **dvije ere s različitim značenjem** | dva atributa ili odbaciti eru 1 (Q5) |
| `O/P` = HR/kcal/opt | `O` da (od 2015/16), **`P` je faza/stanje**, ne puls | `P` je zaseban atribut |
| `pace` kao text atribut | `G` je **formula** `=F/E` | izvedeno — Q11 |
| `t_ef` ostaviti text | `t.ef.2,3/0` u 97–100 % redaka, uvijek isti oblik | dva broja (Q6) |
| Korak 0: batch INSERT prije uvoza | **već napravljeno u S104** (`excelImport.ts`, Q3 Fable) | korak otpada |
| Projektni sati = vlastiti leaf | ~900 ćelija, 2022–2024, s metapodacima; posao završio 2025. | zatvoren skup, odluka opsega (Q13) |
| `AM` = privatni dnevnik | ✅, ali od 2023/24. nosi **strukturiran prefiks** (san, HRV, bb) | brojevi se mogu izvući — Garmin GDPR export ih **nema** (`MIGRATION_STATE.md`) |
| `AL (52,7% …)` nepoznato | `AL` = broj 39–52 od 25.07.2024. | Q7 |
| — (nije spomenuto) | `A` = **47 trenažnih blokova**; `X` = 33 uzastopna razdoblja | dva korisna atributa |
| Privatna Area, ne `Health_Saša` | ✅ vrijedi — `AM` je privatan | — |
| Tjedni sažeci se ne uvoze | ✅ `S`–`V` su formule | — |

**Sašin stari model iz `LinksA`** („Struktura baze") vrijedi pročitati prije odluke: već ima
`Category → Sub-cat1 → Sub-cat2 → Sub-cat3` (`sport → run → hard → fartlek`,
`sport → run → RACE → liga Jaska`, `sport → SICK → injury`, `work → calculation → fittings`) i
predviđa `Mood-immediate` i `Mood-hindsight` kao **1–5**. Prijedlog u §3.4 slijedi tu hijerarhiju.

---

## 3. Predloženi model

### 3.1 Area i leafovi

```
Dnevnik (Area — privatna, nikad se ne dijeli)
├── Trening (L1 leaf)   1 event za SVAKI dan 29.05.2006. → danas (+2 iz 2005.) = 7.451
└── Dan     (L1 leaf)   1 event samo za dan koji ima sadržaj (AM / N / AL / AN / AO …), ~3.500
```

- **L1 leafovi, bez međurazine** ⇒ nema P2 roditeljskih eventa (isto kao `Financije_all >
  Transakcija`). P1 je ispunjen trivijalno (atributi na leafu); P3 vrijedi za roundtrip ispravke.
- **Zašto dva leafa, a ne jedan** (kako je predlagao `Diary.md`): trening i dan imaju različite
  potrošače — lista kolona, filtar i buduće pločice za trening ne smiju se miješati s 3.000+
  privatnih zapisa. Privatnost je po Arei, pa su oba leafa jednako zaštićena.
- **Zašto `Trening` nosi i dane bez treninga** (ODMOR 936, SICK 352, prazni 270): bez njih se
  raspada tjedna analiza i rekonstrukcija tablice (`Diary.md` §2.1 — vrijedi i dalje).
- Posao i projektni log **nisu** u prvom uvozu — v. Q13, Q14.

### 3.2 Identitet

- `session_start` = **datum + fiksno lokalno vrijeme**, generator ga piše kao **tekst `HH:MM`**
  (CLAUDE.md § Excel, rupa (a)). Prijedlog **06:00 za oba leafa** (Q2) — različite kategorije se
  ne sudaraju (`useActivities` grupira po user + kategorija + `session_start`).
- Vrijeme iz `M` (`9:00 CleverFIT …`) **ne ulazi u identitet** — popunjeno je tek od 2024. i
  nedosljedno. Ako treba, ide u zaseban atribut (nije u prijedlogu).
- Ponovni uvoz istog raspona ⇒ kolizija / UPDATE, ne duplikat. Generator je zato slobodno
  ponovljiv dok se identitet ne mijenja.

### 3.3 Atributi — `Trening`

| Slug | Tip | Izvor | Pravilo |
| --- | --- | --- | --- |
| *(comment)* | — | `M` | doslovno |
| `period` | text + suggest (47) | `A` | keširana vrijednost formule |
| `vrsta` | text + suggest | `K` (+ prazan K) | §3.4 |
| `podvrsta` | text + suggest, `depends_on: vrsta` | `K` | §3.4 |
| `intenzitet` | text + suggest (5) | `J` | doslovno |
| `teren` | text + suggest (3) | `L` | doslovno |
| `duljina_km` | number | `E` | keširana vrijednost (532 formule) |
| `trajanje_min` | number | `F` | h:mm:ss → minute; `0:00` ⇒ prazno |
| `raspolozenje` | text + suggest (5) — ili number 1–5 (Q9) | `I` | **samo od 22.12.2014.** |
| `hr_avg`, `hr_max` | number | `O` `HR a(b)` (2016.→) | regex; era `H` — Q5 |
| `te_aerobni`, `te_anaerobni` | number | `O` `t.ef.a,b/c` | `2,3` → 2.3 (Q6) |
| `kcal` | number | `O` | regex |
| `opt` | number | `O` (2022.→) | Q6 |
| `vo2max` | number | `O` (2015–2021) | regex (+ `AL`? — Q7) |
| `faza` | text | `P` | doslovno (2007–2015) |
| `teka` | text + suggest (33) | `X` | Q4 |
| `biljeska` | text | `O` **cijeli izvorni tekst** | uvijek, i kad je parsiran |

⚠ **`biljeska` čuva izvornik `O` uvijek** — parsirani brojevi su pogodnost, ne zamjena. Tako
sigurnosna mreža iz `Diary.md` §4 ne treba markere u komentaru: ono što regex ne prepozna i
dalje stoji u `biljeska`, a prazan broj uz pun `biljeska` je pretraživ filtrom.

### 3.4 `K` → `vrsta` / `podvrsta` (prijedlog, slijedi `LinksA`)

| `K` (n) | `vrsta` | `podvrsta` |
| --- | --- | --- |
| *prazno, uz km ili intenzitet* (2.527) | `trcanje` | — (intenzitet nosi `J`) |
| `long` 390 · `interval` 271 · `track` 257 · `tempo` 241 · `fartlek` 153 · `VO2max` 20 · `recovery` 5 · `MAFtest` 2 | `trcanje` | isto ime |
| `5K` 57 · `10K` 4 · `polumaraton` 49 · `maraton` 11 · `brdska trka` 13 · `liga …` (7 imena, 180) · `Puntijarka - Njivice` 11 | `trcanje` | ime utrke (uz `J = RACE`) |
| `x-TRAIN` 1.025 · `X-TRAIN` 144 · `X-TRAIN long` 1 | `x-train` | — |
| `snaga` 188 · `snaga-noge` 10 | `x-train` | `snaga` / `snaga-noge` |
| `bic` 40 · `TRAKA` 5 · `tempo erg` 3 · `orb TEST` 2 · `ORBITREK` 1 | `x-train` | `bicikl` / `traka` / `erg` / `orbitrek` |
| `setnja` 62 | `setnja` | — |
| `ODMOR` 936 | `odmor` | — |
| `SICK` 262 (uklj. `sick`) · 4 varijante `SICK …` 90 | `bolest` | `setnja` / dijagnoza |
| `ozljeda` 5 | `bolest`? | `ozljeda` |
| `putovanje` 29 · `obaveze` 14 | `putovanje` / `obaveze` | — |
| ⚠ `Z2` 124 · `HIIT` 23 · `istezanje` 20 | **Q10** | |
| *prazno, bez km i intenziteta* (270) | prazno | (većinom imaju `M`) |

Zbroj: 4.654 popunjenih + 2.797 praznih = 7.451 ✓. ⚠ **Taksonomiju zaključati PRIJE uvoza**
(lekcija Financija, S105d) — poslije ime živi i u `validation_rules` i u svakom retku.

### 3.5 Atributi — `Dan`

| Slug | Tip | Izvor | Pravilo |
| --- | --- | --- | --- |
| *(comment)* | — | `AM` | **cijeli** izvorni tekst |
| `san_pct` | number | `AM` prefiks `NN%` | 2023.→ |
| `hrv` | number | `AM` `NN HRV` | 2024.→ |
| `body_battery` | number | `AM` `bb NN` | 2024.→ |
| `koraci` | number | `N` `NN,Nkk` | × 1000 (Q8), 07.2024.→ |
| `al` *(radni naziv)* | number | `AL` | Q7 |
| `oznaka` | text + suggest | `N` era 1 (G.O., P.H., …) | 2015–2023 |
| `napomena` | text | `AN` + `AO` + `DR` + `DT`–`DV` | spojeno s ` / ` (Q15) |

### 3.6 Procjena obujma

`Trening` ~7.451 eventa i ~60.000 vrijednosti atributa; `Dan` ~3.500 eventa i ~10.000
vrijednosti. Red veličine kao `Financije_all` — batch po sesiji postoji (S104), uvoz po godinama
ostaje razuman oprez.

---

## 4. Što je jasno (predlažem bez pitanja)

1. **Jedan redak = jedan dan = jedan `Trening` event**, uključujući odmor i bolest.
2. **62 buduća retka i retci 1–21 se ne uvoze.**
3. **Izvedeno se ne uvozi** (§1.3, zadnji odlomak) — tjedni sažeci, `Q`, `R`, `CD`, `CE`, `DQ`.
4. **Keširane vrijednosti formula** su izvor (`E`, `A`, `C`). File je zadnji spremio Excel, pa
   su keširane — ⚠ generator mora **stati** ako naiđe na formulu bez keširane vrijednosti
   (file spremljen alatom koji ne računa), umjesto da je pročita kao prazno.
5. **Izvorni tekst se nikad ne gubi**: `M` → comment, `O` → `biljeska`, `AM` → comment `Dan`.
6. **Kontrola nakon TEST uvoza** = brojke iz §1 (7.451 eventa, `J` 5.714, `L` 4.260, `E` 4.275, …).
7. Lekcije Financija za generator: `Area` + `Category_Path` + e-mail u kol. G u **svakom**
   retku, `session_start` kao tekst, bez booleana.

---

## 5. Pitanja za Sašu

**Identitet — blokiraju generator**

- **Q1 — Area i leafovi.** `Dnevnik` s leafovima `Trening` i `Dan` (preporuka)? Ili drukčije ime
  (`Trening`, `Trening_dnevnik`)?
- **Q2 — Fiksno vrijeme `session_start`.** 06:00 za oba leafa (preporuka)? Odluka je zauvijek.
- **Q3 — Što poslije uvoza?** Nastavljaš li pisati `trening.xlsm` (⇒ generator mora biti
  ponovljiv za svaki novi raspon, i to je redovni posao), ili od datuma X unosiš u aplikaciju
  (⇒ jednokratan uvoz + Add forma / shortcutovi za `Trening` i `Dan`)? Mijenja koliko generator
  mora biti robustan.

**Značenje kolona — prije generatora**

- **Q4 — `X` „Teka"**: 33 uzastopna razdoblja (`t-025` … `t007`, 81–465 dana). Tenisice?
  Bilježnica? Ako tenisice — želiš li km po paru (onda je atribut koristan, inače je šum)?
- **Q5 — `I` prije 2014. i `H`**: što su brojevi u eri „Exert." (npr. 163, 387) i zone u `I`?
  Je li `H` 2006–2011 prosječni puls? Uvesti kao `napor` / `hr_avg` ili ostaviti samo u `biljeska`?
- **Q6 — `O`**: je li `t.ef.2,3/0` = aerobni / anaerobni training effect (onda dva broja)? Što je
  `opt` (2022.→)?
- **Q7 — `AL`** (39–52, od 25.07.2024.): što je? (VO2max? Stres? HRV?)
- **Q8 — `N` „11,1kk"**: tisuće koraka?
- **Q9 — Raspoloženje**: smajlići kao tekst ili broj 1–5 (kako je predviđao `LinksA`)? Broj daje
  prosjek po periodu, tekst čuva izvornik.
- **Q10 — `K`**: kamo `Z2` (124), `HIIT` (23), `istezanje` (20)? I je li dvorazinsko
  `vrsta`/`podvrsta` (preporuka, kao Tip/Podtip u Financijama) bolje od jedne liste?
- **Q11 — Tempo**: spremiti kao `pace` text `MM:SS` (kao `Fitness_Garmin`) ili ne spremati jer je
  izveden? (Preporuka: ne spremati — ispravak km bi ostavio krivi tempo.)

**Opseg — mogu i poslije**

- **Q12 — Brojevi iz `Dan`** (san, HRV, bb, koraci): u privatni `Dnevnik` (preporuka) ili u
  `Health_Saša > Daily_metrics` (dijeli se s Kokom)? Tekst `AM` je privatan u svakom slučaju.
- **Q13 — Posao** (`AP`, `AQ`, `AT`–`CB` + metapodaci, `DM`–`DQ`, 2016–2025): migrirati uopće?
  Ako da — zasebna privatna Area `Posao` (leaf `Dan` s `AQ` + leaf `Sati` s `projekt` + `sati`).
  Što je brojač `DM`–`DQ`?
- **Q14 — `DS` PROJEKTI**: ovdje kao treći leaf, ili u Areu `Projekti` uz ideju o uvozu sesija
  ovog projekta iz transkripata (isti `P5`)?
- **Q15 — Stari stupci** `Y`–`AI` (2013–2016) i rijetke oznake (`AN`, `AO`, `DR`, `DT`–`DV`):
  spojiti u `napomena`, ili ih ostaviti samo u `trening.xlsm` kao arhivi?
- **Q16 — Ostali sheetovi**: preklapa li se `Krv` (2003–2026) s `Bloodwork.xlsx` koji je već u
  `Health_Saša`? Ostaju li `trkaceDionice`, `Janko`, `Snaga` samo u Excelu?
- **Q17 — Garmin**: `Fitness_Garmin` je na TEST-u, nije na PROD-u (`MIGRATION_STATE.md`). Ide
  li uopće? Ako ne, `O` brojevi su jedini zapis pulsa/kcal treninga u bazi; ako da, dupliciraju se
  (svjesno, kao u `Diary.md` §2.6).

---

## 6. Sljedeći koraci (kad stignu odgovori)

1. Odgovore upisati ovdje (§5 → odluke), preusmjeriti uputnice (`Diary.md` → `docs/_archive/`,
   `AUTOMATION_SPEC` Faza 4, `DATA_PIPELINE_PLAN` Prioritet 5, BACKLOG, `MIGRATION_STATE`).
2. Generator `data-prep_tools/Trening/trening_to_xlsx.py` iz `Tools/excel_import_template.py`:
   Structure sheet (kategorije, atributi, `suggest`, `depends_on`) + Activities po godinama.
   Čita **kopiju**, zadano piše samo izlazni xlsx.
3. Review workbook: retci gdje regex nije uspio na eri u kojoj bi trebao (npr. `O` 2017.→ bez
   `HR a(b)`: ukupno 35 redaka 2017–2025, najviše 12 u 2021.) — za Sašin pregled, ne za brisanje.
4. TEST uvoz (TEST korisnik), provjera brojkama iz §1, pa list columns + export profil
   „DIARY layout" za rekonstrukciju tablice.
5. PROD. F5 (`AreaSettings`) treba tek kad `Dnevnik` dobije pločice.

---

## 7. Kako je mjereno

Kopija filea (`cp` iz OneDrivea u `Claude-temp_R/trening/`), `openpyxl` dvaput (formule i
`data_only`), sve ćelije `DIARY` u memoriju, pa brojanje po koloni × godini, tipu vrijednosti
i regexu. Skripte su jednokratne (scratchpad, nisu u repou); ponavljanje je ~1 min. Privatni i
poslovni sadržaj (`AM`, `AQ`, imena ljudi i klijenata) namjerno **nije citiran** — ovdje stoje
samo oblik i brojke.
