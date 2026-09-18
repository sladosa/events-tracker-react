# S140 — detaljni koraci

> Sesija je bila **o instrumentima i dokumentima**, ne o featureima: jedina promjena u
> `src/` je `dbScopedKey()`. Zato je većina testova **izmjerena u samoj sesiji** i ovdje
> stoji radi traga; ručne potvrde traže samo **T-S140-7** i **T-S140-8**.

---

## T-S140-1 — E7-3 i E10-2: app je ispravan, tvrdnja u specu nije bila

**Nalaz:** `Confirm revoke` renderira se samo unutar `{revokeTarget && …}`
(`ShareManagementModal:300`), a `revokeTarget` se postavlja **isključivo** kad
`eventIds.length > 0` (`:199`). Grantee **bez eventa** ide ravno na `doSimpleRevoke`.
Seed daje sve evente vlasniku; `userb` je ondje samo profil.

**Izmjereno (S140):** s popravkom prolazi **svih 6** (E7-1..3, E10-1..3).
Protuprovjera po S120 pravilu: sabotiran `doSimpleRevoke` (maknuti `toast` + `refresh`)
ruši **točno ta dva** testa.

⚠ Potvrda iz samog repoa: `e15-revoke-with-events.spec.ts` prije **istog** očekivanja sam
stvori **6 eventa** za userb (`:69-114`). Ista app, isti gumb — razlika je samo ima li
grantee evente.

**Status:** ✅ S140.

---

## T-S140-2 — CLAUDE.md: goli `<datum>` je za Markdown HTML tag

**Nalaz:** redak 972 je izvan backtickova nosio `<datum>`, redak 2181 `<budući datum>`.
Markdown to čita kao **otvarajući HTML element** koji se nikad ne zatvara ⇒ sve iza njega
prestaje se parsirati.

**Izmjereno:** granica se poklapala u redak — 972 je iza `Critical rules` (121) i ispred
`Zamke` (1043), točno raspon koji je Saša prijavio.

**Isključeno mjerenjem:** ograde koda uravnotežene (6, sve iza retka 1626); naslovi na 108,
121 i 1043 **bajt-identični** u obliku.

**Status:** ✅ S140 — Saša potvrdio da `Zamke` sada skaču i renderiraju se ispravno.

---

## T-S140-3 — dvotočka u naslovu lomi Obsidian sidro; `+` je nevin

**Izmjereno klikanjem 11 varijanti** (`Claude-temp_R/_probes/ANCHOR_obsidian_sidra.md`):

| varijanta | rezultat | zaključak |
| --- | --- | --- |
| naslov s `+`, **bez** `:` | **skače** | `+` nije kriv |
| naslov s `:`, bez `+` | ne | `:` jest kriv |
| isti naslov, `+` kodiran u `%2B` | **ne** | kodiranje **kvari** link koji radi |
| wikilink | skače | imun, ali na GitHubu goli tekst |

⚠ Obsidian sam kodira `%` u `%25` (toast javlja `#S112%252B:…`) ⇒ **dvostruko kodiranje**.
Zato lijek nije kodiranje nego naslov **bez** dvotočke.

**Guard:** `claude_index.py` javlja na stderr svaki `## ` naslov s dvotočkom.
**Protuprovjera:** **0** upozorenja nad ispravnim fileom, **točno 1** kad se dvotočka vrati.

**Status:** ✅ S140 — Saša potvrdio da sada skaču svi linkovi.

---

## T-S140-4 — `audit_tests.py` je pripisivao ID-eve koji se samo *spominju*

**Nalaz:** `ID.findall(txt)` kupi i unakrsne reference iz proze. `S134_tests.md` u rečenici
spominje `T-S133-8`, pa je alat presudio *„ne (1 otvorenih)"* iako je **sva 21 njegova testa
✅**.

**Izmjereno na 12 fileova:** 4 nose tuđe ID-eve; `S137_tests.md` ih ima **8 od 17**.
Presuda se mijenja za dva filea: S134 (`ne` → **`DA`**) i S137 (3 → 2 otvorena).

⚠ Vjerojatno objašnjenje zašto je arhiviranje „preskočeno tri sesije zaredom" — alat je
tvrdio da nema što arhivirati.

**Status:** ✅ S140 — `S134_tests.md` arhiviran, link preusmjeren.

---

## T-S140-5 — `PENDING_TESTS.md` prepolovljen (1.198 → 628)

20 zatvorenih sekcija (588 redaka) preseljeno u `DONE_HISTORY.md`, u cijelosti.

⚠ **Kriterij nije bio „sekcija je zelena"** — izmjereno kao nesigurno: `T-S134-16` živi pod
sekcijom **S135**, dakle retci migriraju između sekcija. Selila je samo sekcija koja (a) nema
nijedan ⬜ **i** (b) ne drži **jedini** redak za test čijem session fileu još ima živih
testova.

**Brane u samoj selidbi** (staje ako padne ijedna): nijedan ID se ne smije izgubiti; skup
otvorenih redaka mora ostati identičan; račun redaka mora štimati.

**Status:** ✅ S140 — poslije selidbe audit ima **0** pojava „PENDING nema redak za".

---

## T-S140-6 — Backlog: struktura nosi trijažu

Tri podnaslova: **Otvoreno** (16+2) · **Čeka Sašinu odluku** (1) · **Parkirano i izvedeno**
(14). Unosi **presloženi, nijedan znak nije promijenjen** — brana je prebrojala sve retke
prije i poslije; nestao je samo stari trijažni odlomak, koji je struktura učinila suvišnim.

**Status:** ✅ S140.

---

## T-S140-7 — ⬜ `dbScopedKey`: filtar više ne curi između TEST-a i PROD-a

**Što je bilo:** `FilterContext` je pamtio filtar pod golim ključem
`events-tracker-filter-state`, a u njemu stoje `areaId` i cijeli `selectionChain` (objekti
kategorija, **s imenima**). Ključ nije nosio ref projekta ⇒ `npm run dev` (TEST) i
`dev:prod` (PROD) dijelili su **isti zapis**.

**Simptom koji je Saša prijavio:** `Unknown > Transakcija`, prazna lista, traka *„Nisam uspio
učitati postavke ove Aree"*, a „Pokušaj ponovno" ne pomaže.

**Preduvjeti:** build s commitom `3f649e7` ili novijim.

**Koraci**

1. `npm run dev:prod` → baner mora pisati **PROD**. Odaberi Areu `Financije_all` i neku
   kategoriju. Zapamti što piše u breadcrumbu.
2. Ugasi server. Pokreni `npm run dev` → baner **TEST DATABASE**.
3. Pogledaj breadcrumb i listu.

**Očekivano:** TEST **ne** nasljeđuje PROD-ov odabir. Nema `Unknown`, nema trake o grešci;
filtar je ili prazan ili zadnji **TEST**-ov.

**Pad:** pojavi se `Unknown > …` ili prazna lista uz traku o grešci ⇒ ključ i dalje curi.

4. Vrati se na `dev:prod` — ondje mora stajati **PROD-ov** odabir iz koraka 1, netaknut.

**Očekivano (4):** svaka baza pamti **svoj** filtar, neovisno.

⚠ **Jednokratni reset je očekivan**, ne kvar: `dbScopedKey` pri prvom pozivu briše stari,
neograničen ključ — inače bi zauvijek ležao u pregledniku i čekao sljedeću zabunu.

⚠ **`et_activity_draft` je isti razred i NIJE popravljen** (Backlog). Ako iskoči „Resume
Previous Session?" s tuđom kategorijom, to je **ta** stavka, ne pad ovog testa.

---

## T-S140-8 — ⬜ Puni E2E nakon popravka `e7` / `e10`

**Zašto:** popravak je izmjeren runom od **dva** speca (6/6 prolaz). Puni run nije pušten,
a suite **nije determinističan između runova** — isti spec zna dati različit ishod ovisno o
tome što je išlo prije njega.

**Preduvjeti**

⚠ **Na portu 5173 NE SMIJE stajati `dev:prod`.** U S140 je ondje stajao PROD build, pa run
nije ni pokrenut — guard `assertServedBuildIsTest` ga zaustavlja (S134). Ugasi taj server;
Playwright će dići svoj TEST.

**Koraci**

1. `npx playwright test` (puni run, ~20–23 min).
2. Provjeri da **E7-3** i **E10-2** prolaze.
3. Usporedi ukupnu brojku s baseline-om iz S139: **60 prošlo / 11 palo**.

**Očekivano:** E7-3 i E10-2 zeleni; ukupno **oko 62/9** (dva popravljena).

**Pad:** E7-3 ili E10-2 padne u punom runu ⇒ popravak ovisi o redoslijedu, što bi bio nov
nalaz.

⚠ **E7-2 je poznato nestabilan i NIJE spec kvar** — v. CLAUDE.md § E2E („zahtjevi koji nikad
ne dobiju odgovor"). Ne prijavljuj ga kao pad ovog testa.

---

## T-S140-9 — `S139_tests.md` napisan i alat ga vidi

Ritual korak 2 je u S139 bio preskočen, pa tri otvorena testa nisu imala korake.
**Status:** ✅ S140 — audit ga prijavljuje (`5 def, 4 ✅, 1 ⬜`).
