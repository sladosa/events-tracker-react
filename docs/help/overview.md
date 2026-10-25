# Overview — Help

Tab koji pokazuje **stanje jedne Aree sada**: stanja po računu, koliko je planirano, i slaže
li se to s bankom — i, ako ga Area ima, **kamo ide novac** u odabranom razdoblju.

## Zašto ga neke Aree nemaju

Overview se pojavljuje **samo za Aree koje imaju konfiguraciju pločica**. Razlog: da bi se
saldo izračunao, netko mora reći koji je atribut "novac unutra", koji "novac van", po čemu se
grupira i koje vrijednosti znače "već se dogodilo". Model to sam ne zna — `Uplata` mu je
običan broj, isti kao `Težina`.

Zato Area bez te konfiguracije **nema tab**, umjesto da ima prazan. Konfiguracija se za sad
upisuje ručno u bazu (`areas.settings.dashboard`); nema još sučelja za nju.

Redoslijed tabova je `Overview → Activities → Structure`.

## Pločica „Stanje po računu"

Za svaki račun prikazuje:

- **veliki broj** — izvršeni saldo (novac koji se stvarno pomaknuo)
- **podnaslov** — otkad se broji: „od potvrde 15.08.2026." ili „od početka podataka"
- **„planirano"** — obveze koje još nisu naplaćene, odvojeno u dva smjera (odlazi / dolazi)
- **„u banci"** — polje u koje upišeš broj koji vidiš u bankovnoj aplikaciji
- **čip** — `✓ slaže se` ili `Δ 49,00`

Klik na **iznos** otvara Activities filtriran na taj račun. Klik na **„planirano"** otvara
planirane zapise.

⚠ Pločica se osvježava pri **ulasku u tab** i na **↻** gumb. Ako ostaneš na Overviewu dok se
podatak mijenja drugdje, klikni ↻.

## Što točno miče saldo (i zašto nije zbroj po računu)

U saldo ulaze samo zapisi kod kojih se novac **već pomaknuo s računa** — za Financije to znači
`Izvor = Racun`. Kartična kupovina (`Visa`, `Mastercard`) **ne** ulazi, jer račun tereti tek
skupna naplata kartice, koja je zaseban zapis.

**Ni gotovinski trošak (`Izvor = Cash`) ne ulazi u saldo**, i to iz istog razloga: novac je
račun napustio već kad si ga podigao s bankomata, a to podizanje je vlastiti zapis
(`Transfer | cash - bankomat`). Da se brojilo oboje, isti bi novac otišao dvaput. Gotovinski
trošak zato **ostaje potpuno vidljiv u razrezu po `Tip`u** — samo ne pomiče bankovni broj.

⚠ Posljedica koju je dobro znati: aplikacija **ne prati koliko gotovine imaš u novčaniku**.
Vidi se koliko je podignuto i na što je potrošeno, ali ne i koliko je ostalo.

Da se zbrajalo naivno "sve po računu", ista bi se potrošnja brojila **dvaput**: jednom kao
kupovina, drugi put kao naplata kartice. Razlika nije mala — na stvarnim podacima naivni zbroj
promaši bankovni iznos za desetke tisuća eura.

**Transfer između vlastitih računa se broji** u saldo (novac je stvarno otišao), ali **ne
ulazi** u razrez troška po Tipu (prebacivanje sebi nije potrošnja). Isti zapis, dva pravila —
namjerno.

## Sidro — „Potvrdi"

Saldo se **ne** računa od početka povijesti nego od zadnjeg **potvrđenog stanja**:

```
saldo = potvrđeno stanje + sve promjene STROGO nakon dana potvrde
```

Kako se potvrđuje: otvoriš bankovnu aplikaciju, prepišeš broj u polje **„u banci"**, klikneš
**„Potvrdi"**. Od tog trenutka app zbraja samo ono što se dogodilo **poslije** tog dana.

### ⚠ Datum potvrde je najvažnije polje na cijeloj pločici

Saldo je **potvrđeni broj plus sve što je datirano poslije njega**. Sve prije toga app smatra
**već uključenim** u taj broj. Zato datum ne smije biti „kad sam kliknuo" nego **kad je broj
stvarno očitan**:

| Odakle je broj | Koji datum nosi |
| --- | --- |
| **ekran bankovne aplikacije** | **jučer** — app ga izračuna sam (v. niže, „Zašto jučer") |
| **izvod** | **dan zadnje transakcije na izvodu** — upisuješ ga ti |
| **bankomat / ispis na papiru** | datum koji piše na ispisu — upisuješ ga ti |

### Zašto se očitanje s ekrana sprema na *jučer*

Potvrda zna samo za **cijele dane**, a broj s ekrana vrijedi za **trenutak**. Ako ga spremiš
kao „stanje na kraju današnjeg dana", sve što se danas dogodi **poslije** nego si pogledao
ispada iz salda — i ostaje vani.

Zato app radi ovako: uzme broj koji si pročitao i **oduzme današnji promet** koji već zna, pa
to spremi kao stanje na kraju jučerašnjeg dana:

```
13.815,33 (očitano)  +  40,00 (današnji trošak)  =  13.855,33  na 22.08.
```

Rezultat je isti broj koji si pročitao — samo se sada **današnje transakcije broje**, uključujući
one koje tek dolaze. Vidjet ćeš tu računicu ispisanu prije nego klikneš.

⚠ **Račun je točan samo ako app zna za sve današnje transakcije.** Ona koja fali ne javlja
grešku — upiše se u potvrdu i tiho nestane. Zato: **prvo upiši što se danas dogodilo, pa onda
pogledaj banku i potvrdi.** Tim redoslijedom je uvijek točno.

Za papirnate izvore app **ne nudi zadani datum**: svaki ponuđeni datum bio bi pogodak, a
pogodak koji izgleda kao podatak je upravo ono što je jednom već prošlo nezapaženo.

**Što se dogodi ako datum promašiš:** ništa. Nema poruke, nema crvenog. Saldo jednostavno
prestane brojati transakcije između pravog i upisanog datuma, a broj i dalje izgleda uvjerljivo.
Stvarni slučaj: broj je prepisan s izvoda zatvorenog **30.07.**, a potvrda je pala na **22.08.**
— tri tjedna transakcija je tiho ispalo iz salda.

⚠ **Izvod se ne zatvara na kraju mjeseca.** Srpanjski ZABA izvod završava 30.07., prosinački zna
završiti 24.12. Uzmi datum **zadnjeg retka na izvodu**, ne kraj mjeseca.

Prije nego klikneš, app ti ispiše rečenicu što će potvrda značiti — *„saldo će se računati kao
13.815,33 € plus sve datirano nakon 30.07.2026."* Pročitaj je; ona je provjera.

### Ostalo o potvrdama

- Zapis datiran **na sam dan potvrde ne ulazi** u saldo — pravilo je „strogo nakon", bez
  iznimke. To sprječava da se isti iznos broji dvaput.
- **Ispravak je nova potvrda**, ne izmjena stare. ⚠ Ali: app uvijek kreće od **najnovije**
  potvrde. Nova potvrda na **stariji** datum zato **ne poništava** onu krivu na novijem — app
  te na to upozori crvenim tekstom, a krivu obrišeš u **„povijest potvrda"** ispod pločice.
- **„povijest potvrda"** pokazuje sve potvrde tog računa; strelica ▸ označava onu **od koje
  saldo trenutno kreće**. Ostale su samo zapis.
- **Dok potvrde nema**, pločica zbraja cijelu povijest i to **izričito piše**
  („od početka podataka"). Nikad tiho.

Potvrdu može upisati vlasnik Aree i osoba s **write** pristupom. Tko ima samo pregled, vidi
brojeve ali nema gumb.

## „Na dan …" — saldo u prošlosti

Ako u filtru postaviš datum **„do"**, pločica pokazuje stanje **na taj dan** i to izričito
piše — žutim tekstom „na dan 31.03.2025." ispod naslova. Bez te oznake bi prošli broj
izgledao kao sadašnji.

Datum **„od"** pločica namjerno **ignorira**: saldo nema početak, on se nakuplja od zadnje
potvrde. („od" i dalje reže popis zapisa ispod, samo ne pločicu.)

Čemu služi: usporediti app sa starim izvodom ili s tuđom tablicom na točno određeni dan. Ako
se brojevi razilaze, kolona **`Stanje`** u popisu zapisa pokazuje **na kojem retku** je razlika
nastala — jedan broj kaže „nešto ne valja", kolona kaže „evo gdje".

⚠ **Filtar ne određuje datum potvrde.** Prije je određivao, i to je bio izvor greške. Sada
datum dolazi iz toga **odakle je broj**; ako gledaš prošli datum, app te samo podsjeti
(*„gledaš 31.03.2025. — ako izvod nosi taj datum, upiši njega"*), ali upisuješ ga ti.

⚠ Broj uz **„planirano"** također poštuje taj datum, ali odgovor je polovičan: app pamti
*trenutni* status zapisa, ne kad se promijenio. „Planirano na 31.03.2025." zato znači
„datirano do tog dana i **danas još** planirano".

## Što znači Δ

`Δ 49,00` znači: **aplikacija pokazuje 49 € više nego banka.** Negativna razlika znači obrnuto.

**Δ nije greška izračuna** — to je signal da nešto fali, nešto je upisano dvaput, ili je iznos
kriv. Očekivano je da se pojavi i kad je model točan, jer povijesni podaci imaju poznatih
nesavršenosti. Kad se pojavi, klik na iznos vodi u listu gdje se traži uzrok.

## Kolona `Stanje` u Activities listi

Kad je lista filtrirana **na jedan račun** i sortirana **najnovije prvo**, uz svaki redak se
pojavi izračunato stanje nakon tog retka. Jedan broj kaže "nešto ne štima"; kolona kaže
"ne štima **od ovog retka**".

Kolona se **ne** prikazuje kad su računi izmiješani ili kad je sort obrnut — u oba slučaja
tekući zbroj ne bi imao smisla.

Crtica `—` uz redak znači jedno od dvoje: redak ne miče saldo (npr. kartično plaćanje), ili je
stariji od potvrđenog stanja pa mu tekući saldo nije definiran.

## Ako pločica javi grešku

Crvena kutija s porukom znači da konfiguracija pokazuje na atribut koji više ne postoji —
najčešće nakon preimenovanja sluga atributa. Poruka **imenuje** taj slug. Preimenovanje kroz
Structure Edit Mode popravlja referencu automatski; ručna izmjena u bazi ne.

## Traka „Čeka potvrdu" (kartične naplate)

Iznad pločice salda pojavi se žuta traka kad neka **kartična košara** dospije, a banka je
još nije potvrđeno naplatila. Košara su sve kupovine jedne kartice s istim datumom naplate
(npr. *Mastercard · naplata 11.10. · 32 stavke*). Kad ništa ne čeka, trake nema.

- **Σ** je ono što bi banka trebala skinuti: isplate minus povrati iz te košare.
  Za **Visu** piše *(samo isplate)*: Visa košara nosi i uplatu kojom je kartica plaćena, pa se
  ona ne oduzima. Visa nema stalan dan naplate — traka nudi dane od **3.** do **11.**
- Traka pita **„Je li banka skinula Σ?"** Pogledaj u bankovnu aplikaciju. Ako je skinula
  **točno toliko**, samo dodirni **dan** kad je skinula (nudi dane od datuma naplate do danas —
  naplata zna pasti na ponedjeljak kad je datum naplate vikend). Ništa ne tipkaš.
  App zatim pokaže što će upisati i traži **„Da, upiši"**.
- Ako je iznos ili dan **drukčiji**: **„Ne — iznos ili dan je drukčiji"** otvori polja.
  U **„banka skinula"** upiši broj **s ekrana bankovne aplikacije** (app ga ne upisuje sam —
  tada bi se uvijek slagalo), i **dan** — isto s ekrana banke, ne pogađaj. Mora biti
  najviše 3 dana od datuma naplate košare.
- **✓ slaže se** = u cent isto. **razlika** = nešto u košari ne štima: redak u krivoj
  košari, upisan dvaput, propuštena kupovina ili tipfeler.

### Što gumb radi

- **Slaže se → „Potvrdi"**: app upiše jedan redak naplate (`Racun`, `Transfer / izmedju
  racuna`, opis *TROŠKOVI UČINJENI MASTERCARD KARTICOM*, bankin iznos i dan) i sve kupovine
  košare prebaci iz `Planiran` u `Izvrsen`. Saldo je točan **isti dan**, ne tek kad stigne
  izvod. Traka za tu košaru nestane.
- **Ne slaže se → „Upiši naplatu kako ju je banka skinula"**: app upiše **samo** redak naplate,
  s **bankinim** brojem. Saldo odmah slijedi banku, a kupovine ostaju `Planiran`. Košara
  ostaje u traci kao **„naplaćeno — neusklađeno · razlika X"** dok razliku ne riješiš
  (Edit krivog retka, ili nov redak za propuštenu kupovinu). Kad se Σ poklopi, traka ponudi
  **„Potvrdi"** — tada se samo prebace statusi, drugi redak naplate se ne stvara.
- Ako je naplata već upisana (rukom ili s izvoda), traka to prepozna i pokaže je — ne nudi
  upis drugog retka.
- **„Je li to ova naplata?"** — ako si naplatu već upisala sama, s drugim opisom ili drugim
  Tipom (npr. opis *MC*), traka je nađe po **iznosu, računu i danu** i pita. **Da, to je ona**
  → pokaže što će ispraviti (opis *TROŠKOVI UČINJENI MASTERCARD KARTICOM*, `Transfer /
  izmedju racuna`) i nakon **„U redu, ispravi"** redak prepoznaje i ubuduće; iznos, račun i
  datum ostaju isti. **Ne, to je nešto drugo** → tek tada nudi upis naplate. Bez tog pitanja
  bi naplata ušla u saldo **dvaput**.
- Prije svakog upisa app ispiše **što će upisati**, i tek na **„Da, upiši"** to napravi.
- Potvrđuje samo **vlasnica Aree**. Tko ima dijeljeni pristup, vidi usporedbu, ali ne gumb.
- Zasad je u traci samo **Mastercard**. Visa dolazi kasnije (plan: studeni 2026.); do tada
  se Visa potvrđuje kroz izvod.
- Kad se košara **ne slaže**: saldo je i dalje točan. Najčešće je kriv jedan redak — kupovina
  s ruba mjeseca u krivoj košari, ista kupovina upisana dvaput, ili tipfeler u iznosu.
  Ispravi ga Editom; ako ga ne nađeš, kartični izvod pokaže točno koji je.
- **„pokaži kupnje"** ispod Σ otvori pločicu **Košare** na toj košari: popis kupnji koje
  čine Σ, pa ih možeš usporediti s popisom u bankovnoj aplikaciji. Dodir na kupnju je otvori.

## Pločica „Košare (otvorene)"

Kartične kupnje koje banka **tek treba skinuti**, složene po **danu naplate** — ista ideja
kao grupe košara u delta Excelu. Za razliku od trake, ovdje su i **buduće** košare
(sljedeća MC naplata, rate idućih mjeseci, Visa).

- Košare su složene **po računu** s kojeg ih banka skida (npr. ZABA za Mastercard), a uz
  račun piše njegovo stanje **danas** (isti broj kao pločica salda).
- Svaka košara u dva retka: gore kartica · dan naplate i **Σ**, ispod broj kupnji i **ostaje**:
  koliko će biti na računu kad prođe i ta košara (stanje danas minus košare redom).
- ⚠ **„Ostaje" ne zna za plaće, mirovine ni druga buduća plaćanja** — oduzima samo košare.
  To je odgovor na pitanje *„koliko mi ostane kad kartice dođu na naplatu"*, ne prognoza.
- **`~`** ispred dana (Visa) znači da je dan naplate **procjena** — Visa nema stalan dan.
- **dospjelo, čeka potvrdu** — dan naplate je prošao, a košara još nije potvrđena (vidi
  traku iznad). **naplata upisana, već u stanju** — skupna naplata je upisana, pa se košara
  više ne oduzima (bila bi oduzeta dvaput).
- Dodir na košaru je rasklopi: kupnje redom po danu kupnje, uz svaku **Tip/Podtip**, ispod
  njega **opis** (sivo) i iznos. Dodir na kupnju otvori redak. U tom prikazu **Prev / Next** idu samo kroz kupnje **te košare**,
  istim redom kao u pločici. Nakon **Back** označena je (obojena) kupnja na kojoj si **stao**,
  i dovedena u vidik. **Edit** iz tog prikaza ne prekida niz: nakon spremanja Prev/Next i dalje
  idu kroz košaru, pa se može ispravljati jedna za drugom.
- **↗** na kraju kupnje otvara **Activities za taj dan** (razdoblje *Custom*, od–do = dan
  kupnje, bez uvjeta). Tu su sve rate istog plana zajedno — dijele dan kupnje, dok je u košari
  od plana samo jedna. Kad se tabom vratiš na **Overview**, vrati se razdoblje koje je bilo
  prije ↗ (npr. *This Year*), pa saldo opet pokazuje današnje stanje. Ako si u Activities sam
  izabrao drugo razdoblje, ono ostaje. Kupnja s koje si krenuo je **označena** i dovedena u
  vidik, kao nakon povratka iz pregleda retka. (F5 između briše to pamćenje.)
  Rasklopljena je zadano **sljedeća** košara.
- Pločica **ne gleda razdoblje iz filtra** — košare su budućnost.
- Prikazuju se samo **otvorene** košare (bar jedna kupnja `Planiran`). Potvrđena košara
  nestane iz pločice.

## Pločica „Kamo ide novac"

Pokazuje **koliko je novca ušlo i odakle, koliko je izašlo i kamo**, za razdoblje koje je
odabrano u **filtru** (npr. *This Month*, *Last Year*, ručni raspon). Pločica ne pamti svoj
period — promijeniš filtar, promijeni se i ona. U zaglavlju piše koje razdoblje gleda.

- **Gornji redak** — *Ušlo · Izašlo · Razlika*. Vidljiv je uvijek.
- **Troškovi | Prihodi** — bira koja se strana prikazuje.
- **po kupnji | po naplati** — dvije različite istine:
  - *po kupnji* = što ste **potrošili** u tom razdoblju (kupnja na 6 rata ulazi cijela u
    mjesec kupnje, i rate koje su još `Planiran`)
  - *po naplati* = koliko je u tom razdoblju **stvarno otišlo s računa** (rate po mjesecima,
    kartice na dan naplate). Za buduće Visa rate dan naplate je procjena (5.).
  - Na **Prihodima** tog izbora nema — prihod sjeda na račun isti dan, pa bi obje istine bile
    iste. Ostaje izabrano ono što je bilo na Troškovima, pa se gornji redak ne mijenja.
- **Bucketi | Namjena | Tip** — tri pogleda na **iste** retke (Ušlo i Izašlo su u sva tri
  isti, mijenja se samo raspored):
  - **Bucketi** (Mjesečni troškovi, Kvaliteta života, Putovanja i pokloni, Povremeno nužno,
    Projekti…) — *kakav je to trošak*. Klik na redak ga rasklopi: bucket → Tip → Podtip.
    Auti su po vrsti troška: gorivo i leasing u Mjesečnima, registracija i popravci u
    Povremeno nužno. Čiji je trošak, kaže pogled Namjena.
  - **Namjena** (Zajedničko, Koka, Saša, Nena / Kućište) — *za koga / čiji*, na troškovima
    **i** na prihodima. Ispod Namjene je Tip → Podtip. Iznad liste stoji **fond Nena /
    Kućište**: koliko je u razdoblju ušlo u Nenin fond, koliko izašlo i koliko ostaje.
  - **Tip** — samo Tip → Podtip, bez ikakvog grupiranja.
- **„gotovina, nerazvrstano"** (u Mjesečnim troškovima; u pogledu Namjena zasebno, jer se ne
  zna čija je) = podignuto s bankomata minus ono što je upisano kao gotovinski trošak. Bez
  tog retka razrez bi prešutio podignutu gotovinu.
- **„nerazvrstano (N/A)"** su retci bez Tipa ili s `N/A`. Ne skrivaju se — inače bi
  potrošnja izgledala manja nego što jest. Smanjuje se kako se retci razvrstavaju. I u
  pogledu Namjena stoje zasebno.
- **„nesvrstano"** (ako se pojavi) je par Tip/Podtip koji još nije stavljen ni u jedan
  bucket, npr. novi Podtip. Raspored bucketa mijenja Saša.
- **Povrat** (uplata pod Tipom troška, npr. *Kuća / Povrat Zoran*) **umanjuje** taj trošak.
  Ako je povrat veći od troška, iznos je zelen s oznakom *povrat > trošak* (npr. Porezi kad
  je povrat poreza veći od plaćenog).
- **Krug** (samo na širem ekranu) crta samo ono što je u plusu; što je u minusu, ispisano je
  ispod kruga. Točne brojke su u listi desno. **Klik na isječak** zumira krug i suzi listu na
  taj dio (staza `Sve › …` iznad liste); klik na sredinu kruga ili na „Sve" vraća cijelu sliku.
  Ako stavka ispod sebe ima minus, tooltip pokazuje i neto (= lista) i nacrtani iznos.
- **Postotak** uz iznos je udio u retku iznad (bucket u Izašlo, Tip u bucketu, Podtip u Tipu).
  Uz stavku u minusu se ne piše.
- **izvan razreza** (dno pločice) — Transfer: prijenosi među računima i podizanja. Novac je
  prošao, ali nije potrošen ni zarađen, pa nije u razrezu. Saldo ga broji, razrez ne.
- **↗** uz Tip ili Podtip otvara te retke u Activities (razdoblje iz filtra ostaje). Radi
  samo u prikazu *po kupnji*. Podtip koji postoji pod više Tipova (npr. *gorivo* kod oba
  auta) **nema** ↗ — filtar nosi jedan uvjet, pa bi pokazao gorivo obaju auta; ↗ uz Tip
  (*auto C5*) otvara cijeli Tip. Bucket nema ↗ jer je više uvjeta.
  U pogledu **Namjena** ↗ postoji samo uz Namjenu (npr. sve Kokine retke); ispod nje ga
  nema, jer bi „auto C5 pod Koka" bila dva uvjeta.
- Otvorena je **uvijek jedna** pločica (saldo, Košare ili razrez): klik na naslov jedne
  otvori nju i sklopi ostale — da filtar s razdobljem ostane blizu. Pri svakom otvaranju
  appa saldo je otvoren, a ostale zatvorene.

## Filtar na mobitelu

Na uskom ekranu Overview od filtra pokazuje samo **red razdoblja**
(`📅 This Year · 01.01.–31.12.2026.`). Area i kategorija se ondje ne nude — pločice ovise
samo o Arei, a ona se na Overviewu ne mijenja. Dodir na red otvori izbor razdoblja; izbor
ga sam sklopi. Na Activities je filtar puni, ali na mobitelu kreće **sklopljen** i u
jednom redu kaže što je aktivno.

## Unos iz Overviewa

Gumb **Add Activity** i **⚡ Use** (Shortcut) rade i iz Overviewa, čim je odabrana leaf
kategorija. Nakon spremanja vraćaš se na Overview i saldo je preračunat.

## Odakle je stanje došlo

Uz polje „u banci" stoji izbornik **odakle**: *ekran bankovne aplikacije*, *ispisano stanje s
izvoda* (uz njega se može upisati i ime izvoda) ili *bankomat / ispis na papiru*.

Taj podatak se sprema uz potvrdu i **obavezan je** — bez njega gumb „Potvrdi" ne radi.

Dva razloga, oba praktična:

1. Potvrđeno stanje smije doći **samo izvana**, nikad iz izračuna aplikacije. Mjesecima kasnije
   se iz same brojke ne vidi je li to poštovano; iz bilješke se vidi.
2. **Izvor određuje datum** (v. gore). Bez njega app ne zna smije li upisati današnji dan ili
   te mora pitati.

Stariji zapisi mogu nositi „nije navedeno" — to su potvrde upisane prije nego je polje postalo
obavezno.

