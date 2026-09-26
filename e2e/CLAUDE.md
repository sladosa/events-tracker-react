# e2e — zamke Playwright testova

> **Učitava se sam** kad Claude radi s fileovima u `e2e/`. Preseljeno iz korijenskog `CLAUDE.md`-a
> u S151 **doslovno**. Workflow (kako se pokreće, „pao E2-X") ostao je u korijenu, § Session workflow.

**E2E (Playwright)**

- **⚠ PONOVLJEN RUN JE PADAO NA 409 JER JE `supabaseUpsert` TIHO ISPUSTAO
  `onConflict`** (S146). Helper ga prima i **koristi samo na admin putu**; REST
  fallback ga nije prosljedjivao, a `Prefer: resolution=merge-duplicates` bez
  `?on_conflict=` rjesava sudar **samo po primarnom kljucu**. Za `data_shares` je
  prekrsen **slozeni** unique (`data_shares_unique_share`) ⇒ **svaki ponovljen run**
  `e8`/`e9`/`e10`/`e15`/`S123` padne u `beforeAll`, i to **izgleda kao kvar featurea**.
  ⚠ Admin put trazi `SUPABASE_SERVICE_ROLE_KEY`, **kojeg u `.env.testing` nema** — dakle
  „ispravna" grana se nikad nije izvrsila. Komentar iznad fallbacka je to i pisao
  (*„only works for PRIMARY KEY conflicts"*), pa je zamka bila **zapisana a neprocitana**.
  ⚠ Specovi su `onConflict` **uredno slali** svih pet — argument je stizao i **nestajao**.
  ⇒ Popravljen fallback (`e2e/fixtures/auth.ts`), bez secreta i bez diranja appa.
  ⚠ `global-setup` **ne cisti** `data_shares` (u `seed.sql:119` je DELETE **zakomentiran**),
  pa se stanje prenosi izmedju runova — v. „ponovljen pojedinacni run" (S139).
- **⚠ E15-3 je ocekivao tekst INFO MODALA na BANERU** (S146) — treci slucaj istog razreda
  (E7-3, E10-2, S140): **tvrdnja napisana iz dizajna, ne izmjerena.** `WriteGranteeBanner`
  nosi samo *„Write access"* + `Info` + *„Take your data"* (`SharedAreaBanner.tsx:356`);
  *„Your events are stored in …"* zivi u `WriteGranteeInfoModal` (`:335`), **iza klika**.
  ⚠ Prva tvrdnja je **prolazila** — pa je izgledalo kao da baner ne radi, a nedostajao je
  klik. `c25136e` (S76). Popravak **samo u specu**, po pravilu iz § Session workflow.

- **⚠ `getaddrinfo ENOTFOUND` / `ECONNRESET` u E2E izlazu znači da run NIJE IZMJERIO NIŠTA**
  (S147). Dva uzastopna runa su pala **isključivo** na mreži prema TEST bazi, a tvrdnje u
  njima izgledaju kao padovi featurea (`toHaveCount` 0, `localStorage` SecurityError).
  Prije čitanja pada: `grep -c "ENOTFOUND|ECONNRESET"` i `curl` prema bazi; na mirnoj mreži
  isti specovi su dali **11/11**. ⚠ I: `dev:prod` pokrenut **između** dva runa sjeda na
  oslobođeni 5173, pa drugi run **stane** na `assertServedBuildIsTest` — ispravno, ali traži
  da se redoslijed dogovori s korisnikom.
- **⚠ E2E PREUZME DEV SERVER KOJI VEĆ STOJI NA 5173 — I TO MOŽE BITI PROD** (S133).
  `playwright.config.ts` ima `reuseExistingServer: true` i `baseURL: localhost:5173`.
  Vrti li se ondje `npm run dev:prod`, Playwright **ne podiže svoj TEST server nego
  preuzme PROD**, ubrizga TEST sesijski token i krene. Izmjereno 10.09.2026.: server
  na :5173 servirao je `zdojdazosfoajwnuafgx` (PROD), a `.env.testing` pokazuje na
  `xtnbhmojmffjelsqejpw` (TEST).
  ⚠ Tog puta je stalo na login ekranu — ali **spec koji se uspije prijaviti radio bi
  stvarne izmjene na PROD-u**, a u izlazu Playwrighta **nigdje ne piše na koju bazu
  gađa**. Jedini znak je banner u samoj aplikaciji, koji nitko ne čita u CI izlazu.
  ⚠ Gore: `global-setup.ts` ima **vlastitog** klijenta iz `.env.testing`, pa čisti
  TEST i kad preglednik gleda PROD — dvije polovice runa gledaju **različite baze**.
  ✅ **ZATVORENO S134** (`assertServedBuildIsTest`): `global-setup` dohvati modul koji
  nosi Supabase klijent (`/src/lib/supabaseClient.ts`) i pročita **koji projekt Vite
  ondje inlinea** — dakle mjeri što će preglednik **stvarno** dobiti, ne što config
  tvrdi. Server koji **ne odgovara nije greška** (Playwright tada diže svoj); staje
  samo na odgovor s krivim projektom.
  ⚠ Provjereno nad živim serverom: 10.09. je na :5173 stajao `vite --mode prod` i
  guard je bacio. **Disciplina više nije jedina brana, ali `dev:prod` i dalje ugasi**
  — inače E2E jednostavno neće krenuti.
- **⚠ PONOVLJEN POJEDINACNI RUN MJERI BAZU KOJU JE PRETHODNI RUN PROMIJENIO** (S139).
  `global-setup.ts` vraca seed stanje **na pocetku runa**, nikad izmedju specova — pa
  ciljano ponavljanje jednog speca radi dijagnoze krece od stanja koje je ostavio
  prethodni. Izmjereno istog dana: u punom runu (71 test) `e5-structure` pada **1 od 5**
  (E5-3); nakon tri uzastopna `e7-share` runa — a on poziva i opoziva pristup — isti
  `e5-structure` pao je **5 od 5**.
  ⚠ Smjer je suprotan od poznatog artefakta: dosad je vrijedilo „spec sam prolazi, u
  paketu pada". Ovdje spec **u paketu prolazi, a sam pada** — dakle „pustit cu ga samog
  da vidim je li stvaran" je potez koji moze **proizvesti** pad koji dijagnosticira.
  ⇒ Usporedba dvije verzije koda radi se **punim runom nad svakom**, ili barem runom koji
  krece cist. Za usporedbu s prijasnjim commitom posluzi `git worktree` (kod se mijenja
  bez diranja radnog direktorija) — ⚠ put worktreeja mora biti **ASCII**: u putu s
  `Saša` Vite ne razrijesi `/src/main.tsx` i **svaki** test padne iz krivog razloga.
- **⚠ ZAHTJEVI KOJI NIKAD NE DOBIJU ODGOVOR — `T-S135-11` VISE NIJE HIPOTEZA** (S140).
  Dotad je „suite rusi sam sebe" bilo objasnjeno **pretpostavkom** gusenja TEST baze.
  Izmjereno iz Playwright tracea (`trace.zip` → `0-trace.network`), jedan run `e7-share`:
  **347 zahtjeva, 24 sa `status: -1` i `time: -1`** — dakle bez ijednog odgovora. Dvadeset
  ih je izdano **8+ sekundi prije kraja testa**, pa nisu artefakt zatvaranja stranice.
  Nisu vezani uz jedan endpoint: `events`, `categories`, `areas`, `activity_presets`,
  `share_invites`, `data_shares`, `profiles`.
  ⚠ **Kako se to vidi u aplikaciji:** `E7-2` je pao jer `createShare` **nije se vratio** —
  GET `profiles?email=eq.userb@test.com` ostao je u letu, pa je `setIsInviting(false)` nikad
  izvrsen i gumb je u snapshotu `"…" [disabled]`. **Snapshot pokazuje zamrznut gumb, ne
  gresku** — a zamrznut gumb se cita kao „app ne radi", dok je zapravo mreza sutjela.
  ⚠ **Uzrok i dalje NIJE utvrdjen** i ne smije se proglasiti: kandidati su gusenje free-tier
  baze, connection pool, i **HTTP/1.1 head-of-line blocking** (trace kaze `httpVersion:
  HTTP/1.1`, preglednik drzi 6 veza po hostu, a `useStructureData` od S133 salje **39
  usporednih** `HEAD` upita). Treci kandidat je nov i dotad neimenovan.
  ⚠ **Posljedica za svaku dijagnozu E2E pada:** prije nego se pad pripise specu ili appu,
  **prebroji nedovrsene zahtjeve u traceu**. Isti spec je u S139 (puni run) prosao, a u S140
  pao u dva uzastopna pojedinacna runa — bez ijedne izmjene koda. To nije proturjecje nego
  mjera da ishod ovisi o **vremenu**, ne o specu.

- **⚠ `fullyParallel: false` NE čini run sekvencijalnim** (S120). Drži redoslijed samo
  *unutar* jednog spec filea; **fileovi i dalje idu u zasebne workere**, a Playwright uzima
  otprilike pola jezgri. Šest specova nad **istom seed Areom i istom bazom** dalo je
  **9 od 10 padova** — `selectOption` timeouti, `Cardio` skriven, `canceling statement due to
  statement timeout` — a svaki od njih prolazi kad se pusti sam. Popravljeno s `workers: 1`.
  ⚠ Taj `statement timeout` je isti onaj koji je izgledao kao da ga proizvodi atributni
  filtar — v. „Atributni filtar nije spor" niže. Dva dana bi se moglo potrošiti na krivi trag.
- **⚠ Spec koji obriše svoj leaf ostavlja P2 PARENTE** (S120). Siročići se nakupljaju kroz
  runove, uđu u sljedeći **export** i sudare se s uvozom — a to se **ne pokaže kao ostatak**
  nego kao pokvaren feature: `T-S107-2` je upisao komentar koji je već bio ondje (nema
  promjene ⇒ nema guarda), `T-S107w-1` je udario u koliziju (Apply se ne pojavi ⇒ izvještaj
  se ne preuzme). Oboje je lovljeno kao bug prije nego je uzrok izmjeren.
  Lijek: `e2e/setup/global-setup.ts` vraća seed Areu na seed stanje prije **svakog** runa.
- **⚠ „Test je flaky" je opis, ne dijagnoza — `e16` je padao na sasvim drugom mjestu**
  (S122, zatvara T-S121-6). Dva runa: 1 prolaz (34 s), 1 pad (**čist timeout od 120 s**).
  Trace pokazuje da je visio na kliku **„View details"**, a klik na **⋮ je uredno prošao
  1,9 s prije toga**; screenshot pada ima filtar **netaknut**. Dakle ono što test čuva
  (S120 popravak „filtar preživi View Details") **nikad nije puklo** — a cijelu je sesiju
  stajalo zapisano da nije čuvano.
  Uzrok: promjena aree/atributa pokrene **šest** upita liste u ~500 ms (`events?select=…`
  na 16664, 16735, 16832, 16909, 17022, 17098 ms), ⋮ klik je pao na **16712** — usred
  toga; redak se remounta i odnese tek otvoren izbornik. Lijek u specu (`expect(...)
  .toPass()` oko otvaranja izbornika), jer **app se ponaša ispravno**. Poslije: 4/4,
  24–29 s. ⚠ Pouka koja vrijedi za svaki idući flaky test: **prvo pročitaj trace i vidi
  na kojem je pozivu stao** — „flaky" je bio razlog da se dva puta ne pogleda.
- **Fiksan literal u testu se sudari s vlastitim ostatkom.** `T-S107-2` je upisivao stalni
  komentar; kad ga je raniji run već ostavio u bazi, upis nije bio promjena. Svaki marker
  koji test upisuje mora biti **jedinstven po runu** (`${Date.now()}`).
- **Test koji nikad ne pada ne čuva ništa** (S120). Prva verzija `T-S100-1` prošla je i s
  **namjerno pokvarenim** razrješavanjem aree, jer uz ključ bez imena aree jedan blizanac
  ionako pobijedi rječnik — i slučajno je to bio očekivani. Svaki nov test se provjerava
  **i u drugom smjeru**: pokvari kod, test mora pasti, pa vrati kod.

- **Testovi koji dijele komentar + `session_start`:** ostatak prekinutog pokušaja ne daje grešku
  nego **koliziju** → Apply postane „All skipped" i izgleda kao pad featurea. Cleanup po prefiksu.
- **TEST baza ima više simuliranih usera** koji dijele imena/slugove (`Financije`, `Health`) —
  `financije-all` je jedini slug jedinstven pravom TEST accountu
- **`e2e/setup/seed.sql` je idempotentan** — ponovno pokretanje vraća seed evente koji su odlutali
- **Kvačica u Area panelu je lokalno stanje forme.** Stvarno stanje se provjerava kroz
  Add Activity ili novi export, ne kroz panel.

