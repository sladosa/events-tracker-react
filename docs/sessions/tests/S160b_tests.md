# S160b — nastavak S160: grantee ne dodaje opcije (2026-10-04)

> Sašina odluka nakon testiranja S160: *„Podtipovi bi trebali bit kontrolirani u bazi"* — opcije
> su struktura Aree, a struktura je vlasnikova (S133). Grantee je dotad imao „Other...", upis u
> `validation_rules` mu je RLS tiho odbijao (samo `console.warn`), a vrijednost je ostajala na
> retku kao siročad izvan popisa. Na `test-branch`, nije na `main`.

---

## T-S160b-1 ⬜ Grantee nema „Other...", vidi rečenicu o vlasniku; vlasnik i dalje ima „Other..."

Lokalno `npm run dev:prod` (PROD), Ctrl+Shift+R. **Ništa se ne sprema** — samo otvori izbornik pa ✕.
1. Pod **svojim** računom (grantee `Financije_all`): `Financije_all > Transakcija` → **+** (Add).
   Otvori izbornik **Podtip** (nakon odabira Tipa) i **Smjer**.
   **Očekivano:** nema „Other..."; zadnja stavka je siva, ne da se odabrati:
   *„Nova opcija? Dodaje je vlasnik Aree (Koka…)"*. Postojeće opcije normalno.
2. Isto u **Editu** postojećeg retka.
3. (kad si ionako pod Kokinim računom) Add → Podtip: **„Other..." postoji** kao i prije.

**Pad:** grantee vidi „Other..." ⇒ prop nije stigao do forme; vlasnik ne vidi „Other..." ⇒
`sharedContext` krivo postavljen.
