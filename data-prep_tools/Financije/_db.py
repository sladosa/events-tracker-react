# -*- coding: utf-8 -*-
"""
_db.py — citanje `.env` i pagirani PostgREST GET. S132.

Izdvojeno iz `uskladi_izvod.py`, koji na vrhu radi `import pdfplumber`. Alat
koji prica SAMO s bazom nema razloga vuci PDF biblioteku: `ocisti_auto_komentare.py`
je zbog toga padao na `ModuleNotFoundError: No module named 'pdfplumber'` cim
se pokrene golim `python`om umjesto kroz `run.bat` (dakle na svakom stroju bez
zajednickog venva).

/!\ FUNKCIJE SU PRESELJENE, NE KOPIRANE. `uskladi_izvod` ih re-exporta, pa svih
  devet postojecih pozivatelja (`from uskladi_izvod import load_env, ...`) radi
  dalje bez promjene. Kopija bi znacila dvije verzije pravila o paginaciji, a
  bas to je pravilo koje se ne smije razici (S108).
"""
from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load_env(which):
    fn = '.env.prod.local' if which == 'prod' else '.env.testing'
    path = ROOT / fn
    if not path.exists():
        sys.exit('Nema ' + fn + ' — bez njega alat ne moze citati bazu.')
    env = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        if '=' in line and not line.strip().startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    url = env.get('SUPABASE_URL') or env.get('VITE_SUPABASE_URL')
    key = env.get('SUPABASE_SERVICE_ROLE_KEY') or env.get('VITE_SUPABASE_ANON_KEY')
    if not url or not key:
        sys.exit(fn + ' nema SUPABASE_URL / kljuc.')
    return url, key


def rest(url, key, path):
    """PostgREST reze na 1000 redaka BEZ GRESKE, a paginacija bez `order` je
    tiho pogresna — stranice se preklope i istovremeno preskoce (S108)."""
    out, off = [], 0
    while True:
        req = urllib.request.Request(
            url + '/rest/v1/' + path + '&order=id',
            headers={'apikey': key, 'Authorization': 'Bearer ' + key,
                     'Range': str(off) + '-' + str(off + 999)})
        rows = json.load(urllib.request.urlopen(req))
        out += rows
        off += len(rows)
        if len(rows) < 1000:
            return out
