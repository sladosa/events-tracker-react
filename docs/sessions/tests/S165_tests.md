# S165 — detaljni testovi (2026-10-07)

> Sesija: **pločica „Kamo ide novac"** — `docs/RAZREZ_SPEC.md` DIO 2, §15 koraci 1–4.
> Migracija **`056_area_breakdown.sql` je na TEST-u** (pokrenuo Claude kroz psql), config pločice i
> grupiranja upisan na TEST alatom `set_breakdown.py`. **PROD nije diran** (ni migracija, ni config).
> Brojke ispod su izmjerene na TEST-u 07.10.2026. (TEST = PROD 07.10. + R3 osiguranje kuće);
> `verify_breakdown.py` ih potvrđuje u lipu, `breakdownModel.test.mjs` ih čuva kao snimku.
> Naredbe: PowerShell iz `data-prep_tools\`.

**Preduvjet za T-S165-1..8:** `npm run dev` (banner **TEST**), prijava pod Sašinim računom (na TEST-u je
on vlasnik `Financije_all`), Area `Financije_all`, kategorija `Transakcija`, tab **Overview**.
Razdoblje se postavlja u filtru: **From** / **To** (Period se sam prebaci na prilagođeni raspon).
⚠ Ako ste na :5173 imali `dev:prod`, TEST server je na drugom portu (npr. :5174) — **banner čitaj prije brojke**.

---

## T-S165-1 ⬜ 12 mj „po kupnji" = RAZREZ §4.3

1. Filtar From **01.10.2025.**, To **30.09.2026.**
2. Ispod pločice „Stanje po računu" je nova pločica **„Kamo ide novac"**, zaglavlje
   `01.10.2025.–30.09.2026. · iz filtra`.
   **Očekivano (sažetak):** Ušlo **46.972,48 €** · Izašlo **40.127,91 €** · Razlika **+6.844,57 €**.
3. Prekidači: **Troškovi** i **po kupnji** su odabrani; desno piše `grupirano: Vrsta troška`.
   **Očekivano (lista):**

   | bucket | iznos |
   | --- | ---: |
   | Mjesečni troškovi | 20.994,89 |
   | Koka razno | 4.311,71 |
   | Kvaliteta života | 4.164,57 |
   | Povremeno nužno | 2.911,14 |
   | Putovanja i pokloni | 2.909,94 |
   | Saša razno | 1.611,03 |
   | Kuća investicije | 614,44 |
   | Kućište · Nenin novac | 499,39 |
   | *nerazvrstano (N/A)* | 2.110,80 (zadnji redak) |

4. Klik na **Mjesečni troškovi** ⇒ rasklopi se: Domaćinstvo 8.280,70 · *gotovina, nerazvrstano*
   **3.830,90** · Informatika 3.706,46 · Kuća 3.274,96 · Zabava 939,68 · Prijevoz 541,99 · Zdravlje 420,20.
   Klik na **Kuća** unutra ⇒ Plin, Struja, Holding, Voda, i **Povrat Zoran −839,18** / **Povrat Nataša
   −50,00** zeleno s oznakom `povrat > trošak`.
5. Rasklopi **Povremeno nužno** ⇒ **Porezi −973,23** zeleno, `povrat > trošak`.
6. Dno pločice: `izvan razreza (Transfer): ušlo 61.420,64 € · izašlo 81.561,51 €`.
7. Na širokom ekranu lijevo je **krug** (bucket → Tip → Podtip); ispod njega **„Nije nacrtano"**
   nabraja Povrat Nataša, Povrat Zoran i Porezi s minusom.
   **Pad:** bilo koji broj drukčiji ⇒ prvo pogledaj je li netko na TEST-u upisao redak datiran u
   prozoru; pa javi Claudeu (i pokreni `Financije\run.bat verify_breakdown.py`).

## T-S165-2 ⬜ Prekidač „po naplati" i Prihodi

Isti filtar kao T-S165-1.
1. Klik **po naplati**. Kratko piše „Računam…", pa:
   **Očekivano:** Ušlo **46.972,48** · Izašlo **39.305,20** · Razlika **+7.667,28**;
   Mjesečni **19.939,85** · Koka razno 4.242,03 · Kvaliteta života 4.106,59 · Povremeno nužno 2.825,88 ·
   Putovanja i pokloni 2.281,44 · Saša razno 1.638,85 · Kuća investicije 716,33 · Kućište 499,39 ·
   N/A **3.054,84**.
2. Dno pločice: `↗ (prikaz redaka) radi samo „po kupnji"`; strelice ↗ uz retke nestanu.
3. Klik **Prihodi** ⇒ jedan redak **Prihodi 46.972,48**; rasklopljen: Koka **26.723,22** · Saša
   **15.299,26** · Povrat Anja **4.950,00**. Sažetak gore ostaje isti.
4. Natrag na **Troškovi** / **po kupnji**.

## T-S165-3 ⬜ Rujan (kraći prozor, druge brojke)

1. Filtar From **01.09.2026.**, To **30.09.2026.**
   **Očekivano (po kupnji):** Ušlo **2.844,16** · Izašlo **4.428,90** · Razlika **−1.584,74** (crveno);
   Mjesečni 1.947,15 · Povremeno nužno 707,82 · Putovanja i pokloni 628,50 · Kućište 499,39 ·
   Kvaliteta života 333,71 · Koka razno 269,83 · Saša razno 42,50 · **nema** reda N/A ni Kuća investicije
   (nema redaka u rujnu). Transfer 450,00 / 2.487,08.
2. **po naplati:** Izašlo **4.203,07**; pojavi se Kuća investicije 114,14 i N/A **19,95**.
   Prihodi: Saša 1.454,64 · Koka 1.389,52.

## T-S165-4 ⬜ Drill ↗ — Tip, jedinstven Podtip, dvoznačan Podtip

Filtar 01.10.2025.–30.09.2026., **po kupnji**.
1. Rasklopi Mjesečni troškovi → klik **↗** uz **Kuća**.
   **Očekivano:** otvori se Activities, filtar `Tip = Kuća`, raspon datuma isti; **80** zapisa.
   (Kuća u listi ima i retke iz Kuća investicije i Povremeno nužno — drill je cijeli Tip.)
2. Natrag na Overview, rasklopi **Koka razno → auto C5**, klik ↗ uz **gorivo**.
   **Očekivano:** poruka *„filtar nosi jedan uvjet, a „gorivo" postoji pod više vrijednosti — prikazujem
   cijeli auto C5"*; Activities filtriran `Tip = auto C5`, **48** zapisa.
3. Natrag, rasklopi Mjesečni → **Kuća** → ↗ uz **Struja** ⇒ `Podtip = Struja`, **9** zapisa.
4. Bucket i N/A **nemaju** ↗.
   **Pad:** drill na „gorivo" pokaže samo gorivo (bez poruke) ⇒ dvoznačnost se ne čita.

## T-S165-5 ⬜ Mobitel (uski ekran)

1. DevTools → Toggle device (iPhone 12/13, 390 px) ili mobitel na lokalnoj mreži.
2. **Očekivano:** **nema kruga**; ista lista s trakama, imena se **prelamaju** (ne `…`); nema vodoravnog
   scrolla stranice; prekidači stanu (mogu u dva reda).
3. Dodir na bucket rasklopi; ↗ radi kao u T-S165-4.

## T-S165-6 ⬜ Sklapanje preživi F5

1. Klik na naslov **„Kamo ide novac"** ⇒ pločica se sklopi (ostane naslov i razdoblje).
2. **F5.** **Očekivano:** i dalje sklopljena; saldo iznad nepromijenjen.
3. Klik na naslov ⇒ otvori se (vrati na otvoreno za ostale testove).

## T-S165-7 ⬜ Ništa drugo se nije promijenilo (regresija)

1. Pločica **„Stanje po računu"** je i dalje **prva**, s istim brojevima kao prije (ZABA/RF), traka
   „Čeka potvrdu" (ako postoji) iznad nje.
2. Activities: kolona **Stanje** i dalje radi uz filtar računa (drill s pločice salda).
3. Activities → **Export** ⇒ ponuda **delta sheeta** je i dalje tu (čita pločicu salda — nakon S165
   to ide kroz `isBalanceWidget`, jer pločica više nije jedina).
4. Druga Area bez configa (npr. Fitness) ⇒ nema Overview taba, kao i prije.

## T-S165-8 ⬜ Config pokazuje u prazno ⇒ glasno, ne tiho

(Opcionalno — samo ako želiš vidjeti zaštitu.) Ništa ne treba raditi ručno: pokriveno unit testom
(`breakdownModel.test.mjs`, „isti par dvaput" i „grupiranje kojeg nema") i alatom
(`set_breakdown.py` staje na duplikatu / nepostojećem Podtipu — izmjereno u S165). Označi ✅ kad
pročitaš ovo, ili javi ako želiš i ručnu probu.

---

## T-S165-9 ⬜ PROD — tek kad TEST testovi prođu (koraci 6–8 iz RAZREZ §15)

⚠ **Redoslijed je obavezan:** migracija → deploy → config. Config prije deploya bi Koki iznad salda
nacrtao žuti okvir „Nepoznat tip pločice".

1. **Supabase SQL editor (PROD):** zalijepi i pokreni cijeli `sql/056_area_breakdown.sql`.
   **Očekivano:** `Success. No rows returned`.
2. Provjera u cent:
   ```powershell
   $env:ET_TARGET='prod'
   Financije\run.bat verify_breakdown.py
   ```
   **Očekivano:** zaglavlje `[PROD]`, četiri retka `✓` i `✓ RPC = Python u lipu…`. Tablica modela se na
   PROD-u **samo ispisuje** (bez usporedbe): dok T-S164-2 (R3) nije izveden, Povremeno nužno je
   **2.476,71**, a Kuća investicije **1.048,87**; ostalo kao T-S165-1.
   **Pad:** ijedan `✗` u gornja četiri retka ⇒ ne nastavljati, javiti Claudeu.
3. **Deploy** (merge na `main`, PowerShell blok iz CLAUDE.md § End of session 11).
4. Config:
   ```powershell
   $env:ET_TARGET='prod'
   Financije\run.bat set_breakdown.py
   ```
   Dry run: `[PROD]`, sve provjere ✓, `nesvrstano u zadnjih 12 mj: ništa`, pločica NOVA. Zatim:
   ```powershell
   Financije\run.bat set_breakdown.py --apply --yes-prod
   ```
   **Očekivano:** `✓ Upisano i pročitano natrag`.
   ⚠ Ako R3 (`Kuća / Osiguranje`) na PROD-u još nije izveden, alat **stane**: Podtip `Kuća / Osiguranje`
   nije u `validation_rules`. To je namjerno — prvo T-S164-2, pa ovo.
5. App (PROD, **Ctrl+Shift+R**), Koka i Saša (grantee): pločica se vidi; brojke = korak 2.
