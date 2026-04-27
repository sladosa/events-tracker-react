import { createContext, useContext, useState } from 'react';

interface HelpContextValue {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  // pageHint: set by AppHome when active tab changes;
  // overrides location-based detection only on the home page
  pageHint: string | null;
  setPageHint: (h: string | null) => void;
}

const HelpContext = createContext<HelpContextValue | null>(null);

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pageHint, setPageHint] = useState<string | null>(null);

  return (
    <HelpContext.Provider value={{
      isOpen,
      toggle: () => setIsOpen(v => !v),
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      pageHint,
      setPageHint,
    }}>
      {children}
    </HelpContext.Provider>
  );
}

export function useHelp() {
  const ctx = useContext(HelpContext);
  if (!ctx) throw new Error('useHelp must be used within HelpProvider');
  return ctx;
}
