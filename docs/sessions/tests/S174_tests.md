# S174 — testovi (2026-10-18)

Klasifikacija povijesti: (1) uvozni guard potvrđenog stanja pita samo kad se mijenja **bankino**
polje — isto pravilo kao Edit (C3c); (2) pravila po trgovcu (T17): AI ih je predložio iz ručno
razvrstane povijesti, Python ih je prebrojao nad bazom, Saša je odobrio 31; `razvrstaj_na.py` ih
koristi kao 4. ključ (lila u fileu).

## T-S174-1 ✅ (S174, automatski) Guard pita samo za bankino polje

`src/lib/__tests__/importConfirmedBankFields.test.mjs` — 10 tvrdnji nad configom oblika
`Financije_all` (pločica salda + žig `Izvod opis` → `Datum naplate`): Tip/Podtip, opis, sat i
`Status` ne pitaju; iznos, datum, račun, `Izvor`, `Izvod opis`, `Datum naplate` pitaju. Spec se
uspoređuje s `isBankKey` (ista funkcija kao Edit). Protuprovjera (staro: pitaj za sve) pada 4;
sabotaža pravog koda (`importBankChanges` bez `isBankKey`) ruši 4. `npm run check` 48/0, build ✓.

## T-S174-2 ✅ (19.10., Saša: 0 · 193 · 0 bez kutije — file nosi i njegovo ručno razvrstavanje; iznos +0,01 ⇒ kutija za 1) (TEST, lokalno `npm run dev`, Saša) Uvoz razvrstavanja ne traži kvačicu „potvrđeno stanje"

**Zašto ovaj file:** ZABA prijedlog ima **70** redaka s Tipom, od toga **15 `Izvor = Racun`** —
svi ispred ZABA sidara. Stari guard bi za njih pitao „15 redaka unutar POTVRĐENOG stanja"
(isto kao lažnih 9 u T-S169-6); novi ne smije pitati ni za jedan. Test se razlikuje od onoga
što bi stari kod proizveo (pravilo S129).

1. `npm run dev` (banner **TEST**), Ctrl+Shift+R, prijava kao vlasnik `Financije_all` na TEST-u.
2. Activities → Import → `data-prep_data\Financije\na_razvrstavanje_kokin_tekuci_zaba_202401-202509_20261018_1628.xlsx`
   (napravljen S174 nad TEST-om, kol. G = TEST autori).
3. **Očekivano u pregledu:** `0 New · 70 Modify · 0 Delete`; izmjene samo `Tip`/`Podtip`;
   **nema** kutije/kvačice „… redaka unutar POTVRĐENOG stanja". Pad = kutija se pojavi (stari bundle?
   Ctrl+Shift+R pa ponovo).
4. **Kontra-provjera (bez Applyja):** u istom fileu jednom `Racun` retku (npr. `Nena grijanje`
   24.02.2025., 131,87) promijeni `Isplata` u `131,88`, spremi kao kopiju, ponovo odaberi.
   **Očekivano:** kutija pita za **1** redak (iznos je bankino polje). Zatvori bez Applyja.
5. Apply originalnog filea (korak 2) smije — TEST je kopija; ili zatvori bez Applyja.

## T-S174-3 ⬜ (PROD, Saša + Koka) Starija povijest 01/2024–09/2025 s pravilima (nasljeđuje T-S169-7)

Izmjereno offline nad PROD snimkom 18.10. 11:57 (već s RF 49 iz T-S169-6): izostavljeno **165**
bez teksta; **ZABA 257 · prijedlog 70 (iz pravila 32)**, **RF 384 · prijedlog 90 (iz pravila 61)**.
Prije pravila iste snimke: ZABA 38, RF 29. Boje: **žuto** = presedan / Kokin opis, **lila** = pravilo
po trgovcu (provjeri pažljivije — povijest za samog trgovca šuti), **narančasto** = ručno;
promijenjeno postane svijetloplavo. Razlog svakog prijedloga je u listu `Pregled`.

1. File s PROD-a:
   ```powershell
   cd C:\0_Sasa\events-tracker-react\data-prep_tools
   $env:ET_TARGET = 'prod'
   .\Financije\run.bat razvrstaj_na.py --od 2024-01-01 --do 2025-09-30 --s-tekstom --po-iznosu --file
   ```
   **Očekivano:** zaglavlje `[PROD]`, `izostavljeno 165`, `N/A redaka: 641 · s prijedlogom 160 (iz pravila 93)`,
   `Kokin tekući ZABA: 257 redaka, prijedlog 70 (iz pravila 32)`, `Sašin tekući RF: 384 redaka, prijedlog 90 (iz pravila 61)`
   (± retci koje je netko u međuvremenu razvrstao).
2. Razvrstavanje: ZABA s Kokom od najvećeg iznosa (stati kad god), RF Saša.
   ⚠ T37 (Intercar rate 2025.) i dalje vrijedi: pravilo predlaže `auto C5 / popravci` (zimske gume,
   Saša), ali duplikate rata Saša provjerava prije uvoza.
3. Svjež file za uvoz — **isti prozor i zastavice**, plus `--preuzmi "..\data-prep_data\Financije\<razvrstan>.xlsx"`.
4. Uvoz pod Kokinim računom. **Očekivano:** `0 New · N Modify · 0 Delete`, bez „Foreign events",
   **bez kutije „POTVRĐENOG stanja"** (mijenja se samo Tip/Podtip — T-S174-1/2), saldo nepomaknut.

## T-S174-4 ✅ (S174, izmjereno offline) Provjera unatrag po pravilu

`razvrstaj_na.py --provjera` nad PROD snimkom 18.10. (razvrstani retci glume N/A, povijest strogo
starija od retka; pravilo odlučuje samo kad ključevi 0–3 šute):

| prozor | sve | iz pravila |
| --- | --- | --- |
| cijela povijest (3.729 bez Transfera) | 2.263 / 2.301 (98,3 %) | **144 / 147 (98,0 %)** |
| 2025-10 … 2026-09 (1.439) | 903 / 929 (97,2 %) | **54 / 56 (96,4 %)** |

Promašaji pravila su jednokratne iznimke, nijedno pravilo ispod 90 %: ljekarna → `Razno / Pokloni` 1
(15/16), Müller → `Odjeća_Koka` 1 (12/13), Dubravica → `Kave/jelo vani` 1 (12/13). Nijedno nije izbačeno.
⚠ Mjerenje je **in-sample** (pravila su izvedena iz istih redaka, ali nijedan od njih nije razvrstalo
pravilo — svi su ručni). Out-of-sample (AI samo na povijesti do 2025-09, mjeri se na 12 mj) nije
rađeno — ~0,70 $, ako ikad zatreba za proširenje liste.

## T-S174-5 ⬜ (PROD, Saša + Koka, TEK POSLIJE uvoza T-S174-3) Nenini retci u Transfer / Nena i Nena's funds

**Odluke (Saša, 18.10.):** Nena je umrla 01.08.2026.; granica = prva uplata **25.07.2026.**
Prije: sve što je Koka plaćala za Nenu (grijanje Međimurje-plin, Holding, voda, Lind-grad pričuva,
Telemach/Bilan „Nena", Kućište režije i **Porez Kućište** 280 + 350) ⇒ `Transfer / Nena` — Nena je
vraćala, nije trošak kućanstva. Od granice ⇒ `Razno / Nena's funds` (već postoji, Koka ga koristi od
18.08.): pričuva Lind-grad 18.08. ×3 i **uplate 7.000 + 5.000 €** (bile `Prihodi / Koka`) — fond tada
pokazuje i ušlo i potrošeno. Postojeća razvrstavanja se gaze. Kupnje na ljetovanju (Plodine/Studenac
Orebić, restoran) i podizanje gotovine NISU Nena i ne diraju se.

**Zašto tek poslije:** `ispravi_tip.py` piše CIJELI redak kakav je u bazi u trenutku izrade — file
napravljen prije uvoza razvrstavanja mogao bi vratiti staro stanje retka.

1. Uvezen T-S174-3 (Nenine retke u tom fileu ostaviti N/A).
2. PowerShell, naredbe iz `Claude-temp_R\s174_pravila\nena_naredbe.ps1` (izravno venv Python, NE
   `run.bat` — `"Nena's funds"` s navodnicima). **Očekivano** (suha proba nad PROD snimkom 18.10.):
   `ispravak_tip_Transfer_Nena_*.xlsx (36 redaka)` i `ispravak_tip_Razno_Nena_s_funds_*.xlsx (5 redaka)`;
   alat staje ako id ne postoji ili par nije u izborniku.
3. Koka uvozi oba: `0 New · 36 Modify · 0 Delete` i `0 · 5 · 0`; mijenja se samo Tip/Podtip; ZABA saldo
   nepomaknut (nakon deploya bez kutije potvrđenog stanja).
4. Overview → Kamo ide novac, All Time: Kuća manja za Nenin dio, `Prihodi / Koka` manji za 12.000, Razno
   (Nena's funds) pokazuje uplate i trošenje.
