# UPUTE — bankovni izvodi za Financije migraciju

*(S107d, 2026-07-13. Pisano tako da se može poslati Koki — pretpostavlja se nulto predznanje.)*

## Zašto ovo radimo

Kokin Excel za tisuće kartičnih kupovina nema opis (ne zna se ŠTO je kupljeno).
Bankovni izvodi (PDF) taj opis imaju. Naši alati automatski čitaju PDF-ove i
spajaju opise s redovima u Excelu — svaki novi izvod smanjuje ručni rad.

**Trenutno nam fali samo: Sašin RBA izvadak br. 5/2026 (svibanj).**
Sve Kokino (ZABA + Mastercard + PBZ Visa, 2023-12 → 2026-06) je kompletno. ✔

---

## 1. Kako skinuti izvod (po banci)

### RBA (Sašin račun) — fali izvadak br. 5/2026

1. Prijavi se u RBA internetsko bankarstvo (www.rba.hr → moja.rba) ili mobilnu
   aplikaciju **moja mBanka**.
2. Odaberi tekući račun → potraži **"Izvadci"** (ponekad "Izvodi" ili unutar
   "Dokumenti").
3. Odaberi godinu **2026** → **izvadak broj 5** (razdoblje otprilike
   **08.05.2026.–07.06.2026.**).
4. Preuzmi kao **PDF**. ⚠ Treba baš *izvadak* (dokument s naslovom "Izvadak o
   stanju i prometu po tekućem računu"), NE "pregled prometa" s ekrana.
5. **⚠ Nakon downloada OTVORI PDF i provjeri 1. stranicu**: mora pisati
   `Broj izvatka: 5` i razdoblje 08.05.–07.06. U prvom pokušaju (13.7.) je pod
   "5" stigao izvadak **6** (identičan onome koji već imamo — alat ga je sam
   prepoznao kao duplikat, ništa nije pokvareno). Ako se ponovi, probaj
   susjedni red u listi ili web verziju umjesto mobilne aplikacije.

### ZABA (Kokin račun) — za buduće mjesece

U **e-zaba** / **m-zaba** postoje DVA dokumenta koja trebamo, oba mjesečno:

1. **"Jedinstveni izvadak građana"** — izvadak tekućeg računa
   (Računi → Izvadci → mjesec → PDF).
2. **"Obavijest o učinjenim troškovima"** — izvod **Mastercard kartice** s
   popisom kupovina (Kartice → odaberi Mastercard → Obavijesti/Izvodi → PDF).
   Ovaj je najvažniji — u njemu su opisi kupovina!

### PBZ Card (Kokina Visa Gold) — za buduće mjesece

Mjesečni račun (PDF s "SPECIFIKACIJA PROMETA") iz **MyWay** aplikacije ili
mojpbzcard.hr portala → Računi → mjesec → PDF.

---

## 2. Kamo staviti skinute PDF-ove

Sve u ovaj direktorij (Koka šalje Saši mailom/WhatsAppom, Saša sprema):

```
C:\0_Sasa\events-tracker-react\data-prep_data\Financije\izvodi\
```

**Bitno za znati (ništa ne možeš pokvariti):**
- **Ime fajla je NEBITNO** — alat prepoznaje vrstu dokumenta po sadržaju,
  sam ga preimenuje (npr. `MC_2026-05.pdf`) i posprema u `Analizirani_izvodi/`.
- **Duplikati ne smetaju** — ako se isti dokument pošalje dvaput (čak i pod
  drugim imenom), alat ga prepozna i makne u `duplikati/`. Ništa se ne briše.
- Smije se staviti i u podmapu (npr. `izvodi\novo_od_koke\`) — alat gleda sve.

---

## 3. Obrada (Saša — dvije komande)

**Prije pokretanja: zatvori u Excelu** `Financije_review_*.xlsx` i
`Izvodi_transakcije.xlsx` (inače alat ne može snimiti).

Otvori PowerShell ili Command Prompt (Start → utipkaj `cmd` → Enter) pa:

```
C:\0_Sasa\events-tracker-react\data-prep_tools\Financije\run.bat inventory_izvoda.py
```

- Sredi nove PDF-ove i ispiše tablicu pokrivenosti po mjesecima
  (⚠ RUPE = mjeseci koji fale). Stari fajlovi se čitaju iz keša — brzo je;
  jedino se NOVI RBA izvodi čitaju OCR-om (~2 min po fajlu, strpljenja).

```
C:\0_Sasa\events-tracker-react\data-prep_tools\Financije\run.bat enrich_from_izvoda.py
```

- Upiše opise s izvoda u Review Excel (kolone `Izvod opis` / `Izvod file`).
  Prije snimanja automatski napravi backup (`*.pre-izvod-*.xlsx`).
  Ručno uneseni Tip/Podtip se NIKAD ne diraju.

**Očekivani ispis (primjer):** `Matchano: 1707/3501 transakcija` + lista
nematchanih (to su transakcije kojih nema u Kokinom Excelu — ide u
`Nematchano` sheet u `Izvodi_transakcije.xlsx`, nije greška).

---

## 4. Ako nešto ne štima

| Simptom | Uzrok / rješenje |
| --- | --- |
| `PermissionError` / "Ne mogu snimiti" | Excel file je otvoren — zatvori ga i ponovi komandu. Backup je svejedno napravljen. |
| `bez tekst-sloja — treba OCR ili CSV export` za novi fajl | Nova vrsta PDF-a koju ne poznajemo — javi Claudeu (vjerojatno treba novi parser). |
| `nepoznat tip — pogledati ručno` | Dokument nije bankovni izvod (ili je nova banka/format) — javi Claudeu. |
| Obrada "visi" nekoliko minuta | Normalno za nove RBA izvode (OCR). Pusti da završi. |
| Nešto krivo upisano u Review | Vrati backup: u `data-prep_data/Financije/` nađi najnoviji `*.pre-izvod-*.xlsx`, preimenuj ga natrag u `Financije_review_20260710_1448.xlsx`. |

---

## 5. Status pokrivenosti (2026-07-13)

| Izvor | Pokriveno | Fali |
| --- | --- | --- |
| ZABA račun (Koka) | 2023-12 → 2026-06 | — |
| ZABA Mastercard (Koka) | 2024-01 → 2026-06 | starije od 2024-01 ne postoji u e-bankarstvu |
| PBZ Visa (Koka) | 2023-12 → 2026-06 | — |
| RBA račun (Saša) | 2024-09 → 2026-06 | **izvadak br. 5/2026 (svibanj)** ← jedini zadatak |
