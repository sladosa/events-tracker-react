# S107b — Testovi (2026-07-10)

Feature: **set_attribute automatika (Faza 2b)** — auto-punjenje `Datum naplate` po `Izvor` vrijednosti
u Add Activity + **Automations sheet** u Structure Excel roundtripu.

Spec: `docs/AUTOMATION_SPEC.md` § Faza 2b. E2E: `e2e/tests/S107b_set_attribute.spec.ts`.

## 📸 Gdje pogledati što je napravljeno (demo, 2026-07-10)

Snimljeno na TEST bazi kroz privremenu areu "Financije DEMO" (obrisana nakon snimanja).
Sve u **`Claude-temp_R/S107b_demo/`**:

| File | Što pokazuje |
| --- | --- |
| `1_prazan_form.png` | Add Activity prije odabira — Izvor i Datum naplate prazni |
| `2_mastercard_prefill.png` | Izvor=Mastercard → **Datum naplate auto = 11.08.2026 12:00** (`next:11`) |
| `3_racun_same_day.png` | Izvor=Racun → datum = danas (`same`) |
| `4_rucni_unos_ostaje.png` | Ručno upisan 15.01.2030, promjena Izvora na Visa → **ručni datum OSTAJE** |
| `structure_export_demo.xlsx` | Stvarni Structure export — otvori sheet **Automations** (red s pravilom + help blok) |

Kod: `src/lib/attributeRules.ts` (engine), `AddActivityPage.tsx` (prefill useEffect),
`structureExcel.ts` / `structureImport.ts` §9 (Excel roundtrip). Commit `607e9bb` (test-branch).

**Preduvjet za ručne testove (T-S107b-3/5):** Area čiji `settings.automations.attribute_rules`
sadrži pravilo, npr. (SQL na TEST bazi, zamijeni `<AREA_ID>`):

```sql
UPDATE areas SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{automations,attribute_rules}',
  '[{"action":"set_attribute","name":"Datum naplate","target_slug":"datum_naplate",
     "map_slug":"izvor","date_map":{"Mastercard":"next:11","Visa":"next:3","Racun":"same","Cash":"same"}}]'::jsonb
) WHERE id = '<AREA_ID>';
```

Area mora imati leaf kategoriju s atributima: `izvor` (text/suggest: Mastercard|Visa|Racun|Cash)
i `datum_naplate` (datetime). Alternativno: T-S107b-5 kreira pravilo kroz Excel.

---

## T-S107b-3 — Add Activity live prefill (ručno)

1. Filter na leaf kategoriju s konfiguriranim pravilom → **Add Activity**.
2. `Datum naplate` polje je prazno.
3. Odaberi `Izvor = Mastercard`.
   - **Očekivano:** `Datum naplate` se sam popuni na **11. sljedećeg mjeseca, 12:00**.
   - **Fail:** ostane prazan, ili krivi datum.
4. Promijeni `Izvor = Racun`.
   - **Očekivano:** `Datum naplate` se promijeni na **današnji datum, 12:00**.
5. Ručno upiši neki svoj datum u `Datum naplate`, pa promijeni `Izvor = Visa`.
   - **Očekivano:** tvoj ručni datum OSTAJE (automatika ga ne gazi).
6. Finish → provjeri u View da je spremljen ispravan `Datum naplate`.

## T-S107b-4 — Automations sheet u exportu (ručno)

1. Structure tab → **Export** → otvori .xlsx.
2. **Očekivano:** postoji sheet **Automations** (između Structure i HelpStructure):
   - header: `Area | RuleName | Action | TargetAttr | MapAttr | DateMap`
   - jedan plavi red po postojećem pravilu (Aree bez pravila nemaju redove)
   - sivi help blok ispod podataka s objašnjenjem formata
3. DateMap format: `Mastercard=next:11 | Visa=next:3 | Racun=same | Cash=same`.

## T-S107b-5 — Novo pravilo kroz Excel (ručno)

1. U exportu iz T-S107b-4 dodaj novi red u Automations sheet:
   `<ImeAree> | Moje pravilo | set_attribute | <target_slug> | <map_slug> | <Vrijednost>=same`
   (slugovi moraju postojati u toj Arei — vidi Structure sheet kolonu Slug).
2. Structure tab → **Import** → odaberi file → Import.
   - **Očekivano:** result pokazuje red **"Automation rules: N"**.
3. Otvori Add Activity na leafu te Aree → pravilo radi (kao T-S107b-3).
4. **Napomena semantika:** redovi u sheetu ZAMJENJUJU sva set_attribute pravila navedene Aree;
   Aree koje se ne spominju ostaju netaknute.

## T-S107b-6 — Validacija na importu (ručno)

1. U Automations sheet stavi red s nepostojećim slugom (npr. TargetAttr = `ne_postoji`)
   ili pokvarenim DateMap-om (npr. `Mastercard=next:99` ili `Mastercard-same`).
2. Import.
   - **Očekivano:** red se preskače, result pokazuje **"Automation rules skipped: N"** (žuto);
     ostatak importa prolazi normalno. Console log ima [Automations import] warn s razlogom.
   - **Fail:** import pukne, ili se mrtvo pravilo ipak upiše u settings.

---

## E2E (Playwright, već PASS)

- **T-S107b-1** — prefill Mastercard → 11. sljedećeg; Racun → session date; ručni unos preživi
  promjenu Izvora. Self-contained (kreira vlastitu areu, briše je nakon).
- **T-S107b-2** — Structure export → Automations sheet sadrži pravilo; izmjena DateMap
  (`next:11` → `next:15`, brisanje Visa) → import → `area.settings` u bazi ažuriran; UI
  pokazuje "Automation rules".

## Usputni fix (selector, ne app bug)

- **E5-4/E5-5** su padali od ranije: (1) menu item preimenovan "Add Child" → "+ Add Leaf";
  (2) ⋮ meni se zatvara na svaki scroll (capture listener), a Playwrightov auto-scroll pri kliku
  ga je zatvarao čim se otvori. Fix u specu: `clickRowMenuItem()` helper (pre-scroll + retry).
  Aplikacija radi ispravno — nije dokumentirano kao bug.
