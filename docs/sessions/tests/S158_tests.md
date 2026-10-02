# S158 — detaljni testovi (2026-10-02)

> Sesija: **audit procesa Financija** — `FINANCIJE_PROCES.md` (bivši `FINANCIJE_KOKA_PROCES.md`),
> prvi stvarni prolaz MC izvoda (`MC_2026-09`, košara 11.10. zatvorena u cent), **T11** (37 budućih
> MC rata + 7 naknada uvezeno), **T5–T10** (alati: baza kroz `ET_TARGET`, PDF imenom, cijeli
> `izvodi/`, `PBZVISA_`, bez Excelice, pospremljena mapa), **T24** (regex rate u `fill_from_izvod`).
> Samo Python alati i dokumenti — **nema promjene u appu**, nema deploya.
> Naredbe su za PowerShell iz `data-prep_tools\`, uz `$env:ET_TARGET='prod'` jednom po prozoru.

---

## T-S158-1 ⬜ 11.10. — MC košara se slaže iz prve (Koka, PROD)

Isti trenutak kao T-S156-6; ovaj test mjeri **posljedicu današnjeg uvoza**.

1. Prije: Koka na mobitelu zatvori i ponovo otvori karticu (stari bundle, S118).
2. U bankovnoj aplikaciji: koliko je skinuto 11.10. i kojeg dana.
3. Overview → traka „Čeka potvrdu” → upiše iznos i dan.
   **Očekivano:** košara **55 stavki · 1.189,34 €**; ako je banka skinula 1.189,34 ⇒ **✓ slaže se**
   ⇒ **Potvrdi** ⇒ upisan skupni redak, 55 stavki `Izvrsen`, traka nestane.
   **Pad:** traka kaže „ne slaže se” ⇒ zapiši razliku; nešto se promijenilo između izvoda
   (02.10.) i naplate — Claude mjeri `uskladi_izvod.py --izvod MC_2026-09.pdf --dry`.

## T-S158-2 ⬜ 11.11. — u košari su već rate i naknade (Koka, PROD)

1. Kad stigne `MC_2026-10` (~02.11.): `uskladi_izvod.py --izvod MC_2026-10.pdf --dry`.
   **Očekivano:** među `ZA UVOZ` **nema** rata Konzum / Allianz / Keindl / Spar / Miele ni
   naknada `1,32` za Booking/Plitvice/Miele — sve su već u bazi (rate generirane S158).
   Izuzetak smije biti samo **zadnja** rata s `~` (MC ostatak, par centi) i NOVI planovi.
2. 11.11. traka: razlika prema banci = samo listopadske kupovine koje nitko nije upisao
   (0 ako je `MC_2026-10` uvezen prije naplate).
   **Pad:** rata koja je u bazi pojavi se u `ZA UVOZ` ⇒ sparivanje ne prepoznaje generiranu ratu.

## T-S158-3 ✅ Ponovno pokretanje `rate_alat` ne generira dvaput

✅ S158 — izmjereno: nakon uvoza 37 rata `rate_alat.py --only b` nudi **0 planova / 0 rata**
(prije popravka nudio je istih 37 ponovno — generirane rate nemaju `Izvod opis`).

## T-S158-4 ⬜ Visa izvod rujan kroz nove alate (Saša, ~05.–07.10.)

Prvi stvarni prolaz Visa toka nakon T5–T8.
1. `Financije\run.bat razvrstaj_izvode.py` → `--apply`. **Očekivano:** `PBZVISA_2026-09.pdf`
   (razvrstač uvijek daje `PBZVISA_`, nikad `PBZVIZA_`).
2. `Financije\run.bat visa_uvoz_izvoda.py PBZVISA_2026-09.pdf <dan naplate na RF-u> --file`
   — **samo ime**, bez putanje. **Očekivano:** prvi redak `[PROD] …`; kontrola **Σ = izvod u cent**.
3. **Pad:** „Nema … ni u izvodi/” ⇒ razvrstač nije kopirao; `[TEST]` u zaglavlju ⇒ `ET_TARGET`
   nije postavljen u tom prozoru.

## T-S158-5 ⬜ ZABA izvod kroz nove alate (Saša, kad stigne)

1. `Financije\run.bat fill_from_izvod.py <delta.xlsx> --zaba ZABA_2026-09.pdf --zigosi` — samo ime.
   **Očekivano:** ispis `Presedani (prod, …)` **bez** `--presedan` (uzeto iz `ET_TARGET`);
   skupna MC naplata „već na listu (preskočeno)” (T-S156-7).
2. `Financije\run.bat promet_check.py` nakon uvoza i selidbe PDF-a. **Očekivano:** novi mjesec
   je u ispisu i kad PDF još stoji u korijenu `izvodi\` (alati čitaju cijeli `izvodi\`).

## T-S158-6 ✅ Popravci alata ne mijenjaju rezultate

✅ S158 — izmjereno: ispisi `promet_check`, `make_saldo_anchors --report`, `uskladi_izvod`
(MC_2026-09), `visa_kosare`, `rate_alat --only b` snimljeni **prije** izmjena i uspoređeni
`diff`om **poslije** izmjena i **poslije** selidbe datoteka: identični, osim namjernih razlika
(redak `[PROD]` u `uskladi_izvod`, ime `PBZVISA_` u `visa_kosare`). TEST bez `ET_TARGET` sada
vidi `Financije_all` (jučerašnja kopija: 40 / 859,58) umjesto 0 Area kroz anon ključ.
