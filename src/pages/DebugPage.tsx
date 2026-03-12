import { useState, useEffect } from 'react';
import { THEME } from '@/lib/theme';

const DEBUG_KEY = 'events_tracker_debug_log';

// ─── Theme Preview Section ───────────────────────────────────────────────────

type ThemeKey = keyof typeof THEME;

function ThemePreview() {
  const pages: { key: ThemeKey; label: string; icon: string }[] = [
    { key: 'view',  label: 'View Activity',  icon: '👁️' },
    { key: 'edit',  label: 'Edit Activity',  icon: '✏️' },
    { key: 'add',   label: 'Add Activity',   icon: '➕' },
  ];

  return (
    <div className="mb-6">
      <h2 className="text-xl text-yellow-400 mb-3">🎨 Theme Preview</h2>
      <p className="text-gray-400 text-xs mb-4 font-sans">
        Boje se definiraju u <code className="text-green-300">src/lib/theme.ts</code>.
        Svaka stranica koristi jedan od tri THEME objekta.
        Da bi promijenio boje, uredi theme.ts i provjeri rezultat ovdje (HMR osvježava automatski).
      </p>

      <div className="grid grid-cols-1 gap-5">
        {pages.map(({ key, label, icon }) => {
          const t = THEME[key];
          return (
            <div key={key} className="bg-gray-800 rounded-lg overflow-hidden border border-gray-600">
              {/* Simulated Header */}
              <div className={`${t.headerBg} px-4 py-3 flex items-center justify-between`}>
                <div className={t.headerText}>
                  <div className="text-xs opacity-70">Fitness &gt; Activity &gt; Gym &gt; Cardio</div>
                  <div className="font-semibold">{icon} {label}</div>
                </div>
                <div className="flex gap-2">
                  <button className={`px-3 py-1.5 rounded-lg text-sm font-medium ${t.cancelBtn}`}>✕</button>
                  <button className={`px-3 py-1.5 rounded-lg text-sm font-medium ${t.accent}`}>Save</button>
                </div>
              </div>

              {/* Simulated Body */}
              <div className="p-4 bg-white font-sans">
                <div className={`${t.light} ${t.lightBorder} border rounded-lg p-3 mb-3`}>
                  <span className={`${t.lightText} text-sm font-medium`}>
                    Session info / banner area
                  </span>
                </div>
                <div className="flex gap-2 mb-3">
                  <div className={`h-4 w-4 rounded-full border-4 ${t.spinner} opacity-70 mt-1`}></div>
                  <input
                    readOnly
                    value="Input with focus ring"
                    className={`flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm outline-none ring-2 ${t.ring}`}
                  />
                </div>
                <button className={`px-4 py-2 rounded-lg text-sm font-medium ${t.deleteBtn}`}>
                  Delete
                </button>
              </div>

              {/* Token listing */}
              <div className="bg-gray-900 px-4 py-2 text-xs text-gray-400 font-mono grid grid-cols-2 gap-x-4 gap-y-0.5">
                {(Object.entries(t) as [string, string][]).map(([prop, value]) => (
                  <div key={prop}>
                    <span className="text-gray-500">{prop}:</span>{' '}
                    <span className="text-green-300">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-amber-400 text-xs mt-4 font-sans">
        ARCHITECTURE.md bilježi Add = Green, ali theme.ts trenutno ima bg-blue-600.
        Da bi promijenio Add na zelenu, zamijeni sve blue- prefikse unutar add objekta u theme.ts.
      </p>
    </div>
  );
}

// ─── Debug Page ──────────────────────────────────────────────────────────────

export function DebugPage() {
  const [logs, setLogs] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'theme' | 'logs'>('theme');

  useEffect(() => {
    if (activeTab !== 'logs') return;
    const loadLogs = () => {
      try {
        const data = localStorage.getItem(DEBUG_KEY) || 'No logs found';
        setLogs(data);
      } catch (e) {
        setLogs('Error reading logs: ' + String(e));
      }
    };
    loadLogs();
    const interval = setInterval(loadLogs, 1000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const handleClear = () => {
    localStorage.removeItem(DEBUG_KEY);
    setLogs('Logs cleared');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(logs);
    alert('Logs copied to clipboard!');
  };

  const handleDownload = () => {
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug_log_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-green-400 p-4 font-mono">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl text-yellow-400 mb-4">Dev Tools</h1>

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveTab('theme')}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              activeTab === 'theme'
                ? 'bg-yellow-500 text-gray-900'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Theme Preview
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              activeTab === 'logs'
                ? 'bg-yellow-500 text-gray-900'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Debug Logs
          </button>
          <a
            href="/app/add"
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm font-medium"
          >
            Add Activity
          </a>
        </div>

        {activeTab === 'theme' && <ThemePreview />}

        {activeTab === 'logs' && (
          <>
            <div className="flex gap-2 mb-4">
              <button onClick={handleCopy} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Copy to Clipboard
              </button>
              <button onClick={handleDownload} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                Download
              </button>
              <button onClick={handleClear} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                Clear Logs
              </button>
            </div>
            <div className="text-gray-500 mb-2 text-xs">
              Auto-refreshes every second.
            </div>
            <pre className="bg-black p-4 rounded border border-gray-700 overflow-auto max-h-[70vh] text-sm whitespace-pre-wrap">
              {logs}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}
