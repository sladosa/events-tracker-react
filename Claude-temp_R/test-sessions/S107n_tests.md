# S107n — AI `--run` izvršen + nalaz duplikata rata (2026-07-27)

**Nema app koda.** Python data-prep + upis u Review workbook.
Puni kontekst: `data-prep_tools/Financije/ENRICH_PLAN.md` §2l.

---

## Programski verificirano (Claude, u sesiji)

| ID | Što | Rezultat |
| --- | --- | --- |
| T-S107n-A | Umetanje AI kolona na **kopiji** Reviewa prije diranja pravog filea | DV (`TipList`, `INDIRECT`) i CF i dalje na `J`/`K`; autofilter `A1:Y`→`A1:AC`; sve širine + outline razine prate svoju kolonu; **0 razlike u podacima** na uzorku redaka; drugi poziv = no-op (idempotentno) |
| T-S107n-B | `--run --dry` (plan) bez `--limit` | 0 API poziva; ispisuje N/A 2424 (s tekstom 1606 / bez 818), plan kolona, procjenu troška |
| T-S107n-C | `--run --dry --limit 30` (prava predikcija, bez pisanja) | 30/30 vraćeno pri `BATCH=25`; prijedlozi smisleni (FOODIE→Kave/jelo vani, CF FITNESS→Sport_Sasa, SYNLAB→Medical_Sasa, KEKS PAY→NEPOZNATO); $0,09 (hladan keš) |
| T-S107n-D | Recovery put nakon pada kredita, na **kopiji** | Prekid u 4,7 s (prije: 4 retry-a × 45 batcheva); 482 banked predikcije svejedno upisane |
| T-S107n-E | `--eval` nije oštećen refaktorom (iz keša, bez API-ja) | Reproducira dokumentirano: ručne **81,5 %**, Tip **92,3 %**, `visoka` **95,2 %** |
| T-S107n-F | **Pravi run** `--run --only-text --effort high --resume` | 1593 retka upisano · visoka 261 / srednja 239 / niska 1093 · NEPOZNATO 196 · $1,17 · backup `pre-aiclass-20260727_092128` |
| T-S107n-G | Kontrola upisa vs backup (skriptom, po imenu kolone) | **0 promjena u starim kolonama**; **0 AI upisa na već klasificiran redak**; 5005 redaka i prije i poslije; `freeze_panes` netaknut |
| T-S107n-H | Skeniranje duplikata rata po `Datum naplate`+iznos | 159 izvodnih rata s nn>1 → **10 kandidata → 8 stvarnih (636,36 €)**; 2 lažna pozitivna (ZAKS 7,96 € vs e-Zaba) prepoznata i odbačena |
| T-S107n-I | Agram analiza (povod: T-S107m-4) | Ožujak = C5 / listopad = Lacetti obrazac; 4505/4506 **nisu** krivo klasificirane nego duplikati — prvi prijedlog (prebaciti na `auto C5`) bio bi pogrešan |

---

## Ručni testovi za Sašu

| ID | Test | Kako | Status |
| --- | --- | --- | --- |
| **T-S107n-1** | **GLAVNI POSAO — pregled AI prijedloga** | Review → sortiraj po `Pouzdanost_AI` (u collapsed grupi, raširi ju). Kreni od **`visoka` (261 redaka)** — to je traka za brzo prihvaćanje. `Tip_AI`/`Podtip_AI` su vidljivi uz `Tip`/`Podtip`. **Ništa se ne prepisuje automatski** — prijenos je zaseban korak koji tek treba napisati | ⬜ |
| **T-S107n-2** | Kontrola da AI nije ništa pregazio | Filtriraj `AI run` = nije prazan → **svaki** takav redak mora imati `Tip` = `N/A` ili prazan. Ako ijedan ima pravi Tip → javi, to je bug | ⬜ |
| **T-S107n-3** | 196 `NEPOZNATO` | Filtriraj `Tip_AI` = `NEPOZNATO`. Model priznaje da ne zna — provjeri na uzorku je li stvarno neodredivo iz teksta (ako nije, to je materijal za novo pravilo) | ⬜ |
| **T-S107n-4** | **Agram — koji auto** (blokira popravak) | Filtriraj `Napomena` sadrži `AGRAM` (14 redaka). Potvrdi ili odbaci: **ožujak = C5** (tehnički 50,63 + registracija na 3 rate), **listopad = Lacetti** (50,05 + 82,73). Ako potvrdiš, na `auto C5` idu 1463, 3038, 3039, 3040, 3041, 4499 | ⬜ |
| **T-S107n-5** | Duplikati rata — pregled prije popravka | 8 parova iz ENRICH_PLAN §2l tablice. Potvrdi da je **Kokin redak taj koji ostaje** i da izvodni ide u `V3 preskočeno` | ⬜ |
| **T-S107n-6** | Red 4759 (BIBERON / "Amsteradam") | `Napomena` kaže Amsterdam, izvod kaže BIBERON RESTORAN Radnička 49. Odluči je li `Projekti \| Sasa_Informatika` točno i je li bilješka zalutala | ⬜ |
| **T-S107n-7** | Freeze + collapse grupe prežive AI run | Otvori Review — `freeze_panes` i collapsed grupa `Pouzdanost_AI`/`AI run` moraju biti kakvi jesu (nasljeđuje T-S107m-6) | ⬜ |

**Backup ako nešto ne valja:** `Financije_review_20260710_1448.pre-aiclass-20260727_092128.xlsx`

---

## Odluke donesene u sesiji (Saša)

- Puni run **samo na retke s tekstom** (`--only-text`, 1606) — 818 bez teksta preskočeno
- Duplikati rata: **zadržati Kokin redak** + prepisati `Izvod opis`, izvodni u `V3 preskočeno`
- `reconcile_izvoda.py` dobiva matcher po **`Datum naplate` + iznos** uz postojeći ±2 dana
- `Voćarna` → pravilo `voce i povrce` iznad #43 — odobreno
- Agram auto + pravilo #43 `Iznos min/max` split — **čeka Sašin ručni pregled**
- Označavanje "pregledaj ručno": **ne** nova kolona; sheet `Za pregled` + `Odluka` dropdown +
  self-clearing `--harvest`, tek kad naraste
