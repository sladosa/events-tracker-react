# Backlog

> Preseljeno iz korijenskog `CLAUDE.md`-a u S151 **doslovno** — backlog je plan (kvarljiv), ne
> pravilo, a CLAUDE.md se učitava u svaku sesiju. Čitaj pri **planiranju sesije**.
> Prolaz s odlukama po stavci: `BACKLOG_2026-09-26.md`.


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

- **⭐ Izvodi: od inboxa do žiga (C1)** — RF **i** ZABA `Izvod opis`. Tok: Koka stavi PDF u
  svoju OneDrive mapu `Izvodi` → kod Saše `C:\0_Sasa\OneDrive\Izvodi` (postavljeno 26.09.) →
  **razvrstač** (prvi korak) preimenuje po **sadržaju** u `ZABA_YYYY-MM.pdf` i stavi u `izvodi/` →
  jedna naredba obrade → Excel za uvoz (pregled ostaje brana) → `Analizirani_izvodi/`.
  Podsjetnik na pločici **iz podataka** („kolovoški izvod još nije obrađen“), ne iz kalendara.
  ⚠ Testni slučaj: PBZ „Detalji transakcije“ PDF — razvrstač ga mora odbiti kao ne-izvod.
- **Structure uvoz (B1 + B2), zajedno:** BUG-S117-RULESHAPE (brojila koja broje neizmjene) i
  `make_financije_all_structure.py` taksonomija iz BASE-a (v. Zamke, S148).
- **Area kao predložak specijalizacije (D3)** — prijatelj dobije Structure (+ demo Activities) i
  ima cijelu organizaciju Aree. **Prvo istraživanje na TEST-u** pod stranim računom, zapisati
  što fali i **koliko refaktora** (Saša ne želi veliku refaktorizaciju). „Roundtrip completeness“
  (`dashboard`, `export_profiles`) time postaje preduvjet. Za stranca uvoz već pravi novu Areu —
  to je ispravno; zbrka je samo kad uvoznik već vidi Areu istog imena.
- **D4/D5** — poruka „(read-only access)“ write-grantee-u kod profila je neistinita;
  „Import as mine“ sakriti unutar dijeljene Aree.
- **„Dospjelo → potvrdi“ (C5)** — `docs/DOSPJELO_SPEC.md`; Saša: radimo.
- **Filtar za brojeve (F4)** — jedan uvjet s operatorom (`Iznos > 1000`), ne traži višeuvjetni
  filtar. V. „Potpuni attrFilter“.
- **Help chip (F6)** — bez posebnog popisa: gotovo pitanje AI-u + kontekst stranice/Aree (uz Help
  koji zna Areu); sadržaj su `docs/help/*.md`, koje ritual ionako održava.
- **⭐ Migracija `trening.xlsm` — veliki projekt**, kreće kad se zatvore osnovni zadaci Financija
  (C1, C2/C3). File je od 26.09. u `C:\0_Sasa\OneDrive\trening.xlsm` (stara kopija preimenovana).
  Izvor za više Area (projekti, health, treninzi, periodi). Uključuje Garmin i
  `health_lab_review.py` cleanup. Načelo `oznaci_iz_presedana` Saša želi i ovdje.
- **`oznaci_iz_presedana.py --apply`** — zadržati i pokrenuti (uz sitne ispravke podataka).

**Kolone liste: `—` za vrijeme učitavanja izgleda isto kao prazan podatak** (S147, sitnica).
`useListColumnValues` stiže **poslije** redaka, pa lista kratko pokazuje `—` u `Tip`/iznosu.
Isti razred kao „prazno zbog mrtve reference izgleda identično kao prazno zbog nedostatka
podatka" (§ Kolone). Lijek: blijeda crtica ili sjena dok se čeka.

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

**⭐ `Izvod opis` za RF retke — nijedan alat ga danas ne puni** (Sašin izričit zahtjev
S131: „pazi da ne zaboravimo"). `uskladi_izvod.py` radi **samo MC** izvode; RF je drugi
format i ide kroz OCR (`rf_ocr.py`), pa RF retci ostaju bez oznake „banka je ovo potvrdila".
Izmjereno na PROD-u 08.09.2026.: `Sašin tekući RF` **1.839 / 2.282 (81 %)**,
`Kokin tekući ZABA` **1.922 / 2.885 (67 %)**; od 25.08. je **17** RF redaka bez njega.
⚠ Dio tih 17 **i ne pripada** RF izvatku — kartične kupovine (`Izvor = Visa`) potvrđuje
PBZVISA izvod, ne izvadak tekućeg. Dakle prije alata treba **razdvojiti po `Izvor`u**, inače
se traži potvrda ondje gdje je po definiciji nema.
⚠ Saldo je i bez toga točan (`RF 690,79 @ 07.09.` u cent) — vrijednost je u **budućem
sparivanju**, ne u kontroli. Ide kad se RF put ionako bude dirao.

**⭐ Zatvaranje modala ne smije tiho baciti rad** (Sašin nalaz S135, uz T-S134-21).
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

**Roundtrip completeness** — `export_profiles` (ključ `attr:Area||CatPath||AttrName` ne preživi
rename; fix = `ExportProfiles` sheet, isti obrazac kao `Automations`) **i `dashboard`**
(fix = `Dashboard` sheet, Faza 4). „From template" je riješen u S108.

**⭐ `rata` ne razumije `cutoff:B:D` — prva rata zna pasti mjesec prekasno** (S138).
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

**`Datum naplate` ne prati promjenu datuma u Editu** (S110) — delta-shift
(`EditActivityPage.handleDateTimeChange`) pomiče samo *vremena eventa*, ne i datumske atribute.
Oba popravka u S110 tražila su ručnu izmjenu. D1b kaže `Izvor ∈ {Racun, Cash}` ⇒ `Datum naplate`
= `event_date` (ovdje `Cash` **ostaje** — D1b je o datumu naplate, ne o saldu; v. S111),
pa bi se za te retke moglo pomicati automatski. ⚠ Za kartice **ne smije** —
tamo je datum naplate vezan uz ciklus banke, ne uz dan kupovine.

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

**Lista se preupita ŠEST puta na jednu promjenu filtra** (izmjereno S122 iz Playwright
tracea: `events?select=…` na 16664, 16735, 16832, 16909, 17022, 17098 ms nakon promjene
aree). Dvije posljedice: čist trošak — a na PROD-u je Saša **grantee**, dakle skupa RLS
grana (v. „Izmjereno i nije problem") — i **osvježavanje zatvara otvoren ⋮ izbornik**, što
korisnik vidi kao „meni mi se sam zatvorio". Drugo je posljedica prvog, pa se mjeri zajedno.
⚠ Nije hipoteza nego mjerenje, ali **uzrok kaskade nije utvrđen** — prije popravka izbrojati
tko sve okida refetch (`useDateBounds` settle, `areas-changed`, promjena `attrFilter`).

**Postgres upgrade — otvoren od S105, i retry ga samo SKRIVA** (spaseno iz `BUG-S121-AREACTX`,
S139). Palo citanje `areas` na PROD-u je vjerojatno S105 obrazac: free-tier se gusi. `withRetry`
iz S121 je posljedicu ucinio prezivljivom (tab se vise ne gasi trajno), ali uzrok stoji.
/!\ Zato ga retry cini **manje vidljivim, ne manje prisutnim** — a mjera da se i dalje
dogadja je broj retryja, koji danas nitko ne broji.

**BUG-S103-ANYATTR pravi fix** — SECURITY DEFINER RPC; ista investicija kao Faza 1.

**Potpuni attrFilter za number/boolean/datetime** — proslijediti `data_type` u `AttrFilterParam`,
koristiti `value_number`/`value_boolean`/`value_datetime` s odgovarajućim operatorima.

**Structure Edit UX cleanup** (`StructureNodeEditPanel.tsx`, bez DB promjena):
collapsible attribute kartice (persist u localStorage) · `suggest` direktno u „New attribute"
formi · lakše dodavanje opcija u depends_on mapping · help docs update.

**⭐ Help „What can I do here?" chip** — standing chip po `pageHint` kontekstu; zahtijeva
sekciju „Feature inventory" u `docs/help/*.md`, **dosta detaljno** (korisnikov izričit zahtjev).

**⭐ PBZVISA prolaz — `Datum naplate` za Visu nema ispravljača** (S137; značenje stupca
odlučeno S141, v. dolje). `uskladi_izvod.py:939` prima **samo MC** (`Zasad samo MC izvodi`),
pa za **1.639** Visa redaka (PROD, S141) nitko ne čita izvod i ne ispravlja datum.

⚠ **Parsiranje PBZVISA-e NIJE prepreka** — izmjereno: `PBZVIZA_2026-07.pdf` daje **49 od 49**
transakcijskih redaka čitljivo, `(cid:` smetnja je 11 od 180 redaka (6 %) i samo u zaglavlju.
Ranija pretpostavka „Visa traži OCR" bila je **zamjena s RF-om** (tekući račun), ne s PBZVISA-om.

⚠ **Prepreka je što izvod daje KRIVI DATUM.** Izmjereno na svih **32** Visa izvoda:
`Dospijeće plaćanja` je **11.** sljedećeg mjeseca (20× točno 11., a 12./13./14. kad 11. padne
na vikend). Ali stvarno terećenje RF-a je **6.–7.**:

| izvod | dospijeće | stvarno terećen RF |
| --- | --- | --- |
| `PBZVISA_2026-06` | 13.07. | **06.07.** `1.495,78` |
| `PBZVIZA_2026-07` | 12.08. | **07.08.** `1.171,59` |
| — | — | **07.09.** `1.218,38` |

`Datum naplate` po definiciji znači *dan kad banka stvarno skine iznos*, dakle **6.–7.** — što se
poklapa s raspodjelom u bazi (5. → 719, 4. → 400, 6. → 176, 7. → 137), a **ne** s dospijećem.

⚠ **Zato alat mora čitati DVA izvora**, i to je jedina prava razlika prema MC alatu:
PBZVISA za stavke i rate, **RF izvod** za dan i iznos stvarne naplate. Mastercardu to ne treba
jer su mu ta dva datuma **ista** (`11.08. 1.332,52 TROŠKOVI UČINJENI MASTERCARD` na ZABA izvatku).

⚠ **`next:3` NIJE loše pogađanje naplate — to je dan ZATVARANJA izvoda, i točan je.**
Kokina teorija (*„3. se formira račun"*) potvrđena mjerenjem zadnje transakcije po izvodu:
**2. → 6×, 3. → 4×, 31. → 3×, 1. → 1×**. Dakle odgovara na *kojem izvodu trošak pripada*.
⚠ **Zato ga NE mijenjati u `next:7`** (prijedlog iz prvog nacrta ove stavke, **povučen**):
izgubilo bi grupiranje po izvodu, a ne bi dobilo točan datum jer terećenje varira 6.–7.

⚠ **Stupac je nosio DVA ZNAČENJA, ali razmjer je 40× manji nego što je ovdje pisalo**
(ispravljeno S141). Stajalo je da se Visa retci „ne grupiraju jer nisu mjereni istim
ravnalom“ — **grupiraju se**: **1.616 od 1.639** uredno sjeda u svoj ciklus, a ne sjeda
**23** retka koje je napravila aplikacija kao `next:3`.
⚠ **Posljedica je živa i danas**, izmjereno na PROD-u: otvorena košara `2026-10`
razlomljena je na **3.×13 + 5.×5** — ta dva dana su **dvije generacije configa**
(`next:3` prije S138, `cutoff:3:5` poslije). Zatvoreni ciklusi su netaknuti.
Za MC se pitanje ne postavlja jer mu se sva tri datuma poklapaju na **11.**
(izmjereno S141: **1.802 od 1.806** retka).

✅ **ODLUČENO (S141, Saša): značenje je (b) — dan kad je novac stvarno otišao.**
*„Dok se ne zna, pretpostavljamo; kad stigne izvod, editiramo na točno.“* Pretpostavka nije
druga vrsta podatka nego **isti podatak u privremenom stanju** — zato app smije i dalje
upisivati `cutoff:3:5`; treba mu **ispravljač**, ne drugo pravilo. Odbijena (a) bi tražila
prepisivanje **1.616** redaka i time nepovratno izbrisala jedini zapis stvarnog dana
terećenja po ciklusu — dakle zamjenu **izmjerenog** izvedenim.

⚠ **Ispravak je operacija nad KOŠAROM, ne nad retkom.** Izmjereno (PROD, S141): **35 od 37**
ciklusa ima točno **jedan** dan — potpis izmjerene veličine, jer bi pravilo svaki mjesec dalo
isti dan, a banka ga pomiče (2024-07 → 4., 2024-08 → 12., 2026-08 → 7.). Kad se dan sazna,
ispravlja se **cijeli ciklus odjednom**, i to ima ugrađenu kontrolu: **Σ košare po
ispravljenom danu mora dati iznos terećenja s RF-a** (isto pravilo kao MC, i isti razred kao
„zbroj košare je jači signal od sparivanja po retku“, S124).

⚠ **Redak koji već nosi `Izvod opis` SVEJEDNO dobiva ispravljen datum**, i to **nije**
kršenje pravila „potvrđen redak pripada točno jednom izvodu“: ta dva podatka dolaze s
**različitih** izvoda — PBZVISA kazuje *koje stavke, koji iznosi, koja rata*, RF izvadak
*kojeg dana i koliko je stvarno skinuto*. Svaki izvod potvrđuje **drugo polje**, pa se ne
prepisuju. Pravilo je štitilo od dva izvoda nad **istim** poljem; ovdje ih nema.

⚠ **Imena fileova nisu ujednačena: 31× `PBZVISA_`, 1× `PBZVIZA_`** (`2026-07`, i to je najnoviji,
onaj koji CLAUDE.md spominje po imenu). Alat koji glob-a jedno ime **preskace drugi, tiho** —
isti razred kao `Analizirani_izvodi/` selidba (S129). Glob mora biti `PBZVI[SZ]A_*`, ili se file
preimenuje.

⚠ Oblik rate se razlikuje i to je **već zapisano** u `rate_alat.py`: MC `X RATA n/N`,
Visa `RATA n/N-X`. Ostale razlike su formatske: dvoznamenkasta godina (`05.06.26.`),
referencija je 10 znamenki (ne `B0802…`), opis nosi **adresu** (`SPAR - MARTIĆEVA 13 - ZAGREB`).

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
