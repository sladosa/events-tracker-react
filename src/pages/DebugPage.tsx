import { useState, useEffect } from 'react';

const DEBUG_KEY = 'events_tracker_debug_log';

export function DebugPage() {
  const [logs, setLogs] = useState<string>('');

  useEffect(() => {
    const loadLogs = () => {
      try {
        const data = localStorage.getItem(DEBUG_KEY) || 'No logs found';
        setLogs(data);
      } catch (e) {
        setLogs('Error reading logs: ' + String(e));
      }
    };
    
    loadLogs();
    
    // Auto-refresh every second
    const interval = setInterval(loadLogs, 1000);
    return () => clearInterval(interval);
  }, []);

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
        <h1 className="text-2xl text-yellow-400 mb-4">🔍 Debug Logs</h1>
        
        <div className="flex gap-2 mb-4">
          <button 
            onClick={handleCopy}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            📋 Copy to Clipboard
          </button>
          <button 
            onClick={handleDownload}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            💾 Download as File
          </button>
          <button 
            onClick={handleClear}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            🗑️ Clear Logs
          </button>
          <a 
            href="/app/add"
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            → Go to Add Activity
          </a>
        </div>

        <div className="text-gray-500 mb-2">
          Auto-refreshes every second. Log location: localStorage['{DEBUG_KEY}']
        </div>

        <pre className="bg-black p-4 rounded border border-gray-700 overflow-auto max-h-[70vh] text-sm whitespace-pre-wrap">
          {logs}
        </pre>
      </div>
    </div>
  );
}
