interface SessionHeaderProps {
  elapsed: number;
  lapElapsed: number;
  formatTime: (seconds: number) => string;
  onFinish: () => void;
  isActive: boolean;
}

export function SessionHeader({
  elapsed,
  lapElapsed,
  formatTime,
  onFinish,
  isActive,
}: SessionHeaderProps) {
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-2xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Timers */}
          <div className="flex items-center gap-6">
            {/* Session Timer */}
            <div className="flex items-center gap-2">
              <span className="text-lg">⏱️</span>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Session</div>
                <div className="text-xl font-mono font-bold text-gray-800">
                  {formatTime(elapsed)}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-10 w-px bg-gray-300" />

            {/* Lap Timer */}
            <div className="flex items-center gap-2">
              <span className="text-lg">🏃</span>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Lap</div>
                <div className="text-xl font-mono font-medium text-blue-600">
                  {formatTime(lapElapsed)}
                </div>
              </div>
            </div>
          </div>

          {/* Finish Button */}
          <button
            type="button"
            onClick={onFinish}
            disabled={!isActive}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Finish Session
          </button>
        </div>
      </div>
    </div>
  );
}
