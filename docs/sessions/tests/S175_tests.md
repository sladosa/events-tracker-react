# S175 — testovi (2026-10-19)

Čišćenje PENDING-a, bez promjene koda. Testovi iz deset sesija koji su čekali **isti** događaj, prvi
mjesečni krug u studenom, sažeti su u tri testa (MC, Visa, ZABA). Dvije praćenja Kokinog mobitela
sažeta su u jedno pitanje Koki. Koraci i očekivane brojke prenijeti su iz izvornih testova. Izvorni
retci u `DONE_HISTORY.md` nose `✅ S175 — sažeto u …` s imenom novog testa, a detaljni fileovi su u
`Claude-temp_R/test-sessions/archive/`.

Naredbe su za PowerShell iz `data-prep_tools\`, uz `$env:ET_TARGET='prod'` jednom po prozoru.
⚠ Zaglavlje ispisa (`[PROD]`) se čita **prije** brojke.

---

## T-S175-1 ⬜ (~02.11. izvod, 11.11. naplata; PROD, Saša pa Koka) MC krug studeni

**Sažima:** T-S173-2, T-S173-3, T-S173-4, T-S173-5, T-S158-2, T-S168-3 (korak 3), T-S171-5.

**Polazno stanje** (TEST = PROD 17.10., izmjereno u S173): košara 11.11. = **35 / 2.264,35**.
Od toga su rate starih planova (Konzum / Allianz / Keindl / Spar / Miele) **15 / 493,90**:
generirane su, bez `Izvod opis`. Uz njih su **4** naknade `1,32` (Booking / Plitvice / Miele) i
Kokine kupnje **16 / 1.765,17**. Izvod donosi i njene kupnje od 17.10. do zatvaranja izvoda.

**A — alat (Saša, kad stigne `MC_2026-10`):**
1. `Financije\run.bat razvrstaj_izvode.py --apply` ⇒ `MC_2026-10.pdf`.
2. Delta Export ZABA iz appa (filtar na račun; sekcija košare mora biti u fileu).
3. `Financije\run.bat fill_from_izvod.py <delta.xlsx> --mc MC_2026-10.pdf --dry`
4. **Očekivano u ispisu:**
   - zaglavlje `[PROD]` i `novi retci pod dubravka.pavic-sladoljev@…`, a ne tvoj e-mail;
   - u `NOVI` **nema nijedne** od 15 rata starih planova ni od 4 postojeće naknade. One su u
     `ISPRAVCI` kao žig, eventualno uz ispravak iznosa zadnje `~` rate (MC ostatak, par centi);
   - `NOVI` = Kokine neupisane kupnje + rate/naknade **novih** planova;
   - `KONTROLA košare 2026-11-11 … ✓ u cent`. Može biti i `✗` uz „razlika je točno Σ prijavljenih":
     tada pogledaj `DUPLIKAT?` / `U KOŠARI … NE POTVRĐUJE`, odluči, pa ponovi s `--brisi=<id8>`
     (svaki zaseban).
5. Bez `--dry` ⇒ `<delta>_filled.xlsx`. Zapiši redak `OČEKIVANO U PREGLEDU UVOZA (MC): …`.

**B — uvoz (Koka):**
6. Activities → Import → `_filled.xlsx`; za Sašine retke odabere **„Ispravi kao vlasnik Aree"**.
   **Očekivano:** pregled = brojke iz koraka 5 (New · Modify · Delete). Nijedan nov redak nije
   „preskočeno — tuđi redak".

**C — ponovni prolaz (Saša, poslije uvoza):**
7. Ponovi korak 3 (`--dry`) nad novim Delta Exportom. **Očekivano:** `0 New · 0 Modify`, KONTROLA ✓.
8. Samo ako je ispis u koraku 4 rekao `⚠ NOV PLAN`: `Financije\run.bat rate_alat.py --only b`
   (dry) ⇒ nudi preostale rate novog plana. Ne nudi i naknade (one su ušle u koraku 5), a nijedna
   rata se ne pojavljuje dvaput.

**D — rata modal (Koka, samo ako se dogodi):**
9. Prvi novi MC plan s nedjeljivim iznosom: modal kaže **„Zadnja rata nosi ostatak
   zaokruživanja"** (config `remainder_map` je na PROD-u od 12.10.). Na sljedećem izvodu te se rate
   slažu u cent.

**E — traka 11.11. (Koka):**
10. Overview → traka „Čeka potvrdu" za MC. Ispod Σ dodir na **pokaži kupnje** ⇒ otvori se pločica
    Košare na toj košari (rasklopljena, `dospjelo, čeka potvrdu`). Zbroj kupnji = Σ u traci.
11. „Je li banka skinula X?" ⇒ dodir dana s ekrana banke ⇒ **slaže se** ⇒ **Da, upiši**.
12. Poslije potvrde košara nestane i iz pločice Košare. Može se dogoditi da je naplata upisana,
    a košara još otvorena (neusklađeno). Tada piše `naplata upisana, već u stanju` i ta se košara
    **ne** oduzima od „ostaje".

**Pad:**
- rata ili naknada starog plana u `NOVI` (duplikat);
- KONTROLA ✗ bez objašnjenja;
- `NEJASNO` za redak koji je očito isti trošak (javi; danas je jedini izlaz `--brisi` starog retka);
- drukčiji broj New u pregledu uvoza;
- traka ne slaže se a izvod je uvezen;
- „ostaje" oduzme košaru čija je naplata već upisana (dvaput).

---

## T-S175-2 ⬜ (~03.–11.11.; PROD, Koka i Saša) Visa krug studeni

**Sažima:** T-S170-9, T-S161-3, T-S156-5.

1. Overview → traka „Čeka potvrdu": `Visa · naplata 05.11.2026. · N stavki`, Σ s oznakom
   **(samo isplate)**. Brzi izbor dana je od **03.11.** do danas, najviše do 11.11.
2. **Saša, isti dan, na svom računu** (na PROD-u si write grantee): vidiš usporedbu (✓ ili
   razliku), ali **nema** pitanja ni gumba, nego rečenica *„Potvrđuje vlasnica Aree…"*.
3. **Koka**, kad PBZ naplata sjedne na RF: dodir dana ⇒ sažetak ⇒ „Da, upiši" ⇒ RF redak opisa
   `Visa`, `Transfer / izmedju racuna`.
4. **Saša:** `Financije\run.bat visa_uvoz_izvoda.py PBZVISA_2026-10.pdf <dan plaćanja> --file`,
   **bez ijedne izmjene koda**. **Očekivano:**
   - `RF naplata … ✓ već upisana` (ne dodaje drugi redak naplate);
   - rate Konzum 2/3 i Maxi Konzum 2/6 spare se s postojećim retcima iz appa, ne dodaju se;
   - KONTROLA ✓ u cent.

**Pad:**
- Σ je manji od PBZ naplate točno za iznos `PRIMLJENA UPLATA` (računa neto);
- alat dodaje drugi redak naplate;
- rata plana iz appa je u `NOVI` (pravilo plana, isti dan kupnje + `Broj rata`, ne drži);
- grantee vidi gumb.

---

## T-S175-3 ⬜ (kad stigne `ZABA_2026-10`; PROD, Saša) ZABA krug studeni

**Sažima:** T-S156-7, T-S158-5 (korak 1), T-S170-12.

1. Delta sheet ZABA iz appa. Prozor mora uključivati 11.10. (MC naplata koju je Koka potvrdila
   u traci, T-S158-1).
2. `Financije\run.bat fill_from_izvod.py <delta.xlsx> --zaba ZABA_2026-10.pdf --zigosi`. PDF se
   zadaje **samo imenom**, bez `--presedan`.
3. **Očekivano:**
   - ispis `Presedani (prod, …)` iako `--presedan` nije zadan (uzeto iz `ET_TARGET`);
   - redak `TROŠKOVI UČINJENI MASTERCARD KARTICOM` (11.10.) je **„već na listu (preskočeno)"**.
     Ako je Koka upisala dan različit od izvoda, umjesto toga piše `≈ … skupna naplata istog iznosa
     već upisana na …`, uz uputu za ispravak datuma. **Nikad** se ne dodaje kao nov redak.
4. Ako list nosi kolonu `Potvrda` (sidro u prozoru) i istim prolazom ide i `--mc`, alat dopisuje
   kartične retke. **Očekivano:** `Σ kosare prosirena do retka N`, **ne** „List nema kontrolu
   košare".
5. Poslije uvoza: `Financije\run.bat promet_check.py` ⇒ 2026-10 ✓ (PDF smije stajati u korijenu
   `izvodi\`).

**Pad:** drugi skupni redak (miče saldo); „List nema kontrolu košare"; `[TEST]` u zaglavlju.

---

## T-S175-4 ✅ (19.10., Koka: „sve vidim ok" — nadiđeno upotrebom) (PROD, jedno pitanje Koki) Mobitel: lista s iznosima, `+` iz prve

**Sažima:** T-S168-4, T-S154-2.

Oba popravka su na PROD-u: lista čeka kolone od deploya 12.10., `+` pamti dodir od deploya S154.
Lokalno se ne mogu izmjeriti, jer pod 3G dev server ne učita ni popis Area. Zato se pita onu koja
ih svaki dan koristi.

**Pitanje Koki:** *„Otkad je zadnja verzija (sredina listopada): je li ti se dogodilo da se
transakcije pokažu bez iznosa, ili da `+` ne reagira pa ga moraš dodirnuti opet?"*

- **Ne i ne** ⇒ oba ✅ (nadiđeno upotrebom).
- **Da** ⇒ kad (otvaranje appa / povratak iz pregleda), na kojoj mreži, slika ako može. Lista bez
  iznosa uz traku „Nisam uspio učitati postavke" je **drugi** kvar (palo čitanje), ne ovaj.

---

## T-S175-5 ✅ (19.10., Saša na TEST-u: označena kupnja 04.10. s koje je krenuo ↗) (TEST lokalno, pa PROD nakon deploya; Saša) Košare ↗ — povratak označi kupnju

Saša 19.10.: nakon ↗ i povratka Overview vraća This Year i otvorene Košare (S172), ali se ne vidi s
koje je kupnje krenuo. Sada ↗ pamti redak u istom modulu kao View (`lastViewed.ts`), pa ga pločica
označi i dovede u vidik. Automatski: E2E `S171_baskets_and_narrow_filter` korak 3e — ↗ na kupnji
koja NIJE zadnja otvorena u View-u; sabotaža (bez upisa) pada s „označena Druga, a ne Prva".

1. `npm run dev` (TEST), Ctrl+Shift+R, `Financije_all`, Overview → Košare, rasklopi MC 11.11.
2. Otvori jednu kupnju u View (npr. treću), Back ⇒ ona je označena (ponašanje od S171).
3. Na **drugoj** kupnji (npr. sedmoj) dodir na **↗** ⇒ Activities, `Custom` = dan te kupnje.
4. Tab **Overview**. **Očekivano:** This Year, Košare otvorene, MC 11.11. rasklopljena, **sedma**
   kupnja označena (obojena, uokvirena) i u vidiku. Treća više nije označena.
5. Varijanta: u Activities nakon ↗ otvori neki redak u View, Back, pa tab Overview ⇒ označen je
   redak zadnji prikazan u View-u (ako je u košari), jer je to mjesto gdje si stao.
- **Pad:** označena treća (stara oznaka), ili ništa.

---

## T-S175-6 ✅ (22.10., Saša na TEST-u: export bez Aree javlja, naslov pločice promijenjen i vraćen uvozom) (TEST lokalno, Saša) F5 — sheet `AreaSettings` u Structure roundtripu

Novo: Structure export nosi sheet `AreaSettings` (`Area | Path | Type | Value`) sa svim postavkama
Aree koje ne nose ostali sheetovi. Za `Financije_all` to su `dashboard`, `groupings` i
`export_profiles`, ukupno **325** redaka (izmjereno na TEST-u 19.10.; PROD isto). Export je sada
**jedna Area**. Automatski: `areaSettingsSheet.test.mjs` (29, roundtrip nad stvarnim PROD configom
svih Area) i E2E `S175_area_settings_roundtrip` (sabotaže „ne briše" i „sekcija isključena" padaju).

1. `npm run dev` (TEST), Ctrl+Shift+R. Area **All Areas** → tab Structure → **Export**.
   **Očekivano:** gumb blijed, dodir ⇒ crvena poruka *„Select an Area in the filter…"*, file ne izlazi.
2. Area `Financije_all` → Export. U fileu sheet **AreaSettings**: **325** redaka + HELP ispod;
   kolona `Type` popunjena; profil `Kokin_format` ima ključeve `attr:{Area}||Transakcija||…`.
3. Isti file → Import. **Očekivano:** *„Nothing to import"*, red `Area settings changed (areas)` = **0**
   (sivo), kao i `Automations` / `List columns`.
4. U fileu redak `dashboard.widgets[1].title` (`Kamo ide novac`) promijeni u `Kamo ide novac T`,
   spremi, Import. **Očekivano:** `Area settings changed (areas)` = **1**, ispod
   `↳ Financije_all: dashboard`; Overview → pločica razreza se zove `Kamo ide novac T`.
5. Vrati naslov (isti postupak) ⇒ opet `1`, pa ponovni uvoz istog filea ⇒ `0`.
- **Pad:** korak 3 pokaže `1` (svaki uvoz bi prepisivao config); korak 4 ne pokaže popis ili
  promijeni još nešto osim `dashboard`; Overview nestane (pločica pokvarena).

---

## T-S175-7 ✅ (S175, automatski) „Create categories & continue" ne dira postojeću Areu

Saša (S175): napredak Aree ne smije se vratiti unatrag slučajnim putem. Activities export nosi i
Structure sheetove; kad file ima kategoriju koje nema, uvoz nudi „Create categories & continue", a
taj je do S175 pokretao cijeli Structure uvoz. E2E `S175_create_categories_keeps_area`: Area (Trans,
Druga) → Activities export → u bazi naslov pločice `Staro → Novo`, opcija `C` dodana, Druga obrisana →
uvoz filea → Korak 7 ⇒ Druga ponovo postoji, naslov `Novo`, opcije `A, B, C`. Sabotaža (opcija
isključena) ⇒ naslov `Staro`. Ručni test ne treba: korak nije na PROD-u u svakodnevnoj upotrebi.
