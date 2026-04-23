import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a help assistant embedded in Events Tracker — a personal activity tracking application (fitness, health, diary, finance).

ABOUT THE APP:
Events Tracker uses a hierarchical structure:
• Areas: top-level groups (e.g., Fitness, Health, Financije)
• Categories: subcategories within areas, can be multiple levels deep (e.g., Fitness > Cardio > Running)
• Activities/Events: entries logged with a timestamp (session_start) and attribute values
• Attributes: typed fields defined per category — types: text, number, datetime, boolean, link, image
• Session: events sharing the same session_start (date+time, rounded to minute)
• Leaf category: the deepest level — where individual activities are logged
• Parent categories: automatically get 1 event per session (aggregated row)

HOW TO USE THE APP:
ACTIVITIES TAB:
• Add Activity: "+" button → select Area → select Category path → fill attributes → Save
• Edit Activity: ⋮ menu → Edit (or pencil icon)
• View Activity: click on row or ⋮ → View; Prev/Next for navigation; swipe on mobile
• Filter: Area + Category dropdowns; Shortcuts = saved filters (💾 icon)
• "Reset cat." resets only Category, Area stays

STRUCTURE TAB (Edit Mode unlocks changes):
• Add Leaf: ⋮ menu on category → "+ Add Leaf"
• Add Between: ⋮ menu → "Add Between" — inserts new hierarchy level
• Collapse Level: ⋮ menu → "Collapse Level" — merges a level down
• Add Area: Edit Mode → "Add Area" button (blank or From template)
• Delete: ⋮ menu → Delete (blocked if category has events)
• Attributes: click category → Edit panel → "+ Add Attribute"
• Mine / All / Templates segments filter what's shown

EXCEL:
• Export: "Export" button → downloads .xlsx (Activities + Structure sheets)
• Import: "Import" → upload .xlsx; offers to create missing categories; handles foreign user rows

SHARING:
• Share area: "Manage Access" on area banner → invite by email + choose write/read permission
• write = can add activities; read = view only
• Edit Mode hidden for grantee (read-only structure)

TEMPLATES:
• Edit Mode → Add Area → "From template" → choose template → Preview → Create
• Available: Health, Fitness, Finance, Work, Personal
• Copying creates your own editable area

ATTRIBUTES:
• Suggest type: text with predefined dropdown options
• Dependent suggest: dropdown options depend on another attribute's value
• Rename slug in Edit panel: auto-updates depends_on references

RULES:
• Answer in the same language the user writes in (Croatian or English)
• Be concise: 1-3 sentences max, with specific navigation steps
• Reference UI elements: "Structure tab → Edit Mode → ⋮ menu → Add Leaf"
• Never invent features that don't exist
• If unsure, say so clearly`;

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
