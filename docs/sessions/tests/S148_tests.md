# S148 — detaljni testovi (2026-09-24)

> Sesija je bila **čišćenje Visa košara na PROD-u**. Sve izmjene su išle kroz Excel uvoz
> pod Kokinim računom (vlasnica Aree), nijedna kroz skriptu koja piše u bazu.
> Instrument za svaki test je `data-prep_tools/Financije/visa_kosare.py`.

---

## T-S148-1 ✅ Visa košare 2026-02 → 2026-08 u cent

**Što je popravljeno:** 24 retka viška u košarama (Σ 784,81). Svih 7 PBZ izvoda 2026. slagalo
se s RF naplatom u cent — višak su bili Sašini ručni retci (sheet `sasa EU`) uvezeni **uz**
iste retke s izvoda: isti dan dvaput, datum mjesec ranije, iznos s tipfelerom, ručna rata uz
bankinu, 1:N (`3,60` = `2,00 + 1,60`). Plus dvije rate u krivoj košari (Bauhaus 2/6,
Pedikura 2/2 → naplata 07.08.).

**Koraci:**
1. `$env:ET_TARGET='prod'; Financije\run.bat visa_kosare.py`
2. **Očekivano:** svaki mjesec 2026-02 … 2026-08 ima `razlika 0.00`.

✅ **Izmjereno 24.09.2026.** nakon tri Kokina uvoza (`visa_popravak`, `visa_odluka`) i Edita
Carglassa (→ `Cash`).

**Pad:** bilo koja razlika ≠ 0 ⇒ `visa_kosare.py <YYYY-MM>` ispisuje retke s obje strane.

---

## T-S148-2 ✅ Kolovoški izvod (`PBZVIZA_2026-08.pdf`) uvezen — rujan u cent

**Što je napravljeno:** `visa_uvoz_izvoda.py PBZVIZA_2026-08.pdf 2026-09-07` — 37 novih
redaka (7 rata starih planova, 29 kupnji, 1 nov plan) + 11 ispravaka postojećih
(`Datum naplate` 03.09. → 07.09., `Izvrsen`, `Izvod opis`, bankin iznos za tri `~` retka).

**Očekivano:** `2026-09  48  1218.38  1218.38  0.00`, a detalj `2026-09` bez ijednog retka
u „na izvodu, nema u košari" i „u košari, nema na izvodu".
✅ **Izmjereno 24.09.2026.**

---

## T-S148-3 ✅ 7 duplikata iz prvog uvoza uklonjeno

**Što se dogodilo:** generirani file je u koloni G svih redaka nosio **Kokin** e-mail; 7
Sašinih redaka uvoz je zato upisao kao **nove** (poruka „not found in database").
**Popravak:** `visa_popravak.py --duplikati` — DELETE 7 Kokinih kopija + ispravak Sašinih
originala s njegovim e-mailom (Koka: „fix as owner").

**Očekivano:** uvoz `0 / 7 / 7`; rujanska košara 48 redaka bez ijednog para istog
(datum, iznos). ✅ **Izmjereno 24.09.2026.**

---

## T-S148-4 ⬜ Šest Podtipova koji ne pripadaju svom Tipu

**Preduvjet:** nakon Sašine klasifikacije u uvozu 19:55 šest redaka nosi `Tip` bez `Podtipa`:

| datum | iznos | opis | sada |
| --- | ---: | --- | --- |
| 03.08. | 14,74 | AGS Tuhelj | Putovanja / N/A |
| 03.08. | 1,70 | AZM Mokrice | Putovanja / N/A |
| 11.08. | 10,00 | Restoran Kvatric | Projekti / N/A |
| 21.08. | 23,94 | GLS Donji Stupnik | Razno / N/A |
| 24.08. | 38,60 | Jadrolinija Ploče | Putovanja / N/A |
| 27.08. | 7,24 | Studenac Orebić | Putovanja / N/A |

**Koraci:**
1. Ispravi Podtip **Editom u appu** (dropdown ovisi o Tipu). ⚠ Tih 6 **nije** u
   `import_report_20260924_195515.xlsx` — zadnji uvoz ih nije dirao (Tip su dobili ranije,
   iz Claudeova filea). ⚠ **Ne** ponovo uvoziti `events_export_Kokin_format_20260924_193128.xlsx`.
2. Provjera (Claude): skripta nad PROD-om koja za svaki redak traži `Podtip ∈
   validation_rules.depends_on.options_map[Tip]`.

**Očekivano:** tih šest više nije na popisu loših parova.
**Pad:** redak i dalje `X / N/A`.

⚠ Isti ispis nosi još **14** loših parova koji **nisu** iz S148 — v. NEXT_SESSION_PROMPT
(`Zabava / Wellness` ×10 i drugi). Oni nisu dio ovog testa.

---

## T-S148-5 ✅ PP 8,60 (23.09.) prebačen na Kokin ZABA

**Što je popravljeno:** redak je nosio `Izvor = Visa`, `Racun = Sašin tekući RF`; Saša:
plaćen nalogom s Kokinog ZABA. Sada `Izvor = Racun`, `Racun = Kokin tekući ZABA`,
`Izvrsen`, `Datum naplate` 23.09.
⚠ Posljedica: ZABA saldo pao za **8,60** — ispravno; 23.09. je **poslije** zadnjeg ZABA
sidra (06.09.), pa nijedno potvrđeno razdoblje nije dirnuto.
✅ **Izmjereno u bazi 24.09.2026.** (uvoz `visa_popravak`, 9 izmjena).

⚠ Komentar retka je i dalje `Sašin tekući RF/Zdravlje/PP (Posmrtna pripomoc)` — ostatak
predloška koji spominje krivi račun. Pitanje Saši ostalo neodgovoreno.
