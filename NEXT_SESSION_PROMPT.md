# NEXT SESSION PROMPT — nakon S108 (Faza 1: RPC + Overview tab + pločica)

**Pisan protiv commita `c33af04`** (S107z handoff) **+ necommitani rad S108** — commit S108
slijedi odmah iza. Ako `git log --oneline -1` pokazuje nešto novije od S108 commita, čitaj ovo
kao povijest; `CLAUDE.md` je autoritet.

**Stanje grana:** `test-branch` je S108 (prvi `src/` diff od PROD deploya 2026-08-12).
`main` = PROD, **nije diran** i ne smije biti dok testovi ne prođu.

---

# DIO 1 — Jednostavnim rječnikom (za Sašu)

## Što je gotovo

**Faza 1 je napisana i brojevi su provjereni.** RPC koji računa saldo daje **isti broj u cent**
kao Python model koji je već bio provjeren protiv banke. To je bio uvjet prije ijednog reda UI
koda i prošao je:

| račun | saldo (izvršeno) |
| --- | ---: |
| Kokin tekući ZABA | **150,80 €** |
| Sašin tekući RF | **−1.978,32 €** |

Za usporedbu, naivni zbroj po `Racun`u dao bi ZABA **−22.943,71 €** — pravilo iz §2.10 vrijedi
i na ovom podskupu, ne samo na cijelom Reviewu.

**U aplikaciji sad postoji Overview tab.** Vidi se **samo** na Areama koje imaju konfiguraciju
(za sad samo `Financije_all`) — druge Aree ga nemaju i ne vide ga. Na njemu je pločica
„Stanje po računu": saldo, „planirano", polje **u banci** gdje upišeš što piše u bankovnoj
aplikaciji, i čip koji kaže `✓ slaže se` ili `Δ 49,00`.

**Sidro radi.** Kad klikneš „Potvrdi", taj broj postaje polazište: od tog dana app zbraja samo
ono što se dogodilo **poslije**. Retci datirani na sam dan potvrde se **ne** broje — to je
namjerno i to je jedan od testova.

**Kolona `Stanje` uz svaki redak** (ti si tražio da ide sad, ne kasnije) — pojavljuje se kad je
lista filtrirana na jedan račun i sortirana najnovije-prvo. Klik na iznos u pločici te odvede
točno u takvu listu.

## Što sam ja pogriješio, pa ispravio — pročitaj, jer si vidio krivu verziju

Rekao sam ti da u bazi ima **45 eventa bez ijednog atributa** i da je to rupa u uvozu.
**Nije istina i nema ih.** Moj alat je čitao bazu po stranicama bez zadanog redoslijeda, pa je
svaki put „izgubio" druge retke — u jednom runu 45 u svibnju 2025, u drugom 49 u veljači 2026.
Uvoz je **vjeran Excelu**: od 2222 retka razlikuju se 2, ukupno 1,60 €.

Prva tablica brojeva koju sam ti poslao (ZABA `1.792,46`) je iz istog pokvarenog čitanja.
**Točan broj je `150,80`.**

Isti bug je bio i u samoj aplikaciji, na 6 mjesta — popravljen.

## Što trebaš napraviti ti

1. **Pusti `sql/036_balance_anchors.sql` PONOVO** u Supabase SQL Editoru (TEST).
   Prva verzija je pala na Postgresovom ograničenju (`FULL JOIN`), ispravljena je.
   Bez toga pločica javlja grešku, a kolona `Stanje` se ne prikazuje.
   (`035` i `037` su već puštene i rade — `037` je i primijenjen izravno, config je u bazi.)
2. **Prođi testove `T-S108-1…12`** — koraci su u `Claude-temp_R/test-sessions/S108_tests.md`.
   Najvažniji su **T-S108-2** (brojevi na pločici), **T-S108-4** (sidro, posebno korak 5:
   redak datiran na dan potvrde NE smije pomaknuti saldo) i **T-S108-7** (kolona `Stanje`).
3. **Odluči o `Stanje` atributu.** Sad kad se `Stanje` računa, spremljeni atribut istog imena
   treba prestati pisati u `make_financije_import.py` — inače u Excel exportu postoje dvije
   kolone istog imena s različitim brojem. (To je OQ-5, sad je zrelo za zatvaranje.)
4. **Kokina delta** — i dalje tvoj ručni posao, ne blokira ništa ovdje.

## Što slijedi nakon testova

**Faza 2 — brzi unos.** Nije nov ekran: mehanizam već postoji (Shortcuts, S88). Fale dvije
sitnice iz §2.9 — prefilana polja se ne skupljaju, i dropdown shortcuta je ravan popis bez
grupiranja po Arei.

**Faza 3 — Koka proba na mobitelu.** To je prava vaga. Ako i tada bira Excel, mijenja se plan,
a ne gura se dalje.

---

# DIO 2 — Tehnički (za Claudea)

## Prvo pročitaj

`docs/OVERVIEW_TAB_SPEC.md` (§2.4, §2.10, §2.12, §2.15, §2.16, §2.17) i
`data-prep_tools/Financije/SALDO_MODEL_NALAZI.md`. Kronologija S108 je u `DONE_HISTORY.md`.

## Stanje

**Puštene na TEST:** `sql/035` ✅, `sql/037` ✅ (config je i izravno upisan u
`areas.settings.dashboard` od `Financije_all`).
**`sql/036` — ispravljen nakon prvog puštanja, mora ići ponovo.** Uzrok: Postgres odbija
`FULL JOIN` čiji uvjet nije merge/hash-joinable, a `IS NOT DISTINCT FROM` je takav. Prepisano
u `UNION` ključeva + dva `LEFT JOIN`-a.

**Na PROD-u nema ničega** od Faze 1 — ni SQL ni `src/`.

## Prihvatni test se ponavlja

```
data-prep_tools\Financije\run.bat verify_rpc_vs_model.py
data-prep_tools\Financije\run.bat verify_rpc_vs_model.py --rows
```

Troslojno: **A** Review (Python model) · **B** baza (sirovi retci) · **C** RPC.
`B vs C` je kriterij prihvaćanja. `A vs B` je stanje uvoza — razlika tamo se popravlja
**uvozom, nikad ugađanjem SQL-a**. Prozor se uzima iz baze, pa se sam pomiče kad uđe novi batch.

⚠ Alat sad **baca iznimku** ako paginirani upit nema `order=`. Ne uklanjati tu provjeru.

## Neverificirano (ništa od ovoga nije prošlo ljudski test)

Cijeli UI: Overview tab, pločica, sidro kroz UI, drill, kolona `Stanje`, fixup slugova,
„From template" settings copy, `.order('id')` popravci. Programski su provjereni samo RPC
brojevi (`B vs C`, `A vs B`, `p_from`) i `typecheck`/`build`.

## Poznata ograničenja (dizajn, ne bugovi)

- **Drill nosi jedan `attrFilter`**, a uvjet pločice ima dva (`Izvor` + `Status`) ⇒ drill znači
  „pokaži mi ovaj račun". §2.16 je to predvidio kao test generičnosti; ispalo je da **filtru
  fali mogućnost**, ne da je widget izmislio nešto novo.
- **Tri kante planiranog** (§2.13) i **traka „Dospjelo → potvrdi"** (§2.5a) trebaju granicu po
  `Datum naplate`; RPC filtrira po `event_date`. Faza 4.
- **`dashboard` još ne ide kroz Structure roundtrip** — Faza 4 (`Dashboard` sheet, isti obrazac
  kao `Automations`). Do tada config putuje samo kroz `sql/037` ili „From template".
- **Konfigurator UI se namjerno ne gradi** dok ne postoji druga gusta Area (§2.15) — s N=1 bi
  se betonirao možda pogrešan rječnik pločica.

## Zamka koju ne ponoviti

Range-paginacija bez `.order()` je **tiho pogrešna** — retci se između stranica preklope i
istovremeno preskoče, pa rezultat izgleda uredan a fali mu svaki put drugi dio. Iz toga je
proizašla lažna prijava od 45 nepostojećih eventa. Pravilo je sad u CLAUDE.md („Critical rules"
/ Baza). Popravljeno u `StructureDeleteModal`, `excelImport` (3×), `excelDataLoader`,
`areaOccupants`.

## Sitnica koja čeka

Oznaka `S108` je zauzela broj koji je CLAUDE.md rezervirao za „Intelligence layer".
Intelligence layer je od sada **S109+**.
