# Overview — Help

Tab koji pokazuje **stanje jedne Aree sada**: stanja po računu, koliko je planirano, i slaže
li se to s bankom.

## Zašto ga neke Aree nemaju

Overview se pojavljuje **samo za Aree koje imaju konfiguraciju pločica**. Razlog: da bi se
saldo izračunao, netko mora reći koji je atribut "novac unutra", koji "novac van", po čemu se
grupira i koje vrijednosti znače "već se dogodilo". Model to sam ne zna — `Uplata` mu je
običan broj, isti kao `Težina`.

Zato Area bez te konfiguracije **nema tab**, umjesto da ima prazan. Konfiguracija se za sad
upisuje ručno u bazu (`areas.settings.dashboard`); nema još sučelja za nju.

Redoslijed tabova je `Overview → Activities → Structure`.

## Pločica „Stanje po računu"

Za svaki račun prikazuje:

- **veliki broj** — izvršeni saldo (novac koji se stvarno pomaknuo)
- **podnaslov** — otkad se broji: „od potvrde 15.08.2026." ili „od početka podataka"
- **„planirano"** — obveze koje još nisu naplaćene, odvojeno u dva smjera (odlazi / dolazi)
- **„u banci"** — polje u koje upišeš broj koji vidiš u bankovnoj aplikaciji
- **čip** — `✓ slaže se` ili `Δ 49,00`

Klik na **iznos** otvara Activities filtriran na taj račun. Klik na **„planirano"** otvara
planirane zapise.

⚠ Pločica se osvježava pri **ulasku u tab** i na **↻** gumb. Ako ostaneš na Overviewu dok se
podatak mijenja drugdje, klikni ↻.

## Što točno miče saldo (i zašto nije zbroj po računu)

U saldo ulaze samo zapisi kod kojih se novac **već pomaknuo** — za Financije to znači
`Izvor = Racun` ili `Cash`. Kartična kupovina (`Visa`, `Mastercard`) **ne** ulazi, jer račun
tereti tek skupna naplata kartice, koja je zaseban zapis.

Da se zbrajalo naivno "sve po računu", ista bi se potrošnja brojila **dvaput**: jednom kao
kupovina, drugi put kao naplata kartice. Razlika nije mala — na stvarnim podacima naivni zbroj
promaši bankovni iznos za desetke tisuća eura.

**Transfer između vlastitih računa se broji** u saldo (novac je stvarno otišao), ali **ne
ulazi** u razrez troška po Tipu (prebacivanje sebi nije potrošnja). Isti zapis, dva pravila —
namjerno.

## Sidro — „Potvrdi"

Saldo se **ne** računa od početka povijesti nego od zadnjeg **potvrđenog stanja**:

```
saldo = potvrđeno stanje + sve promjene STROGO nakon dana potvrde
```

Kako se potvrđuje: otvoriš bankovnu aplikaciju, prepišeš broj u polje **„u banci"**, klikneš
**„Potvrdi"**. Od tog trenutka app zbraja samo ono što se dogodilo **poslije** tog dana.

Tri stvari koje je korisno znati:

- **Potvrda se datira na danas.** Zapis datiran **na sam dan potvrde ne ulazi** u saldo —
  pravilo je "strogo nakon", bez iznimke. To sprječava da se isti iznos broji dvaput.
- **Ispravak je nova potvrda**, ne izmjena stare. Čuva se povijest svih potvrda, pa se vidi
  otkad se app i banka razilaze.
- **Dok potvrde nema**, pločica zbraja cijelu povijest i to **izričito piše**
  („od početka podataka"). Nikad tiho.

Potvrdu može upisati vlasnik Aree i osoba s **write** pristupom. Tko ima samo pregled, vidi
brojeve ali nema gumb.

## Što znači Δ

`Δ 49,00` znači: **aplikacija pokazuje 49 € više nego banka.** Negativna razlika znači obrnuto.

**Δ nije greška izračuna** — to je signal da nešto fali, nešto je upisano dvaput, ili je iznos
kriv. Očekivano je da se pojavi i kad je model točan, jer povijesni podaci imaju poznatih
nesavršenosti. Kad se pojavi, klik na iznos vodi u listu gdje se traži uzrok.

## Kolona `Stanje` u Activities listi

Kad je lista filtrirana **na jedan račun** i sortirana **najnovije prvo**, uz svaki redak se
pojavi izračunato stanje nakon tog retka. Jedan broj kaže "nešto ne štima"; kolona kaže
"ne štima **od ovog retka**".

Kolona se **ne** prikazuje kad su računi izmiješani ili kad je sort obrnut — u oba slučaja
tekući zbroj ne bi imao smisla.

Crtica `—` uz redak znači jedno od dvoje: redak ne miče saldo (npr. kartično plaćanje), ili je
stariji od potvrđenog stanja pa mu tekući saldo nije definiran.

## Ako pločica javi grešku

Crvena kutija s porukom znači da konfiguracija pokazuje na atribut koji više ne postoji —
najčešće nakon preimenovanja sluga atributa. Poruka **imenuje** taj slug. Preimenovanje kroz
Structure Edit Mode popravlja referencu automatski; ručna izmjena u bazi ne.

## Unos iz Overviewa

Gumb **Add Activity** i **⚡ Use** (Shortcut) rade i iz Overviewa, čim je odabrana leaf
kategorija. Nakon spremanja vraćaš se na Overview i saldo je preračunat.
