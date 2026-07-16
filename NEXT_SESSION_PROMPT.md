# S107h Session Prompt — drugi krug Pravila + preostali N/A

**Datum:** 2026-07-16, kraj S107g
**Branch:** test-branch (commit uncommitted na kraju S107g — provjeri `git log -3`)
**Preporučeni model za ovu sesiju: Sonnet** (pratnja/objašnjenja/mali fixevi —
NE velike implementacije; za njih vidi "NIJE za ovu sesiju" dolje)

---

## Prompt za copy-paste

```
Nastavljam Financije migraciju (S107h) — drugi krug pisanja Pravila + preostali N/A
redovi. Kontekst pročitaj ovim redom:
1. Claude-temp_R/test-sessions/S107g_tests.md — što je odrađeno prošli put
2. data-prep_tools/Financije/ENRICH_PLAN.md — §2e (stanje S107g) + §3 SLJEDEĆI KORACI

STANJE (kraj S107g, 2026-07-16):
- Prvi pravi apply_rules.py run izvršen: 196 preimenovano, 0 reset, 217 pravilo-
  klasificirano (7 pravila: temu/bolt.eu/konzum/bauhaus/prime video/skyshowtime/
  google*youtube). N/A pao 2218 → 2000.
- Nova arhitektura u apply_rules.py: Pravilo (ako pogađa) > Preimenovanja rename > reset
  za invalid-par retke — ako blanket rename par pogađa preširoko, specifičnije pravilo
  ga automatski nadvladava. Nova kolona `Pravilo run` (timestamp audit trail po redu).
- 2 one-off fixa napravljena za greške otkrivene u blanket Preimenovanja renameu:
  fix_sportski_rekviziti_split.py (Multisport/Kreatin/Decathlon razdvojeni),
  fix_tcom_tmobile_swap.py (2 retka gdje je Kokin originalni label bio krivo upisan —
  Izvod opis otkrio pravu uslugu).
- Nevenka Pavić uplata (jednokratni poklon) ručno klasificirana kao Ostali prihodi.

ŠTO OČEKUJEM OD TEBE:
- Pomozi mi napisati pravila za sljedeći krug (kandidati dolje) — svaki treba MOJU
  odluku o Tip/Podtip prije upisa u Pravila sheet (neki trebaju nov red u Taksonomiji)
- Nakon svakog kruga: --dry prvo, provjeri brojke, tek onda pravi run
- Ako naiđeš na sličan "blanket rename pogodio preširoko" slučaj kao Sportski rekviziti/
  T-com-T-mobile prošli put — provjeri je li Pravilo-nadvladava-Preimenovanja mehanizam
  dovoljan (radi samo dok par još nije preimenovan!) ili treba opet one-off fix
- Sitne fixeve smiješ kodirati (typecheck+build za app kod; py_compile za Python),
  commit SAMO na test-branch
- Zapiši rezultate u PENDING_TESTS.md (⬜→✅/❌)

KANDIDATI ZA PRAVILA (iz S107g analize, ENRICH_PLAN §2e) — treba moju odluku o Tip/Podtip:
- paypal ostatak (~45 redova osim temu, merchant varira — NE blanket pravilo)
- apple.com/bill (50×, nema Podtip u Taksonomiji još)
- spotify (22×, nema Podtip u Zabava još)
- osiguranje grupa: allianz/triglav/zivotno/investicijsko (~26-43×, nema Tip "Osiguranje")
- porez grupa: porez/prirez/dohodak (APN porez, ~50×, nema Tip "Porezi")
- leasing (OTP Leasing, ~15×)
- bmove (30×, ne znam koji je to trošak)
- keks pay (63×, P2P transfer — ovisi o namjeni)
- zagrebparking (45×, vjerojatno auto C5/parking — potvrditi)

PRAVILA: run.bat + PYTHONUTF8=1; Review file ZATVOREN u Excelu prije skripti;
backup nastaje automatski; cmd guši zarez u argumentima (jedan substring po pozivu);
NIKAD ne pushati/mergati na main; NE dirati vrijednosti u Review sheetu iz koda
osim kroz postojeće (ili nove, ali backed-up) skripte.

NIJE ZA OVU SESIJU (čeka jaču sesiju, plan u ENRICH_PLAN §2e/§3):
PBZVISA split po Kartica koloni, Izvod kandidat kolona, reconcile report,
Visa generator novih redaka, import generator, split-workbook (Taksonomija/Pravila/
Preimenovanja → zaseban file — diskutirano, tehnički OK, ali čeka dok se ne odradi
par krugova pravila).
```

---

## Kontekst za model (ne mora u prompt)

- **apply_rules.py sad ima 3 razine prioriteta za invalid-par retke:** Pravilo (ako
  keyword pogađa) > Preimenovanja rename > reset na N/A. Za retke koji su VEĆ preimenovani
  (valjan par), novo pravilo ih više NE dira — ako se otkrije greška u već-preimenovanom
  retku (kao T-com/T-mobile), treba one-off fix skriptu (pattern: `fix_*.py` u
  data-prep_tools/Financije/, prepoznaje retke preko `Tip_O`/`Podtip_O` snapshot kolona).
- **`Pravilo run` kolona** — filtriraj po zadnjem timestampu da vidiš što je zadnji run
  promijenio, neovisno o starijim runovima.
- **Prije pisanja pravila:** provjeri Taksonomija sheet ima li ciljani Tip/Podtip par —
  ako ne, prvo treba Saša doda red u Taksonomiju (i eventualno `sync_taxonomy.py` za
  dropdown refresh), tek onda pravilo.
- **Split-workbook** (Taksonomija/Pravila/Preimenovanja → zaseban file, da Saša može
  ostaviti otvoren za referencu bez zatvaranja Reviewa) — spreman prijedlog, čeka
  Sašinu odluku želi li ga implementirati.
- **Deploy procedura** (samo na izričit zahtjev): CLAUDE.md → Session workflow → End of session.
