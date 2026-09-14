# Sljedeća sesija — handoff

**Pisano protiv commita:** `ddb2b34` + nespremljene izmjene zatvaranja S136
(idu istim commitom). **`main` = `e3f8968`** (deployano 14.09. popodne).
Ako `git log` pokazuje novije, čitaj ovo kao povijest; CLAUDE.md je autoritet.

---

# DIO 1 — netehnički (za Sašu)

## Gdje smo

| | stanje |
| --- | --- |
| Deploy na PROD | ✅ izveden 14.09. |
| Testova otvoreno | **156 → 21** |
| Backup se može **vratiti** | ✅ dokazano na TEST-u |
| Faza 3 (automatika na uvozu) | ⛔ **otpala — izmjereno da meta ne postoji** |

## Ono što je danas bilo najvažnije

**Backup je prestao biti nada.** Do jučer je PROD imao kopiju i **nijedan dokaz** da
se iz nje može vratiti. Sada postoji `restore_db.py`, i dokazan je: obrisano 55
redaka na TEST-u, vraćeno, i **sadržaj je ispao identičan u znak** (ne samo „retci
su se vratili").

Tvoja briga — *„da ne prepišemo novije podatke starim backupom"* — nije riješena
upozorenjem nego **oblikom alata**: zadano je „samo ispiši što bi se dogodilo",
a način koji stvarno briše traži da utipkaš `OBRISI`. Provjereno i obrnuto: nad
retkom novijim od snimke sigurni način javlja *„ne brišem ništa"*.

**A Faza 3 je otpala, i to je dobra vijest.** Backlog je tvrdio da bi otključala tri
stvari. Mjerenje kaže: `Datum naplate` je prazan na **0 od 5.192** redaka — Python
alati ga već pune. Dakle bio bi to kod koji čeka podatke. Spremljeno je **kad** je
treba ponovno otvoriti, da se hipoteza ne gradi nanovo.

## Što tebe čeka — redoslijedom

1. **Deploy** (kad poželiš). Na `test-branch` čeka **pet** promjena ponašanja koje
   PROD još nema: ⋮ meni, „Nepoznata Area", imenovana skrivena polja s klikom,
   oznaka *skriveno*, `sharedContext` guard.
   ⚠ Tvoj terminal je **PowerShell**, koji nema `&&`:
   ```powershell
   git checkout main
   if ($?) { git merge test-branch --no-edit }
   if ($?) { git push origin main }
   git checkout test-branch
   if ($?) { git merge main --no-edit }
   if ($?) { git push origin test-branch }
   ```
2. **Tri minute testova** koje samo ti možeš: `T-S134-4` (pokreni
   `backup_to_external.bat`), `T-S133-8` i `T-S133-5` (TEST, isti postupak kao
   `T-S134-8` koji si danas odradio).
3. **Financije `--apply`** — 9 stavki koje stoje od S129/S130/S131.
4. **Jedna odluka:** `T-S131-21` — `structureExcel.test.mjs` je odrezan u gitu od
   S17; dopuniti ga ili obrisati.

## Što treba od Koke

Ništa.

---

# DIO 2 — tehnički (za Claudea)

## Stanje

- `test-branch` = `ddb2b34` + zatvaranje S136. `main` = `e3f8968`.
- **PROD i TEST su poravnati na `052`**, i sheme obje baze u gitu su **svježe**
  (`dump_schema.py --diff` javlja „isto" na obje).
- ⚠ Auto-mode klasifikator Claudeu **blokira `main`** i složene `git` pozive.
  Naredbe se daju Saši, u **PowerShell** obliku (`&&` ne postoji — na tome je danas
  puknuo prvi pokušaj, jer je CLAUDE.md nosio bash oblik; ispravljeno).

## Otvoreno — 21, po vrsti

- **Čeka deploy (4):** `T-S136-6`, `-8`, `-9` + provjera oznake *skriveno*.
- **Sašina ruka, minute (3):** `T-S134-4`, `T-S133-8`, `T-S133-5`.
- **Financije `--apply` (9):** `T-S131-28`, `T-S130-6..10`, `T-S129-A8/A9`.
- **Pravi posao, ne test (4):** `T-S135-11` (zašto E2E suite ruši sam sebe —
  hipoteza vodi na **Postgres upgrade**, dakle na trošak, ne na kod) · `T-S136-7`
  (poruka u Export modalu se crta ~200 redaka JSX-a niže od gumba ⇒ izvan ekrana) ·
  `T-S108-9` (paginacija bez `.order()`) · `T-S131-34` (neponovljen `VIEWSTALE`).
- **Stari pipeline (4):** `T-S107c-2/d-4/i-6/j-1` — čekaju batch 2024/2023.

## Što je danas naučeno, a vrijedi šire

- **Dva testa su dala točan ishod iz krivog razloga** (`T-S134-8` na PROD-u gdje je
  Saša grantee; `T-S136-3` nad praznom formom, gdje `canSave` gasi Finish umjesto
  `is_required`). Oba spašena pitanjem *„bi li ovo prošlo i da je kod pokvaren?"*
- **Instrument koji prijavi prvi razlog sakrije postojanje drugog** — dvaput istog
  dana: `audit_tests.py` nije vidio ID-eve `T-S129-A7` (i S129 prijavljivao kao
  „spremno za arhivu" uz 4 otvorena testa), a moja sonda je `Stanje` označila samo
  kao `hidden_in_add` iako nosi **i** `depends_on`.
- **Šum u instrumentu je skuplji nego što izgleda:** `--diff` je zbog nasumičnog
  `\restrict` tokena uvijek pokazivao dva lažna hunka, pa je prava razlika stajala
  među lažima.

## Ako se dira Faza 3

**Ne prije nego pročitaš `docs/FAZA3_IMPORT_AUTOMATIKA.md`.** Ondje su brojke, pet
odluka koje prethode kodu, okidač za ponovno otvaranje, i jedna zamka: `Visa =
next:3` primijenjen na uvozu proizveo bi krive datume na stotinama redaka, tiho.

## Nepromijenjeno

Sidra, delta sheet, tranše, Overview — nedirano. Vrijedi CLAUDE.md i `DONE_HISTORY`
S129–S136.
