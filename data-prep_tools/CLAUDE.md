# data-prep_tools — pravila za Python alate i domenu Financija

> **Učitava se sam** kad Claude radi s fileovima u `data-prep_tools/`. Preseljeno iz korijenskog
> `CLAUDE.md`-a u S151 **doslovno** (nijedan redak nije mijenjan), da korijen ne nosi ~500 redaka
> alatnih pravila u svaku sesiju. Pravila koja vrijede i za app i za alate ostala su gore.
> ⚠ Radiš li na izvodima/sparivanju **u aplikaciji** (npr. ploha „Raščišćavanje izvoda"),
> pročitaj ovaj file ručno — tada se ne učita sam.

---

## Rječnik `Izvod opis`, duplikati po broju transakcije (iz „Critical rules")

**Rječnik `Izvod opis` → `Tip`/`Podtip` (`presedani.py`, S126)**

- **⚠ SKRAĆEN ISPIS JE HIPOTEZA, NE PODATAK.** Osamnaest sesija je vrijedilo da ZABA
  izvadak nema sidro za sparivanje jer „svaki nalog počinje istim tekstom". Uvod
  `Kreditni transfer nacionalni u eurima on-line bankarstvom` ima **66 znakova**, a
  dijagnostički ispis je rezao na **60** — primatelj stoji **iza** njega, na svakom
  retku (`… HT d.d. - UPLATNI RAČUN T-MOBILE POSTPAID HR01 29308057000-999-8`).
  Zaključak se držao dok se nije ispisao **cijeli** redak. Vrijedi šire od ovog
  alata: prije nego proglasiš da podatka nema, ispiši ga bez rezanja.
- **Tri ključa, od najoštrijeg prema najslabijem:** ime primatelja **+ poziv na
  broj** → samo ime → **iznos s predznakom**. Izmjereno na `ZABA_2026-08.pdf`
  (31 nepoznat redak, povijest 443): iznos daje 6 jednoglasnih, primatelj **19** —
  i to baš one koje nismo znali (T-mobile 207,26 13/13, Nataša Holding 57,19 19/19,
  Bulatova plin 13,31 11/11).
- **⚠ Poziv na broj je RAZLIKOVNI dio, ne ukras.** Tri kolovoška retka nose istog
  primatelja `ZAGREBAČKI HOLDING` a različite pozive: `12045603` je Sašin stan,
  `03879097` Natašin. Ključ bez poziva slio bi ih i svakom ponudio komentar onog
  češćeg — dakle **uvjerljivo krivo ime stana**.
- **⚠ Ključ po iznosu mora nositi PREDZNAK.** Bez njega je uplata od `7,43` presedan
  za isplatu od `7,43` — izmjereno 19.08.2026., redak je dobio `Bankovni troškovi`
  s uplatne strane. Iznos je već slab ključ; iznos bez smjera nije ključ nego
  podudarnost.
- **⚠ `N/A` u povijesti NIJE konkurentska klasifikacija nego izostanak odluke**, pa
  ne smije glasati protiv. Izmjereno na `HLK`: 7 redaka `Zdravlje / Liječnička
  komora` i 1 `N/A` daju 7/8 = 0,875 i padaju ispod praga — dakle **jedan
  neklasificiran redak poništi sedam odluka**.
- **⚠ Dio povijesnih komentara je SIROVI TEKST IZVODA, ne oznaka**
  (`Bmove d.o.o. CASH HR00 00056571 Parking - ZAGREB - e286w-…`). Svaki je
  jedinstven, pa brojanjem obara jednoglasnost prave oznake: parking je `Parking`
  11× uz dva takva ostatka, i komentar zbog njih **nije bio predložen** — a
  alternativa mu je bila 60 znakova strojnog teksta. Broje se samo kratke oznake.
- **Par se smije predložiti i kad komentar nije jednoglasan — komentar se tada NE
  PIŠE nego prijavi kao izbor.** `PP Saša` i `PP Koka` dijele `Tip/Podtip` 12/12, a
  21.08. stoje **dva** retka po 22,90 (vjerojatno jedan svakome). Isto `ZAGREBAČKI
  HOLDING` s tri stana.
- **⚠ Broj rate se ne izmišlja.** Presedan `Anja 84/96` je prošlomjesečni; broj se
  **reže** iz presedana i vraća samo ako ga tekst izvoda stvarno nosi.
  ⚠ Regex mora imati granice oko znamenki — bez njih `režije voda za 07/2026` daje
  „ratu 07/202", što izgleda kao podatak.
- **⚠ Sidro pravila na POČETAK retka kad je riječ dvoznačna** (proširenje S124
  pravila „pretraga po ključnoj riječi prekomjerno hvata"). `Naknada za ` je uz
  bankinu naknadu pokupilo i `… (m-zaba) Naknada za uređenje voda - SPLIT … NUV -
  1. rata za 2026.` — vodnogospodarsko davanje, ne bankovni trošak. **Bankine
  vlastite naknade svoj redak POČINJU tim tekstom; tuđe ga nose iza prefiksa
  naloga.** Razlika je u položaju, pa je i pravilo takvo.
- **⚠ `Izvod opis` se skraćuje za uvod, `(m-zaba)` ostaje** (S126) — a tvrdnja da je
  to **sigurno za sparivanje** bila je **NETOČNA i stajala je ovdje devet sesija**
  (ispravljeno S129). `_PREFIX` je tražio **cijeli** uvod, pa bez njega ne uhvati
  ništa i `(m-zaba)` postane **dio imena primatelja**:

      dugi    Kreditni transfer … (m-zaba) POSMRTNA …  →  ('posmrtna pripomoc', '1147')
      kratki  (m-zaba) POSMRTNA …                      →  ('m zaba posmrtna',   '1147')

  Izmjereno na PROD-u: **14** povijesnih PP redaka nije bilo presedan za 2 kolovoška,
  pa je alat javio **„nema presedana"** ondje gdje povijest ima odgovor — razred S114
  („brojač koji nula pokušaja prikazuje kao nula rezultata").
  ⚠ Gore od toga: oblik `(mobilne aplikacije)` stari regex nije hvatao **ni s uvodom**,
  pa je **22 nepovezana primatelja** dobilo isti ključ `kreditni transfer nac`. Prag
  jednoglasnosti je sprječavao krive prijedloge, ali su pravi presedani bili
  **nedohvatljivi**. Popravak: uvod je neobavezan, zagrada s kanalom se skida i sama.
  Izmjereno: **59 redaka** dobiva pravog primatelja.
  ⚠ **Pouka šira od regexa:** tvrdnja „X i Y se poklapaju" nije dokazana time što je
  napisana. Ovdje je devet sesija stajala kao pravilo, a razlika se vidi u **dva retka
  ispisa**.
- **⚠ Ključ za oznaku je PRIMATELJ + POZIV NA BROJ, nikad `Tip`/`Podtip`** (S129).
  Izmjereno: po `Tip`/`Podtip` vodeća oznaka parking skupine ima **36 %** — jer isti
  Podtip nosi i `Prevoz` (45×); po primatelju **96 %**. Označavanje po `Tip`/`Podtip`
  nazvalo bi 45 redaka krivo. Isti razlog vrijedi obrnuto: `ZAGREBAČKI HOLDING` ima
  **tri** poziva na broj (tri stana), pa bi ključ bez poziva svakom ponudio ime onog
  češćeg — dakle uvjerljivo krivo ime stana.
  Alat: `oznaci_iz_presedana.py` (prag ≥ 90 % i ≥ 3 presedana; 45 od 71 retka).
- **Žigosanje postojećih redaka (`--zigosi`) ide SAMO na točan par** (datum + iznos
  + smjer). Tolerancija na datum bi ovdje bila opasna nevidljivo: `Cash 100,00` se
  ponavlja svakih par tjedana (S114), pa bi prvi bankomat pokupio potvrdu nekog
  kasnijeg — iznos se i dalje slaže. **Popunjena ćelija se ne dira**: postojeća
  potvrda je dokaz nekog drugog izvoda.

**⚠ SLIČAN `Izvod opis` NIJE DUPLIKAT — provjerava se BROJEM TRANSAKCIJE** (S137)

- `LUFTHAN2202242474447 RATA 3/3` i `…448 RATA 3/3`, isti dan, **isti iznos 62,00**,
  izgledaju kao dvostruki upis. Nisu: to su **dvije karte**, svaka sa svojim planom
  otplate — par se ponavlja kroz tri mjeseca (`1/3` 28.06., `2/3` 29.07., `3/3` 29.08.),
  i izvod ih nosi pod **različitim brojevima** (`B08026241143682**1**` / `…682**3**`),
  svaki sa **svojom** naknadom od `1,32`.
- **Dokaz nije sličnost opisa nego kontrola košare:** `uskladi_izvod.py` javlja
  `48 redaka / 1.068,70 == izvod, u cent`. Brisanje jednog dalo bi 47 redaka i manjak
  od točno `62,00` — dakle kvar koji se vidi tek sljedeći mjesec.
  ⚠ Pravilo: **prije brisanja „duplikata" traži redak IZVODA, ne redak baze.**

---

## Zamke — Python alati i AI (iz „Zamke")

**Python alati (`data-prep_tools/`)**

- **/!\ BASH HEREDOC JEDE BACKSLASH, i `py_compile` to ne uhvati ako ga nema komu** (S140).
  Python kod pisan kroz `python - <<'EOF'` izgubi `\n` unutar stringa -- postane **stvaran**
  prijelom retka, pa `sys.stderr.write('\n...')` padne na `SyntaxError: unterminated string
  literal`. Ugrizlo **dvaput u istoj sesiji**, iako je zapisano u handoffu -- zato je sada
  ovdje. Isto vrijedi za `\\` u regexu i za Windows putanje.
  /!\ **Prepoznaje se po tome sto assert padne na stringu koji ocito postoji u fileu** -- jer
  ne trazis ono sto mislis. Drugi oblik: CRLF. File s `\r\n` ne poklapa se s obrascem koji
  ima `\n`, pa `old in s` vrati `False` nad tekstom koji vidis vlastitim ocima.
  => Za izmjene fileova koristi **line-based** zamjenu (`readlines()` + indeks) i patch pisi u
  **zaseban .py file**, ne kroz heredoc. Prijelom iz `chr(10)`, backslash iz `chr(92)`.
- **/!\ I BACKTICK U DVOSTRUKIM NAVODNICIMA JE COMMAND SUBSTITUTION** (S141, isti razred).
  `python -c "..."` s `audit_tests.py` unutra **upisao je prazninu** umjesto imena
  alata, i skripta je javila `OK`. Dakle nije pad nego **tiha rupa u tekstu koji se upravo
  pise kao trajni zapis**. Bash je pokusao pokrenuti `audit_tests.py` i javio `command not
  found` u *stderr*, ali izlaz skripte je i dalje bio `OK` — dakle uspjeh i greska stoje
  jedno uz drugo, i lako je procitati samo prvo.
  ⇒ Markdown s backtickovima **nikad** ne pisi kroz bash string. Patch u zaseban `.py`,
  backtick iz `chr(96)`.
  /!\ **Ugrizlo DVAPUT u pet minuta, i drugi put MINUTU NAKON ŠTO JE PRAVILO ZAPISANO**
  — prvi put je odnijelo ime alata iz memorije, drugi put imena specova iz `PENDING_TESTS.md`.
  Oba puta je skripta javila `OK`, a bash je `command not found` stavio u **stderr iznad
  toga**. ⇒ Pouka nije „pazi“ nego **ne piši markdown kroz bash string, nikad**: pisanje
  pravila o zamci ne štiti od zamke.
  /!\ I obrnuto: `.py` patch pisan kroz Write **ne smije nositi `\uXXXX` u tekstu koji ide u
  **markdown** — ondje to nije escape nego doslovnih šest znakova. Ugrizlo isti dan, u
  handoffu.
- **`run.bat` guši zarez u argumentima** — jedan substring po pozivu (`--reparse A,B,C` → samo A)
- **openpyxl `cell(r,c,None)` NE briše** — mora `.value = None`
- **⚠ openpyxl string koji počinje s `=` sprema kao FORMULU** (S124). Excel je ne može
  parsirati i file se **ne otvori** — nudi „repair" i tiho izbaci taj sadržaj
  (`Removed Records: Formula from /xl/worksheets/sheet1.xml`). Ulovljeno na pripovjednoj
  ćeliji `Pregled!A31`: objašnjenje se prelomilo tako da je redak počeo s
  `= 63,33), ali razdvojeno…`. Vrijedi i za `+`, `-`, `@` — dakle i `-100` kao vrijednost,
  i crtica na početku retka. **Kvar se ne vidi pri pisanju nego tek kad korisnik otvori
  file**, a tada je već kod njega. Svaka ćelija sa slobodnim tekstom mora ići kroz helper
  koji forsira `data_type = 's'` (`uskladi_izvod.tekst()`); prelamanje rečenice popravi
  jedan slučaj i pusti sljedeći.
- **Ime skripte ne smije biti ime stdlib modula** — `inspect.py` je srušio openpyxl
  (`partially initialized module`, jer `numpy` radi `import inspect`)
- **`apply_rules.py` preskače redak s VALJANIM parom** ⇒ pravilo ne može popraviti
  krivo-ali-valjano klasificiran redak. Zato postoje one-off skripte
  (`fix_vocarna_pravilo.py`, `fix_anja_rate.py`, `fix_keks_trener.py`).
- **⚠ Dedup po `(datum, iznos)` ne hvata skoro-duplikate** (S111). Kad dva izvora opisuju
  **isti** događaj različitim iznosom (Koka `1.265,59`, banka `1.285,59` — zamijenjena
  znamenka), ključ se razlikuje i **oba retka uđu**. Nađeno 9 takvih na jednom računu, razlike
  od `0,02` do `25,70` €. Otkriva se samo sparivanjem s **tolerancijom na iznos**, ne točnim
  poklapanjem. ⚠ Vrijedi i obrnuto: `ZABA 25.08.2025. „Anja 73/96"` ima uplatu 450,00 **i**
  isplatu 0,70 u istom eventu, i to **nije** greška nego vjeran spoj dvaju stvarnih redaka
  izvoda. Prije brisanja uvijek provjeri postoji li protustavka na izvodu.
- **⚠ Prozor sparivanja s Kokinim opisima mora ovisiti o IZVORU** (S114). Kartični retci traže
  nesimetričnih `−3 / +45` dana (upisuje ih na dan kupnje ili na dan naplate računa). Na
  **tekućem računu** ista tolerancija nije velikodušna nego opasna: `Cash 100,00` se ponavlja
  svakih par tjedana, pa bi prvi bankomat pokupio opis nekog kasnijeg — tiho, jer se iznos i
  dalje slaže. Ondje je njen datum bankin datum ⇒ `0 / +1`. ⚠ `+1` nije kozmetika:
  `Zoran povrat 9,51` je na izvodu 17.07., kod nje 18.07.
- **⚠ Isti događaj, različit BROJ redaka — ključ `(iznos, datum)` to ne vidi** (S114). Ona vodi
  jedan redak `Parking 1,40`, banka ga naplaćuje kao **dva** naloga po `0,70`. Nespareni retci
  onda nose strojni tekst izvoda (`Kreditni transfer nacionalni…`), koji u povijesti vodi na
  `Domaćinstvo / Bankovni troškovi` (12×) — dakle u **krivi razred, i to uvjerljivo**. Isti
  razred kao S111 skoro-duplikati, samo se ondje razlikovao iznos, a ovdje broj redaka.
- **⚠ Brojač koji nula pokušaja prikazuje kao nula rezultata** (S114). `zaba_rows()` je primao
  `koka` i nikad ga nije pozvao, a ispis je govorio `Kokini opisi: 0 spareno, 0 bez para` —
  što se čita kao „pokušano, ništa nije našlo". Svaki takav brojač mora razlikovati
  „nije pokušano" od „pokušano bez pogotka".
- **Klasificiraj iz IZBROJANE povijesti, ne iz teksta izvoda** (S114). `Tip`/`Podtip` se izvlače
  prebrojavanjem kako je **isti Kokin tekst** klasificiran u 4.992 retka Reviewa (Parking 118/118,
  T-com 40/41, Zoran povrat 41/41, MC naplata 31/31). Gdje povijest nije jednoglasna, odlučuje
  čovjek — ne skripta. ⚠ **Par se prije upisa mora provjeriti protiv `DropdownData` lista
  app-ovog exporta**: podtip mimo `validation_rules` uveze se kao običan tekst i **ne javi
  grešku** — vidi se tek kad ga dropdown poslije odbije, a tada je već u bazi.
  Alat: `klasificiraj_transu.py`.
- **Autoritet za iznos je izvod, za opis i klasifikaciju Kokin redak.** Njen lanac i bankov se
  razlikuju redak po redak a **slažu u zbroju** (oba daju `461,82` na 06.07.2026.) — višak na
  jednoj strani ima kompenzaciju na drugoj. Baza koja spoji oba izvora dobije **najgoru** od
  tri varijante: dvostruko brojanje ondje gdje se opisi razlikuju.
- **Ako izvor s odgovorom već postoji, ne izmišljaj heuristiku** (S113). Umjesto strojnog
  kraćenja opisa izvoda (`SUPER KONZUM P-3200 - RADNIČKA CESTA 1 - ZAGREB`) uzima se **Kokin
  tekst** (`Konzum`) sparivanjem po `(iznos, datum)`. ⚠ Prozor sparivanja mora biti
  **nesimetričan** (−3 / +45 dana): kartičnu kupovinu ona upisuje ili na dan kupnje ili na dan
  naplate kartičnog računa — oboje postoji u istom fileu. Sa simetričnih ±3 dana: 0 od 47.
- **Kokina Excelica ima DVIJE kolone datuma** (S113). `Datum` (C) je dan kad novac napusti
  račun; dok naplata nije poznata, C je **prazan**, a dan troška stoji u koloni **G**.
  Alat koji čita samo C ne vidi upravo najsvježije retke — one koje sljedeći kartični izvod
  tek donosi. (To je u našem modelu `Status = Planiran` + prazan `Datum naplate`.)
- **⚠ Kokin lanac salda gleda SAMO kolonu C, nikad `C or G`** (S116). Kolona G je dan
  troška i za još nenaplaćene kartične stavke **jedini** datum koji redak ima — ali te
  stavke račun još nisu teretile. Uzeti ih znači brojati buduće naplate kao dogođene:
  izmjereno `12.983,69` umjesto `13.239,31`, promašaj za točno njihov zbroj. Pravilo
  vrijedi samo za **lanac salda**; za `event_date` je obrnuto (D1b: dan kupovine ⇒ G).
- **⚠ Njen model tereti račun svakom kartičnom stavkom, naš jednom skupnom naplatom**
  (S116). Zbroj se poklapa u cent (45 MC stavki 11.08. = `1.332,52` = iznos s
  `MC_2026-07.pdf`), model ne. Uvezu li se njene kartične stavke s `Izvor = Racun`,
  saldo se **dvostruko** umanji — jednom po stavci, jednom skupnom naplatom. `Izvor`
  zato određuje **kolona A** njenog sheeta, a skupna naplata dolazi s izvoda.
  ⚠ Zato je i njen lanac koristan kao **svjedok**: dva modela koja broje različito, a
  daju isti broj, potvrđuju jedan drugoga. Isti broj iz istog modela ne potvrđuje ništa.
- **⚠ Njeni datumi znaju biti tipfeler u GODINI, i ne samo 2036.** (S116). Osim dva
  poznata retka iz `2036-04-08` postoji i `2028-05-16` (`HLK 5/26`). Alat ih **izdvaja
  i ispisuje**, nikad ne popravlja — ispravak ide u **njen** file (v. S115: popravak +
  uvoz udvostručuje redak tiho, jer pada prije sidra).
- **⚠ 103 njena retka nose datum kao TEKST, ne kao datum** (S116): `'11.05.23.'`,
  `'28.6.23.'`, `'29.2.2024.'` — neujednačeno, s točkom na kraju i dvoznamenkastom
  godinom. Svi su iz **2023.**, dakle batch 2023 ih mora parsirati ručno; alat koji
  prima samo `datetime` progutao bi ih **bez ijedne poruke**.
- **⚠ Usporedba imena računa mora ići preko normalizacije dijakritika** (S116). Njena
  kolona A piše `Kokin tekući` s kvačicama, a argument s komandne linije ih kroz
  `run.bat` zna izgubiti; obična `==` usporedba tada nađe **nula** redaka i alat javi
  „0 novih" — što se čita kao „nema što uvesti", a ne kao „nije ni uspoređeno"
  (isti razred kao S114 brojač). ⚠ Normalizacija je **samo za usporedbu**: vrijednost
  atributa `Racun` koja ide u bazu nosi dijakritike i mora se poklopiti u znak, inače
  redak završi pod novim, četvrtim računom — a pločica to prikaže kao uredan račun.
- **⚠ UVOZ NE POPRAVLJA KRIVO DATIRANE RETKE — dedup ih preskoči** (S123). Alat
  izbacuje iz generiranog filea sve što u bazi već postoji po `(datum, iznos)`, a
  kupovina s krivim `Datum naplate` ima **isti** `event_date` i iznos. Zato
  „uvezi tranšu pa popravi datume" ne radi: krivi datum preživi, a **i ciljna
  košara ispadne kraća točno za te retke** — dobiješ dvije neusklađene umjesto
  jedne. **Prvo ispravak, pa uvoz.**
- **⚠ RATA NIJE KUPOVINA i pravilo naplate se na nju ne smije primijeniti** (S123).
  Sve rate jedne kupovine dijele `event_date` = dan kupnje, a razlikuje ih plan
  otplate. Pravilo „MC = 11. sljedećeg mjeseca" proglasilo bi **21 vjerojatno
  ispravan redak** krivim i poslalo čovjeka da ih „popravi". `kosara_naplate.py`
  ih zato izdvaja u vlastitu dijagnozu umjesto da ih ocijeni.
- **⚠ ALAT KOJI KONFIGURACIJU DRŽI UKUCANU VRAĆA JE UNATRAG PRI SVAKOM UVOZU** (S145).
  `make_financije_all_structure.py` je `Automations` sheet pisao iz `AUTOMATION_ROWS`
  u vlastitom kodu, a **uvoz tog sheeta ZAMJENJUJE** automatike svake Aree koja se u
  njemu pojavi. Izmjereno 22.09.2026. na svježem exportu s PROD-a: baza nosi
  `Visa=cutoff:3:5` i `rata.date_map.Visa = 5` (oboje promijenjeno u **S138**), a alat
  je proizveo `Visa=next:3` i `rata Visa=3` — dakle uvoz bi **poništio oba popravka**.
  ⚠ **Kvar bi se vidio tek za mjesec dana**, kao krivi `Datum naplate` na novim Visa
  kupovinama. Modal uvoza broji **retke**, ne značenja: `Automations 2` izgleda jednako
  za pravilo koje se nije promijenilo i za ono koje je upravo vraćeno godinu unatrag.
  ⚠ **Ovo je TREĆE mjesto s istim pravilom**, i najtiše: S138 je zatvorio zamku *„dva
  rječnika, a samo jedan razumije tokene“* (`attribute_rules` vs `rata`) — oba su bar
  u bazi. Ovaj treći živi u `.py` fileu, pa ga Structure export ne pokazuje.
  Zatvoreno: `read_base_automations()` čita pravila **iz `--base` exporta**; ukucani
  popis je još samo fallback za Areu koja **ne postoji**, i alat tada to kaže naglas.
  Kad se BASE i ukucano raziđu, ispiše **oba** retka — jer *„izgleda isto“* je bio
  jedini razlog zbog kojeg je mina ležala neprimijećena.
  ⚠ Pravilo šire od ovog alata: **generirani file mora opisivati STANJE, ne sjećanje
  autora alata.** Za svaku vrijednost koju alat upisuje pitaj *„tko je vlasnik ovog
  podatka“* — ako je to baza, alat ga **prenosi**, nikad ne proizvodi.
  ⚠ **ISTI ALAT ISTO RADI S TAKSONOMIJOM — i ondje JOŠ NIJE POPRAVLJENO** (S148).
  `Tip`/`Podtip` se ne prenose iz `--base` nego **regeneriraju iz sheeta `Taksonomija`**
  Review filea od 10.07. (`groups.pop("Podtip")` → `read_taxonomy`). Podtip dodan u bazu
  poslije toga (`Zabava / Wellness`, S124) izbrisan je prvim Structure uvozom iz alata —
  10 redaka ostalo bez valjane opcije u dropdownu, bez ijedne poruke. Otkrila ga je provjera
  parova `Podtip ∈ options_map[Tip]` nad cijelom Areom (S148: 20 loših parova).
  ⇒ **Alat ne pokretati dok taksonomija ne dolazi iz BASE-a** (unija s Reviewom, ispis
  razlike — kao `read_base_automations`). `Wellness` vraćen rukom kroz panel.
  ⚠ Suprotno vrijedi za kolone kojih u generiranom fileu **nema**
  (`DisableSavePlus`, `AddTimer`, `AddDatePicker`): ondje uvoz odsutnost čita kao
  *„ne diraj“*, pa je izostanak **ispravan** — v. pravilo iz S139.

- **⚠ ALAT KOJI NABRAJA PUTANJE RUČNO UMRE PRI PRVOJ SELIDBI FILEA** (S130).
  `primijeni_uskladu.py` je nosio hardkodiran popis izvoda koji je završavao na
  `MC_2026-07.pdf` **u korijenu** `izvodi/`; kad je taj u S129 prešao u
  `Analizirani_izvodi/`, skripta je padala na `FileNotFoundError` **prije ijedne
  provjere** — dakle bila je mrtva, a to ništa nije javilo dok je nitko nije pokrenuo.
  Popis se sada **nalazi sam** (glob preko obje lokacije, dedup po imenu).
  ⚠ Time se vidjelo i da je stari ručni popis pokrivao samo `2026-01..07` — dakle
  **2024. i 2025. nikad nisu bili u zadanom prolazu**, a to se iz koda čitalo kao
  „obrađeno je sve". Zadano sada nađe **32** izvoda i **67** ispravaka umjesto 46.
  ⚠ Vrijedi za svaki alat u `data-prep_tools/`: **mapa je izvor popisa, ne konstanta.**
- **`source_key` nije stabilan** (`normalize_financije.py:202`, `seq_per_day` = redoslijed u fileu)
  ⇒ ubačeni redak mijenja ključeve svih redaka tog dana iza njega
- **⚠ BRISANJE PO KOMBINACIJI TRAŽI DA SVAKA KOMPONENTA IMA SVOJ REDAK** (S130).
  Provjera prije 1:N brisanja glasila je `all(any(…))`, pa je **isti** redak baze mogao
  zadovoljiti **dvije** komponente: kombinacija `1,60 + 1,60` prošla bi i da u bazi
  postoji **jedan** redak od `1,60` ⇒ agregat obrisan, a `1,60` ostaje nepokriveno.
  Izmjereno da danas takvih slučajeva **nema** (oba brisanja imaju različite retke), pa
  popravak **ne mijenja ishod** — zatvara rupu prije nego se otvori, jer je brisanje
  nepovratno. Isti oblik provjere vrijedi svugdje gdje se skup uspoređuje sa zbrojem.
- **Brisanje retka lomi idempotenciju `merge_pbzvisa.py`** (preskače `source_key`eve koji POSTOJE
  u Reviewu) → registar `V3 preskočeno` mora se čitati
- **openpyxl bilješka ruši uvoz u app** (S113). Kad openpyxl prepiše app-ov export,
  komentar ćelije završi kao `xl/comments/comment1.xml` s **apsolutnom** putanjom u
  relacijama; exceljs očekuje relativnu, ne nađe dio i padne s
  `Cannot read properties of undefined (reading 'comments')` — dakle **cijeli file je
  neuvoziv zbog jedne bilješke**. `fill_from_izvod.py` ih zato izbacuje iz radne kopije i
  **ispiše tekst**: original izvoza ih čuva, a podrijetlo otvarajućeg stanja ne smije nestati bez traga.
- **openpyxl čuva layout, ali gubi grafove/slike/pivote**
- **Udio po komadima ≠ udio po iznosu** — kod transfera je razlika 42 % vs 91 % i vodi u
  suprotan zaključak. Neto zbroj isključenih redaka može podcijeniti problem — **mjeri bruto.**
- **`.pre-*` backupi i generirani izlazi idu u `data-prep_data/Financije/_arhiva/`** —
  gore ostaju samo živi fajlovi i zadnja 3 backupa

**AI (`ai_classify.py`, Anthropic API)**

- **`effort: low` vratio 1 rezultat na 40 redaka** uz uredan `stop_reason: end_turn` ⇒
  guard koji uspoređuje poslano/vraćeno je obavezan
- **structured-output `enum` NIJE obvezujuć** (vraćao `Hrana I ostalo`) ⇒ normalizacija
- **Potpunost pada s efortom** — pri `--effort high` smanjiti `BATCH` (40 → 25)
- **Pali batch ne smije srušiti run** — `is_fatal()` (kredit/400/401/403 bez retryja),
  djelomičan rezultat se zadrži i dopuni s `--resume`
- **heredoc patch tiho promaši a `py_compile` prođe** ⇒ provjeri grepom, ne pretpostavkom

---

## Financije — pravila domene (nastavak; „Ključne odluke" su u korijenu)

### Spašeno iz plana (S137) — četiri pravila bez kopije igdje drugdje

⚠ Pri izmicanju plana u `FINANCIJE_STATUS.md` ova su četiri odlomka bila **unutar**
plana, a grep je pokazao da ih **nema nigdje drugdje** — dakle bulk move bi ih tiho
odnio. Zato se razdvajanje radilo s dokazom (39 `⚠` redaka prije, 0 izgubljenih),
ne procjenom.

  ⚠ Provjera mora biti **mehanička** (sparivanje s tolerancijom + potvrda razlike): njeni se
  iznosi razlikuju od bankinih na ~4 % redaka, a kartične stavke ne diraju saldo, pa takva
  greška **nikad ne ispliva sama**.
- **Granica je datum, ne vrsta retka.** Prije datuma piše pipeline, poslije samo ona.
⚠ **Skupna naplata se NE sintetizira, a njen datum je DOSPIJEĆE s izvoda** (S117).
`MC_2026-07.pdf` piše `Datum dospijeća: 11.08.2026.` i `UKUPNO (EUR): 1.332,52`. Isto potvrđuje
povijest: skupna MC naplata pojavljuje se na **ZABA izvatku** kao `TROŠKOVI UČINJENI MASTERCARD
KARTICOM`, uvijek **11. u mjesecu**, osam mjeseci zaredom (`Izvodi_transakcije.xlsx`). Dakle nije
na MC izvodu nego na izvatku tekućeg — a dok `ZABA_2026-08.pdf` ne stigne, iznos i datum dolaze
s MC izvoda. ⚠ **Opis mora ostati strojni tekst izvatka**, ne „Mastercard": svih 18 prijašnjih
MC naplata ga nosi, pa bi varijanta razbila brojanje po opisu (`klasificiraj_transu.py`).
s MC izvoda. ⚠ **Opis mora ostati strojni tekst izvatka**, ne „Mastercard": svih 18 prijašnjih
MC naplata ga nosi, pa bi varijanta razbila brojanje po opisu (`klasificiraj_transu.py`).
⚠ **Izvodi su samo PDF** — ni ZABA ni PBZ ne nude CSV/Excel (potvrdio Saša, S115). Ideja
„app čita izvod" zato znači **pisanje novog čitača PDF-a**, i **imenovana je i odložena**:
PDF-ove i dalje čita Sašin Python alat. Vrijednost te ideje nosi njezin drugi dio —
**pravila u bazi + evaluacija na uvozu** (Faza 3), koji PDF uopće ne dira.

### `Izvod opis` JE oznaka „potvrđeno izvodom" (S124)

Izmjereno: za MC retke je `Izvod opis` **doslovno prepisan** tekst izvoda
(`PAYPAL *TEMU`, `KONZUM P-3200 RATA 4/12`). Popunjenost: **Visa 96 %, Racun 92 %,
Mastercard 91 %**; po mjesecima kupovine MC 04/2026 36:3, 05 31:2, 06 47:5, **07 0 od 22**
— nula jer taj izvod nije bio obrađen. Dakle oznaka je pouzdana i **nitko je nije čitao**.

**Tri stanja, ne dva:** prazan = Kokina nepotvrđena tvrdnja (iznos/datum/oblik privremeni) ·
popunjen = banka potvrdila · **prazan a razdoblje pokriveno izvodom = pitanje** (ili duplikat,
ili banka za taj trošak ne zna).

⚠ **`Izvod opis` NIJE jedinstven kroz vrijeme** — `ZAGREBPARKING.HR APP 3 · 26,60` postoji u
više mjeseci. Sidro kaže *koji trgovac*, ne *koje pojavljivanje*; sparivanje bez prozora
spoji lipanjski redak izvoda s retkom iz **rujna 2025.**
⚠ **Potvrđen redak pripada točno jednom izvodu** — bez tog uvjeta sljedeći izvod „ispravlja"
ono što je prethodni potvrdio. Ali uvjet **sakrije** potvrđen redak s krivim dospijećem
(izmjereno: `Kokin Temu` 20,72 nosi `Izvod opis`, a `Datum naplate` = dan kupnje), pa uz njega
mora ići uski drugi prolaz: **isti opis + isti iznos + ≤ 2 dana**.
⚠ **Rata se veže BROJEM RATE, ne datumom.** Koka je datira na dospijeće (11.07.), banka na dan
terećenja (29.07.) — 18 dana. S tolerancijom od 5 dana svih 11 rata ispadne kao „za uvoz",
i uvoz ih **udvostruči**.
⚠ **Zbroj sam po sebi nije dokaz.** Subset-sum bez ograničenja „nađe" da je `LH 2/3` 63,33 =
PEVEX + TEMU + KONZUM preko 27 dana. Razdvojeni bankini redci su **istog dana**.

### ⚠ 1:N ide u OBA smjera, i obrnuti je opasniji (S124)

Detektor je tražio „**jedan** redak baze = **N** redaka izvoda" (`LH 1/3`). Postoji i
obrnuto: **N redaka baze = jedan redak izvoda.** Izmjereno: Kokin `34,08` + `0,90` = bankin
`KEKS PAY 34,98` (12.05.2026.). Sparivanje redak-po-redak to **ne može naći** — oba njena
retka izgledaju kao „banka ih nema", i tako su dva mjeseca stajala kao pitanja za nju.

⚠ **Zbroj cijele košare je jači signal od sparivanja po retku** — ne ovisi o tome pogađaju
li se parovi ispravno. Sašin potez koji je to razriješio: zbroji **sve** njene MC retke s
`Datum = 11.06.` i usporedi s izvodom. Dalo je `1.768,00 = 1.768,00` uz **31 njena retka
naspram 30 bankinih**, i razlika je bila točno taj jedan spoj. **To bi trebalo biti prvo
što alat ispiše**, prije bilo kakvog sparivanja.

### Rječnik `Izvod opis → Tip/Podtip` — brojanjem, ne rukom (S124)

Ključ je **normaliziran na trgovca**; vrijednost se bira **prebrojavanjem potvrđene
povijesti**. Izmjereno nad 26 redaka tranše: **20 iz povijesti, 6 ručnih odluka** — a svaka
od tih 6 postaje presedan. Baza ima **694 ključa**, od toga 679 jednoglasnih.

- **⚠ Režu se samo sufiksi KOJI SADRŽE ZNAMENKE.** Sufiks je broj transakcije
  (`SPOTIFY P44015227F` / `SPOTIFY P450E8139E` = isti Spotify), ali bez tog uvjeta
  `PAYPAL *DISNEYPLUS` postane `paypal` i **svi PayPal trgovci se sliju u jedan ključ**.
  Bez normalizacije 14/26 ima presedan, s njom 17/26.
- **⚠ `[kartica: SAŠA]` je anotacija pipelinea, ne ime trgovca.** Baza drži
  `GOOGLE*YOUTUBE [kartica: SAŠA]`, izvod samo `GOOGLE*YOUTUBE` — bez rezanja **15
  presedana na istih 9,55 ispadne kao „nema presedana"**. ⚠ Ali nositelj kartice **ostaje
  upotrebljiv kao zasebna dimenzija**: `AUDIBLE` je 10:9 `Koka`:`Sasa`, a kartica to riješi.
- **⚠ Dvojben trgovac ⇒ druga razina po IZNOSU**, uz jednoglasnost i **≥ 3 presedana**
  (jedan presedan po iznosu je slučajnost). `APPLE.COM/BILL` je po trgovcu 26/29 — ispod
  praga; ali `2,99` je **17/17** `Cloud backup`.
- **⚠ Posrednik nije trgovac.** `KEKS PAY` ima **8 različitih Tipova** (Parking, Sport,
  Hardver, Pokloni, Domaćinstvo…) jer je aplikacija za plaćanje — `Izvod opis` ne govori
  što je kupljeno. Isto `PAYPAL *`, `KUPOVINA…`. Ondje rječnik **ne smije ni pokušati**.
- **Ključ koji nije jednoglasan (< 90 %) se NE POGAĐA — alat STANE.** Prvi run tranše je
  stao na 3 retka, i sva tri su bila *pravilo koje fali*, ne *podatak koji fali*.
- **⚠ Kokin opis je jači od statistike.** `APPLE.COM/BILL 9,99` je 5:3 i ostaje dvojben;
  njen redak kaže „HBOMax" i time je riješen. Isti princip kao „ako izvor s odgovorom
  već postoji, ne izmišljaj heuristiku".
- **⚠ Pretraga po ključnoj riječi prekomjerno hvata.** `spa` je uhvatio
  `KUPOVINAFS *DesignSpa fsprg.` (FastSpring — **softverska pretplata**) i
  `JU AQUATIKA CAFFE BAR` (kafić); `parking` je uhvatio `Prihodi / Povrat Anja` jer se
  riječ pojavljuje u strojnom tekstu naloga. Pravilo mora gađati **trgovca**, ne riječ.
- **⚠ Ista trgovina, drugi trošak.** `TERME JEZERCICA-VODENI` je `Zabava / Wellness`, a
  `TERME JEZERCICA-POOL BAR` je `Domaćinstvo / Kave/jelo vani`. Ključ po trgovcu bi ih
  slio.

**Gdje taksonomija živi:** isključivo `attribute_definitions.validation_rules` za `Podtip`,
u `depends_on.options_map.<Tip>`. **U kodu aplikacije nema nijedne hardkodirane vrijednosti**
(provjereno grepom po `src/` i `netlify/`) — dropdown, `DropdownData` list i Structure export
sve čitaju odatle. `sync_taxonomy.py` služi starom Review workbooku i ne dira se.
⚠ **Dodavanje vrijednosti je sigurno, preimenovanje nije** — ime poslije živi i u
`validation_rules` i u `value_text` svakog eventa.

### ⚠ Visa NEMA fiksan dan naplate (S124)

CLAUDE.md-ovo pravilo `Visa = next:3` (`set_attribute`) **se ne slaže s podacima**.
Izmjerena raspodjela `Datum naplate` na 855 Visa redaka: **5. (383×)**, 4. (231×), 6. (109×),
7. (82×), 11. (49×), 3. (11×). Traži zaseban prolaz s PBZVISA izvodima; ne popravljati napamet.

⚠ **ISPRAVAK S141: „ne padaju ni u jednu košaru“ je bilo NETOČNO, i stajalo je ovdje 17
sesija.** Razbacanost je artefakt gledanja **po danu umjesto po ciklusu**: grupirano po
mjesecu naplate, **35 od 37 ciklusa ima točno jedan dan** (1.639 redaka, PROD). Dakle Visa
se grupira uredno — krivo je bilo **ravnalo**, ne podaci. Značenje stupca odlučeno je u S141,
v. Backlog „PBZVISA prolaz“.

### Pravilo 1:N — banka ima N redaka za Kokin jedan (S124)

> **Bankini redci su KOSTUR** (iznos, datum, klasifikacija, potvrda), **Kokin DOPUNJAVA**
> (opis, `Rate?`/`Broj rata`/`Rata br`) i zatim nestaje. **Nikad ne ostaju oba.**

To je postojeće pravilo („iznos ← izvod, opis ← Koka") prošireno s *vrijednosti* na *broj
redaka*. Konkretno: `LH 1/3` 63,33 kod nje = `LUFTHAN…447 RATA 1/3` 62,01 + `NAKNADA ZA
OBROČNU OTPLATU` 1,32 kod banke. Spojeno, **naknada banke se vodi kao putovanje** — svaki
mjesec, tiho.
⚠ **Smjer je kontraintuitivan i mjerenje ga je okrenulo:** Kokin redak je **prazniji**
(`Tip = N/A`, bez `Podtip`, bez `Izvod opis`, datum 2 dana kriv), bankin nosi
`Putovanja / Karte, osiguranje` + potvrdu + točan datum. Zadržati njen znači zadržati lošiji.
⚠ **Ciljni oblik već postoji u podacima:** ostalih 8 rata od 28.06. su **jedan** redak s
njenim opisom + bankinim iznosom + klasifikacijom + `Izvod opis` + ratom. Pipeline taj spoj
radi za 1:1 i pada samo na 1:N.
⚠ **Brisanje i uvoz idu jednim potezom ili nikako.** `LH 2/3` se ne briše dok bankini redci
ne uđu tranšom — inače ostane rupa od 126,66.
⚠ **Dopuna ne prepisuje opis.** Bankin `LUFTHAN…447 RATA 1/3` zamijenjen Kokinim `LH 1/3`
dao bi **dva identična retka** istog dana i iznosa — dakle nešto što u listi izgleda kao
duplikat, točno ono što se čisti.

⚠ **`Status` se ne mijenja po pravilu nego kao POSLJEDICA POTVRDE.** Odbačeni automat je bio
„dospjelo ⇒ izvršeno"; ovdje dokaz nije dospijeće nego izvod. Zato `Planiran → Izvrsen` samo
na retku kojem se **istovremeno** upisuje `Izvod opis` s tog izvoda. Redak koji se ne može
ožigosati ne dira se.

⚠ **Višak jednog izvoda je često posao SLJEDEĆEG.** MC_2026-06 prijavi 23 retka kao „banka ih
nema", a MC_2026-07 preuzme 21 kao ispravak i 2 kao duplikat. Filtrira se tek kad su **svi**
izvodi obrađeni — inače Koka dobije 30 pitanja umjesto 7, i to baš ona na koja već imamo
odgovor.

⚠ **`event_date` se ne poravnava s izvodom.** Uvoz ga zna promijeniti
(`excelImport.ts:1326`), ali time pomiče i `session_start`, a `useActivities` grupira po
njemu ⇒ dva retka iste minute postaju **jedan redak liste**. Na MC retcima pomak ionako ne
dira saldo. **Ratama se ne dira ni kasnije:** rate dijele dan **kupnje**, izvod nosi dan
**terećenja** — ondje izvod nije autoritet za `event_date`, samo za `Datum naplate`.

---

## Key files — alati u `data-prep_tools/Financije/`

```
data-prep_tools/Financije/uskladi_izvod.py
                                   Jedan izvod ↔ baza ↔ Kokin file. Četiri sekcije po
                                   tome TKO ODLUČUJE + `--file` review workbook za Koku.
                                   Zamjenjuje `kosara_naplate.py` za `Datum naplate`.
data-prep_tools/Financije/primijeni_uskladu.py
                                   Upisuje nalaz na PROD (ispravci + dopune + brisanja),
                                   jednim potezom, s backupom i brojanjem redaka.
data-prep_tools/Financije/_db.py   `load_env` + pagirani `rest`. Izdvojeno iz
                                   `uskladi_izvod` (koji uvozi pdfplumber) da alat
                                   koji prica SAMO s bazom ne vuce PDF citac.
                                   /!\ PRESELJENO, ne kopirano — `uskladi_izvod`
                                   re-exporta, pravilo o paginaciji ostaje jedno.
data-prep_tools/Financije/ocisti_auto_komentare.py
                                   Brise `comment` koji je napisao `comment_template`.
                                   Kriterij je REKONSTRUKCIJA po retku, ne uzorak —
                                   rucni opis se ne moze pogoditi. Staje dok je
                                   template ziv (na OBJE razine). Backup + `--restore`.
data-prep_tools/Financije/presedani.py
                                   `Tip`/`Podtip` brojanjem povijesti RACUNA.
                                   Tri kljuca: primatelj+poziv > primatelj > iznos
                                   (s predznakom). Ne pogadja — sto nije
                                   jednoglasno ostaje `N/A`.
data-prep_tools/Financije/rate_alat.py
                                   Rate: prolaz A (higijena oznaka) + prolaz B
                                   (generiranje preostalih). Autoritet je
                                   `Izvod opis`, NIKAD komentar. Ne pise u bazu
                                   nego proizvodi xlsx za uvoz.
                                   /!\ `Izvod opis` ima DVA oblika: `X RATA n/N`
                                   (MC) i `RATA n/N-X` (Visa) -- zato prolaz A
                                   hvata 85 redaka, ne 43.
data-prep_tools/Financije/pregled_stanja.py
                                   Jedan file koji odgovara "je li stanje tocno":
                                   Pregled (svi izvodi + sidra) · Sporno (redak po
                                   redak, banka vs baza, autofilter) · 2023.
                                   ⚠ Kokina Excelica se NE oznacava — v. zaglavlje.
data-prep_tools/Financije/promet_check.py
                                   Promet po izvodu, app vs banka. Ne prolazi kroz
                                   sidro ⇒ jedini instrument za ZASIDREN mjesec,
                                   gdje `--report` po konstrukciji daje nulu.
data-prep_tools/Financije/oznaci_iz_presedana.py
                                   Sirovi tekst izvoda u `Opis`u -> oznaka iz
                                   BROJANE povijesti. Kljuc = primatelj + poziv
                                   na broj (nikad Tip/Podtip). Prag >=90% i >=3.
                                   ⚠ 45/71 redaka, `--apply` NIJE pusten (S129).
data-prep_tools/Financije/fix_podizanje_150.py
                                   Jednokratno: duplikat podizanja 150,00 s
                                   krivim mjesecom. Primijenjeno S129.
data-prep_tools/Financije/visa_kosare.py
                                   Visa kosara po mjesecu naplate vs PBZ naplata na RF-u
                                   (bruto isplata) + redak po redak protiv izvoda.
                                   Kriterij "svi mjeseci 0,00". Samo cita.
data-prep_tools/Financije/visa_uvoz_izvoda.py
                                   PBZ Visa izvod -> app Excel: novi retci (Tip/Podtip
                                   iz brojane povijesti) + ispravci postojecih (naplata,
                                   Izvrsen, Izvod opis). Rata se spari PO PLANU I BROJU,
                                   nikad po datumu. Kontrola Σ = izvod u cent.
data-prep_tools/Financije/visa_popravak.py
                                   S148 jednokratni popisi (BRISI/ISPRAVI/ODLUKA/KOPIJE)
                                   + zajednicki pisac `pisi()` (e-mail AUTORA u kol. G,
                                   dropdowni Tip/Podtip).
data-prep_tools/Financije/uvezi_transu.py
                                   Uvozi retke s izvoda kojih baza nema. Rječnik
                                   `Izvod opis → Tip/Podtip` iz brojane povijesti;
                                   STANE na retku bez jednoglasnog presedana.
```
