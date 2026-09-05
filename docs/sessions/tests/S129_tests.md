# S129 — testovi (2026-09-05)

Sesija je imala dva odvojena toka: **sređivanje podataka** `Financije_all` na PROD-u
i **popravci procedura/koda**. Testovi su niže grupirani isto tako.

---

# A. Podaci — `Financije_all` (PROD)

## T-S129-A1 ✅ Popravak parkinga i multisporta primijenjen

Pokrenuo Saša: `fix_parking_i_multisport.py --apply`.

**Rezultat:** 3 brisanja + 1 pomak datuma, `obrisanih redaka ostalo 0`,
backup `_arhiva/backup_S128_20260905_162735.json` (4 eventa, 36 atributa).

## T-S129-A2 ✅ Četiri mjeseca pala na nulu

`promet_check.py --od=2025-01` nakon popravka:

| mjesec | prije | poslije |
| --- | ---: | ---: |
| 2025-02 | −49,00 | **0,00** |
| 2025-03 | +49,00 | **0,00** |
| 2026-03 | −2,80 | **0,00** |
| 2026-04 | −1,40 | **0,00** |

## T-S129-A3 ✅ Parking `1,40` nestao iz liste, ne samo iz brojke

Provjerio Saša u aplikaciji na 05.03., 21.03.2026. i 11.04.2026.
Svaki datum ima **po dva** retka od `0,70` i **nijedan** `1,40`.

Izmjereno uz to: svih šest preživjelih redaka nosi `Izvod opis` (potvrđeni
izvodom) i ispravan `Prijevoz / Taksi, Zet, Parking`.

## T-S129-A4 ✅ Podizanje 150,00 — duplikat obrisan

`fix_podizanje_150.py --apply`. Dokaz je bio trostruk:

| izvor | što ima |
| --- | --- |
| banka (ZABA 2025-09/10/11) | **jedno** podizanje 150,00, i to **12.11.2025.** |
| Kokin file (`koka EU!2137`) | **jedan** redak 150,00, i to **12.10.2025.**, bez opisa |
| baza | **oba** ⇒ višak |

Obrisan Kokin (gol: `Tip = N/A`, bez komentara, bez `Izvod opis`).
**Δ(2025-10) pao s −150,00 na 0,00.**

## T-S129-A5 ✅ ZABA 2026-07 i 2026-08 zatvaraju u cent

Oba izvoda premještena u `izvodi/Analizirani_izvodi/` (mapa koju alati **čitaju**
— nije arhiva). `promet_check.py`:

```
2026-07   11 559,69  =  11 559,69    38 redaka
2026-08   -1 030,97  =  -1 030,97    46 redaka
```

Uvoza nema — kolovoz je ušao još u S126, file dotad nije stajao u toj mapi.

## T-S129-A6 ✅ App reproducira ispisano kolovoško stanje

`rpc_area_balance_anchored` na `p_as_of = 2026-08-26` daje **`12.784,36`**,
identično ispisanom stanju na `ZABA_2026-08.pdf`. Na danas (05.09.) `12.752,86`.

⚠ Pri mjerenju: RPC **mora** dobiti `p_plus_slug`/`p_minus_slug`. Bez njih su
`plus_sum`/`minus_sum` **nula**, `balance` ispadne jednak sidru, a izlaz izgleda
kao uredan odgovor. Prvi poziv u ovoj sesiji je upravo tako pogriješio.

## T-S129-A7 ⬜ Sidro `2026-08-26 = 12.784,36`

```powershell
$env:ET_TARGET="prod"
..\Tools\venv\Scripts\python.exe make_saldo_anchors.py --anchor 2026-08-26
```

**Očekivano:** sidro upisano, bilješka `ispisano stanje s izvoda · ZABA_2026-08.pdf`.
Saldo se **ne mijenja** (12.752,86 prije i poslije) — sidro je pečat, ne ispravak.

**Zašto ne `anchors.py --add`:** ovaj alat broj čita **iz PDF-a**; `--add` bi ga
primio s tipkovnice, a sidro je već jednom upisano s tipfelerom (S111).

⚠ Nakon njega nijedan budući delta sheet ne može doseći prije **27.08.2026.**

## T-S129-A8 ⬜ Delta sheet nakon sidra

Filter na `Kokin tekući ZABA` → Export → Delta sheet.

**Očekivano:** prozor kreće **27.08.2026.** i nosi **2 retka** (prije sidra bi
nosio 48 već usklađenih kolovoških). Kontrolni stupac kreće od izračunatog
stanja na dan prije prozora.

## T-S129-A9 ⬜ Preostala dva mjeseca

| mjesec | Δ | što treba |
| --- | ---: | --- |
| 2025-08 | −46,74 | `−45,94` (Zagrebački holding) + `−0,80` |
| 2025-07 | +0,80 | banka ima `−0,80` @ 07.07., baza nema |

⚠ `uskladi_izvod.py` prima **samo MC izvode** (`Zasad samo MC izvodi… Visa/ZABA
imaju drugi format`). Za ZABA-u se ide izravno na podatke, kao u T-S129-A4.

## T-S129-A10 ⬜ `MC_2026-08.pdf` — netaknut

Stigao 02.09., ništa nije pokrenuto. Kartični izvod **ne dira saldo** (kupovine
su „pot", račun tereti skupna naplata na ZABA izvatku). Daje: potvrdu po retku
(`Izvod opis`), točan `Datum naplate`, retke kojih baza nema, duplikate.

Prvi korak je čitanje: `uskladi_izvod.py --izvod ...MC_2026-08.pdf --dry`.

---

# B. Procedure i kod

## T-S129-1 ✅ Prekidač „Koristi filtre iz profila"

Profil `Kokin_format` nosi `{"periodKey": "last-3-months", "sortOrder": "asc"}` i
**prepisivao** je raspon iz panela. Kutija „Active filters" je pritom pokazivala
**panelov** raspon — dakle tvrdila da je aktivno ono što je upravo pregaženo.

| prekidač | Date |
| --- | --- |
| ☑ | `2026-06-05 → 2026-09-05` + linija da panelov raspon **ne vrijedi** |
| ☐ | `2026-02-01 → 2026-04-12` (odnosno panelov) |

## T-S129-2 ✅ Brojka retka prati prekidač

**387** zakvačeno · **5.154** otkvačeno. Prije je uvijek pisalo 5.154 — dakle
brojka je opisivala panel, a ne file koji izlazi.

## T-S129-3 ✅ `Custom` raspon preživi Structure tab

## T-S129-4 ✅ `Custom` raspon preživi View Details

`userModified` je bio **lokalni `useState`**; svaki unmount ga je vratio na
`false` i ponovo naoružao auto-init ⇒ raspon je padao na „All time". Dva živa
puta: Structure tab (`activeTab !== 'structure'`) i View Details (`AppHome` se
odmontira). Sada je izveden iz `filter.periodKey`, dakle iz konteksta.

## T-S129-5 ✅ `All Time` iz dropdowna i dalje radi

## T-S129-9 ✅ Excel Import/Export uz `+` na uskom ekranu

Na uskom ekranu su bili **unutar filter panela**, koji se zatvara. Sada stoje uz
`+`, isti raspored kao Structure tab. Na širokom ostaju uz listu — provjereno da
**nigdje nisu oba**.

## T-S129-6 ⬜ Export s otkvačenim prekidačem stvarno sadrži traženi raspon

Brojka je potvrđena; sam **file** nije otvoren. Postavi panel na ožujak/travanj
2026., otkvači prekidač, preuzmi i provjeri da retci tih mjeseci **jesu** u fileu.

## T-S129-7 ⬜ Delta sheet s otkvačenim prekidačem nije prazan

`deriveDeltaAccount` je proveden kroz prekidač: otkvačeno ⇒ račun dolazi iz
panela, kao i eventi. Bez toga bi eventi bili iz panela a račun iz profila ⇒
**presjek prazan, a file izlazi s točnim sidrom i nula redaka** (BUG-S123-DELTAACCT).

**Pad:** delta sheet ima 0 redaka uz upozorenje o praznoj sekciji.

## T-S129-8 ⬜ Shortcut s `periodKey` više se ne prepisuje

Vjerojatno usput popravljeno: `handleShortcutSelect` zove `setDateRange` **iz
konteksta**, što lokalni `userModified` nije dizalo — pa je auto-init smio
prepisati raspon koji je shortcut upravo vratio. Sada `periodKey` blokira.

**Provjera:** spremi shortcut s rasponom „This month", promijeni filtar, pa ga
odaberi. Raspon mora ostati na „This month".

## T-S129-B1 ✅ T-S127-9 — pravilo se ne okida na otvaranju

⚠ **Prvi pokušaj nije bio dokaz.** Odabran je Visa redak `28.08.2026.` s
`Datum naplate = 03.09.2026.` — a to je **točno ono što `next:3` izračuna**.

Izmjereno: od **1.619** Visa redaka samo ih je **11** naplaćeno 3. u mjesecu.

```
dan naplate:  5. → 719   4. → 400   6. → 176   7. → 137
              12. → 63   8. → 62   11. → 50   3. → 11   13. → 1
```

Ponovljeno na `27.07.2026. · ZOO · 15,00 € · naplata 07.08.2026.` (razlika 4
dana). Nakon Edita i `Save → View` datum je **ostao 07.08.2026.**

**Pouka za svaki budući test pravila:** redak na kojem se testira mora se
**razlikovati** od onoga što pravilo proizvodi, inače test prolazi i kad je kod
pokvaren.

## T-S129-B2 ✅ Ključ primatelja ne preživljava skraćen `Izvod opis`

CLAUDE.md je od S126 tvrdio da je skraćivanje sigurno „jer `kljuc_izvoda` isti
uvod ionako skida". **Ne skida.**

```
dugi    Kreditni transfer … (m-zaba) POSMRTNA …  →  ('posmrtna pripomoc', '1147')
kratki  (m-zaba) POSMRTNA …                      →  ('m zaba posmrtna',   '1147')
```

Posljedica u živim podacima: 14 povijesnih PP redaka nije bilo presedan za 2
kolovoška, a alat je javio **„nema presedana"** ondje gdje povijest ima odgovor.

⚠ Gore: oblik `(mobilne aplikacije)` stari regex nije hvatao ni s uvodom, pa je
**22 nepovezana primatelja** dobilo isti ključ `kreditni transfer nac`.

Popravljeno; izmjereno **59 redaka** dobiva pravog primatelja.

## T-S129-B3 ⬜ (PARKIRANO) Oznake iz presedana

`oznaci_iz_presedana.py` — sirovi tekst izvoda u `Opis`u zamjenjuje oznakom iz
brojane povijesti. Dry run čist: **45 od 71** retka, ostalih 26 se ne pogađa.
**Saša parkirao** jer mu predložene oznake nisu bile očite. `--apply` NIJE pušten.

Ključ je primatelj + poziv na broj, nikad `Tip`/`Podtip`: po `Tip`/`Podtip`
vodeća oznaka parking skupine ima **36 %** (isti Podtip nosi i `Prevoz`, 45×),
po primatelju **96 %**.

## T-S129-B4 ⬜ Merge na `main` + provjera na PROD-u

Merge nije izveden — auto-mode klasifikator blokira push na `main`.
Naredbe su u `NEXT_SESSION_PROMPT.md`.

Nakon Netlify builda, na **PROD URL-u** i s **hard refreshom** (`Ctrl+Shift+R` —
stari keširani bundle je već jednom prevario, S118):

1. T-S127-9 još jednom (`27.07.2026. ZOO 15,00` → `07.08.2026.`)
2. export modal ima prekidač i brojka mu se mijenja
3. `Custom` raspon preživi odlazak na Structure
