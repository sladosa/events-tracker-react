# S143 — detaljni testovi

**Sesija:** 2026-09-20 · grana `test-branch` · `main` netaknut
**Tema:** sort je mogao progutati sekciju i sažetke; dva upozorenja koja su lagala; okvir praznih redaka.

> Većina ovih testova je **izvedena uživo na PROD-u tijekom same sesije** (Saša je izvozio i
> sortirao, Claude mjerio). Ostaje malo za ponovnu provjeru — v. status u
> [../PENDING_TESTS.md](../PENDING_TESTS.md).

---

## T-S143-1 — okvir praznih redaka (✅ izvedeno)

**Zašto:** `pattern: 'solid'` prekriva Excelove gridline-ove, pa je blok praznih redaka
izgledao kao jedna žuta ploha umjesto kao retci s ćelijama — a to je **jedino mjesto gdje
čovjek upisuje**. Povijesni retci raster imaju (`THIN_BORDER`).

**Koraci:** izvezi delta file → pogledaj prazne retke ispod glavnog bloka.
**Očekivano:** svaka ćelija ima tanki **svijetlosivi** okvir (`FFCCCCCC`), do zadnje
podatkovne kolone. `Stanje (kontrola)` i `Potvrda` su **bez** okvira i tona.
**Pad:** blok izgleda kao jedna ploha.

---

## T-S143-2 — uvoz više ne prijavljuje `created_at < session_start` (✅ izvedeno)

**Zašto:** provjera se nije mogla učiniti ispravnom (file nosi samo doba dana), a hvatala je
**mehanizam samog appa** — `findFreeSessionStart` traži slobodnu minutu, pa pri brzom unosu
minuta odmakne ispred spremanja. Izmjereno na PROD-u: **10 od 8.009** redaka, ali **8 od tih
10 u jednom delta prozoru**. I poruka je lagala: tvrdila je *„Row will still be imported"* za
retke koji se preskaču (8 od 8 bilo je među 99 nepromijenjenih).

**Koraci:** izvezi delta file, promijeni jedan komentar, uvezi.
**Očekivano:** u „Notes" **nema nijedne** poruke o `created_at` / `session_start`.
**Pad:** poruke se vrate.

---

## T-S143-3 — izvoz više ne tvrdi „ne izvozi svih N događaja" (✅ izvedeno)

**Zašto:** `totalCount` je broj događaja koje hvata **filtar**, a otkad se prozor mjeri
sidrima (S142) prozor ga može daleko prerasti. Izmjereno na `Prozor = 2`: filtar **268**,
prozor **627 dana i do 1.388** događaja — rečenica je tvrdila suprotno od istine.

**Koraci:** Export modal → uključi Delta sheet → pročitaj žuti okvir.
**Očekivano:** *„ne izvozi filtrirani popis nego **prozor usklađenja**, koji zna biti i širi
od raspona u filtru"* — bez ijedne brojke.

---

## T-S143-4 — ⭐ sort vrpcom više ne guta sekciju (✅ izvedeno, Test A)

**Zašto:** Excelov ribbon sort i `Ctrl+A` ne gledaju `autoFilter` nego **tekuću regiju**, a nju
omeđuje samo redak **bez ijedne** popunjene ćelije. Kontrola košare je sjedila odmah ispod
praznih redaka i premošćivala jaz.

**Koraci:** izvezi → klikni ćeliju u podacima → **Ctrl+A** → pogledaj odabir.
**Očekivano:** odabir kreće na **retku zaglavlja** i staje na **zadnjem praznom retku**
(izmjereno `A25:AB100`). Sažeci gore i košara dolje su **izvan**. Sortiraj: `razlika` ostaje
`0,00`, upozorenje **ne** osvane, sekcija ostaje dolje.
**Pad:** odabir doseže do sekcije ⇒ prazan redak ne obavlja posao.

---

## T-S143-5 — ⭐ nasilni sort: brojke ne lažu, list se sam prijavi (✅ izvedeno, Test B)

**Koraci:** Name Box → raspon od prvog podatkovnog retka **preko cijele sekcije** → Data →
Sort po `event_date` → *„Continue with the current selection"*.
**Očekivano, tri stvari:**
1. `razlika` ostaje **`0,00`** — `SUMIFS` rasponi sežu do kraja sekcije, pa rezultat ne ovisi
   o tome gdje je koji redak završio.
2. U retku iznad sažetaka osvane **crveno**: *„POMIJEŠAN RASPORED … novi izvoz će srediti."*
3. **Sažeci ostaju na mjestu** (`stanje` / `u banci piše` / `razlika`).
**Izmjereno:** sve tri ✓. `Σ košara` je pao s `973,96` na `1.024,96` — očekivano, to je
šteta na rasporedu koju novi izvoz popravlja, i zato poruka postoji.
**Pad:** `razlika` odskoči s nule ⇒ pravi kvar.

---

## T-S143-6 — ⭐ stari file (zaglavlje odmah ispod naslova) se i dalje uvozi

**Zašto:** S143 je između naslova `EVENT DATA:` i zaglavlja umetnuo prazan redak. Uvoz je
dotad računao `titleRow + 1` i time bi pokazao na prazan redak, a **pravo zaglavlje čitao kao
prvi podatkovni redak** — ponudio bi upis retka čiji je `event_id` doslovno `event_id`.

**⬜ Ostaje uživo:** uvezi **file izvezen prije 20.09.2026.** (Koki takvi znaju ležati danima).
**Očekivano:** uvoz prolazi normalno, bez poruke o zaglavlju i bez retka `event_id`.
**Pokriveno automatski:** `importForeignRows.test.mjs` (3 tvrdnje, file kojem je prazan redak
uklonjen `spliceRows`-om).

---

## T-S143-7 — `Potvrda` je uska, `Provjeri` je došao u vidljivo polje (✅ izvedeno)

**Očekivano:** `Potvrda` širine 12; tekst oznake se **prelijeva udesno** preko praznih ćelija
i čita se cijeli. `Provjeri` (u sekciji) više nije odgurnut izvan ekrana.
⚠ Sigurno je **samo** dok se ta dva stupca ne pune u istom retku — čuva tvrdnja u testu.

---

## Automatski pokriveno (ne traži ručnu provjeru)

| što | gdje |
| --- | --- |
| okvir praznih redaka, raspon, alatni stupci bez okvira | `deltaSheetLayout.test.mjs` (+3 sabotaže) |
| sivi ton potvrđenih redaka **postoji** i **uvjetni** je | isto (+2 sabotaže) — dotad ga nijedna tvrdnja nije mjerila |
| prazan redak ispod praznih redaka i iznad zaglavlja | isto (+2 sabotaže) |
| `SUMIFS` rasponi sežu do kraja sekcije, jednaki među sobom | isto |
| `razlika` bez `LOOKUP`, kroz `ROUND` | isto |
| detektor: postoji, formula, nosi rješenje, gleda samo glavni blok | isto (+2 sabotaže) |
| `Potvrda` uska + nikad sudara s `Provjeri` | isto (+2 sabotaže) |
| uvoz bez `created_at` upozorenja; stari oblik filea | `importForeignRows.test.mjs` (+1 sabotaža kroz `git stash`) |

**Ukupno:** `deltaSheetLayout` 49 → **80** tvrdnji, `importForeignRows` 27 → **33**.

---

# Drugi dio sesije — faze 3 i 4, i ono što su otkrile

## T-S143-11 — ⬜ ⭐ Kontrolna točka po sidru (faza 3)

**Zašto:** do faze 3 je redak upisan u potvrđeno razdoblje proizvodio **samo oznaku**. Saldo
se na njega ne miče (retci prije sidra u njega ne ulaze), pa nijedan broj nije odavao da je
potvrđeno dirnuto. Sašin nalaz uz T-S142-4.

**✅ Izvedeno uživo (20.09.):** `Prozor = 1` → jedna točka, `0,00` zeleno. `Prozor = 2` → dvije
točke, obje `45,94` crveno.

**⬜ Ostaje nakon ispravka podataka (T-S143-14):** obje točke moraju pasti na **`0,00`**.

⚠ Test se **ne smije** izvesti na računu bez sidra u prozoru — ondje kontrolnih točaka po
definiciji nema (pokriveno automatski).

---

## T-S143-12 — ⬜ ⭐ Update-guard na uvozu (faza 4)

**Preduvjet:** ZABA, bilo koji izvoz čiji prozor doseže **prije 30.07.2026.** (`Prozor = 2`).

**Koraci:**
1. U nekom retku datiranom **prije 30.07.2026.** promijeni komentar.
2. Uvezi taj file.

**Očekivano:**
- uz taj redak **siva oznaka** `potvrđeno 30.07.2026. · 13815.33`
- ispod liste **druga kvačica**: *„⚠ 1 redak je unutar POTVRĐENOG stanja"*
- **Apply je zaključan** dok se ne kvačira; tooltip to kaže
- prva kvačica (*„I reviewed the list"*) **ne otključava** sama

**Pad:** Apply prolazi s jednom kvačicom ⇒ dva pitanja su se stopila u jedno.

⚠ **Piše u bazu** — radi to na retku koji ionako treba ispraviti, ili poslije vrati Editom.

---

## T-S143-13 — ⬜ Guard šuti gdje nema što reći

Uvezi file za račun/Areu **bez sidara** (npr. neka Area bez `dashboard` widgeta).
**Očekivano:** nijedna siva oznaka, nijedna druga kvačica — ponašanje doslovno kao prije faze 4.
⚠ Isto mora vrijediti ako čitanje sidara padne: guard tada **šuti**, ne tvrdi „ništa nije
potvrđeno".

---

## T-S143-15 — ✅ `FILTERS_IZVRSENO` više ne nosi `Cash`

**Izmjereno 20.09.** `rpc_area_balance_anchored` na danas:

| | ZABA |
| --- | --- |
| ispravno (`Racun`) | **12.284,32** = pločica u appu |
| stari filtar (`Racun`+`Cash`) | 12.274,32 |

Razlika je `2026-09-08 · ručak s Jelenom · −10,00 · Izvor = Cash`.

⚠ `promet_check` ispis se **nije** promijenio (27 ✓ / 5 ✗) i to **nije** dokaz da popravak nije
trebao: jedini `Cash` redak s `racun = ZABA` prije zadnjeg izvoda pada 27.08., a zadnji
obrađeni prozor staje na 26.08. Mina je ležala namještena.

---

## T-S143-14 — ⬜ ⚠ **Piše u bazu (Saša):** tri ispravka koje je faza 3 otkrila

Skripta još **nije napisana** — dry run pa `--apply` koji pokreće Saša.

| # | redak | zahvat |
| --- | --- | --- |
| 1 | `17.08.2025. · −45,94 · bez opisa`, `Izvor = Racun` | **obrisati** — fantom, banka ga nema |
| 2 | blizanac istog dana/minute, bez `Izvor`a, komentar `ZABA` | odluka: vjerojatno i njega |
| 3 | `−0,80` na `07.08.2025.` | pomaknuti na **`07.07.2025.`** (tipfeler u mjesecu) |

**Dokaz prije zahvata (izmjereno):**
- parsiranje `ZABA_2025-07` i `-08` se poklapa s **ispisanim** bankinim zbrojevima i
  `NOVO STANJE` izlazi u cent ⇒ banka doista nema redak od 45,94
- `promet_check` 2025-09 = `0,00` ⇒ nije ni prebačen u sljedeći mjesec
- redak nema `Izvod opis` ⇒ nikad nije potvrđen izvodom
- nosi `Stanje = 2.267,56` ⇒ dolazi iz povijesnog uvoza Kokine Excelice

**Očekivano poslije:** `promet_check` 2025-07 i 2025-08 → `0,00`; kontrolne točke na
`Prozor = 2` → `0,00`; **pločica se NE mijenja** (`12.284,32`), jer su svi ti retci prije
sidra 30.07.2026.

⚠ Oba su blizanca u **istoj minuti**, pa ih aplikacija prikazuje kao **jedan redak**
(`useActivities` grupira po `session_start`) — zato ih nitko nije primijetio.

---

## T-S143-16 — ⬜ Help

U Help → Excel moraju postojati tri nove teme: **kontrolne točke potvrda**, **kako sigurno
sortirati**, **uvoz retka koji je već potvrđen**. Provjeri da ih AI nalazi (pitaj npr.
*„što znači POMIJEŠAN RASPORED"*).

---

## Automatski pokriveno (drugi dio)

| što | gdje |
| --- | --- |
| kontrolne točke: po jedna po sidru, redoslijed, `ROUND`, raspon, CF, mjesto poruke | `deltaSheetLayout.test.mjs` (+4 sabotaže) |
| retci zaglavlja su doista **rezervirani** (apsolutno sidro, ne relativno) | isto |
| pravilo „je li redak potvrđen": najranija potvrda, granica `>=`, po računu, bez vremenskih zona | `confirmedPeriod.test.mjs` — **16 tvrdnji, 3 sabotaže** |

**Ukupno nakon cijele sesije:** `deltaSheetLayout` 49 → **95**, `importForeignRows` 27 → **33**,
nov `confirmedPeriod` **16**.
