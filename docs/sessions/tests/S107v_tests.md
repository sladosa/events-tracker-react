# S107v — testovi

**Sesija:** 2026-08-04 (Opus). Batch import 2026 + čitljive greške pri brisanju Aree.

---

## Kontekst

Dvije stvari ove sesije:

1. **Batch import 2026** — generiran `Financije_all_import_20260804_083908.xlsx` (747 redaka).
2. **Delete Area error handling** — Saša je pri brisanju stare aree `Financije_2` dobio sirovu
   Postgres poruku (`23503 … violates foreign key constraint "event_attributes_event_id_fkey"`)
   iz koje se ne vidi ni uzrok ni što napraviti.

---

## Nalaz: dva retka u Reviewu s krivim `event_date` (nije bug u kodu)

Iskočili su jer je batch 2026 sezao do **2026-12-01**, a sesija je 2026-08-04.

| red | `Izvor reda` | što je | dokaz |
| --- | --- | --- | --- |
| 4996 | `koka EU:2564` | Parking 1,60 €, stoji na **07.08.2026** | `Stanje` lanac ga zaključava između 04.07. i 08.07., u cent s obje strane: `2144,34 − 1,60 = 2142,74`, pa `+1261` (Mirovina 08.07.) `= 3403,74` |
| 4997 | `koka EU:2277` | MC 21,88 €, stoji na **01.12.2026** | `Datum naplate` 11.02.2026 je **10 mjeseci PRIJE** `event_date`-a — nemoguće. MC pravilo (11. u M+1) implicira kupovinu u siječnju 2026. |

Za 4997 dodatno: na MC izvodima postoji **samo jedna** transakcija od 21,88 u tom razdoblju —
31.12.2025. `PAYPAL *TEMU` — a nju već nosi red 4247 („Kokin Temu"). Red 4997 nema opis, `Tip` = N/A.
⇒ ili duplikat reda 4247, ili siječanjska kupovina koje nema na izvodu. **Čeka Kokin odgovor.**

**Odluka (Saša): preskočiti oba** — rez batcha na `--to 2026-07-31` (zadnji stvarni redak je 11.07.),
pa se oba izostavljaju bez ijedne promjene u Reviewu.

⚠ **Zamka za kasnije:** kad se 4996 riješi, **ne** generirati ga novim batchom — generator bi mu
dodijelio `09:00`, a taj dan je već uvezen s 09:00. Dodati kroz app ili export → uredi → import.

---

## Programske kontrole (✅ odrađene)

| ID | Kontrola | Rezultat |
| --- | --- | --- |
| P-1 | Guard imena+tipova atributa protiv strukture | ✅ 14/14 |
| P-2 | `session_start` je **tekst** (tiha rupa #1) | ✅ svih 747 `str`, `'09:00'`… |
| P-3 | 0 duplih parova (`event_date`, `session_start`) | ✅ |
| P-4 | `Rate?` je pravi bool (tiha rupa #3) | ✅ 107× `True`, ostalo prazno, nikad `False` |
| P-5 | kolona G = račun koji izvodi import (tiha rupa #4) | ✅ `sasasladoljev59@gmail.com` |
| P-6 | `Datum naplate` kao tekst `YYYY-MM-DDT12:00` | ✅ 747 |
| P-7 | `classifyDeleteError` na 6 oblika grešaka | ✅ svih 6, uklj. stvarnu grešku sa slike |
| P-8 | `typecheck` + `build` | ✅ čisto |

---

## T-S107v-1 — batch import 2026 u TEST

**Preduvjet:** `Financije_all` **ne postoji** u TEST-u (obrisana).

### Korak 1 — struktura

Structure tab → **Import** → `data-prep_data/Financije/Financije_all_structure_20260801_172202.xlsx`

Očekivano: **1 area / 1 kategorija (`Transakcija`) / 15 atributa / 2 automation rules / 0 skipped**.

⚠ Ako javi **16** atributa, uvezao si stari file — `Datum kupovine` je izbačen (D1a povučen, S107t).

### Korak 2 — zapisi

Activities tab → **Import** → `data-prep_data/Financije/Financije_all_import_20260804_083908.xlsx`

Očekivano: **747 new · 0 modify · 0 skipped**.

Traje — 747 zapisa × 14 atributa ≈ 10 000 redaka u `event_attributes`. Progress bar ide.

### Korak 3 — kontrola „isti dan ne slijepi retke" ⭐ najvažnija

Filtriraj na **28.06.2026.** → mora dati **13 zasebnih redaka**, ne jedan.
(`useActivities.ts:242` grupira po `session_start`, a leaf je L1 ⇒ isti `category_id` za sve;
bez `session_start` = `09:00 + n` cijeli dan bi se slijepio u jedan redak.)

Vremena moraju ići **09:00 → 09:12**:

| vrijeme | iznos | Tip / Podtip | komentar |
| --- | --- | --- | --- |
| 09:00 | 9,99 | Zabava / Spotify | SPOTIFY P44015227F |
| 09:01 | 62,01 | Putovanja / Karte, osiguranje | LUFTHAN…447 |
| 09:02 | 1,32 | Domaćinstvo / Bankovni troškovi | NAKNADA ZA OBROČNU O… |
| 09:09 | 137,78 | auto C5 / registracija | Allianz 4/10 |
| 09:12 | 15,42 | Domaćinstvo / Hrana i ostalo | Konzum 3/12 |

Drugi dan s 13 transakcija: **11.07.2026.**

### Korak 4 — rata

Otvori **06.01.2026., 09:01** („Plodine 6/6"):
`Rate?` = **Yes** · `Broj rata` = **6** · `Rata br` = **6** · `Isplata` = **24,50** ·
`Datum naplate` = **05.02.2026.**

(104 retka u batchu imaju `Rata br`, 107 ima `Rate?`.)

**Fail ako:** broj zapisa ≠ 747 · 28.06. daje 1 redak umjesto 13 (⇒ `session_start` nije
pročitan kao tekst) · bilo koji atribut prazan na **svim** redcima (⇒ ime atributa se tiho ne
poklapa s bazom) · `Rate?` pokazuje No na Plodine retku (⇒ boolean se krivo pročitao)

---

## T-S107v-2 — čitljiva greška pri brisanju Aree

Ponovi brisanje `Financije_2` (ili druge stare aree koja pada).

**✅ RIJEŠENO** — `Financije_2` i `Financije` uspješno obrisane nakon paginacijskog fixa
(pravi uzrok je bio `max-rows = 1000`, ne RLS — v. gore). Test ostaje kao opis očekivanog
ponašanja ako brisanje ikad opet padne:

> **Some records could not be removed**
> …still contains attribute values that were not deleted, so removing the records they
> belong to was refused. Nothing was lost…
> • Reload the page and try once more — a partly finished delete is safe to repeat.
> • Check the list above: if records here belong to someone who no longer has access…
> • If everything here is yours and it still fails, that is a bug worth reporting…
> ▸ Technical details  ← sirova Postgres poruka je tu, sklopljena

**Fail ako:** poruka je i dalje sirova · „Technical details" ne otvara originalni tekst ·
poruka tvrdi nešto što ne odgovara stvarnom uzroku

---

## T-S107v-3 — „nisi vlasnik" (grantee)

Prijavi se kao korisnik kojemu je area **shareana** (npr. `userb@test.com` u TEST-u),
otvori Delete na toj Arei.

**Očekivano:** amber blok **„You are not the owner"** na vrhu modala + **sva tri** gumba za
brisanje disabled (`Delete`, `Delete without backup`, `Download Backup & Delete`).

**Fail ako:** gumbi su aktivni · modal javi uspjeh a area ostane (to je slučaj koji `SilentNoOp`
sad hvata — ako se ipak dogodi, mora se prikazati **„Nothing was deleted"**)

---

## T-S107v-4 — SQL cascade delete + dijagnostika

`sql/033_delete_area_cascade.sql` u Supabase SQL Editoru, Role **postgres**.

1. SECTION 1 → nađi areu, kopiraj `id`
2. SECTION 2a → tko je `user_id` na atributima; 2b → **jesu li 4 policyja iz
   `020_orphan_rls.sql` uopće na toj bazi**
3. SECTION 3 → zalijepi `id`, pokreni; ispisuje inventar pa briše

**Bitno za nas:** ako 2b pokaže da policyji fale, uzrok je **neprimijenjen `020_orphan_rls.sql`**
na TEST-u i primjena tog fajla vraća UI brisanje u funkciju — onda ovaj SQL nije trajno rješenje
nego jednokratno. Javi što ispiše.

**Fail ako:** SECTION 3 padne · area ostane nakon uspješnog runa
