# S117 — detaljni testovi (2026-08-24)

Većina S117 rada je **provjerena istog dana**. Ovdje su samo testovi koji su ostali
**otvoreni**, plus jedan koji se rukom teško okida pa mu treba namješten uvjet.

---

## T-S117-1 ⭐ — Slobodna minuta pri unosu unatrag

**Ovo je jedina grana novog koda koju testiranje 24.08. NIJE okinulo.**

`eventAt` uzima sat otvaranja ekrana i mijenja mu samo dan, pa je odabrani dan u toj
minuti gotovo uvijek slobodan. Da bi se grana okinula, minuta mora biti **zauzeta**.

**Namještanje uvjeta:** uvezeni kolovoški ZABA retci sjede na `14:00`–`14:13`.

1. Otvori Add Activity **između 14:00 i 14:13** (po satu).
2. Postavi datum na **02.08.2026.** (ondje postoji redak s tom minutom).
3. Ispuni `Racun = Kokin tekući ZABA`, `Izvor = Racun`, `Smjer = Isplata`, `Isplata = 1`,
   `Tip/Podtip` bilo što. Finish.

**Očekivano:** zapis se spremi **normalno**, i u listi je **zaseban redak** — ne spoji se
s postojećim retkom te minute. Kroz ⋮ → View vrijeme mu je **sljedeća slobodna minuta**.

**Pad:** dva zapisa se prikažu kao **jedan redak liste** ⇒ `session_start` je bio dupliciran
(`useActivities` grupira po user + kategorija + `session_start`).

⚠ **Obriši testni redak nakon provjere** — ulazi u saldo (`Izvor = Racun`).

⚠ Ako je sat izvan tog pojasa, alternativa je dva Add-a **unutar iste minute** na isti
prošli datum.

---

## T-S117-2 — Birač datuma u Healthu

`add_header = {date: true}` upisan 24.08. na Health aree; `timer` nije diran, pa štoperica ostaje.

1. Area = `Health_Sasa` → Add Activity na `Medical > Lab Results`.

**Očekivano:** u zaglavlju **i štoperica i birač datuma** (Financije nemaju štopericu jer im
je `timer: false`; Health je nije tražio pa je zadržava).

2. Postavi datum unatrag (npr. nalaz od prije tjedan dana), spremi, provjeri da je u listi
   na tom danu.

**Pad:** birača nema ⇒ config nije pročitan (osvježi stranicu; `settings` se keširaju).

---

## T-S117-3 — Konvencija `~` od kraja do kraja

Djelomično viđeno 24.08. (filtar radi, chip `comment: "~"`). Ostaje puni ciklus:

1. Upiši trošak s približnim iznosom i opisom koji **počinje** tildom: `~ gorivo`.
2. Filter → `Comment` → `~` ⇒ redak je na popisu.
3. **Uredi taj isti redak** (ne nov!): točan iznos, makni tildu.
4. Ponovi filtar `~` ⇒ **popis prazan**.

**Zašto korak 3 tako:** dedup je `(datum, iznos)`, pa bi nov redak s ispravnim iznosom ostao
uz stari — razred 9 skoro-duplikata iz S111.

---

## T-S117-4 — Grantee ne vidi tuđe zastavice krivo

Nije proban, i nije hitan (Financije nisu podijeljene).

1. Kao grantee otvori podijeljenu Areu koja ima `add_header` i `HiddenInAdd`.

**Očekivano:** isto zaglavlje i ista skrivena polja kao vlasnik — config je per-Area,
ne per-user.
