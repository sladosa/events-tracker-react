interface SessionHeaderProps {
  elapsed: number;
  lapElapsed: number;
  formatTime: (seconds: number) => string;
  onCancel: () => void;
  onSaveContinue: () => void;
  onSaveFinish: () => void;
  canSave: boolean;
  saving?: boolean;
}

export function SessionHeader({
  elapsed,
  lapElapsed,
  formatTime,
  onCancel,
  onSaveContinue,
  onSaveFinish,
  canSave,
  saving = false,
}: SessionHeaderProps) {
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-2xl mx-auto px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          {/* Timers - compact on mobile */}
          <div className="flex items-center gap-3 sm:gap-6">
            {/* Session Timer */}
            <div className="flex items-center gap-1.5">
              <span className="text-base sm:text-lg">⏱️</span>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide hidden sm:block">Session</div>
                <div className="text-lg sm:text-xl font-mono font-bold text-gray-800">
                  {formatTime(elapsed)}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-8 w-px bg-gray-300 hidden sm:block" />

            {/* Lap Timer */}
            <div className="flex items-center gap-1.5">
              <span className="text-base sm:text-lg">🏃</span>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide hidden sm:block">Lap</div>
                <div className="text-lg sm:text-xl font-mono font-medium text-blue-600">
                  {formatTime(lapElapsed)}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Cancel */}
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="p-2 sm:px-3 sm:py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 transition-colors"
              title="Cancel"
            >
              <span className="sm:hidden">✕</span>
              <span className="hidden sm:inline">Cancel</span>
            </button>

            {/* Save & Continue */}
            <button
              type="button"
              onClick={onSaveContinue}
              disabled={!canSave || saving}
              className="p-2 sm:px-3 sm:py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Save & Continue"
            >
              <span className="sm:hidden">{saving ? '...' : '💾'}</span>
              <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save+'}</span>
            </button>

            {/* Save & Finish / Done */}
            <button
              type="button"
              onClick={onSaveFinish}
              disabled={!canSave || saving}
              className="p-2 sm:px-3 sm:py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Save & Finish"
            >
              <span className="sm:hidden">✓</span>
              <span className="hidden sm:inline">Done</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
