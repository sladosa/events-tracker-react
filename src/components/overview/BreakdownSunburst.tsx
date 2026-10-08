// ============================================================
// BreakdownSunburst.tsx — krug pločice „Kamo ide novac" (samo široki ekran)
// ============================================================
// Spec: docs/RAZREZ_SPEC.md §2.2, §12.1 (R11).
//
// Crta ono što `toSunburst` vrati — SAMO pozitivno. Sve izostavljeno (povrat
// veći od troška, Porezi u minusu) ispisuje se ispod kruga: nacrtan krug koji
// prešuti negativnu stavku tvrdio bi da je potrošnja veća nego što jest.
//
// ⚠ Vrijednosti su u LIPAMA (cijeli brojevi). `branchvalues: 'total'` traži da
//   roditelj bude točno zbroj djece; s decimalama ga binarni zapis zna promašiti
//   za 1e-13 i Plotly tada tiho ne nacrta cijelu granu.
// ============================================================

import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { formatAmount, formatSigned } from '@/lib/amountFormat';
import { toSunburst, type BreakdownNode } from '@/lib/breakdownModel';

const COLORS = [
  '#0d9488', '#6366f1', '#f59e0b', '#ec4899', '#10b981',
  '#8b5cf6', '#ef4444', '#0ea5e9', '#84cc16', '#f97316',
];

interface Props {
  root: BreakdownNode;
  unit?: string;
  /** Čvor na koji je krug zumiran (S166: krug vodi, lista slijedi); null = cijeli krug. */
  focusId: string | null;
  /** Klik u krugu: novi fokus (null = natrag na cijeli krug). */
  onFocus: (id: string | null) => void;
}

export function BreakdownSunburst({ root, unit, focusId, onFocus }: Props) {
  const data = useMemo(() => toSunburst(root), [root]);

  if (data.ids.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">Nema ničega pozitivnog za nacrtati.</p>;
  }

  const trace = {
    type: 'sunburst',
    ids: data.ids,
    labels: data.labels,
    parents: data.parents,
    values: data.values,
    branchvalues: 'total',
    // Gdje je ispod stavke nešto u minusu, nacrtano ≠ neto — tooltip kaže oba, s
    // neto (= broj iz liste) podebljanim; inače krug i lista izgledaju kao da se svađaju.
    customdata: data.values.map((v, i) => data.nets[i] === v
      ? formatAmount(v / 100, unit)
      : `neto <b>${data.nets[i] < 0 ? formatSigned(data.nets[i] / 100, unit) : formatAmount(data.nets[i] / 100, unit)}</b> (kao u listi)<br>`
        + `nacrtano ${formatAmount(v / 100, unit)} — minus ispod je izvan kruga`),
    hovertemplate: '<b>%{label}</b><br>%{customdata}<br>%{percentRoot:.1%} kruga<extra></extra>',
    textinfo: 'label',
    insidetextorientation: 'radial',
    maxdepth: 3,
    // Zum drži BreakdownTile, ne Plotly — inače krug i lista pokazuju dva pogleda.
    level: focusId ?? root.id,
    // Djeca nasljeđuju boju roditelja (samo svjetliju), pa braću dijeli SAMO
    // rub — zadani 1 px bijelo se na svijetlom tonu ne vidi (Saša, S166).
    marker: { line: { color: '#ffffff', width: 2.5 } },
  };

  // Plotly javlja kamo BI zumirao (`nextLevel`; klik na sredinu = razina gore);
  // `false` poništi njegov vlastiti zum, a stanje ga vrati kroz `level`.
  const sunburstClick = (ev: { nextLevel?: string }) => {
    if (ev?.nextLevel) onFocus(ev.nextLevel === root.id ? null : ev.nextLevel);
    return false;
  };

  return (
    <div>
      <Plot
        // SunburstTrace postoji u Plotlyju, ali ga @types/plotly.js nema u uniji
        // (isto kao StructureSunburstView).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data={[trace] as any}
        layout={({
          margin: { t: 4, b: 4, l: 4, r: 4 },
          height: 380,
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          sunburstcolorway: COLORS,
          showlegend: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any}
        config={{ displayModeBar: false, responsive: true }}
        // `onSunburstClick` react-plotly podržava, ali ga @types nemaju ⇒ spread.
        {...{ onSunburstClick: sunburstClick }}
        useResizeHandler
        style={{ width: '100%' }}
        className="w-full"
      />
      {data.notDrawn.length > 0 && (
        <p className="text-xs text-gray-500 mt-1">
          <span className="font-medium">Nije nacrtano</span> (neto u minusu — krug ne zna crtati negativno):{' '}
          {data.notDrawn.map((x, i) => (
            <span key={x.path}>
              {i > 0 && ' · '}
              {x.path} <span className="tabular-nums">{formatSigned(x.cents / 100, unit)}</span>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
