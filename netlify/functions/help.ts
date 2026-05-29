import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// ── Dynamic help docs — loaded from docs/help/*.md at startup ─────────────────
// Files are bundled via netlify.toml included_files = ["docs/help/**"]
// process.cwd() = project root locally (netlify dev) and function root on Lambda.
// Adding a new feature: update docs/help/<topic>.md — no changes to this file needed.

const HELP_DOC_NAMES = [
  'concepts',
  'activities',
  'structure',
  'sharing',
  'excel',
  'attributes',
  'templates',
];

function readHelpDoc(name: string): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), 'docs', 'help', `${name}.md`), 'utf-8');
  } catch {
    return '';
  }
}

const HELP_DOCS = HELP_DOC_NAMES
  .map(name => readHelpDoc(name))
  .filter(Boolean)
  .join('\n\n---\n\n');

// ── Static system prompt — identity, rules, Demo Area reference ───────────────
// Keep ONLY content that doesn't belong in any feature doc:
//   • AI identity + tone rules
//   • Demo Area paths (specific reference for explaining features)
// Everything else lives in docs/help/*.md — edit those files, not this string.

const STATIC_PROMPT = `You are a help assistant embedded in Events Tracker — a personal activity tracking application (fitness, health, diary, finance).

ABOUT THE APP:
Events Tracker stores activities using a hierarchical structure: Areas → Categories (multiple levels) → Activities/Events with typed Attributes. The deepest category level is called "leaf" — that is where individual activities are logged. Parent categories automatically get 1 aggregated event per session.

DEMO AREA (template — use as reference for explaining features):
• Structure tab → Templates → Demo shows a live example of all features
• Exercise > Strength > Upper Body / Lower Body: suggest attribute (Exercise dropdown), number attributes (Sets, Reps, Weight)
• Exercise > Cardio: Activity Type (suggest), Subtype (dependent suggest — options change based on Activity Type), Duration + Distance (number), Notes (text)
• Daily Log > Mood: Mood (suggest), Notes (text), Photo (image)
• Daily Log > Task: Title (text), Done (boolean), Due Date (datetime), Reference (link)
• When explaining attribute types, reference: "For example, in Demo > Exercise > Cardio you can see suggest + dependent suggest"

RULES:
• Answer in the same language the user writes in (Croatian or English)
• Be concise: 1–3 sentences max, with specific navigation steps
• Reference UI elements by name: "Structure tab → Edit Mode → ⋮ menu → Add Leaf"
• Never invent features that don't exist
• If unsure, say so clearly`;

// ── Full system prompt = static framing + all feature docs ────────────────────
const SYSTEM_PROMPT = HELP_DOCS
  ? `${STATIC_PROMPT}\n\n## DOCUMENTATION\n\n${HELP_DOCS}`
  : STATIC_PROMPT;

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface HelpRequest {
  question: string;
  history?: ChatMessage[];
  context?: {
    page?: string;
    areaId?: string | null;
    areaName?: string | null;
    categoryId?: string | null;
  };
  userId?: string;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export const handler = async (event: { httpMethod: string; body: string | null }) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const req: HelpRequest = JSON.parse(event.body || '{}');
    const { question, history = [], context = {}, userId } = req;

    if (!question?.trim()) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Question required' }) };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'API key not configured' }) };
    }

    const anthropic = new Anthropic({ apiKey });

    // Build context note for system prompt
    const contextParts: string[] = [];
    if (context.page) contextParts.push(`page: ${context.page}`);
    if (context.areaName) contextParts.push(`area: ${context.areaName}`);
    const contextNote = contextParts.length
      ? `\n\n[User context: ${contextParts.join(', ')}]`
      : '';

    // Keep last 10 messages to avoid excessive token usage
    const trimmedHistory = history.slice(-10);

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SYSTEM_PROMPT + contextNote,
      messages: [
        ...trimmedHistory,
        { role: 'user', content: question.trim() },
      ],
    });

    const answer = response.content[0].type === 'text' ? response.content[0].text : '';
    const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

    // Log to Supabase via service role (optional — skipped if env vars not set)
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceRoleKey) {
      try {
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        await supabase.from('help_log').insert({
          user_id: userId || null,
          question: question.trim(),
          answer,
          context,
          tokens_used: tokensUsed,
        });
      } catch (logErr) {
        console.warn('help_log insert failed (non-fatal):', logErr);
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ answer }),
    };
  } catch (err) {
    console.error('help function error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get answer' }),
    };
  }
};
