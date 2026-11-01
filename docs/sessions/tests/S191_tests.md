# S191 — testovi: popravci uz testove koraka 5

Sve na **TEST-u** (`npm run dev`, banner TEST), Sašin račun, prvo **Ctrl+Shift+R**.

## T-S191-1 — View: dug tekst se prelama

Nađeno u T-S190-2 (01.11.): u Viewu je dug Description stajao desno u jednom retku (izlazio iz ekrana), a naziv
polja s opisom bio je stisnut u uski stupac. Uzrok: vrijednost je imala `shrink-0`.

1. Filter `Katalog vježbi › Vježba`, na mobitelu.
2. Otvori **View** vježbe `lat_raises` (opis iz T-S190-2, 2–3 rečenice).
   - **Očekivano:** ispod naziva „Description (…)" ide opis **preko cijele širine**, prelama se u više redaka; ako
     je u Editu upisan novi red, i u Viewu je novi red.
   - Name, Slug, Type, Group i dalje stoje **desno** od naziva, kao prije.
3. Isto u drugoj Arei s dugim tekstom (npr. `Financije_all`, redak s dugim `Izvod opis`).
4. **Pad:** opis izlazi izvan ekrana ili je u jednom retku; naziv polja stisnut u uski stupac.

## T-S191-2 — „Slično u kategoriji“ gleda samo slobodan tekst

Nađeno u T-S190-1 (01.11.): uz Type `Strength` i Group `Upper-pull` popis „slično“ je bio halo, bird_dog, squat,
leg_press, krugovi_ruke — riječi „Strength“ i „Upper“ iz izbornika poklapale su pola kataloga, a stvarno slična
`lat_raises` ispala je iz popisa od 5. Sada u sličnost ulaze samo Name, Slug i Description.

1. Ctrl+Shift+R. Katalog `› Vježba` ⇒ **+**.
2. Type `Strength`, Group `Upper-pull`, Name `Hand lateral raises`.
   - **Očekivano:** ispod Sluga „Slično u kategoriji:“ pokazuje `lat_raises · Lateralno podizanje ruku`, **ne**
     halo / bird_dog / squat / leg_press.
3. Promijeni Group u `Core`, pa Type u `Mobility`.
   - **Očekivano:** popis „slično“ se ne mijenja.
4. ✕ bez spremanja.
5. **Pad:** u popisu su vježbe koje dijele samo vrstu ili skupinu.

## T-S191-3 — View bez datuma za Areu bez vremena

Saša (01.11., uz T-S190-2): View kataloga je pokazivao `2026/10/31 09:55` i vrijeme nastanka uz Event #1 — datum
uvoza, bez značenja — dok ih Edit od S190 skriva. Sada isti uvjet (`isTimelessArea`, `src/lib/timelessArea.ts`)
vrijedi za oba.

1. Ctrl+Shift+R. Katalog `› Vježba` ⇒ View bilo koje vježbe.
   - **Očekivano:** ispod naslova nema retka s 📅 datumom; uz „Event #1“ nema datuma ni vremena.
2. **Next** / **Prev** kroz par vježbi ⇒ isto.
3. View retka u `Financije_all` (ili `Fitness_Garmin`).
   - **Očekivano:** datum i vrijeme se vide kao i prije.
4. **Pad:** katalog i dalje pokazuje datum; ili ga druga Area više ne pokazuje.
