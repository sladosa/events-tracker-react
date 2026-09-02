# S125 — detalji testova (2026-09-02)

Popis: [PENDING_TESTS.md](../PENDING_TESTS.md)

---

## Kontekst

Sesija je krenula od Sašinog pitanja „banka kaže 1.920,34, app 1.935,34 — gdje je
15 €", a završila s `043` na PROD-u, zatvorenim BUG-S123-EDITMARK, novom sekcijom
košare u delta sheetu i **Excel putem za ispravak tuđeg retka**.

⚠ **Sve je izvedeno i izmjereno na PROD-u**, uživo, s Kokinim i Sašinim računom.
Ono što je ovdje ⬜ nije neizvedeno nego **neprovjereno pogledom** — mjerenja nad
bazom su prošla, ali ih nitko nije potvrdio u aplikaciji.

**Kod je na `test-branch`. PROD ima migracije `043` i `044`, ali NE i kod od
`c156057` nadalje** — `main` je na `bb13153` (S124). Sve niže opisano radi
**lokalno protiv PROD baze**, ne na `events-tracker-react.netlify.app`.

---

## Izmjereno strojno — ne traži nikoga

| kontrola | rezultat |
| --- | --- |
| razlika od 15 € razriješena: `Izvor` Visa → Racun na retku `rest. Kvatrić` | ✅ pločica = banka, 1.920,34 |
| `043` na PROD-u: `events.edited_by` odgovara s 200 | ✅ (prije `400 column does not exist`) |
| select koji app šalje za listu prolazi | ✅ — deploy ne može srušiti listu |
| UI ispravak tuđeg retka (Koka nad Sašinim `rest. Kvatrić`) | ✅ autorstvo ostalo, `edited_by` upisan, 8/8 atributa preživjelo pod autorom |
| Excel ispravak tuđeg retka (Koka nad Sašinim `Studio Nataši`) | ✅ 10 → 10 redaka (bez duplikata), 1 promijenjen, autorstvo Sašino, `edited_by` Kokin, 8/8 atributa pod Sašom |
| `Σ košare 03.09.` prije i poslije oba uvoza | ✅ 205,36, nepromijenjena |
| unit testovi | ✅ `deltaSheetLayout` 31 · `importForeignRows` 21 · `deltaAccount` 11 |
| E2E `T-S123-3` (✎ na oba rasporeda) | ✅ 34 s; pada kad se popravak vrati unatrag |

---

## T-S125-1 — ⭐ oznaka ✎ na tuđem retku, DESKTOP širina

**Zašto:** BUG-S123-EDITMARK je tri sesije vođen kao „E2E okolina". Zapravo ju
desktop grana (`cellContent` za ulogu `actions`) uopće nije crtala — imao ju je
samo uski raspored.

**Preduvjeti:** prijavljen kao **Saša**; Koka je ispravila barem jedan njegov redak
(`Studio Nataši` i `rest. Kvatrić`, oba 28.08., to jesu).

1. Activities → Financije_all, širok prozor (≥ 640 px)
2. Nađi redak `28.08. Studio Nataši −2,70`
3. Pogledaj **lijevo od ⋮**, u istoj ćeliji

**Očekivano:** mala narančasta **✎**; hover daje `Izmijenio/la: … · 02.09.2026. …`

**Pad:** nema oznake ⇒ desktop grana opet ne crta. Usporedi s uskim ekranom prije
nego išta zaključiš — razlika između ta dva je cijela dijagnoza.

---

## T-S125-2 — ista oznaka na USKOM ekranu

Suzi prozor ispod 640 px i pogledaj isti redak.

**Očekivano:** ✎ stoji uz ⋮ i ondje.

Vidi li se na uskom a ne na širokom — vratio se točno kvar koji je S125 popravio.

---

## T-S125-3 — ⭐ sekcija KOSARA nosi i već potvrđene retke

**Zašto:** sekcija je do S125 birala samo `Status = Planiran`, pa je redak koji je
netko prebacio u `Izvrsen` bez potvrde izvodom ispadao iz **obje** strane — iz
glavnog bloka jer je kartični, iz sekcije jer nije planiran. Kontrola košare bi tada
pokazala razliku koju na listu ništa ne objašnjava (izmjereno: 55,00).

1. Filtar: Area `Financije_all`, atribut `Racun = Sašin tekući RF`
2. Export → profil `Kokin_format` → ✔ **Delta sheet** → Download

**Očekivano:**

- naslov sekcije počinje s **`KOSARA`**, ne `PLANIRANO`
- u sekciji su **svi** retci s dospijećem 03.09., bez obzira na `Status`
- `Σ košara (gore)` = **205,36**
- `Max/Min/Summ` glavnog bloka **ne uključuju** sekciju (`Summ` isplata = 79,19)
- kontrolni stupac uz sekciju je **prazan**, nikad `0,00`

---

## T-S125-4 — stupac `Provjeri`

1. Pogledaj stupac desno od `Stanje (kontrola)`
2. Naslov **`Provjeri`** mora stajati u **retku-razdjelniku** (uz `KOSARA`), ne u
   zaglavlju lista
3. Klikni na taj naslov

**Očekivano:** objašnjenje iskoči kao **Data Validation input message** uz ćeliju,
ne kao bilješka (koja kod desnog ruba izlazi izvan ekrana, a pri skrolanju joj se
odreže dno). Uz redak koji je `Izvrsen` a dospijeva u budućnosti stoji
*„dospijeva tek 3.9.2026. — nije moglo biti naplaćeno"*.

4. Promijeni tom retku `Status` u `Planiran` i izađi iz ćelije

**Očekivano:** poruka **nestane istog trena** — formula nad `TODAY()`, ne upisan tekst.

⚠ Drugi slučaj (`Planiran`, a dospijeće prošlo) traži redak sa starim dospijećem.
Poruka mora glasiti *„potvrdi TEK s izvoda"*, **nikad** „promijeni u Izvrsen" — to je
odbačeni automat, i test u `deltaSheetLayout` pada ako se ta riječ vrati.

---

## T-S125-5 — ⭐ Excel: vlasnik Aree ISPRAVLJA tuđi redak

**Preduvjeti:** prijavljen kao **Koka** (vlasnica `Financije_all`).

1. Export s delta sheetom (kao T-S125-3)
2. U sekciji promijeni `Status` jednom **Sašinom** retku
3. Import → „Multi-user file detected" → **Ispravi kao vlasnik Aree** → Continue

**Očekivano:**

- **0 New**, **1 Modify**, ostali `Unchanged`
- **nema** upozorenja „event_id no longer matches the database"
- diff imenuje baš taj redak i baš `Status`
- nakon Apply: autorstvo ostaje autoru, `edited_by` = Koka, broj atributa
  nepromijenjen, atributi i dalje pod autorom

**Pad koji treba prepoznati:** „will be imported as NEW events" znači da bi Apply
napravio **duplikat**. To je bio kvar u reklasifikaciji i previewu.

---

## T-S125-6 — Excel: tuđi redak se NE briše

1. Kao T-S125-5, ali tuđem retku upiši **`DELETE`** u kolonu `Delete?`
2. Import → **Ispravi kao vlasnik Aree**

**Očekivano:** upozorenje *„tuđi redak se ne može obrisati — vlasnik Aree ga smije
ISPRAVITI, ali ne i obrisati. Oznaka DELETE je zanemarena."*; redak **ostaje** i
**zadržava sve atribute**.

⚠ **Najvažniji pad ako padne.** Bez zaštite bi atributi bili obrisani (RLS iz `020`
to vlasniku Aree dopušta) a event bi preživio — redak uništen, a prisutan. Čuva ga
`importForeignRows.test.mjs`, ali nad stvarnim RLS-om to nije potvrđeno.

---

## T-S125-7 — ponuda „Ispravi kao vlasnik" je ugašena kad ne pripada

**Preduvjeti:** prijavljen kao **Saša** (grantee, nije vlasnik `Financije_all`).

1. Uvezi file koji sadrži Kokine retke
2. Pogledaj treću opciju

**Očekivano:** ugašena, uz *„Nedostupno — nisi vlasnik Aree u kojoj ti retci žive."*

**Pad:** ako je aktivna, klik daje RLS odbijanje — koje se sada bar **broji**
(„ispravak nije prihvaćen (tuđi redak — jesi li vlasnik ove Aree?)"), a ne prolazi
kao uspjeh.

---

## T-S125-8 — ugašena kvačica Delta sheeta objašnjava sebe

1. U Filter panelu makni filtar računa
2. Otvori Export

**Očekivano:** kutija posivi, kvačica ugašena, tekst ima **Zašto je ugašeno** i
**Što učiniti** (filtar u panelu *ili* drill s Overview pločice). Uz odabran profil
stoji i redak da profil nema vlastiti filtar pa se grupa uzima iz panela.

---

## T-S125-9 — brojač događaja u delta načinu ne laže

Uključi ✔ Delta sheet.

**Očekivano:** zelena kutija „N events will be exported" zamijenjena jantarnom
*„Delta sheet — ne izvozi svih N događaja"* + što file stvarno nosi.

**Zašto:** u delta načinu se puni izvoz uopće ne dogodi, pa je stara brojka bila
mimo za red veličine.

---

## T-S125-10 — izvoz koji ne može učitati podatke PADA, ne izlazi prazan

**Zašto:** `excelDataLoader` je šest mjeseci odbacivao `error` destrukturiranjem, pa
je jedan pali upit na `attribute_definitions` dao file **bez ijedne atributske
kolone** — a izgledao je uredno.

**Kako izazvati:** teško namjerno, kvar je bio prolazan. Ponovi li se, očekuje se
poruka oblika `Izvoz prekinut - ne mogu ucitati definicije atributa: …`, a **ne**
file s praznim kolonama.

⚠ Vidiš li ikad „Kontrolni stupac preskočen: ne nalazim kolone za uplatu/isplatu"
nad Areom koja atribute ima — to je **taj** kvar, ne problem delta sheeta.
