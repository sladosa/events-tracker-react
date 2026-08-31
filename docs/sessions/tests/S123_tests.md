# S123 — detalji testova (2026-08-31)

Popis: [PENDING_TESTS.md](../PENDING_TESTS.md)

---

## Kontekst

Sesija je krenula od pripreme Koke za rad na laptopu (Excel roundtrip), a
pretvorila se u četiri popravka i jedan alat. Sve je na `test-branch`;
**PROD je i dalje na `5533420`**, pa Koka ništa od ovoga još ne vidi.

---

## T-S123-1 / -2 — automat (`e2e/tests/S123_owner_edits_grantee_row.spec.ts`)

Dva slučaja, oba prolaze (42 s):

1. vlasnica u ⋮ meniju tuđeg retka ima **„Edit (tuđi zapis)"**, a **Delete nema**
2. ispravak kroz UI se sprema · `user_id` ostaje grantee-jev · `edited_by` upisan ·
   **atribut preživi pod autorom eventa**

⚠ Drugi slučaj je razlog postojanja speca. Edit tok **briše pa ponovno upisuje**
sve atribute retka; bez INSERT grane u `043` `DELETE` prođe a `INSERT` padne, pa
redak ostane **bez ijednog atributa** — a ekran pokaže uspjeh.

**Obrnuti smjer NIJE proveden**: iz alata se ne može izvršiti DDL, pa se politike
iz `043` ne mogu privremeno maknuti. Spec bez migracije po konstrukciji pada
(upravo na atributima), ali to nije izmjereno.

---

## T-S123-3 — ⭐ oznaka ✎ „netko drugi je ispravio ovaj redak" (RUČNO)

**Zašto ručno:** pokušaj automatizacije je odustao nakon više runova. Što je
provjereno i isključeno, da se sljedeći put ne kreće ispočetka:

- **nije stale bundle** — `curl http://localhost:5173/src/components/activity/ActivitiesTable.tsx`
  vraća „Izmijenio", a `/src/hooks/useActivities.ts` vraća „edited_by_other"
- **`edited_by` se doista upiše** — T-S123-2 to tvrdi i prolazi
- artefakti pada pokazuju listu u **skeleton** stanju (prazne ćelije), ali ni
  ponavljanje cijele tvrdnje kroz `toPass` 90 s nije pomoglo

Nije utvrđeno zašto `group.edited_by_other` ostaje `null` na ekranu.
⚠ **Sljedeći korak je izmjeriti mrežni odgovor** (`page.on('response')`) — sadrži
li payload `edited_by` — a ne još jedan pokušaj drugačijeg locatora.

**Preduvjet:** `043` na bazi + deploy + **Ctrl+Shift+R**.

1. Prijavi se kao **Koka**, `Financije_all > Transakcija`
2. Nađi redak koji je unio **Saša** (⋮ → „Edit (tuđi zapis)")
3. Promijeni bilo koji detalj → **Save → View**
4. Prijavi se kao **Saša**, otvori istu listu

**Očekivano:** uz `⋮` na tom retku stoji **✎** (amber). Hover pokaže
`Izmijenio/la: DPS · 31.08.2026. 22:14`.
**Pad:** oznake nema → javi, i reci vidi li se izmjena u samom retku (komentar).

---

## T-S123-4 — vlasnica ne smije imati Delete na tuđem retku (RUČNO)

Druga polovica Sašine odluke; automat je pokriva (T-S123-1), ali na PROD-u treba
potvrditi jer je gate bio **jedan `if`** koji je pokrivao Edit i Delete zajedno.

1. Kao **Koka**, otvori ⋮ na Sašinom retku

**Očekivano:** „Edit (tuđi zapis)" **da**, „🗑️ Delete Activity" **ne**.
Na **vlastitom** retku Delete mora i dalje postojati.

⚠ **Baza to i dalje dopušta.** RLS `events_delete_by_area_owner` iz `020` nije
diran (služi čišćenju siročadi) — izmjereno pokusom na TEST-u 31.08. Točna
formulacija je *„Koka u aplikaciji nema gumb"*, ne *„baza joj brani"*.

---

## T-S123-5 — ⭐ delta sheet uzima račun iz PROFILA (BUG-S123-DELTAACCT)

**Preduvjet:** deploy + Ctrl+Shift+R.

1. U Filter panelu postavi `Racun` = **`Kokin tekući ZABA`**
2. Odaberi Export profil koji u `Attribute filter` ima **drugi** račun
   (npr. napravi privremeni profil s `racun: ~RF`)
3. Kvačica **Delta sheet** → pogledaj redak „Račun …"
4. Download

**Očekivano:** u ponudi piše **`Sašin tekući RF`** (iz profila, ne iz panela),
sheet nosi RF sidro i RF retke.
**Pad (staro ponašanje):** piše `Kokin tekući ZABA`, file se zove
`delta_Kokin_teku_i_ZABA_*.xlsx`, a unutra **nula redaka** uz uredno sidro i
kontrolni stupac — izgleda kao savršeno usklađen račun.

---

## T-S123-6 — prazan delta sheet se javlja (RUČNO)

1. Isto kao gore, ali namjerno odaberi kombinaciju bez redaka u prozoru

**Očekivano:** crveni toast *„Delta sheet za „…": nijedan redak u prozoru od …
Ili je racun vec uskladjen, ili filtar (profil/panel) pokazuje na drugi racun."*
Izvoz se **ne prekida** — prazan prozor je legitiman (S113: zato prazni retci
nose `Area`).

---

## T-S123-7 — ⭐ sekcija „planirano" u delta sheetu

Automat pokriva raspored (`deltaSheetLayout.test.mjs`, 18 slučajeva). Ovdje se
provjerava da radi nad **stvarnim** podacima.

1. Delta export za `Kokin tekući ZABA`
2. U sheetu skrolaj **ispod praznih redaka**

**Očekivano:**
- jedan prazan redak kao granica, s naslovom `PLANIRANO — ne mice saldo…`
- ispod njega planirani kartični retci, svaki s `event_id` i `row_hash`
- kolona `Stanje (kontrola)` na njima je **prazna** (nikad `0,00`)
- na dnu `Σ planirano` / `naplaceno s izvoda` (prazno, za ruku) / `razlika`

3. Promijeni `Status` jednog retka u `Izvrsen`, spremi, **uvezi natrag**

**Očekivano:** taj redak se ažurira, ostali se preskaču (`row_hash`).
**Pad:** prazni retci pregaze sekciju, ili se sekcija uveze kao novi zapisi.

⚠ **Ne potvrđuj retke prije nego se košara složi s izvodom** — v. T-S123-9.

---

## T-S123-8 — Export profil: zadani odabir + `row_hash`

1. Otvori **Export to Excel**

**Očekivano:** profil je **već odabran** (prvi profil Aree, kod Koke
`Kokin_format`). Makneš li ga na „No profile", ostaje maknut dok se ne promijeni
Area.

⚠ **Posljedica za tebe:** `Preview (10 rows)` sada primjenjuje kolone profila, pa
za izradu **novog** profila prvo odaberi „No profile (all columns)".

2. Hover na zaglavlje kolone **`row_hash`**

**Očekivano:** bilješka objašnjava čemu služi i da se smije sakriti ali ne
izbrisati.

3. (opcionalno) Sakrij `row_hash` u Excelu → **Import Profile** pod istim imenom

**Očekivano:** poruka kaže **13 hidden cols** (bilo 12) — to je potvrda da je
ključ ušao. `Delete?` se **ne smije** dati sakriti ni namjerno.

⚠ Postojeći `Kokin_format` nema taj ključ, pa se do ponovnog spremanja ponaša
kao dosad (`row_hash` vidljiv).

---

## T-S123-9 — ⚠ `Datum naplate`: raščišćavanje prije bilo kakve potvrde

**Ovo nije test nego zadatak, i blokira deploy sekcije „planirano".**

Alat: `python data-prep_tools/Financije/kosara_naplate.py --naplata 2026-07-11 --banka 1244.74`
Izlaz: `data-prep_data/Financije/kosara_20260711_mastercard.xlsx`

Izmjereno na PROD-u 31.08.2026. — košara 73 retka, **2.231,02**, banka **1.244,74**:

| dijagnoza | redaka | Σ | što s tim |
| --- | --- | --- | --- |
| OK (slaže se s pravilom) | 40 | 946,48 | ništa |
| **RATA** — pravilo ne vrijedi | 21 | 832,86 | treba plan otplate, ne izvod |
| KRIVI MJESEC ⇒ izvod **11.08.** | 11 | 431,10 | `--predlozi` pa uvoz |
| KRIVI MJESEC ⇒ izvod **11.06.** | 1 | 20,58 | isto |

⚠ **Ni nakon micanja krivo datiranih se ne zatvara:** 946,48 + 832,86 = **1.779,34**
naspram 1.244,74. Dakle ni sve rate ne pripadaju ovom izvodu.
**Ostatak može razriješiti samo `MC_2026-06.pdf`** — pravilo je iscrpljeno.

Redoslijed:
1. 12 redaka „KRIVI MJESEC" (`--predlozi`) → pregled → uvoz
2. 21 rata protiv plana otplate (`Koka opis` nosi `Allianz 5/10`, `Konzum 2/3`…)
3. ostatak protiv `MC_2026-06.pdf`

⚠ **Tranša 4 se NE uvozi prije ovoga.** Pipeline dedupira po `(datum, iznos)`, pa
onih 11 krivo datiranih srpanjskih kupovina **već postoji** i alat ih izbaci iz
generiranog filea — krivi `Datum naplate` preživi, a košara 11.08. ispadne kraća
točno za njih. Dobiješ dvije neusklađene košare umjesto jedne.

---

## T-S123-10 — provjereno pokusom, ne treba ponavljati

Zapisano da se ne troši vrijeme: RLS ponašanje `043` **izmjereno je na TEST-u**
pod pravim JWT-ovima (A vlasnica, B write grantee), 9 provjera:

- vlasnica ispravlja tuđi redak ⇒ mijenja **točno 1** redak
- `user_id` ostaje grantee-jev, `edited_by` zapisan
- prepisivanje autorstva na trećega ⇒ **odbijeno** triggerom
- vlasnica briše i upisuje atribute tuđeg retka pod **autorom eventa**
- grantee-jev UPDATE tuđeg retka ⇒ **0 redaka**
- vlasnica **smije** obrisati tuđi redak na razini baze (zatvoreno samo u UI-ju)

⚠ Broj promijenjenih redaka se gleda namjerno, ne HTTP status: RLS-blokiran
`UPDATE` „uspije" s 200 i praznim rezultatom.
