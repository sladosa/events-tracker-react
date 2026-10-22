> Pisano protiv `c31b8b1` (S179) + commita koji nosi ovaj file (S179, 22.10.).
> **`main` = `1f53e90` (deploy 22.10., S179):** sve do S179 je na PROD-u — F5 (`AreaSettings`), „Create categories
> & continue" ne dira postojeću Areu, F1 preuređivanje (jezgra + faza u Structure uvozu, pomak na pregled).
> **PROD (22.10., S179):** `058` PUŠTEN, deploy `main` (F5 + F1 + S179), atribut `namjena` stvoren (Koka). Nijedan redak još nema Namjenu — to je korak 8.
> ⚠ Ako `git log` pokazuje noviji commit, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md` i `data-prep_tools/CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — PROD puštanje F1 + sheet za Financije (§8.2), nakon S179

> **Ukratko (S179):** preuređivanje se sada radi iz aplikacije — Structure uvoz pokaže korake s brojkama i primjerima, Primijeni ih izvede pod vlasnikom u 2–4 s i provjeri da je baza točno ono što je pregled predvidio, a Poništi sve vrati; izmjereno na kopiji PROD-a, sa 11/12 tablica bajt za bajt istih nakon dva ciklusa.

---

# DIO 1 — netehnički (za Sašu)

## Gotovo (S179)
- **Structure uvoz zna izvesti sheet `Preuređivanje`.** Poslije običnog uvoza pojavi se pregled:
  svaki korak s brojem redaka i tri primjera (datum · opis · iznos), sve što se mijenja izvan redaka
  (izbornik, pločice, bucketi, košare, kolone, shortcuti, sidra), greške crveno i upozorenja žuto.
  Uz kvačicu „I have seen what changes" ide **Apply**, a poslije njega **Undo** u istom prozoru.
- **Poslije primjene app sam provjeri** da je baza točno ono što je pregled obećao. Poslije povrata
  provjeri da je točno ono što je bilo.
- **Izmjereno pod tvojim računom na kopiji PROD-a:** 9.743 promjene u 2–4 s, povrat 2–3 s. Dva puta
  primijenjeno i poništeno, i baza je nakon toga ista kao prije.
- **`Namjena` postoji na TEST-u** (stvorena Structure uvozom): uz Tip se pojavi sa Zajedničko, uz
  Lacetti Saša, uz C5 Koka.
- **Alat `preuredjivanje_grep.py`** nabroji gdje Python alati još citiraju stari naziv. Za naše korake
  to su `set_breakdown.py` i `uvezi_transu.py`.

## Što treba od tebe
1. **Testovi na TEST-u (lokalni dev, Ctrl+Shift+R):** ~~T-S179-1, -2, -3~~ ✅ 22.10. (sva tri na TEST-u). Modal se od `7068d19` sam pomakne na pregled.
2. **PROD puštanje** — naredbe su ispod (koraci 1–7). Sheet s koracima za Financije složit ćemo
   **zajedno** sljedeći put. ✅ Koka je odlučila (22.10.): **„Nena / Kućište"** — zamjenjuje
   `Kućište` u izborniku Namjene (Nenin fond, spec §8.2). Za retke `Projekti / Sasa` alat predlaže Tip po trgovcu, a ti potvrđuješ.
3. Ostalo nepromijenjeno: **T-S174-3/5** (PROD razvrstavanje), **Garmin** izvoz, **studeni**
   (T-S175-1 MC ~02.–11.11., T-S175-2 Visa ~03.–11.11., T-S175-3 ZABA_2026-10).

## PROD puštanje — ✅ koraci 1–7 izvedeni 22.10. (zapis: T-S179-6); naredbe ostaju kao predložak

```powershell
cd C:\0_Sasa\events-tracker-react\data-prep_tools

# 1) Backup PROD-a (Supabase free nema automatskih)
.\Tools\run.bat Tools\backup_db.py --env prod

# 2) Sonda PRIJE 058 — očekivano: retci rpc_restructure_apply / _undo / restructure_ops s oznakom "-" (nema u bazi)
.\Tools\run.bat Tools\rls_probe.py --env prod
```

**3) Supabase SQL editor, PROD projekt:** zalijepi **cijeli** `sql\058_restructure.sql` → Run.
(Ako prvi GET poslije javi `555` — to je reload sheme, ponovi; S167.)

```powershell
# 4) Shema: razlika smije biti SAMO 058 (2 tablice, 5 funkcija, 2 SELECT politike); pa upis u git
.\Tools\run.bat Tools\dump_schema.py --env prod --diff
.\Tools\run.bat Tools\dump_schema.py --env prod

# 5) Sonda POSLIJE — očekivano: vlasnik DA · grantee NE · stranac NE · service DA
.\Tools\run.bat Tools\rls_probe.py --env prod

# 6) Deploy (F5 + F1 + S179 u jednom buildu) i sync natrag
cd ..
git checkout main
if ($?) { git merge test-branch --no-edit }
if ($?) { git push origin main }
git checkout test-branch
if ($?) { git merge main --no-edit }
if ($?) { git push origin test-branch }
```

**7) Kad Netlify završi** (Koka i ti: **Ctrl+Shift+R**): Structure → Export `Financije_all` →
```powershell
node Claude-temp_R\s179\add_namjena.mjs "<putanja do exporta>.xlsx"
```
⇒ Koka (vlasnica) uveze `…_namjena.xlsx`. **Očekivano:** `Attributes created 1`, ostali brojači 0,
bez bloka „Restructure" (sheet je prazan). Zatim Add na mobitelu: Tip ⇒ Namjena Zajedničko.

**8) (sljedeća sesija, zajedno)** sheet `Preuređivanje` s koracima §8.2 ⇒ `preuredjivanje_grep.py` ⇒
Koka uvozi ⇒ pregled ⇒ Apply. Kontrolne brojke **prije** i **poslije**: T-S179-6.

---

# DIO 2 — tehnički (za Claudea)

## Izvedeno (S179)
| Što | Gdje | Dokaz |
| --- | --- | --- |
| I/O sloj | `src/lib/restructure/apply.ts` | snimka samo potrebnih atributa, paralelno; 14 → 9 s |
| provjera | `plan.predicted` + config `after` (baza = predviđanje; povrat = prije) | `restructurePlan.test.mjs` 63, sabotaža ruši 3 |
| UI | `RestructurePanel.tsx` u `StructureImportModal`; §12 uvoza predaje `result.restructure` | modal na TEST-u, pod vlasnikom |
| mjerenje | `Claude-temp_R/s179/measure.mjs` (`build` / `run`), sesija `session.mjs` (admin `generate_link`, samo TEST) | apply 2,4/4,4 s, undo 1,9/3,2 s; `sha256` 11/12 |
| E2E | `S179_restructure_apply_undo.spec.ts` | prolazi 47 s; sabotaža pada |
| grep | `Tools/preuredjivanje_grep.py` | 71 jak na mjernom fileu |

Backup TEST-a: `2026-10-22_1135` (prije), `_1145` (poslije dva ciklusa). Zapisi u `restructure_ops`
na TEST-u: S178 dokaz + 2 × S179 mjerenje + E2E (E2E Area obrisana kaskadom) — svi `undone`.

## Plan sljedeće sesije (korak 8) — redom
1. `prod_to_test.py --settings --apply` (TEST = PROD 22.10.+, uključujući `namjena` iz PROD-a;
   prije toga `backup_db.py --env test --no-files`).
2. **Izbornik Namjene:** `Kućište` → **„Nena / Kućište"**. Nijedan redak još nema Namjenu, pa je to
   obična izmjena liste u Structure sheetu (sva tri retka `namjena`, `TextOptions`) — bez K-1 bloka.
   Ide u **isti file** kao sheet `Preuređivanje`: uvoz prvo upiše Structure, pa planira korake.
3. Sheet §8.2 (v. „NIJE napravljeno" ispod) ⇒ pregled i Apply/Undo **na TEST-u** ⇒ `preuredjivanje_grep.py`.
4. Deploy (donosi „klik sa strane ne zatvara", v. dolje) ⇒ Koka uvozi isti file na PROD-u ⇒ kontrolne
   brojke prije/poslije (T-S179-6) ⇒ Python rječnici po grep popisu istog dana.

## ⚠ Na `test-branch`, NIJE na PROD-u (mora prije Kokinog uvoza sheeta)
- Klik sa strane ne zatvara Structure Import modal dok postoji blok preuređivanja (inače odnese Undo).
  Deploy zajedno s idućom izmjenom — ali **prije** koraka 8.

## NIJE napravljeno / otvoreno
- **Sheet za PROD (§8.2):** Audible O5, Kuća/Osiguranje → Osiguranje/Kuća, Projekti/Sasa → Saša
  (+ Namjena; retci po trgovcu = prijedlog alata, `event_id` koraci), Anja 25.09. `Rata 86/96` →
  Prihodi/Povrat Anja (jedan `event_id`), Nena 25.07./28.07. → Namjena „Nena / Kućište" (+ `Razno / Nena's funds` isto), Lacetti → Saša,
  C5 → Koka, zadano Zajedničko **zadnji**. Decathlon → Zdravlje/Sport (§8.2 prijedlog).
  Python rječnici po grep popisu istog dana (`pravila_trgovca.PRAVILA`, `set_breakdown.py`, `uvezi_transu.py`).
- **Zalihost vremena:** do 4,9 s od 8 s (`authenticated`) na 9.743 promjene. PROD plan je manji, ali
  više velikih domena u jednom sheetu = podijeliti. `SET statement_timeout` unutar funkcije NE pomaže
  (brojač naredbe je već krenuo); ako zatreba, `ALTER ROLE authenticated` — odluka, ne refleks.
- **Snimka ~9 s** na kopiji PROD-a: sporo je čitanje `event_attributes` pod RLS-om, stranicu po stranicu.
  Ako smeta: `count` pa paralelne stranice, ili RPC snimke.
- **Shortcuti dijeljenog korisnika** se ne preimenuju (RLS) — na PROD-u žuto upozorenje (Area je
  dijeljena). Ako Saša ima shortcut s `Projekti/Sasa`, popraviti rukom ili alatom sa service ključem.
- Iz S178: brisanje opcije s retcima u Structure uvozu ⇒ upozorenje koje upućuje na sheet (§17);
  `default_value` jednak preimenovanoj vrijednosti planer samo javlja (§18).
- F1b: popis operacija Aree s Poništi u Structure tabu (do tada povrat iz modala ili alatom po `op_id`).

## Otvoreno — ostalo (po prioritetu, nepromijenjeno od S177)
1. **Mali, neovisni:** traženje u izborniku po oba nivoa (O6) · prekidač Bucketi | Namjena (RAZREZ R5).
2. **Trening:** F2 (tip atributa, izvođenje iz teksta) pa generator — tek poslije F1 na PROD-u.
3. **Pregled razlika prije Structure uvoza** (BACKLOG „Napredak Aree između korisnika").
4. Iz S173: `--par=<id8>:<iznos>` ako MC_2026-10 da `NEJASNO` · `MOŽDA KRIVO MJESTO` za MC · T23 u appu.
5. Iz S172: Excel uvoz `default_map` kad se roditelj promijeni · „Review" sheet · delta retci ispod
   sekcije · ↗ ne vraća `attrFilter`.
