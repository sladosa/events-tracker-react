# S190 — testovi: katalog vježbi i izbor vježbe (korak 5)

Sve na **TEST-u** (`npm run dev`, banner TEST), pod **Sašinim** računom (`sasasladoljev59@gmail.com`).
Prije prvog testa: **Ctrl+Shift+R** (stari bundle je već jednom tiho osakatio feature, S118).

Podaci na TEST-u (S190):
- Area **`Katalog vježbi`** (56 vježbi, alat `katalog.py`): Slug jedinstven i predlaže se iz imena, bez štoperice, datuma i Event Note.
- Area **`S190 Trening proba`** › `Gym`: polje `vjezba` bira iz kataloga (`OptionsFrom`), uz `kg` i `ponavljanja`. Treninga u njoj još nema, pa je redoslijed u skupini zasad abecedni i uz skupine piše „nije u 12 mj".

---

## T-S190-1 — Nova vježba u katalogu

1. Filter: `Katalog vježbi › Vježba` ⇒ **Add Activity**.
2. Zaglavlje nema štoperice ni datuma; ispod polja **nema Event Note**.
3. U **Name** upiši `Hand lateral raises`.
   - **Očekivano:** Slug se sam popuni s `hand_lateral`; ispod Sluga piše „Slično u kategoriji:" i među njima `lat_raises · Lateralno podizanje ruku`.
4. U **Slug** upiši `lat_raises`.
   - **Očekivano:** crvena poruka „„lat_raises" već postoji: …".
5. Klikni **Finish**.
   - **Očekivano:** poruka „Slug „lat_raises" već postoji — izaberi drugu vrijednost.", ostaješ u formi.
6. Slug promijeni u `hand_lat_test`, pa **Finish** ⇒ vježba je spremljena.
7. **Pad:** slug se ne predlaže; nema „slično"; Finish sprema duplikat; vidi se Event Note ili datum.
8. Poslije testa vježbu `hand_lat_test` (i tvoju staru `test`) obriši kroz ⋮ → Delete.

## T-S190-2 — Edit vježbe bez vremena; opis raste

1. U listi kataloga ⋮ → **Edit** na `lat_raises`.
2. **Očekivano:** u zaglavlju nema datuma, vremena ni Duration; uz „Event #1" nema vremena nastanka; nema Event Note.
3. U **Description** napiši dulji tekst (2–3 rečenice).
   - **Očekivano:** polje se širi u nove retke dok pišeš; ništa se ne skriva iza ruba.
4. **Save** ⇒ View pokazuje novi opis.
5. Usput: u bilo kojoj drugoj Arei (npr. `Financije_all`) dugačak tekst u tekstualnom polju isto raste. **Pad:** polje ostaje u jednom retku.

## T-S190-3 — Izbor vježbe iz kataloga (mobitel i laptop)

1. Filter: `S190 Trening proba › Gym` ⇒ **Add Activity**.
2. Dodir na **„Izaberi vjezba…"** ⇒ prozor sa skupinama (Upper-push, Upper-pull, Core, Legs-main…, „Bez skupine" na kraju).
3. Dodir na **Upper-push** ⇒ najviše 6 vježbi + gumb **„Sve (N)"**; „Sve" pokaže ostale.
4. Dodir na vježbu ⇒ **kartica** (opis, skupine, vrsta); polje u formi se još **NE** mijenja.
5. **Natrag** ⇒ popis; druga vježba ⇒ **Izaberi** ⇒ prozor se zatvori, polje pokazuje ime vježbe.
6. Ponovno otvori izbornik ⇒ otvorena je **skupina izabrane vježbe**, a ona je plavo označena.
7. U kartici **Uredi vježbu** ⇒ promijeni **Group** (npr. Upper-push → Core) ⇒ **Spremi**.
   - **Očekivano:** kartica kaže „Spremljeno u katalog."; **Natrag** ⇒ otvorena je skupina **Core** i vježba je u njoj sa zelenom crtom lijevo. Vrati skupinu natrag istim putem.
8. Upiši kg i ponavljanja ⇒ **Finish**. U listi treninga redak pokazuje slug (npr. `lat_raises`).
9. Ponovi Add: otvori izbornik ⇒ ta vježba ima „1× u 12 mj", a skupina „zadnje danas".
10. **Pad:** dodir odmah bira (bez kartice); poslije uređivanja vježba ostane u staroj skupini; „Izaberi vjezba…" stoji zauvijek na „Učitavam katalog…"; crvena poruka ispod polja.

## T-S190-4 — Slike vježbe: kartica i lista (mobitel)

1. U katalogu ⋮ → **Edit** na vježbi ⇒ dodaj **2 slike** (bilo koje s mobitela) ⇒ Save.
2. Lista kataloga: na retku te vježbe **📷 2** ⇒ dodir ⇒ ispod retka traka sa slikom; **povlačenje lijevo** ⇒ druga slika („2 / 2"); 📷 opet ⇒ traka se zatvori.
3. Isto na laptopu: strelice **‹ ›** na samoj slici.
4. `S190 Trening proba` ⇒ Add ⇒ izbornik: ta vježba ima **sličicu** (s brojem 2); kartica pokazuje slike, listaju se povlačenjem.
5. **Pad:** nema 📷 na retku; traka se zatvori sama nakon sekunde; povlačenje ne mijenja sliku.

## T-S190-5 — Structure roundtrip novih kolona

1. Filter `Katalog vježbi` ⇒ Structure ⇒ **Export**.
2. U fileu (grupirani stupci na kraju): Area redak **AddNote = FALSE**; atribut **Slug**: **Unique = `from: name`**.
3. Isto za `S190 Trening proba`: atribut `vjezba` ima **OptionsFrom = `Katalog vježbi > Vježba : slug | label: name | group: group | group2: secondary`**.
4. Uvezi nepromijenjen file ⇒ uvoz kaže da se **ništa nije promijenilo** (Attributes updated 0).
5. **Pad:** kolona prazna; uvoz javlja promjenu atributa koje nisu dirane; poslije uvoza slug se više ne predlaže.
