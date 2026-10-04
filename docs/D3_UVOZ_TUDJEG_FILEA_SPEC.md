# D3 — uvoz tuđeg filea u istoimenu Areu (prijedlog prije koda, S160)

> **Status:** prijedlog. Odluke D3-1 … D3-6 na kraju čekaju Sašu; ništa od §4 nije izgrađeno.
> **Već izgrađeno u S160** (vrijedi bez obzira na odluke): §2.
> Izvor: pokus S159 (`DONE_HISTORY.md` § S159, „D3 pokus"), Sašin prijedlog opcija 03.10.
> (`docs/sessions/BACKLOG.md` § D3).

## 1. Problem, izmjereno

Activities Export nosi uz retke i **Structure sheet** (+ `Automations`, `ListColumns`). Pokus
S159 (TEST, 03.10.): izvoznik `userb`, Area `D3 Pokus` (2 leafa, 7 atributa, `depends_on`,
`set_attribute`, `list_columns`, `add_header`; 10 redaka = 43 vrijednosti). Uvoznik `owner`,
jedan Export → jedan Import.

| scenarij | primatelj | ishod | poruke |
| --- | --- | --- | --- |
| **A** | nema Areu tog imena | **43/43**, struktura i automatika identični (Korak 7 „Create categories & continue" uveze Structure sheet) | ispravne |
| **B** | ima **svoju** Areu istog imena, druge strukture | **29/43** | pregled „10 novih", uvoz „10 created" — **nijedno upozorenje** |

Što se u B izgubilo i zašto:

- `Lokacija` (7) i `Datum kontrole` (7) — primateljeva Area ih nema; apply atribut traži po
  `kategorija||ime` i bez pogotka ga **preskoči** (`excelImport.ts`, nema `else`).
- `Vrsta = Lab` (2) — ušlo kao tekst **izvan** primateljevih opcija (opcija ne postoji u izborniku).
- `set_attribute`, kolone liste, zaglavlje — **nisu** preneseni: Korak 7 se ne javlja jer sve
  putanje kategorija postoje, pa se Structure sheet filea uopće ne čita.

⚠ Isti gubitak atributa pogađa i **vlastiti stari export** (npr. nakon preimenovanja atributa) —
to nije samo problem tuđeg filea.

## 2. Što je S160 već napravio (minimum koji vrijedi uvijek)

| | gdje | ponašanje |
| --- | --- | --- |
| **Imenovani gubitak** | `findDroppedAttributes` (`excelImport.ts`), pregled + izvještaj | *„7 vrijednosti iz filea NEĆE biti upisane: Area nema atribut tog imena — `'Lokacija'` (Area `'D3 Pokus'`): redovi …"*. Uvoz i dalje preskače, ali **ne nijemo**. P1 atribut na roditelju se ne prijavljuje (on stigne) |
| **K-1 (a)** | `structureImport.ts` § 5b | Structure file Aree koja **pripada drugome** (vidiš je kao grantee) ⇒ stop, ništa upisano, poruka o vlasniku. Prije: tihi duplikat Aree |
| **K-1 (b)** | isto | Structure uvoz koji bi obrisao opcije **koje retci nose** ⇒ stop, popis opcija s brojem redaka, potvrda vlastitom kvačicom |

To **ne rješava** scenarij B: nakon S160 korisnik barem zna što neće stići, ali nema ponuđen
način da stigne. To je posao ovog specа.

## 3. Kad se pitanje uopće postavlja (detekcija)

Pitanje „što s razlikom?" ima smisla samo kad su ispunjena sva tri uvjeta:

1. **File nosi Structure sheet** (Activities export ga nosi uvijek; ručno složen file ne mora).
2. Za Areu iz filea **postoji Area istog imena koju uvoznik posjeduje** (`areas.user_id = ja`).
   ⚠ Area koju uvoznik vidi kao **grantee** nije ovaj slučaj — to je D5/`fix_as_owner` put, a
   Structure uvoz za nju staje (K-1 a).
3. Structure sheet filea i baza se **razlikuju po značenju** za tu Areu: atribut kojeg nema,
   opcija kojih nema, drukčija automatika / kolone / zaglavlje. Usporedba ide kroz postojeće
   `sameRules` / `sameJson` (S152/S153), nikad doslovnim JSON-om.

⚠ Kolona G (autor) **nije** uvjet. Isti file, iste razlike — vlastiti stari export i tuđi file
traže istu odluku; razlikuje se samo **zadana** opcija (D3-2).

Bez razlike (3) uvoz ide kao danas, bez ijednog novog pitanja.

## 4. Tri opcije (Sašin prijedlog, 03.10.)

Pregled pokaže **popis razlika** (atributi kojih nema · opcije kojih nema · automatika / kolone /
zaglavlje) i tri izbora:

### (1) Uvezi kao NOVU Areu — prijedlog za zadano kad je file tuđi

- Ime: `D3 Pokus (userb)` (D3-3). Primateljeva Area ostaje **netaknuta**.
- Mehanizam: uvoz radi nad fileom s **preimenovanom Areom u memoriji** — Structure sheet (kol. D,
  `Automations`/`ListColumns` kol. A) i Activities retci (kol. B, `Area`). Nijedan file se ne
  prepisuje. Ishod je scenarij A, koji je izmjereno savršen (43/43).
- ⚠ Ime je **ključ** u svakom generiranom fileu (S117). Ako `D3 Pokus (userb)` već postoji (drugi
  uvoz istog filea) — **ne** dodavati `(2)` nego ponuditi uvoz u tu Areu: to je isti file opet,
  i tada kolizija `session_start` hvata dvostruki uvoz (S113 pravilo).

### (2) Preuzmi NJIHOVU strukturu — opasno, samo uz popis i kvačicu

- Structure sheet filea ide kroz Structure uvoz ⇒ dodaju se atributi kojih nema (neopasno),
  **i** zamjenjuju popisi opcija („file pobjeđuje", T-S152-1) ⇒ opcije kojih u fileu nema
  **nestaju**. K-1 (b) to već hvata: popis s brojem redaka + vlastita kvačica.
- Automatika i kolone se **zamjenjuju** za tu Areu (isto kao Structure uvoz danas).
- Tek nakon strukture idu retci (isti redoslijed kao Korak 7).
- ⚠ Za Areu koju primatelj **dijeli** s nekim, ovo mijenja i njihov rad — spomenuti u popisu.

### (3) Zadrži SVOJU strukturu, uvezi samo retke — današnje ponašanje

- Ali **izabrano**, i s popisom onoga što neće stići (S160 minimum, §2) + vrijednosti izvan
  opcija (D3-5).
- Jedina opcija za vlastiti stari export kad je razlika samo preimenovanje (D3-2).

## 5. Što ne putuje ni u jednoj opciji (poznato, ne rješava se ovdje)

`dashboard` i `export_profiles` (F5 — odlučeno S160: generički sheet `AreaSettings`, retci
`Area | Putanja | Vrijednost`; nije izgrađeno), **sidra** (`balance_anchors` — po pravilu
nikad ne putuju, OVERVIEW §2.17), **prilozi**, shortcuti (per-user, ID-based).

## 6. Faze

| faza | što | rizik |
| --- | --- | --- |
| **D3-F1** | Detekcija §3 + popis razlika u pregledu (samo čita, ništa ne mijenja ponašanje) | nula — isti izvještaj koji (3) ionako treba |
| **D3-F2** | Opcija (1): preimenovanje Aree u memoriji, kroz Structure **i** Activities parser | ime kao ključ (§4.1) — test: uvoz istog filea dvaput ne smije dati dvije Aree ni duplikate redaka |
| **D3-F3** | Opcija (2) preko postojećeg Structure uvoza + K-1 brane | brisanje opcija — brana postoji (S160) |
| **D3-F4** | Zadana opcija po kol. G (D3-2) | — |

Pokus iz S159 (seed + Playwright, `DONE_HISTORY.md`) je gotov **test prihvaćanja**: B mora dati
43/43 uz (1), 43/43 uz (2), i 29/43 **s popisom 14 izgubljenih** uz (3).

## 7. Odluke za Sašu

| # | pitanje | prijedlog |
| --- | --- | --- |
| **D3-1** | Pitati samo kad razlika postoji (§3.3), ili svaki put kad file nosi istoimenu Areu? | **samo uz razliku** — pitanje bez posljedice nauči klikati (S143) |
| **D3-2** | Zadana opcija: tuđi file ⇒ (1); vlastiti file ⇒ (3)? | **da** |
| **D3-3** | Ime nove Aree: `<Area> (<dio e-maila prije @>)` ili da korisnik upiše? | **prijedlog upisan, polje se da promijeniti** |
| **D3-4** | Opcija (2) za Areu koju dijeliš s drugima — dopustiti uz upozorenje, ili ugasiti? | **dopustiti uz upozorenje** (vlasnik smije mijenjati strukturu, S133) |
| **D3-5** | Vrijednosti izvan opcija (`Vrsta = Lab`): samo javiti, ili ponuditi da ih (3) doda kao opcije? | **samo javiti** u prvoj fazi; dodavanje = mijenjanje strukture, a (3) je baš „ne diraj strukturu" |
| **D3-6** | Treba li D3 prije F5 (`AreaSettings`)? | **F5 prvo ako je cilj „Area kao predložak"**; D3-F1 je neovisan i jeftin |
