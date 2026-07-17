# S107i Session Prompt — PBZ Visa split (person-split + merge u Review)

**Datum:** 2026-07-17, kraj S107h
**Branch:** test-branch (S107h commit — provjeri `git log -3`)
**Preporučeni model za ovu sesiju: jači model (Opus)** — pravi novac, person-split
između Saše i Koke, PDF datumi; veći rizik od pogreške nego kod dosadašnjeg
rules-craft (koji je Sonnet radio dobro). Rules-craft nastavak (paypal/bmove/keks
pay/zagrebparking) NIJE za ovu sesiju — čeka dok se PBZ Visa merge ne završi.

---

## Prompt za copy-paste

```
Nastavljam Financije migraciju (S107i) — PBZ Visa split i merge u Review sheet.
Kontekst pročitaj ovim redom:
1. Claude-temp_R/test-sessions/S107h_tests.md — što je odrađeno prošli put
2. data-prep_tools/Financije/ENRICH_PLAN.md — §2d (Visa odluke, KLJUČNO nalaz o
   kartici/računu) + §2f (stanje S107h) + §3 SLJEDEĆI KORACI t.1

STANJE (kraj S107h, 2026-07-17):
- Drugi krug apply_rules.py pravila izvršen: 294 redova, +46 Napomena. N/A 2000 → 1706.
- apply_rules.py sad ima Iznos min/max uvjet (razdvaja isti merchant po cijeni) i
  Komentar→Alternativa dopisivanje (bilješke za kasnije filtriranje).
- Osiguranje/Allianz/Generali/Triglav svi klasificirani u postojeće kategorije
  (nema novih Taksonomija redova).
- PBZ Visa (1538 tx) i dalje NISU u Review sheetu — sjede u Nematchano sheetu iz
  enrich_from_izvoda.py, čekaju merge. Ovo je glavni posao ove sesije.

ODLUKE VEĆ DONESENE (Saša, 2026-07-15, v. ENRICH_PLAN §2d — NE otvarati ponovno):
- 1538 PBZ Visa tx se DODAJU kao novi Review retci (ne ignoriraju se)
- Lump plaćanja → Tip=Transfer/između računa (ne trošak, bez duplog brojanja)
- Datum naplate se vuče iz PBZ PDF-ova (dospijeće/stvarna uplata)
- Osoba se označava PER-OSOBA Podtipom, NE novom kolonom
- KLJUČNO: Kokina PBZ Visa Gold se skida sa SAŠINOG tekućeg RF (ne s njenog ZABA!),
  Mastercard (obje kartice) sa Kokinog ZABA. Novi Visa retci → Racun = "Sašin tekući RF".
  Posljedica: "[kartica: SAŠA]" transakcije s PBZVISA izvoda VJEROJATNO odgovaraju
  POSTOJEĆIM Sašinim redovima (Racun=Sašin tekući, Izvor=Visa) — zato je enrich match
  bio samo 1/1539. Treba split po Kartica koloni PRIJE generiranja novih redaka:
  SAŠA-tagirane tx pokušaj matchati na postojeće Sašine Visa retke (dedup, ne dupliciraj!),
  DUBRAVKA/Koka-tagirane tx idu kao NOVI retci.

ŠTO OČEKUJEM OD TEBE:
- PBZVISA split po Kartica koloni (dedup logika za SAŠA-tagirane tx protiv postojećih
  Sašinih Visa redaka — provjeri prije pisanja, ne pretpostavljaj format)
- Generiranje novih Review redaka za Koka-tagirane PBZVISA tx (row_hash-kompatibilno —
  provjeri excelFingerprint.ts / kako apply_rules/enrich pišu redove da format odgovara)
- `Izvod kandidat` kolona (labaviji match za ~256 ne-Visa nematchanih — isti Racun/Izvor/
  Smjer + točan iznos ±7 dana; upisuje se U Review, unutar autofiltera, ne zaseban sheet)
- Reconcile report po računu × mjesecu (zbroj Review vs saldo izvoda) — lokalizira mjesece
  s manjkom (klasa "700€ bankomat" nalaz iz S107e, v. ENRICH_PLAN §2c)
- Prije bilo kakvog pravog pisanja: --dry / probni run na kopiji, pokaži brojke, čekaj
  moju potvrdu
- Zapiši rezultate u PENDING_TESTS.md (⬜→✅/❌) + novi test-sessions/S107i_tests.md
- Sitne fixeve smiješ kodirati (py_compile za Python), commit SAMO na test-branch

PRAVILA: run.bat + PYTHONUTF8=1; Review file ZATVOREN u Excelu prije skripti;
backup nastaje automatski; cmd guši zarez u argumentima (jedan substring po pozivu);
NIKAD ne pushati/mergati na main; NE dirati vrijednosti u Review sheetu iz koda
osim kroz postojeće (ili nove, ali backed-up) skripte.

NIJE ZA OVU SESIJU (nastavak rules-craft kad PBZ Visa merge završi, plan u
ENRICH_PLAN §3 t.2): paypal ostatak, spotify ostatak, bmove, keks pay, zagrebparking,
porez grupa (nema Tip "Porezi" još). Split-workbook (Taksonomija/Pravila/Preimenovanja
→ zaseban file) — i dalje odgođeno.
```

---

## Kontekst za model (ne mora u prompt)

- **Zašto jači model:** ovo nije inkrementalni keyword-rule dodatak (Sonnet je to radio
  dobro kroz S107g/h) — ovo je novi merge s dedup logikom preko dva različita računa i
  dvije osobe, s pravim financijskim posljedicama ako se pogriješi (duplo brojanje,
  pogrešna osoba, pogrešan datum naplate). Veći prostor za tihu pogrešku.
- **`apply_rules.py` sad ima Iznos min/max uvjet** — ako neki od novih PBZ Visa redaka
  treba slično price-tier razdvajanje (kao Audible_Koka/Sasa), mehanizam već postoji,
  ne treba ga ponovno graditi.
- **row_hash/fingerprint:** provjeri `src/lib/excelFingerprint.ts` (app kod) prije
  generiranja novih redaka — ako Review format mora ostati kompatibilan s import
  generatorom, format novih redaka treba odgovarati postojećim (kolone, Tip_O/Podtip_O
  snapshot polja se NE popunjavaju za nove retke koji nikad nisu imali stari Tip).
- **Deploy procedura** (samo na izričit zahtjev): CLAUDE.md → Session workflow → End of session.
