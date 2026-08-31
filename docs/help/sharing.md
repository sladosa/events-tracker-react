# Sharing (Suradnja) — Help

## Dijeljenje areae
1. Idi na Structure tab → All pogled
2. Klikni "Manage Access" na area banneru (ili ⋮ → Manage Access)
3. Unesi email korisnika + odaberi dozvolu (write / read)
4. Klikni "Send Invite"

## Dozvole
- **write**: grantee može dodavati aktivnosti u toj areji
- **read**: grantee može samo pregledavati aktivnosti

## Grantee pogled
- Shared areae vidljive u filter dropdown-u i Structure tabu
- Zeleni banner: "✅ Write access" + [ℹ Info] + [Take your data]
- Amber banner: "👁 Read-only access" + [ℹ Info]
- Klik na [ℹ Info] → modal s owner emailom, **"Contact owner"** gumbom i listom dozvola
  - **Read grantee**: "Contact owner" → pre-filled poruka za zahtjev write accessa (TO/SUBJ/body); "Copy message" kopira sve u clipboard za slanje emailom
  - **Write grantee**: "Contact owner" → pre-filled header s tvojim pravima + textarea za vlastitu poruku (prijedlog, zamjerka, zahtjev za novi atribut...)
- Edit Mode skriven za grantee-a (ne može mijenjati strukturu)

## Upravljanje pristupom (owner pogled)
- Purpurni banner s imenima grantee-a
- "Manage Access" modal: aktivni shareovi + pending pozivnice + forma za invite
- Inline select za promjenu write↔read
- "Revoke" gumb za opoziv pristupa — ako grantee ima evente, pojavi se dialog:
  - **Revoke only**: eventi ostaju kao "orphan eventi" (vidljivi u Activities amber banneru)
  - **Claim events**: eventi postaju owner-ovi
  - **Delete events**: trajno brisanje eventa

## Invite flow
- Unesi email → klikni Invite → pojavi se message box s tekstom poruke za kopiranje
- Kopiraj link ili cijelu poruku i pošalji korisniku
- Invite se prikazuje u "Pending" sekciji dok korisnik ne klikne link i postavi password
- Korisnik vidi shared area čim se ulogira

## Grantee zaštita podataka
Write grantee ima uvijek vidljiv **"Take your data"** gumb na zelenom banneru.
Klik → LeaveAreaModal → odaberi "Create my own copy and keep my data" → area struktura i svi tvoji eventi kopiraju se na tvoj račun.
**Preporuka:** ne čekaj dok owner ne revokne pristup — ako imaš podatke koje ne želiš izgubiti, kopiraj ih proaktivno.

## Kad grantee napusti area ("Leave without data")
Granteejev ⋮ menu na area banneru → "Leave this area" → "Leave without data"
Efekt: data_shares se briše, eventi ostaju u owner-ovim kategorijama kao "orphan eventi".

**Owner vidi:** amber banner u Activities tabu — vidi sekciju "Orphan eventi" u Activities helpu.

## Vlasnik Aree smije ispraviti tuđi redak (ne obrisati)
Kad grantee upiše zapis u tuđu Areu, **vlasnik Aree ga smije ispraviti** — u ⋮ meniju
tog retka stoji **„Edit (tuđi zapis)"**. Grantee to ne može: tuđi redak i dalje otvara
zaključani ekran „Tuđi zapis".

- **Autorstvo se ne mijenja.** U koloni `User` i dalje piše onaj tko je zapis unio —
  vlasnik ga ispravlja, ne preuzima.
- **Autor vidi da je redak dirnut:** uz `⋮` se pojavi **✎**, a hover pokaže tko je
  mijenjao i kad.
- **Brisanje tuđeg retka nije moguće kroz aplikaciju.** Ispravak detalja je ono što
  treba; brisanje nema povratka.
- ⚠ **Excel nije put za ispravak tuđeg retka.** „Import as mine" ne mijenja postojeći
  zapis nego **stvara novi** — dobiješ dva zapisa za istu transakciju. Tuđi redak se
  ispravlja kroz aplikaciju.
