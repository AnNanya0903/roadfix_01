import type { AIAnalysis, Category, ResolutionComparison, Severity } from '../domain';
import { CATEGORIES } from '../domain';
import { prepareImage } from '../photos';
import { ANON_KEY, FUNCTIONS_URL, getSupabase } from '../mode';
import { AIUnavailableError, type AIProvider, type ImageInput } from './types';

async function toBase64(input: ImageInput): Promise<string> {
  const source = input.blob ?? input.url;
  if (!source) throw new AIUnavailableError('No image supplied.');
  const { dataUrl } = await prepareImage(source, 1024, 0.8);
  return dataUrl.split(',')[1];
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  let token = ANON_KEY;
  try {
    const { data } = await getSupabase().auth.getSession();
    if (data.session?.access_token) token = data.session.access_token;
  } catch {
    /* fall back to anon key */
  }
  let res: Response;
  try {
    res = await fetch(`${FUNCTIONS_URL}/ai-vision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: ANON_KEY },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AIUnavailableError('Could not reach the AI service. Check your connection and try again.');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new AIUnavailableError(res.status === 501 ? 'The AI service is not configured on the server yet.' : `The AI service returned an error (${res.status}). ${text.slice(0, 120)}`);
  }
  return (await res.json()) as T;
}

const isSeverity = (v: unknown): v is Severity => v === 'low' || v === 'medium' || v === 'high';
const isCategory = (v: unknown): v is Category => typeof v === 'string' && (CATEGORIES as readonly string[]).includes(v);

/**
 * Live provider: the browser never sees a model API key. It sends a downscaled photo to the
 * `ai-vision` Supabase Edge Function, which holds the key and returns structured JSON.
 * Swap the model (OpenAI, Gemini, Hugging Face, a custom OpenCV service) inside that function.
 */
export const edgeProvider: AIProvider = {
  id: 'edge-vision',
  label: 'Server-side vision model',
  mode: 'live',

  async analyzeImage(input) {
    const raw = await call<Record<string, unknown>>({ action: 'analyze', image: await toBase64(input) });
    if (!isCategory(raw.category) || !isSeverity(raw.severity)) throw new AIUnavailableError('The AI service returned an unexpected result.');
    const analysis: AIAnalysis = {
      mode: 'live',
      provider: typeof raw.model === 'string' ? raw.model : 'Server-side vision model',
      category: raw.category,
      confidence: typeof raw.confidence === 'number' ? Math.max(0, Math.min(1, raw.confidence)) : 0.5,
      severity: raw.severity,
      description: typeof raw.description === 'string' ? raw.description : 'Possible road issue detected.',
      evidence: Array.isArray(raw.evidence) ? raw.evidence.filter((e): e is string => typeof e === 'string').slice(0, 5) : [],
      analyzedAt: new Date().toISOString(),
    };
    return analysis;
  },

  async compareResolution(before, after) {
    const raw = await call<Record<string, unknown>>({ action: 'compare', before: await toBase64(before), after: await toBase64(after) });
    const verdict = raw.verdict === 'improved' || raw.verdict === 'not_improved' ? raw.verdict : 'unclear';
    const out: ResolutionComparison = {
      mode: 'live',
      provider: typeof raw.model === 'string' ? raw.model : 'Server-side vision model',
      verdict,
      confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.5,
      beforeSummary: typeof raw.beforeSummary === 'string' ? raw.beforeSummary : 'Road damage detected',
      afterSummary: typeof raw.afterSummary === 'string' ? raw.afterSummary : 'No summary available',
      note: verdict === 'improved' ? 'AI-assisted visual comparison suggests improvement. Please confirm on site.' : verdict === 'not_improved' ? 'AI-assisted visual comparison does not show clear improvement.' : 'The comparison is inconclusive.',
    };
    return out;
  },
};
