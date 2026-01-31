import { useState, useEffect, useCallback, useRef } from 'react';

interface SavedEventInfo {
  eventId: string;
  categoryName: string;
  timestamp: Date;
  lapTime: string;
  summary: string;
  hasPhoto: boolean;
}

interface UseSessionTimerReturn {
  sessionStart: Date;
  elapsed: number;           // Total session seconds
  lapElapsed: number;        // Seconds since last save
  savedEvents: SavedEventInfo[];
  isActive: boolean;
  resetLap: () => void;
  addSavedEvent: (info: Omit<SavedEventInfo, 'timestamp' | 'lapTime'>) => void;
  formatTime: (seconds: number) => string;
  endSession: () => void;
}

export function useSessionTimer(): UseSessionTimerReturn {
  const [sessionStart] = useState(() => new Date());
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [lapElapsed, setLapElapsed] = useState(0);
  const [savedEvents, setSavedEvents] = useState<SavedEventInfo[]>([]);
  const [isActive, setIsActive] = useState(true);
  
  const intervalRef = useRef<number | null>(null);

  // Update timers every second
  useEffect(() => {
    if (!isActive) return;
    
    intervalRef.current = window.setInterval(() => {
      const now = Date.now();
      setElapsed(Math.floor((now - sessionStart.getTime()) / 1000));
      
      if (lastSaveTime) {
        setLapElapsed(Math.floor((now - lastSaveTime.getTime()) / 1000));
      } else {
        setLapElapsed(Math.floor((now - sessionStart.getTime()) / 1000));
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [sessionStart, lastSaveTime, isActive]);

  // Format seconds to HH:MM:SS
  const formatTime = useCallback((seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, []);

  // Reset lap timer (called after each save)
  const resetLap = useCallback(() => {
    setLastSaveTime(new Date());
    setLapElapsed(0);
  }, []);

  // Add a saved event to the session log
  const addSavedEvent = useCallback((info: Omit<SavedEventInfo, 'timestamp' | 'lapTime'>) => {
    const timestamp = new Date();
    const lapTime = formatTime(lapElapsed);
    
    setSavedEvents(prev => [{
      ...info,
      timestamp,
      lapTime,
    }, ...prev]); // Newest first
    
    resetLap();
  }, [lapElapsed, formatTime, resetLap]);

  // End session
  const endSession = useCallback(() => {
    setIsActive(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }, []);

  return {
    sessionStart,
    elapsed,
    lapElapsed,
    savedEvents,
    isActive,
    resetLap,
    addSavedEvent,
    formatTime,
    endSession,
  };
}
