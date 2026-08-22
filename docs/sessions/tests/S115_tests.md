# S115 — detaljni testovi (2026-08-22, druga sesija istog dana)

**Tema sesije:** razgovor i mjerenje, bez koda. Provjereno stanje sidara, izmjeren razmak
između Kokinog filea i baze, razriješena dva otvorena pitanja (`845,12`, retci iz 2036.),
i donesen plan za PROD koji stoji na jednom svojstvu `036` koje **još nije provjereno uživo**.

**Napravljeno uživo, bez zasebnog testa:**

- **`845,12` obrisan iz baze** — event `2831e332-…`, 7 atributa, DELETE vratio retke i
  provjera potvrdila da ga više nema. Bio je `Tip = N/A`, bez opisa, bez `Datuma naplate`.

---

## T-S115-1 ⭐ ZABA pločica više nema liniju „planirano"

**Zašto:** `845,12` je bio **jedini** planirani redak na tom računu. Linija „planirano" na
pločici tvrdi *„ovo će još pomaknuti stanje"* — a taj iznos nije poznat ni banci ni Koki.
Brisanje je izvedeno kroz servisni ključ (zaobilazi RLS), pa se u UI-ju mora vidjeti da je
prošlo i kroz normalan put čitanja.

**Preduvjet:** Overview tab, Area `Financije_all`, TEST baza.

1. Otvori Overview → pločica `Kokin tekući ZABA`.
2. Pogledaj postoji li ispod iznosa redak `planirano −845,12 € (1)`.
   - **Očekivano:** redak **ne postoji** — na ZABA računu nema nijednog `Planiran` retka.
   - **Pad:** redak i dalje stoji ⇒ keš u pregledniku (osvježi) ili event nije obrisan
     (provjeri skriptom, ne pogledom).
3. Activities → filtar na `Financije_all`, `Status = Planiran`.
   - **Očekivano:** ZABA nema pogodaka; MC/Visa planirani retci (srpanj) su i dalje tu.
   - **Pad:** pogodak na ZABA ⇒ nije obrisan onaj koji smo mislili.

---

## T-S115-2 ⭐ Sidro čini račun vidljivim i BEZ ijednog eventa

**Zašto:** **cijeli plan za PROD stoji na ovome.** Ako sidro samo po sebi prikaže račun,
Koka ne treba nikakvu povijest u PROD bazi — dovoljno je da upiše stanje sa svog ekrana banke
i saldo je od tog trena točan. `036` to tvrdi u kodu (`keys` je `UNION` brojanih grupa **i**
sidara; komentar u fileu kaže *„potvrđeno 1.240,00 i ništa se nije dogodilo je odgovor, nije
odsutnost"*), ali **nikad nije provjereno uživo** — dosad je svaki račun ionako imao evente.

⚠ Ako ovo padne, plan za PROD se mijenja iz temelja: onda povijest (ili barem nekoliko
redaka po računu) **mora** ići na PROD prije nego ona išta vidi.

**Preduvjet:** TEST baza, SQL `036` pušten.

1. Upiši sidro za grupu koja **nema nijedan event** — npr. `group_value = 'Test prazan racun'`,
   iznos `1.000,00`, `confirmed_on` = danas (SQL Editor ili skripta).
2. Otvori Overview → pločica `Stanje po računu`.
   - **Očekivano:** pojavio se redak `Test prazan racun` s iznosom `1.000,00 €` i oznakom
     **`0 promjena poslije`**; polje „u banci" i gumb „Potvrdi" su dostupni.
   - **Pad:** redak se ne pojavljuje ⇒ RPC ipak izvodi popis grupa samo iz eventa.
3. Obriši testno sidro.
   - **Očekivano:** redak nestaje s pločice.

---

## T-S115-3 Uvoz kolovoza ne smije donijeti retke iz 2036.

**Zašto:** ta dva retka (`Mirovina 1.323,64`, `Netdomena Igor 47,76`, oba `2036-04-08` u
Kokinom fileu) **već postoje u bazi** kao `2026-04-08`, uredno klasificirani, ušli preko
travanjskog izvoda. „Popravi godinu pa uvezi" bi ih udvostručio — i to **tiho**, jer padaju
prije ZABA sidra pa ne bi pomaknuli nijednu kontrolnu brojku.

**Preduvjet:** uvoz kolovoza iz `Financije 2026-08-16.xlsx` (ili novije verzije).

1. Prije uvoza prebroji evente u travnju 2026. za `Financije_all`.
   - Referenca izmjerena danas: **111 eventa**, od toga `1.323,64` i `47,76` na `2026-04-08`.
2. Uvezi kolovoz.
3. Ponovo prebroji travanj 2026.
   - **Očekivano:** **i dalje 111** — kolovoški uvoz ne dira travanj.
   - **Pad:** 113 ⇒ retci iz 2036. su „popravljeni" i uvezeni ⇒ obriši dodane, ne originalne.
4. Provjeri i da retci s godinom **2036** nisu ušli takvi kakvi jesu.
   - **Očekivano:** nijedan event s `event_date` u 2036.
   - **Pad:** postoje ⇒ generator ne filtrira budući datum; dodaj branu.

---

## T-S115-4 Kolone po Arei — generička Area ostaje netaknuta

**Zašto:** feature se gradi sutra; ovo je test koji ga čuva od regresije. Konfiguracija kolona
ide u `areas.settings` **po Arei**; Area koja je nema mora izgledati točno kao danas.

⚠ Test se piše sad da se ne zaboravi, izvodi se **nakon** implementacije.

1. Area `Financije_all` → Activities lista.
   - **Očekivano:** `Datum | Smjer + iznos | Tip / Podtip | Opis | ⋮` — bez `Time`, bez
     `Category`, bez `Events`.
   - Uski ekran (mobitel): isti podaci u **dva reda**, ništa se ne gubi.
2. Bilo koja druga Area (npr. `Health`) → Activities lista.
   - **Očekivano:** današnji generički izgled, nepromijenjen.
   - **Pad:** promijenio se ⇒ konfiguracija curi izvan svoje Aree.
3. Structure export → import iste Aree (roundtrip).
   - **Očekivano:** postava kolona preživi.
   - **Pad:** ne preživi ⇒ ista rupa kao `export_profiles` i `dashboard` (backlog).
