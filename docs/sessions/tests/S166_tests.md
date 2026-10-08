# S166 — detaljni testovi (2026-10-08)

> Sesija: **ručni testovi S165 na TEST-u** (T-S165-1..8 ✅) i pet dorada pločica Overviewa po
> Sašinim nalazima tijekom testiranja. Sve na `test-branch`, ide u isti deploy kao S165.
> Preduvjet za sve: `npm run dev` (banner **TEST**), Sašin račun, `Financije_all`, tab Overview,
> **Ctrl+Shift+R**.

## T-S166-1 ✅ Rubovi kruga se vide (08.10.)

Prihodi, rujan 2026.: između **Saša** i **Koka** u vanjskom prstenu bijela linija od 2,5 px.
Djeca nasljeđuju boju roditelja, pa braću dijeli samo rub (zadani 1 px se nije vidio).

## T-S166-2 ✅ Dvoznačan Podtip nema ↗ (08.10.)

Razrez, po kupnji, Koka razno › auto C5: ↗ uz **auto C5**; uz **registracija / gorivo / popravci**
nema ↗ (postoje i pod auto Lacetti — filtar nosi jedan uvjet). Mjesečni › Kuća › Struja i dalje ima ↗.
Mišem na prazno mjesto strelice ⇒ tooltip kaže zašto. Čuva `breakdownModel.test.mjs`.

## T-S166-3 ✅ Tooltip kruga: neto i nacrtano (08.10.)

Laptop, 12 mj, po kupnji: mišem na **Povremeno nužno** ⇒ `neto 2.911,14 € (kao u listi)` +
`nacrtano 3.884,37 € — minus ispod je izvan kruga`. Na **Koka razno** ⇒ samo jedan broj.
Čuva `breakdownModel.test.mjs` (neto korijena = Izašlo, nacrtano veće).

## T-S166-4 ✅ Harmonika: uvijek jedna pločica otvorena (08.10.)

1. Otvaranje appa / F5 ⇒ saldo otvoren, razrez zatvoren (samo naslov + razdoblje).
2. Klik **Kamo ide novac** ⇒ razrez otvoren, saldo sklopljen u naslov.
3. Klik **Stanje po računu** (otvoren ili zatvoren) ⇒ prebaci na drugu; nikad obje zatvorene.
4. ↗ iz razreza pa povratak na Overview ⇒ razrez i dalje otvoren (pamti se u modulu, ne preko F5).
**Pad:** obje zatvorene nakon klika ⇒ stara verzija (prvi prijedlog, Saša ga je odbio).
Čuva `e2e/tests/S165_breakdown_tile.spec.ts` (sabotaža `collapsed={false}` ruši ga).

## T-S166-5 ✅ Objašnjenje potvrde na klik (08.10.)

Ispod salda više nema tri trajna odlomka. Uz „povijest potvrda (N)" je **„kako radi potvrda?"** ⇒
rasklopi isti tekst; „sakrij objašnjenje" ga zatvara. „Nije greška izračuna" je u tooltipu Δ čipa.

## T-S166-7 ✅ Krug vodi, lista slijedi (08.10.)

Laptop, razrez otvoren. Klik na isječak **Mjesečni troškovi** u krugu ⇒ lista samo Mjesečni,
rasklopljeni, staza `Sve › Mjesečni troškovi ✕`; isto **Kvaliteta života**. Klik na sredinu kruga ⇒
razina gore; „Sve"/✕ ⇒ cijela lista. Mobitel: bez promjene (nema kruga).
⚠ Prvi pokušaj „ne radi" = stari bundle (Ctrl+Shift+R riješio). E2E mjeri PRAVI klik mišem (prva
verzija je emitirala događaj i zaobišla put); sabotaža (odspojen handler) ga ruši.

## T-S166-8 ✅ (08.10.) Svjež krug: prvi klik radi

1. Overview → otvori razrez → odmah klik na **Putovanja i pokloni** u krugu ⇒ lista samo taj bucket.
2. Idi u **Add Activity**, zatvori (✕), natrag na Overview → razrez → **prvi** klik na isječak ⇒ isto.
**Pad:** krug se zumira, lista ne ⇒ slušač nije vezan (S166: react-plotly ga u StrictMode-u gubi).

## T-S166-9 ✅ (08.10.) Postotak udjela uz iznos

Laptop, 12 mj, po kupnji: Mjesečni **52,3 %** (od Izašlo 40.127,91); rasklopi ⇒ gotovina **18,2 %**
(od Mjesečnih). U fokusu kruga (Putovanja i pokloni) Tipovi pokazuju udio u bucketu. Retci u minusu
(Porezi, povrati) i djeca roditelja u minusu — bez postotka. Uski ekran: postotak sitno ispod iznosa,
bez vodoravnog scrolla.

## T-S166-10 ⬜ Zadano razdoblje Financija = This Year

TEST već nosi `default_period: this-year` (`set_breakdown.py --apply`, 08.10.). Ctrl+Shift+R:
1. **F5** ⇒ Period = **This Year**, razrez `01.01.–31.12.2026. · iz filtra`, lista samo 2026.
2. Odaberi **All Time** ⇒ ostaje All Time i nakon Activities ↔ Overview.
3. **F5** ⇒ opet This Year. 4. Area **Health_Sasa** ⇒ ponašanje kao prije (nema postavke).
5. Structure export: na retku `Financije_all` kolona **DefaultPeriod** = `this-year`.
Čuva E2E „zadano razdoblje Aree" (sabotaža brane „jednom po Arei" ruši).

## T-S166-11 ⬜ Mobitel: fokus s laptopa ne zaključava redak

Laptop: klik na **Kvaliteta života** u krugu ⇒ DevTools uski ekran ⇒ redak se rasklapa I sklapa
(prije: ostao zaključan otvoren jer je fokus kruga preživio prelazak).

## T-S166-6 ⬜ PROD (s deployem S165, T-S165-9): Koka vidi isto

Nakon deploya, Kokin račun na mobitelu: saldo otvoren, razrez zatvoren; dodir na razrez ⇒ saldo se
sklopi; „kako radi potvrda?" postoji samo njoj (vlasnici), Saši kao grantee-ju ne.
