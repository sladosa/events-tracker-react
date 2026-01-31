import { useState } from 'react';

interface SavedEventInfo {
  eventId: string;
  categoryName: string;
  timestamp: Date;
  lapTime: string;
  summary: string;
  hasPhoto: boolean;
}

interface SessionLogProps {
  savedEvents: SavedEventInfo[];
  maxVisible?: number;
}

export function SessionLog({ savedEvents, maxVisible = 3 }: SessionLogProps) {
  const [expanded, setExpanded] = useState(false);

  if (savedEvents.length === 0) {
    return null;
  }

  const visibleEvents = expanded ? savedEvents : savedEvents.slice(0, maxVisible);
  const hiddenCount = savedEvents.length - maxVisible;

  return (
    <div className="bg-gray-50 border-b border-gray-200">
      <div className="max-w-2xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
            Session Log
          </h3>
          <span className="text-xs text-gray-500">
            {savedEvents.length} saved
          </span>
        </div>

        <div className="space-y-1">
          {visibleEvents.map((event, index) => (
            <div
              key={event.eventId || index}
              className="flex items-center justify-between py-1.5 px-2 bg-white rounded border border-gray-100"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-green-600 flex-shrink-0">✓</span>
                <span className="text-sm text-gray-800 truncate">
                  {event.categoryName}
                </span>
                {event.summary && (
                  <span className="text-sm text-gray-500 truncate">
                    ({event.summary})
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <span className="text-xs text-gray-400 font-mono">
                  @ {event.lapTime}
                </span>
                {event.hasPhoto && (
                  <span className="text-blue-500" title="Has photo">📷</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {hiddenCount > 0 && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-2 text-sm text-blue-600 hover:text-blue-700 underline"
          >
            Show all {savedEvents.length} saved
          </button>
        )}

        {expanded && hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="mt-2 text-sm text-gray-500 hover:text-gray-600 underline"
          >
            Show less
          </button>
        )}
      </div>
    </div>
  );
}
