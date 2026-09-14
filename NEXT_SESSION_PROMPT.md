# Sljedeća sesija — handoff

**Pisano protiv commita:** `247f60f` + nespremljene izmjene dokumentacije S136
(idu istim commitom). Ako `git log` pokazuje novije, čitaj ovo kao povijest;
CLAUDE.md je autoritet.

---

# DIO 1 — netehnički (za Sašu)

## Što je danas napravljeno

| | stanje |
| --- | --- |
| `sql/052` na PROD | ✅ ti pustio; politika pročitana i poklapa se u znak |
| ⋮ meni na Structure tabu više ne bježi | ✅ izmjereno u oba smjera + ti potvrdio uživo |
| Poruke o export profilima prestale lagati write-grantee-u | ✅ u kodu, **čeka deploy** |
| `BUG-S114-REPORTDD` | ✅ zatvoren **bez ijedne linije koda** — izmjereno da više ne vrijedi |
| Popis testova: **156 otvorenih → 25** | ✅ |
| `DONE_HISTORY` za S134 i S135 | ✅ napisan naknadno (bio je preskočen dvaput) |
| **Deploy na `main`** | ⏳ **ti ga puštaš — v. dolje** |

## Ono što je danas bila poanta

Tražio si pregled prije deploya „da ne deplojamo bez veze". Ispalo je da je to bio
dobar potez dvaput:

**Prvo**, deploy je do tada nosio **jednu jedinu** promjenu ponašanja. Sada nosi tri,
i jedna od njih je kvar koji si mogao vidjeti svaki dan: ⋮ meni na Structure tabu
zatvarao se na **svaki** pomak sadržaja — dovoljno je da se nešto ispod njega
pomakne i stavka ti se izmakne ispod prsta.

**Drugo**, čišćenje popisa testova otkrilo je da je **alat kojim mjerimo što je
gotovo bio slijep**. Nije vidio testove označene `T-S129-A7` (slovo umjesto broja),
pa je S129 prijavljivao kao *„sve gotovo, spremno za arhivu"* — dok su unutra
stajala **četiri neodrađena testa**. Da nije bilo zaštite koja odbija arhivirati
sekciju s ijednim otvorenim retkom, ta bi sesija otišla u arhivu s otvorenim poslom,
i to bez ijedne poruke.

To je isti obrazac kao jučer sa sondom: **instrument je bio slijep točno ondje gdje
se donosi odluka.** Vrijedi ga pamtiti kao pravilo, ne kao anegdotu.

## Što tebe čeka — redoslijedom

1. **Deploy na `main`.** ⚠ Tvoj terminal je **PowerShell 5.1 i nema `&&`** — zato je
   jutrošnji blok pukao. Ništa se tada nije izvršilo, pa nema polovičnog stanja.
   Ispravan oblik (zalijepi cijeli blok):

   ```powershell
   git checkout main
   if ($?) { git merge test-branch --no-edit }
   if ($?) { git push origin main }
   git checkout test-branch
   if ($?) { git merge main --no-edit }
   if ($?) { git push origin test-branch }
   ```

   Zadnja tri retka su sync-back; bez njih `test-branch` zaostane.

2. **Nakon deploya, tri kratke provjere** (detalji u `docs/sessions/tests/S136_tests.md`):
   - `T-S136-2` — kao write grantee pokušaj spremiti export profil: poruka više ne
     smije reći „read-only"
   - `T-S134-8` — spremanje strukture više ne prebacuje vlasništvo
   - `T-S131-25/-26` — dva popravka forme iz S131 koja dosad nisu bila provjerena

3. **`T-S136-3` — smoke za obavezna polja.** Ovo je zamjena za 14 testova koji se
   nikad ne bi izveli. Bitno jer `is_required` **blokira Kokin Save**, a nije
   provjeren nijednom otkad je oživljen.

4. **Financije `--apply`** — 7 stavki koje čekaju samo tebe (`T-S131-28`, `T-S130-6..10`).
   Nisu dirane danas.

## Što treba od Koke

Ništa.

---

# DIO 2 — tehnički (za Claudea)

## Stanje grana

- `test-branch` = `247f60f` + dokumentacija S136 (nespremljeno u trenutku pisanja).
- `main` = `5d58c05` **dok Saša ne pusti merge**. Prvi zadatak iduće sesije: provjeri
  `git log main` — ako je merge prošao, `T-S136-2` i `T-S134-8` postaju izvedivi.
- **`sql/052` je na PROD-u i na TEST-u** ⇒ razlika iz S135 je zatvorena. `045`–`051`
  su na obje baze (`051` potvrđen iz `SCHEMA_PROD.sql` u S136).

## ⚠ Auto-mode blokira Claudeu `main`

Izmjereno danas: `git checkout main && git merge …` je odbijen klasifikatorom, a
poslije toga i složeni `git status && git log` u istom pozivu. Ne zaobilaziti —
naredbe se **daju Saši** u PowerShell obliku (CLAUDE.md, ritual korak 11, sada
ispravljen; dotad je ondje stajao bash oblik s `&&` i baš je on danas pukao).

## Otvoreno — po redu vrijednosti

- **⭐ `T-S135-11`: zašto E2E suite ruši sam sebe.** Deset specova pada **samo** u punom
  runu, s ekranom `No activities found` uz ispravan filtar — `BUG-S121-AREACTX` razred.
  `workers: 1` je od S120, dakle nije paralelizam. Ako je uzrok gušenje TEST baze kroz
  20 min, pravo pitanje je **Postgres upgrade** (otvoren od S105), a ne testovi.
- **`E13-2` i `E15-3` su spec-strana, ne app.** `E13-2` traži `/children.*move up.*Gym/i`,
  a u aplikaciji „move up" **ne postoji nigdje** osim u komentaru koda (panel piše
  *„will become direct children of Gym"*). `E15-3` traži tekst koji nije u istom prikazu
  kao gumb iznad njega. Po pravilu iz CLAUDE.md: popravak **samo u spec fileu**, ne vodi
  se kao bug. Nije napravljeno danas — specovi nisu dirani.
- **`E7-2`/`E7-3`** — otprije poznat otvoreni bug (izostaje `access granted` toast).
- **Zatvaranje modala i dalje baca rad bez pitanja** (Backlog u CLAUDE.md). S134 je maknuo
  slučajni okidač, ne posljedicu. ⚠ Ispravak zapisanog: `useBackdropClose` **prima**
  `enabled` i šalje mu ga **šest** modala (`!saving`, `!creating`, `!deleting`, `canClose`) —
  ranija tvrdnja „nitko mu ga ne šalje" je netočna. Fali samo `isDirty` u
  `StructureNodeEditPanel`. ⚠ Ali `enabled=false` znači *ne zatvaraj*, a to je **gore** od
  zatvaranja (klikneš, ništa se ne dogodi) ⇒ treba `confirm('Discard changes?')`, ne `enabled`.
- **`RESTORE NE POSTOJI`** (`T-S132-7`). Backup je kopija, ne provjeren povratak. Najstarija
  živa brava na popisu.

## Popis testova — novo pravilo, drži ga se

- **Retci se NE BRIŠU iz `PENDING_TESTS.md` nego dobivaju ✅ + razlog.** Obrisan redak
  postaje „bez oznake u PENDING" i o njemu se ne može donijeti **nijedna** odluka — tako su
  `S99`–`S105` stajali kao rupa od S116 do S136.
- **Pet kriterija za zatvaranje**, svaki traži dokaz (v. CLAUDE.md, ritual korak 3). Šesta
  mogućnost je **sažimanje**, ne zatvaranje.
- **`audit_tests.py` je popravljen** da vidi `T-S129-A7`/`-B5`. Prije popravka S129 je imao
  „10 definiranih", stvarno **24**.
- Stanje: **25 otvorenih**, 18 session fileova, 10 siročadi (svi u živim sesijama, spomenuti
  u tekstu bez vlastitog retka — šum, ne posao).

## Nepromijenjeno

Financije pipeline, sidra, delta sheet, tranše, Overview — ništa od toga danas nije dirano.
Vrijedi CLAUDE.md i `DONE_HISTORY` S129–S136.
