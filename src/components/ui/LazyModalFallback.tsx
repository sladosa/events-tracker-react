// Prikazuje se dok se kod modala tek skida (S170: Excel modali vuku ExcelJS,
// 264 KB gzipa, pa više nisu u početnom učitavanju). Bez ovoga klik na
// Export/Import na sporoj mreži ne bi pokazao NIŠTA — a „ništa" se čita kao
// „nije reagiralo" i klikne opet (razred S154, `+` gumb).
export function LazyModalFallback() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-lg shadow px-4 py-3 text-sm text-gray-600">Loading…</div>
    </div>
  );
}
