# Backlog

> Preseljeno iz korijenskog `CLAUDE.md`-a u S151 **doslovno** — backlog je plan (kvarljiv), ne
> pravilo, a CLAUDE.md se učitava u svaku sesiju. Čitaj pri **planiranju sesije**.
> Prolaz s odlukama po stavci: `BACKLOG_2026-09-26.md`. **Stanje nakon S152:** `BACKLOG_2026-09-26_S152.md`.


> **Struktura NOSI trijazu, umjesto da je opisuje** (S140). Do tada je ovdje stajao odlomak
> koji je nabrajao sto je parkirano a sto otvoreno — pa je svaka sesija citala svih 306
> redaka da bi dosla do istog zakljucka. Sada je dovoljno procitati **prvi** podnaslov.
>
> /!\ Unosi su preslozeni, **nijedan znak u njima nije promijenjen**. Svrstavanje je
> procjena i smije se ispraviti; zato je pravilo bilo **u korist vidljivosti** — sto je bilo
> dvojbeno islo je u „Otvoreno". Krivo prikazan zadatak kosta jedan pogled, krivo sakriven
> kosta zadatak.

### Otvoreno — ovo je posao

**Prolaz kroz backlog 2026-09-26 (S150)** — odluka po svakoj stavci i jednostavni opisi:
`docs/sessions/BACKLOG_2026-09-26.md`. Gotove stavke su izbačene (tekst u `DONE_HISTORY.md`,
§ S150). Nove i preformulirane stavke iz prolaza:

- **💶 Financije — sav otvoreni posao je u [`docs/FINANCIJE_PROCES.md`](../FINANCIJE_PROCES.md) §4** (preseljeno S158 doslovno, puni tekst u §8: C1 izvodi, C5 traka i Visa u traku, PBZVISA prolaz, RF `Izvod opis`, `oznaci_iz_presedana`, zaostaci S125). Ovdje ostaje samo održavanje klasifikacije (K0–K5), jer je generično.
- **Održavanje klasifikacije — spajanje/brisanje rijetkih i nekorištenih parova (S153)** —
  `docs/KLASIFIKACIJA_ODRZAVANJE_SPEC.md`. Klasifikacija raste iz rada („Other"), održavanje
  nije ugrađeno. Plan K0–K5: inventar (samo čita) → Kokina odluka → alat koji generira app
  Excel + Structure file → uvoz (Activities **prije** Structure) → provjera (Σ nepromijenjen)
  → kasnije broj redaka uz opciju u panelu. **Generično**, ne samo Financije.
  ⚠ Brisanje opcije ne dira retke ⇒ opcija s retcima se **spaja**, nikad samo briše.
  ⚠ Python rječnik uči iz baze ⇒ loš par se širi na nove retke; ranije je jeftinije.
  ✅ **K-1 izvedeno S160** (`structureImport.ts` § 5b): opcije s retcima ⇒ stop + popis + kvačica;
  file tuđe Aree ⇒ stop s porukom o vlasniku. Izvorni zapis:
  **K-1 (prvo, samostalno):** Structure uvoz mora **javiti** opcije koje briše a imaju retke, i
  **zaustaviti** file tuđe Aree porukom o vlasniku (danas tiho stvori duplikat Aree). Retke ne
  prepisuje sam — Excel ne razlikuje preimenovanje od brisanja.
- ~~**Structure uvoz (B1 + B2)**~~ — ✅ S152: jedan graditelj `validation_rules`
  (`src/lib/validationRules.ts`), brojači broje promjene; alat umirovljen za postojeću Areu.
- **⭐ D3 — POKUS IZVEDEN S159 (03.10., TEST), ishod: dva scenarija, dva odgovora.** Izvoznik
  `userb@test.com`, Area `D3 Pokus` (L1 + 2 leafa, 7 atributa: izbornik, `depends_on`, broj, datum,
  P1 atribut na roditelju; `set_attribute` pravilo, `list_columns`, `add_header`; 10 redaka + 10
  P2 roditelja, 43 vrijednosti). Uvoznik `owner@test.com`, **jedan** Activities Export, **jedan**
  Activities Import (Korak 7 „Create categories & continue" + „Import as mine").
  **A — primatelj nema tu Areu: savršena kopija.** Struktura, opcije, ovisni izbornik, automatika,
  kolone, zaglavlje identični; **43/43** vrijednosti, komentari, datumi, vremena, roditelji — sve
  provjereno vrijednost po vrijednost. Ne putuju (poznato): `dashboard` (F5), `export_profiles`,
  sidra, prilozi.
  **B — primatelj IMA istoimenu Areu drukčije strukture: tihi gubitak.** Pregled kaže samo
  „10 novih", uvoz „Import successful! 10 created", **nijedno upozorenje**. Stiglo **29/43**:
  `Lokacija` (7) i `Datum kontrole` (7) **odbačeni** jer ih primateljeva Area nema (zamka
  „krivo ime atributa se tiho preskoči", `excelImport.ts`); `Vrsta = Lab` (2) ušao kao tekst
  **izvan** primateljevih opcija; automatika, kolone i zaglavlje **nisu** preneseni. Korak 7 se
  ne javlja jer sve putanje kategorija postoje.
  **Sašin prijedlog (03.10.), za spec prije koda:** kad je file TUĐI (kol. G) a postoji istoimena
  Area koja se RAZLIKUJE — reći što se razlikuje (atributi kojih nema, opcije, automatika) i
  ponuditi: (1) **uvezi kao novu Areu** (npr. `D3 Pokus (userb)`) — prijedlog za zadano, tvoje
  ostaje netaknuto; (2) **preuzmi njihovu strukturu** — opasno, Structure Import po pravilu „file
  pobjeđuje" **briše** opcije kojih u fileu nema ⇒ samo uz popis i vlastitu kvačicu; (3) **zadrži
  svoju, uvezi samo retke** — današnje ponašanje, ali izabrano i s popisom onoga što neće stići.
  Isti file, iste razlike — i za VLASTITI file (npr. stari export) gubitak atributa je isti;
  minimalni korak koji vrijedi uvijek: **pregled mora nabrojati atribute iz filea koje Area
  nema**, umjesto da ih tiho preskoči. Veže se uz K-1.
  Logika pokusa (seed, Playwright tok, usporedba vrijednosti): `DONE_HISTORY.md` § S159.
  ✅ **Minimum izveden S160** (`findDroppedAttributes`: pregled i izvještaj imenuju atribute koje
  Area nema). **Spec s opcijama: `docs/D3_UVOZ_TUDJEG_FILEA_SPEC.md`** — odluke D3-1..6 čekaju Sašu.
- **Area kao predložak specijalizacije (D3)** — prijatelj dobije Structure (+ demo Activities) i
  ima cijelu organizaciju Aree. **Prvo istraživanje na TEST-u** pod stranim računom, zapisati
  što fali i **koliko refaktora** (Saša ne želi veliku refaktorizaciju). „Roundtrip completeness“
  (`dashboard`, `export_profiles`) time postaje preduvjet. Za stranca uvoz već pravi novu Areu —
  to je ispravno; zbrka je samo kad uvoznik već vidi Areu istog imena.
- ~~**D4/D5**~~ — ✅ S159. D4 je bio popravljen ranije (tekst prepisan, nitko nije javio);
  D5: „Import as mine“ je **ugašen** kad tuđi retci žive u dijeljenoj Arei (kopija bi bila
  duplikat u istoj Arei); za file stranca ostaje. D2: tuđi redak s `Delete?` sada **kaže**
  da je brisanje odbijeno (prije: `skip` tiho, `import_as_mine` lagao „nema event_id“).
- ~~**Filtar za brojeve (F4)**~~ — ✅ S159: `Iznos > 1000` (operator + broj, `value_number`).
  Ostaje datum/boolean — v. „Potpuni attrFilter“.
- **Help chip (F6)** — bez posebnog popisa: gotovo pitanje AI-u + kontekst stranice/Aree (uz Help
  koji zna Areu); sadržaj su `docs/help/*.md`, koje ritual ionako održava.
- **⭐ Migracija `trening.xlsm` — veliki projekt**, kreće kad se zatvore osnovni zadaci Financija
  (C1, C2/C3). File je od 26.09. u `C:\0_Sasa\OneDrive\trening.xlsm` (stara kopija preimenovana).
  Izvor za više Area (projekti, health, treninzi, periodi). Uključuje Garmin i
  `health_lab_review.py` cleanup. Načelo `oznaci_iz_presedana` Saša želi i ovdje.
**~~Kolone liste: `—` za vrijeme učitavanja~~ — ✅ S159.** Uzrok nije bio izostanak
placeholdera (postoji od S120) nego zastavica `loaded` koja je ostajala `true` od **prošlog**
skupa redaka (razred BUG-S145). Usput: upit vrijednosti nije bio paginiran (rez na 1000 ⇒ `—`
nakon par „load more“), a palo čitanje je davalo `—` umjesto `?`. Izvorni zapis:
**Kolone liste: `—` za vrijeme učitavanja izgleda isto kao prazan podatak** (S147, sitnica).
`useListColumnValues` stiže **poslije** redaka, pa lista kratko pokazuje `—` u `Tip`/iznosu.
Isti razred kao „prazno zbog mrtve reference izgleda identično kao prazno zbog nedostatka
podatka" (§ Kolone). Lijek: blijeda crtica ili sjena dok se čeka.

**~~⭐ Help ne zna u kojoj si Arei~~ — ✅ S159 (B3)**, obje razine: ime Aree + što ima
(`src/lib/helpContext.ts`). Teme se NE filtriraju. Izvorni zapis:
**⭐ Help ne zna u kojoj si Arei — a funkcija to VEĆ očekuje** (S144). `help.ts:118` gradi
redak `area: <ime>` iz `context.areaName`, a klijent šalje `context: { page, areaId }`
(`HelpPanel.tsx:164`) ⇒ ključ se nikad ne poklopi i **redak nikad ne uđe u prompt**. Dakle
mrtva grana, ne nedostajuća zamisao: tip `HelpRequest.context` već nosi i `areaName` i
`categoryId`.
⚠ **Posljedica izmjerena uživo** (S144, T-S143-16): stojeći u Arei `Fitness`, Help uredno
objašnjava sidra, kontrolne točke i delta sheet — strojariju koje ondje **nema** (`Fitness`
nema `dashboard` config ni ijedno sidro).
⚠ Popravak **ne traži nov upit**: `FilterContext` već drži `selectedArea` s `name` i
`settings`. Dvije razine: (1) proslijedi **ime**; (2) proslijedi **što Area ima**
(`dashboard`, `list_columns`, `automations`), pa odgovor može početi s *„ova Area ne vodi
saldo"* umjesto objašnjavanja mehanizma koji korisnik ne može vidjeti.
⚠ **NE filtrirati koje se teme učitavaju po Arei.** Legitimno je pitati *„kako app računa
saldo"* iz bilo koje Aree, a kriva „sposobnost" koja **zaniječe postojeću funkciju** gora je
od šuma. Dakle: **reci AI-u gdje je, nemoj mu uzimati knjige.**
⚠ Isti princip koji app već provodi na Overviewu (OQ-4): Area bez dashboarda **nema** tab,
jer je izostanak bolji od praznog. Help koji objašnjava sidra u Fitnessu je prazan Overview
tab izrečen riječima.

**~~⭐ Zatvaranje modala ne smije tiho baciti rad~~ — ✅ S160 (B4)** za `StructureNodeEditPanel`:
zastavicu diže handler, X / pozadina / View pitaju „Discard unsaved changes?"; brisanje atributa
(već upisano) ne prlja panel; ugniježđeni dijalog brisanja se sada zatvara pozadinom (= Cancel).
Izvorni zapis: (Sašin nalaz S135, uz T-S134-21).
S134 je maknuo **slučajni okidač** (selekcija koja završi izvan panela), ali ne i
**posljedicu**: namjeran klik na pozadinu i dalje odbacuje nespremljene izmjene **bez
pitanja**. Izmjereno: `StructureNodeEditPanel` uopće ne zna je li „prljav" — nema
`isDirty`, `hasChanges` ni `confirm`, a `useBackdropClose` prima `enabled` koji mu
**nitko ne šalje**.
Zamisao: zastavicu diže **handler kroz koji je promjena prošla**, pa
`useBackdropClose(onClose, !touched)`. Obrazac već postoji u ovoj bazi koda —
`userTouchedRef` (S122): pitanje nije *„ima li vrijednosti"* nego *„je li ih čovjek
dirao"*, a izračun iz stanja to ne može reći jer defaulti nose `touched: true`.
⚠ **„Prljav pa se tiho ne zatvara" je GORE od zatvaranja** — korisnik klikne, ništa se
ne dogodi, i nigdje ne piše zašto; isti razred kao tihi neuspjeh Savea koji je `assertWrote()`
zatvorio u S134. Dakle pitanje (`Discard changes?`), nikad šutnja.
⚠ Natpis je **engleski** — Structure Edit je konfiguracijska ploha; hrvatski je za Kokine
plohe unosa i Help.
⚠ Uvjet ide **po panelu, ne u hook.** Hook koristi **13** modala, a nemaju svi rad koji se
može izgubiti (`CategoryDetailPanel` je samo pregled). Guranje uvjeta u hook pretvorilo bi
jednu invarijantu u trinaest iznimki.
⚠ Usput zapaženo: `StructureNodeEditPanel:548` ima **drugi** overlay (`z-[60]`, ugniježđeni
dijalog) koji hook **ne** koristi ⇒ ne zatvara se klikom na pozadinu **uopće**. Nije kvar
(ništa se ne gubi), ali je nedosljednost koju treba odlučiti zajedno s ovim.

**Roundtrip completeness (F5)** — ✅ **format ODLUČEN S160 (Saša): retci ključ-putanja**, jedan
generički sheet `AreaSettings` (`Area | Putanja | Vrijednost`, npr.
`dashboard.widgets[0].due.baskets.Mastercard.account`); Area iz kolone A prepisuje ime Aree u
ključevima profila, pa profil preživi kopiranje u drugu Areu. Odbačeno: JSON ćelija (jedan zarez
ruši uvoz), tablica po pločici (svaki novi ključ = nov kod). **Nije izgrađeno.** Izvorni zapis:
`export_profiles` (ključ `attr:Area||CatPath||AttrName` ne preživi
rename; fix = `ExportProfiles` sheet, isti obrazac kao `Automations`) **i `dashboard`**
(fix = `Dashboard` sheet, Faza 4). „From template" je riješen u S108.

**~~⭐ `rata` ne razumije `cutoff:B:D`~~ — ✅ ZATVORENO S152 (C2)**, drukčije nego je ovdje
predloženo: `rata.date_map` **ne** prima tokene, nego rata čita **isto `set_attribute` pravilo**
(`findChargeDateRule`); `date_map` je samo rezerva. Config se ne mijenja ⇒ nema redoslijeda
deploy/Excel. Čuva `rataChargeDates.test.mjs`. Izvorni zapis (S138):
`generateRataChargeDates` (`rataAutomation.ts:77`) prima **broj dana** i uvijek kreće od
**sljedećeg** mjeseca (`d.setMonth(d.getMonth() + i)`, `i` kreće od 1). Za kupovinu
1.–3. u mjesecu to je mjesec previše: Visa kupovina 02.10. pripada izvodu koji se
zatvara **03.10.** i tereti se **05.10.**, a rata modal joj daje prvu ratu `05.11.`
⚠ Rub je **neovisan o danu** — jednako griješi sa `3` i sa `5`, pa ga popravak iz S138
(`rata.date_map.Visa = 5`) nije ni mogao zatvoriti; on je samo poravnao **dan**.
⚠ Fix je da rata koristi **isti** `evaluateDateRule` kao `set_attribute` (prva rata =
rezultat pravila nad datumom kupnje, svaka sljedeća +1 mjesec), a `rata.date_map` primi
iste tokene. Time nestaje i zamka „dva rječnika, samo jedan razumije tokene".
⚠ Traži **deploy prije** nego token uđe u ijedan Excel — nepoznat token rata parser
tiho pretvori u zadanih `15` (isto pravilo kao za `cutoff` u S137e, samo tiše: ondje
uvoz barem `console.warn`a).
Veličina: **225 Visa rata** u bazi; pogođen je samo prozor 1.–3. u mjesecu.

**`Datum naplate` ne prati promjenu datuma u Editu** — ✅ **DJELOMIČNO S152 (C3)**: pomiče se
za `same` pravilo (Racun/Cash) kad je target bio izveden iz starog datuma (`shiftSameDayTarget`).
✅ **C3b S155**: `lock_slug` na pravilu (kolona `LockAttr` u `Automations` sheetu; bez kolone
uvoz žig čuva), pomiču se i kartice bez žiga; ožigosan redak se ne pomiče i Edit kaže zašto.
✅ **C3c S155** (Sašina odluka): upozorenje u Editu kad se na potvrđenom retku (žig ili sidro)
mijenja bankino polje — ne blokira, traži vlastitu kvačicu. Bankina polja: datum + `plus`/
`minus`/`group_by`/`filters` pločice (dakle i `Izvor`, `Status`) + target i žig pravila.
⚠ Otvoreno (S155): guard na Excel uvozu i kolona `Potvrda` (S143) sidro primjenjuju i na
KARTIČNE retke (gledaju samo račun + datum, ne filtre pločice) — Edit od S155 ne (izmjereno T-S155-4).
Pravilo je opet na dva mjesta; poravnati kroz `passesFilters`.
⚠ Otvoreno (S155): Edit prikazuje `datetime` atribut u UTC satu (`12:00`), View lokalno (`14:00`) —
isti dan, dosljedno spremanje; rub je UTC sat ≥ 22 (drugi dan) — pravila i uvoz takve ne pišu.
⚠ Otvoreno: rename sluga ne popravlja `attribute_rules` (`target_slug`/`map_slug`/`lock_slug`)
— isti razred kao S105d, postojao i prije `lock_slug`.
Povijest (prolaz 26.09.): *„samo retci bez žiga izvoda, i Racun
i kartice"*. Fali (a) kartice na neožigosanim retcima, (b) provjera žiga — danas se pomiče i
ožigosan Racun redak. Žig mora doći **iz configa** (npr. ključ pravila `lock_slug: izvod_opis`
+ kolona u `Automations` sheetu), ne iz koda — `izvod_opis` je pojam Financija.
Izvorni zapis (S110): delta-shift
(`EditActivityPage.handleDateTimeChange`) pomiče samo *vremena eventa*, ne i datumske atribute.
Oba popravka u S110 tražila su ručnu izmjenu. D1b kaže `Izvor ∈ {Racun, Cash}` ⇒ `Datum naplate`
= `event_date` (ovdje `Cash` **ostaje** — D1b je o datumu naplate, ne o saldu; v. S111),
pa bi se za te retke moglo pomicati automatski. ⚠ Za kartice **ne smije** —
tamo je datum naplate vezan uz ciklus banke, ne uz dan kupovine.

**~~⭐ STRUCTURE FAN-OUT~~ — ✅ S159 za `AppHome`** (`useStructureData({ autoFetch: false })`;
učitava tek na Export/Import). Ostaje: u Sunburst načinu na desktopu rade **dvije** instance
(Sunburst + skrivena tablica) — nije mjereno je li vrijedno. Izvorni zapis:
**⭐ STRUCTURE FAN-OUT: 39 ZAHTJEVA PO POZIVU, A JEDNA INSTANCA NIKAD NE ČITA REZULTAT**
(izmjereno S141). `useStructureData()` broji evente **jednim `count: 'exact'` upitom po
kategoriji, usporedno** (S133, i to je bio ispravan izbor). Ali hook se zove na **tri**
mjesta, a svaki poziv je **zasebna instanca s vlastitim efektom i vlastitim fan-outom**:
`AppHome.tsx:122`, `StructureTableView.tsx:113`, `StructureSunburstView.tsx:186`.
⚠ **`AppHome` destrukturira samo `refetch`** (za Export gumb) — riječ `nodes` se u tom
fileu pojavljuje **0×**. Efekt se svejedno vrti na mountu ⇒ **39 upita čiji rezultat nitko
nikad ne pročita**, i to na **svakom** mountu `AppHome`-a — dakle i pri svakom povratku iz
View Detailsa (koji ga odmontira, S129).
⚠ **Izmjereno iz Playwright traceova** (S141, puni run): u jednom testu **39 + 39** zahtjeva
u sekundi razmaka, odgovoreno **11 od 78**; kroz 17 palih testova **2.601** fan-out zahtjev,
pojedini test **330** (`e15`) i **276** (`e11`) — dakle **6–8 punih fan-outa po toku**.
⚠ **Što se NE tvrdi:** da je to uzrok tih padova. U E10-2 je fan-out opalio **poslije**
isteka tvrdnje, a **7 od 17** padova nema **nijedan** zahtjev bez odgovora — dakle šutnja
mreže ne objašnjava sve. Ovo je **trošak koji stoji sam za sebe**, i tek **prvo mjerenje**
trećeg kandidata iz T-S135-11 (HTTP/1.1 drži 6 veza po hostu; 78 usporednih zahtjeva je red).
⚠ Popravak je jeftin ali **nije jednoredan**: hook treba način da se montira **bez
automatskog dohvata** (`AppHome` treba samo `refetch`), ili modul-level keš kao
`categoryCache`. Prije koda izmjeriti **koliko poziva ostane** — v. susjednu stavku o
šest upita liste, jer je vjerojatno isti uzrok (remount, ne pravi refetch).

**~~Lista se preupita ŠEST puta~~ — ✅ S159 (C4), izmjereno.** Šest je bilo za **dvije**
promjene (Area + atribut). Jedna promjena Aree: **3 → 2** upita liste (lista + nav za Prev/Next).
Treći je bio lista s **granicama prethodne Aree** (dakle i krivi retci na trenutak), pa opet kad
`useDateBounds` sjedne — „All time“ je min..max podataka, dakle filtar bez učinka, pa ga lista
više ne šalje. Na učitavanju 5 → 4 (u devu StrictMode duplira; PROD 2). Usput `.order('id')`
kao jedinstven zadnji ključ (leaf ima N eventa iste sesije).
**Iz Sašinog testa (T-S159-6): F5 je slao 6 upita liste** — prije završetka obnove filtra kontekst
kaže „nema Aree", pa su lista i Prev/Next tražile retke **svih** Area, pa opet za obnovljenu.
Sada obje čekaju `isRestored` ⇒ **6 → 2** (Playwright). ⚠ Ostaje neizmjereno: Area promjena
čita `categories` 7× i `areas` 4× — zaseban posao. Izvorni zapis:
**Lista se preupita ŠEST puta na jednu promjenu filtra** (izmjereno S122 iz Playwright
tracea: `events?select=…` na 16664, 16735, 16832, 16909, 17022, 17098 ms nakon promjene
aree). Dvije posljedice: čist trošak — a na PROD-u je Saša **grantee**, dakle skupa RLS
grana (v. „Izmjereno i nije problem") — i **osvježavanje zatvara otvoren ⋮ izbornik**, što
korisnik vidi kao „meni mi se sam zatvorio". Drugo je posljedica prvog, pa se mjeri zajedno.
⚠ Nije hipoteza nego mjerenje, ali **uzrok kaskade nije utvrđen** — prije popravka izbrojati
tko sve okida refetch (`useDateBounds` settle, `areas-changed`, promjena `attrFilter`).

**~~Help prikazuje sirov markdown~~ — ✅ S160** (`src/lib/helpMarkdown.ts`, bez ovisnosti, bez HTML-a
+ pravilo u promptu „bez naslova i tablica"). Izvorni zapis: (S159, T-S159-1 na mobitelu): `#`, `**`, ``` ``` ``` u odgovoru,
jer `HelpPanel` crta `msg.content` kao običan tekst (`whitespace-pre-wrap`). Haiku odgovara u markdownu.
Lijek: lagani renderer (naslovi, podebljano, liste, kod) ili uputa u promptu „bez markdowna". Sitnica.

**~~Structure Export na grešci izlazi PRAZAN~~ — ✅ S160** (`useStructureData.load` baca; Export
javlja „no file saved"). Izvorni zapis: (zapaženo S159). `useStructureData.fetchAll`
hvata grešku i vraća `[]`, a Export (`AppHome`) to piše u file bez Area i javlja „Structure exported".
Razred „izvoz koji ne može učitati podatke mora pasti, ne izaći kraći" (§ Excel, S125). Lijek: `refetch`
baca (ili vraća grešku), Export javlja i ne sprema file.

**Postgres upgrade — otvoren od S105, i retry ga samo SKRIVA** (spaseno iz `BUG-S121-AREACTX`,
S139). Palo citanje `areas` na PROD-u je vjerojatno S105 obrazac: free-tier se gusi. `withRetry`
iz S121 je posljedicu ucinio prezivljivom (tab se vise ne gasi trajno), ali uzrok stoji.
/!\ Zato ga retry cini **manje vidljivim, ne manje prisutnim** — a mjera da se i dalje
dogadja je broj retryja, koji danas nitko ne broji.

**BUG-S103-ANYATTR pravi fix** — SECURITY DEFINER RPC; ista investicija kao Faza 1.

**~~Potpuni attrFilter~~ — ✅ S160** datum (operator, dan, UTC granice) i da/ne (`kind` na istom
utoru; profil `slug: >=2026-10-01` / `slug: =true`). ⚠ `Rate? = No` broji samo spremljeno Ne
(TEST: 1 od 659 — ostali retci atribut nemaju); „nema vrijednosti" bi trebao NOT EXISTS, ne `!inner`.
Izvorni zapis: (number ✅ S159, F4) — proslijediti `data_type` u `AttrFilterParam`,
koristiti `value_number`/`value_boolean`/`value_datetime` s odgovarajućim operatorima.

**Structure Edit UX cleanup** — ✅ **S160 dio:** sklopive kartice (+ ⚠ u zaglavlju sklopljene),
opcije u „New attribute", „Discard changes?" (B4, vidi gore). **Ostaje:** lakše dodavanje opcija u
depends_on mapping · help docs update. Izvorni zapis (`StructureNodeEditPanel.tsx`, bez DB promjena):
collapsible attribute kartice (persist u localStorage) · `suggest` direktno u „New attribute"
formi · lakše dodavanje opcija u depends_on mapping · help docs update.

**⭐ Help „What can I do here?" chip** — standing chip po `pageHint` kontekstu; zahtijeva
sekciju „Feature inventory" u `docs/help/*.md`, **dosta detaljno** (korisnikov izričit zahtjev).

### Čeka Sašinu odluku prije ijedne linije koda

> **Prazno je PODATAK, ne propust** (S141): trenutno ništa ne čeka Sašinu odluku, pa se
> nijedna stavka ne smije parkirati ovdje „dok se ne odluči“. Zadnji stanar je bio
> **PBZVISA prolaz** — odlučen u S141 i premješten u „Otvoreno“.

### Parkirano i izvedeno — ne traži akciju

> Ceka vanjski okidac, ili je vec izvedeno pa ostaje samo zbog ostatka koji je jos otvoren
> i zbog pretrage po imenu. **Preskoci pri planiranju sesije.**

**⚠ `Financije_all` i `financije-all` su DVA POLJA, ne dvije verzije istog imena** (S118).
Podvlaka je **ime aree** — ono što čovjek utipka i što stoji u Excel koloni `Area` i u `Category_Path`.
Crtica je **slug**, i **nikad se ne tipka**: app ga izvede iz imena (`generateSlug`, `_` → `-`,
`structureImport.ts:149`), a `037` i `dashboard`/`list_columns` reference traže baš `financije-all`.
Posljedica koja se ne vidi: nazove li se area na PROD-u ikako drukčije, slug ispadne drugi,
`037` ne nađe areu ⇒ **nema Overview taba**, i nigdje ne piše zašto. Izmjereno na TEST-u:
`name='Financije_all'`, `slug='financije-all'`. U repou nema nijednog pojavljivanja krivog
oblika (`Financije-all` 0×, `financije_all` 0×) — dakle nije tipfeler koji se čisti, nego
razlika koju treba znati pri **stvaranju aree na PROD-u**.

**Preimenovanje `Financije_all` → `Financije` — ODGOĐENO, s okidačem** (Sašina odluka S117).
Okidač **nije** „kad bude na PROD-u" nego **„kad prođe zadnji uvoz koji generira pipeline"**
(batch 2024 i 2023 idu **nakon** cutovera, na PROD — rename odmah po cutoveru ugrizao bi isto
kao rename danas). Razlog odgode: ime aree je **ključ** u svakom generiranom fileu (`Structure`
`Category_Path`, `ListColumns`/`Automations` kol. A, Activities kol. `Area`), a redak s
neprepoznatom areom se **preskoči bez poruke** — S113 „0 New, 0 Modify nad punim fileom".
Mijenjati taj ključ dok alati rade je razmjena kozmetike za tihi gubitak redaka.
⚠ **Kad dođe vrijeme, rename ide kroz UI, nikad kroz novi Structure import.** UI mijenja samo
`name` i **slug ostaje** (`StructureNodeEditPanel.tsx:1049`) ⇒ `037`, `dashboard` i
`list_columns` prežive jer su slug-based. Import bi izveo **novi** slug (`generateSlug(areaName)`,
`structureImport.ts:548`) i `037` ne bi našao areu ⇒ nema Overview taba.
⚠ Jedino što rename ionako ubija: `export_profiles` (ključ nosi ime aree,
`exportProfile.ts:146`) — složiti ih nanovo, posao od par minuta.

**⭐ Prijedlog `comment`a iz povijesti — IZMJERENO, parkirano (S130, Sašina odluka).**
Ideja: u delta sheetu ponuditi uobičajen opis na temelju `Tip`/`Podtip` i iznosa, jer
Koka čita bankovnu aplikaciju a Saša tipka — dakle `Izvod opis` (primatelja) **nema**.
Ne treba ponovno mjeriti; brojke su nad PROD-om, 5.153 retka:

| ključ (Izvor=Racun, zadnjih 12 mj) | pokriva | top-1 | top-3 | top-5 | top-10 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `Podtip` | 335 | 57,6 % | 88,7 % | **93,4 %** | 98,5 % |
| `Podtip` + iznos | 193 | 76,7 % | 90,7 % | 93,3 % | 98,4 % |
| `Tip`+`Podtip` | 335 | 57,6 % | 88,7 % | 93,4 % | 98,5 % |

- **Iznos ne doda ništa**, a suzi pokrivenost s 335 na 193 retka — i upravo je on ono
  što se u Excelu ne da vezati na dropdown. Otpada i težak dio.
- **`Tip`+`Podtip` je identičan `Podtip`u sam** (samo 4 Podtipa žive pod dva Tipa, i
  spajanje im je korisno: `gorivo`/`registracija`/`popravci` pod dva auta). Znači ključ
  ostaje **jedna ćelija**, dakle ista INDIRECT formula od **424 znaka** kao postojeći
  `Podtip` dropdown — dva roditelja bi tražila **829**, a to je neprovjereno.
- **Prozor je bitniji od ključa:** cijela povijest umjesto 12 mjeseci ruši top-5 s
  93,4 % na 81,4 %, a najdužu listu diže s 14 na 41 stavku.
- **Ponuda, nikad upis:** top-1 je 57,6 % ⇒ automatski upis griješi dvije od pet.
  Isto pravilo koje već stoji uz `presedani.py`.
- ⚠ **Ne proturječi S129 pravilu** „ključ za oznaku je primatelj + poziv na broj, nikad
  Tip/Podtip". Ondje se oznaka **upisuje** na retke koji primatelja **imaju**; ovdje
  primatelja nema uopće, i ništa se ne upisuje nego nudi.
- Gdje ne pomaže: `PP (Posmrtna pripomoc)` ima 14 redaka i 14 različitih opisa, jer nose
  brojač (`PP Saša 6/60`). Tražilo bi rezanje broja iz presedana, kao za rate.
- Konkretna dobit ako se ikad napravi: `izmedju racuna` nudi
  `TROŠKOVI UČINJENI MASTERCARD KARTICOM` (11×) — pravilo „opis skupne MC naplate mora
  ostati strojni tekst izvatka" danas živi samo u dokumentaciji.

**Drill s dva uvjeta** — `FilterContext` nosi jedan `attrFilter`, a uvjet pločice ima dva
(`Izvor` + `Status`), pa drill znači „pokaži mi ovaj račun", ne „točno ove retke".
Predviđeno u OVERVIEW_TAB_SPEC §2.16 kao test; ispalo da filtru fali mogućnost.
⚠ **Nije samo drill** (Sašin nalaz S118, iz stvarnog rada u appu): isto fali u **običnom
filtru** — „ZABA **i** samo uplate" (`Racun` + `Smjer`) korisnik ne može složiti. Time to
prestaje biti polish pločice i postaje svakodnevna potreba. Sašina odluka: **ne sada.**

**Krovna analitika preko Area (F1)** — **ne** u običnom filtru (Sašina odluka 2026-09-26);
`docs/parked/Analytics_tab.md`. Okidač: prve Aree iz `trening.xlsm` u bazi. Tamo ide i „drill s dva uvjeta“.

**Pravila razvrstavanja u bazi (F2, `RULES_ENGINE_SPEC.md`)** — kasnije; brojanje povijesti
(`presedani.py`) ga je djelomično nadišlo. Okidač: AI sloj.

**`et_activity_draft` nije vezan uz korisnika** — parkirano: Saša i Koka ne dijele preglednik.

**Netlify scheduled maintenance** — kad se skupi 2–3 zadatka: `netlify/functions/maintenance.ts`
sa `schedule = "@weekly"` (orphaned share_invites, stari accepted invites, stari help_log).

**Garmin/Sleep** — podaci postoje (`C:\0_Sasa\GarminData`) ali **završavaju prerano** — treba novi Garmin export (samoposlužni izvoz podataka s garmin.com) ili alternativni alat. Ide uz migraciju `trening.xlsm`.

**Historijska migracija** `trening.xlsm` — **premješteno u Otvoreno** (prolaz 2026-09-26).

---

**~~⭐ Shortcuts po Arei — toggle u Filter panelu~~ — ✅ IZVEDENO S122** (Sašina ideja S119).
Kvačica „samo ova Area", `<optgroup>` po Arei, sufiks `0× · 25.06.` Provjereno usput:
`activity_presets.area_id` **se puni** pri spremanju (bila je otvorena sumnja), pa migracija
nije trebala. **Nije izvedeno i čeka brojke:** granica popisa („pokaži samo N") i s njom
stavka `Svi shortcutovi…`. Sašina odluka: *„nema smisla uvoditi granice bez stvarnog uvida"*
⇒ mjera se bira nad stvarnim brojem shortcutova, a prijedlog je da to ne bude broj nego
**Area** (1–2 najkorištenija po Arei). ⚠ Granica i `Svi shortcutovi…` idu **istim commitom**
— granica bez izlaza iz nje su jednosmjerna vrata (v. `FILTER_SPEC.md` §5).
Izvorna skica:
Popis shortcutova raste i **preduga lista nema smisla** — a većina ih pripada jednoj Arei.
Zamisao: **toggle u Filter panelu** koji popis suzi na shortcutove **odabrane Aree**;
isključen toggle pokazuje one koji su napravljeni **s isključenim togglom** (dakle
„globalne"). Shortcut napravljen unutar **Add Activity** po prirodi pripada Arei — ondje se
Area zna, pa se veže bez pitanja.
⚠ Prije koda razjasniti dvoje: (a) `activity_presets` već nosi `area_id` (v. `filter_state`)
— treba provjeriti je li **uvijek** popunjen, jer stari zapisi možda nisu; (b) što znači
„globalan" shortcut kad se Area filtar promijeni — nestaje li iz popisa ili ostaje.
⚠ **Preset je per-user i ID-based** (nikad ne putuje) — v. „Preset ≠ widget" u sažetku
Overview odluka. Ovo je čisto UI sužavanje popisa, ne nov oblik zapisa.
