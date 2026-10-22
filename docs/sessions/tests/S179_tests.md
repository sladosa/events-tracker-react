# S179 — testovi (2026-10-22)

F1 preuređivanja, drugi dio: faza „Preuređivanje" u Structure uvozu (pregled, Primijeni, Poništi),
`restructure/apply.ts`, E2E i `preuredjivanje_grep.py`. Na TEST-u je Structure uvozom stvoren atribut
`namjena` (prvi test cijelog toka). Sve brojke ispod su **izmjerene** 22.10. na TEST-u (kopija PROD-a
od 22.10.), kroz modal, pod tvojim računom (vlasnik `Financije_all` na TEST-u ⇒ `authenticated`).

⚠ **Prije svakog testa u pregledniku: Ctrl+Shift+R** (stari bundle tiho osakati uvoz, S118).
⚠ TEST mora biti **lokalni dev** (`npm run dev`, žuti banner `TEST DATABASE`) — Netlify nema F1 do deploya.

---

## T-S179-1 ✅ S179 (TEST, Saša) Cijeli tok kroz modal: pregled → Primijeni → lista → Poništi

**File:** `Claude-temp_R/s179/structure_s179.xlsx` (Structure `Financije_all` + 3 retka `namjena` +
10 koraka iz dokaza S178). ⚠ Koraci 8 i 100 nose **fiksne** `event_id` TEST-a od 22.10.; nakon
`prod_to_test.py --apply` file treba ponovo složiti (`node Claude-temp_R/s179/measure.mjs build`).

1. Lokalni dev, Area `Financije_all`, tab **Structure** → **Import** → odaberi file → **Import**.
2. **Očekivano — rezultat uvoza:** sve nule (atribut `namjena` već postoji), poruka
   *„Structure unchanged — the restructure steps below are not applied yet."*
3. **Očekivano — pregled** (pojavi se sam, „Measuring the Area…" ~9 s):
   - zaglavlje `Financije_all · 10 steps · 9.743 changes · 5.448 rows in Area · measured in ~9 s`
   - koraci (rows / changes): **1:** 14 / 28 · **2:** 54 / 108 · **3:** 5 / 10 · **4:** 113 / 113 ·
     **5:** 32 / 32 · **6:** 1.710 / 1.710 · **7:** 2.389 / 2.389 · **8:** 2 / 2 · **99:** 5.348 / 5.348 · **100:** 3 / 3
   - uz svaki korak 3 primjera (datum · opis · iznos), npr. korak 3: `27.03.2025. · Osiguranje za kuću · Isplata 418,76`
   - **Also changes (19)**, među njima: `Izbornik podtip: „Zabava": „Audible_Koka" → „Audible" · „Zabava": makni „Audible_Sasa" · …`,
     `grupiranje „Vrsta troška": par „Zabava / Audible" sažet u jedan redak`, `Sidra salda: 6 prate preimenovani račun`
   - **nema** crvenih grešaka ni žutih upozorenja (TEST nema dijeljenja ⇒ nema upozorenja o shortcutima)
   - gumb **Apply restructure** siv dok kvačica nije stavljena
4. Kvačica → **Apply restructure**. **Očekivano:** zeleno
   `✓ Applied · op xxxxxxxx · 9.743 changes · ~2–4 s` i
   `Re-measure: the database is exactly what the preview predicted ✓ (5.448 rows, 12 settings · ~7 s)`.
5. **Ne zatvaraj modal.** U **drugoj kartici** otvori app → Activities `Financije_all`, filtar
   `Filter by = Podtip`, `Audible`: **68** redaka (bilo 0); Overview: pločica salda ima red **`RF račun`**
   umjesto `Sašin tekući RF` (sidro je pošlo s njim — saldo **isti broj** kao prije).
6. Natrag u prvu karticu → **Undo**. **Očekivano:** `↺ Undone · 9.752 records restored · ~2–3 s` i
   `Re-measure: the database is exactly what it was before ✓ (5.448 rows, 12 settings …)`.
7. Druga kartica, F5: `Audible` = **0**, pločica opet `Sašin tekući RF`.

**Pad:** bilo koja brojka drukčija u koraku 3 (baza se promijenila — reci koja); `Re-measure` žut;
modal se zatvori sam; saldo se pomakne u koraku 5.
**Izvedeno 22.10. (Saša):** sve brojke po koraku točne; Apply **4,9 s** (provjera 13,6 s), Undo 9.752
zapisa 2,2 s (provjera 8,9 s). Saldo `RF račun` = `Sašin tekući RF` = **905,45 €** (sidro 11.10.,
povijest 6). Usput potvrđeno: košara za vrijeme primjene `VISA · ~05.11.` pod `RF račun` (ključ
`due.baskets` je pošao s preimenovanjem).
**Moje mjerenje (skripta, isti tok):** apply RPC 2,4 s i 4,4 s (dva puta), undo 1,9 s i 3,2 s;
`sha256` 11/12 tablica isto nakon dva ciklusa (12. je `attribute_definitions` +1 = `namjena`).

---

## T-S179-2 ✅ S179 (TEST, Saša) Greška u sheetu gasi Primijeni i ništa ne piše

1. Kopiraj `structure_s179.xlsx`, u sheetu `Preuređivanje` u koraku 1 stupac `postavi: podtip` upiši
   `Audible ` (**razmak na kraju**). Uvezi.
2. **Očekivano:** crveni okvir *„Errors — nothing can be applied…"* s retkom
   `✗ korak 1: vrijednost „Audible " za „podtip" ima vodeći/prateći razmak ili je prazna.`;
   **nema** kvačice ni gumba Apply.
3. Filtar `Podtip = Audible_Koka` i dalje **14** redaka.

**Pad:** gumb Apply postoji, ili se išta promijenilo.

---

## T-S179-3 ✅ S179 (TEST, Saša) Atribut `Namjena` u Add formi

1. Lokalni dev, Add Activity u `Financije_all > Transakcija`.
2. Prije Tipa: polje `Namjena` se **ne vidi** (ovisi o Tipu).
3. Tip = `Zabava` ⇒ `Namjena` se pojavi s **`Zajedničko`**, izbornik `Zajedničko · Koka · Saša · Kućište`.
4. Tip = `auto Lacetti` ⇒ `Saša`; Tip = `auto C5` ⇒ `Koka`.
5. Ništa ne spremaj (Discard).

**Pad:** polje se ne pojavi, nudi samo uz aute (lista nije u retku `*`), ili zadana vrijednost izostane.

---

## T-S179-4 ✅ S179 — čuva automatski test (E2E `S179_restructure_apply_undo`)

Vlastita Area, sheet s preimenovanjem `Stari S179 → Novi S179` iz Structure exporta: pregled 2 / 2,
bez kvačice nema primjene, Primijeni ⇒ „exactly what the preview predicted", izbornik
`[Novi S179, Drugo]` na istom mjestu, lista u drugoj kartici pokazuje novi naziv; Poništi ⇒ stari.
Protuprovjera: apply koji glumi uspjeh bez baze pada na izborniku (`izbornik: novi naziv na mjestu starog`).

---

## T-S179-5 ✅ S179 — izmjereno (`preuredjivanje_grep.py`)

`Tools\run.bat Tools\preuredjivanje_grep.py ..\Claude-temp_R\s179\structure_s179.xlsx` ⇒
**Jakih pogodaka: 71**, 80 fileova (bez `fix_*` i `Obsolete/`). Za korake koji idu na PROD (§8.2)
jaki su: `set_breakdown.py:92` (oba Audible), `:113` (Kuća/Osiguranje), `:125` (Projekti/Sasa),
`uvezi_transu.py:72`, `update_pravila_s107h.py:77–78`, `migrate_taksonomija.py:101`.
Ostalo (Visa → VISA, RF) su testni koraci kojih na PROD-u neće biti.

---

## T-S179-6 ⬜ (PROD, puštanje §16 — Saša pa Koka) Preuređivanje Financija na PROD-u

Naredbe: `NEXT_SESSION_PROMPT.md` § „PROD puštanje". Sheet s koracima iz §8.2 se slaže **zajedno**
(sljedeća sesija) — otvoreno: Nena (`Nena` ili „Nena / Kućište", Koka), Projekti/Sasa po trgovcu.

**Prije** (zapiši): saldo svakog računa na pločici · broj `N/A` (Filter by Tip = `N/A`) · Σ „Kamo ide
novac" This Year (Ušlo / Izašlo).
**Očekivano poslije:** saldo **nepomaknut** · `N/A` isti · Σ razreza isti osim izvedenog pomaka
(Anja 25.09. 450 € Transfer → Prihodi: Ušlo +450) · `Re-measure ✓` · `preuredjivanje_grep` jaki
pogoci ispravljeni istog dana. Prije `058`: `rls_probe.py --env prod` tri RPC probe `-`; poslije:
vlasnik DA · grantee NE · stranac NE · service DA. Na PROD-u se pojavi žuto upozorenje o
shortcutima (Area je dijeljena sa Sašom) — očekivano.
