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
