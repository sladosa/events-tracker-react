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
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def target() -> str:
    """Baza na koju alat gadja: `ET_TARGET`, bez njega TEST. S158.

    /!\\ Do S158 su alati mjesecnog toka birali bazu na TRI nacina: `ET_TARGET`
        (bez njega TEST), `uskladi_izvod --env` i `rate_alat --env` (bez njega
        PROD!) i `fill_from_izvod --presedan`. Ista naredba je tako ovisno o alatu
        gadjala suprotne baze. Pravilo je isto kao `verify_rpc_vs_model`, a
        nepoznata vrijednost PADA (`prd` bi inace tiho bio TEST).
    """
    t = os.environ.get('ET_TARGET', 'test').strip().lower()
    if t not in ('test', 'prod'):
        sys.exit("✗ ET_TARGET='" + t + "' — dopušteno je samo 'test' ili 'prod'.")
    return t


def cat_transakcija(url, key) -> str:
    """ID kategorije `Financije_all > Transakcija` u bazi na koju alat gadja. S158.

    /!\\ Bio je tvrdo upisan PROD ID (`CAT_PROD`), pa je alat nad TEST bazom
        uredno nasao 0 redaka umjesto da javi gresku — „prazno" i „nije ni
        pitao" izgledaju isto. TEST je kopija PROD-a (`prod_to_test.py`) s
        drugim ID-ovima, pa se kategorija trazi po imenu.
    """
    areas = rest(url, key, 'areas?name=eq.Financije_all&select=id')
    if len(areas) != 1:
        sys.exit('✗ Area `Financije_all`: nadjeno ' + str(len(areas)) + ', ocekivana tocno jedna.')
    cats = rest(url, key, 'categories?area_id=eq.' + areas[0]['id']
                + '&name=eq.Transakcija&select=id')
    if len(cats) != 1:
        sys.exit('✗ Kategorija `Transakcija`: nadjeno ' + str(len(cats)) + ', ocekivana tocno jedna.')
    return cats[0]['id']


def load_env(which):
    # /!\ TEST je do S158 bio `.env.testing`, a on nosi SAMO anon kljuc ⇒ RLS je
    #     alatu pokazivao 6 javnih/demo Area, bez `Financije_all`, i to bez ijedne
    #     greske (isti razred kao backup anon kljucem, S134). `.env.local` gadja
    #     ISTI projekt sa service kljucem i njega cita i `verify_rpc_vs_model`.
    fn = '.env.prod.local' if which == 'prod' else '.env.local'
    path = ROOT / fn
    if not path.exists():
        sys.exit('Nema ' + fn + ' — bez njega alat ne moze citati bazu.')
    env = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        if '=' in line and not line.strip().startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    url = env.get('SUPABASE_URL') or env.get('VITE_SUPABASE_URL')
    key = env.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        # Anon kljuc NIJE zamjena: kroz RLS alat vidi dio baze i uredno ga obradi.
        sys.exit(fn + ' nema SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY '
                 '(anon kljuc bi kroz RLS dao djelomicnu bazu bez greske).')
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
