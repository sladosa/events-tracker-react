# S146 — testovi (2026-09-23)

> Sesija trijaže: 8 sekcija arhivirano, uveden šesti kriterij zatvaranja, a
> `check_links.py` je postao brana koju zovu dva alata. Usput su ispala **dva
> kvara u E2E harnessu** i **jedna regresija koju je izazvala sama selidba**.

Povratak na popis: [../PENDING_TESTS.md](../PENDING_TESTS.md)

---

## T-S146-1 ⬜ `supabaseUpsert` — ponovljen run ostala četiri speca

**Zašto postoji:** popravljen je **dijeljeni** helper (`e2e/fixtures/auth.ts`), a
izmjeren je **samo `e15`**. Isti helper s istim `onConflict` argumentom koriste
još **četiri** speca, i svi upisuju u `data_shares`.

⚠ Prije popravka je **drugi** run padao u `beforeAll` s
`409 duplicate key value violates unique constraint "data_shares_unique_share"`.
Dakle test se mora pustiti **dvaput zaredom** — prvi run ne dokazuje ništa.

**Preduvjeti**
- dev server na `:5173` mora biti **TEST** (`xtnbhmojmffjelsqejpw`), ne `dev:prod`
- nijedan drugi E2E run ne smije teći (dijele TEST bazu)

**Koraci**
1. `npx playwright test e2e/tests/e8-grantee-write.spec.ts`
2. **odmah ponovo** isti spec — ovo je pravi test
3. isto za `e9-grantee-read.spec.ts`, `e10-revoke.spec.ts`,
   `S123_owner_edits_grantee_row.spec.ts`

**Očekivano:** nijedan run ne pada s `409` u `beforeAll`.

**Pad koji nije regresija:** `structure-row-…` se ne pojavi ⇒ to je poznati
flake (T-S140-8), ne posljedica ovog popravka. Razlikuju se po poruci: `409` je
u `beforeAll`, `structure-row` u tijelu testa.

⚠ Ako `409` i dalje pada: provjeri da RLS dopušta **UPDATE** na `data_shares`
vlasniku — `on_conflict` pretvara INSERT u UPSERT, pa sad treba i UPDATE pravo,
što prije nije trebalo.

---

## T-S146-2 ✅ S146 — brana paginacije (`pagingOrderGuard`)

**Izmjereno:** `node src/lib/__tests__/pagingOrderGuard.test.mjs` ⇒ 122 filea,
**10 poziva `.range()`, svih 10 sortirano**, 8 tvrdnji prošlo.
`npm run test:unit` ⇒ **15 fileova / 0 palo / 0 pokvarenih**.

**Protuprovjera (S120 pravilo):** detektor mora **prijaviti** nesortiran upit —
tvrdnje `nesortiran .range() se prijavi` i `helper BEZ .order() se prijavi`
mjere baš to, nad izmišljenim kodom.

⚠ Prva verzija brane je bila **preslaba i to se vidjelo tek mjerenjem**: imala je
fallback *„ima li `.order(` igdje u fileu"*, koji bi propustio nov nesortiran
`.range()` u svakom fileu koji već ima ijedan `.order(`. Zamijenjeno s tri
stvarna mehanizma — stripanje komentara, lanac do granice naredbe, razrješavanje
helpera.

---

## T-S146-3 ✅ S146 — `check_links.py` kao brana, iz dva domaćina

**Izmjereno, u oba smjera:**

| domaćin | sabotaža | ishod |
| --- | --- | --- |
| `check_links.py` | sklonjen `S135_tests.md` iz arhive | `MRTVIH: 1`, exit **1** |
| — | vraćen | `Mrtvih: NEMA`, exit **0** |
| `audit_tests.py` | sklonjen `S130_tests.md` | prijavio + uputa `--fix` |
| `claude_index.py --write` | sklonjen `S135_tests.md` | prijavio |

**Dokazao se na prvoj stvarnoj upotrebi:** pri arhiviranju S130 sam je uhvatio i
(`--fix`) popravio novonastali mrtav link.

⚠ Ponašanje je **tiho kad je čisto, glasno kad nije** — obrnuto bi se naučilo
preskakati (pravilo iz S143).

---

## T-S146-4 ✅ S146 — `e15` zelen, nakon dva popravka harnessa

**Izmjereno:** `3 passed (58,7 s)` — E15-1, E15-2, E15-3.

Put do toga (oba popravka **samo u harnessu/specu**, app nije diran):

| run | ishod | uzrok |
| --- | --- | --- |
| 1. | E15-1 ❌ | `409` — REST fallback ispuštao `on_conflict` |
| 2. | E15-1 ✅, E15-3 ❌ | tekst info modala očekivan na baneru |
| 3. | **3/3 ✅** | oba popravljena |

⚠ E15-2 je u 2. runu **prošao** a u 3. ciklusu pao jednom na `structure-row-…` —
poznati flake, vodi se pod **T-S140-8**. Ne pripisivati ovom popravku.

---

## T-S146-5 ⬜ Marker `**Otvoreno:` preživi sljedeće arhiviranje

**Zašto postoji:** marker je živio **unutar sekcije S120** i otišao s njom u
arhivu — audit je istog trena prijavio **8 fantomskih proturječnosti**, razred
koji je S139 već zatvorio, oživljen **selidbom, ne izmjenom**.

Premješten je u **zaglavlje** `PENDING_TESTS.md`-a, gdje ga arhiviranje ne
dohvaća. ⚠ Alat ga prepoznaje samo ako redak **počinje** s `**Otvoreno:` — u
blockquoteu (`> **Otvoreno:`) ga **ne vidi**; to je već jednom promašeno danas.

**Koraci (uz sljedeće arhiviranje, ~1 min)**
1. arhiviraj bilo koju zelenu sekciju
2. `python data-prep_tools/Tools/audit_tests.py`

**Očekivano:** zadnja dva retka glase
`Kurirani popis Otvoreno: ukinut je u S116 -- tablice su jedini izvor.`
**Pad:** ispis `PROTURJECNOST u PENDING_TESTS.md` s popisom otvorenih testova.
