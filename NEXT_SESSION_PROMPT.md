# NEXT SESSION PROMPT — nakon S121 (deployano na PROD, čeka se provjera na telefonu)

**Pisan protiv commita `4097af1`** (+ commit zatvaranja S121 koji slijedi odmah iza).
Ako `git log --oneline -1` pokazuje nešto puno novije, čitaj ovo kao povijest; `CLAUDE.md` je autoritet.

**Stanje grana:** `main` i `test-branch` su **na istom commitu** (`4097af1`). Deploy je izveden
28.08. — `git diff main test-branch` je prazan.

> S121 je počeo kao razgovor o gotovini. Završio je s tri popravljena buga, i sva tri su bila
> **isti prekršaj istog pravila**: *neuspjelo čitanje nije „nema ničega"*.

---

# DIO 1 — Jednostavnim rječnikom (za Sašu)

## 1. Što je gotovo i već je na PROD-u

**Tri popravka, sva izmjerena, sva provjerena i u obrnutom smjeru:**

- **Duplikat se više ne događa.** Onaj tvoj 2,70 € zapisan dvaput nije bio slučajnost —
  Finish je brisao nacrt, a auto-save ga je 15 s kasnije vraćao. Sljedeći unos je onda
  ponudio „Resume Previous Session?" i upisao isti redak drugi put.
- **Auto-save konačno radi.** Ispalo je da **nikad nije radio** — jedino što je ikad napravio
  bio je gornji duplikat. To znači i da **Koka dosad nije imala nikakvu zaštitu od gubitka
  unosa.** Sada ima: nacrt se sprema svakih 5 sekundi, lokalno u pregledniku.
- **Nestali Overview tab i iznosi.** Kad app ne uspije pročitati postavke Aree, sada
  **pokušava ponovno**, a ako ne uspije — javi to trakom koja izričito kaže *„Podaci su
  netaknuti"*. Prije se aplikacija samo tiho pretvorila u drugu aplikaciju.

**Napisano prije koda:** `docs/RULES_ENGINE_SPEC.md` — kako će izgledati pravila razvrstavanja
kad ih preselimo iz Excela u bazu.

## 2. Što stoji na tebi

1. **Prolaz na PROD-u, ~5 minuta** — `T-S121-3` i `T-S121-4`. Detalji:
   `docs/sessions/tests/S121_tests.md`.
   - ⚠ **Ctrl+Shift+R prije svega** (stari bundle je u S118 tiho osakatio uvoz).
   - Upiši redak → Finish → **pričekaj pola minute** → odmah Add Activity.
     **Ne smije** iskočiti „Resume Previous Session?".
   - Pa: Add Activity, popuni 3–4 polja, **zatvori tab**, vrati se → **smije** iskočiti, i
     Resume mora vratiti polja. To je zaštita koja radi, ne kvar.
2. **Očekuj „Resume Previous Session?" češće nego prije.** Pojavit će se kad god napustiš
   Add Activity bez `Finish` i bez `✕`. To je novo i namjerno.
3. **Koka.** Kad se vrati: ona je gledala, ali **nije upisala nijedan event**. `T-S118-6`
   (njen prolaz s mobitela) je i dalje otvoren i jedina je stvar koja stvarno blokira cutover.
4. Iz S118 još stoji: reći joj za retke s krivom godinom (`2036-04-08`, `2028-05-16`),
   `07.08. Parking 1,60`, i 5 spornih lipanjskih redaka (Σ `373,11`).

## 3. Odluke koje si donio u S121 (da se ne otvaraju ponovno)

- **Gotovinu ne bilježiš svaku.** Izmjereno: 57 podizanja / **9.894 €** naspram 2 troška /
  **86 €**. Sigurno je, jer gotovinski trošak **nikad ne ulazi u saldo**. Ali kad se bude
  gradio razrez po Tipu, mora imati redak **„gotovina, nerazvrstano"** — inače prešuti ~9.800 €.
- **Poseban račun `Gotovina` — odbačen definitivno.** Ne zbog cijene nego zato što je
  izmjereno da postojeći `Transfer / izmedju racuna` nije dvostruki zapis, pa ne bi imao što
  reciklirati.
- **Pravila: konflikt se prijavljuje, ne rješava redoslijedom.** ⚠ Posljedica koju treba
  prihvatiti: prvi run će razvrstati **manje** redaka nego danas (~71 ide tebi na odluku).

## 4. Što NE treba istraživati

Sve iz S120 („atributni filtar nije spor", „uvoz ne griješi areu") i dodatno: **baza nije bila
kriva** ni za jedan od tri S121 buga — `settings`, share i brzina upita provjereni su svaki put.

---

# DIO 2 — Tehnički (za Claudea)

## 1. Prvo pročitaj

`docs/sessions/DONE_HISTORY.md` **S121** · `CLAUDE.md` → prošireni blok **„UI (React)"**
(pet novih pravila) i **„E2E"** · `docs/RULES_ENGINE_SPEC.md`.

## 2. Što je dirano

| file | što |
| --- | --- |
| `src/lib/retry.ts` | **nov** — `withRetry` / `withRetryQuery`. ⚠ uzima `isFailure` predikat jer `supabase` **ne odbija promise** na neuspjeh |
| `src/hooks/useLocalStorageSync.ts` | `clearDraft()` sam gasi auto-save; preskočen upis kad se sadržaj nije promijenio |
| `src/pages/AddActivityPage.tsx` | `onError` u `useCallback`, `getDraftData` u ref, `sessionFinishedRef` |
| `src/types/activity.ts` | `AUTO_SAVE_INTERVAL` 15 s → 5 s |
| `src/hooks/useAreaDashboard.ts` | retry + `error` stanje; ne nulira config na grešci za istu Areu |
| `src/context/FilterContext.tsx` | `try/catch` oko `resolve()`, retry, `areaContextError` |
| `src/pages/AppHome.tsx` | amber traka + „Pokušaj ponovno" |
| `docs/help/activities.md` | nova sekcija o nedovršenom unosu |
| `data-prep_tools/Tools/audit_tests.py` | popravljen `UnicodeEncodeError` na Windows konzoli |
| 2 nova spec filea | `S121_draft_after_finish`, `S121_area_context_failure` |

`npm run typecheck && npm run build` prolaze.

## 3. Stanje E2E-a

⚠ **`e16-filter-persistence` je flaky** — timeout od 120 s, pada **i bez izmjena iz S121**
(1/3 bez, 2/3 s; uzorak premalen da se tvrdi da je pogoršan). Dok je flaky, S120 popravak
„filtar preživi View Details" **nije čuvan**. `T-S121-6`.
⚠ `e13-add-between` također pada, isto i bez izmjena — postojeći kvar, nije regresija.

## 4. Prvo što bih uzeo sljedeći put

⚠ **Ne deployati samoinicijativno.** `main` == `test-branch`; sve novo ide na `test-branch`.

1. **`e16` flake** (`T-S121-6`) — nije kozmetika: to je jedini čuvar S120 popravka.
2. **Faza 1 rules engine** — tablica `rules` + `Rules` sheet + roundtrip, **bez ijednog
   potrošača**. Provjerljivo isti dan, i otključava sve ostalo.
3. **`help_notes` po Arei** — Sašin zahtjev iz S121: proza koju Haiku može čitati (npr.
   objašnjenje o gotovini). ⚠ Kontekst Aree se **danas gubi**: klijent šalje `areaId`
   ([HelpPanel.tsx:164](src/components/help/HelpPanel.tsx#L164)), a funkcija čita `areaName`
   ([help.ts:118](netlify/functions/help.ts#L118)) — polje koje nitko ne šalje. To je
   preduvjet za bilo što.
4. **Faza 3 — `set_attribute` na Import putu.** Jedna rupa drži tri featurea.
5. **Faza 2 — brzi unos.** ⚠ Saša još nije odgovorio što mu je bilo naporno pri unosu onih 5
   redaka s telefona — **pitati prije nego se išta gradi**. Moja slutnja je `Tip`/`Podtip`
   (18 opcija u prvom dropdownu, a četiri od pet puta je bilo `Domaćinstvo`), pa bi
   shortcutovi po trgovcu (`activity_presets`, nula koda) bili prvi potez.

⚠ I dalje vrijedi: **batch 2024 i 2023 idu na PROD**, i to je okidač za preimenovanje
`Financije_all` → `Financije` (rename **kroz UI**, nikad importom).

## 5. Otvoreno, imenovano, nezatvoreno

- **`e16` flake** (T-S121-6) · **`e13-add-between`** pada
- **Postgres upgrade na PROD-u** — otvoren od S105. Retry iz S121 **skriva** taj uzrok, ne
  liječi ga; free-tier će se i dalje gušiti.
- **Razrez po Tipu ne postoji** — `settings.dashboard` ima jedan widget. Kad se gradi:
  redak `gotovina, nerazvrstano` (T-S121-7).
- **`dashboard` i `export_profiles` ne prolaze Excel roundtrip** — dvije poznate rupe u
  „sve ide importom". `help_notes` i `rules` **ne smiju** postati treća i četvrta.
