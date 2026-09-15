# Sljedeća sesija — handoff

**Pisano protiv commita:** `4e223f2` + izmjene zatvaranja S138 (idu istim commitom).
**`main` = `test-branch`** — deploy je pušten u S138 i grane su izjednačene.
Ako `git log` pokazuje novije, čitaj ovo kao povijest; CLAUDE.md je autoritet.

---

# DIO 1 — netehnički (za Sašu)

## Što je gotovo

**Deploy je prošao i provjeren je čitanjem, ne vjerovanjem.** U živom PROD bundleu stoji nov
oblik pravila. Grane su izjednačene, Koka vidi sve popravke iz zadnjih nekoliko sesija.

**Visa pravilo je na PROD-u** (`cutoff:3:5`) — i **ispravljeno je dvaput**, jer je prva
promjena bila polovična. Ispalo je da `Datum naplate` pune **dva** mehanizma: obična kupovina
i „kupovina na rate". Drugi nije razumio novo pravilo, pa bi rate i dalje išle na 3. Sada oba
idu na 5.

**Odgovor na tvoje pitanje o MC naplati:** `Tip = Transfer`, `Podtip = izmedju racuna`,
comment = `TROŠKOVI UČINJENI MASTERCARD KARTICOM` (doslovno, strojni tekst s izvatka).
Tako je u **32 od 32** prethodna mjeseca.

**`N/A` je prebrojan** — 1.566 redaka, ali **48 % ih nema `Izvod opis`** pa se rječnik nema
za što uhvatiti, a preostali su rep: 466 redaka na **395 različitih trgovaca**. Zaključak je
neugodan ali jasan: **alat tu više nema poluge**, to je ručni posao ili se ostavlja kao `N/A`.

## Što traži tebe

1. **Jedan Visa unos, da se vidi radi li pravilo.** Nova Visa kupovina ⇒ `Datum naplate`
   mora biti **05.10.2026.** (ne `03.10.`). I jedna na 3 rate ⇒ **05.10. / 05.11. / 05.12.**
   Config je potvrđen u bazi, ali **nitko ga još nije isprobao u aplikaciji**.
   (`T-S138-1`, `T-S138-2`)
2. **Tri sitna ispravka u podacima** — MC naplata 11.09. nema `Tip`/`Podtip`/comment,
   11.07. nema comment, i tri `Konzum dostava` rate od 15.09. nose `03.` umjesto `05.`
   Ništa od toga ne miče saldo. (`T-S138-3/-4/-5`)
3. **Odluka o `N/A` repu** — vrijedi li uopće razvrstavati 2023. (585 redaka), ili `N/A`
   ostaje. To je pitanje vrijednosti, ne tehnike.
4. **Audit projekta još nije napravljen** (`docs/audits/` ne postoji). Prijedlog stoji u
   `Claude-temp_R/mozes li mi napraviti audit projekt.txt`. Moja preporuka je i dalje:
   prvo točke 4) i 5), pa tek onda ostalo — i u **vlastitoj** sesiji.

## Što NE treba raditi

- **Ne upisuj MC naplatu za listopad ručno** dok ne stigne ZABA izvadak. Rujanska je
  upisana ručno i zato joj fali klasifikacija.
- **Ne mijenjaj `rata.date_map` u token** (`cutoff:3:5`) — rata parser prima **broj**, a
  nepoznatu vrijednost tiho pretvori u `15`.
- **Ne arhiviraj `S131`** dok se `T-S131-34` ne riješi — v. niže, alat tu laže.

---

# DIO 2 — tehnički (za Claudea)

## Novo u ovoj sesiji

| | |
| --- | --- |
| PROD config | `attribute_rules.date_map.Visa = cutoff:3:5` **i** `rata.date_map.Visa = 5`; oba potvrđena čitanjem `areas.settings` |
| CLAUDE.md | nova zamka „dva rječnika, samo jedan razumije tokene" (Critical rules) + backlog stavka „`rata` ne razumije `cutoff:B:D`"; indeks regeneriran (2.552 r.) |
| mjerenja | MC naplata 32/32 · `N/A` 1.566 razvrstan u 6 razreda · PayPal 7/8 jednoglasnih nasuprot `KEKS PAY` 10/19 |

## Otvoreno, po prioritetu

1. **`T-S138-1` / `T-S138-2`** — provjera upotrebom. Config je točan, ponašanje neprovjereno.
   ⚠ Redak za test mora se **razlikovati** od rezultata pravila (S129): ne testiraj na
   kupovini 1.–3. u mjesecu, ondje se `next:3` i `cutoff:3:5` poklapaju u mjesecu.
2. **⚠ `audit_tests.py` odluku o arhiviranju donosi iz DETALJNOG filea, a otvorenost može
   živjeti u PENDING-u.** `S131_tests.md` je 27/27 ✅ i alat javlja „DA", ali `PENDING_TESTS`
   ima otvoren `T-S131-34`. Isti razred kao S137 (ondje slijep za oblike ID-a, ovdje gleda
   krivi izvor). Popravak: arhiva se odbija ako **ijedan** izvor kaže ⬜.
3. **`rata` ne razumije `cutoff:B:D`** — Backlog. Traži `evaluateDateRule` u
   `generateRataChargeDates` i **deploy prije** nego token uđe u ijedan Excel.
4. **PayPal pravilo u CLAUDE.md je pregrubo** (izmjereno: PayPal 7/8 jednoglasnih,
   `KUPOVINA…` 8/8, `KEKS PAY` 10/19). Razlika je **nosi li niz ime trgovca iza prefiksa**.
   Nije ispravljeno — čeka odluku, jer danas nikoga ne žulja.
5. **Pet ZABA mjeseci** (`2024-03 +10,00`, `2024-07 −17,28`, `2024-10 −236,04`,
   `2025-07 +0,80`, `2025-08 −46,74`). ⚠ `uskladi_izvod.py` prima **samo MC**.
6. **Krug 2 testova** (`dev:test`, destruktivni): `T-S133-5`, `T-S133-8`, `E15-full`.
7. **Pet pipeline stavki** (`T-S107c-2`, `-d-4`, `-i-6`, `-j-1`, `T-S108-9`) — zadaci, ne
   testovi; čekaju Sašinu odluku jesu li još živi.

## Zamke koje su danas ugrizle

- **`areas.settings` je vlasnikov, a uvoz to ne javi.** Grantee-jev Structure uvoz **tiho
  stvori duplikat Aree** (`structureImport.ts:498`). Rješenje je bilo prebaciti se na
  vlasnikov račun, ne popravljati kod.
- **Brojač u uvoznom modalu broji parsirane retke, ne promjene** (`structureImport.ts:1176`,
  prije usporedbe) ⇒ `Automation rules 2` piše i kad se ništa nije dogodilo. Dokaz je baza.
- **Promjena pravila je tvrdnja o JEDNOM mjestu.** Prije nego je proglasiš gotovom,
  prebroji **tko sve puni taj atribut** — drugi punilac je bio dva retka niže u istom sheetu.
- **Deploy se provjerava čitanjem bundlea**, ne porukom Netlifyja: `curl` na `/assets/index-*.js`
  pa `grep` za nov token.

## Stanje brojki (PROD, izmjereno 15.09.2026.)

```
eventi (Transakcija)  5.216
N/A                   1.566   (2023: 585 · 2024: 476 · 2025: 411 · 2026: 94)
MC naplata            34 mjeseca, 32 s comment-om, 2 bez
Visa rate             225     dani 5.→99 4.→56 6.→25 7.→15 · 3.→3 (sve tri od 15.09.)
Mastercard rate       285     svih 285 na 11.
sidra                 ZABA 12.772,86 @ 06.09.  ·  RF 690,79 @ 07.09.
otvorenih testova     22      (17 iz S137 + 5 novih S138)
```
