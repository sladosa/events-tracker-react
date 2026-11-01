# S191 — testovi: popravci uz testove koraka 5

Sve na **TEST-u** (`npm run dev`, banner TEST), Sašin račun, prvo **Ctrl+Shift+R**.

## T-S191-1 — View: dug tekst se prelama

Nađeno u T-S190-2 (01.11.): u Viewu je dug Description stajao desno u jednom retku (izlazio iz ekrana), a naziv
polja s opisom bio je stisnut u uski stupac. Uzrok: vrijednost je imala `shrink-0`.

1. Filter `Katalog vježbi › Vježba`, na mobitelu.
2. Otvori **View** vježbe `lat_raises` (opis iz T-S190-2, 2–3 rečenice).
   - **Očekivano:** ispod naziva „Description (…)" ide opis **preko cijele širine**, prelama se u više redaka; ako
     je u Editu upisan novi red, i u Viewu je novi red.
   - Name, Slug, Type, Group i dalje stoje **desno** od naziva, kao prije.
3. Isto u drugoj Arei s dugim tekstom (npr. `Financije_all`, redak s dugim `Izvod opis`).
4. **Pad:** opis izlazi izvan ekrana ili je u jednom retku; naziv polja stisnut u uski stupac.
