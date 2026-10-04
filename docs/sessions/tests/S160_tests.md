# S160 — detaljni testovi (2026-10-04)

> Sesija: **P1 backloga** (tihi gubici) + **dio P3**. Sve je na `test-branch`, nije na `main`.
> Ručni testovi idu na `npm run dev` (= **TEST**, kopija PROD-a od 01.10.), pod računom
> **sasasladoljev59@gmail.com** — on je vlasnik `Financije_all` na TEST-u (`owner@test.com`
> ima samo seed Areu `Financije`). Prije prvog testa **Ctrl+Shift+R** (stari bundle, S118).
> Automatski dio: `storedFilter`, `importDroppedAttrs`, `structureOptionRemoval`, `helpMarkdown`,
> `attrFilterTyped` — svaki provjeren sabotažom.

---

## T-S160-1 ✅ Filter by: datum i da/ne

✅ S160, 04.10. TEST — Saša: 40 / 20 / 55 / 49 / 653 / 1, i `> 11.10.` = **15** (= 55 − 40); View
details + više puta Next i natrag ⇒ uvjet ostaje; shortcut spremi → Clear all → Use ⇒ vrati se
`Datum naplate ≥ 11.10.2026.`, 55. **Usput nađeno i popravljeno:**
(a) „Load next 20" nuđen i kad je ukupno višekratnik od 20 (40) — `hasMore` iz pune stranice
umjesto iz `count` (`6687d39`); (b) „Filter by" skakao na Comment kad se uvjet briše iz panela
(promjena polja, nepotpun datum) — efekt nije znao tko briše (`1a1d67f`); (c) ukupan broj
nevidljiv dok se sve ne učita — sada „20 loaded · 653 events total" (`50580fb`).

`Financije_all > Transakcija`, period **All time**. Brojke su izmjerene izravno u TEST bazi
(`event_attributes`) 04.10. i poklapaju se s oblikom upita koji app šalje (6/6).

| Filter by | uvjet | očekivano |
| --- | --- | --- |
| Datum naplate | `=` 11.10.2026. | **40** redaka |
| Datum naplate | `=` 05.10.2026. | **20** |
| Datum naplate | `≥` 11.10.2026. | **55** |
| Datum naplate | `=` 11.09.2026. | **49** |
| Rate? | Yes | **653** |
| Rate? | No | **1** — ispravno: obični retci atribut nemaju, „No" broji samo spremljeno Ne |

Uz to:
1. Traka iznad liste piše uvjet (npr. `≥ 11.10.2026.`).
2. View details nekog retka → natrag: uvjet ostaje.
3. Spremi uvjet kao shortcut → Clear all → vrati shortcut: uvjet se vrati (i operator).

**Pad:** broj se razlikuje ⇒ zapiši koji red tablice; granica dana je kriva (UTC/lokalno).

## T-S160-2 ✅ Structure panel: „Discard changes?" i sklopive kartice

✅ S160, 04.10. TEST — Saša, `Lab Results` (10 atributa): X bez izmjene bez pitanja; izmjena ⇒
pitanje (slika); Collapse/Expand all; otvorena kartica ostaje otvorena nakon ponovnog otvaranja;
nova kartica s opcijama je odmah suggest (`a`, `b`). **Usput:**
(a) Structure tablica uz filtar na leaf bila je **prazna, bez poruke i bez ⋮ → Edit** — zapamćeno
sklapanje Aree (`ui:collapsedAreas`) skrivalo je retke Aree čiji redak uz taj filtar nije ni
prikazan, pa se nije dalo rasklopiti (`3ad26f6`, stari kvar, potvrđen nakon popravka);
(b) Sašin prijedlog: kartice **zadano sklopljene**, pamte se otvorene (`759a491`) — koraci 3–4
dolje opisuju prvu verziju.

Structure → Table → Edit Mode → ⋮ → Edit na leafu s više atributa (npr. `Health_Sasa > Medical > Lab Results`).
1. Otvori i odmah X ⇒ zatvara se **bez pitanja**.
2. Promijeni ime ⇒ X, pa klik na pozadinu, pa „View" ⇒ svaki put **„Discard unsaved changes?"**;
   „Keep editing" čuva upisano; „Discard" zatvara bez spremanja (ime u tablici nepromijenjeno).
3. „Collapse all" ⇒ zatvori ⇒ otvori: kartice i dalje sklopljene; samo sklapanje **ne pita** pri zatvaranju.
4. „+ Add Attribute", tip text, upiši 2 opcije ⇒ Add ⇒ kartica je odmah suggest s tim opcijama. Discard.

**Pad:** zatvaranje bez pitanja nakon izmjene, ili pitanje bez izmjene.

## T-S160-3 ✅ Structure uvoz staje kad bi obrisao opciju koju retci nose (K-1)

✅ S160, 04.10. TEST — Saša: `Smjer` `Uplata|Isplata|PROVJERI` → `Isplata` ⇒ „Nothing imported yet —
1 option in use would be removed", **samo** `Uplata · 511 rows` (TEST: Uplata 511, Isplata 4.781,
PROVJERI 0 — opcija bez redaka se briše bez pitanja), „Import anyway" ugašen; Cancel ⇒ `Smjer`
i dalje 3 opcije. **Usput:** opcije su u stupcu **P**, a pomoćni list `HelpStructure` je pisao O —
12 slova od K nadalje zaostalo od umetanja `HiddenInAdd`. Slova se sada računaju iz `COLS`
(`colOf`); čuva `structureHelpLetters.test.mjs` (stari kod: 12 krivih).

1. Structure Export (filtar `Financije_all`).
2. U fileu iz popisa opcija `Smjer` (ili drugog atributa s retcima) obriši jednu opciju; spremi.
3. Structure Import ⇒ **„Nothing imported yet — 1 option in use would be removed"**, popis s brojem
   redaka, gumb **„Import anyway"** ugašen dok nije kvačica.
4. **Ne kvačaj** — Close. Provjera: opcija i dalje u izborniku (Edit panel atributa).

**Pad:** uvoz prođe bez pitanja ⇒ opcija nestane (vrati je ponovnim uvozom originalnog exporta).

## T-S160-4 ✅ Activities uvoz imenuje atribut koji Area nema (D3 minimum)

✅ S160, 04.10. TEST — Saša: `Izvor` → `IzvorX` u legendi i zaglavlju ⇒ pregled `0 new / 0 modify /
41 unchanged` + upozorenje „41 vrijednosti … `'IzvorX'` … redovi 26, 27, …". ⚠ Apply ostaje
dostupan **namjerno**: stupac viška je legitiman (stari export, tuđi file), a zabrana bi file
učinila neuvozivim. Upozorenje je ovdje JEDINI znak da bi izmjena u tom stupcu bila ignorirana —
pregled bi i tada rekao „0 modify". Jača brana (vlastita kvačica) = odluka uz D3-F1.

1. Activities Export nekoliko redaka `Financije_all`.
2. U fileu preimenuj atribut na **oba** mjesta (ATTRIBUTE LEGEND kol. D **i** zaglavlje stupca),
   npr. `Izvor plaćanja` → `Izvor X`; upiši vrijednost u 2–3 retka.
3. Import ⇒ pregled u „Warnings": **„… NEĆE biti upisan… `'Izvor X'` (Area `'Financije_all'`): … redovi …"**.
4. Cancel.

**Pad:** pregled bez upozorenja (stari tihi preskok).

## T-S160-5 ⬜ Structure Export na grešci ne daje prazan file

1. DevTools → Network → Request conditions: blokiraj `*://*/rest/v1/attribute_definitions*`.
2. Structure → Export ⇒ crveni toast **„Export failed — no file saved: …"**, nijedan file preuzet.
3. Makni blokadu, Export ⇒ normalan file.

## T-S160-6 ✅ Zapamćeni filtar ne prelazi na drugi račun

✅ S160, 04.10. TEST — Saša: odjava `owner@test.com` (zadnja Area `Financije`) → prijava
`sasasladoljev59@gmail.com` u istom pregledniku ⇒ **nema žute trake**, OT-ova Area nije ponuđena,
rad u `Financije_all` normalan (slika).

## T-S160-7 ⬜ Structure file tuđe Aree staje s porukom o vlasniku (K-1)

Traži par vlasnik/grantee. Na TEST-u ga za `Financije_all` **nema** (izmjereno: nije dijeljena).
1. Pod grantee računom: Structure Import filea Aree koju vidiš kao grantee.
   **Očekivano:** crveno *„Area "…" belongs to another user (shared with you)… Nothing was imported."*;
   u popisu Area **nema** nove Aree istog imena.
**Pad:** stvori se duplikat Aree pod grantee-jem (stari kvar) — obrisati ga.

## T-S160-8 ⬜ Help na mobitelu bez `#` i `**` (nakon deploya)

Pravilo u promptu živi u Netlify funkciji (`npm run dev` je ne pokreće) ⇒ mjeri se na PROD-u.
1. Help → pitanje koje traži korake (npr. „kako dodati unos?").
   **Očekivano:** liste kao liste, podebljano bez zvjezdica, nema `#` ni ```` ``` ````.
