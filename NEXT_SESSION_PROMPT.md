> Pisano protiv `134b486` (S180) + commita koji nosi ovaj file (S180, 22.10.).
> **`main` = `1f53e90` (deploy 22.10., S179).** Na `test-branch`, NIJE na PROD-u: `ca7fa08` (klik sa strane ne
> zatvara Structure Import dok postoji pregled) — deploy uz iduću izmjenu appa; S180 su samo Python alati i docs.
> **PROD (22.10., 15:10):** preuređivanje Financija PRIMIJENJENO (op `e0c3de1f`, 6.066 promjena) — svaki redak
> ima Namjenu, Podtipovi bez `_Koka/_Sasa`, `AI_rucak` ispravljen. Ostaje Kokina provjera na mobitelu.
> **TEST:** kopija PROD-a 22.10. 14:15 + isti sheet primijenjen (op `2b200967`) ⇒ TEST = PROD.
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md` i `data-prep_tools/CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S180 (preuređivanje Financija na PROD-u)

> **Ukratko (S180):** sheet s 24 koraka za Financije (osoba iz imena Podtipa u Namjenu, Nenin fond, Decathlon, Anja, osiguranje kuće, auti, zadano Zajedničko) složen je alatom i izmjeren na kopiji PROD-a — 6.066 promjena u 2,4 s, saldo i ukupni zbroj isti u cent, povrat vraća sve — a Python rječnici su ispravljeni istog dana; isti dan primijenjeno i na PROD-u, s identičnim brojkama.

---

# DIO 1 — netehnički (za Sašu)

## Gotovo (S180)
- **Financije su preuređene na PROD-u** (Koka kao vlasnica, 3,7 s, provjera ✓):
  - osoba iz imena je u **Namjeni**: `Audible`, `Kindle`, `Sport`, `Medical`, `Lječnička komora`,
    `Odjeća/obuća/ostalo` — jedan Podtip, a Namjena kaže čije je;
  - `Projekti / Saša`; Nenine uplate → `Prihodi / Nasljedstvo`, Namjena **„Nena / Kućište"** (u fondu 9.534,95 €);
  - Decathlon → `Zdravlje / Sport`; Anja 25.09. → `Povrat Anja`; osiguranje kuće → Tip `Osiguranje`;
  - Lacetti → Saša, C5 → Koka, sve ostalo → Zajedničko (4.420 redaka).
- **Saldo oba računa i ukupni zbroj isti u cent**; PROD poslije je u svakoj brojci isti kao TEST poslije.
- Tvoj shortcut `AI_rucak` ispravljen (`Projekti / Saša`, Namjena Saša); Python alati predlažu nove nazive.

## Što treba od tebe / Koke
1. **Koka na mobitelu** (ponovo otvoriti app): Add → Tip `Zabava` ⇒ Podtip nudi `Audible` (bez `_Koka`),
   Namjena zadano Zajedničko i nudi „Nena / Kućište". Javi ✅ ili sliku ⇒ zatvara T-S180-2.
2. Ostalo nepromijenjeno: **T-S174-3/5** (PROD razvrstavanje — ⚠ prijedlozi sada koriste nove nazive),
   **Garmin** izvoz, **studeni** (T-S175-1 MC ~02.–11.11., T-S175-2 Visa ~03.–11.11., T-S175-3 ZABA_2026-10).

---

# DIO 2 — tehnički (za Claudea)

## Izvedeno (S180)
| Što | Gdje | Dokaz |
| --- | --- | --- |
| builder sheeta | `Claude-temp_R/s180/build_sheet.mjs <export>` (Namjena lista, −2 bucketa u `AreaSettings`, 24 koraka) | TEST i PROD: 24 / 6.066 |
| kontrola | `Claude-temp_R/s180/kontrola.mjs <tag> [--env prod]`, `--diff a b` (samo čitanje) | PROD poslije = TEST poslije, sve ISTO |
| pokretač | `Claude-temp_R/s180/run.mjs <file> [--keep]` (modal kao vlasnik, TEST) | apply 2,4/2,1 s, undo 1,1 s |
| grep | `Tools/preuredjivanje_grep.py`: korak s `event_id` preskočen | 106 → 29 → 8 (S107 skripte) |
| rječnici | `set_breakdown`, `pravila_trgovca`, `uvezi_transu`, `klasificiraj_transu` | `set_breakdown` dry run PROD: ISTO |
| shortcuti | `Financije/fix_shortcuti_S180.py` | PROD: AI_rucak 1 od 5 ✓ |

PROD: op `e0c3de1f` (povrat moguć `rpc_restructure_undo` po `op_id`, samo vlasnik/service). Backup prije: `prod/2026-10-22_1454`.

## Otvoreno
- **Planer i lista `depends_on` pod `*`** (spec §20, CLAUDE.md): korak koji mijenja POSTOJEĆU Namjenu stvorio
  bi ključ po Tipu samo s ciljem. Popravak + test u `restructurePlan.test.mjs` **prije** idućeg preuređivanja
  Namjene (npr. C5 putovanja → Zajedničko). Sada Namjena IMA vrijednosti ⇒ mina je naoružana.
- **Namjena na novim retcima s izvoda:** `fill_from_izvod` / `visa_uvoz_izvoda` je ne pišu (forma da, Excel
  uvoz ne) ⇒ od studenog novi retci s izvoda bez Namjene. Prije prekidača Bucketi | Namjena (RAZREZ R5):
  alati upisuju zadano po Tipu, ili razrez prazninu broji kao Zajedničko.
- **Bucketi „Koka razno" / „Saša razno"** su namjena-bucketi — s Namjenom postaju zalihost; odluka uz R5.
- **Deploy `ca7fa08`** uz iduću izmjenu appa.
- Iz S179: F1b popis operacija s Poništi u Structure tabu; brisanje opcije s retcima u Structure uvozu ⇒
  upozorenje (§17).

## Otvoreno — ostalo (po prioritetu, nepromijenjeno)
1. **Mali, neovisni:** traženje u izborniku po oba nivoa (O6) · prekidač Bucketi | Namjena (RAZREZ R5).
2. **Trening:** F2 (tip atributa, izvođenje iz teksta) pa generator — F1 je sada na PROD-u.
3. **Pregled razlika prije Structure uvoza** (BACKLOG „Napredak Aree između korisnika").
4. Iz S173: `--par=<id8>:<iznos>` ako MC_2026-10 da `NEJASNO` · `MOŽDA KRIVO MJESTO` za MC · T23 u appu.
5. Iz S172: Excel uvoz `default_map` kad se roditelj promijeni · „Review" sheet · delta retci ispod
   sekcije · ↗ ne vraća `attrFilter`.
