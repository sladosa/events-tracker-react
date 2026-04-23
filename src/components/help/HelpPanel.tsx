import { useState, useRef, useEffect } from 'react';
import { X, Send, HelpCircle, MessageCircle, ThumbsUp, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useFilter } from '@/context/FilterContext';

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = 'ask' | 'feedback';
type FeedbackType = 'wish' | 'bug' | 'question';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface HelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: 'activities' | 'structure';
}

// Configurable: set VITE_HELP_API_URL=http://localhost:8888/.netlify/functions/help
// in .env.local when testing locally with `netlify dev`
const HELP_API_URL = import.meta.env.VITE_HELP_API_URL ?? '/.netlify/functions/help';

const WELCOME: ChatMessage = {
  role: 'assistant',
  content: 'Zdravo! Kako ti mogu pomoći s Events Trackerom?\nMožeš pitati na hrvatskom ili engleskom. 🙂',
};

const FEEDBACK_LABELS: Record<FeedbackType, string> = {
  wish: '💡 Prijedlog',
  bug: '🐛 Bug',
  question: '❓ Pitanje',
};

// ── Component ─────────────────────────────────────────────────────────────────
export function HelpPanel({ isOpen, onClose, currentPage }: HelpPanelProps) {
  const { filter } = useFilter();

  // ── Ask tab state
  const [tab, setTab] = useState<Tab>('ask');
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Feedback tab state
  const [fbType, setFbType] = useState<FeedbackType>('wish');
  const [fbMessage, setFbMessage] = useState('');
  const [fbSending, setFbSending] = useState(false);
  const [fbSent, setFbSent] = useState(false);
  const [fbError, setFbError] = useState<string | null>(null);

  // Scroll to bottom of chat on new message
  useEffect(() => {
    if (isOpen && tab === 'ask') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, tab]);

  // Reset feedback success state when reopening
  useEffect(() => {
    if (isOpen) {
      setFbSent(false);
      setFbError(null);
      setAskError(null);
    }
  }, [isOpen]);

  // ── Ask tab: send question ─────────────────────────────────────────────────
  const handleSend = async () => {
    const q = input.trim();
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
          context: {
            page: currentPage,
            areaId: filter.areaId ?? null,
          },
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
      // Remove the user message we just added so they can retry
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Feedback tab: submit ───────────────────────────────────────────────────
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

  // ── Layout classes ─────────────────────────────────────────────────────────
  // Mobile: bottom sheet (translate-y animation)
  // Desktop (sm+): right side panel (translate-x animation)
  const panelBase =
    'fixed z-30 bg-white flex flex-col shadow-2xl transition-transform duration-300 ease-in-out';
  const panelMobile =
    'bottom-0 left-0 right-0 h-[78vh] rounded-t-2xl sm:hidden';
  const panelDesktop =
    'hidden sm:flex top-0 right-0 h-screen w-[400px] border-l border-gray-200';
  const panelOpenMobile = isOpen ? 'translate-y-0' : 'translate-y-full';
  const panelOpenDesktop = isOpen ? 'translate-x-0' : 'translate-x-full';

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-20 sm:hidden"
          onClick={onClose}
        />
      )}

      {/* Mobile panel */}
      <div className={`${panelBase} ${panelMobile} ${panelOpenMobile}`}>
        <PanelContent
          tab={tab} setTab={setTab}
          messages={messages} input={input} setInput={setInput}
          loading={loading} askError={askError}
          messagesEndRef={messagesEndRef}
          handleSend={handleSend} handleKeyDown={handleKeyDown}
          fbType={fbType} setFbType={setFbType}
          fbMessage={fbMessage} setFbMessage={setFbMessage}
          fbSending={fbSending} fbSent={fbSent} fbError={fbError}
          handleFeedbackSubmit={handleFeedbackSubmit}
          onClose={onClose}
        />
      </div>

      {/* Desktop panel */}
      <div className={`${panelBase} ${panelDesktop} ${panelOpenDesktop}`}>
        <PanelContent
          tab={tab} setTab={setTab}
          messages={messages} input={input} setInput={setInput}
          loading={loading} askError={askError}
          messagesEndRef={messagesEndRef}
          handleSend={handleSend} handleKeyDown={handleKeyDown}
          fbType={fbType} setFbType={setFbType}
          fbMessage={fbMessage} setFbMessage={setFbMessage}
          fbSending={fbSending} fbSent={fbSent} fbError={fbError}
          handleFeedbackSubmit={handleFeedbackSubmit}
          onClose={onClose}
        />
      </div>
    </>
  );
}

// ── PanelContent (shared between mobile + desktop) ────────────────────────────
interface PanelContentProps {
  tab: Tab; setTab: (t: Tab) => void;
  messages: ChatMessage[]; input: string; setInput: (v: string) => void;
  loading: boolean; askError: string | null;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  handleSend: () => void; handleKeyDown: (e: React.KeyboardEvent) => void;
  fbType: FeedbackType; setFbType: (t: FeedbackType) => void;
  fbMessage: string; setFbMessage: (v: string) => void;
  fbSending: boolean; fbSent: boolean; fbError: string | null;
  handleFeedbackSubmit: () => void;
  onClose: () => void;
}

function PanelContent({
  tab, setTab,
  messages, input, setInput, loading, askError, messagesEndRef,
  handleSend, handleKeyDown,
  fbType, setFbType, fbMessage, setFbMessage,
  fbSending, fbSent, fbError, handleFeedbackSubmit,
  onClose,
}: PanelContentProps) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <HelpCircle size={18} className="text-indigo-600" />
          <span className="font-semibold text-gray-900 text-sm">Pomoć</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
          aria-label="Zatvori"
        >
          <X size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 flex-shrink-0">
        <button
          onClick={() => setTab('ask')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'ask'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <MessageCircle size={15} />
          Pitaj AI
        </button>
        <button
          onClick={() => setTab('feedback')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'feedback'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ThumbsUp size={15} />
          Povratna info
        </button>
      </div>

      {/* Tab content */}
      {tab === 'ask' ? (
        <AskTab
          messages={messages}
          input={input} setInput={setInput}
          loading={loading} error={askError}
          messagesEndRef={messagesEndRef}
          onSend={handleSend} onKeyDown={handleKeyDown}
        />
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
}

// ── Ask Tab ───────────────────────────────────────────────────────────────────
interface AskTabProps {
  messages: ChatMessage[];
  input: string; setInput: (v: string) => void;
  loading: boolean; error: string | null;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onSend: () => void; onKeyDown: (e: React.KeyboardEvent) => void;
}

function AskTab({ messages, input, setInput, loading, error, messagesEndRef, onSend, onKeyDown }: AskTabProps) {
  return (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
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
              <Loader2 size={14} className="animate-spin text-gray-500" />
              <span className="text-sm text-gray-500">Razmišljam...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
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
            onKeyDown={onKeyDown}
            placeholder="Postavi pitanje... (Enter za slanje)"
            rows={2}
            className="flex-1 resize-none border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
          />
          <button
            onClick={onSend}
            disabled={!input.trim() || loading}
            className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            aria-label="Pošalji"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5 text-center">
          Powered by Claude Haiku · Odgovori mogu biti netočni
        </p>
      </div>
    </>
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
        <p className="font-medium text-gray-900">Hvala!</p>
        <p className="text-sm text-gray-500">Povratna informacija je zabilježena.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 min-h-0">
      <p className="text-sm text-gray-600">
        Imaš prijedlog, pronašao si bug, ili imaš pitanje na koje AI nije odgovorio? Pošalji nam!
      </p>

      {/* Type selector */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Vrsta</p>
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

      {/* Message */}
      <div className="flex-1 flex flex-col gap-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Poruka</p>
        <textarea
          value={fbMessage}
          onChange={e => setFbMessage(e.target.value)}
          placeholder={fbType === 'bug' ? 'Opiši bug i korake za reprodukciju...' : fbType === 'wish' ? 'Što bi volio/voljela da aplikacija podržava?' : 'Postavi pitanje...'}
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
        Pošalji
      </button>
    </div>
  );
}

// ── Help Button (used in header) ──────────────────────────────────────────────
interface HelpButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

export function HelpButton({ onClick, isOpen }: HelpButtonProps) {
  return (
    <button
      onClick={onClick}
      title="Pomoć"
      aria-label="Otvori pomoć"
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
