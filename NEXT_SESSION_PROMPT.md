# NEXT SESSION PROMPT — nakon S109 (dizajn: stanja kao podatak, ne kao parametar)

**Pisan protiv commita `929073a`** (S108, 2026-08-15) **+ commit S109 koji slijedi odmah iza
i sadrži samo dokumentaciju.** Ako `git log --oneline -1` pokazuje nešto novije, čitaj ovo kao
povijest; `CLAUDE.md` je autoritet.

**Stanje grana:** `test-branch` nosi cijeli S108 + ovu dokumentaciju. **S109 nije napisao
nijedan red `src/` koda** — bila je to sesija odluka. `main` = PROD, nije diran.

---

# DIO 1 — Jednostavnim rječnikom (za Sašu)

## Što se dogodilo u S109

Krenuo si testirati S108 i odmah naletio na pravo pitanje: **app pokazuje `150,80 €`, a to
nije stanje na Kokinom računu** — nego pošten zbroj onoga što je uvezeno (2025. + 2026. do
11.07.). Nedostaje cijela ranija povijest i ~5 tjedana Kokine delte.

Ja sam predložio da jednostavno usidriš današnje stanje iz banke i zaboraviš povijest.
**Tebi se to nije svidjelo, i bio si u pravu.** Tvoj prijedlog je bolji: usidri stanje na
**početku** onoga što imaš (31.12.2024.), pusti app da računa naprijed, i vidi slaže li se
s Kokinim brojem na 08.07.2026. (`3.403,74`). Time sidro prestaje biti pokrivač preko rupe
i postaje **provjera**.

Iz toga je ispalo sve ostalo.

## Što si usput dokazao — bez da smo to planirali

**„Potvrdi" radi.** To je bila najveća nepoznanica iz S108 (u bazi je bilo 0 sidara, gumb
nikad nije kliknut do kraja). Upisao si 3000, kliknuo, i pločica je uredno prešla na
„od potvrde 16.08.2026. · 3.000,00 € · 0 promjena poslije". **T-S108-4 korak 3 je prošao.**

## Tri stvari koje si pitao, s odgovorima

**1. Kolona `Stanje` u listi nije pokvarena.** Sve crtice na tvojoj slici imaju dva neovisna
i ispravna razloga: (a) tvoje sidro od 3000 je datirano **danas**, a ispod sidra saldo nije
definiran, pa **cijela lista** dobije `—`; (b) svi vidljivi retci su `Izvor = Mastercard`,
a oni ne miču saldo. Obriši sidro i skrolaj do retka s `Racun`/`Cash` — brojevi se pojave.

**2. „Planirano" nije ono što si mislio.** Nije „kartično što još nije naplaćeno" nego
doslovno **`Status = Planiran`** — ljudska oznaka, ne zaključak iz datuma. Tvojih 13 su
gotovo sigurno rate. Namjerno nije vezano uz karticu: kupovina od prije godinu dana je
odavno plaćena skupnom naplatom i prikazati je kao „planirano" bilo bi grubo krivo.

**3. Parking redak nisi našao u bazi jer ga tamo nema.** Batch 2026 je rezan na 31.07., a
redak je tada bio datiran `2026-08-07` — ispao je iz reza. Sad kad je u Reviewu ispravljen
na `2026-07-07`, treba ga **dodati kroz app** (⚠ ne novim batchom — dobio bi `09:00` na dan
koji je već uvezen i sudario bi se s postojećim zapisom).

## Velika odluka: stanja sele iz tablice u podatke

Pitao si zašto sidro živi u zasebnoj tablici umjesto kao obična kategorija
`Financije_all > Stanja`. **Razlog iz dokumentacije ne pokriva tvoj prijedlog** — bio je
argument protiv `areas.settings` (koji putuje s Areom), a eventi ne putuju.

Dogovoreno, u principu:

- kategorija se zove **`Stanja`** (Kokina riječ, ne moj žargon „sidro")
- atribut `Stanje` **se prestaje pisati na Transakciju** (postojećih 2220 zapisa se **ne dira** —
  Kokin lanac je jedini neovisni svjedok za provjeru)
- kasnije **automat** koji puni `Stanja` iz bankovnih izvoda

**Jedno pravilo se ne smije prekršiti:** stanje smije doći **samo izvana** — ispisani saldo
s izvoda ili broj s ekrana bankovne aplikacije. **Nikad izračunat iz zapisa u bazi.** Čim se
to prekrši, Δ je uvijek nula, sve izgleda savršeno, a usklađenje je mrtvo i **ne javi grešku**.

## Zašto selidba ipak NIJE prvi korak

Jer ti za provjeru ne treba. Mjesečna stanja iz izvoda mogu se skriptom ubaciti ravno u
postojeću tablicu — tridesetak redaka Pythona nad podacima koje već imaš. **Provjeru dobiješ
odmah**, a ona onda odgovara na pitanje o dizajnu: ako 30-ak mjesečnih stanja riješi stvar,
`Stanja` kao kategorija je očito pravo mjesto; ako ih treba stalno ručno korigirati, treba ti
i povijest ispravaka — a to je drukčiji oblik. Sada bih to pogađao.

Cijena tog redoslijeda je jedan `INSERT ... SELECT` kad se stanja presele. To je sve.

## Redoslijed za sljedeću sesiju

1. **Pločica prima datumski filtar** — da se rezultat provjere uopće vidi na Overviewu.
2. **Skripta: mjesečna stanja iz izvoda → baza.**
3. **Provjera** — očekivano ZABA `3.403,74` na 08.07.2026.
4. **Odluka o selidbi** na `Financije_all > Stanja`, s brojevima u ruci.
5. Tek onda automat.

## Što treba od tebe

- **Ništa prije sesije.** Sve se može pripremiti bez tebe.
- Tijekom: potvrditi je li `3.403,74` broj protiv kojeg mjerimo, i je li RF uopće vrijedan
  provjere (njegovi izvodi su išli kroz OCR i nikad nisu do kraja spot-checkani).

---

# DIO 2 — Tehnički (za Claudea)

## Prvo pročitaj

`docs/OVERVIEW_TAB_SPEC.md` §2.10, §2.12, §2.13, §2.15, §2.17 · `sql/036_balance_anchors.sql`
(header nosi obrazloženje koje je S109 djelomično opovrgnuo) · `sql/037_financije_dashboard.sql`
(header objašnjava `split`) · `data-prep_tools/Financije/SALDO_MODEL_NALAZI.md`.

## Stanje koda — ništa nije mijenjano u S109

Provjereno čitanjem, vrijedi na `929073a`:

| Sposobnost | Postoji? | Gdje |
| --- | --- | --- |
| Sidro na proizvoljan datum | **u bazi da, u UI ne** | `balance_anchors.confirmed_on` je obična `date`; `BalanceByGroupTile.confirm()` hardkodira `todayIso()` |
| „Saldo na dan X" | **u RPC-u da, u pločici ne** | `p_as_of` postoji u oba RPC-a; pločica ga **ne prosljeđuje** (`BalanceByGroupTile:68`) |
| „Saldo na dan X" u listi | **da, već radi** | `useRunningBalance` šalje `asOf: p.dateTo` (`:127`), a `dateTo` je globalni filtar (`ActivitiesTable:144`) |
| Izbor sidra po datumu | **da** | `036:191` — `confirmed_on <= p_as_of`, `DISTINCT ON` uzima najnovije |
| Popis / brisanje sidara u UI | **ne** | `listAnchors()` i `deleteAnchor()` postoje u `overviewApi.ts` i **nitko ih ne zove** |

## Plan, s obrazloženjem redoslijeda

### Korak 1 — pločica prima `asOf`

`BalanceByGroupTile` treba dobiti `dateTo` iz `FilterContext` i proslijediti ga u
`fetchAnchoredBalance`. **Preživljava svaku kasniju odluku o pohrani**, zato ide prvi.

Dvije stvari koje nisu mehaničke:

- **Podnaslov mora reći „na dan …"** kad je filtar aktivan. Bez toga pločica pokazuje prošli
  broj kao da je sadašnji — ista klasa greške kao „od početka podataka" prikazan kao bankovni
  iznos (§2.17, točka 4).
- **Prima li `split` (planirano) također `asOf`?** Preporuka: da, radi konzistentnosti —
  ali uz svijest da je odgovor polovičan. `Status` je **trenutno stanje, ne povijest**: app
  ne pamti *kad* je nešto prešlo iz `Planiran` u `Izvrsen`. „Planirano na 08.07." zato može
  značiti samo „od datiranog do 08.07., što je **i danas** još planirano". Ako ikad zatreba
  prava retrospektiva planiranog, to traži povijest statusa — nova stvar, ne sitnica.

**Ne graditi** popis sidara s brisanjem (bivši korak C). Bio bi bačen posao ako stanja sele
u evente. Za čišćenje u međuvremenu:

```sql
DELETE FROM balance_anchors WHERE area_id = '98dd91f3-de77-4619-9d08-d1ade604640a';
```

### Korak 2 — skripta: mjesečna stanja iz izvoda → `balance_anchors`

Nov alat u `data-prep_tools/Financije/`. Izvor: parsirani izvodi (`Izvodi_transakcije.xlsx`).

⚠ **Pravilo koje definira ispravnost alata:** upisuje se **ispisani završni saldo s izvoda**.
Nikad zbroj eventa iz baze. Prekršaj se **ne vidi** — Δ postane trajno nula i cijeli mehanizam
usklađenja tiho umre. Isti razred kao odbačeni automat `Planiran → Izvršen` po dospijeću.

⚠ **ZABA vs RF nisu iste kvalitete.** ZABA lanac je verificiran (T-S107j-A: `Σupl/Σisp` =
bankov „Zbroj prometa" **40/40 u cent**, neprekinut 2023–26). RF je išao kroz **OCR** i
**T-S107d-6 je još otvoren**. Ne uzimati RF zdravo za gotovo — spot-check prije upisa.

⚠ Parser je jednom već krivo određivao `Smjer` (S107i nalaz). Ispisani saldo je zato i
pouzdaniji od izvedenog: čita se broj, ne zaključuje.

### Korak 3 — provjera

- sidro **31.12.2024.** (⚠ ne 01.01.2025. — pravilo je „strogo nakon", sidro na 1.1. izbacilo
  bi transakcije tog dana), iznos = `Stanje` sa zadnjeg retka 2024. u **Kokinom originalnom**
  fileu; ili odmah mjesečna sidra kroz 2025–2026
- drill s pločice na `Kokin tekući ZABA`, sort najnovije prvo, filtar „do" = **08.07.2026.**
- očekivano: **3.403,74**

⚠ **Kokin `Stanje` lanac nije u datumskom redoslijedu.** Na njenoj slici red 2564 je Parking
`2026-08-07` a sjedi *ispred* reda 2565 koji je `2026-07-08`. Znači `3.403,74` **već sadrži**
redak datiran mjesec dana kasnije — onaj poznati od **1,60 €** (red 4996), koji je namjerno
izostavljen iz batcha 2026. **Očekuj razliku od točno 1,60 na toj točki; to nije pad.**

Šire: model reproducira banku u **17/30 mjeseci u cent** — 13 mjeseci se razilazi
(`SALDO_MODEL_NALAZI.md`). Mjesečna sidra su alat da se ta odstupanja izoliraju po mjesecu.

Kolona `Stanje` je pravi instrument: jedan broj kaže „nešto ne valja", kolona kaže
**„puklo je na OVOM retku"**.

### Korak 4 — odluka o `Financije_all > Stanja`

Donijeti **s rezultatima**, ne prije. Argumenti su izvagani u `DONE_HISTORY.md` (S109);
sažetak odluke i pravilo su u `CLAUDE.md`.

Ono što treba provjeriti prije implementacije:

- `rpc_area_balance_anchored`: `anchors` CTE prelazi s tipiziranih stupaca na **pivot tri EAV
  atributa po slugu**. ~20 redaka SQL-a, i još jedno mjesto koje puca na rename sluga
  (`dashboardConfig.ts` fixup mora pokriti i te slugove).
- **Zaštita pisanja slabi.** `036` je namjerno strože od eventa: `app_can_write_area` traži
  vlasnika ili **write** grantee **na razini baze**. Eventi se oslanjaju na
  `user_id = auth.uid()` + provjeru u aplikaciji (S43). Za dvoje ljudi vjerojatno svejedno,
  kao princip je korak unatrag — **svjesno prihvatiti ili kompenzirati**.
- **Sidra ulaze u tok aktivnosti**: Excel export, brojači, filtri, Kokino stablo kategorija.
- **Provjereno da s trenutnim configom NE bi upala u zbroj**: sidro nema `izvorplacanja`, a
  `op: in` pada kad vrijednosti nema (`sql/035` §3 i ista logika u `useRunningBalance:172`).
  ⚠ To je **sreća, ne jamstvo** — sa zasebnom tablicom je strukturno nemoguće.
- ⚠ `useActivities` grupira po `(kategorija, session_start)` ⇒ dva stanja za dva računa istog
  dana moraju imati **različit `session_start`** (isti trik +1 min kao rate).

### Korak 5 — automat (tek nakon 4)

Puni `Stanja` iz izvoda, mjesečno ili na zahtjev. Isto pravilo kao korak 2.

## Neverificirano iz S108 (ništa se nije promijenilo osim T-S108-4/3)

Drill, kolona `Stanje` s pravim brojevima, fixup slugova pri renameu, „From template" settings
copy, 6 `.order('id')` popravaka, Help chipovi na Overviewu, mobitel, grantee.
Puni popis i koraci: `Claude-temp_R/PENDING_TESTS.md` i `test-sessions/S108_tests.md`.

## Otvoreno izvan ove teme

- **Red 4996 (Parking 1,60)** — ispravljen u Reviewu na `2026-07-07`, **nije u bazi**.
  Dodati kroz Add Activity ili export → uredi → import. ⚠ **Ne** novim batchom.
- **Kokina delta** (11.07.2026. → danas) — i dalje prva stavka po CLAUDE.md-u, ali sidro ju
  je maknulo s kritičnog puta za saldo. Ostaje zbog analize i zbog toga što Koki fali povijest.
- **OQ-5** — `make_financije_import.py` treba prestati pisati atribut `Stanje`.
  S109 je to potvrdio kao odluku; nije izvršeno.

## Sitnica

`S109` je ova sesija ⇒ **Intelligence layer je od sada `S110+`.** (Isti pomak kao S108.)
