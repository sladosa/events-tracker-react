# -*- coding: utf-8 -*-
"""
_krug_izvjestaj.py — izvještaj mjesečnog kruga na hrvatskom (S195 korak 4, KRUG_SPEC §4).

Jedan HTML file uz Excel (`krug_<datum>_<HHMM>.html`), otvara se sam u pregledniku.
Čitaju ga Saša i Koka — zato redoslijed nije redoslijed alata nego POSLA:

  1. ZA UVOZ — koji file, što pregled uvoza mora pokazati, koliko odluka
  2. ODLUKE — što Koka bira u stupcu `Delete?` (jedini posao u fileu)
  3. STANI — što ne štima, a alat ne zna predložiti (čovjek mora pogledati)
  4. ČEKA — što se čeka izvan filea (plaćanje Vise, traka 11.)
  5. GOTOVO — što je potvrđeno (i sidra koja je krug upisao)
  6. SAM RIJEŠIO — veze među izvodima, pomaknut dan (da se vidi, ne da se radi)
  7. DETALJI — ispis svakog alata (sklopljeno)

Statičan HTML bez skripti i vanjskih fileova: otvara se i bez mreže i na mobitelu.
"""
from __future__ import annotations

import html
from datetime import datetime

CSS = """
:root { --bg:#fbfaf7; --fg:#1d1d1b; --muted:#6b6b66; --line:#e3e0d8; --card:#ffffff;
        --ok:#2f7d32; --warn:#9a6700; --bad:#b3261e; --accent:#1f5fa8; }
@media (prefers-color-scheme: dark) {
  :root { --bg:#161614; --fg:#ecebe6; --muted:#a3a29c; --line:#34332f; --card:#1f1f1c;
          --ok:#7fc683; --warn:#e3b341; --bad:#ff8a80; --accent:#8ab4f8; } }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--fg); font:16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width:880px; margin:0 auto; padding:24px 16px 48px; }
h1 { font-size:22px; margin:0 0 4px; }
.sub { color:var(--muted); margin:0 0 20px; }
h2 { font-size:17px; margin:28px 0 8px; padding-bottom:4px; border-bottom:1px solid var(--line); }
.card { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:12px 14px; margin:8px 0; }
.big { font-size:18px; font-weight:600; }
.ok { color:var(--ok); } .warn { color:var(--warn); } .bad { color:var(--bad); }
ul { margin:6px 0; padding-left:20px; } li { margin:3px 0; }
.izv { font-weight:600; }
code, .mono { font-family:ui-monospace, Consolas, monospace; font-size:14px; }
details { margin:6px 0; } summary { cursor:pointer; color:var(--accent); }
pre { white-space:pre-wrap; word-break:break-word; font:13px/1.4 ui-monospace, Consolas, monospace;
      background:var(--card); border:1px solid var(--line); border-radius:6px; padding:10px; overflow-x:auto; }
.tag { display:inline-block; font-size:12px; border:1px solid var(--line); border-radius:10px; padding:0 8px; margin-left:6px; color:var(--muted); }
"""

ZNAK = {'gotovo': ('✓', 'ok'), 'excel': ('→', 'warn'), 'sidro': ('⚓', 'ok'),
        'ceka': ('⏳', 'warn'), 'stani': ('✗', 'bad')}


def _e(s) -> str:
    return html.escape(str(s or ''))


def gradi(env: str, danas, stanja, plan: dict | None, excel_ime: str | None,
          razvrstac: list[str], sidra: list[str], preseljeni: list[str], suho: bool) -> str:
    sad = datetime.now()
    o = [f'<!doctype html><html lang="hr"><head><meta charset="utf-8">'
         f'<meta name="viewport" content="width=device-width, initial-scale=1">'
         f'<title>Mjesečni krug {danas:%d.%m.%Y.}</title><style>{CSS}</style></head><body><main>',
         f'<h1>Mjesečni krug · {sad:%d.%m.%Y. %H:%M}</h1>',
         f'<p class="sub">Baza <b>[{_e(env.upper())}]</b>'
         + (' · <b>probni prolaz (--suho): ništa nije upisano ni premješteno</b>' if suho else '')
         + f' · izvoda: {len(stanja)}</p>']

    # 1. ZA UVOZ
    o.append('<h2>1. Za uvoz (Koka)</h2>')
    if plan and excel_ime:
        na = sum(1 for r, a, *_ in plan['redci'] if r is None and a.get('Tip') in (None, 'N/A'))
        o.append('<div class="card">'
                 f'<div class="big">{_e(excel_ime)}</div>'
                 f'<p>U pregledu uvoza mora pisati: <b>{plan["novih"]} New · {plan["izmjena"]} Modify · 0 Delete</b>'
                 + (f'<br><span class="sub">+ {plan["samo_odluka"]} redaka je u fileu samo radi odluke; bez DELETE ih '
                    'uvoz preskoči kao nepromijenjene. Svaki DELETE koji odabereš podigne Delete za 1.</span>'
                    if plan['samo_odluka'] else '') + '</p><ul>'
                 + (f'<li>Odluka u fileu: <b>{plan["odluka"]}</b> — stupac <code>Napomena</code> počinje s '
                    '„ODLUČI", odgovor je u stupcu <code>Delete?</code>.</li>' if plan['odluka'] else '')
                 + (f'<li><b>{na}</b> novih redaka nema Tip (narančasto) — razvrstaj ih u fileu ili poslije u appu.</li>'
                    if na else '')
                 + '<li>Sašine retke uvoz nudi kroz „Ispravi kao vlasnik Aree" — odaberi to.</li>'
                 '<li>Ako brojke u pregledu nisu ove: ne uvozi — Ctrl+Shift+R (stari bundle) ili krivi file.</li>'
                 '<li>Uvozi samo ovaj file — stariji <code>krug_*.xlsx</code> su zastarjeli.</li></ul></div>')
    else:
        o.append('<div class="card"><span class="ok">Nema ničega za uvoz.</span></div>')

    # 2. ODLUKE
    odluke = [(s, eid, t) for s in stanja if s.stanje == 'excel' for eid, t in s.odluke]
    if odluke:
        o.append('<h2>2. Odluke u fileu — stupac Delete?</h2><div class="card"><ul>')
        for s, eid, t in odluke:
            o.append(f'<li><span class="izv">{_e(s.izvod)}</span> <code>{_e((eid or "")[:8])}</code> — {_e(t)}</li>')
        o.append('</ul></div>')

    # 3. STANI
    stani = [s for s in stanja if s.stanje == 'stani']
    if stani:
        o.append('<h2>3. Stani — treba pogledati</h2>')
        for s in stani:
            o.append(f'<div class="card"><span class="bad">✗</span> <span class="izv">{_e(s.izvod)}</span>'
                     f'<p>{_e(s.sazetak)}</p>'
                     + (''.join(f'<li>{_e(t)}</li>' for _, t in s.odluke) and
                        '<ul>' + ''.join(f'<li>{_e(t)}</li>' for _, t in s.odluke) + '</ul>')
                     + '<p class="sub">Ovaj izvod nije u Excelu. Popravi u appu pa pusti krug ponovo.</p></div>')

    # 4. ČEKA
    ceka = [(s, t) for s in stanja for t in s.ceka]
    if ceka:
        o.append('<h2>4. Čeka</h2><div class="card"><ul>')
        for s, t in ceka:
            o.append(f'<li><span class="izv">{_e(s.izvod)}</span> — {_e(t)}</li>')
        o.append('</ul></div>')

    # 5. stanje po izvodu + sidra
    o.append('<h2>5. Stanje po izvodu</h2><div class="card"><ul>')
    for s in stanja:
        z, k = ZNAK.get(s.stanje, ('?', 'warn'))
        o.append(f'<li><span class="{k}">{z}</span> <span class="izv">{_e(s.izvod)}</span>'
                 f'<span class="tag">{_e(s.stanje)}</span><br>{_e(s.sazetak)}</li>')
    o.append('</ul>')
    if sidra:
        o.append('<p><b>Sidra koja je krug upisao</b> (ispisano stanje s izvoda):</p><ul>'
                 + ''.join(f'<li>{_e(t)}</li>' for t in sidra) + '</ul>')
    if preseljeni:
        o.append('<p class="sub">Gotovi izvodi premješteni u <code>Analizirani_izvodi</code>: '
                 + _e(', '.join(preseljeni)) + '</p>')
    o.append('</div>')

    # 6. SAM RIJEŠIO
    sam = [(s, t) for s in stanja for t in s.napomene]
    if sam:
        o.append('<h2>6. Krug je sam riješio</h2><div class="card"><ul>')
        for s, t in sam:
            o.append(f'<li><span class="izv">{_e(s.izvod)}</span> — {_e(t)}</li>')
        o.append('</ul></div>')

    # 7. DETALJI
    o.append('<h2>7. Detalji</h2>')
    if razvrstac:
        o.append('<details><summary>Razvrstač izvoda (OneDrive → izvodi)</summary><pre>'
                 + _e('\n'.join(razvrstac)) + '</pre></details>')
    for s in stanja:
        if s.ispis.strip():
            o.append(f'<details><summary>{_e(s.izvod)} — ispis alata</summary><pre>{_e(s.ispis)}</pre></details>')

    o.append('<h2>Sljedeći korak</h2><div class="card">'
             + ('Nakon uvoza pusti krug ponovo — mora javiti <b>0 New · 0 Modify</b> za ove izvode.'
                if plan else 'Krug se smije pustiti i sutra opet; kad stigne novi izvod, razvrstač ga sam pokupi.')
             + '</div></main></body></html>')
    return '\n'.join(o)
