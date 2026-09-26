# Rules Engine — spec

> Status: **prijedlog, prije koda.** Nastalo u S121 (2026-08-28) iz Sašinog zahtjeva:
> pravila razvrstavanja žive u Review Excelu, a trebaju živjeti **u bazi, uz Areu**, i biti
> čitljiva i Python alatima i AI slojevima (Haiku Help). Ovaj file postoji da se odluke ne
> izgube ako sesije budu kratke — ne opisuje ništa što je već izvedeno.

---

# DIO 1 — Jednostavnim rječnikom

## Zašto uopće

Danas pravila za `Tip`/`Podtip` žive u `Pravila` sheetu Review workbooka. To ima tri problema:

1. **Vezana su za jedan file**, ne za Areu — a uskoro dolaze razvrstavanja treninga i
   privatnih komentara, koja s Financijama nemaju veze.
2. **Samo ih Python vidi.** Aplikacija ne zna da postoje, uvoz ih ne primjenjuje,
   Haiku Help ne može objasniti korisniku po čemu je nešto razvrstano.
3. **Redoslijed odlučuje ishod** — što je Saša prepoznao kao opasno prije nego je itko
   izmjerio koliko. Sada je izmjereno.

## Što je izmjereno (28.08.2026, 71 pravilo nad 4.992 retka)

| | |
| --- | --- |
| redaka koje pogodi barem jedno pravilo | 1.633 |
| **redaka gdje redoslijed odlučuje** (≥2 pravila) | **79 — 4,8 %** |
| od toga se pravila stvarno **ne slažu** u ishodu | **71** |

⚠ Prva mjera je dala 13,3 % jer nije primijenila `Iznos min/max` — a to je upravo
mehanizam koji većinu preklapanja razdvaja. Poštena brojka je 4,8 %, i **više od pola su
dva poznata para**: `UPLATA ANJA CRNKOVIĆ` (28 redaka) i `prime video` vs `VIDEO` (26).

**Ali veći problem nije redoslijed nego podniz.** Deset pravila ima ključ od ≤5 znakova, a
traži se goli podniz bez granice riječi:

```
'REG' → auto C5/registracija     pogađa 21 redak gdje je 'reg' dio veće riječi:
                                   'regres za godišnji'
                                   'taxi 1717 registracija'   ← taksi kao registracija auta
                                   'MACGREGORCROATIA D.O.O.'
'HRANA' → Domaćinstvo/Hrana       pogađa 'sasa prehrana' (5 redaka)
```

Razlika je bitna: **redoslijed barem imaš gdje vidjeti** — pravila su nabrojana, možeš ih
premjestiti. Podniz koji pogodi krivu riječ ne ostavlja **nikakav** trag, a rezultat izgleda
uvjerljivo. Zato novi sustav ne smije biti „isti Excel, samo u bazi".

## Tri odluke

### 1. Konflikt se PRIJAVLJUJE, ne rješava položajem

Ovo je jezgra i ono što gasi Sašinu bojazan.

- **Danas:** čita se odozgo, **prvi match pobjeđuje**, ostali se tiho ignoriraju.
- **Ubuduće:** skupe se **sva** pravila koja pogađaju redak.
  - Slažu li se u ishodu → upiši, gotovo.
  - **Ne slažu li se → redak se NE dira**, nego ide u `Za odluku`, s popisom pravila koja
    se svađaju.

Onih 148 redaka bi tada isplivalo umjesto da ih tiho odluči pozicija. Redoslijed prestaje
biti semantika i postaje samo redoslijed ispisa — dakle korisnik ga više ne mora razumjeti
da bi kontrolirao ishod. To je cijela poanta.

⚠ **Posljedica koju treba prihvatiti:** prvi run nad postojećim pravilima **razvrstat će
manje redaka nego danas**, jer će 71 redak umjesto tihe odluke tražiti čovjeka. To nije
regresija nego naplata duga koji je dosad bio nevidljiv.

### 2. Match mora reći koliko je strog

```
rijec:REG      granica riječi — ZADANO
sadrzi:REG     današnje ponašanje, mora se izričito tražiti
regex:...      za rijetke slučajeve
```

Sama ta promjena briše `regres`, `registracija`, `MACGREGOR` i `prehrana` — bez ijednog
novog pravila.

### 3. Ne izmišljamo rječnik — app ga već ima, dvaput

Pravilo je spoj dviju stvari koje u aplikaciji već postoje:

```
uvjeti  →  isti oblik kao dashboard.filters          { slug, op, values }
akcije  →  isti oblik kao automations.attribute_rules (set_attribute)
```

Zato isti zapis mogu čitati **i** Python alati, **i** uvoz, **i** Add Activity, **i** Haiku —
nitko ne uči nov jezik. I odmah se generalizira na treninge i privatne komentare: mijenjaju
se samo slugovi u uvjetima, ne mehanizam.

## Što korisnik vidi

- **Structure → Rules** (ili zasad samo Excel sheet): popis pravila po Arei.
- Nakon primjene: koliko je redaka razvrstano, koliko **čeka odluku**, i za svaki takav —
  koja se pravila svađaju.
- U Helpu: Haiku može odgovoriti „zašto je ovo razvrstano ovako" jer pravila čita iz baze.

---

# DIO 2 — Tehnički

## Model

```sql
create table rules (
  id            uuid primary key default gen_random_uuid(),
  area_id       uuid not null references areas(id) on delete cascade,
  category_id   uuid references categories(id) on delete cascade,   -- opcionalno suženje
  user_id       uuid not null,
  name          text not null,          -- ljudska oznaka, ide u trag ("pravilo: Konzum")
  enabled       boolean not null default true,
  sort_order    int not null default 0, -- SAMO redoslijed ispisa, NIKAD semantika
  conditions    jsonb not null default '[]'::jsonb,
  actions       jsonb not null default '[]'::jsonb,
  note          text,                   -- za čovjeka, ne ulazi u podatke
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on rules (area_id) where enabled;
```

⚠ `sort_order` postoji **samo** da popis ima stabilan redoslijed u Excelu i UI-ju.
Ako ikad počne odlučivati ishod, odluka 1 je prekršena.

## Oblik `conditions`

Isti rječnik kao `dashboard.filters`, proširen tekstualnim operatorima:

```jsonc
[
  { "slug": "*text",          "op": "word",   "values": ["konzum"] },
  { "slug": "izvorplacanja",  "op": "in",     "values": ["Racun"] },
  { "slug": "isplata",        "op": "between","values": [10, 40] }
]
```

- Svi uvjeti su **AND**-ani. `OR` = drugo pravilo (kao danas).
- `values` s više elemenata unutar jednog uvjeta je **OR** unutar tog uvjeta.
- **`*text`** je pseudo-slug: „tekst po kojem se traži". Što je taj tekst, definira
  **potrošač**, ne pravilo — Python gleda `Napomena + Izvod opis*`, app gleda
  `comment + izvod_opis`. Time isto pravilo radi na obje strane bez prepisivanja.
- Operatori: `word` (granica riječi, zadano), `contains`, `regex`, `in`, `not_in`,
  `between`, `gte`, `lte`.

## Oblik `actions`

```jsonc
[
  { "op": "set", "slug": "tip",    "value": "Domaćinstvo" },
  { "op": "set", "slug": "podtip", "value": "Hrana i ostalo" },
  { "op": "set_if_empty", "slug": "comment", "value": "Konzum" }
]
```

- `set` prepisuje, `set_if_empty` poštuje P3 („zadnja neprazna vrijednost pobjeđuje").
- Današnje ponašanje `Napomena` kolone = `set_if_empty` na `comment`.

## Razrješavanje

```
matched = sva enabled pravila čiji SVI uvjeti prolaze
  |matched| == 0  → redak se ne dira
  |matched| >= 1 i sve akcije se slažu po (slug, value) → primijeni
  inače                                                 → NE DIRAJ, prijavi konflikt
```

Konflikt nosi: `row_id`, popis `(rule.name, slug, value)`, i tekst po kojem su pogodila.

⚠ **Slaganje se mjeri po ISHODU, ne po pravilu.** Dva pravila koja oba postavljaju
`tip=Domaćinstvo` nisu konflikt čak i ako su različita — to je važno jer bi inače
legitimna preklapanja (`konzum` i `super konzum`) proizvela lažne konflikte.

## Roundtrip

`Rules` sheet u Structure exportu, isti obrazac kao `Automations` i `ListColumns`:

| Area | Category_Path | Name | Enabled | Conditions | Actions | Note |

- `Conditions`/`Actions` u čitljivom obliku, ne sirovi JSON:
  `*text word konzum | izvorplacanja in Racun` odnosno `tip = Domaćinstvo; podtip = Hrana`.
- Semantika brisanja: **kao `ListColumns`** (sheet je popis ⇒ redak kojeg nema se briše),
  a **ne** kao `Automations`. Zaštita je na razini sheeta: nema sheeta ⇒ ništa se ne dira.
- ⚠ Pravila su **slug-based** ⇒ rename sluga mora povući fixup, isto kao
  `dashboardConfig.ts` i `fixupListColumnsSlug`. Bez toga pravilo tiho prestane pogađati.

## Potrošači

| tko | kada | napomena |
| --- | --- | --- |
| Python (`apply_rules.py` nasljednik) | batch nad Review/izvodima | čita iz baze, ne iz sheeta |
| Import (Faza 3) | „popuni ako je prazno" | ista rupa koja drži `Datum naplate` i rate |
| Add Activity | prijedlog dok se tipka | opcionalno, kasnije |
| Haiku Help | objašnjenje korisniku | pravila kao **činjenice**; proza ide u `help_notes` |

⚠ **Help ima dvije vrste sadržaja i ne smiju se pomiješati:** pravila su strojni zapis
(`rules`), a objašnjenja tipa „što upisati kad dižeš na bankomatu" su proza za čovjeka i idu
u `areas.settings.help_notes` (+ `HelpNotes` sheet). Haiku dobiva oboje.

## Faze

1. **Tablica + `Rules` sheet + roundtrip.** Bez ijednog potrošača — samo da pravila postoje
   i prežive Excel. Provjerljivo isti dan.
2. **Python potrošač**: migracija 71 pravila iz `Pravila` sheeta, pa run s prijavom
   konflikata. Očekivano: ~71 redak u `Za odluku` (v. mjerenje), i to je uspjeh, ne pad.
3. **Import putanja** (spaja se s Fazom 3 — `set_attribute` na uvozu).
4. **Help čita pravila.**

## Otvoreno

- Treba li pravilo moći ciljati **atribut** (`attribute_definition_id`), ili je `category_id`
  dovoljno usko? Za Financije je dovoljno; za treninge se ne zna dok se ne vidi oblik.
- Kako se rješava konflikt **kad ga čovjek pogleda** — Edit u appu, ili kolona u Excelu?
  Excel je jeftiniji za batch, app je jedini put za Koku.
- Migracija `Preimenovanja` sheeta (34 retka, vlastiti uvjetni stupci) — je li to isti
  mehanizam ili zaseban? Trenutno izgleda kao pravila s drugim ulazom (stari par umjesto
  teksta), dakle **isti mehanizam s uvjetom nad `tip`/`podtip`**.
