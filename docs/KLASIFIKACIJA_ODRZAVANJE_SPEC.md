# Održavanje klasifikacije — zaključci i plan (prijedlog prije koda, S153)

> Nastalo 2026-09-27 uz T-S152-2. **Ništa od ovoga nije izvedeno.** Radi se u jednoj budućoj
> sesiji; Backlog stavka upućuje ovamo.

## Zašto

Aplikacija je namjerno **adaptabilna**: klasifikacija (`Tip`/`Podtip` u Financijama, ali i
`exercise-name` u Fitnessu i svaki drugi `suggest` atribut) **raste iz rada** — kroz „Other"
u Add/Editu. Rast je dakle ugrađen; **održavanje nije**. Nakon godina unosa ostaju parovi koji
se ne koriste, rijetki parovi koji bi bili jasniji spojeni, i poneki tipfeler. To nije greška
nego **posljedica rada** — i zato mu treba alat, a ne jednokratno čišćenje.

## Zaključci (izmjereno ili pročitano iz koda, S153)

1. **Rast radi.** „Other" na Finish/Save dodaje vrijednost u `validation_rules`
   (`src/lib/pendingOptions.ts`); Podtip ide **pod Tip odabran u tom trenutku**. Nov Tip + nov
   Podtip u istom unosu rade (Podtip kroz „Other", jer novi Tip nema svoj redak u mapi).
   ⚠ Samo **vlasnik Aree** — grantee spremi redak, ali opcija se ne doda, bez poruke.
   ⚠ X (odustajanje) ne dodaje ništa — ispravno.
2. **Brisanje opcije radi** — Structure uvoz **zamjenjuje** popis opcija (izmjereno S153:
   `TEST` dodan pa maknut iz filea ⇒ nestao iz baze).
   ⚠ **Ali ne dira retke.** Redak koji nosi obrisanu vrijednost zadrži je u `value_text`, a
   dropdown je više ne nudi ⇒ „siroče". Brisanje opcije koja **ima** retke je zato uvijek
   **spajanje**, nikad samo brisanje.
3. **Python alati uče klasifikaciju iz baze** (`presedani.py`, `uvezi_transu.py`: prebrojana
   potvrđena povijest, prag 90 %). Posljedica: **loša klasifikacija se prepisuje na nove
   retke**. Reklasifikacija je zato jeftinija što ranije.
   Tvrdo zapisane taksonomije (`normalize_financije.TAXONOMY`, `apply_rules.SEED_RULES`,
   `migrate_taksonomija.MANUAL_RULES`, `ai_classify`) pripadaju **završenoj** migraciji
   Review workbooka — ne prepisivati ih.
4. **Vrijednost živi na više mjesta nego što izgleda.** Preimenovanje/spajanje mora dirnuti:
   - `value_text` svakog retka s tom vrijednošću;
   - `validation_rules.suggest` (Tip) **i ključ** u `depends_on.options_map` Podtipa
     (Tip je `WhenValue` za Podtip — preimenovan Tip bez preimenovanog ključa ostavi Podtip
     bez ijedne opcije);
   - `default_map` ključeve / vrijednosti ako ih ima;
   - **shortcute** (`activity_presets.default_attributes`, `filter_state`) i filtre u
     `export_profiles` / `dashboard` — ondje stara vrijednost ne javlja grešku nego tiho
     prestane nešto pogađati.
   Alat mora **prebrojati sva mjesta prije pisanja** (pouka S138: „promijenili smo pravilo"
   je tvrdnja o jednom mjestu).
5. **„Rijetko ⇒ spoji" je dobro pravilo, ali broj redaka nije dovoljan kriterij.** Uz broj
   treba **iznos** (jedna kupnja auta je rijedak, a legitiman par) i **datum zadnje upotrebe**
   (par stvoren prošli tjedan je rijedak jer je nov). Nekorišten par (0 redaka) je jedini
   slučaj koji je sigurno obrisati bez odluke.
6. **Odluka je Kokina, ne alatova.** Ona po klasifikaciji radi. Alat pripremi **inventar i
   prijedlog**; čovjek bira. Pitanja Koki samo o onome što samo ona zna (memorija
   `koka_pitanja_su_skup_resurs`).

7. **Structure uvoz danas TIHO pravi siročad** (Sašin nalaz, S153). Opcija maknuta iz filea
   nestane iz dropdowna, a retci koji je nose ostanu — bez ijedne riječi u modalu. Uvoz mora
   **javiti prije primjene**: *„`Status`: opcija `X` se briše — N redaka je još nosi"*.
   ⚠ **Ali uvoz retke ne smije sam prepisivati.** Excel ne može izraziti preimenovanje:
   „nema `A`, ima `B`" je jednako moguće kao *preimenovanje* i kao *brisanje + nova opcija*.
   Pogađanje bi tiho prepisalo stvarne podatke. Zato: uvoz **javi i ponudi** (zaustavi /
   nastavi svjesno), a prepisivanje ide **izričitim mapiranjem** (K2 alat, kasnije „spoji u…").
8. **Grantee i Structure uvoz** — strukturu tuđe Aree grantee ne može mijenjati (RLS od S134),
   ali uvoz toga **ne kaže**: `structureImport` vidi samo vlastite Aree, pa file tuđe Aree
   **tiho stvori duplikat Aree istog imena** pod uvoznikom (CLAUDE.md, S134 — popravak „stani i
   javi" nije napravljen). Isti zahvat kao točka 7: modal mora reći *„ovo je Area od <vlasnik>
   — nemaš pravo mijenjati njenu strukturu"* umjesto da išta napravi.

## Plan rada

**Generično od početka:** alat radi nad bilo kojim `suggest` atributom bilo koje Aree, ne nad
„Financijama". Test generičnosti isti kao za Overview: nova Area traži nula linija koda.

| faza | što | tko | piše po bazi? |
| --- | --- | --- | --- |
| **K-1 — brana na uvozu** | Structure uvoz: prije primjene nabroji opcije koje se brišu **a imaju retke** (broj po opciji) i traži svjesnu potvrdu; file tuđe Aree ⇒ poruka o vlasniku, ništa se ne upisuje. Neovisno o ostalim fazama i vrijedi i bez reklasifikacije. | Claude (app) | ne — sprječava |
| **K0 — inventar** | Po Arei i atributu: svaki par s brojem redaka, Σ iznosa, prvim/zadnjim datumom, autorom; posebno **0 redaka** (opcija bez ijednog retka) i **siročad** (vrijednost na retku koje nema u opcijama). Excel s kolonom `Odluka` (zadrži / spoji u … / preimenuj u … / obriši). | Claude (Python, samo čita) | ne |
| **K1 — odluka** | Koka (uz Sašu) popuni `Odluka`. Nekorišteni parovi mogu biti predloženi kao „obriši" unaprijed. | Koka / Saša | ne |
| **K2 — alat** | Iz tablice odluka generira **(a)** app Excel pogođenih redaka (`event_id` ostaje, kol. G = autor retka, pregled nabroji svaku promjenu) i **(b)** Structure file s novim popisom opcija i preimenovanim `WhenValue` ključevima; uz to **ispiše** shortcute/profile/dashboard koji spominju staru vrijednost. Dry run prvo. | Claude | ne — generira fileove |
| **K3 — primjena** | Koka uveze **prvo Activities** (retci dobiju novu vrijednost), **pa Structure** (stara opcija nestane). Obrnutim redom bi retci na trenutak bili siročad. Backup prije. | Koka | da, kroz app |
| **K4 — provjera** | Ponovni inventar: 0 siročadi, 0 nekorištenih, zbroj iznosa po Areu nepromijenjen (spajanje ne smije pomaknuti nijedan euro). | Claude | ne |
| **K5 — kasnije, u appu** | Uz svaku opciju u Structure panelu **broj redaka** (i sivo za 0), te akcija „spoji u…". Tada održavanje postaje dio rada, ne projekt. Tek kad K0–K4 pokažu koji su koraci stvarno potrebni. | — | — |

⚠ **Prije K3 na PROD-u:** probati cijeli krug na TEST-u (K0→K4) — Structure uvoz s preimenovanim
`WhenValue` ključem je put koji do sada nije mjeren.
