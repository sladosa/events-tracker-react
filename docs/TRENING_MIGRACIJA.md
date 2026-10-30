# TRENING_MIGRACIJA — `trening.xlsm` → aplikacija

> **Status:** analiza i prijedlog, **bez koda i bez upisa u bazu** (2026-10-19, paralelna sesija uz S175).
> **Zamjenjuje** `docs/Diary.md` (strategija od 04.07.) kao **jedini** plan migracije treninga
> (CLAUDE.md § Strategic Position, korak 3). Preusmjeravanje uputnica (`Diary.md`,
> `AUTOMATION_SPEC.md` Faza 4, `DATA_PIPELINE_PLAN.md` Prioritet 5, BACKLOG, `MIGRATION_STATE.md`)
> **nije napravljeno u ovoj sesiji** — drugi prozor mijenja te dokumente. Ide u sljedeću sesiju.
>
> **Izvor:** `C:\0_Sasa\OneDrive\trening.xlsm` (OneDrive, živi file — **nikad ga ne otvarati za
> pisanje**). Sve brojke ovdje izmjerene su na **kopiji** `Claude-temp_R/trening/trening.xlsm`
> od 19.10.2026., čitanjem `openpyxl`-om (formule **i** keširane vrijednosti).
> ⚠ Brojke su **kontrolni zbrojevi za uvoz**: kad TEST uvoz prođe, broj eventa i popunjenost
> po atributu moraju se poklopiti s §1 — inače je generator nešto tiho izgubio.

---

## Razgovor 20.10. — zaključci (za Sašu, jednostavno)

> Ovaj odjeljak je **noviji od ostatka dokumenta** i ima prednost. §3 (prijedlog modela) i dio
> pitanja u §5 su njime djelomično zastarjeli; prepisat ćemo ih kad odgovoriš na pitanja dolje.

### Što si mi rekao

1. **Ambicije s DIARY-jem** su veće od samog prijenosa treninga:
   - **periodi** u životu (sportski blokovi, poslovni projekti, putovanja) i **trenuci** (rođenja,
     smrti, vjenčanja, diplome — tvoji i bliskih ljudi);
   - **AI koji predlaže trening** prema formi i osjećaju (tu su važni Garmin podaci);
   - **usporedbe kroz razdoblja** između Area — npr. „kako sam trenirao i kako sam se osjećao u
     pripremama za različite maratone". Za to treba nešto novo, npr. Excel sa standardnim upitima.
2. **DIARY vodiš i dalje, paralelno** s aplikacijom (od siječnja 2026. trening upisuješ i u
   `Fitness`). Excel je postao velik, ali je ugodan za pisanje.
3. **Ideja za Excel:** stara povijest živi u bazi, a ti u Excelu pišeš samo zadnjih 1–3 godine;
   iz baze se po potrebi izvozi natrag u novi Excel.
4. **Vrijeme 06:00** ti je u redu kad pravo vrijeme nije poznato — ali i Garmin i tvoj opis
   često imaju pravo vrijeme i mjesto (teretana, Sljeme, ruta).
5. **Iz Financija si naučio:** „zaključaj taksonomiju prije uvoza" je skupo pravilo. Tip/Podtip u
   Financijama nije dobar, a popravak je preskup. Kod treninga će biti **još više** dotjerivanja
   (više Area, kategorije, atributi, izbornici) — **ne može se sve unaprijed savršeno smisliti**.
6. **Odluka:** prije uvoza treninga treba napraviti **alat za preuređivanje strukture**.

### Što sam izmjerio u bazi (PROD, samo čitanje)

- **`Fitness`** (tvoj, ne dijeli se): od 29.01.2026. — `Activity` (puls, training effect, kcal,
  mood, intenzitet…) s `Gym > Cardio` (34), `Gym > Strength` (453 vježbe) i `Outdoor` (13).
  ⇒ Jedan zapis **po vježbi**, dok je DIARY jedan **po danu**. Oboje može živjeti: dan je sažetak,
  vježba detalj.
- **`Health_Sasa`** — **Koka ga može čitati** (dijeljeno, read). Unutra: Garmin dnevni podaci
  **24.04.2014. – 14.02.2025.** (3.624 dana; ima body battery, korake, VO2max, stres), nalazi krvi
  (43, iz sheeta `Krv`) i pregledi (50).
- ⚠ **Dvije moje tvrdnje u ovom dokumentu su bile krive:** `Krv` je **već** u bazi, a Garmin
  dnevni podaci **jesu** na PROD-u. (Pitanja Q16 i Q17 u §5 time otpadaju.)
- ⚠ **Rupa:** Garmin dnevni podaci staju u **veljači 2025.** — za zadnjih 20 mjeseci baza nema
  fiziologiju. Za AI preporuke to je najveći nedostatak.

### Moji prijedlozi (redom kojim bih radio)

1. **Alat za preuređivanje strukture** — detalji u
   [`PREUREDJIVANJE_SPEC.md`](PREUREDJIVANJE_SPEC.md). Ukratko: danas promjena imena jedne opcije
   (npr. Podtipa) znači ručno dirati ~7 mjesta; alat to radi **u jednom potezu**, prvo pokaže što
   će promijeniti, i može se poništiti. Isto za atribute (npr. tekst → broj) i kategorije
   (premještanje). Prvi korisnik: **Tip/Podtip u Financijama**. Posljedica: trening se smije
   uvesti **grubo**, pa dotjerivati poslije.
2. **Raspored po Areama** (prijedlog, čeka tvoju potvrdu):
   - **`Fitness`** — novi leaf `Dan`: DIARY trening, jedan zapis po danu od 2006.;
   - **`Health_Sasa`** — Garmin dnevni podaci, plus dotok do danas;
   - **`Life_Sasa`** (nova, privatna; prvo ime bilo `Život`) — periodi, trenuci, privatni dnevnik
     (`AM`), projektni log (`DS`).
3. **Periodi kao okosnica.** Spec za to postoji od srpnja (`docs/parked/Analytics_tab.md`) i
   čekao je baš ovakvu Areu. DIARY već ima gotove kandidate: 47 trenažnih blokova (kolona `A`),
   poslovne projekte s datumima, putovanja. Prvi, najjeftiniji korak: tvoji periodi u izborniku
   razdoblja u filtru.
4. **Usporedbe između Area:** prvo **jedan** upit dokazati (npr. pripreme za maratone: km/tjedan,
   puls, raspoloženje, odmor), rezultat u Excel — tek onda graditi novi tab.
5. **Garmin dotok** do danas — preduvjet za AI.
6. **Excel kao radni prozor** (tvoja ideja, slažem se — isto kao Financije): baza je glavna,
   Excel nosi zadnjih 1–3 godine i vraća promjene uvozom. Do prelaska DIARY ostaje glavni.
7. **Pravo vrijeme i mjesto** idu u atribute (`vrijeme`, `lokacija`), a 06:00 ostaje samo kao
   „ključ" dnevnog retka. Za mjesta mi treba tvoj popis naziva.
8. **AI** na kraju, kad su podaci gore spojeni.

### Što trebam od tebe (kad stigneš)

1. Slažeš li se s rasporedom **Fitness / Health_Sasa / Life_Sasa**? *(odgovoreno: da, uz ime `Life_Sasa`)*
2. Smije li Koka vidjeti san, HRV i body battery (tj. idu li u `Health_Sasa`)?
3. Kako si dobio Garmin podatke do 02.2025. (GDPR export?) — može li to postati redovno?
4. Za alat: **što konkretno ne valja** u Tip/Podtip i bucketima Financija (popis želja)?
5. Pet pitanja na dnu [`PREUREDJIVANJE_SPEC.md`](PREUREDJIVANJE_SPEC.md) §7.
6. Značenje kolona (Q4–Q11 u §5) — kasnije, nije hitno.

### Tvoji odgovori (20.10., drugi dio) i što iz njih slijedi

| # | Tvoj odgovor | Što to znači za plan |
| --- | --- | --- |
| Ime | `Life_Sasa` umjesto `Život` | ✅ prihvaćeno |
| Koka vidi san/HRV/bb | **smije** | brojevi iz `AM` (san %, HRV, body battery) idu u `Health_Sasa > Daily_metrics` |
| Garmin dotok | pokušat ćeš zahtjev Garminu; idealno API ili Strava | v. „Garmin" dolje |
| Financije | Podtip se teško nađe (npr. `Pokloni`); u bucketima se iste stvari pojavljuju dvaput; **namjena** (zajedničko, Koka, Saša, Kućište) nije ista klasa kao Domaćinstvo/Kuća/Prijevoz | izmjereno i potvrđeno — `PREUREDJIVANJE_SPEC.md` §8 |
| Fitness | današnja struktura nije idealna; DIARY fitness podaci trebaju ući u nju; mogući sukobi Garmin ↔ DIARY | v. „Sukobi" dolje |
| **Q4** `X` Teka | broj **papirnate bilježnice** s opširnijim rukom pisanim opisima | atribut `teka` — uputnica „gdje pogledati detalj"; ostaje |
| **Q5** stari `I`/`H` | Polar sat: `I` = Polarov „exertion", `H` = prosječni puls (max puls tada > 200), `Z2` = zona 2 | `H` → `hr_avg` (2006–2011); Polar `exertion` → vlastiti broj `napor_polar` (samo do 2014.); zone ostaju tekst. Usporedba pulsa preko 20 godina traži oprez (drukčiji max puls) |
| **Q6** | da — aerobni / anaerobni training effect | dva broja `te_aerobni`, `te_anaerobni` |
| **Q7** `AL` | **minimalni noćni puls**, svako jutro s Garmina | → `Health_Sasa`, isti atribut kao Garminov `HR Min`. Pokriva i rupu poslije 02.2025. |
| **Q8** `kk` | tisuće koraka, **zaokruženo naniže** | → `Health_Sasa` `Steps` (× 1000). Približno — kad postoji Garminov broj, on ima prednost |
| **Q9** raspoloženje | broj u bazi, a u alatu i dalje smajlić | broj 1–5 u bazi; prikaz smajlića u listi radi već postojeći `map` kolone liste. **U formi za unos** to danas ne postoji (forma bi pokazala brojeve) — mala dorada |
| **Q10** `K` | služio za filtar; treba više oznaka: vrsta aktivnosti, tip treninga, vrsta utrke (maraton, polumaraton, lige); uz to **PB** | četiri polja: `vrsta` (trčanje, x-train, šetnja, odmor, bolest…), `tip_treninga` (long, interval, tempo, fartlek, track…), `utrka` (maraton, polumaraton, 5K, liga …), `pb` (da/ne). **PB je izmjeren: 58 dana** (`P.B.`/`PB` u `O` i `M`) |
| **Q11** tempo | izveden prosjek miješa zagrijavanje, rastrčavanje i odmore | **ne spremati** `pace`; pravi tempo dolazi iz Garminovih dionica, a vrijeme utrke ostaje u opisu |
| **Q12** `AM` | san → `Health_Sasa` (Koka i prijatelji smiju vidjeti); ostatak privatnije; kasnije možda „pametno" razbiti na više događaja (počeci/krajevi razdoblja, npr. kad je Koku udario tramvaj) | prvi uvoz: brojevi u `Health_Sasa`, cijeli tekst u `Life_Sasa`. Razbijanje na događaje je **kasniji AI posao** — tekst je sačuvan, pa se može kad god |
| **Q13** posao | prebaciti **kao periode**, ne dnevno; tjedna tablica (`DN`–`DQ`: tjedan, norma 20 h, prijavljeno, razlika) pokazuje akutno opterećenje | time je riješen i brojač `DM`–`DQ`. Prijedlog: poslovni projekti = periodi u `Life_Sasa`; **tjedni sati** = jedan zapis po tjednu (sati, norma) — vrijedan za usporedbu s pulsom/HRV-om. Nije hitno |
| **Q14** `DS` | P-klasifikacija nije zaživjela; vibe-coding vodiš kao `P5` | tekst u `Life_Sasa`, šifra `P#` kao atribut gdje postoji |
| **Q15** `Y` | ponekad ima smisla (trener, IMOM sklekovi) | `Y` → tekstualni atribut uz trening (bilješka o snazi). `Z`–`AH` (2013–2016) ostaju u Excelu |
| **Q16** | ostali sheetovi ostaju u Excelu | ✅ |
| **Q17** | `Fitness_Garmin` spojiti s `Fitness`; o sukobima još razgovarati | v. „Sukobi" dolje. ⚠ `Fitness_Garmin` je samo na **TEST-u**; na PROD-u ga nema |

### Odluke 26.10. (S185, Saša)

- **`Activity` ostaje TRENING** — jedan event = jedan stvarni trening. Ostatak DIARY dana se
  raspodijeli na `Health_Sasa`, `Life_Sasa` i slično, uz **periode** za razne slučajeve (trenažni
  blokovi `A`, teka `X`, posao, putovanja, bolest). Time otpada leaf `Dan` iz §3 i iz ranijeg prijedloga.
- **Novi model ide uz stari („Activity1"), ne preko njega** — prvo TEST (`Fitness_Garmin`), na PROD
  tek gotov, kao nova kategorija u Arei `Fitness` (v. `PREUREDJIVANJE_SPEC.md` §31).
- `pace` = **tekst `mm:ss`** (kako su trkači navikli); za analizu se tempo računa iz trajanja i udaljenosti (Q11).
  PROD `Fitness.pace` je danas `number` bez ijednog retka ⇒ u novom modelu `text`.
- `mood` u bazi = broj 1–5 (`:-(` 1 · `:-/` 2 · `:-|` 3 · `:-)` 4 · `:-D` 5); smajlić ostaje prikaz.
- Novi Garmin GDPR izvoz Saša traži paralelno (web, ne mobilna aplikacija).

### Odluke 27.10. (S186, Saša) — model treninga Activity1, vidljivost polja, unos snage

**Problem (PROD `Fitness`):** jedna sesija pripada TOČNO jednom leafu (P2: roditelj `Activity` ima jedan event
po sesiji, `chain_key` = leaf). Zato 45 min ergometra (`Gym > Cardio`) pa vježbe snage (`Gym > Strength`) ne
stanu u isti trening — dvije sesije bi Garminov puls/kcal za cijeli trening udvostručile ili proizvoljno
podijelile. `Cardio`/`Strength` danas glume **vrstu vježbe**, a leaf određuje **vrstu sesije**.

1. ✅ **Model Activity1: jedan leaf `Dio`, vrsta je ATRIBUT.**
   ```
   Activity1          1 event po treningu: trajanje, puls, kcal, TE, opterećenje, intenzitet, mood, mjesto, rutina
     └── Dio (leaf)   N eventa po treningu: vrsta (Cardio | Snaga | Outdoor | Istezanje …),
                      sprava/vježba (ovisi o vrsti), trajanje, udaljenost, zapis …
   ```
   Odbačeno: sesija preko više leafova (promjena P2, `chain_key`, grupiranja liste, Excel kolizija).
2. ✅ **Dorada forme: „polje vidljivo samo uz vrijednost X atributa Y"** (npr. serije×ponavljanja samo uz
   `vrsta = Snaga`). Općenita — korisna svakoj Arei.
3. ✅ **d1 — ukinuti IMPLICITNO skrivanje polja na defaultu** (S117 „hide-at-default"). Vidljivost određuje
   samo stupac `HiddenInAdd`; polje s defaultom se prikazuje popunjeno. Izmjereno (PROD backup 22.10.): default
   imaju samo `Fitness` (8 atributa: `intensity`, `equipment`, `cardio-type`, `terrain`, `trening-type`,
   `outdoor-type`, `strengthtype`) i arhivski `Financije_old` — **`Financije_all` nijedan** ⇒ Kokina forma se ne mijenja.
4. ✅ **d2a — analiza snage TREBA**, „nešto što podsjeća na Overview" (pločice kao Financije): npr. napredak po
   vježbi (težina / ponavljanja kroz vrijeme), Z2 minute tjedno, obujam po vrsti.
5. ✅ **d2b — rutine se ponavljaju.** Sašine vrste treninga: **Strength — Upper / Core / Legs**; **Z2** na
   spravama `orb` (orbitrek), `bic` (stacionarni bicikl; ponekad sjedeći s poduprtim leđima), `erg` (veslački
   ergometar), ponekad pokretna traka; **Tempo / HIIT** (jači puls), ponekad girje 12 ili 16 kg.

**Unos snage (d2) — prijedlog, otvoreno za razgovor:** u teretani je biranje vježbe po vježbu gnjavaža, pa Saša
piše skraćeno, više vježbi u jednom eventu (`55kg x 12, tric.20kg` u `sets_reps`, `h.rs 2kg x 12, bic.17,5kg,
leg r. x25` u `weight_info`). Analiza (4.) traži strukturu, unos traži brzinu ⇒ razdvojiti:
- **brz unos** ostaje notacija u jednom polju;
- **strukturirano spremanje:** pri Save se notacija raspiše u N `Dio` eventa (vježba, težina, ponavljanja), a
  izvorni tekst ostaje u komentaru — analiza onda ide u Postgresu (pravilo: agregacija nikad u pregledniku).
  ⚠ Nije u sukobu s „izvedeno računaj pri prikazu" (S185): notacija je ULAZ koji se zamjenjuje strukturom, ne
  drugi izvor istog podatka. Treba ujednačiti notaciju — prvo izmjeriti stvarne zapise iz PROD `Strength`
  (`sets_reps`, `weight_info`) i iz njih složiti gramatiku.
- **„Ponovi zadnji trening ove rutine"** (`rutina` na `Activity1`): Add otvori dijelove zadnjeg treninga iste
  rutine, Saša samo ispravi brojke. Bez nove tablice — predložak je zadnji stvarni trening, pa se sam osvježava.
  (Postojeći shortcuti pamte jedan event, ne trening s N dijelova.)
  **Veza sa shortcutima (Saša, 27.10.):** pamti se zadnji trening **svake vrste/rutine**. Shortcut (npr.
  `Strength – Upper`) **pokazuje na rutinu** (kategorija + `rutina`), a sadržaj se čita iz baze pri pokretanju —
  zadnji stvarni trening te rutine. ⚠ **Nikad snimka treninga u shortcutu** (zamka S127: zamrznute vrijednosti
  zastare i tiho upravljaju svakim unosom). Bez shortcuta isto: odabir rutine u Addu nudi „Kopiraj zadnji (datum)".

**Redoslijed (prijedlog S186, prije A4):** d1 → dorada vidljivosti → model Activity1 + `Dio` na TEST-u
(`Fitness_Garmin`) → mjerenje notacije i gramatika → unos s raspisivanjem + „Ponovi zadnji" → Overview pločice
za Fitness → A4 / K2 (seljenje starih treninga).

> ⚠ **„Unos snage" i „Redoslijed" gore su zamijenjeni dogovorom 28.10. (ispod).** Točke 1–5 vrijede i dalje.

### Dogovor 28.10. (S187, Saša) — teretana, rutine, katalog vježbi, plan po koracima

> Ovo je **živi plan treninga**: tablica „Koraci" se ažurira kad se korak izvede (status + sesija), ne
> prepisuje. Redoslijed velikih koraka cijelog projekta i dalje je samo u CLAUDE.md § Strategic Position.

**Model (dorada odluke 27.10.):**
```
Activity1            1 event po treningu: Garmin brojke (trajanje, puls, kcal, TE, opterećenje), intenzitet,
│                    mood, lokacija (bivši Wormup_notes: ime teretane ili staze, „Sljeme - Puntijarka"), rutina
├── Gym (leaf)       1–N eventa po treningu, svaki sa SVOJOM `vrsta`; vrsta određuje koja su polja na ekranu
└── Outdoor (leaf)   ostaje zaseban leaf (Saša, 28.10.)
```
Leaf `Gym` = ono što je 27.10. zvano `Dio`. N eventa istog leafa u jednoj sesiji već radi (`Save +`), pa
miješani trening (ergometar pa snaga pa istezanje) ostaje **jedan** trening. Polja `Gym` — prijedlog, konačno
nakon analize (korak 3):

| Polje | Tip | Vidljivo uz |
| --- | --- | --- |
| `vrsta` (Z2 · Snaga · Tempo/HIIT · Istezanje · Zagrijavanje) | izbornik | uvijek |
| `sprava` (orb · bic · erg · traka) | izbornik | vrsta = Z2 \| Tempo/HIIT \| Zagrijavanje |
| `vježba` (iz kataloga, korak 5) | izbornik | vrsta = Snaga \| Istezanje |
| `trajanje` | broj | vrsta ≠ Snaga |
| `serije` (zapis jedne vježbe, v. Unos) | tekst | vrsta = Snaga |
| `napomena` | tekst | uvijek |

**d1 — ukinuto implicitno skrivanje na defaultu.** Vidljivost određuje samo `HiddenInAdd` (+ `depends_on` i novo
pravilo ispod). Izmjereno (PROD backup 22.10.): default ima **7** atributa, svi u `Fitness` (`intensity`,
`Cardio_type`, `equipment`, `Strength_type`, `Outdoor_type`, `Trening_type`, `terrain`) + arhivski
`Financije_old`. U Fitness formi se ta polja pojavljuju popunjena, a blok „na defaultu … / Show all" nestaje.
**`Financije_all` nema nijedan `default_value` ⇒ Kokina forma je ista** (ostaje „prazna po pravilu: Izvod opis,
Valuta" i `depends_on` vidljivost Isplata/Uplata/Rate/Broj rata).

**Pravilo vidljivosti `visible_when` („polje vidljivo samo uz vrijednost X atributa Y")** — odluke:
- Za **svaki tip** polja; neovisno o `depends_on` (izbornik može ovisiti o jednom atributu, vidljivost o drugom).
  `depends_on` za brojeve i dalje radi kao do sada (Financije se ne diraju) — na tekst se NE proširuje, jer već
  radi dva posla ovisno o tipu (S153).
- **Popis vrijednosti** (jedna = popis s jednim članom), bez razlike velikih/malih slova.
- Y je na **istom eventu ili pretku**, nikad na djetetu (roditelj ima 1 event po treningu, leaf N). Isti slug na
  dvije razine ⇒ vrijedi najbliži. Uvoz to provjerava.
- **Skriveno pravilom se ne sprema.** Ali **Edit ne skriva vrijednost koja već postoji u bazi** (polje vidljivo,
  s oznakom) dok čovjek ne promijeni Y — inače bi otvaranje + Save starog retka tiho obrisalo podatak (razred S127).
- „Show all" ga ne otkriva (kao `depends_on`). Obavezno vrijedi **samo dok je vidljivo** (`missingRequired` dobiva
  istu funkciju vidljivosti kao forma).
- **Structure Excel:** stupac `VisibleWhen` iza `HiddenInAdd`, oblik `vrsta = Cardio | Outdoor`; prazno = nema
  pravila; nema stupca ⇒ uvoz zadrži bazu (S139/S149); prva popunjena ćelija atributa vrijedi, različite ⇒
  upozorenje. Pisač i čitač ćelije su jedan par (S186). **Structure panel:** i uređivanje (sve postavke
  atributa su na oba mjesta).
- Mora ući i u: `validationRules.ts` + `sameRules`, planer preuređivanja `plan.ts` (citira vrijednost opcije),
  preimenovanje sluga, blokadu A1 (`retype.ts`).

**Unos (zamjenjuje „Unos snage" od 27.10.):**
- **Jedna vježba = jedan `Gym` event.** Ne „jedan redak u koji ide sve" (kad, gdje, sve vježbe) pa razbijanje.
- Serije jedne vježbe kratkim zapisom, jer su piramide česte (DIARY: `pull m.44-52-58-64-68kg (15x-12-8-6-4)`):
  npr. `44x15, 52x12, 58x8, 64x6, 68x4`. Forma ga provjerava dok tipkaš (crveno ako ga ne razumije, kao polje
  iznosa); najveća težina i obujam računaju se iz njega. **Format se odlučuje nakon analize** (korak 4).
- **Tekstualno polje raste dok pišeš** (više redaka) — opće poboljšanje forme.
- Notacija „sve u jednom retku" ostaje samo za **povijest**: jednokratni alat je raspiše u `Gym` evente, a što ne
  razumije ostavi u `napomena` (uvezi grubo, pa dotjeraj).

**Rutine:** `rutina` je obično polje s izbornikom na `Activity1` (Upper · Core · Legs · Z2 · Tempo/HIIT), uređuje
se kao svaki izbornik. **Predložak = zadnji stvarni trening te rutine** — ništa se posebno ne sprema; rutina se
„mijenja" tako da se jednom odradi drukčije. Shortcut (`Strength – Upper`) samo pokazuje na kategoriju + rutinu,
sadržaj se čita iz baze pri pokretanju (nikad snimka u shortcutu, zamka S127).
**Ime rutine je oznaka za pamćenje, ne razvrstavanje** (S188, 29.10., Saša): rutina se zove po glavnom naglasku
(Upper i kad ima adductor/abductor), jer se `Strength1` teško pamti. Analiza „po dijelu tijela" ne čita ime rutine
nego vježbe u zapisima + mišićnu skupinu iz kataloga (korak 5) — pa netočno ime ne kvari nijednu brojku.

**Katalog vježbi (Saša: „jako koristan"):** ⚠ **ODLUKA 30.10.: zasebna Area `Katalog vježbi`, NE unutar `Fitness`**
(v. „Katalog za više korisnika" ispod; ranije `Fitness > Katalog > Vježba`) — svaka vježba je zapis (puno ime,
skupina, sprava, opis, slika), uređuje se zasebno, kao vlastiti projekt. Izbornik `vježba` u `Gym` čita iz
kataloga ⇒ **novi opći mehanizam „izbornik iz druge kategorije"** (koristan i drugim Areama). Na katalog se
oslanja „Review" tab (trendovi po vježbi).
- **Slug vježbe (Saša, 28.10.) — odgovor na „ime ili veza": oboje.** Svaki zapis kataloga ima **slug** = kratko,
  trajno ime (`pull_m`, `z_sklek`) i **puno ime** koje se smije mijenjati (isti obrazac kao slug/ime atributa).
  `Gym` event pamti **slug**: čitljiv je u Excelu i jest veza na zapis. Promjena punog imena, slike ili opisa ne
  dira nijedan trening; promjena sluga je rijetka i ide alatom za preuređivanje.
  ⚠ Zapis kataloga je event (EAV), pa baza **ne jamči jedinstvenost** sluga — uvoz i forma kataloga moraju
  odbiti duplikat.
- **Aliasi iz povijesti** (`pull`, `pull.m`, `pull m.`) se pri uvozu povijesti svode na jedan slug — to je
  rječnik iz analize (korak 3).
- **Slika** = postojeći privitak eventa (`event_attachments`), bez novog mehanizma.
- **Gumb „prikaži vježbu" (Saša, 28.10.):** uz izbornik vježbe u Add formi otvara zapis kataloga dok se vježba
  izvodi (slika, opis, sprava). Prijedlog uz to: „zadnji put: `64x6`" iz zadnjeg treninga s tom vježbom.

**Analiza zapisa (korak 3)** — samo čitanje lokalnih kopija (PROD backup, kopija `trening.xlsm`), bez PROD-a:
1. **rječnik vježbi s aliasima** (`pull`, `pull.m`, `pull m.`, `pull.m.` = jedna vježba): Python izvuče i prebroji,
   Claude predloži spajanje + puno ime + skupinu, Saša ispravi **jedan Excel** ⇒ uvoz u katalog (postupak kao
   pravila po trgovcu, S174) — to je put „s minimalno frikcije";
2. **popis mjesta** za `lokacija`; 3. **stvarne rutine** (koje se vježbe javljaju zajedno);
4. **oblik serija** (piramide, supersetovi „između serija", vremena `plank 2:20`) ⇒ format zapisa serija.

**Izmjereno 28.10. (S187):**
- PROD `Fitness > Gym > Strength` (backup 22.10.): **76 treninga, 457 eventa, prosječno 6 po treningu** — već
  danas jedan event po vježbi. `sets_reps` popunjen 437, `weight_info` 273; najdulji zapis 45 znakova. Najčešće
  vježbe: `pull.m` 114, `ergometar` 56, `istezanje` 52, `kosa k.` 41, `plank` 39, `z.sklek` 28. U uzorku od 25
  eventa oko pola je „čisto" (`pull.m | 12 | 45`), ostatak trpa više vježbi u jedan event
  (`60kg, 20kg tric, leg r.25x / x 9 | bic.15kg, rot.ruku 2x2x10`); isto se piše na više načina (`12xkg55`,
  `60kg x 12`, `10x2x2kg`).
- DIARY `M` (kopija 26.10.): **648 dana s opisom od 2025., 420 s teretanom**; oblik „vrijeme mjesto niz vježbi"
  (`10:10 CleverFIT 5'erg, istezanje, 8xIMOM 7z.sklek - pull.m (45-55-65kg x 8, 75kg (5x5) …`). Mjesta: GymS,
  GymF, MoFit, Westin, CleverFIT, Gibi gym.

**Analiza zapisa — izmjereno 28.10. (S187, korak 3)** — alat `data-prep_tools/Trening/analiza_snage.py`
(samo čita PROD backup 22.10. i kopiju `trening_2026-10-26.xlsm`), prijedlog kataloga
`Trening/vjezbe_prijedlog.json`, Excel za Sašu `Claude-temp_R/s187/analiza_snage_<datum>.xlsx` (lokalno —
DIARY `M` je osobni tekst):
- **Izvori:** PROD 493 eventa (Strength + Cardio), **78 treninga snage**; DIARY **1.282 dana s teretanom od
  2021.** (2021: 138 → 2025: 261 dan/god.).
- **Katalog — prijedlog 46 vježbi** iz 123 aliasa. Najčešće (PROD eventi + DIARY dani): erg 731, istezanje 690,
  orb 484, pull_m 411, leg_raises 396, plank 293, bic 278, triceps 176, ramena 174, kosa_k 168, swing 136,
  indian_clubs 129, z_sklek 127. ⚠ Dvoznačno, odlučuje Saša: `bic` (bicikl uz `'`, biceps uz `kg`), `rot.`
  (trup ili ruke), `girja` (sprava, ne vježba), `raises`, `dead`. „Način" (IMOM, GtG, HIIT, TbyT) nije vježba
  nego oblik — vjerojatno atribut, ne zapis kataloga.
- **Rutine (PROD):** Upp 39 treninga (ergometar 77 %, pull.m 72 %, istezanje 69 %, plank / leg raises 26 %),
  Core 19 (ergometar 68 %, plank i istezanje 58 %, kosa k. 47 %), Low 9 (ergometar i plank 78 %, squat-bulg 56 %).
  ⇒ **Zagrijavanje na ergometru danas je „vježba" unutar Strengtha** — u novom modelu je zaseban `Gym` dio
  (vrsta Zagrijavanje / Z2, sprava erg). Potvrđuje odluku 27.10.
- **Oblik serija** (DIARY dani / PROD polja): serije×ponavljanja 536 / 126, samo kg 455 / 194, **piramida
  ponavljanja 183**, **piramida težina 76**, kg×ponavljanja 143 / 133, mm:ss 324 / 39, minute 1.100 / 48,
  **blok N×( … ) 235** (kružni: `4x(leg r.12 + plank)`), IMOM/GtG/HIIT 232.
  ⇒ Za korak 4: piramide su česte (jedan zapis „serije × reps × kg" nije dovoljan), a **kružni blokovi**
  (više vježbi ponovljeno N puta) traže odluku — atribut `blok` na `Gym` dijelu ili samo napomena.
- **Napomene usred zapisa** (Saša 28.10.: `- opet nemam vremena - po Karla`, retci bez prijedloga ispod
  133 u listu `Vjezbe`). Prijedlog za korak 9: raspisivač ne traži napomene nego **vježbe** (katalog +
  aliasi + obrasci broj/kg/`'`); što od segmenta ostane neprepoznato ide u **komentar `Activity1`** (isto
  mjesto kao novi unos). Izvorni `M` tekst se čuva cijeli (skriven atribut ili komentar), pa krivo
  razvrstavanje ne gubi ništa. Saša te retke **ne mora razvrstavati** — samo upiše A–D ako među njima vidi vježbu.

**Prijedlog za korak 4 — 29.10. (S188, skica Add forme; Saša: „sve je ok")** — skica (privatni artifact,
Sašin primjer: zagrijavanje + Blok 1 4 vježbe × 3 serije + Blok 2 2 × 2):
<https://claude.ai/artifact/Uon18ZHeVYD5oEYYkrpmJy>; kopija u repou [`mockups/trening_snaga_add.html`](mockups/trening_snaga_add.html)
(otvara se dvoklikom). **Još nije odluka** — potvrđuje se u S189 uz Sašin Excel i
mjerenje na TEST-u (nekoliko tisuća takvih zapisa: lista, View, Excel). ⇒ **Izmjereno S189 — v. „Mjerenje za korak 4" ispod.**
- **Jedan zapis = jedna serija jedne vježbe**, s atributima `blok` i `serija` (+ vježba, kg, ponavljanja,
  trajanje). Isto pravilo za piramidu, krug i zagrijavanje. Aplikacija tako zna koje su vježbe bile u istom krugu
  (Saša: „bilo bi dobro da zna da je serija"). Naziv: **serija** = jedan prolaz kroz blok.
- **Forma:** serije jedna ispod druge (mali ekran); „+ serija" ponovi zadnju ispod s istim vježbama, kg i
  ponavljanjima, prethodne se sklope u jedan red teksta; u seriji „+" (vježba ispod) i „×" — zamjena vježbe kad je
  sprava zauzeta je normalan tok, pa svaka serija nosi svoj popis vježbi. Zagrijavanje je popis bez krugova,
  vrijednost se upisuje kao u DIARY-ju (`7:00`, `2x20`, `2:30`) i forma pokaže kako je razumjela.
- **Tekstualna notacija se NE sprema** (Saša je pitao: jedan red teksta po seriji + alat koji komprimira /
  dekomprimira). Odbačeno: dekomprimirani zapisi bili bi druga kopija istog podatka koja se razilazi s tekstom
  bez poruke (pravilo S185 „izvedeno računaj pri prikazu"), a tipfeler u tekstu tiho ispada iz analize. Tekst je
  **prikaz** (sklopljena serija, lista) i **ulaz za uvoz povijesti** (korak 9, `pravila.py`).
- **Mjere vježbe žive u katalogu** (korak 5), ne u zapisu: npr. „po ruci" (Saša: lateralno = uteg od 2 kg u
  svakoj ruci ⇒ upisuje se 2, volumen 2 × 2 × 12). Ime vježbe u skici (`lateralno (uže)`) je krivo — Saša:
  nešto kao *hand lateral raises*, slug tipa `hand lat.r.`; odlučuje u Excelu kataloga.
- **Odmor:** jedno neobavezno polje po bloku (sekunde), skriveno dok se ne uključi; dodaje se kad zatreba (EAV —
  ne dira postojeće zapise). Saša ga ne bilježi.

**Oporavak i spremnost — 29.10. (S188, Saša, smjer prihvaćen)** — cilj: *„naučiti što više o sebi — kako ne
pretjerati, ali ni pustiti"* (67 g., oporavak se produljuje). Tri razine, od najjednostavnije:
1. **Pravila odmora po mišićnoj skupini** (postavka Aree, ne kod): najmanji odmor (npr. upper 3 dana ⇒ „odmara se
   još 1 dan") i najdulji razmak (npr. 14 dana ⇒ „17 dana pauze, kreni lakše" + prijedlog manjeg opsega). Čita
   zapise po seriji (korak 4) + mišićnu skupinu iz kataloga (korak 5). ⚠ Prijedlog se **prikazuje**, čovjek ga
   potvrdi — „Ponovi zadnji" nikad sam ne smanjuje težine (razred S127: tiha automatika nad unosom).
2. **Izmjeriti osobni oporavak umjesto pogađati:** alat koji samo čita — za svaki trening snage (DIARY od 2021.)
   koliko dana treba da se noćni puls i HRV (Garmin 2014.–02.2025., `Health_Sasa` / `GarminData`) vrate na osobnu
   razinu, i mijenja li se to kroz godine. Daje brojeve za pravila iz 1.
3. **Dnevna spremnost:** odstupanje od **osobne** razine (npr. 30 dana) — noćni puls, HRV, san ⇒ „danas lakše / Z2".
   ⚠ Traži **Garmin dotok** (podaci staju 02.2025.).
- **Odmah (korak 5):** katalog vježbi dobiva stupac **mišićna skupina**.
- **Mišićne skupine — prijedlog 30.10. (Saša: noge jedna skupina, adductor/abductor druga; nije odluka):**
  kriterij je *koji mišići rade zajedno u istim vježbama*, jer se zajedno i umaraju. **Noge** = quads, glutes,
  hamstrings (čučanj, iskorak, mrtvo dizanje ih opterećuju istovremeno ⇒ razdvojene bi uvijek imale isti datum);
  **Kukovi** = adductor, abductor (izolirano na spravi, manje opterećenje; abductor je uglavnom glute medius, ne
  veliki gluteus iz čučnja). **Listovi otvoreno:** najviše ih troši trčanje i brdo, ne teretana. ⇒ šire: oporavak
  nogu troši i **Outdoor** (dugi, brdski trening), pa pravilo „noge odmaraju N dana" mora brojati i njega, inače
  ne vidi dugo trčanje dan prije; koliko je to važno pokaže mjerenje (korak 11).
  Katalog: po vježbi jedna **gruba skupina za pravila** + po želji **detalj** (quads, glutes…) samo za čitanje.
  Grube skupine su opcije izbornika ⇒ kasnije se preimenuju / dijele sheetom `Restructure options`, bez diranja zapisa.
  ⇒ **Odlučeno 30.10. — v. „Katalog vježbi — Sašine odluke 30.10." ispod.**
- Aplikacija pokazuje Sašine podatke i njegova pravila, ne propisuje trening; granice opterećenja potvrđuje
  liječnik / fizioterapeut.

**Katalog vježbi — Sašine odluke 30.10. (S188/S189, Excel `analiza_snage_20261030_prijedlog.xlsx`)** — prenesene u
[`vjezbe_prijedlog.json`](../data-prep_tools/Trening/vjezbe_prijedlog.json): 451 ključ ⇒ **59 vježbi (slugova)**, 270 ključeva
`nije vježba` (pripovijedanje: „nemam", „doma"…). Po ključu: `slug`, `ime`, `skupina`, `sporedna`, `vrsta`, `napomena`.
- **Skupine (6):** `Upper-push` · `Upper-pull` · `Core` · `Legs-main` (quads, glutes, hamstrings) · `Legs-hips`
  (adductor/abductor) · `Legs-calves`. Saša: Upper odmah dijeli na push/pull (spojiti kasnije je čisto preimenovanje,
  razdvojiti traži odluku po vježbi). Ramena (lateral raises, rotatori, čunjevi, halo) ⇒ `Upper-push`.
- **Skupina pripada vježbi, ne treningu** ⇒ trening „cijelog tijela" samo obnovi više skupina; nema vrijednosti
  `whole body` (pravilo ne bi znalo koju skupinu zaključati). Vježba koja jako opterećuje dvije: **glavna** u
  `skupina`, druga u **`sporedna`** (erg + Upper-pull; step, traka + Legs-calves; swing, deadlift + Core). Koliko
  sporedna vrijedi u pravilu (cijelo / pola / ništa) — mjerenje, korak 11.
- **Vrste (5):** `Strength` · `Cardio` · `Mobility` (lagan uteg kroz opseg: indijski čunjevi, halo, rotatori,
  otvaranje ramena; i istezanje — Saša: „meni većina istezanja nije lagana") · `Stretching` · `Method` (IMOM, GtG,
  HIIT, TbyT — **način bloka, ne vježba** ⇒ atribut bloka, ne katalog; IMOM: svaka minuta = jedna serija).
- **Pravilo odmora po vrsti** (Saša 30.10.): `Strength` = najmanji odmor + najdulji razmak; `Mobility`/`Stretching` =
  **samo najdulji razmak** („ramena nisi istezao 5 dana") — gibljivost se gradi učestalošću; za Sašu je to „ni pustiti".
  Kardio/zagrijavanje zadano NE zaključava skupinu (bicikl, erg kao zagrijavanje).
- **Treći uvjet: rast tjednog volumena po skupini** („ovaj tjedan X % iznad prosjeka zadnja 4 tjedna", omjer
  akutnog i kroničnog opterećenja). Razlog izmjeren 30.10.: dnevni IMOM sklekovi 2022. (DIARY `M` od 03.2022, vrh
  07.2022 = 17 dana; stupac `Y` 06–07.2022; stupac `N`: *„prije sloma: … IMOM 13x4 2022-08-04 … 14x5 Brugge
  2022-11-19"*) ⇒ problem s ramenom došao je uz **rast** volumena, ne uz izostanak odmora — pravilo „3 dana odmora"
  ga ne bi uhvatilo. **Prvi slučaj za korak 11.** Volumen snage = Σ kg × ponavljanja po skupini, **ne Garmin**
  (puls kod snage ne raste, Garmin ga ne vidi). Serija zagrijavanja: neobavezna kvačica, računa se odvojeno.
- **Neobavezno:** napor po bloku/treningu (RPE 1–10; Saši je istezanje teže od ergometra); povremeni **test
  gibljivosti** (zasebna mala kategorija, ne sada).
- **Simptom kao zapis** (`Health_Sasa > Symptom`: mjesto, jačina 0–10, datum). Saša: noćni bol u ramenima javlja se
  **1–2 dana poslije** treninga ⇒ korak 11 mjeri razmak trening → bol. Povijest bez zapisa: (a) DIARY tekst
  („rame", „boli", „loše spavao") — izravno, rijetko; (b) **Garmin san 10.2022.–02.2025.** (oko 860 noći s
  `awakeCount`, `awakeSleepSeconds`, `restlessMomentCount`, `avgSleepStress`, ocjenama prekida; 2016.–09.2022. samo
  početak/kraj) — neizravno; (a) potvrđuje (b). ⚠ San remeti puno toga ⇒ samo usporedba stotina noći „nakon
  treninga / bez", nikad jedna noć. Noćni bol + smanjen opseg iznad glave ⇒ Saši preporučen fizioterapeut.
- **S kim (polje na `Activity1`): `sam` / `Ašo` / `grupa`** + **periodi** (`Life_Sasa`, preklapajući, spec
  `docs/parked/Analytics_tab.md`). Ašo Nadarević (osobni trener) — DIARY „Aso" 222 dana (10 „otkazao"):
  06.2021.–12.2022. 6–10/mj (**2×/tj**), 01.2023.–10.2024. 2–6/mj (**1×/tj**), 2025. 3 dana. Prijelaz se vjerojatno
  poklapa s prijevremenom mirovinom (datum: Saša). Pitanje „je li Ašo pomagao" = usporedba po periodima (napredak
  težina po vježbi, koliko sam, nove vježbe — stupac „prvi", bol/san/HRV) uz **prikaz preklapajućih perioda**
  (mirovina, posao) — putokaz, ne dokaz (jedna osoba).
- **Pravila za uvoz povijesti (korak 9)** — iz napomena u JSON-u; jedna riječ ne smije dati dvije vježbe:
  „girja/girje" = `swing` **samo kad u zapisu nema druge vježbe**; „cucnjevi s girjom" = **jedan** `goblet_squat`;
  „ženski sklek" = jedan `z_sklek`; „loze/loza" uz kg ili „m." = `hamstring_m`, inače `istezanje_loze`; „ramena s
  2kg" = `lat_raises`, bez kg dio fraze (otv./istezanje ramena); „bic-lrg r." = `biceps` + `leg_raises`;
  „bic" = bicikl uz `'`, biceps uz kg; `squat.m`/`sqat.m` = `leg_press` (45°, Ašo); `rot.`/`rot.pod.`/`rot.ruku`/
  `rot.na boku` = `rotatori` (rotacija podlaktice na koloturu, lakat 90°, 2 smjera × 2 ruke); „kosa k. side/bočno"
  = `kosa_k_side` (Saša 30.10.: zasebna vježba, bočni core; lakša od side planka jer ne opterećuje rame), „ravno" =
  `kosa_k`. **Prije prepoznavanja normalizacija:** brojke odvojene od slova (`2xside` → `2 x side`), bez točaka,
  sinonimi (`side` = `bocno`) — pa `2xside`, `2x side`, `2x bocno` daju isto. „raises" sam ne određuje vježbu
  (`lat.` / `leg` ispred); neprepoznato ide u komentar `Activity1`, nikad krivo pripisano vježbi.
- **Intervali na kardiju** (DIARY: `4'j na 15 - 3'p, 4'j - 3,5p - 3,5j`, `6x45"+75"p`, `10x30"-p90"`,
  `4x(30"max + 90"lagano)`): blok s `Method = intervali/HIIT`, **svaki interval = jedna serija** iste vježbe
  (`orb`) s trajanjem i intenzitetom (`jako`/`lagano`). Ukupno minuta, minuta jako i broj intervala računaju se pri
  prikazu; prikaz sklapa natrag u `4j · 3p · 4j …`. Parser za sve tri vrste zapisa ide u `pravila.py` (korak 9).
- **Katalog je proširiv bez koda** (Saša: „ako netko bude htio back squat"): nova vježba = novi zapis kataloga
  (korak 5) — Add Activity na kategoriji vježbe u Arei `Katalog vježbi`; prvih 59 jednim Excel uvozom iz JSON-a.
- **Katalog za više korisnika — ODLUKA 30.10. (Saša: „puno moćnije")** — povod: kako počinje Koka.
  - **Katalog je zasebna Area `Katalog vježbi`**, dijeljena (read, ili write ako i drugi dodaju vježbe). Razlog:
    vježbe su **podaci** (zapisi), a „From template" kopira strukturu i postavke, ne podatke ⇒ katalog unutar
    `Fitness` ne bi došao uz predložak, a dijeljenje cijele `Fitness` Aree pokazalo bi i sve Sašine treninge.
    Slike/opisi na jednom mjestu za sve.
  - ⇒ **„Izbornik iz druge kategorije" čita kategoriju iz DRUGE Aree** koju korisnik smije čitati (RLS čitanja,
    ne vlasništvo) — opći mehanizam od početka, ne preseljenje kasnije. Atribut u treningu pamti **slug**.
  - **Novi korisnik (Koka):** `Fitness_Koka` iz predloška (struktura, rutina, atributi, pravila oporavka — bez
    ijednog treninga) ⇒ alat „Area → template" iz strateškog koraka 5 (isti kao za Financije). Ništa ne
    konfigurira unaprijed: izbornik **na vrhu nudi vježbe koje je već koristila** (iz njenih zapisa), ispod
    cijeli katalog; aliasi iz DIARY-ja služe samo Sašinom uvozu povijesti. Rutine nastaju iz korištenja
    („Ponovi zadnji" = njen zadnji trening te rutine). Pragovi oporavka su postavka njene Aree.
  - Pločica oporavka bez dovoljno povijesti (rast volumena traži ≥ 4 tjedna) **kaže „premalo podataka"**, ne šuti
    i ne izmišlja prosjek.
- **Skica kataloga** (30.10., prije koda): <https://claude.ai/artifact/Wku3VTDv5dm1Qn42NviHnw>, kopija
  [`mockups/trening_katalog.html`](mockups/trening_katalog.html) — lista po skupinama, View vježbe, izbornik vježbe
  u Add formi (grupiran, sa slikom, ⓘ „prikaži vježbu"), pločica oporavka (primjer brojki). **Slike:** privitak uz
  zapis kataloga (Sašina fotografija sprave ili zbirka s otvorenom licencom — free-exercise-db / wger, licencu
  provjeriti), nikad dohvat s tuđeg servera pri prikazu.

**Mjerenje za korak 4 — 30.10. (S189, TEST, probna Area `S189 serije proba`)** — alat
[`proba_serije.py`](../data-prep_tools/Trening/proba_serije.py) (samo TEST): 402 treninga po obrascu DIARY-ja
(snaga u blokovima, IMOM, intervali) = **7.936 zapisa serija** + 402 roditelja, 46.919 vrijednosti; serija po
treningu medijan 19, 90 % ≤ 23, plus dva ekstrema (120 i 220 serija). Mjereno Playwrightom kroz app
(`Claude-temp_R/s189/_probe_S189_serije.spec.ts`, ne commita se) i brojanjem u bazi.

| Što | Izmjereno | Sud |
| --- | --- | --- |
| Upit liste (izbor leafa → prvi redak) | 1,1 s (mala seed Area 0,9 s) | ✅ količina nije problem |
| Lista — stranice | stranica = **20 eventa**, ne 20 treninga: trening od 220 serija = **11 istih redaka**, „Load next 20" doda 1 redak, brojač „1 loaded · 7936 events" | ✗ **lista mora stranicati po treninzima** (korak 6) |
| View / Edit — prikaz | jedan zapis po tabu `#1 … #N` (24 taba za 24 serije) | ✗ treba prikaz serija po bloku (skica forme; korak 6/7) |
| View / Edit — atributi treninga | upit bez stranica: 220 serija = 1.102 vrijednosti ⇒ stiglo **1.000**, 20 serija prazno; Edit + pomak vremena ih je **obrisao** (1.102 → 1.000, poruka o uspjehu) | ✅ **popravljeno S189** (paginirano); isto mjerenje poslije: 1.102 → 1.102 |
| Excel izvoz (7.936 redaka) | 44–58 s, 0,97 MB; **10 redaka dvaput, 10 izostalo** (granice 1000, isti `session_start`) | ✅ **popravljeno S189** (`.order('id')`); uvoz istog filea poslije: 7.936 nepromijenjenih, 0 sukoba |
| Excel uvoz istog filea | analiza 9–10 s | ✅ |
| Excel uvoz NOVIH treninga (11 treninga, 209 serija, bez `event_id`) | analiza 3 s, upis **47 s ≈ 0,23 s po seriji**; roditelji 11, vrijednosti točno 1.263 | ✅ povijest (~20.000 serija) ≈ 75 min, u više fileova (korak 9) |
| Redoslijed serija u View-u | uvoz daje svim zapisima treninga **isti `created_at`** ⇒ View ih je prikazao izmiješane (`1/3/4, 1/2/3, 1/1/2…`) | ⇒ redoslijed mora nositi zapis (`red`) |
| Edit Save kad se mijenjaju svi zapisi (220) | 114 s (po eventu update + delete + insert) | ~0,5 s po zapisu; nova forma će pisati skupno |

Usput izmjereno (nije format, ide u BACKLOG / Open bugs): **Edit pomak vremena ostavlja stari P2 roditelj** i
stvara novi (`BUG-S189-PARENTSHIFT`; TEST `Fitness` ima 4 takva siročeta od 18.09. i 17.10.); **zastarjeli izvoz ne
vraća obrisan redak** — `row_hash` netaknut + `event_id` kojeg nema ⇒ „Unchanged (skipped)" bez poruke.

**Prijedlog odluke za korak 4 (S189, na temelju mjerenja — čeka Sašin „da" za dvije točke):**
1. **Jedan zapis = jedna serija jedne vježbe** — potvrđeno: količina nije problem ni u bazi, ni u upitu, ni u Excelu.
   Ono što puca je **postojeći prikaz** koji pretpostavlja malo eventa po treningu (lista, View/Edit tabovi) — to je
   posao koraka 6/7, ne razlog za drukčiji format.
2. **Atributi zapisa:** `vjezba` (slug iz Aree `Katalog vježbi`), `blok`, `serija`, **`red`** (položaj vježbe u
   seriji — nužan, v. redoslijed), `kg`, `ponavljanja`, `trajanje` (s), `intenzitet` (`jako`/`lagano`, intervali),
   `zagrijavanje` (kvačica). Prikaz slaže po `blok` → `serija` → `red`, nikad po `created_at`.
3. ❓ **Atributi bloka** (`metoda`, `rpe`, `odmor`): blok nema vlastiti event (roditelj ima 1 event po treningu,
   leaf N) ⇒ prijedlog: **na prvom zapisu bloka** (serija 1, red 1) — jedna kopija; forma ih ondje čita i piše, u
   Excelu stoje u prvom retku bloka. Alternativa (na svakom zapisu bloka) daje kopije koje se Excelom mogu
   razići bez poruke.
4. ❓ **Zagrijavanje:** popis prije blokova = **`blok` 0** (bez krugova: `serija` 1, `red` 1…N); kvačica
   `zagrijavanje` ostaje za lakšu seriju unutar bloka. Volumen ih računa odvojeno.
5. `s_kim` i `rutina` na `Activity1` (roditelj) — kako je dogovoreno.
6. **Prije uvoza povijesti (korak 9) mora biti gotovo:** lista po treninzima i prikaz serija (korak 6/7).

**Koraci** (status se ažurira; A4 / K2 dolaze poslije koraka 9):

| # | Korak | Status |
| --- | --- | --- |
| 1 | d1 — ukinuti skrivanje na defaultu (forma, help, CLAUDE.md) | ✅ S187 kod (`test-branch`), E2E `S187_default_visible`; ručno T-S187-1 ✅ |
| 2 | Pravilo vidljivosti `visible_when` — Excel, panel, forma, obavezno, planer | ✅ S187 kod (`test-branch`), unit `visibleWhen` 53, E2E `S187_visible_when` (stara forma pada); ručno T-S187-2 ✅ S188 |
| 3 | Analiza zapisa (PROD `Strength` + DIARY `M`) ⇒ Excel za Sašu: vježbe, mjesta, rutine | ✅ S187 alat + Excel; ✅ 30.10. Saša ispravio list `Vjezbe` ⇒ `vjezbe_prijedlog.json` (59 vježbi, skupine, vrste). List `Mjesta` još nije pregledan |
| 4 | Format zapisa serija (odluka „ime ili veza" donesena 28.10.: slug) | 🟡 S189 **izmjereno** (7.936 serija na TEST-u, v. „Mjerenje za korak 4"): zapis po seriji potvrđen, + `red`; usput popravljeni izvoz i View/Edit (rezanje na 1000). ⬜ Sašin „da" za atribute bloka (prvi zapis bloka) i zagrijavanje (`blok` 0) |
| 5 | Katalog vježbi kao **zasebna Area `Katalog vježbi`** (slug + puno ime, slika, skupina + sporedna, vrsta, „po ruci") + izbornik iz kategorije **druge Aree** + gumb „prikaži vježbu"; uvoz 59 vježbi iz `vjezbe_prijedlog.json` | ⬜ (odluka 30.10.) |
| 6 | Model `Activity1` / `Gym` / `Outdoor` na TEST-u (`Fitness_Garmin`) + **lista stranici po treninzima** i **prikaz serija po bloku** u View/Edit (izmjereno S189: postojeći prikaz puca na N zapisa po treningu) | ⬜ |
| 7 | „Ponovi zadnji trening ove rutine" (Add + shortcut na rutinu) | ⬜ |
| 8 | Review tab treninga (pločice: napredak po vježbi, Z2 minute tjedno, obujam po vrsti) | ⬜ |
| 9 | Uvoz povijesti: PROD `Strength` (457) + DIARY — alat za raspisivanje notacije | ⬜ |
| 10 | Na PROD (`Fitness`), uz Sašinu odluku o deployu | ⬜ |
| 11 | Mjerenje osobnog oporavka (DIARY snaga × Garmin noćni puls / HRV; samo čita) — može i prije koraka 9 | ⬜ |
| 12 | Pločica spremnosti po mišićnoj skupini: pravila najmanjeg odmora / najduljeg razmaka (brojevi iz 11) | ⬜ |
| 13 | Dnevna spremnost iz Garmina (odstupanje od osobne razine) — uz Garmin dotok | ⬜ |

### Izmjereno 26.10. (S185) — za F2 i za sukobe Garmin ↔ DIARY

Puni brojevi su u [`PREUREDJIVANJE_SPEC.md`](PREUREDJIVANJE_SPEC.md) §22. Ukratko:

- **DIARY `O` za 2015.–02.2025. je prepis Garmina:** oba izvora imaju 2.661 dan treninga, puls isti
  ±1 na 2.098 od 2.245 dana (93 %), km unutar 10 % na 91 %. Pravu novu informaciju `O` nosi samo za
  **rupu poslije 14.02.2025.** (465 dana s treningom, 454 s pulsom) i 171 dan bez Garmina.
- ⚠ **`Fitness_Garmin` (TEST) je držao `kcal` u kilodžulima** — omjer prema DIARY-ju 4,19 na 1.794 od 1.905
  dana. ✅ **S185:** podaci na TEST-u pretvoreni A2-om (omjer sada 1,00), a `garmin_activities_to_xlsx.py`
  pretvara sam (`pravila.kj_u_kcal`). `Fitness_Garmin` je na TEST-u prebačen s testnog outlook računa na
  Sašin Gmail (vlasništvo i autorstvo, 6.267 eventa; backup `_backup/test/2026-10-26_1621`).
- **Garmin san 07.2016.–02.2025. (3.127 noći) postoji u `C:\0_Sasa\GarminData` i nije uvezen**;
  bilješka u `garmin_daily_metrics_to_xlsx.py` („not available") je zastarjela.
- Model `Fitness` (PROD) ima atribute za sve iz `O`: `hr_avg`/`hr_max`, `kcal`, `aerobic_effect`/
  `anaerobic_effect`, `training_load` (= `opt`), `total_ascent` (= `vr`, Saša 26.10.), `mood`, `intensity`.

### Garmin — moguće opcije dotoka (⚠ iz znanja, nisam provjerio danas)

- **Službeni Garmin API** (Health/Connect Developer Program) je za tvrtke i traži odobrenje —
  za osobnu upotrebu teško dostupan.
- **Strava API** je otvoren za osobne aplikacije, ali nosi samo **aktivnosti**, ne san, HRV,
  body battery ni korake.
- **Neslužbena Python biblioteka** (`garminconnect`) se prijavljuje tvojim računom i čita i
  dnevne podatke (san, HRV, body battery). Radi lokalno, podaci ostaju kod tebe. Nije službena,
  pa se zna pokvariti kad Garmin nešto promijeni.
- **GDPR export** (kako je rađeno do sada) radi, ali je ručan i spor.

**Prijedlog:** prvo probati neslužbenu biblioteku na tvom laptopu (jedan pokus, samo čitanje);
ako ne ide, GDPR export jednom do danas pa povremeno.

### Sukobi Garmin ↔ DIARY — prijedlog načela (za razgovor)

1. **Ne spajati u jedan zapis i ne prepisivati.** Garminova aktivnost i DIARY dan ostaju
   **dva zapisa** s jasnim izvorom (`izvor = Garmin` / `DIARY`). Nijedan uvoz ne briše drugi.
2. **Za svaki atribut unaprijed reći tko je autoritet** — kao u Financijama, gdje je izvod
   autoritet za iznos, a Koka za razvrstavanje:
   - puls, kcal, training effect, točan tempo, vrijeme početka → **Garmin**;
   - raspoloženje, opis, osjećaj, ozljede, „zašto" → **DIARY**;
   - km i trajanje → Garmin kad postoji, DIARY kad Garmina nema (stara povijest, zaboravljen sat);
   - koraci i noćni puls → Garmin; DIARY popunjava rupe.
3. **Sukob se prijavljuje, ne rješava tiho:** popis dana gdje se brojke razlikuju više od
   praga (npr. km > 10 %) — često je to zaboravljen sat ili dvije aktivnosti u jednom danu.

---

## 0. Ukratko

- **DIARY je čišći nego što je `Diary.md` pretpostavljao**: točno **jedan redak po danu** od
  29.05.2006. do danas, **bez rupa i bez duplikata** (+ dvije utrke iz 2005.) — 7.451 dan do
  19.10.2026. Identitet „datum + fiksno vrijeme" je zato besplatan.
- **Ali kolone su mijenjale značenje**, i to u **izmjerenim, oštrim rezovima**: `I` je do
  02.2014. bio *napor/zona*, od 22.12.2014. *raspoloženje*; `O` je do 2015. slobodna bilješka, od
  2016. strukturiran zapis s Garmina (`HR 110(134), t.ef.2,3/0 394kcal, opt35`, 98–100 % retka);
  `N` je do 2023. oznaka dana (G.O., P.H.), od 07.2024. broj koraka.
- **Od 126 kolona trening nosi ~15.** Ostalo su: izvedene formule (tjedni sažeci, tempo,
  brojači), **privatni dnevnik** (`AM`, 2016.→, od 2024. s prefiksom san % / HRV / body battery),
  **posao** (`AP`–`DQ`, 2016.–2025., zatvoren skup) i **osobni projektni log** (`DS`, 2023.→ —
  `P5` je upravo ovaj projekt).
- **Prijedlog:** privatna Area `Dnevnik` s L1 leafovima `Trening` (1 event/dan, svi dani) i `Dan`
  (zdravlje + privatni zapis, samo dani sa sadržajem); posao i projekti su **odluka opsega**, ne
  dio prvog uvoza. 17 pitanja u §5 — prva tri su identitetska i blokiraju generator.

---

## 1. Inventar (izmjereno)

### 1.1 File

| | |
| --- | --- |
| Veličina | 17,1 MB, 15 sheetova, svi vidljivi |
| Makroi | `xl/vbaProject.bin` 51 KB. Po imenima u binarnom streamu (`Training_Menu`, `SelectToday`, `SelectRowNo`, `TimeInCell`, `copyRow`, `Unhide_Ungroup`, `Auto_open`) — **navigacija i izbornik**, ne logika podataka. ⚠ Nije dekompilirano; zaključak je iz identifikatora |
| Imenovani rasponi | `TrainData = DIARY!A21:M7535`, `SDiary = A21:O3525`, `todaycell = C17`, `RowNoCell = C13`, `HRz`, `mileKm` |
| Zamrznuto / filtar | freeze `AL7455`, autofilter `A21:T7535` |

### 1.2 Sheet `DIARY` — oblik

- **Retci 1–20 su kontrolna ploča, ne podaci:** tablica HR zona (`B2:K6` ← sheet `HRZone`),
  brojači (današnji redak, ukupno km, km/tjedan), legenda projekata `P1–P8` (`DS9:DT17`),
  metapodaci poslovnih projekata (`CG7:DL20` — šifra, klijent, broj naloga, opseg, ljudi,
  početni/završni redak, planirani/stvarni sati, razlika, status).
  ⚠ **Redak 20 nosi STARA zaglavlja** (`H = HR`, `I = Exert.`) — dokaz da je `I` nekad značio
  nešto drugo (v. §1.4).
- **Redak 21 je zaglavlje**, podaci od retka 22.
- **7.513 redaka s datumom:** 09.10.2005. i 13.11.2005. (dvije utrke), pa **neprekinuto**
  29.05.2006. → 20.12.2026. Datumi strogo rastu, **0 duplikata, 0 rupa** nakon 29.05.2006.
  Od toga **7.451 do danas** (19.10.2026.) i **62 unaprijed pripremljena buduća retka** (imaju
  samo `F = 0:00` i jedan `DS`) ⇒ **ne uvoze se**.
- Datum (`C`) je u 5.852 retka formula `=C(prethodni)+1`, dan u tjednu (`D`) `=WEEKDAY`.

Redaka po godini: 2005: 2 · 2006: 217 · 2007–2025: 365/366 · 2026: 292 do danas (+62 buduća).

### 1.3 Kolone — što nose (redci do 19.10.2026.)

**Trening (jezgra)**

| Kol. | Zaglavlje | Popunjeno | Što je izmjereno |
| --- | --- | ---: | --- |
| `A` | Period | 7.451 | **47 trenažnih blokova** (`00 - prvi polumaraton` … `44 - popustilo koljeno`, od 21.02.2021.); formula `=A(prethodni)` |
| `E` | Length (km) | 4.275 | 532 su formule tipa `=5+3`; 2010–2020 ~300/god, 2022–2026 30–70/god |
| `F` | time | 7.446 | **5.068 ≠ 0:00**; 2.378 je `0:00` (ODMOR 872, SICK 214, prazan K 920…) |
| `G` | pace | 7.423 | **formula** `=F/E` u 7.411 redaka ⇒ izvedeno |
| `H` | HR | 812 | 2006–2011 brojevi (~500), 2013. i 2016. zone `z1–z5`, 2015. brojevi |
| `I` | Mood | 4.261 | **dvije ere** (§1.4): do 02.2014. zone/brojevi, od 22.12.2014. smajlići `:-)` 2.309 · `:-|` 794 · `:-D` 103 · `:-/` 78 · `:-(` 42 |
| `J` | Intensity | 5.714 | **čisto, 5 vrijednosti:** light 2.329 · hard 1.452 · moderate 1.247 · RACE 349 · recovery 337 |
| `K` | Activity type | 4.654 | 51 vrijednost (48 bez razlike u veličini slova) — mapiranje u §3.4 |
| `L` | Terrain | 4.260 | **čisto, 3 vrijednosti:** ravno 2.413 · valovito 943 · brda 904 |
| `M` | Comment | 7.097 | glavni opis; od 2024. često počinje vremenom (`9:00 …`, `16h …`) — 128 / 194 / 194 redaka 2024/25/26 |
| `O` | HR_comment | 3.434 | **dvije ere** (§1.4); od 2016. strukturiran Garmin zapis |
| `P` | p | 569 | 2007–2015 faza/stanje (`baza`, `zavrsnica`, `tapering`, ozljeda, bolovanje, G.O.); 2018–2021 ~30 brojeva |
| `X` | Teka | 7.451 | **33 vrijednosti `t-025` … `t007`, strogo uzastopna razdoblja** od 81 do 465 dana, bez preklapanja (`t007` od 13.06.2026.) |

**Dan / zdravlje / privatno**

| Kol. | Zaglavlje | Popunjeno | Što je izmjereno |
| --- | --- | ---: | --- |
| `N` | GO | 1.310 (+6.097 `.`) | 2015–2023 oznaka dana (G.O., P.H., „free - Corona", 2016. smajlići); **od 07.2024. koraci** `11,1kk` — 728 redaka, 2025. 363/363 |
| `AL` | — | 816 | brojevi **39–52**, od **25.07.2024.**, gotovo svaki dan |
| `AM` | Private comment | 3.359 | od 2016.; **prefiks** `NN%` (san) 2023. 133/360, 2024.→ ~100 %; `NN HRV` 2024.→; `bb NN` (body battery) 2024.→ (2025.: 364/365) |
| `AN`, `AO` | — | 127 / 184 | rijetke oznake od 2022. (tjedan `w44`, lijek, P.H., grad) |
| `DR`, `DT`–`DV` | — | 10 / 29 / 10 / 9 | rijetke bilješke 2023–2026 |

**Posao (zatvoren skup — `AQ` završava 2025.)**

| Kol. | Zaglavlje | Popunjeno | Što je izmjereno |
| --- | --- | ---: | --- |
| `AP` | office | 357 | 2021–2025, brojevi (sati?) i oznake |
| `AQ` | Work comment | 2.569 | 2016–2025, slobodni tekst |
| `AT`–`CB` | (projekti) | ~900 ćelija | **sati po projektu po danu**, 2022–2024, 32 kolone; svaka kolona ima metapodatke u `CG`–`DL` (veza je zapisana: `CG13 = "AV"` itd.) |
| `CD`, `CE` | — | formule | dnevni / tjedni zbroj sati ⇒ izvedeno |
| `CF` | — | 64 | 2022–2024 bilješke i brojevi |
| `DM`–`DQ` | — | ~110 | 2023–2025 brojač: `DQ = DQ(preth.) + DP − DO` (`DO` gotovo uvijek 20) |

**Osobni projekti**

| Kol. | Zaglavlje | Popunjeno | Što je izmjereno |
| --- | --- | ---: | --- |
| `DS` | PROJEKTI: | 545 | 2023: 23 · 2024: 11 · 2025: 224 · 2026: 287; oblik `P5 - tekst` u 185/224 (2025.) i 216/286 (2026.); legenda `P1–P8` u `DS9:DT17` (P5 = AI / vibe coding — ovaj projekt) |

**Izvedeno ili smeće — ne uvozi se**

`B` (period-tjedan), `C`→`event_date`, `D`, `G`, `Q` (intenzitet u broj), `R` (vrijeme trčanja),
`S`–`V` (tjedni sažetak svakih 7 redaka — 1.064 tjedna, s `#DIV/0!`/`#VALUE!`), `W` (7.513 `.`),
`CD`, `CE`, `DQ`. Kolone `Y`–`AI` (2013–2016, ≤ 262 ćelije po koloni, mješavina bilješki,
programa trenera i formula s `#VALUE!`) — v. pitanje Q15.

### 1.4 Ere — gdje je kolona promijenila značenje

| Kol. | Era 1 | Era 2 | Rez |
| --- | --- | --- | --- |
| `I` | 2006 – **02.02.2014.**: zone `z1–z5` (~470) + brojevi (~440) — stari naslov `Exert.` | **22.12.2014.** →: raspoloženje, 5 smajlića | 10 mjeseci prazno između |
| `O` | 2006–2014: slobodna bilješka o danu (~515) | 2015.→: `t.ef` (97 %), 2016.→ `HR a(b)` (98–100 %), `kcal` 2016.→, `VO2max` 2015–2021, `opt` 2022.→ | 2015. prijelazna |
| `H` | 2006–2011 brojevi (puls) | 2013. i 2016. zone | rijetko u obje |
| `N` | 2015–2023 oznaka dana | 07.2024.→ koraci `NN,Nkk` | čist rez |
| `AM` | 2016–2022 čisti tekst | 2023.→ san %, 2024.→ + HRV + bb | prefiks uvijek na početku |
| `K` | 2006–2021: prazan K + km = trčanje (2.493 retka) | 2021.→ K gotovo uvijek popunjen | nakon ozljede koljena (blok 44) trčanja skoro nema |

### 1.5 Ostali sheetovi

| Sheet | Redaka | Što je | Prijedlog |
| --- | ---: | --- | --- |
| `Krv` | 161 | nalazi krvi + zdravstveni događaji, **2003.–2026.** | Q16 — preklapa li se s `Bloodwork.xlsx` (već u `Health_Saša`, S68/S74) |
| `trkaceDionice` | 2.634 | planovi treninga po dionicama, 2011–2018 | ostaje u Excelu (alat za planiranje, ne zapis) |
| `Snaga` | 56 | popis vježbi snage | izvor za `suggest` opcije, ne uvoz |
| `HRZone`, `MAF`, `RunFormula` | — | kalkulatori (zone, MAF, Daniels) | ne |
| `Janko` | 42 | trenerov program 2015/16 | ne |
| `Pivot` | 147 | pivot nad DIARY | ne (izvedeno) |
| `LinksA` | 94 | **„ORGANIZACIJA DNEVNIKA (staro)"** — Sašin raniji model (v. §2) + bilješke | čita se kao input za model |
| `ToDo`, `Starship`, `staz`, `LinksP` | — | nevezano uz trening | ne |

---

## 2. Usporedba s `Diary.md` (04.07.)

| `Diary.md` tvrdi | Izmjereno | Posljedica |
| --- | --- | --- |
| ~7000 redaka, od ~2015 | **7.451 dan od 29.05.2006.** (+2 iz 2005.) | 20 godina, ne 10 |
| 1 redak = 1 dan = 1 event | ✅ potvrđeno — 0 duplikata, 0 rupa | identitet je siguran |
| `H` → `hr` | `H` ima **812** redaka; puls je u `O` (2016.→) | izvor pulsa je `O` |
| `I` Mood, „normalizirati" | **dvije ere s različitim značenjem** | dva atributa ili odbaciti eru 1 (Q5) |
| `O/P` = HR/kcal/opt | `O` da (od 2015/16), **`P` je faza/stanje**, ne puls | `P` je zaseban atribut |
| `pace` kao text atribut | `G` je **formula** `=F/E` | izvedeno — Q11 |
| `t_ef` ostaviti text | `t.ef.2,3/0` u 97–100 % redaka, uvijek isti oblik | dva broja (Q6) |
| Korak 0: batch INSERT prije uvoza | **već napravljeno u S104** (`excelImport.ts`, Q3 Fable) | korak otpada |
| Projektni sati = vlastiti leaf | ~900 ćelija, 2022–2024, s metapodacima; posao završio 2025. | zatvoren skup, odluka opsega (Q13) |
| `AM` = privatni dnevnik | ✅, ali od 2023/24. nosi **strukturiran prefiks** (san, HRV, bb) | brojevi se mogu izvući — Garmin GDPR export ih **nema** (`MIGRATION_STATE.md`) |
| `AL (52,7% …)` nepoznato | `AL` = broj 39–52 od 25.07.2024. | Q7 |
| — (nije spomenuto) | `A` = **47 trenažnih blokova**; `X` = 33 uzastopna razdoblja | dva korisna atributa |
| Privatna Area, ne `Health_Saša` | ✅ vrijedi — `AM` je privatan | — |
| Tjedni sažeci se ne uvoze | ✅ `S`–`V` su formule | — |

**Sašin stari model iz `LinksA`** („Struktura baze") vrijedi pročitati prije odluke: već ima
`Category → Sub-cat1 → Sub-cat2 → Sub-cat3` (`sport → run → hard → fartlek`,
`sport → run → RACE → liga Jaska`, `sport → SICK → injury`, `work → calculation → fittings`) i
predviđa `Mood-immediate` i `Mood-hindsight` kao **1–5**. Prijedlog u §3.4 slijedi tu hijerarhiju.

---

## 3. Predloženi model

### 3.1 Area i leafovi

```
Dnevnik (Area — privatna, nikad se ne dijeli)
├── Trening (L1 leaf)   1 event za SVAKI dan 29.05.2006. → danas (+2 iz 2005.) = 7.451
└── Dan     (L1 leaf)   1 event samo za dan koji ima sadržaj (AM / N / AL / AN / AO …), ~3.500
```

- **L1 leafovi, bez međurazine** ⇒ nema P2 roditeljskih eventa (isto kao `Financije_all >
  Transakcija`). P1 je ispunjen trivijalno (atributi na leafu); P3 vrijedi za roundtrip ispravke.
- **Zašto dva leafa, a ne jedan** (kako je predlagao `Diary.md`): trening i dan imaju različite
  potrošače — lista kolona, filtar i buduće pločice za trening ne smiju se miješati s 3.000+
  privatnih zapisa. Privatnost je po Arei, pa su oba leafa jednako zaštićena.
- **Zašto `Trening` nosi i dane bez treninga** (ODMOR 936, SICK 352, prazni 270): bez njih se
  raspada tjedna analiza i rekonstrukcija tablice (`Diary.md` §2.1 — vrijedi i dalje).
- Posao i projektni log **nisu** u prvom uvozu — v. Q13, Q14.

### 3.2 Identitet

- `session_start` = **datum + fiksno lokalno vrijeme**, generator ga piše kao **tekst `HH:MM`**
  (CLAUDE.md § Excel, rupa (a)). Prijedlog **06:00 za oba leafa** (Q2) — različite kategorije se
  ne sudaraju (`useActivities` grupira po user + kategorija + `session_start`).
- Vrijeme iz `M` (`9:00 CleverFIT …`) **ne ulazi u identitet** — popunjeno je tek od 2024. i
  nedosljedno. Ako treba, ide u zaseban atribut (nije u prijedlogu).
- Ponovni uvoz istog raspona ⇒ kolizija / UPDATE, ne duplikat. Generator je zato slobodno
  ponovljiv dok se identitet ne mijenja.

### 3.3 Atributi — `Trening`

| Slug | Tip | Izvor | Pravilo |
| --- | --- | --- | --- |
| *(comment)* | — | `M` | doslovno |
| `period` | text + suggest (47) | `A` | keširana vrijednost formule |
| `vrsta` | text + suggest | `K` (+ prazan K) | §3.4 |
| `podvrsta` | text + suggest, `depends_on: vrsta` | `K` | §3.4 |
| `intenzitet` | text + suggest (5) | `J` | doslovno |
| `teren` | text + suggest (3) | `L` | doslovno |
| `duljina_km` | number | `E` | keširana vrijednost (532 formule) |
| `trajanje_min` | number | `F` | h:mm:ss → minute; `0:00` ⇒ prazno |
| `raspolozenje` | text + suggest (5) — ili number 1–5 (Q9) | `I` | **samo od 22.12.2014.** |
| `hr_avg`, `hr_max` | number | `O` `HR a(b)` (2016.→) | regex; era `H` — Q5 |
| `te_aerobni`, `te_anaerobni` | number | `O` `t.ef.a,b/c` | `2,3` → 2.3 (Q6) |
| `kcal` | number | `O` | regex |
| `opt` | number | `O` (2022.→) | Q6 |
| `vo2max` | number | `O` (2015–2021) | regex (+ `AL`? — Q7) |
| `faza` | text | `P` | doslovno (2007–2015) |
| `teka` | text + suggest (33) | `X` | Q4 |
| `biljeska` | text | `O` **cijeli izvorni tekst** | uvijek, i kad je parsiran |

⚠ **`biljeska` čuva izvornik `O` uvijek** — parsirani brojevi su pogodnost, ne zamjena. Tako
sigurnosna mreža iz `Diary.md` §4 ne treba markere u komentaru: ono što regex ne prepozna i
dalje stoji u `biljeska`, a prazan broj uz pun `biljeska` je pretraživ filtrom.

### 3.4 `K` → `vrsta` / `podvrsta` (prijedlog, slijedi `LinksA`)

| `K` (n) | `vrsta` | `podvrsta` |
| --- | --- | --- |
| *prazno, uz km ili intenzitet* (2.527) | `trcanje` | — (intenzitet nosi `J`) |
| `long` 390 · `interval` 271 · `track` 257 · `tempo` 241 · `fartlek` 153 · `VO2max` 20 · `recovery` 5 · `MAFtest` 2 | `trcanje` | isto ime |
| `5K` 57 · `10K` 4 · `polumaraton` 49 · `maraton` 11 · `brdska trka` 13 · `liga …` (7 imena, 180) · `Puntijarka - Njivice` 11 | `trcanje` | ime utrke (uz `J = RACE`) |
| `x-TRAIN` 1.025 · `X-TRAIN` 144 · `X-TRAIN long` 1 | `x-train` | — |
| `snaga` 188 · `snaga-noge` 10 | `x-train` | `snaga` / `snaga-noge` |
| `bic` 40 · `TRAKA` 5 · `tempo erg` 3 · `orb TEST` 2 · `ORBITREK` 1 | `x-train` | `bicikl` / `traka` / `erg` / `orbitrek` |
| `setnja` 62 | `setnja` | — |
| `ODMOR` 936 | `odmor` | — |
| `SICK` 262 (uklj. `sick`) · 4 varijante `SICK …` 90 | `bolest` | `setnja` / dijagnoza |
| `ozljeda` 5 | `bolest`? | `ozljeda` |
| `putovanje` 29 · `obaveze` 14 | `putovanje` / `obaveze` | — |
| ⚠ `Z2` 124 · `HIIT` 23 · `istezanje` 20 | **Q10** | |
| *prazno, bez km i intenziteta* (270) | prazno | (većinom imaju `M`) |

Zbroj: 4.654 popunjenih + 2.797 praznih = 7.451 ✓. ⚠ **Taksonomiju zaključati PRIJE uvoza**
(lekcija Financija, S105d) — poslije ime živi i u `validation_rules` i u svakom retku.

### 3.5 Atributi — `Dan`

| Slug | Tip | Izvor | Pravilo |
| --- | --- | --- | --- |
| *(comment)* | — | `AM` | **cijeli** izvorni tekst |
| `san_pct` | number | `AM` prefiks `NN%` | 2023.→ |
| `hrv` | number | `AM` `NN HRV` | 2024.→ |
| `body_battery` | number | `AM` `bb NN` | 2024.→ |
| `koraci` | number | `N` `NN,Nkk` | × 1000 (Q8), 07.2024.→ |
| `al` *(radni naziv)* | number | `AL` | Q7 |
| `oznaka` | text + suggest | `N` era 1 (G.O., P.H., …) | 2015–2023 |
| `napomena` | text | `AN` + `AO` + `DR` + `DT`–`DV` | spojeno s ` / ` (Q15) |

### 3.6 Procjena obujma

`Trening` ~7.451 eventa i ~60.000 vrijednosti atributa; `Dan` ~3.500 eventa i ~10.000
vrijednosti. Red veličine kao `Financije_all` — batch po sesiji postoji (S104), uvoz po godinama
ostaje razuman oprez.

---

## 4. Što je jasno (predlažem bez pitanja)

1. **Jedan redak = jedan dan = jedan `Trening` event**, uključujući odmor i bolest.
2. **62 buduća retka i retci 1–21 se ne uvoze.**
3. **Izvedeno se ne uvozi** (§1.3, zadnji odlomak) — tjedni sažeci, `Q`, `R`, `CD`, `CE`, `DQ`.
4. **Keširane vrijednosti formula** su izvor (`E`, `A`, `C`). File je zadnji spremio Excel, pa
   su keširane — ⚠ generator mora **stati** ako naiđe na formulu bez keširane vrijednosti
   (file spremljen alatom koji ne računa), umjesto da je pročita kao prazno.
5. **Izvorni tekst se nikad ne gubi**: `M` → comment, `O` → `biljeska`, `AM` → comment `Dan`.
6. **Kontrola nakon TEST uvoza** = brojke iz §1 (7.451 eventa, `J` 5.714, `L` 4.260, `E` 4.275, …).
7. Lekcije Financija za generator: `Area` + `Category_Path` + e-mail u kol. G u **svakom**
   retku, `session_start` kao tekst, bez booleana.

---

## 5. Pitanja za Sašu

**Identitet — blokiraju generator**

- **Q1 — Area i leafovi.** `Dnevnik` s leafovima `Trening` i `Dan` (preporuka)? Ili drukčije ime
  (`Trening`, `Trening_dnevnik`)?
- **Q2 — Fiksno vrijeme `session_start`.** 06:00 za oba leafa (preporuka)? Odluka je zauvijek.
- **Q3 — Što poslije uvoza?** Nastavljaš li pisati `trening.xlsm` (⇒ generator mora biti
  ponovljiv za svaki novi raspon, i to je redovni posao), ili od datuma X unosiš u aplikaciju
  (⇒ jednokratan uvoz + Add forma / shortcutovi za `Trening` i `Dan`)? Mijenja koliko generator
  mora biti robustan.

**Značenje kolona — prije generatora**

- **Q4 — `X` „Teka"**: 33 uzastopna razdoblja (`t-025` … `t007`, 81–465 dana). Tenisice?
  Bilježnica? Ako tenisice — želiš li km po paru (onda je atribut koristan, inače je šum)?
- **Q5 — `I` prije 2014. i `H`**: što su brojevi u eri „Exert." (npr. 163, 387) i zone u `I`?
  Je li `H` 2006–2011 prosječni puls? Uvesti kao `napor` / `hr_avg` ili ostaviti samo u `biljeska`?
- **Q6 — `O`**: je li `t.ef.2,3/0` = aerobni / anaerobni training effect (onda dva broja)? Što je
  `opt` (2022.→)?
- **Q7 — `AL`** (39–52, od 25.07.2024.): što je? (VO2max? Stres? HRV?)
- **Q8 — `N` „11,1kk"**: tisuće koraka?
- **Q9 — Raspoloženje**: smajlići kao tekst ili broj 1–5 (kako je predviđao `LinksA`)? Broj daje
  prosjek po periodu, tekst čuva izvornik.
- **Q10 — `K`**: kamo `Z2` (124), `HIIT` (23), `istezanje` (20)? I je li dvorazinsko
  `vrsta`/`podvrsta` (preporuka, kao Tip/Podtip u Financijama) bolje od jedne liste?
- **Q11 — Tempo**: spremiti kao `pace` text `MM:SS` (kao `Fitness_Garmin`) ili ne spremati jer je
  izveden? (Preporuka: ne spremati — ispravak km bi ostavio krivi tempo.)

**Opseg — mogu i poslije**

- **Q12 — Brojevi iz `Dan`** (san, HRV, bb, koraci): u privatni `Dnevnik` (preporuka) ili u
  `Health_Saša > Daily_metrics` (dijeli se s Kokom)? Tekst `AM` je privatan u svakom slučaju.
- **Q13 — Posao** (`AP`, `AQ`, `AT`–`CB` + metapodaci, `DM`–`DQ`, 2016–2025): migrirati uopće?
  Ako da — zasebna privatna Area `Posao` (leaf `Dan` s `AQ` + leaf `Sati` s `projekt` + `sati`).
  Što je brojač `DM`–`DQ`?
- **Q14 — `DS` PROJEKTI**: ovdje kao treći leaf, ili u Areu `Projekti` uz ideju o uvozu sesija
  ovog projekta iz transkripata (isti `P5`)?
- **Q15 — Stari stupci** `Y`–`AI` (2013–2016) i rijetke oznake (`AN`, `AO`, `DR`, `DT`–`DV`):
  spojiti u `napomena`, ili ih ostaviti samo u `trening.xlsm` kao arhivi?
- **Q16 — Ostali sheetovi**: preklapa li se `Krv` (2003–2026) s `Bloodwork.xlsx` koji je već u
  `Health_Saša`? Ostaju li `trkaceDionice`, `Janko`, `Snaga` samo u Excelu?
- **Q17 — Garmin**: `Fitness_Garmin` je na TEST-u, nije na PROD-u (`MIGRATION_STATE.md`). Ide
  li uopće? Ako ne, `O` brojevi su jedini zapis pulsa/kcal treninga u bazi; ako da, dupliciraju se
  (svjesno, kao u `Diary.md` §2.6).

---

## 6. Sljedeći koraci (kad stignu odgovori)

1. Odgovore upisati ovdje (§5 → odluke), preusmjeriti uputnice (`Diary.md` → `docs/_archive/`,
   `AUTOMATION_SPEC` Faza 4, `DATA_PIPELINE_PLAN` Prioritet 5, BACKLOG, `MIGRATION_STATE`).
2. Generator `data-prep_tools/Trening/trening_to_xlsx.py` iz `Tools/excel_import_template.py`:
   Structure sheet (kategorije, atributi, `suggest`, `depends_on`) + Activities po godinama.
   Čita **kopiju**, zadano piše samo izlazni xlsx.
3. Review workbook: retci gdje regex nije uspio na eri u kojoj bi trebao (npr. `O` 2017.→ bez
   `HR a(b)`: ukupno 35 redaka 2017–2025, najviše 12 u 2021.) — za Sašin pregled, ne za brisanje.
4. TEST uvoz (TEST korisnik), provjera brojkama iz §1, pa list columns + export profil
   „DIARY layout" za rekonstrukciju tablice.
5. PROD. F5 (`AreaSettings`) treba tek kad `Dnevnik` dobije pločice.

---

## 7. Kako je mjereno

Kopija filea (`cp` iz OneDrivea u `Claude-temp_R/trening/`), `openpyxl` dvaput (formule i
`data_only`), sve ćelije `DIARY` u memoriju, pa brojanje po koloni × godini, tipu vrijednosti
i regexu. Skripte su jednokratne (scratchpad, nisu u repou); ponavljanje je ~1 min. Privatni i
poslovni sadržaj (`AM`, `AQ`, imena ljudi i klijenata) namjerno **nije citiran** — ovdje stoje
samo oblik i brojke.
