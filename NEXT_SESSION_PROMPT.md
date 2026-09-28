> Pisano protiv commita **`d74c084`** (S154, = `main` nakon mergea) + commit S154 koji nosi ovaj file (samo docs).
> ⚠ Ako `git log` pokazuje noviji commit od S154 handoffa, čitaj ovo kao **povijest**, ne kao stanje.
> Trajna pravila su u `CLAUDE.md`; ovdje je samo **stanje u letu**.

# Sljedeća sesija — nakon S154 (2026-09-28)

---

# DIO 1 — netehnički (za Sašu)

## Što je danas napravljeno

1. **Testovi S152 zatvoreni** (osim T-S152-7, razvrstač — čeka Kokin izvod).
2. **„Data range" ispod perioda** brojao je cijelu bazu umjesto odabrane Aree — popravljeno.
3. **Tri Kokine prijave s iPhonea**, sve popravljene:
   - `+` „ne proradi iz prve": dok se filtar učitava, gumb je bio ugašen i šutio je. Sada zapamti
     dodir (kružić) i sam otvori unos; kad ne može, kaže zašto (i na `Health_Sasa`, gdje Koka samo čita).
   - Filtar na `Financije_all > All Categories`: `+` sad ide ravno u `Transakcija` (jedina kategorija).
   - Zatvorena `Transakcija` u unosu: više se ne pamti, svaki unos počinje otvoren.
   - Plavi `?` je na mobitelu prekrivao `+` — sad je uski jezičac uz desni rub, na pola visine.
4. **Sve je na PROD-u** (merge `d74c084`): S152, S153 i S154 zajedno, uključujući novi Help.

## Što treba od tebe / Koke

- **Koka:** na iPhoneu zatvoriti karticu appa i otvoriti je ponovno (da dobije novu verziju).
- **Ti, od Koke samo jedno pitanje (T-S154-2):** reagira li `+` **iz prve**, i kad ga dodirne
  odmah nakon otvaranja appa. Ako da — javi „T-S154-2 OK".
- **T-S152-7** kad Koka pošalje sljedeći izvod (ZABA rujan ili RF).
- Iz S152 i dalje otvoreno: **C5** odluka o configu, **C3b** žig izvoda (Backlog, S152 dio).

## Redoslijed — što slijedi

1. T-S154-2 (Kokin odgovor) · T-S152-7 (kad stigne izvod).
2. **C5** faza 1 (nakon tvoje odluke) · **C3b**.
3. **K-1** (brana na Structure uvozu) — samostalno.
4. K0 inventar klasifikacije kad budeš spreman za Kokinu odluku.

---

# DIO 2 — tehnički (za Claudea)

## Stanje grana

`main` = `test-branch` = `d74c084` (+ docs commit S154 samo na `test-branch`). Deploy S152–S154 pušten.

## Novo u S154

- `useDateBounds`: odgovor nosi `inputKey`, `loading` izveden u renderu, `loadDateBounds` baca na
  palo čitanje (i `withRetryQuery`), Area bez kategorija ⇒ `{null, danas}`. `DateRangeFilter`
  prikazuje grešku s Retry. Test `src/hooks/__tests__/dateBounds.test.mjs` (React shim + lažna baza
  s kašnjenjem; na Windowsima `setTimeout` ~15 ms granulacija — čekanja ≥ 120 ms).
- `src/lib/singleLeaf.ts` (`findSingleLeaf`, `categoryNamePath`) nad `getCategoryMap()`;
  `AppHome`: `singleLeafFor` s ključem, `leafResolving`, `addPending`, `+` je `aria-disabled`
  (nikad `disabled`) — Playwright `toBeDisabled` ga čita, specovi netaknuti.
- `AttributeChainForm`: leaf ignorira `attrExpanded:<id>` (čitanje i pisanje).
- `HelpOverlay` FAB: `< sm` jezičac `right-0 top-1/2 w-7 h-12`.

## Otvoreno

- **T-S154-2** mjeri se samo na Kokinom iPhoneu (lokalno pod 3G dev server ne učita ni `areas`).
- Zapaženo pod 3G, **nije dirano**: S149 traka *„prikazana je cijela Area"* stoji dok je Area
  `All Areas` i popis Area prazan (obnova odustala prije nego su Aree stigle) — tekst tvrdi
  neistinu u tom rubu.
- Iz S153: prvi pokušaj T-S152-2 A (neutvrđen uzrok, ne ponovilo se); `persistPendingOptions` ne dira
  `updated_at`; opcije po roditelju — točna slova vs bez obzira na veličinu; K-1 mora pokriti tihi
  duplikat Aree (S134).
- Iz S152: C3b, C5 (`053` RPC), `Hlace i carape`, rata `117,32`, MC `±105,30` `Planiran`, E8-2 trace.
- Pomoćne REST skripte (TEST i PROD, samo čitanje) su u scratchpadu S154, nisu u repou; embed
  `events→categories` je dvosmislen (HTTP 300) — kategorije/Aree dohvaćati zasebno.
