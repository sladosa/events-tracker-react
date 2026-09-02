/**
 * Events Tracker – Excel Export Modal
 * =====================================
 * Export Activities to Excel with:
 * - Filter-aware (uses FilterContext)
 * - Export Profiles (column grouping recipes)
 * - Preview mode (10 rows for profile creation)
 * - Import Profile from xlsx (reads column grouping state)
 * - Pagination for large exports
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';
import { supabase } from '@/lib/supabaseClient';
import { useFilter } from '@/context/FilterContext';
import { loadExportData, loadStructureNodes, loadSharedEmailsByArea, loadCategoriesForExport, resolveExportCategoryIds, countEventsForExport } from '@/lib/excelDataLoader';
import { createEventsExcel, mergeSessionEvents } from '@/lib/excelExport';
import { createDeltaExcel } from '@/lib/deltaSheet';
import { useAreaDashboard } from '@/hooks/useAreaDashboard';
import { listAnchors, fetchAnchoredBalance } from '@/lib/overviewApi';
import { timestampSuffix, type FilterSheetInfo } from '@/lib/excelUtils';
import type { ExportFilters } from '@/lib/excelTypes';
import { readProfileFromWorkbook, readProfileNameFromWorkbook, readFilterFromWorkbook, sanitizeProfileName, deriveDeltaAccount, type ExportProfiles, type ProfileFilterState } from '@/lib/exportProfile';
import { resolvePeriodKey, type PeriodKey } from '@/hooks/useDateBounds';
import { ATTR_FILTER_ANY } from '@/lib/eventQueryBuilder';
import type { ExportAttrDef } from '@/lib/excelTypes';

interface ExcelExportModalProps {
  onClose: () => void;
}

const DEFAULT_BATCH_SIZE = 10000;
const MIN_BATCH = 2;
const MAX_BATCH = 50000;
const PREVIEW_LIMIT = 10;
/** Koliko praznih redaka nudi delta sheet. ~40 = sest tjedana Kokinog tempa. */
const DELTA_BLANK_ROWS = 40;
/**
 * Koliko dana unatrag delta sheet pokazuje.
 * ⚠ Prozor NIJE isto sto i sidro. Sidro moze biti staro godinu i pol (RF: 02.01.2025),
 *   pa bi "od sidra do danas" dalo 1.000+ redaka za usklađenje zadnjih par tjedana.
 *   Prozor je kratak, a kontrolni stupac krece od stanja koje aplikacija racuna
 *   na dan prije prozora.
 */
const DELTA_WINDOW_DAYS = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseAttrFilterRaw(
  raw: string,
  attrDefs?: ExportAttrDef[],
): { attrDefId: string; value: string; isExact: boolean } | null {
  // Format: "slug: =value" or "slug: ~value" or "*: ~value" or legacy "uuid: =value"
  const match = raw.match(/^([^:]+):\s*([=~])(.+)$/);
  if (!match) return null;
  const key = match[1].trim();
  const isExact = match[2] === '=';
  const value = match[3];

  if (key === '*') return { attrDefId: ATTR_FILTER_ANY, isExact: false, value };
  if (UUID_RE.test(key)) return { attrDefId: key, isExact, value };
  // Slug lookup
  if (attrDefs) {
    const def = attrDefs.find(d => d.slug === key);
    if (def) return { attrDefId: def.id, isExact, value };
  }
  return null;
}

async function resolveAttrDefsForSlug(
  _userId: string,
  areaId?: string | null,
  categoryId?: string | null,
): Promise<ExportAttrDef[]> {
  let query = supabase.from('attribute_definitions')
    .select('id, category_id, name, slug, data_type, unit, is_required, default_value, validation_rules, sort_order, description');
  if (categoryId) {
    query = query.eq('category_id', categoryId);
  } else if (areaId) {
    const { data: cats } = await supabase.from('categories').select('id').eq('area_id', areaId);
    if (cats?.length) query = query.in('category_id', cats.map(c => c.id));
  }
  const { data } = await query;
  return (data ?? []) as ExportAttrDef[];
}

function formatAttrFilterDesc(
  af: { attrDefId: string; value: string; isExact: boolean },
  attrDefs?: ExportAttrDef[],
): string {
  const op = af.isExact ? '=' : '~';
  if (af.attrDefId === ATTR_FILTER_ANY) return `*: ${op}${af.value}`;
  const def = attrDefs?.find(d => d.id === af.attrDefId);
  const label = def?.slug || af.attrDefId;
  return `${label}: ${op}${af.value}`;
}

function applyProfileFilterOverrides(
  baseFilters: ExportFilters,
  pfs: ProfileFilterState,
  attrDefs?: ExportAttrDef[],
): { filters: ExportFilters; overrideLabel: string | null; periodKeyOverride: string | null } {
  const filters = { ...baseFilters };
  const parts: string[] = [];
  let periodKeyOverride: string | null = null;

  if (pfs.periodKey) {
    if (pfs.periodKey === 'all-time') {
      // resolvePeriodKey('all-time') returns null by design (no resolvable
      // range) — handle it explicitly so the override actually clears dates
      // instead of silently leaving the live filter's date range in place.
      filters.dateFrom = null;
      filters.dateTo = null;
      periodKeyOverride = pfs.periodKey;
      parts.push('Period: all-time');
    } else if (pfs.periodKey === 'custom') {
      // Mirrors the live UI: explicit From/To dates + Period = "Custom".
      // Only applies if readFilterFromWorkbook found valid ISO dates.
      if (pfs.dateFrom && pfs.dateTo) {
        filters.dateFrom = pfs.dateFrom;
        filters.dateTo = pfs.dateTo;
        periodKeyOverride = pfs.periodKey;
        parts.push(`Period: custom (${pfs.dateFrom} → ${pfs.dateTo})`);
      }
    } else {
      const resolved = resolvePeriodKey(pfs.periodKey as PeriodKey);
      if (resolved) {
        filters.dateFrom = resolved.from;
        filters.dateTo = resolved.to;
        periodKeyOverride = pfs.periodKey;
        parts.push(`Period: ${pfs.periodKey}`);
      }
    }
  }
  if (pfs.sortOrder) {
    filters.sortOrder = pfs.sortOrder;
    parts.push(`Sort: ${pfs.sortOrder === 'asc' ? 'Oldest first' : 'Newest first'}`);
  }
  if (pfs.commentSearch) {
    filters.commentSearch = pfs.commentSearch;
    parts.push(`Comment: "${pfs.commentSearch}"`);
  }
  if (pfs.attrFilterRaw) {
    if (pfs.attrFilterRaw === '_') {
      // "_" sentinel = explicitly clear the attribute filter (same convention
      // as Excel Import/Structure Import). Distinct from a blank cell, which
      // means "no override — inherit whatever the live filter has".
      filters.attrFilter = null;
      parts.push('Attr filter: (cleared)');
    } else {
      const parsed = parseAttrFilterRaw(pfs.attrFilterRaw, attrDefs);
      if (parsed) {
        filters.attrFilter = parsed;
        parts.push(`Attr filter: ${parsed.value}`);
      }
    }
  }

  return { filters, overrideLabel: parts.length > 0 ? parts.join(', ') : null, periodKeyOverride };
}

export function ExcelExportModal({ onClose }: ExcelExportModalProps) {
  const { filter, selectedArea, sharedContext } = useFilter();

  const [totalCount,  setTotalCount]  = useState<number | null>(null);
  const [batchSize,   setBatchSize]   = useState(DEFAULT_BATCH_SIZE);
  const [deltaMode,   setDeltaMode]   = useState(false);
  const [deltaDays,   setDeltaDays]   = useState(DELTA_WINDOW_DAYS);
  // Broj praznih redaka je postavka, ne konstanta: tranša s izvoda zna imati
  // 110 redaka, a redak koji ne stane u pripremljene prazne pada IZVAN dosega
  // kontrolnog stupca — kontrolna brojka bi tada bila uvjerljiva, a nepotpuna.
  const [deltaBlanks, setDeltaBlanks] = useState(DELTA_BLANK_ROWS);
  const [fileCount,   setFileCount]   = useState(1);
  const [currentFile, setCurrentFile] = useState(0);   // 0 = idle, >0 = generating file N
  const [loadingCount, setLoadingCount] = useState(true);
  const [error,       setError]       = useState('');

  // Export Profile state
  const [profiles, setProfiles]           = useState<ExportProfiles>({});
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [importing, setImporting]         = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filters: ExportFilters = {
    areaId:     filter.areaId,
    categoryId: filter.categoryId,
    dateFrom:   filter.dateFrom,
    dateTo:     filter.dateTo,
    sortOrder:  filter.sortOrder,
    commentSearch: filter.commentSearch,
    attrFilter: filter.attrFilter,
  };

  // Za koju je Areu profil vec automatski odabran — da se izbor ne namece
  // ponovno nakon sto ga korisnik svjesno makne na „No profile".
  const autoPickedForArea = useRef<string | null | undefined>(undefined);

  // Load profiles from area.settings on mount
  useEffect(() => {
    const loaded = (selectedArea?.settings?.export_profiles ?? {}) as ExportProfiles;
    setProfiles(loaded);

    // ⚠ Prvi profil se bira SAM, i to je namjerno. Bez profila izvoz izade u
    //   punoj sirini (svih 12 skrivenih kolona se pokaze) — dakle zaboravljen
    //   klik ne daje gresku nego neuredan file, i to bas onaj koji korisnik
    //   nije htio. Zadano stanje zato nije „bez profila" nego prvi profil Aree.
    //   ⚠ Bira se JEDNOM po Arei: makne li ga korisnik na „No profile", efekt se
    //     ne ponavlja (ovisi o `selectedArea`), pa mu se izbor ne prepisuje.
    //   ⚠ Uz to cisti zastarjeli izbor: profili su per-Area, pa bi ime iz druge
    //     Aree ostalo u dropdownu i pokazivalo profil koji ondje ne postoji.
    const areaId = selectedArea?.id ?? null;
    if (autoPickedForArea.current !== areaId) {
      autoPickedForArea.current = areaId;
      setSelectedProfile(Object.keys(loaded)[0] ?? '');
    }
  }, [selectedArea]);

  // Load total count on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingCount(true);
    setError('');

    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const categoriesDict = await loadCategoriesForExport(user.id);
        const categoryIds    = await resolveExportCategoryIds(user.id, filters, categoriesDict);
        const total          = await countEventsForExport(user.id, filters, categoryIds);

        if (!cancelled) {
          setTotalCount(total);
          setFileCount(Math.max(1, Math.ceil(total / batchSize)));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message
          : (typeof err === 'object' && err !== null && 'message' in err)
            ? String((err as { message: unknown }).message)
            : JSON.stringify(err);
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoadingCount(false);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.areaId, filter.categoryId, filter.dateFrom, filter.dateTo, filter.sortOrder]);

  // Recompute file count when batch size changes
  useEffect(() => {
    if (totalCount !== null) {
      setFileCount(Math.max(1, Math.ceil(totalCount / batchSize)));
    }
  }, [batchSize, totalCount]);

  // -- Delta sheet (Faza 1) --------------------------------------------
  // Uvjeti salda ZIVE U CONFIGU Aree, ne ovdje - isti izvor iz kojeg ih cita RPC.
  // Bez `balance_by_group` plocice Area nema pojam "stanje racuna" i ponuda se
  // ne prikazuje uopce.
  const { config: dashboardCfg } = useAreaDashboard(filter.areaId);
  const balanceWidget = useMemo(
    () => dashboardCfg?.widgets.find(w => w.type === 'balance_by_group') ?? null,
    [dashboardCfg],
  );
  // Racun dolazi iz filtra atributa - drill s plocice ga upravo tako postavlja.
  // ⚠ Kad je odabran profil s vlastitim filtrom atributa, racun mora doci odande
  //   odakle i eventi — v. `deriveDeltaAccount` za razlog i za izmjereni slucaj.
  const deltaAccount = useMemo(
    () => deriveDeltaAccount(
      selectedProfile ? profiles[selectedProfile]?.filterState?.attrFilterRaw : undefined,
      balanceWidget?.group_by,
      filter.attrFilter?.value,
    ),
    [selectedProfile, profiles, balanceWidget, filter.attrFilter],
  );
  const deltaReady   = !!balanceWidget && !!deltaAccount;

  // ── Core download ─────────────────────────────────────────────────
  const doDownload = useCallback(async (fileIndex: number, previewMode: boolean) => {
    try {
      setError('');
      setCurrentFile(fileIndex);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const profileName = selectedProfile || undefined;
      const activeProfile = profileName ? profiles[profileName] ?? null : null;

      // Apply profile filter overrides (if profile has saved filter state)
      let effectiveFilters = filters;
      let effectivePeriodKey: string | undefined = filter.periodKey;
      let effectiveCommentSearch = filter.commentSearch;
      let effectiveAttrFilter = filter.attrFilter;

      if (activeProfile?.filterState && !previewMode) {
        // Resolve attrDefs BEFORE building overrides — parseAttrFilterRaw needs
        // them to look up a slug-based filter (e.g. "racun: =Sašin tekući RF").
        // Without attrDefs, slug lookups silently fail and the live filter's
        // attrFilter stays in effect instead of the profile's override.
        const attrFilterRaw = activeProfile.filterState.attrFilterRaw;
        const attrDefsForOverride = attrFilterRaw && attrFilterRaw !== '_'
          ? await resolveAttrDefsForSlug(user.id, filters.areaId, filters.categoryId)
          : undefined;
        const overrides = applyProfileFilterOverrides(filters, activeProfile.filterState, attrDefsForOverride);
        effectiveFilters = overrides.filters;
        if (overrides.periodKeyOverride) {
          effectivePeriodKey = overrides.periodKeyOverride;
        }
        if (activeProfile.filterState.commentSearch !== undefined) {
          effectiveCommentSearch = activeProfile.filterState.commentSearch;
        }
        if (attrFilterRaw) {
          // attrFilterRaw was present (real filter or "_" clear sentinel) —
          // effectiveFilters.attrFilter is now authoritative, including null
          // (explicitly cleared). Falls through to the live value otherwise.
          effectiveAttrFilter = effectiveFilters.attrFilter ?? null;
        }
      }

      // Delta sheet: prozor krece OD DANA NAKON sidra. Sidro je "potvrdjeno
      // stanje na dan X", a saldo su promjene STROGO nakon njega (paragraf 2.17)
      // - pa bi redak datiran tocno na X bio prikazan, usao u kontrolnu formulu
      // i razisao sheet s plocicom za taj iznos.
      let deltaAnchor:  { amount: number; confirmed_on: string } | null = null;
      let deltaOpening: { amount: number; asOf: string } = { amount: 0, asOf: '' };
      if (deltaMode && balanceWidget && !previewMode) {
        if (!deltaAccount) throw new Error('Delta sheet: nije odabran racun (filtar atributa je prazan).');
        if (!effectiveFilters.areaId) throw new Error('Delta sheet: nije odabrana Area.');

        const today   = new Date().toISOString().slice(0, 10);
        const anchors = (await listAnchors(effectiveFilters.areaId, balanceWidget.group_by))
          .filter(a => a.group_value === deltaAccount && a.confirmed_on <= today)
          // Isti izbor koji radi RPC: najnovije potvrdjeno, a kod istog datuma
          // ono zadnje upisano (tako se tipfelerica ispravlja novim retkom).
          .sort((a, b) => (a.confirmed_on === b.confirmed_on
            ? String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
            : b.confirmed_on.localeCompare(a.confirmed_on)));

        deltaAnchor = anchors[0]
          ? { amount: anchors[0].amount, confirmed_on: anchors[0].confirmed_on }
          : null;

        // Prozor: kasniji od (dan nakon sidra) i (danas - N dana).
        // ⚠ `Date.UTC` uzima mjesec 0-based. Bez `-1` je prozor kretao MJESEC
        //   DANA prekasno: sidro 11.08. davalo je „stanje 11.09." i tiho
        //   izostavljalo sve retke iz tog mjeseca — a usklađenje bez njih
        //   izgleda uredno jer ih sheet uopće ne pokaže.
        const dayAfterAnchor = (() => {
          if (!deltaAnchor) return null;
          const [y, m, d] = deltaAnchor.confirmed_on.split('-').map(Number);
          return new Date(Date.UTC(y, m - 1, d) + 86400000);
        })();
        const nDaysAgo = new Date(Date.now() - deltaDays * 86400000);
        const startMs  = Math.max(dayAfterAnchor?.getTime() ?? 0, nDaysAgo.getTime());
        const start    = new Date(startMs).toISOString().slice(0, 10);
        const dayBefore = new Date(startMs - 86400000).toISOString().slice(0, 10);

        // Otvarajuce stanje = ono sto aplikacija racuna na dan PRIJE prozora.
        // Isti RPC koji hrani plocicu, pa se sheet i plocica ne mogu razici.
        const openRows = await fetchAnchoredBalance({
          areaId: effectiveFilters.areaId,
          groupSlug: balanceWidget.group_by,
          plusSlug: balanceWidget.plus ?? null,
          minusSlug: balanceWidget.minus ?? null,
          filters: balanceWidget.filters ?? [],
          asOf: dayBefore,
        });
        deltaOpening = {
          amount: openRows.find(r => r.group_value === deltaAccount)?.balance ?? 0,
          asOf:   dayBefore,
        };

        effectiveFilters = { ...effectiveFilters, dateFrom: start, sortOrder: 'asc' };
      }

      const limit = previewMode ? PREVIEW_LIMIT : batchSize;
      const offset = previewMode ? 0 : (fileIndex - 1) * batchSize;

      const [bundle, structureNodes, sharedWithByArea] = await Promise.all([
        loadExportData(user.id, effectiveFilters, offset, limit),
        loadStructureNodes(user.id),
        loadSharedEmailsByArea(user.id),
      ]);
      const merged = mergeSessionEvents(bundle.events, bundle.categoriesDict);

      const eventDates = bundle.events.map(e => e.event_date).filter(Boolean).sort();
      const firstRecord = eventDates.length > 0 ? eventDates[0] : undefined;
      const lastRecord  = eventDates.length > 0 ? eventDates[eventDates.length - 1] : undefined;

      const catValues = Object.values(bundle.categoriesDict);
      const areaName     = effectiveFilters.areaId
        ? catValues.find(c => c.area_id === effectiveFilters.areaId)?.area_name ?? null
        : null;
      const categoryPath = effectiveFilters.categoryId
        ? bundle.categoriesDict[effectiveFilters.categoryId]?.full_path ?? null
        : null;

      const ts = timestampSuffix();
      const filterInfo: FilterSheetInfo = {
        exportType:  'Activities',
        exportedAt:  ts,
        area:        areaName,
        category:    categoryPath,
        dateFrom:    effectiveFilters.dateFrom,
        dateTo:      effectiveFilters.dateTo,
        sortOrder:   effectiveFilters.sortOrder ?? 'desc',
        firstRecord: effectiveFilters.dateFrom ? undefined : firstRecord,
        lastRecord:  effectiveFilters.dateTo   ? undefined : lastRecord,
        periodKey:   effectivePeriodKey,
        commentSearch: effectiveCommentSearch || undefined,
        attrFilterDesc: effectiveAttrFilter
          ? formatAttrFilterDesc(effectiveAttrFilter, bundle.attrDefs)
          : undefined,
        exportProfile: profileName,
      };

      if (deltaMode && balanceWidget && !previewMode) {
        // ⚠ Ne smije ovisiti SAMO o prvom retku: usklađen račun daje prazan
        //   prozor (sve prije sidra), a tada prazni retci predloška ostanu bez
        //   `Area` i `Category_Path`. Redak bez `Area` uvoz ne vidi kao redak —
        //   dakle upravo kad je račun u najboljem stanju, predložak je neupotrebljiv.
        //   Zato: prvi redak ako postoji, inače kategorija odabrana u filtru.
        const first = merged[0];
        const cat   = (first ? bundle.categoriesDict[first.category_id] : undefined)
          ?? (filter.categoryId ? bundle.categoriesDict[filter.categoryId] : undefined);

        // Prepisuje se SAMO ono sto je izvedivo iz configa: grupa (racun) i
        // jednovrijednosni `in` uvjeti. `not_in` se ne da okrenuti u vrijednost
        // ("nije Planiran" nije "Izvrsen"), pa ta polja ostaju prazna - a to je
        // u redu: i RPC i Excel prazno tretiraju kao "nije Planiran".
        const nameBySlug = new Map<string, string>();
        for (const d of bundle.attrDefs) if (d.slug) nameBySlug.set(d.slug, d.name);

        const prefill: Record<string, string | number | boolean> = {};
        const groupName = nameBySlug.get(balanceWidget.group_by);
        if (groupName) prefill[groupName] = deltaAccount;
        for (const f of balanceWidget.filters ?? []) {
          const n = nameBySlug.get(f.slug);
          if (n && f.op === 'in' && f.values.length === 1) prefill[n] = f.values[0];
        }

        // U sheet idu SAMO retci koji micu saldo ovog racuna: uvjeti `in` iz
        // configa (Izvor = Racun). `not_in` se NE primjenjuje - planirani retci
        // moraju ostati vidljivi da ih korisnik POTVRDI umjesto da ih dopise
        // ponovno; kontrolni stupac ih ionako ne broji dok su planirani.
        const idsBySlug = new Map<string, Set<string>>();
        for (const d of bundle.attrDefs) {
          if (!d.slug) continue;
          if (!idsBySlug.has(d.slug)) idsBySlug.set(d.slug, new Set());
          idsBySlug.get(d.slug)!.add(d.id);
        }
        const passes = (ev: typeof merged[number], slug: string, values: string[]) => {
          const ids = idsBySlug.get(slug);
          if (!ids) return true;
          return (ev.event_attributes ?? []).some(
            a => ids.has(a.attribute_definition_id) && a.value_text != null && values.includes(a.value_text),
          );
        };
        const deltaRows = merged.filter(ev =>
          passes(ev, balanceWidget.group_by, [deltaAccount]) &&
          (balanceWidget.filters ?? []).every(f => f.op !== 'in' || passes(ev, f.slug, f.values)),
        );

        // -- Sekcija "planirano" / cijela KOSARA ------------------------
        // /!\ Ovi retci su IZVAN prozora: kartcna stavka ne mice saldo, pa je
        //   prozor (sidro+1 .. danas) uopce ne pokriva -- a rate s naplatom
        //   11.07. uz sidro 30.07. su bas one koje treba potvrditi. Zato zaseban
        //   upit, bez datumske granice.
        //
        // /!\ ZASTO NE SAMO `Status = Planiran` (izmjereno na PROD-u 2026-09-02)
        //   Kosara koja dolazi 03.09. imala je 10 redaka / 205,36. Devet ih je
        //   `Planiran`, a jedan (gorivo 55,00) je rucno prebacen u `Izvrsen` bez
        //   ijedne potvrde s izvoda. Taj je ispadao iz OBJE strane: iz glavnog
        //   bloka jer je kartcni pa ne mice saldo, iz sekcije jer nije
        //   `Planiran`. Kontrola kosare bi pokazala razliku od tocno 55,00 koju
        //   na listu nista ne objasnjava -- a redak nije bio ni u fileu, pa se
        //   nije dao ispraviti ni uvozom.
        //   Zato u sekciju ide i sve cije DOSPIJECE jos nije proslo, bez obzira
        //   na `Status`.
        //
        // /!\ PRAG JE "DANAS", NE SIDRO. Sidro bi za ZABA-u vratilo 47 vec
        //   potvrdjenih redaka kosare 11.08. (izmjereno) -- sekcija koja svaki
        //   mjesec ponovi zatvorenu kosaru je sum, a sum se prestane citati.
        //
        // /!\ `due_slug` dolazi IZ CONFIGA (OVERVIEW_TAB_SPEC 2.15: rjecnik u
        //   kodu, semantika Aree u configu). Bez njega je ponasanje danasnje.
        const notInFilters = (balanceWidget.filters ?? []).filter(f => f.op === 'not_in');
        const dueSlug = balanceWidget.split?.due_slug;
        let plannedRows: typeof merged = [];
        if (notInFilters.length > 0) {
          const statusDef = bundle.attrDefs.find(d => d.slug === notInFilters[0].slug);
          if (statusDef) {
            // Grana `Planiran`: jeftin upit, jer planiranih ima dvadesetak u
            // cijeloj Arei. Bez datumske granice — rate su starije od prozora.
            const plannedBundle = await loadExportData(user.id, {
              ...effectiveFilters,
              dateFrom: null,
              dateTo: null,
              commentSearch: '',
              attrFilter: { attrDefId: statusDef.id, value: notInFilters[0].values[0], isExact: true },
            });
            // /!\ Grana "dospijece jos otvoreno" ide iz VEC UCITANOG `merged`,
            //   ne iz novog upita. Prvi pokusaj je za nju vukao cijeli racun
            //   (RF 1.081, ZABA 1.261 redaka) i izvoz je vidljivo stao — posao
            //   se udvostrucio za saku redaka. `merged` je ionako u memoriji.
            //   Cijena: redak s otvorenim dospijecem koji je IZVAN datumskog
            //   filtra izvoza, a nije `Planiran`, nece uci. Usko, i vidljivo:
            //   takav redak je kupovina stara koliko i filtar, a kartcna
            //   kupovina dospijeva unutar mjesec-dva.
            const dueIds = dueSlug ? idsBySlug.get(dueSlug) : undefined;
            // /!\ Lokalni datum, ne `toISOString()`: navecer bi UTC dao SUTRA,
            //   pa bi kosara koja dospijeva danas ispala iz sekcije.
            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const dueStillOpen = (ev: typeof merged[number]) =>
              !!dueIds && (ev.event_attributes ?? []).some(
                a => dueIds.has(a.attribute_definition_id) &&
                     a.value_datetime != null &&
                     String(a.value_datetime).slice(0, 10) >= today,
              );
            // "Mice saldo" = svi `in` uvjeti prolaze I nijedan `not_in` ne
            // prolazi. Takav redak je posao GLAVNOG bloka; u sekciju ne smije
            // ni kad ga prozor ne pokriva, inace isti novac stoji dvaput.
            const movesBalance = (ev: typeof merged[number]) =>
              (balanceWidget.filters ?? []).every(f =>
                f.op === 'in' ? passes(ev, f.slug, f.values) : !passes(ev, f.slug, f.values));

            const deltaIds = new Set(deltaRows.map(e => e.id));
            const seen = new Set<string>();
            plannedRows = [
              ...mergeSessionEvents(plannedBundle.events, plannedBundle.categoriesDict),
              ...(dueSlug ? merged : []),
            ].filter(ev => {
              if (seen.has(ev.id)) return false;          // dva izvora, jedan redak
              const take =
                !deltaIds.has(ev.id) &&
                passes(ev, balanceWidget.group_by, [deltaAccount]) &&
                !movesBalance(ev) &&
                (notInFilters.every(f => passes(ev, f.slug, f.values)) || dueStillOpen(ev));
              if (take) seen.add(ev.id);
              return take;
            });
          }
        }

        const { buffer: deltaBuf, warnings } = await createDeltaExcel(
          deltaRows, bundle.attrDefs, bundle.categoriesDict,
          {
            groupLabel:   deltaAccount,
            opening:      deltaOpening,
            anchor:       deltaAnchor,
            plusSlug:     balanceWidget.plus  ?? '',
            minusSlug:    balanceWidget.minus ?? '',
            filters:      balanceWidget.filters ?? [],
            blankRows:    deltaBlanks,
            dueSlug,
            prefill,
            areaName:     cat?.area_name ?? '',
            categoryPath: cat?.full_path ?? '',
            userEmail:    user.email ?? '',
          },
          activeProfile,
          plannedRows,
        );

        const safeAccount = deltaAccount.replace(/[^A-Za-z0-9]+/g, '_').slice(0, 30);
        saveAs(
          new Blob([deltaBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
          `delta_${safeAccount}_${ts}.xlsx`,
        );
        // ⚠ Prazan delta sheet i savrseno uskladjen racun izgledaju IDENTICNO —
        //   oboje daju sidro, kontrolni stupac i same prazne retke. Prazan prozor
        //   je legitiman (S113: zato prazni retci nose `Area`), pa se ne prekida
        //   nego kaze naglas; sutnja bi ta dva slucaja ostavila nerazluciva.
        const allWarnings = deltaRows.length === 0
          ? [
              `Delta sheet za „${deltaAccount}": nijedan redak u prozoru od ${effectiveFilters.dateFrom}. ` +
              `Ili je racun vec uskladjen, ili filtar (profil/panel) pokazuje na drugi racun.`,
              ...warnings,
            ]
          : warnings;
        if (allWarnings.length) allWarnings.forEach(w => toast.error(w, { duration: 8000 }));
        else toast.success(
          `Delta sheet: ${deltaRows.length} redaka od ${effectiveFilters.dateFrom} ` +
          `(stanje ${deltaOpening.asOf} = ${deltaOpening.amount.toFixed(2)})`,
          { duration: 6000 },
        );
        return;
      }

      const buffer = await createEventsExcel(
        merged, bundle.attrDefs, bundle.categoriesDict,
        effectiveFilters.sortOrder ?? 'desc',
        structureNodes,
        filterInfo,
        { filterAreaId: effectiveFilters.areaId, filterCategoryId: effectiveFilters.categoryId, sharedWithByArea },
        activeProfile,
      );

      const profileSlug = profileName ? `_${sanitizeProfileName(profileName)}` : '';
      const previewTag  = previewMode ? '_preview' : '';
      const suffix      = !previewMode && fileCount > 1 ? `_part${fileIndex}of${fileCount}` : '';
      const filename = `events_export${profileSlug}${previewTag}_${ts}${suffix}.xlsx`;

      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      saveAs(blob, filename);

      if (previewMode) {
        toast.success('Preview exported — group columns in Excel, then Import Profile here');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message
        : (typeof err === 'object' && err !== null && 'message' in err)
          ? String((err as { message: unknown }).message)
          : JSON.stringify(err);
      setError(`Export failed: ${msg}`);
    } finally {
      setCurrentFile(0);
    }
  }, [batchSize, fileCount, filters, filter.periodKey, filter.commentSearch, filter.attrFilter,
      selectedProfile, profiles, deltaMode, deltaDays, deltaBlanks, balanceWidget, deltaAccount]);

  const downloadFile = useCallback((fileIndex: number) => doDownload(fileIndex, false), [doDownload]);
  const downloadPreview = useCallback(() => doDownload(1, true), [doDownload]);

  const downloadAll = useCallback(async () => {
    for (let i = 1; i <= fileCount; i++) {
      await downloadFile(i);
      if (i < fileCount) await new Promise(r => setTimeout(r, 500));
    }
  }, [fileCount, downloadFile]);

  // ── Import Profile from xlsx ──────────────────────────────────────
  const handleImportProfile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setImporting(true);
    setError('');
    try {
      const buffer = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);

      const profile = readProfileFromWorkbook(wb);
      if (!profile) {
        setError('Could not read column grouping from this file. Make sure it has an Events sheet with ATTRIBUTE LEGEND.');
        return;
      }

      // Read filter settings from Filter sheet (if present)
      const filterState = readFilterFromWorkbook(wb);
      if (filterState) {
        profile.filterState = filterState;
      }

      const existingName = readProfileNameFromWorkbook(wb);
      const defaultName = existingName || file.name.replace(/\.xlsx?$/i, '').replace(/^events_export_?/, '');

      const name = window.prompt('Profile name:', defaultName);
      if (!name?.trim()) return;
      const trimmedName = name.trim();

      // Save to area.settings
      if (!filter.areaId) {
        setError('Select an Area before importing a profile');
        return;
      }
      if (sharedContext) {
        setError("You don't have permission to save export profiles in this area (read-only access). Use the UI filters, or filter the full Excel locally after downloading.");
        return;
      }

      const newProfiles = { ...profiles, [trimmedName]: profile };

      const { error: updateError } = await supabase
        .from('areas')
        .update({
          settings: {
            ...(selectedArea?.settings ?? {}),
            export_profiles: newProfiles,
          },
        })
        .eq('id', filter.areaId);

      if (updateError) throw updateError;

      setProfiles(newProfiles);
      setSelectedProfile(trimmedName);
      const filterNote = profile.filterState ? ' + filter overrides' : '';
      toast.success(`Profile "${trimmedName}" saved (${profile.columns.filter(c => c.hidden).length} hidden cols, column order + widths${filterNote})`);
      window.dispatchEvent(new CustomEvent('areas-changed'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      setError(`Import profile failed: ${msg}`);
    } finally {
      setImporting(false);
    }
  }, [filter.areaId, profiles, selectedArea]);

  // ── Delete profile ────────────────────────────────────────────────
  const handleDeleteProfile = useCallback(async () => {
    if (!selectedProfile || !filter.areaId) return;
    if (sharedContext) { toast.error("Read-only access — cannot delete profiles"); return; }
    if (!window.confirm(`Delete profile "${selectedProfile}"?`)) return;

    const newProfiles = { ...profiles };
    delete newProfiles[selectedProfile];

    const { error: updateError } = await supabase
      .from('areas')
      .update({
        settings: {
          ...(selectedArea?.settings ?? {}),
          export_profiles: newProfiles,
        },
      })
      .eq('id', filter.areaId);

    if (updateError) {
      setError(`Delete failed: ${updateError.message}`);
      return;
    }

    setProfiles(newProfiles);
    setSelectedProfile('');
    toast.success('Profile deleted');
    window.dispatchEvent(new CustomEvent('areas-changed'));
  }, [selectedProfile, filter.areaId, profiles, selectedArea]);

  const isGenerating = currentFile > 0;
  const noData       = totalCount !== null && totalCount === 0;
  const profileNames = Object.keys(profiles);
  const activeProfile = selectedProfile ? profiles[selectedProfile] : null;
  const hiddenCount  = activeProfile ? activeProfile.columns.filter(c => c.hidden).length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden max-h-full flex flex-col">
        {/* Header */}
        <div className="bg-emerald-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-white">
            <span className="text-xl">📥</span>
            <h2 className="text-lg font-semibold">Export to Excel</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="text-emerald-100 hover:text-white text-2xl leading-none disabled:opacity-40"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Filters summary */}
          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 space-y-1">
            <p className="font-medium text-gray-800 mb-1">Active filters:</p>
            <p>📅 Date: {filter.dateFrom ?? '(all)'} → {filter.dateTo ?? '(all)'}</p>
            {filter.areaId && <p>📁 Area filter active</p>}
            {filter.categoryId && <p>🏷️ Category filter active</p>}
            <p>🔃 Sort: {filter.sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}</p>
            {filter.commentSearch && <p>💬 Comment: "{filter.commentSearch}"</p>}
          </div>

          {/* Count info */}
          {loadingCount ? (
            <div className="flex items-center gap-2 text-gray-500">
              <span className="animate-spin">⏳</span>
              <span>Counting records...</span>
            </div>
          ) : noData ? (
            <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
              ⚠️ No events found matching current filters.
            </div>
          ) : totalCount !== null && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
              <span className="font-semibold">{totalCount.toLocaleString()} event{totalCount !== 1 ? 's' : ''}</span>
              {' '}will be exported
              {fileCount > 1 && <span className="font-semibold"> → {fileCount} files</span>}
            </div>
          )}

          {/* Export Profile section */}
          {filter.areaId && !loadingCount && !noData && totalCount !== null && (
            <div className="border border-gray-200 rounded-lg p-3 space-y-3">
              <p className="text-sm font-medium text-gray-800">Export Profile</p>

              {/* Profile dropdown */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedProfile}
                  onChange={(e) => setSelectedProfile(e.target.value)}
                  disabled={isGenerating}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
                >
                  <option value="">No profile (all columns)</option>
                  {profileNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                {selectedProfile && (
                  <button
                    onClick={handleDeleteProfile}
                    disabled={isGenerating}
                    title="Delete this profile"
                    className="px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded border border-red-200 disabled:opacity-40"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Profile info */}
              {activeProfile && (
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">
                    {hiddenCount} column{hiddenCount !== 1 ? 's' : ''} hidden · column order from profile
                  </p>
                  {activeProfile.filterState && (
                    <p className="text-xs text-blue-600">
                      📋 Profile includes filter overrides: {(() => {
                        const parts: string[] = [];
                        if (activeProfile.filterState.periodKey) parts.push(`Period: ${activeProfile.filterState.periodKey}`);
                        if (activeProfile.filterState.sortOrder) parts.push(`Sort: ${activeProfile.filterState.sortOrder === 'asc' ? 'Oldest' : 'Newest'}`);
                        if (activeProfile.filterState.commentSearch) parts.push(`Comment: "${activeProfile.filterState.commentSearch}"`);
                        if (activeProfile.filterState.attrFilterRaw) parts.push('Attr filter');
                        return parts.join(', ');
                      })()}
                    </p>
                  )}
                </div>
              )}

              {/* Preview + Import buttons */}
              <div className="flex gap-2">
                <button
                  onClick={downloadPreview}
                  disabled={isGenerating || importing}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-300 disabled:opacity-50 transition-colors"
                >
                  {isGenerating ? '⏳' : '👁️'} Preview (10 rows)
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isGenerating || importing}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-300 disabled:opacity-50 transition-colors"
                >
                  {importing ? '⏳' : '📋'} Import Profile
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  onChange={handleImportProfile}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* Delta sheet (Faza 1) */}
          {balanceWidget && (
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 space-y-1">
              <label className="flex items-center gap-2 text-sm font-medium text-teal-900">
                <input
                  type="checkbox"
                  checked={deltaMode}
                  onChange={e => setDeltaMode(e.target.checked)}
                  disabled={isGenerating || !deltaReady}
                  className="rounded"
                />
                Delta sheet &mdash; uskla&#273;enje s bankom
              </label>
              {deltaReady ? (
                <div className="space-y-1">
                  <p className="text-xs text-teal-800">
                    Ra&#269;un <strong>{deltaAccount}</strong> &middot; samo retci koji mi&#269;u saldo
                    &middot; najstariji gore
                    &middot; kolona <em>Stanje (kontrola)</em> i &#263;elija &bdquo;u banci pi&scaron;e&ldquo;.
                  </p>
                  <label className="flex items-center gap-2 text-xs text-teal-900">
                    Prozor:
                    <input
                      type="number"
                      min={7}
                      max={3650}
                      step={7}
                      value={deltaDays}
                      onChange={e => setDeltaDays(Math.max(7, Math.min(3650, Number(e.target.value))))}
                      disabled={isGenerating}
                      className="w-20 border border-teal-300 rounded px-2 py-1 text-xs"
                    />
                    dana unatrag (ili od sidra, &scaron;to je kra&#263;e)
                  </label>
                  <label className="flex items-center gap-2 text-xs text-teal-900">
                    Praznih redaka:
                    <input
                      type="number"
                      min={0}
                      max={500}
                      step={10}
                      value={deltaBlanks}
                      onChange={e => setDeltaBlanks(Math.max(0, Math.min(500, Number(e.target.value))))}
                      disabled={isGenerating}
                      className="w-20 border border-teal-300 rounded px-2 py-1 text-xs"
                    />
                    za nove retke
                  </label>
                </div>
              ) : (
                <p className="text-xs text-teal-700">
                  Prvo odaberi ra&#269;un &mdash; klikni saldo na Overview plo&#269;ici, pa se vrati na Export.
                </p>
              )}
            </div>
          )}

          {/* Batch size control */}
          {!loadingCount && !noData && totalCount !== null && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Records per file
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={MIN_BATCH}
                  max={MAX_BATCH}
                  step={batchSize < 1000 ? 1 : 1000}
                  value={batchSize}
                  onChange={e => setBatchSize(Math.max(MIN_BATCH, Math.min(MAX_BATCH, Number(e.target.value))))}
                  disabled={isGenerating}
                  className="w-32 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
                />
                <span className="text-sm text-gray-500">
                  → {fileCount} file{fileCount !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-gray-400">Range: {MIN_BATCH.toLocaleString()} – {MAX_BATCH.toLocaleString()}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Download buttons */}
          {!loadingCount && !noData && totalCount !== null && (
            <div className="space-y-2">
              {fileCount === 1 ? (
                <button
                  onClick={() => downloadFile(1)}
                  disabled={isGenerating}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isGenerating ? (
                    <><span className="animate-spin">⏳</span> Generating…</>
                  ) : (
                    <><span>📥</span> Download Excel{selectedProfile ? ` (${selectedProfile})` : ''}</>
                  )}
                </button>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {Array.from({ length: fileCount }, (_, i) => i + 1).map(n => (
                      <button
                        key={n}
                        onClick={() => downloadFile(n)}
                        disabled={isGenerating}
                        className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          currentFile === n
                            ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
                            : 'bg-white border-gray-300 hover:border-emerald-400 hover:bg-emerald-50 text-gray-700'
                        }`}
                      >
                        {currentFile === n ? <span className="animate-spin">⏳</span> : <span>📥</span>}
                        File {n}/{fileCount}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={downloadAll}
                    disabled={isGenerating}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isGenerating ? (
                      <><span className="animate-spin">⏳</span> Generating file {currentFile}/{fileCount}…</>
                    ) : (
                      <><span>📥</span> Download All {fileCount} Files</>
                    )}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-3 bg-gray-50 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
