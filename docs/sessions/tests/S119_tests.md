# S119 — detaljni testovi (uska lista: iznos prije ⋮)

**Kontekst:** Sašin nalaz s Androida (write grantee u `Financije_all`): lista se na uskom
ekranu morala **vući ustranu** da bi se vidio iznos, a Kokin iPhone je uži.

**Što je izmjereno prije popravka** (Playwright, prava aplikacija, viewport 393 px):
tablica **709 px** u **367 px** prostora ⇒ iznos i avatar 342 px izvan ekrana. Poslije:
**367 / 367, bez scrolla.** Snimke stanja: `Claude-temp_R/S119_lista_prije.png`,
`Claude-temp_R/S119_lista_poslije.png`.

**Uzrok** (za slučaj da se vrati): tablica s `table-layout: auto` naraste do
**min-content** širine sadržaja, a `truncate` nosi `white-space: nowrap` — pa se
„skraćeni" tekst nikad nije skratio nego je **rastegnuo tablicu**. Desktop ćelije to
nikad nisu pokazale jer nose `max-w-[140px]` / `max-w-[180px]`; mobilna nije nosila ništa.

**Preduvjeti:** `test-branch` build (`npm run build`), Area `Financije_all` s
`list_columns` koji uključuje kolonu `Račun` (upisano skriptom `set_list_columns.py`,
TEST je već upisan; **PROD nije** — v. T-S119-8 na dnu).

---

## T-S119-1 ⭐ Iznos vidljiv bez scrolanja

**Zašto:** to je cijeli razlog ovog posla — iznos je podatak zbog kojeg se u listu gleda.

1. Otvori app na mobitelu (Koka: iPhone; Saša: Android), Area `Financije_all`.
2. Filter neka bude na `All Categories` (širi slučaj od jednog leafa).
3. Pogledaj **prvi ekran liste, bez ijednog pomicanja ustranu**.

**Očekivano:** svaki redak u gornjoj liniji pokazuje **datum · račun · iznos**, a ⋮ je uz
desni rub. Lista se **ne pomiče ustranu** ni na jednom retku.

**Pad:** ako se lista i dalje vuče ustranu — javi na kojem retku i pošalji snimku; znači
da postoji sadržaj koji ni prelom ne stisne (npr. jedna vrlo duga riječ bez razmaka).

---

## T-S119-2 ⭐ Kratica računa

1. Isti ekran kao gore.
2. Pogledaj tekst između datuma i iznosa.

**Očekivano:** `ZABA` odnosno `RF` — **sitnije i sivo**, kao druga linija. Nikad
`Kokin tekući ZABA` u cijelosti.

**Pad koji NIJE bug:** ako se pojavi **puno ime**, to znači da vrijednost nema kratice u
rječniku (`map`). Tako je i zamišljeno — puno ime je vidljivo „nema kratice", a ne krivi
račun. Fix je dopisati kraticu u `set_list_columns.py` (`RACUN_MAP`) ili u koloni `Map`
`ListColumns` sheeta.

---

## T-S119-3 Dvostrani iznos ostaje cijel

**Redak:** ZABA `Anja 73/96`, **25.08.2025.** — nosi uplatu `450,00` **i** isplatu `0,70`
u istom eventu (vjeran spoj dvaju redaka izvoda, v. CLAUDE.md).

1. Filter → `From/To` na 25.08.2025., ili traži kroz `Filter by = Comment`, upit `Anja`.
2. Pogledaj taj redak na uskom ekranu.

**Očekivano:** **obje** strane vidljive, složene **jedna ispod druge** uz desni rub
(`+450,00 €` gore, `−0,70 €` dolje).

**Pad:** ako se vidi samo jedna strana — to je ozbiljno i javi odmah. Ćelija koja pokaže
jednu stranu skriva pola transakcije.

---

## T-S119-4 Opis se prelama, ne bježi ustranu

1. Nađi redak s dugačkim opisom (npr. `TROŠKOVI UČINJENI MASTERCARD KARTICOM`).

**Očekivano:** druga linija se **prelomi u dva reda**. Ako ni dva reda nisu dovoljna,
kraj dobije `…`. Vodoravnog scrolanja **nema**.

⚠ **Promjena navike:** dosad se kraj opisa čitao **povlačenjem ustranu**. Toga više nema —
umjesto njega tekst se prelama. Ako ti nedostaje puni tekst kod jako dugih opisa, javi:
alternativa je ⋮ → View Details.

---

## T-S119-5 Kratki datum i godina koja se sama pojavi

1. Pogledaj retke iz **ove** godine i skrolaj do retka iz **prošle**.

**Očekivano:**
- ovogodišnji: `25.08. ut` (dan, mjesec, dvoslovni dan u tjednu)
- prošlogodišnji: `25.08.25. po` — **godina se pojavi sama**

**Zašto tako:** puni datum je na uskom ekranu koštao ~50 px od ~270 px koliko linija ima,
a na istoj liniji mora stati iznos. Izbaciti godinu posve bilo bi jeftinije i pogrešno:
lista seže u 2025., a redak bez godine **tvrdi** da je iz ove.

**Pad:** dan u tjednu koji nije `po ut sr če pe su ne`, ili godina koja se pojavljuje i na
ovogodišnjim retcima.

---

## T-S119-6 ⭐ Excel roundtrip za kratice (`Map`)

**Zašto ⭐:** princip „sve ide importom". Konfiguracija koja ne preživi krug je rupa istog
razreda kao `export_profiles`.

1. Structure tab → Export (Area `Financije_all`).
2. Otvori `ListColumns` sheet. **Očekivano:** postoji kolona **`Map`**, a u retku
   `attr / racun` piše `Kokin tekući ZABA = ZABA | Sašin tekući RF = RF`.
3. Ne mijenjaj ništa → Import istog filea.
4. **Očekivano:** `ListColumns` javi uvezene kolone; lista i dalje pokazuje `ZABA` / `RF`.
5. Sada u sheetu **obriši** sadržaj ćelije `Map` za taj redak i uvezi ponovno.
6. **Očekivano:** lista pokazuje **puno ime računa** (kratice više nema) — dokaz da kolona
   stvarno upravlja prikazom, a ne da je slučajno preživjela u bazi.
7. Vrati kraticu (ponovi korak 1–4) ili pokreni `python set_list_columns.py --write`.

**Pad:** ako korak 6 i dalje pokazuje `ZABA`, import ne briše — a `ListColumns` **mora**
brisati ono čega u sheetu nema (za razliku od `Automations`).

---

## T-S119-7 Desktop lista nepromijenjena

1. Otvori istu listu na računalu (širina > 640 px).

**Očekivano:** sve po starom — **puni datum** (`2026/08/25 uto`), kolone jedna do druge,
`Stanje` vidljivo, `Račun` kao svoja kolona s kraticom, dvostrani iznos **u jednom retku**
(`+450,00 € · −0,70 €`), ⋮ zalijepljen desno.

**Pad:** kratki datum na desktopu, ili iznos složen u dva reda — obje promjene smiju
postojati **samo** ispod 640 px.

---

## T-S119-8 (za kasnije) PROD još nema kolonu `Račun`

TEST je upisan u ovoj sesiji. **PROD nije** — Area je Kokina, a promjena traži i deploy
koda. Kad deploy prođe, dvije mogućnosti:

```
# izravno (traži .env.prod.local i njen area id)
python data-prep_tools/Financije/set_list_columns.py --env prod \
       --area de8662e6-54f7-4ded-ab42-a786e7456067 --show     # pa --write

# ili kroz Structure Excel (ListColumns sheet, kolona Map) — put „sve ide importom"
```

⚠ Prije Structure importa na PROD: **hard refresh (Ctrl+Shift+R)**. Stari keširani bundle
je u S118 tiho progutao pola configa i javio uspjeh.
