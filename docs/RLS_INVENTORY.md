# Inventura prava (RLS) — tko što smije

> **Ovo je namjera. `sql/SCHEMA_PROD.sql` je stvarnost.**
> Kad se njih dvoje raziđu, jedno od toga je bug — i dok se ne utvrdi koje,
> ne piše se migracija. Razlika se mjeri alatom `data-prep_tools/Tools/rls_probe.py`.
>
> Nastalo u S134, nakon što se pokazalo da se prava tri sesije zaredom
> zaključivalo čitanjem migracija, i svaki put krivo (S118, S133, S134).

---

## Uloge

| uloga | tko je to danas na PROD-u |
| --- | --- |
| **vlasnik Aree** | Koka nad `Financije_all`; Saša nad `Financije_old`, `Fitness`, `Health_Sasa`, `Kupiti` |
| **write grantee** | Saša nad `Financije_all` |
| **read grantee** | Koka nad `Health_Sasa` |
| **stranac** | svaki drugi prijavljen korisnik (⚠ signup je **otvoren**) |
| **template** | `d6ab00dd` — njegove Aree čitaju svi |

⚠ **`user_id` retka NIJE uloga.** Do S134 se ponašao kao da jest: panel je pri
svakom spremanju upisivao `user_id` onoga tko sprema, pa je stupac govorio
„tko je zadnji spremio", a politike su ga čitale kao „čije je". Popravljeno
(`7be1e02` + `sql/045`).

---

## Matrica

Legenda: ✅ smije · ❌ ne smije · ⚠ današnje stanje se razlikuje od namjere

| | vlasnik Aree | write grantee | read grantee | stranac |
| --- | :--: | :--: | :--: | :--: |
| **`areas`** čitati | ✅ | ✅ | ✅ | ❌ |
| **`areas`** mijenjati — uklj. `settings` | ✅ | ❌ ⚠ | ❌ | ❌ |
| **`areas`** brisati | ✅ | ❌ | ❌ | ❌ |
| **struktura** čitati (`categories`, `attribute_definitions`) | ✅ | ✅ | ✅ | ❌ |
| **struktura** dodavati | ✅ | ❌ ⚠ | ❌ | ❌ ⚠ |
| **struktura** mijenjati | ✅ | ❌ ⚠ | ❌ | ❌ |
| **struktura** brisati | ✅ | ❌ | ❌ | ❌ |
| **svoje evente** pisati / mijenjati | ✅ | ✅ | ❌ | ❌ |
| **svoje evente** brisati | ✅ | ✅ | ❌ | ❌ |
| **tuđe evente ispraviti** (`edited_by`) | ✅ | ❌ | ❌ | ❌ |
| **tuđe evente obrisati** | ❌ | ❌ | ❌ | ❌ |
| **template Aree** čitati | ✅ svi | ✅ | ✅ | ✅ |

### Odluke koje stoje iza spornih redaka

**`areas.settings` je vlasnikov — write grantee ga ne smije mijenjati.**
*(Sašina odluka, S134.)* `settings` nosi `comment_template`, `automations`,
`dashboard`, `list_columns`, `export_profiles` — dakle konfiguraciju **cijele
Aree**. Po istoj logici po kojoj struktura nije grantee-jeva, nije ni ovo.
⚠ Do S134 je CLAUDE.md tvrdio da to RLS **već** brani. Ne brani —
`areas_update_policy` na PROD-u ima granu `permission = 'write'`. Branio je
samo app (`ExcelExportModal.tsx:557`), dakle disciplina, ne invarijanta.

**Struktura pripada vlasniku Aree, cijelim lancem.** *(Sašina odluka, S133.)*
Treba li Saša mijenjati strukturu `Financije_all`, radi to **pod Kokinim
računom**. ⚠ Tri su puta do istog pisanja i moraju se zatvoriti sva tri:
`CategoryDetailPanel`, Edit Mode u `StructureTableView`, i
**`StructureImportModal`** — uvoz Structure Excela je puna zamjena za panel.
„Nema gumb" nije „baza brani".

**Write grantee smije brisati vlastite evente u tuđoj Arei.** *(Sašina odluka,
S134.)* Razmatrana je zabrana za financijske podatke i **odbačena**: brisanje
je legitiman dio rada (duplikati iz uvoza, S111 skoro-duplikati, S124 1:N
spojevi), a zabrana koja se mora zaobilaziti skriptom je gora od odsutnosti
zabrane. Šteta nije u brisanju nego u **tišini** — saldo se pomakne i nitko ne
zna zašto.
Umjesto zabrane, po omjeru cijene i koristi:
 1. **backup** (`backup_db.py`, S134) — obrisan redak je u jučerašnjoj snimci ✅
 2. **potvrda s iznosom kod grupnog brisanja** — *„obrisat ćeš 47 redaka,
    ukupno −3.204,18 €"*; ide uz već otvoren bug „bulk delete nije ograničen
    za grantee-a". **Prava linija nije „financijski vs ostali" nego „jedan
    potez vs pedeset".**
 3. **trag brisanja** (tko, kad, iznos) — ako se pokaže da netko doista briše
    po povijesti
 4. ~~soft delete~~ — **odbačeno**: `deleted_at` mora poštovati *svaki* upit,
    sidro, RPC i Excel put; prvi koji ga zaboravi daje krivi saldo, i to tiho
⚠ Okolnost koja smanjuje hitnost: **sidro već štiti povijest.** Saldo se računa
od zadnje potvrde nadalje, pa brisanje retka starijeg od sidra ne mijenja
prikazani saldo. Izloženo je samo razdoblje nakon zadnjeg sidra. Druga strana
iste medalje: takvo brisanje se u saldu ne bi ni **primijetilo**.

**Tuđi event se smije ispraviti, ali ne obrisati.** *(S123/S125, `sql/043`.)*
Autorstvo (`user_id`) ostaje autoru, `edited_by` bilježi ispravljača, a
`guard_event_author` trigger to drži kao invarijantu. ⚠ Brisanje je danas
zatvoreno **samo u UI-ju** — `events_delete_by_area_owner` iz `020` ga i dalje
dopušta (služi čišćenju siročadi).

---

## Zašto se ovo ne popravlja dodavanjem politike

**Sve politike su PERMISSIVE ⇒ OR-aju se ⇒ najšira uvijek pobjeđuje.**

Na PROD-u na jednoj operaciji stoji 3–5 politika iz tri generacije:

| generacija | primjer | dopušta |
| --- | --- | --- |
| A | `Users can update their categories` | vlasnik **Aree** |
| B | `categories_update_policy` | vlasnik retka **ili write-grantee** |
| C | `Users can update own categories` | vlasnik retka **ili redak bez vlasnika** |

Dodavanje strože politice ne mijenja **ništa** — a izgleda kao gotov posao.
Zabrana se postiže isključivo **brisanjem** šire politike.

⚠ Ciljno stanje: **jedna politika po (tablica × operacija)**, s imenom koje
kaže što radi. 13 politika na `categories` ⇒ 4.

---

## Izmjereno stanje (S134)

`PROD 107 politika / 8 triggera` naspram `TEST 50 / 2`. Triggeri kojih na
TEST-u **nema**: `maintain_paths`, `prevent_category_deletion`, `set_area_slug`,
`set_category_slug`, `set_attribute_slug`, `data_shares_updated_at`.

⚠ **„Provjereno na TEST-u" ne znači „vrijedi za PROD".** Za sve što dira RLS
ili triggere, TEST je indikacija, a dokaz je pokus na PROD-u.

### Otvorena rupa

**Bilo koji prijavljen korisnik može ubaciti kategoriju u bilo čiju Areu.**
Izmjereno na TEST-u 10.09.2026. (`INSERT 0 1` u psql-u, `HTTP 201` preko REST-a,
redak počišćen). `categories_insert` provjerava **tko potpisuje redak**
(`user_id = auth.uid()`), a ne **čija je Area** u koju ga stavlja. Isto vrijedi
za `attribute_definitions`.

⚠ **Zašto se dosad činilo da je zatvoreno:** supabase-js šalje
`Prefer: return=representation`, pa Postgres nakon INSERT-a traži i SELECT
pravo na novi redak — i *to* politika odbija. Obrana je bila **slučajna
posljedica jednog headera**; s `return=minimal` prolazi.
Isti razred kao „nema gumb ≠ baza brani", samo jedan sloj niže: ovdje je i
baza izgledala kao da brani.

Praktični doseg: signup je otvoren (uz potvrdu emaila, bez anonimnih računa),
pa nije samo teorijski. Podaci se **ne mogu čitati** — SELECT politike su uže.
