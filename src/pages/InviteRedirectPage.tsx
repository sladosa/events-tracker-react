import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

export function InviteRedirectPage() {
  const { id } = useParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { setError('Invalid invite link.'); return; }

    const fnBase = import.meta.env.VITE_HELP_API_URL
      ? (import.meta.env.VITE_HELP_API_URL as string).replace(/\/help$/, '')
      : '/.netlify/functions';

    fetch(`${fnBase}/get-invite-link?id=${encodeURIComponent(id)}`)
      .then(res => res.json())
      .then((body: { action_link?: string; error?: string }) => {
        if (body.action_link) {
          window.location.href = body.action_link;
        } else {
          setError(body.error ?? 'Invite not found or expired.');
        }
      })
      .catch(() => setError('Failed to load invite.'));
  }, [id]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-800 mb-2">Invite not valid</h1>
          <p className="text-sm text-gray-500 mb-5">{error}</p>
          <a
            href="/login"
            className="inline-block px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Go to app
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600 text-sm">Loading your invite…</p>
      </div>
    </div>
  );
}
