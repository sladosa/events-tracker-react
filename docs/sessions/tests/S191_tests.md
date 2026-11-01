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

## T-S191-4 — View: slika u pregledniku slika, ne u novoj kartici

Saša (01.11., uz T-S190-4): u Viewu je dodir na sličicu otvarao **novu karticu preglednika** s golom datotekom iz
Storagea, dok Edit otvara preglednik slika. Sada View koristi isti `PhotoLightbox` kao Edit.

1. Ctrl+Shift+R. Katalog ⇒ View `lat_raises` (2 slike).
2. Dodir na prvu sličicu.
   - **Očekivano:** tamni preglednik preko ekrana, gore „1 / 2", dolje ime datoteke; nova kartica se NE otvara.
3. Strelica desno / povlačenje ulijevo (F12 mobilni prikaz) ⇒ „2 / 2"; Esc ili ✕ zatvara.
   - ⚠ 1. krug (01.11.) pao: povlačenje u pregledniku je mijenjalo i vježbu (Prev/Next stranice sluša cijeli
     dokument). Sada dodir koji počne u elementu s `data-no-page-swipe` (preglednik, traka slika) stranica ne broji.
   - **Očekivano:** povlačenje lista samo slike; vježba ispod ostaje ista dok preglednik ne zatvoriš. Povlačenje po
     Viewu bez preglednika i dalje radi Prev/Next.
4. **Next** na vježbu bez slika ⇒ nema preglednika ni Photos.
5. **Pad:** otvara se nova kartica; preglednik ostane otvoren nakon Next.

## T-S191-5 — „Slično“ u Editu postojeće vježbe gleda samo ime

Saša (01.11., T-S190-4, slika): Edit `lat_raises` nudio je krugovi_ruke, carry, leg_raises, calf_raises, kosa_k_side —
pogađale su riječi iz opisa („ispruzene", „uteg", „bocno"). Uz pravilo `unique: {from: name}` sličnost sada gleda samo
Slug i Name.

1. Ctrl+Shift+R. Katalog ⇒ Edit `lat_raises`.
   - **Očekivano:** „Slično u kategoriji“ = vježbe sličnog **imena** (leg_raises, calf_raises — „Podizanje …"), bez
     carry, kosa_k_side, krugovi_ruke.
2. ✕ bez spremanja.
3. **Pad:** popis i dalje prati riječi iz opisa.

## T-S191-6 — Slika sprave iz kartice (pravi mobitel)

Saša (01.11.): „zar ne bi bilo cool da slikam spravu u teretani direktno tu". Kartica „Uredi vježbu" sada ima
slike; sve tri plohe (Add, Edit, kartica) idu kroz `eventPhotos.ts`, koji grešku kaže umjesto da je proguta.
Automatski: E2E `S190_catalog_picker` (kartica) i `S191_event_photos` (Add, Edit) — ali kameru E2E ne glumi.

Mobitel: **NE dev server** — kad se otvori kamera, Android prekine vezu, a Vite po povratku ponovo učita stranicu
(kartica i Add nestanu, izmjereno S192). Zato build: `npm run build`, pa `npx vite preview --host --port 5173`
(build čita `.env.local` = TEST). Sašin račun, banner TEST. Kroz kućni Wi-Fi (`192.168.1.8`) mobitel ne dolazi
do laptopa — radi **hotspot laptopa**: mobitel na `LENOVO-IDEAPAD3 4454`, pa `http://192.168.137.1:5173`.

1. `S190 Trening proba › Gym` ⇒ **+** ⇒ „Izaberi vjezba…" ⇒ skupina ⇒ vježba ⇒ **Uredi vježbu**.
2. Ispod Descriptiona **Slike**: postojeće sličice + „Add".
3. „Add" ⇒ **Očekivano:** otvara se **stražnja** kamera (ili izbor kamera/galerija — ovisi o telefonu). Slikaj.
   Sličica s oznakom NEW.
4. **Spremi** ⇒ kartica: „Spremljeno u katalog.", nova slika u nizu slika.
5. Uredi vježbu ⇒ dodir na tu sličicu ⇒ ✕ ⇒ ✓ ⇒ **Spremi** ⇒ slike više nema. **Odustani** umjesto Spremi ⇒ slika ostaje.
6. Usput (regresija): Add zapisa s fotografijom u bilo kojoj Arei (prednja kamera, kao prije) ⇒ Finish ⇒ View
   pokazuje sliku; Edit ⇒ dodaj sliku iz galerije ⇒ Save ⇒ View je pokazuje.
7. **S192:** koraci 1–3 ✅; ✕ je bio nevidljiv na dodiru (`opacity-0 group-hover`) ⇒ sada vidljiv bez miša
   (`[@media(hover:hover)]:opacity-0`). Ponoviti 4–6.
8. **Pad:** slika se ne spremi a ništa ne piše; otvara se prednja kamera u kartici; ✕ se na dodir ne pojavljuje.
