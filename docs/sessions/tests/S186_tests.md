# S186 — testovi (2026-10-27)

Kolona liste čita cijeli lanac; sheet `Restructure attributes` (F2 A1) s fazom u Structure uvozu, korak po
korak; popravak ćelije `Map` u `ListColumns` (ključ s `|`). Sve na `test-branch`, PROD nije diran.

---

## T-S186-1 ✅ Automatske brane — kolona liste čita lanac

`listChainValues.test.mjs` 17/17 (sabotaže „samo leaf" / „roditelj se zbraja" / „bez chain_key" ruše 5 / 2 / 2);
E2E `S186_list_parent_attr` (🙂 s `chain_key`, 🙁 stari zapis bez njega, leaf `orb`; sabotaža hooka ⇒ `—`).

## T-S186-2 ✅ Automatske brane — sheet `Restructure attributes` (parser)

`restructureAttrSheet.test.mjs` 40/40 (goli `|` ruši 8, bez provjere `=` u ključu 2, predložak samo leaf 1).

## T-S186-3 ✅ Automatske brane — A1 u aplikaciji + ćelija `Map`

- E2E `S186_attr_restructure`: export → korak `mood → number` (mapa sa `:-|`) → pregled „Next · 3 rows" → Apply
  (ponovno mjerenje ✓, baza 3/4/5, mapa kolone na ključevima 1–5) → Undo (baza kao prije) → Apply → **isti file
  opet ⇒ „Already in this state · applied … by you"**, bez gumba Apply. Sabotaža (isti tip = greška, staro
  ponašanje) ⇒ pad na „Blocked".
- `listColumnMap.test.mjs` 8/8 (stari split na golom `|` ruši 1). Prvi run E2E-a je pao baš na tome: Structure
  uvoz je `:-| = 😐` raspolovio.
- `restructureRetype.test.mjs` 44/44 (poruke na engleskom; isti tip ⇒ `state: done`).

---

## T-S186-4 ⬜ (TEST lokalno, Gmail) Restructure attributes na `Fitness_Garmin`

**Preduvjet:** `npm run dev` (TEST — žuta traka), prijava `sasasladoljev59@gmail.com`, **Ctrl+Shift+R**.

**Koraci:**
1. Area **`Fitness_Garmin`** → **Structure** → **Export**.
2. U fileu, sheet **`Restructure attributes`** (ispod zaglavlja je uputa na engleskom; na dnu popis atributa po
   kategoriji, npr. `Attributes — Activity: … mood (number) …`). Upiši **dva retka** (red 2 i 3):

   | Step | Operation | Category | Attribute | New type | Into attribute | Conversion |
   | --- | --- | --- | --- | --- | --- | --- |
   | 1 | change type | Activity | mood | number | | *(mapa — vidi ispod)* |
   | 2 | change type | Outdoor | pace | number | | `mm:ss` |

   Conversion za korak 1 (kopiraj točno ovako, bez kosih crta):

   ```
   :-( = 1 | :-/ = 2 | :-| = 3 | :-) = 4 | :-D = 5
   ```

   ⚠ Ispravljeno S186: prva verzija je mapu imala u tablici kao `\|` (markdown), pa je u Excel otišla s kosim
   crtama — uvoz ju je ispravno odbio greškom za redak 2 (brana radi).

   Spremi file.
3. Structure → **Import** → odaberi file → Import. Skrolaj (prozor se sam spusti) do bloka **Restructure attributes — preview**.
4. Pročitaj pregled. **Ne primjenjuj ništa još.**
5. Kvačica **I have seen what changes** → **Apply step 2**.
6. **Undo step 2**.
7. Close, pa **ponovno Import istog filea** (koraci 3–4).
8. Close bez primjene.

**Očekivano:**
- 4.: korak 1 — **✓ Already in this state · applied 26.10.2026 16:49:12 by service: dokaz-S185** (to je S185
  pretvorba skriptom); korak 2 — **▶ Next · 1.936 rows**. Gore rečenica *„Doing 1 change: step 2 — Outdoor.pace →
  number (mm:ss) (1.936 rows)."* Ispod: *Step 2 changes* (`pace: text → number (mm:ss), 1936 rows`). Nema crvene
  tablice nepretvorivih.
- 5.: zeleni okvir **✓ Step 2 applied** i *„Re-measure: the database is exactly what the preview predicted ✓"*;
  korak 2 u tablici postaje **✓ Already in this state · applied <sada> by you**.
- 6.: **↺ Step 2 undone** · *„… exactly what it was before ✓"*; korak 2 opet **▶ Next · 1.936 rows**.
  (`pace` ostaje tekst — odluka S185.)
- 7.: isto kao 4. — korak 2 je **Next** (poništen je), korak 1 **Already in this state**.

**Pad:** bilo koja brojka drukčija; crveni okvir s greškom; „Re-measure" bez ✓ ⇒ screenshot.
