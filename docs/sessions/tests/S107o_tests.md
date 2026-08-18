# S107o — mehanizam odluke (`AI odluka`) + 2 odobrena popravka izvršena (2026-07-28)

**Nema app koda.** Python data-prep + upis u Review workbook.
Puni kontekst: `data-prep_tools/Financije/ENRICH_PLAN.md` §2m.

Sesija je krenula od Sašinog pitanja "što točno da radim s T-S107n-1" — ispalo je da
**mehanizam za bilježenje odluke nije postojao**, pa je test bio neizvediv kako je napisan.

---

## Programski verificirano (Claude, u sesiji)

| ID | Što | Rezultat |
| --- | --- | --- |
| T-S107o-A | `apply_ai.py --init` na **kopiji** prije diranja pravog filea | Kolona `AI odluka` na `N` (desno od `Podtip_AI`); DV `TipList`/`INDIRECT` i CF i dalje na `J`/`K`; autofilter `A1:AC`→`A1:AD`; sve širine + outline razine prate svoju kolonu; **0 razlike u podacima**; drugi poziv = pravi no-op (bez backupa) |
| T-S107o-B | Harvest ciklus na kopiji (OK/NE/?/prazno + rubni slučajevi) | 3 valjana `OK` prenesena; `Tip` s pravom labelom **nije pregažen** (`ok` na već klasificiranom retku ignoriran); `NEPOZNATO` odbijen; `NE`/`?` ostali u koloni; `OK` ćelije očišćene; drugi harvest = 0; `Pravilo run` netaknut |
| T-S107o-C | `ai_classify.py` eval circularity guard | Retci s `Labela iz` = `AI:*` izbačeni iz eval seta (0 od 2580); bez toga bi se brojali kao **`rucno`** — tj. baš kao pošteni benchmark |
| T-S107o-D | `fix_duplikati_rata.py` na kopiji pa pravi run | 5004 → **4996** redaka; Σ Isplata 375.833,16 → **375.196,80** (−636,36 točno); 8 ključeva u `V3 preskočeno`; Kokini retci dobili `Izvod opis`+`Izvod file`; **0 razlika u 149.834 ćelija** ostalih redaka; ponovni run se sigurno zaustavi |
| T-S107o-E | `fix_vocarna_pravilo.py` pravi run | Pravilo `voce i povrce` → `Namirnice \| Hrana i ostalo` umetnuto na red 44 (**iznad** #43 `AGRAM`); redak nađen po `source_key` na **4504** (pomaknuo se s 4512 nakon dedupa — dokaz da je traženje po ključu ispravno) |

---

## Ručni testovi za Sašu

| ID | Test | Kako | Status |
| --- | --- | --- | --- |
| **T-S107o-1** | **GLAVNI POSAO — `visoka` traka (261)** | Filter `Pouzdanost_AI` (kolona `N`... pazi: **`O` je sad `AI odluka`**, provjeri header) = `visoka`, sort po `Tip_AI` pa `Podtip_AI`. Jedinica pregleda je **par, ne redak** — 31 par, od toga 3 nose 165 redaka. Grupa dobra → upiši `OK` u prvu ćeliju `AI odluka` i povuci kroz grupu. Znaš točan odgovor → **upiši ga u `Tip`/`Podtip`, ne `NE`** (to je jedino što nosi informaciju za sljedeći AI run). Ne znaš → `NE` ili `?` | ⬜ |
| **T-S107o-2** | Kontrola nakon `--harvest` | Nakon što javiš i ja pokrenem harvest: `OK` ćelije moraju biti **prazne**, `Tip`/`Podtip` popunjeni, `Labela iz` = `AI:visoka <datum>`. Filter „`AI odluka` nije prazno" = točno ono što je ostalo za riješiti | ⬜ |
| **T-S107o-3** | Duplikati rata — kontrola nakon popravka | Provjeri 8 Kokinih redaka (Plodine 6/6, AC Šatrak 5/6 i 6/6, Traperice 2/4 3/4 3/4, Reg C5 2/3 ×2): svaki mora imati `Izvod opis` s tekstom `RATA …`. Izvodnih parnjaka više nema. Σ Isplata je manja za 636,36 € | ⬜ |
| **T-S107o-4** | `freeze_panes` vraćen na `F2` | Bio je `F4855` (zamrznuto 4854 redaka). Sad se header drži, kolone A–E ostaju pri skrolu udesno. Ako ti je stara postavka ipak trebala — reci, vraćam | ⬜ |

**Backupi (redom kako su nastali):**
`*.pre-aiapply-20260728_082727.xlsx` (prije `AI odluka` + freeze) ·
`*.pre-duprata-20260728_083704.xlsx` (prije brisanja 8 redaka) ·
`*.pre-vocarna-20260728_083708.xlsx` (prije pravila)

---

## Odluke donesene u sesiji (Saša)

- **Mehanizam odluke = kolona `AI odluka`** u Reviewu (dropdown `OK`/`NE`/`?`), a ne
  odgovaranje u chatu ni zaseban sheet. Razlog: odluka ostaje u fileu i preživi sesiju.
- `--harvest` **briše `OK`**, a `NE`/`?` ostavlja → kolona se sama prazni, a filter
  „nije prazno" je uvijek preostali posao (uzor `Nematchano_v3`, 41 → 0).
- Ispravci se pišu **izravno u `Tip`/`Podtip`**; harvest ne dira retke koji nisu N/A.
- `freeze_panes` `F4855` → `F2` (potvrđeno kao slučajan klik).

## Nalazi koji su promijenili plan

1. **Pravilo `voce i povrce` samo po sebi ne bi popravilo ništa.** `apply_rules.py`
   (linija ~516) preskače svaki redak čiji je par **valjan** u Taksonomiji — a
   `auto Lacetti | registracija` jest valjan, samo je kriv. Zato alat radi oboje:
   pravilo (za budući import) + jednokratni ispravak retka.
2. **Brisanje retka lomi idempotenciju `merge_pbzvisa.py`** — on preskače
   `source_key`eve *koji postoje u Reviewu*, pa bi obrisani duplikat vratio pri
   sljedećem runu. Popravljeno: `V3 preskočeno` je sad registar koji i taj alat čita.
3. **Provenijencija AI labela NE smije ići u `Pravilo run`** — `ai_classify.py --eval`
   tu kolonu čita kao „labelu je stavilo keyword pravilo". AI labele bi ušle u vlastiti
   eval set, i to kao `rucno` (pošteni benchmark). Ide u `Labela iz` (`AI:visoka …`).
4. **Par 4505 potvrđuje T-S107n-4:** izvodni `RATA 02/03 AUTOCENTAR AGRAM`,
   `event_date` 11.03.2026, Kokina napomena **„Reg C5 2/3"** → **ožujak = C5**.

## Petlja učenja (dogovoreno načelno, nije građeno)

Pitanje Saše: mogu li `NE`/`?` poboljšati sljedeći AI run. Zaključak:

- **`NE` sam ne nosi gotovo ništa** — negativan primjer bez točnog odgovora. Vrijednost
  je u **ispravku** (`tekst → krivi prijedlog → točan odgovor`).
- `Tip_AI`/`Podtip_AI` **ostaju u retku i nakon harvesta**, pa je svaki ispravak
  rekonstruktibilan i bez oznake: `Tip` popunjen + `Tip_AI` postoji + različiti su.
- Put natrag u model: ispravci → `AI_KONTEKST_pitanja.txt` (taj je kanal dao najveći
  izmjereni skok, 62,5 % → 80,3 %) → bump `PROMPT_VER` → re-run samo `niska`+`srednja`
  (~1332 retka, ~$1). Ponovljivi merchanti idu u `Pravila`, ne u model.
- Ispravci su i **bolji eval set** od sadašnjeg (1617 od 2580 redaka labelirano keyword
  pravilom = model ih pogađa trivijalno). Uvjet: isti redak ne smije biti i u promptu i
  u evalu — treba split po datumu.
- **Graditi tek kad se vidi koliko ispravaka stvarno padne iz `visoka` trake.**
