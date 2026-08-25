# S118 — testovi (2026-08-25)

**Kontekst:** Koka je preseljena na PROD. Area `Financije_all`
(`de8662e6-54f7-4ded-ab42-a786e7456067`, slug `financije-all`), vlasnica Koka
(`dubravka.pavic-sladoljev@dps-perceptum.com`), Saša je **write grantee**.
Migracije na PROD-u: `035`, `036`, `038`, `039`, `040`, `041`, `042`.

**Već potvrđeno u sesiji, ne treba ponavljati:** 2.312 eventa uvezeno i prebrojano,
`uplata`/`isplata` identične TEST-u u cent, sidra s izvoda daju `13.239,31` (ZABA) i
`796,43` (RF), stara `Financije` obrisana bez ostataka, Save+ maknut na obje baze.

---

## T-S118-1 — `042`: novi atribut kroz APLIKACIJU zadrži slug s podvlakom

**Zašto:** popravak trigera provjeren je kroz PostgREST sa `service_role` ključem, dakle
zaobilazeći RLS i aplikaciju. Aplikacija atribute stvara drugim putem
(`StructureNodeEditPanel`), i **taj put nije viđen**. Ako trigger ipak pregazi slug,
posljedica je tiha: ime točno, referenca mrtva.

**Preduvjet:** prijavljen bilo koji račun s pravom pisanja na neku PROD areu.

1. Structure → Edit Mode → bilo koja area → ⋮ → Edit
2. Dodaj atribut imena **`ZZ Test Slug`**, tip `text`, spremi
3. U Supabase SQL editoru:
   ```sql
   SELECT name, slug FROM attribute_definitions WHERE name = 'ZZ Test Slug';
   ```

**Očekivano:** `slug = zz_test_slug` (podvlaka — oblik koji proizvodi `makeAttrSlug`).
**Pad:** `zz-test-slug` (crtica) ⇒ trigger još gazi, `042` nije primijenjen ili ga app
zaobilazi drugim putem.

4. Obriši testni atribut (Edit panel → ukloni atribut).

---

## T-S118-2 — Structure roundtrip na PROD-u ne pomiče ništa

**Zašto:** ako slugovi ikad opet odlutaju, prvi znak je uvoz koji „nešto ažurira" bez
razloga. Ovo je jeftina periodična provjera.

1. Kao Koka: Structure → filtar Area `Financije_all` → **Export**
2. Odmah zatim **Import** tog istog filea

**Očekivano:** `Areas 0 · Categories 0 · Attributes created 0 · Attributes updated 0 ·
Settings updated 0 · List columns 7 · Rows skipped 0`.
⚠ `Attributes updated 9` je poznat šum (BUG-S117-RULESHAPE) **samo ako je prije toga
spremljen Edit panel**; bez toga mora biti 0.
**Pad:** bilo koji drugi broj — usporedi slugove protiv TEST-a prije nego se dira config.

---

## T-S118-3 — Kokino sidro s ekrana banke (prvi put na PROD-u)

**Zašto:** dosad su sva PROD sidra upisana putem **`izvod`** (datum s papira). Put
**`ekran bankovne aplikacije`** — gdje app sam računa `sidro(jučer) = očitano − današnji
promet` — na PROD-u **nije nikad izveden**. To je put kojim će ona raditi svaki put.

**Preduvjet:** ona prijavljena na svoj račun, area `Financije_all`.

1. Neka **prvo upiše sve današnje transakcije** (uputa iz S116: *prvo upiši današnje, pa
   pogledaj banku*)
2. Overview → redak `Kokin tekući ZABA` → `u banci` = broj s ekrana banke
3. `odakle` = **ekran bankovne aplikacije**
4. Provjeri **prije klika** da app ispiše računicu (očitano − današnji promet) i da datum
   ponudi **jučerašnji**
5. Potvrdi

**Očekivano:** saldo pločice nakon potvrde = **točno onaj broj koji je vidjela na ekranu**;
u `povijest potvrda` novo sidro s jučerašnjim datumom; `note` nosi **sirovo očitanje**.
**Pad:** datum današnji (vraćena S116 greška), ili saldo ≠ očitanom broju.

---

## T-S118-4 — Saša kao write grantee: unos i sidro u njenoj arei

**Zašto:** `app_can_write_area` (`036:82`) priznaje grantee-a s `write`, pa bi Saša trebao
moći i upisati i obrisati sidro. Provjereno **čitanjem SQL-a, ne izvođenjem**.

**Preduvjet:** Saša prijavljen na **svoj** račun; `Financije_all` mu je share-ana (write).

1. Area dropdown → `Financije_all` → dodaj jednu aktivnost → Finish
2. Overview → `u banci` na bilo kojem retku → `odakle` = izvod → datum → Potvrdi
3. U `povijest potvrda` klikni ✕ na tom sidru

**Očekivano:** sva tri koraka prolaze; u listi je njegov unos vidljiv s njegovim imenom u
koloni `User`.
**Pad:** RLS greška na sidru ⇒ `app_can_write_area` ne pokriva grantee put kako je pisano.

---

## T-S118-5 — Shortcutovi ponovno složeni u novoj arei

**Zašto:** stari su nestali s obrisanom areom (bili su ID-based na njene stare atribute).
Novi se moraju napraviti rukom, a oni su prvi korak Tip/Podtip automatike.

1. Add Activity u `Financije_all`, popuni tipičnu kupovinu (npr. `Lacetti gorivo`:
   Racun, Izvor, Smjer=Isplata, Tip/Podtip)
2. **Save as Shortcut (with these attribute values)** → nazovi ga
3. Novi Add Activity → Shortcuts → izaberi → **Use**

**Očekivano:** polja se popune spremljenim vrijednostima; `Datum naplate` se i dalje
izračuna iz `Izvor`a (shortcut ne smije ugasiti `set_attribute`).
**Pad:** prazna polja ili `Datum naplate` prazan.

---

## T-S118-6 — Ona radi s mobitela

**Zašto:** sve dosad je viđeno na Sašinom laptopu. Uska lista (dva reda), birač datuma i
Overview pločica na malom ekranu nisu viđeni na PROD podacima.

1. Ona otvara app na mobitelu, prijavljuje se
2. Lista: `Datum · Iznos · Tip/Podtip · Opis` u dva reda, bez horizontalnog scrolla
3. Add Activity: zaglavlje **bez štoperice**, s datumom; 7 polja
4. Overview: oba računa, `u banci` polje dohvatljivo prstom

**Očekivano:** upotrebljivo bez zumiranja.
**Pad:** bilo što što traži vodoravni scroll ili promašaj prsta.
