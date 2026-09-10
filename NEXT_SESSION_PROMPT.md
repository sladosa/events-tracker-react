# Sljedeća sesija — handoff

**Pisano protiv commita:** `9853dcb` (`S134: search_path na SECURITY DEFINER funkcijama`).
`main` je **iza** — na njemu je još S133. Ako `git log` pokazuje novije, čitaj
ovo kao povijest; CLAUDE.md je autoritet.

---

# DIO 1 — netehnički (za Sašu)

## Što je danas napravljeno

| | stanje |
| --- | --- |
| Backup baze — **prva kopija PROD-a uopće** | ✅ radi, 53 s |
| Shema obje baze u gitu (`pg_dump`) | ✅ |
| Vlasništvo strukture poravnato na PROD-u (`sql/045`) | ✅ pušteno |
| Kod: `user_id` se više ne prepisuje | ✅ commitan, **nije deployan** |
| Čišćenje RLS-a (`046`–`051`) | ✅ **samo na TEST-u** |
| Otvorena rupa u pravima — nađena i zatvorena | ✅ na TEST-u |
| UI: Save više ne može tiho ne učiniti ništa | ✅ commitan, **nije deployan** |

## Ono što je zapravo bila poanta dana

Krenuli smo od backupa i našli nešto veće: **bilo koji prijavljen korisnik mogao
je pisati u tuđu Areu.** Ne grantee — bilo tko s računom.

Izgledalo je zatvoreno devet mjeseci, i to iz razloga koji je vrijedan pamćenja:
aplikacija šalje zahtjev koji uz upis traži i da mu se redak vrati natrag. To
vraćanje politika je odbijala, pa je odgovor bio „zabranjeno" — a sam upis je
prolazio. Promijeniš jednu postavku u zahtjevu i redak uđe.

Uz to su se **tri zapisane tvrdnje** o pravima pokazale netočnima. Sve tri su
nastale čitanjem koda umjesto mjerenja baze. Zato sada postoje dva alata koja
mjere: jedan vadi stvarnu shemu u git, drugi ispisuje **što tko stvarno smije**.

## Što tebe čeka — redoslijedom

1. ⭐⭐ **Pusti migracije na PROD**, sa sondom prije i poslije. Točan redoslijed
   je u `docs/sessions/tests/S134_tests.md` (T-S134-11). Ukratko:
   ```
   Tools\run.bat Tools\backup_db.py --env prod          ← svježa snimka
   Tools\run.bat Tools\rls_probe.py --env prod          ← spremi izlaz
      046 → 047 → 048 → 049 → 050 → 051   (Supabase SQL editor)
   Tools\run.bat Tools\rls_probe.py --env prod          ← usporedi
   Tools\run.bat Tools\dump_schema.py --env prod        ← shema natrag u git
   ```
2. ⭐⭐ **Provjeri da Koka i dalje može raditi** (T-S134-12). To je najvažniji
   test cijele sesije. Ako bilo što tiho ne radi — politike se vraćaju iz
   `sql/SCHEMA_PROD.sql`.
3. **Deploy koda** kad kažeš. Bez njega `sql/045` stoji na milost prvog
   spremanja Structurea — stari bundle i dalje prepisuje vlasništvo.
4. **Ne diraj Structure na PROD-u** dok deploy ne prođe (isti razlog).
5. **Ugasi `npm run dev:prod`** prije E2E. Sada te guard zaustavi umjesto da
   testovi odu na produkciju, ali E2E onda neće ni krenuti.

## Što treba od Koke

Ništa. Ako primijeti da nešto u Structure tabu ne radi nakon migracija — to je
odmah važno i vraća se.

## Jedno pitanje koje je ostalo otvoreno

Rekao si da bi za financijske podatke možda trebalo **posebno odobrenje za
brisanje**. Predložio sam da to ne bude zabrana nego: (1) backup — sada postoji,
(2) **potvrda s iznosom kod grupnog brisanja** (*„obrisat ćeš 47 redaka, ukupno
−3.204,18 €"*), (3) trag brisanja ako zatreba. Prava linija nije „financijski vs
ostali" nego **„jedan potez vs pedeset"**. Zapisano u `docs/RLS_INVENTORY.md`;
recimo kad želiš (2).

---

# DIO 2 — tehnički (za Claudea)

## Stanje grana

- `test-branch` = `9853dcb`, sedam commitova iznad `main`.
- `main` = S133. **Netlify nije deployao ništa iz S134.**
- Migracije: **PROD ima samo `045`**. TEST ima `045`–`051`.
  ⇒ **TEST i PROD sada imaju različite RLS politike** — to je privremeno i
  namjerno, ali svaki zaključak o pravima mora reći na koju bazu se odnosi.

## Novi alati (`data-prep_tools/Tools/`)

| alat | čemu |
| --- | --- |
| `backup_db.py` | snimka cijele baze; `--verify` provjeri staru po sha256 |
| `dump_schema.py` | `pg_dump --schema-only` → `sql/SCHEMA_*.sql`; `--diff` |
| `rls_probe.py` | što RLS **stvarno** dopušta po ulozi, sve u `ROLLBACK`-u |

`SUPABASE_DB_URL` je u `.env.prod.local` i `.env.local` (Session pooler, port
5432). Veza ne može ići direktno — samo IPv6.

## Otvoreno

- **T-S134-11/-12/-13/-14** — PROD migracije i provjere. Ništa od toga nije
  pušteno.
- **T-S134-16** — cijeli E2E nakon RLS promjena. **Nije pokrenut** jer je na
  :5173 stajao `dev:prod`; guard bi ga zaustavio. TEST baza već ima nove
  politike, pa E2E sada mjeri stvarno stanje.
  ⚠ Spec koji piše strukturu pod nevlasnikom sada **legitimno** pada — treba
  razlikovati to od regresije.
- **`event_attributes` INSERT ostaje otvoren.** Namjerno nije dirano u `050`:
  S123 traži da se atributi pišu pod **autorom eventa**, pa uvjet ne može biti
  isti kao za `events`, a pogrešno sužavanje ostavlja redak **bez ijednog
  atributa** uz poruku o uspjehu (Edit tok briše pa ponovno upisuje sve). Traži
  pokus nad Edit tokom, ne samo nad politikom.
- **`events` SELECT/UPDATE/DELETE nisu čišćeni** — ondje živi `043`/S123/S125
  logika (vlasnik smije ispraviti tuđi redak ali ne obrisati; `guard_event_author`).
  Zaseban posao.
- **Structure uvoz u tuđu Areu stvara duplikat Aree**, tiho. Popravak nije
  napravljen jer mijenja ponašanje uvoza, a Excel roundtrip je Koki glavni put.
- **RESTORE NE POSTOJI.** Backup je kopija, ne provjeren povratak. Bio je
  dogovoren za „idući put" — to je sada.
  ⚠ Prije pisanja: restore u istu bazu traži `--wipe` granu (najopasnija
  operacija u sustavu), a PROD→TEST klon traži mapiranje `user_id`-eva ili dump
  `auth.users`. Dump nosi `project_ref` baš zato da restore odbije upisati u
  krivi projekt.
- **`sql/051` čeka PROD.** Izmjereno: PROD ima **9** SECURITY DEFINER funkcija
  bez `search_path`, TEST samo 2 (ostalih 6 ondje ne postoji). Nije rupa —
  `authenticated` i `anon` nemaju CREATE ni na shemi ni na bazi, pa nemaju gdje
  podmetnuti; zatvara se put prije nego postane prohodan.
  ⚠ `handle_new_user` i `handle_pending_invites` su triggeri na **registraciji**
  i provjerava ih tek sljedeća stvarna registracija.

## Nepromijenjeno od S133

Financije pipeline, sidra, delta sheet, tranše, Overview — ništa od toga danas
nije dirano. Vrijedi CLAUDE.md i `DONE_HISTORY` S129–S133.
