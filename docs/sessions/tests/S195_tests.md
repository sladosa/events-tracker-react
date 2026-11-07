# S195 — testovi (2026-11-07)

`krug` (T4, `docs/KRUG_SPEC.md`) — jedna naredba za mjesečni krug: razvrstač → svi izvodi u korijenu
`izvodi\` → stanje iz baze → jedan Excel za uvoz (odluke u stupcu `Delete?`) + izvještaj na hrvatskom;
sidro ZABA/RF iz izvoda upisuje sam. Izmjereno na TEST-u od početka do kraja (T-S195-5). Ovdje su provjere
u **prosinačkom krugu** (prvi PROD prolaz) — bez posebnog sjedenja.

Regresija alata (S195 korak 1–3, izvlačenje logike u funkcije): `Claude-temp_R/s195/regresija.py` (14 slučajeva,
ispis i fileovi identični prije/poslije), `grane.py` (sabotaža pada 3), `krug_proba.py` (scenariji u memoriji).

---

## T-S195-1 ⬜ Probni prolaz na PROD-u (`--suho`)

**Preduvjet:** stigao barem jedan izvod za studeni (MC ~02.12.), Kokina OneDrive mapa sinkronizirana.

1. U Exploreru: `data-prep_tools\Financije\krug.bat` — ali iz PowerShella s argumentom:
   `cd C:\0_Sasa\events-tracker-react\data-prep_tools\Financije` pa `.\krug.bat --suho`
2. **Očekivano:** prvi redak `[PROD] Mjesečni krug (--suho …)`; razvrstač javi nove izvode (ili „ništa novo");
   izvještaj se otvori sam iz `data-prep_data\Financije\krug_lokalno\` (NE iz OneDrivea); uz svaki izvod
   stanje (✓ / → / ⏳ / ✗) i rečenica.
3. Provjeri da ništa nije upisano: u `OneDrive\Izvodi\Za uvoz` nema novog filea; izvodi su i dalje u korijenu
   `izvodi\`; na pločici nema novog sidra.

**Pad:** zaglavlje `[TEST]` (krug.bat ne postavlja ET_TARGET); file u Kokinoj mapi uz `--suho`; Python greška.

## T-S195-2 ⬜ Pravi krug + Kokin uvoz

**Preduvjet:** T-S195-1 bez iznenađenja.

1. `.\krug.bat` (bez `--suho`) ⇒ u `OneDrive\Izvodi\Za uvoz` nastanu `krug_<datum>_<HHMM>.xlsx` i `.html`.
2. Izvještaj, odjeljak „1. Za uvoz": zapiši **OČEKIVANO** (`N New · M Modify · 0 Delete`) i broj odluka.
3. Koka otvori file (stupac `Napomena`; redci „ODLUČI" su na vrhu svakog izvoda), za svaku odluku bira
   DELETE ili ostavlja prazno, uveze u appu (Ctrl+Shift+R prije).
4. **Očekivano:** pregled uvoza = OČEKIVANO, Delete = broj odabranih DELETE; „Trajanje" na kraju.

**Pad:** druge brojke u pregledu ⇒ NE uvoziti, javiti (stari bundle / krivi file / kvar `krug`a).

## T-S195-3 ⬜ Drugi krug poslije uvoza

1. `.\krug.bat` ponovo.
2. **Očekivano:** obrađeni izvodi `✓ GOTOVO`, „za uvoz 0 New · 0 Modify"; gotovi izvodi premješteni u
   `Analizirani_izvodi\`; ZABA (kad stigne): „sidro UPISANO" — na pločici sidro s bilješkom
   `ispisano stanje s izvoda · ZABA_2026-11.pdf`, saldo = banka.
3. Treći put ⇒ ništa novo, **nijedno drugo sidro**.

**Pad:** isti izvod opet „→ excel" s istim retcima (uvoz nije prošao ili `krug` ne vidi žig).

## T-S195-4 ⬜ Visa prije i poslije plaćanja (K7)

1. Izvod Vise stigao, a Saša još nije platio ⇒ `krug`: Visa `⏳ ČEKA` „Saša plati X („Novi saldo") do …",
   **Visa redaka nema u fileu**.
2. Saša plati, Koka u traci (Visa → „Ne — iznos ili dan…" → iznos s izvoda) ⇒ `krug` ponovo ⇒ Visa u fileu,
   „naplata DD.MM. · Σ … ✓ u cent".

**Pad:** Visa u fileu prije plaćanja; ili `✗ STANI` iako je u traci upisan točan iznos.

## T-S195-5 ✅ Studeni na TEST-u, od početka do kraja (izmjereno S195)

Backup TEST `_backup/test/2026-11-07_1205`. TEST je za MC/Visu stanje prije studenog kruga (MC košara 11.11.
0 žigova), ali manje potpun od PROD-a (11 ZABA i 11 MC redaka više nego u S192 — brojke su zato ove, ne S192).

| korak | rezultat |
| --- | --- |
| `krug --suho` | Visa `✗ STANI`: na RF-u 1.349,52 (ostatak T48 testa), izvod 1.751,12 — poruka kaže što napraviti u appu |
| glumljena traka (`gluma_traka.py`, 1 redak 1.349,52 → 1.751,12) | — |
| `krug` | MC 11 New · 43 Modify, Visa 12 · 30 · 1 odluka (3,80), ZABA 11 · 0; veze: Youtube 9,55 ZABA → MC, Studenac 11,75 MC → Visa (izmjena istog retka); MC „poslije veza Σ 2.783,26 ✓", ZABA „poslije uvoza ✓ u cent". File: **34 New · 73 Modify** (+1 odluka) |
| odluka glumljena: DELETE za 3,80 | pravi parser uvoza: 34 / 73 / 1, 0 grešaka |
| **uvoz kroz app** (Sašin TEST račun) | pregled **34 New · 73 Modify · 1 Delete**; „Import successful", 34 · 73 · 1, **25 s** |
| drugi `krug` | MC ✓ (Σ 2.783,26, čeka traku 11.11.), Visa ✓ (42 stavke, naplata 05.11.), ZABA ✓ promet −1.049,76 u cent ⇒ saldo 10.664,71 = izvod ⇒ **sidro UPISANO** 01.11. |
| treći `krug` | 3/3 gotovo, 0 · 0, sidara 26 (nijedno novo) |

Usput: pregled uvoza je za MC ratu prikazao „Rate?: true → true" (alat piše `Rate?` i kad je već `true`) — redak
se broji u Modify, a promjene nema. Šum, ne kvar (FINANCIJE_PROCES §5).
