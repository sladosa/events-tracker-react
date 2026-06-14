import { useState } from 'react';
import type { RataInfo } from '@/lib/rataAutomation';

interface Props {
  isOpen: boolean;
  rataInfo: RataInfo;
  onConfirm: () => Promise<void>;
  onSkip: () => void;
}

export function RataModal({ isOpen, rataInfo, onConfirm, onSkip }: Props) {
  const [creating, setCreating] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setCreating(true);
    try {
      await onConfirm();
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (d: Date) =>
    d.toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Kreirati rate?</h2>
          <p className="text-sm text-gray-500 mb-4">
            Iznos po rati:{' '}
            <strong className="text-gray-800">{rataInfo.amountPerRata.toFixed(2)}</strong>
            {' '}({rataInfo.totalAmount.toFixed(2)} / {rataInfo.count})
          </p>

          <div className="space-y-1.5 mb-5 max-h-64 overflow-y-auto">
            {rataInfo.dates.map((date, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-sm py-1.5 px-3 bg-blue-50 rounded-lg"
              >
                <span className="text-blue-400 font-mono text-xs">→</span>
                <span className="text-gray-700 font-medium tabular-nums">{formatDate(date)}</span>
                <span className="text-gray-400 text-xs">rata {i + 1}/{rataInfo.count}</span>
                <span className="ml-auto font-semibold text-gray-800 tabular-nums">
                  {rataInfo.amountPerRata.toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={creating}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {creating ? 'Kreiranje...' : `Kreiraj ${rataInfo.count} rata`}
            </button>
            <button
              onClick={onSkip}
              disabled={creating}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              Preskoči
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
