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
}

export function BreakdownSunburst({ root, unit }: Props) {
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
    customdata: data.values.map(v => formatAmount(v / 100, unit)),
    hovertemplate: '<b>%{label}</b><br>%{customdata}<br>%{percentRoot:.1%} od ukupnog<extra></extra>',
    textinfo: 'label',
    insidetextorientation: 'radial',
    maxdepth: 3,
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
