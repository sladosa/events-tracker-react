# S171 — testovi (2026-10-14)

Filtar na uskom ekranu (Overview = samo razdoblje, Activities sklopljen sa sažetkom) i pločica
„Košare (otvorene)" s „ostaje" po računu.
Pregled: [PENDING_TESTS.md](../PENDING_TESTS.md#s171--filtar-na-mobitelu-i-pločica-košare-2026-10-14)

Brojke su izmjerene na TEST-u 14.10.2026. istim RPC-om koji pločica zove (`rpc_area_due_baskets`
s dalekim `as_of`, `rpc_area_balance_anchored` na danas, `Financije_all`). Ako je na TEST-u u
međuvremenu nešto upisano, brojke se pomaknu — tada vrijedi **račun** (stanje − košare redom), ne brojka.

Automatski: `S171_baskets_and_narrow_filter.spec.ts` (2/2; protuprovjera: bez rasklapanja na
fokus pada „pokaži kupnje"), `basketsView.test.mjs`, `filterSummary.test.mjs`.

## T-S171-1 Overview na mobitelu: samo red razdoblja (TEST, lokalno)

1. `npm run dev` (banner TEST), DevTools → uređaj iPhone (≤ 767 px), ili mobitel na lokalnoj mreži.
2. Area `Financije_all`, tab Overview.
3. **Očekivano:** gore samo red `📅 This Year · 01.01.–31.12.2026.` (strelica desno). Nema
   izbornika Area/kategorija ni shortcuta; traka i saldo odmah ispod.
4. Dodir na red ⇒ From / To / Period (bez ↓ Newest / ↑ Oldest i bez „Data range").
5. Period → `This Month` ⇒ red se **sam sklopi** i piše `This Month · 01.10.–31.10.2026.`;
   pločica razreza (ako je otvoriš) gleda listopad.
- **Pad:** puni filtar na Overviewu, ili red ostane otvoren nakon izbora.

## T-S171-2 Activities na mobitelu: sklopljen filtar kaže što je aktivno (TEST)

1. Nastavak: tab Activities.
2. **Očekivano:** filtar sklopljen, red `Filter  This Month · 01.10.–31.10.2026.`
3. Dodir ⇒ puni filtar; **Clear all** je unutra (desno gore), **ne** u zaglavlju uz strelicu.
4. Filter by → `Podtip` → `Kuća › Popravci, održavanje`, sklopi ⇒ red nosi i
   `· Podtip = Popravci, održavanje`.
5. Overview → saldo → ↗ uz račun ⇒ Activities: red nosi `Racun = Kokin tekući ZABA`
   (uvjet s drilla se vidi).
6. Široki ekran (≥ 768 px): filtar otvoren kao prije; sklopljen također pokazuje sažetak.
- **Pad:** sklopljen red piše samo „Filter", ili Clear all u zaglavlju.

## T-S171-3 Pločica „Košare": iznosi i „ostaje" (TEST)

1. Overview → dodir na **Košare (otvorene)** (saldo se sklopi).
2. **Očekivano** (14.10.):
   - `Kokin tekući ZABA · danas +10.057,27 €` (= broj na pločici salda za ZABA)
     - `Mastercard · 11.11. · 26 kupnji · −2.081,48 € · ostaje +7.975,79 €` (rasklopljena)
     - `11.12. · 16 · −434,05 · ostaje 7.541,74` · `11.01.27. · 7 · −264,31 · 7.277,43` ·
       `11.02.27. · −65,97 · 7.211,46` · `11.03.27. · −45,64 · 7.165,82` · `11.04.27. · −15,42 · 7.150,40`
   - `Sašin tekući RF · danas +878,09 €`
     - `Visa · ~05.11. · 7 kupnji · −188,42 · ostaje 689,67` · `~05.12. · −45,06 · 644,61` ·
       `~05.01.27. · −19,55 · 625,06` · `~05.02.27. · 605,51` · `~05.03.27. · 585,96`
   - Ispod: napomena „Plaće i ostale buduće uplate i isplate nisu uračunate".
3. **Prvo provjeri:** ZABA „danas" = iznos na pločici salda. Razlika = pločice ne gledaju isto.
- **Pad:** „ostaje" ne pada redom, Visa bez `~`, ili „danas" ≠ saldo.

## T-S171-4 Košara: kupnje i otvaranje retka (TEST)

1. U pločici Košare, rasklopljena MC 11.11.: **26** redaka, redom po datumu kupnje (najstarija gore),
   opis i iznos; dugi opis skraćen `…`, iznos uvijek vidljiv desno (nema vodoravnog scrolla).
2. Dodir na redak ⇒ View tog retka; Back ⇒ Overview, pločica Košare i dalje otvorena, MC 11.11.
   rasklopljena.
3. Dodir na `Visa · ~05.11.` ⇒ rasklopi se i ona (7 redaka), MC ostaje rasklopljena.
4. F5 ⇒ otvoren je saldo, Košare zatvorene (harmonika kao razrez).
- **Pad:** prazno / „Učitavam kupnje…" zauvijek, ili Back zatvori pločicu.

## T-S171-5 „pokaži kupnje" iz trake (PROD, uz prvu dospjelu košaru — ~11.11. MC)

1. Kad traka „Čeka potvrdu" pokaže MC košaru: ispod Σ dodir na **pokaži kupnje**.
2. **Očekivano:** otvori se pločica Košare na toj košari (rasklopljena, `dospjelo, čeka potvrdu`),
   s kupnjama koje čine Σ. Zbroj kupnji = Σ u traci.
3. Nakon „Potvrdi" u traci: košara nestane i iz pločice; ako je naplata upisana, a košara još
   otvorena (neusklađeno), piše `naplata upisana, već u stanju` i **ne** oduzima se od „ostaje".
- **Pad:** „ostaje" oduzme košaru čija je naplata već upisana (dvaput).
