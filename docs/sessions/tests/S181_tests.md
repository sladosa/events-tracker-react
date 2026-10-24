# S181 — testovi (2026-10-24)

Excel roundtrip `Financije_all` s Namjenom (plan iz S180). Profil `Kokin_format` dobio je Namjenu
iza Podtipa, vidljivu. Izmjereno na TEST-u (TEST = PROD po `areas.settings`, provjereno 24.10.).
Alati su u `Claude-temp_R/s181/`.

---

## T-S181-1 ✅ (PROD, Saša pod Kokinim računom) Profil `Kokin_format` s Namjenom

> ✅ **24.10.:** Saša uvezao file na PROD-u i dobio očekivani toast. PROD je zatim pročitan alatom
> `Claude-temp_R/s181/prod_profile.mjs`: od 8 ključeva `areas.settings` promijenio se samo
> `export_profiles`, i on je sada jednak TEST-u nakon istog uvoza. Namjena je iza Podtipa, a filtri
> profila su `last-3-months` / `asc`.

**Izmjereno na TEST-u (24.10.):** isti file uvezen kao profil ⇒ Namjena je u profilu iza Podtipa,
`hidden: false`, bez grupe. Svih ostalih 23 stupaca ima istu skrivenost, grupu i širinu, filtri profila
su `last-3-months` / `asc` kao prije, a ostalih 7 ključeva `areas.settings` je nepromijenjeno. Profil
usput dobiva i `row_hash` (grupiran, nije skriven), kakav je izvoz ionako davao.

**Koraci:**
1. PROD app pod **Kokinim** računom → **Ctrl+Shift+R** (obavezno: Import Profile prepisuje cijeli
   `areas.settings` snimkom koju je kartica učitala; stara kartica od prije S180 vratila bi stari config).
2. Area `Financije_all` → Activities → **📥 Export** → **📋 Import Profile** → odaberi
   `C:\0_Sasa\events-tracker-react\Claude-temp_R\s181\c_profil_namjena.xlsx`.
3. Prompt nudi ime `Kokin_format` ⇒ OK (prepisuje postojeći profil istog imena).

**Očekivano:** toast `Profile "Kokin_format" saved (12 hidden cols, column order + widths + filter overrides)`.
Zatim Download Excel s tim profilom: stupci vidljivi redom datum · opis · Racun · Izvor · Smjer · Uplata ·
Isplata · Tip · Podtip · **Namjena** · Datum naplate · Status.
Claude zatim pročita PROD `areas.settings` i potvrdi da se promijenio samo `export_profiles`.

**Pad:** toast bez `filter overrides` ili drugi broj skrivenih stupaca, ili Namjena zadnja.
⚠ Profil se NE uvozi iz `Preview (10 rows)` filea: Preview ne primjenjuje filtre profila, pa njegov
`Filter` sheet nosi filtre panela (`this-year` / `Newest first`), a Import Profile bi ih upisao u profil.

---

## Izmjereno u S181 (TEST, automatski kroz app; nije ručni test)

| Što | Rezultat |
| --- | --- |
| Izvoz s novim profilom vs prije, 448 redaka, po naslovu stupca | **0** razlika ćelija (i `row_hash`) |
| Uvoz nepromijenjenog filea | `0 New · 0 Modify · 448 Unchanged` |
| Uvoz s promijenjenom samo Namjenom (ZABA, 24.07., unutar potvrđenog) | `1 Modify` (`Namjena: Zajedničko → Koka`), samo kvačica „I reviewed“, **bez** kutije potvrđenog stanja |
| Delta ZABA (16 redaka od 12.10.): kontrolni stupac, kontrolna točka, `Potvrda`, Σ košare, `Provjeri` | sve formule čitaju prave stupce (`Izvor`, `Status`, `Uplata`, `Isplata`, `Datum naplate`) iako su pomaknuti |
| **Dropdown Namjene u Excelu** | ✗ **BUG-S181-DEPNAME** (v. CLAUDE.md Open bugs): nudi Podtipove, a Podtip pod `auto C5`/`auto Lacetti` dobiva raspon od dva popisa |
| Popravak, app (TEST export `g_delta_zaba_fix.xlsx`, `verify_dd.mjs`) | 42 raspona, nijedan s dva područja; Namjena pod svih 18 Tipova i uz prazan Tip = 4 namjene; Podtip pod svakim Tipom svoj popis; Izvor ← Racun i Status ← Izvor kao prije |
| Popravak, Python `visa_popravak.pisi` (`t_pisi.py`) | `provjeri()` prolazi; novi retci: auto C5 → Koka, auto Lacetti → Saša, Razno / N/A → Zajedničko; sabotaža (Namjena pod imenom Podtipa) ⇒ `provjeri()` staje i nabraja svaki Tip |
| Popravak, `fill_from_izvod.write_rows` (`t_fill.py`) | 3 nova retka: Saša / Zajedničko / Koka (bez pravila: prazno); pregled uvoza `3 New · 0 Modify` |

---

## T-S181-2 ⬜ (PROD, poslije deploya) Excel izbornici Namjene i Podtipa

**Koraci:** Ctrl+Shift+R → `Financije_all` → Export → profil `Kokin_format` → **Download Excel** → otvori u Excelu.
1. Redak s Tipom `Razno`: klik na ćeliju Namjena ⇒ strelica nudi **Zajedničko · Koka · Saša · Nena / Kućište**.
2. Prazan redak (ili obriši Tip u kopiji): Namjena nudi isto.
3. Redak s Tipom `auto C5`: Podtip nudi **gorivo · leasing · popravci · registracija**.

**Pad:** Namjena nudi Podtipove (stari bundle — ponovi Ctrl+Shift+R) ili Podtip pod `auto C5` nema strelicu.

## T-S181-4 ⬜ (PROD, poslije deploya) Excel uvoz: zadana Namjena na novom retku

**Izmjereno na TEST-u (24.10.):** file s 3 nova retka bez Namjene (`g_delta_zaba_fix_bez.xlsx`) ⇒
pregled `3 New` + „Zadano iz pravila (kao forma) na novim retcima s praznom ćelijom: Namjena 3
(Saša 1, Zajedničko 1, Koka 1)" ⇒ Apply ⇒ baza: auto Lacetti → Saša, Razno → Zajedničko,
auto C5 → Koka. Retci obrisani, `kontrola.mjs` prije = poslije (saldo, Namjena, Tip, ukupno).

**Koraci (PROD):** Ctrl+Shift+R → delta ili obični export → u prazan redak upiši novu transakciju
(Tip npr. `Domaćinstvo`), Namjenu ostavi praznu; u drugi novi redak upiši Namjenu `Saša` → uvoz.
**Očekivano:** u pregledu redak „Zadano iz pravila … Namjena 1 (Zajedničko 1)" (ne 2); u appu prvi
redak ima Zajedničko, drugi Saša.
**Pad:** nema retka u pregledu (stari bundle — Ctrl+Shift+R) ili je drugi redak dobio Zajedničko.

## T-S181-3 ⬜ (studeni, uz T-S175-1..3) Namjena na retcima s izvoda

**Očekivano u ispisu** `fill_from_izvod` (bez `--dry` i s njim): redak
`Namjena [PROD]: * → Zajedničko, auto C5 → Koka, auto Lacetti → Saša — upisuje se svakom novom retku po Tipu.`
U `_filled` fileu svaki novi redak ima Namjenu (gorivo za Lacetti ⇒ Saša). `visa_uvoz_izvoda --file`
ispiše `Namjena novih redaka: …` i njegov file ima stupac Namjena iza Podtipa s izbornikom.
**Pad:** `⚠ List nema stupca Namjena` ⇒ delta je izvezena prije S180 — izvezi ponovno.
