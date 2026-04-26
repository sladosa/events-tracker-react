import { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Send, HelpCircle, MessageCircle, ThumbsUp, Loader2, GripVertical, Pin, RotateCcw, BookOpen,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useFilter } from '@/context/FilterContext';
import { useHelp } from '@/context/HelpContext';

// ── Types ──────────────────────────────────────────────────────────────────────
type Tab = 'ask' | 'concepts' | 'feedback';
type FeedbackType = 'wish' | 'bug' | 'question';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const HELP_API_URL = import.meta.env.VITE_HELP_API_URL ?? '/.netlify/functions/help';

const WELCOME: ChatMessage = {
  role: 'assistant',
  content: 'Hello! How can I help you with Events Tracker?\nYou can ask in Croatian or English. 🙂',
};

const FEEDBACK_LABELS: Record<FeedbackType, string> = {
  wish: '💡 Suggestion',
  bug: '🐛 Bug',
  question: '❓ Question',
};

// Context-aware quick questions shown before first user message
const CHIPS: Record<string, string[]> = {
  activities: [
    'How do I add an activity?',
    'What is a session?',
    'How do I import from Excel?',
  ],
  structure: [
    'What are Area and Category?',
    'What does the ⋮ menu do?',
    'How do I share an area with someone?',
  ],
  add: [
    'What happens to parent categories?',
    'How does suggest work?',
    "Why can't I select a category?",
  ],
  edit: [
    'Can I change the date?',
    "Why am I seeing someone else's record?",
    'What happens when I change the time?',
  ],
  view: [
    'How do I edit this record?',
    'What does Prev/Next do?',
    'How do I see all records for a category?',
  ],
};

// ── Page context detection ─────────────────────────────────────────────────────
// Location-based detection wins for specific sub-pages (/add, /edit, /view).
// For the home page, pageHint from HelpContext carries the active tab name.
function useCurrentPage(): string {
  const { pageHint } = useHelp();
  const { pathname } = useLocation();
  if (pathname.includes('/add')) return 'add';
  if (pathname.includes('/edit')) return 'edit';
  if (pathname.includes('/view')) return 'view';
  return pageHint ?? 'activities';
}

// ── HelpPanel ─────────────────────────────────────────────────────────────────
export function HelpPanel() {
  const { isOpen, close } = useHelp();
  const { filter } = useFilter();
  const currentPage = useCurrentPage();

  // ── Chat state
  const [tab, setTab] = useState<Tab>('ask');
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Feedback state
  const [fbType, setFbType] = useState<FeedbackType>('wish');
  const [fbMessage, setFbMessage] = useState('');
  const [fbSending, setFbSending] = useState(false);
  const [fbSent, setFbSent] = useState(false);
  const [fbError, setFbError] = useState<string | null>(null);

  // ── Drag/float state (desktop only)
  // null = docked to right side; {x,y} = floating at that position
  const [floatPos, setFloatPos] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isDocked = floatPos === null;

  // Reset chat when panel opens in a different page context than last time
  const lastPageRef = useRef<string | null>(null);
  useEffect(() => {
    if (isOpen) {
      if (lastPageRef.current !== null && lastPageRef.current !== currentPage) {
        setMessages([WELCOME]);
        setInput('');
        setAskError(null);
        setTab('ask');
      }
      lastPageRef.current = currentPage;
    }
  }, [isOpen, currentPage]);

  useEffect(() => {
    if (isOpen && tab === 'ask') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, tab]);

  useEffect(() => {
    if (isOpen) {
      setFbSent(false);
      setFbError(null);
      setAskError(null);
    }
  }, [isOpen]);

  // ── Reset conversation ────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setMessages([WELCOME]);
    setInput('');
    setAskError(null);
    setTab('ask');
  }, []);

  // ── Send question (also called by chip clicks) ────────────────────────────
  const handleSend = useCallback(async (questionOverride?: string) => {
    const q = (questionOverride ?? input).trim();
    if (!q || loading) return;

    setInput('');
    setAskError(null);

    const userMsg: ChatMessage = { role: 'user', content: q };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const res = await fetch(HELP_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          history: messages.filter(m => m !== WELCOME).slice(-8),
          context: { page: currentPage, areaId: filter.areaId ?? null },
          userId: user?.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const { answer } = await res.json();
      setMessages([...updatedHistory, { role: 'assistant', content: answer }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Greška';
      setAskError(
        msg.includes('Failed to fetch') || msg.includes('NetworkError')
          ? 'AI help nije dostupan lokalno. Koristi `netlify dev` ili testiraj na PROD-u.'
          : `Greška: ${msg}`
      );
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, currentPage, filter.areaId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Feedback submit ────────────────────────────────────────────────────────
  const handleFeedbackSubmit = async () => {
    if (!fbMessage.trim() || fbSending) return;
    setFbSending(true);
    setFbError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('feedback').insert({
        user_id: user.id,
        type: fbType,
        message: fbMessage.trim(),
        context: { page: currentPage, areaId: filter.areaId ?? null },
      });

      if (error) throw error;
      setFbSent(true);
      setFbMessage('');
    } catch (err) {
      setFbError(err instanceof Error ? err.message : 'Greška pri slanju');
    } finally {
      setFbSending(false);
    }
  };

  // ── Drag logic (desktop header drag → panel floats) ───────────────────────
  const handleDragStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();

    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const origX = isDocked ? rect.left : floatPos!.x;
    const origY = isDocked ? rect.top : floatPos!.y;

    const onMove = (ev: MouseEvent) => {
      setFloatPos({
        x: Math.max(0, Math.min(window.innerWidth - 400, origX + (ev.clientX - startX))),
        y: Math.max(0, Math.min(window.innerHeight - 80, origY + (ev.clientY - startY))),
      });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── Shared panel content ──────────────────────────────────────────────────
  const chips = CHIPS[currentPage] ?? CHIPS['activities'];
  const showChips = messages.length === 1 && tab === 'ask';

  const panelContent = (
    <>
      {/* Header — drag handle on desktop */}
      <div
        className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 flex-shrink-0 select-none sm:cursor-grab active:cursor-grabbing"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2">
          <GripVertical size={13} className="text-gray-400 hidden sm:block flex-shrink-0" />
          <HelpCircle size={16} className="text-indigo-600 flex-shrink-0" />
          <span className="font-semibold text-gray-900 text-sm">Help</span>
          {!isDocked && (
            <button
              onClick={(e) => { e.stopPropagation(); setFloatPos(null); }}
              onMouseDown={e => e.stopPropagation()}
              title="Pin to right side"
              className="ml-0.5 p-0.5 rounded text-gray-400 hover:text-indigo-600 transition-colors"
            >
              <Pin size={13} />
            </button>
          )}
        </div>
        <button
          onClick={close}
          onMouseDown={e => e.stopPropagation()}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 flex-shrink-0">
        {([
          { id: 'ask', icon: <MessageCircle size={13} />, label: 'Ask AI' },
          { id: 'concepts', icon: <BookOpen size={13} />, label: 'Concepts' },
          { id: 'feedback', icon: <ThumbsUp size={13} />, label: 'Feedback' },
        ] as { id: Tab; icon: React.ReactNode; label: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'concepts' ? (
        <ConceptsTab />
      ) : tab === 'ask' ? (
        <>
          {/* Messages + chips */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
            {/* Reset button — shown when conversation has started */}
            {messages.length > 1 && (
              <div className="flex justify-end">
                <button
                  onClick={handleReset}
                  title="New conversation"
                  className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <RotateCcw size={11} />
                  New conversation
                </button>
              </div>
            )}

            {/* Quick question chips (shown before first user message) */}
            {showChips && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-gray-400 text-center">Quick questions:</p>
                <div className="flex flex-col gap-1.5">
                  {chips.map(chip => (
                    <button
                      key={chip}
                      onClick={() => handleSend(chip)}
                      className="text-left text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg px-3 py-2 transition-colors"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 my-1">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">or type your question</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-3 py-2 rounded-2xl rounded-bl-sm flex items-center gap-2">
                  <Loader2 size={13} className="animate-spin text-gray-500" />
                  <span className="text-sm text-gray-500">Thinking...</span>
                </div>
              </div>
            )}

            {askError && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {askError}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 border-t border-gray-200 p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question... (Enter to send)"
                rows={2}
                className="flex-1 resize-none border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                aria-label="Send"
              >
                <Send size={15} />
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5 text-center">
              Powered by Claude Haiku · Answers may be inaccurate
            </p>
          </div>
        </>
      ) : (
        <FeedbackTab
          fbType={fbType} setFbType={setFbType}
          fbMessage={fbMessage} setFbMessage={setFbMessage}
          fbSending={fbSending} fbSent={fbSent} fbError={fbError}
          onSubmit={handleFeedbackSubmit}
        />
      )}
    </>
  );

  const panelBase = 'fixed z-[100] bg-white flex flex-col shadow-2xl';

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-[99] sm:hidden"
          onClick={close}
        />
      )}

      {/* Mobile panel — bottom sheet, always in DOM for smooth animation */}
      <div
        className={`${panelBase} bottom-0 left-0 right-0 h-[78vh] rounded-t-2xl sm:hidden transition-transform duration-300 ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {panelContent}
      </div>

      {/* Desktop panel — docked (slide from right) or floating (fixed position) */}
      {floatPos ? (
        // Floating mode: visible only when open; no slide animation
        isOpen && (
          <div
            ref={panelRef}
            className={`${panelBase} hidden sm:flex w-[400px] h-[580px] rounded-xl border border-gray-200`}
            style={{ left: floatPos.x, top: floatPos.y }}
          >
            {panelContent}
          </div>
        )
      ) : (
        // Docked mode: slide-in from the right
        <div
          ref={panelRef}
          className={`${panelBase} hidden sm:flex top-0 right-0 h-screen w-[400px] border-l border-gray-200 transition-transform duration-300 ${
            isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {panelContent}
        </div>
      )}
    </>
  );
}

// ── Concepts Tab ─────────────────────────────────────────────────────────────

interface TermEntry { name: string; children: React.ReactNode }
function Term({ name, children }: TermEntry) {
  return (
    <div className="py-1.5 border-b border-gray-100 last:border-0">
      <span className="font-semibold text-gray-800 text-xs">{name}</span>
      <span className="text-gray-600 text-xs"> — {children}</span>
    </div>
  );
}

interface DecisionEntry { title: string; children: React.ReactNode }
function Decision({ title, children }: DecisionEntry) {
  return (
    <div className="py-1.5 border-b border-amber-100 last:border-0">
      <p className="font-semibold text-amber-900 text-xs mb-0.5">{title}</p>
      <p className="text-amber-800 text-xs leading-snug">{children}</p>
    </div>
  );
}

interface SectionProps { title: string; children: React.ReactNode; amber?: boolean }
function ConceptSection({ title, children, amber }: SectionProps) {
  return (
    <div className="mb-3">
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${amber ? 'text-amber-600' : 'text-indigo-600'}`}>
        {title}
      </p>
      <div className={`rounded-lg px-2.5 py-0.5 ${amber ? 'bg-amber-50' : 'bg-gray-50'}`}>
        {children}
      </div>
    </div>
  );
}

function ConceptsTab() {
  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
      <ConceptSection title="Core Concepts">
        <Term name="Area">Top-level grouping (e.g., Fitness, Health, Financije). Each area has its own category tree and access controls.</Term>
        <Term name="Category">Subcategory within an area, arranged in a hierarchy (e.g., Fitness › Strength › Bench Press). Can be nested up to 10 levels.</Term>
        <Term name="Leaf Category">The deepest category in a hierarchy — where individual activities are logged.</Term>
        <Term name="Activity / Event">A logged record tied to a specific category, date/time, and attribute values.</Term>
        <Term name="Session">A group of activities sharing the same session_start (date + time, rounded to the minute). All levels of a category hierarchy share one session.</Term>
        <Term name="Session Start">The timestamp for a session, rounded to the nearest minute — two activities at HH:MM:00 belong to the same session.</Term>
        <Term name="Attribute">A typed field defined per category: text, number, date/time, yes/no, link, image, or suggest.</Term>
        <Term name="Suggest">An attribute with a predefined dropdown (e.g., Mood: Happy / Neutral / Sad).</Term>
        <Term name="Dependent Suggest">A suggest whose options change based on another attribute's value (e.g., Subtype options change based on Activity Type).</Term>
        <Term name="Shortcut">A saved filter (Area + Category combination) for quick navigation — 💾 icon in the filter bar.</Term>
      </ConceptSection>

      <ConceptSection title="Key Behaviors">
        <Term name="Parent Events">When you log an activity at the leaf level, the app auto-creates one event per parent category in the same session — you don't manage them manually.</Term>
        <Term name="Last Non-Empty Wins">When editing or importing, empty values never overwrite existing data. A blank Excel cell leaves the DB value unchanged.</Term>
        <Term name="Delta Shift">When you change the date/time in Edit Activity, all parent events in the same session shift by the same amount, keeping the session consistent.</Term>
        <Term name="Edit Mode">Structure tab toggle that unlocks category and attribute editing. Hidden for shared areas where you only have read access.</Term>
        <Term name="Session Collision">Two activities for the same category at the same minute — the app detects this and asks how to proceed.</Term>
      </ConceptSection>

      <ConceptSection title="Design Decisions" amber>
        <Decision title="Why flexible attributes (EAV model)?">
          Each category can define its own fields without changing the database schema. Trade-off: attribute values live in a separate table, making queries more complex.
        </Decision>
        <Decision title="Why are parent events auto-created?">
          So you can see aggregated data at every hierarchy level (e.g., all workouts on a day). Trade-off: parent events are computed summaries, not manually entered records.
        </Decision>
        <Decision title="Why does editing time shift all related records?">
          A session is identified by its timestamp — moving one event moves the whole session to keep it consistent. Trade-off: you can't move a single event within a multi-record session independently.
        </Decision>
        <Decision title="Why does empty never overwrite (P3 rule)?">
          Prevents accidental data loss when bulk-importing a partial update via Excel. Trade-off: to explicitly clear a value, use the Edit Activity form — it can't be done via import.
        </Decision>
        <Decision title="Why Excel as the primary bulk workflow?">
          Familiar offline tool that supports complex edits and bulk operations. Trade-off: strict column format required; categories must exist before importing events.
        </Decision>
      </ConceptSection>
    </div>
  );
}

// ── Feedback Tab ──────────────────────────────────────────────────────────────
interface FeedbackTabProps {
  fbType: FeedbackType; setFbType: (t: FeedbackType) => void;
  fbMessage: string; setFbMessage: (v: string) => void;
  fbSending: boolean; fbSent: boolean; fbError: string | null;
  onSubmit: () => void;
}

function FeedbackTab({ fbType, setFbType, fbMessage, setFbMessage, fbSending, fbSent, fbError, onSubmit }: FeedbackTabProps) {
  if (fbSent) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
          <ThumbsUp size={24} className="text-green-600" />
        </div>
        <p className="font-medium text-gray-900">Thank you!</p>
        <p className="text-sm text-gray-500">Your feedback has been recorded.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 min-h-0">
      <p className="text-sm text-gray-600">
        Have a suggestion, found a bug, or have a question the AI couldn't answer? Let us know!
      </p>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Type</p>
        <div className="flex gap-2">
          {(Object.keys(FEEDBACK_LABELS) as FeedbackType[]).map(t => (
            <button
              key={t}
              onClick={() => setFbType(t)}
              className={`flex-1 py-2 px-1 text-xs rounded-lg border transition-colors ${
                fbType === t
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {FEEDBACK_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Message</p>
        <textarea
          value={fbMessage}
          onChange={e => setFbMessage(e.target.value)}
          placeholder={
            fbType === 'bug'
              ? 'Describe the bug and steps to reproduce...'
              : fbType === 'wish'
              ? 'What feature would you like the app to support?'
              : 'Ask your question...'
          }
          rows={5}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
        />
      </div>

      {fbError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{fbError}</p>
      )}

      <button
        onClick={onSubmit}
        disabled={!fbMessage.trim() || fbSending}
        className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {fbSending ? <Loader2 size={15} className="animate-spin" /> : null}
        Send
      </button>
    </div>
  );
}

// ── HelpOverlay — FAB + Panel, rendered once in AppShell ─────────────────────
export function HelpOverlay() {
  const { isOpen, toggle } = useHelp();

  return (
    <>
      {/* FAB — hidden when panel is open */}
      {!isOpen && (
        <button
          onClick={toggle}
          title="Help"
          aria-label="Open help"
          className="fixed bottom-5 right-5 z-50 w-12 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
        >
          <HelpCircle size={22} />
        </button>
      )}
      <HelpPanel />
    </>
  );
}

// ── HelpButton — kept for potential future use ────────────────────────────────
export function HelpButton({ onClick, isOpen }: { onClick: () => void; isOpen: boolean }) {
  return (
    <button
      onClick={onClick}
      title="Help"
      aria-label="Open help"
      className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
        isOpen
          ? 'bg-indigo-100 text-indigo-700'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
      }`}
    >
      <HelpCircle size={18} />
    </button>
  );
}
