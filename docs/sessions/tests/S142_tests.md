# S142 — detalji testova (2026-09-19)

> **`DELTA_WINDOW_SPEC` faze 1 i 2.** Sidro je prestalo biti **rez** i postalo **oznaka**:
> prozor delta sheeta mjeri se sidrima umjesto danima, a retci koji su već unutar potvrđenog
> stanja dobili su kolonu i sivi ton.
>
> ⚠ **Zaštita je OZNAKA, ne brana** — update-guard na uvozu je faza 4 i nje još nema.
>
> Skripte kojima je mjereno: `Claude-temp_R/_probes/faza1_otvarajuce_stanje.py` (read-only,
> PROD), `demo_delta.mjs` (generira primjerak filea), `check_demo2.mjs` (čita ga natrag).
> Sabotaže: `sabotage.py`, `sabotage2.py` u scratchpadu.

---

## Što je zatvoreno AUTOMATSKI — ne traži Sašinu ruku

| što | čime | opseg |
| --- | --- | --- |
| izbor prozora (K, clamp, fallback, sort sidara) | `deltaWindow.test.mjs` | 25 tvrdnji, **3 sabotaže** |
| kolona `Potvrda`, tonovi, autofilter | `deltaSheetLayout.test.mjs` | 37 → **49** tvrdnji, **5 sabotaža** |
| nova kolona ne kvari **uvoz** | `importForeignRows.test.mjs` | 27 tvrdnji, delta file sada nosi kolonu |
| otvarajuće stanje = iznos sidra **u cent** | `_probes/faza1_otvarajuce_stanje.py` | PROD, 6 provjera / 6 prolaza |

⚠ **Protuprovjera je dio dokaza, ne formalnost** (pravilo S120). Osam sabotaža ukupno; svaka
obori barem jednu tvrdnju. Bez toga se ne zna razlikuje li test ispravan kod od pokvarenog.

---

## T-S141-4 — ⬜ ostaje uzivo; ✅ RPC razina dokazana na PROD-u

**Tvrdnja:** kad prozor kreće dan poslije sidra, otvarajuće stanje je **sam iznos sidra**,
bez ijednog dijela izračuna.

`Tools` nije trebao: `ET_TARGET=prod python Claude-temp_R/_probes/faza1_otvarajuce_stanje.py`

| račun | K | sidro | RPC saldo na dan sidra | n | razlika |
| --- | ---: | --- | ---: | ---: | ---: |
| Kokin tekući ZABA | 0 | 06.09. `12.772,86` | `12.772,86` | 0 | `0,00` |
| Kokin tekući ZABA | **1** | 30.07. `13.815,33` | **`13.815,33`** | 0 | `0,00` |
| Kokin tekući ZABA | 2 | 01.01.2025. `3.054,41` | `3.054,41` | 0 | `0,00` |
| Sašin tekući RF | 0 | 07.09. `690,79` | `690,79` | 0 | `0,00` |
| Sašin tekući RF | **1** | 11.08. `799,12` | **`799,12`** | 0 | `0,00` |
| Sašin tekući RF | 2 | 31.12.2022. `12.712,28` | `12.712,28` | 0 | `0,00` |

⚠ **`n = 0` je ono što ovaj test zapravo dokazuje**, ne sama brojka: nula zapisa poslije sidra
znači da se ništa nije *zbrajalo*. Da RPC bira drugo sidro ili da pravilo „strogo nakon" ne
vrijedi kako je zapisano, `n` bi bio veći, a iznos bi se razišao.

⚠ **Ostaje neprovjereno uživo** — da modal doista proslijedi baš taj `asOf`. To je **T-S142-1**.

---

## T-S142-1 — ⬜ Faza 1 uživo: prozor kreće dan poslije predzadnje potvrde

**Preduvjet:** `npm run dev:prod` (⚠ provjeri banner — TEST nema ova sidra).

1. Overview → klikni saldo **Kokin tekući ZABA** (time se postavi filtar računa).
2. Activities → **Excel Export** → kvačica **Delta sheet**.
3. Polje **Prozor** mora stajati na **1** i pisati „sidara unatrag".

**Očekivano u panelu:**
`Od 31.07.2026. (5x dana) · počiva na potvrdi 30.07.2026. = 13.815,33 · u prozoru je još jedna potvrda`

⚠ Broj dana raste svakim danom (19.09. je bio **51**) — ne uspoređuj ga s brojkom iz ovog
dokumenta, nego provjeri da **datum** stoji na `31.07.2026.`

4. Download → otvori file → ćelija uz `stanje 30.07.2026. ->`

**Očekivano:** **`13.815,33`**, u cent. Bilješka na toj ćeliji mora glasiti
*„Potvrđeno stanje na 30.07.2026. … **Nije izračunato** — prozor kreće dan poslije te potvrde"*.

**Pad:** bilo koji drugi iznos, ili bilješka koja govori *„Izračunato iz aplikacije… plus sve
promjene"*. To drugo znači da prozor **ne** kreće na dan sidra — dakle faza 1 ne radi, iako
file izgleda uredno.

⚠ **Usporedi i broj redaka sa starim ponašanjem:** postavi Prozor na **0**, pa opet na **1**.
Uz 0 prozor kreće 07.09. (izmjereno: **12 dana / 18 `Racun` redaka**), uz 1 od 31.07. — i
upravo je tih ~47 redaka ono što je dosad **tiho nestajalo**.

---

## T-S142-2 — ⬜ Kolona `Potvrda` i sivi ton u stvarnom fileu

U fileu iz T-S142-1:

1. Nađi kolonu **`Potvrda`** — desno od `Stanje (kontrola)`.
2. Retci datirani **do 06.09.** moraju nositi oznaku tipa
   `potvrđeno 06.09. · ekran bankovne aplikacije` i biti **sivo osjenčani**.
3. Retci **poslije 06.09.** moraju imati **praznu** ćeliju i običnu boju.

**Pad:** oznaka na retku poslije zadnje potvrde (pomak od jednog dana — `<=` protiv `<`), ili
oznaka koja nosi **punu** bilješku od 90 znakova umjesto kratkog oblika.

4. **Klikni na zaglavlje `Potvrda`** — mora iskočiti objašnjenje (input message), ne bilješka.

---

## T-S142-3 — ⬜ Oznaka je živa, ne zamrznuta

Ovo mjeri ono zbog čega je kolona **formula**, a ne upisan tekst.

1. U fileu iz T-S142-1 uzmi redak koji **nosi** oznaku (datum prije 06.09.).
2. Promijeni mu datum na **danas**.

**Očekivano:** oznaka **nestane istog trena**, a sivi ton s njom.

3. Vrati datum natrag → oznaka se vrati.

**Pad:** oznaka ostane. Tada sheet tvrdi „potvrđeno" za redak koji je izmaknut iz potvrđenog
razdoblja — a upozorenje koje laže korisnik nauči otklikati bez čitanja.

---

## T-S142-4 — ⬜ Prazni retci: topao ton i oznaka na unos u prošlost

1. Prazni retci za unos moraju biti u **toplom (žućkastom)** tonu — vidljivo različitom od
   **sivog** kojim su označeni potvrđeni retci.
2. U prvi prazan redak upiši datum **prije 06.09.** (npr. `20.08.2026.`).

**Očekivano:** u koloni `Potvrda` **odmah iskoči** oznaka, a redak posivi.

⚠ **Ovo je glavna korist cijele faze 2**, ne rubni slučaj: to je jedini trenutak u kojem se
unos u već potvrđeno razdoblje može uhvatiti **prije** uvoza.

3. Obriši taj datum → oznaka nestane, topao ton ostane.

---

## T-S142-5 — ⬜ Sort ne rasparuje kolonu

1. U fileu klikni autofilter na koloni **`Datum`** → sortiraj **silazno**.

**Očekivano:** oznaka `potvrđeno …` putuje **sa svojim retkom**; sivi ton prati datum.

**Pad:** oznake ostanu na starim mjestima ⇒ kolona je izvan `auto_filter.ref`. Korisnik sortira
**čim doda stariji datum**, pa ovo nije rubni slučaj nego glavni tok.

---

## T-S142-6 — ⬜ Rupe među sidrima: panel upozori PRIJE izvoza

1. U Export modalu postavi **Prozor = 2**.

**Očekivano:** panel ispiše raspon od **01.01.2025.** i **~625 dana**, te brojku događaja
označenu kao **„do N"**; preko **200** brojka pocrveni uz *„file će biti velik"*.

2. Postavi **Prozor = 9** (ZABA ima 16 sidara, RF samo 3).

**Očekivano (na RF-u):** *„Račun ima samo 3 potvrde — prozor kreće od najstarije."*

⚠ **Ne izvozi** s K = 2 na ZABA-i osim ako baš želiš file od tisuća redaka — svrha testa je da
**brojka dođe prije filea**, ne poslije.

---

## T-S142-7 — ⬜ ⚠ Roundtrip na PROD-u: uvoz delta filea s novom kolonom

**Ovo je jedini test koji PIŠE u bazu** — Sašina ruka, ne moja.

⚠ Automatski je pokriveno da parser file **čita** (`importForeignRows.test.mjs`: sekcija se
čita, 40 praznih redaka ne postaje 40 grešaka, `row_hash` skip radi, i to nad fileom koji
**nosi** kolonu `Potvrda`). Neprovjereno ostaje samo stvarni uvoz na PROD-u.

1. U delta fileu iz T-S142-1 promijeni **jedan** redak (npr. dopuni `comment`).
2. Activities → **Excel Import** → taj file.

**Očekivano:** preview pokaže **1 Modify**; kolone `Potvrda` i `Stanje (kontrola)` ne proizvode
ni grešku ni dodatni redak.

**Pad koji treba tražiti:** bilo kakva poruka o nepoznatoj koloni, ili broj izmjena veći od 1.

---

## T-S142-8 — ✅ Izbor prozora (`pickDeltaWindow`)

`node src/lib/__tests__/deltaWindow.test.mjs` — **25 tvrdnji**: K = 0/1/2, clamp preko broja
sidara, fallback bez ijednog sidra, tudji racun, sidro u buducnosti, dva zapisa istog dana.

⚠ **Protuprovjera (3 sabotaze):** `idx = 0` (staro ponasanje) obori **12** tvrdnji, prozor
na dan sidra **5**, sort bez `created_at` **1**. Test koji ne padne ni na jednu ne cuva nista.

⚠ Prva verzija testa tvrdila je **626 dana** za K = 2 i **pala** — brojka pisana rukom protiv
koda koji racuna. Tocno je **625**, provjereno neovisno. Dakle test je prvo uhvatio *mene*.

---

## T-S142-9 — ✅ Kolona, tonovi, autofilter (`deltaSheetLayout`)

`node src/lib/__tests__/deltaSheetLayout.test.mjs` — **37 → 49 tvrdnji**.

Novo: kolona postoji desno od kontrolnog stupca · oznaka je **formula** · formula gleda datum
retka i dan sidra · tekst je **kratki oblik** (ime izvoda), ne puna biljeska · formula stoji
**i na praznim retcima** · prazan datum daje praznu oznaku · kolona je **unutar autofiltera** ·
prazni retci nose topao ton **razlicit** od sivog · bez sidra u prozoru kolone **nema**.

⚠ **Protuprovjera (5 sabotaza):** izvan autofiltera · upisan tekst umjesto formule · puna
biljeska · preskoceni prazni retci · bez blagog tona — **sve obore test**.

⚠ Usput popravljeno **dvoje u samom testu**: tvrdnja o `Provjeri` bila je vezana na `ctrl + 1`
i pala na **legitiman** pomak (hardkodiran indeks ne razlikuje *„pomaknuto"* od *„pokvareno"* —
sada se kolona trazi po naslovu); i `ws.autoFilter` se nakon `xlsx.load` cita kao **string** ref,
ne kao objekt `{from,to}` kakav se upisuje.

---

## T-S142-10 — ✅ Otvarajuce stanje je iznos sidra, u cent

V. tablicu pod **T-S141-4** — isti pokus: 6 provjera, 6 prolaza, `n = 0` posvuda.

---

## Što je SVJESNO ostavljeno otvoreno

| | |
| --- | --- |
| **faza 3** — kontrolne točke u zaglavlju, po jedna za svako sidro u prozoru | nije rađena |
| **faza 4** — update-guard na uvozu (**jedina prava brana**) | nije rađena |
| ton sivog/toplog — pojačava se tek ako se pokaže da se previdi | Sašina odluka S141 |

⚠ **Dok faza 4 ne postoji, uvoz prihvaća izmjenu potvrđenog retka bez pitanja.** Kolona i ton
to samo **kažu**. Ako se u međuvremenu pokaže da je to premalo, red je faza 4, ne jača boja.
