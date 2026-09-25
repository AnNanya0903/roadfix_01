// RoadFix AI — server-side vision analysis.
//
// This holds the model API key so it never reaches the browser. It is called by
// src/lib/ai/edgeProvider.ts when the app runs in live mode.
//
// Swap in a real model by implementing analyzeWithModel/compareWithModel below and
// setting the corresponding secret with `supabase secrets set`. Until a key is set,
// this function returns 501 and the client falls back to explaining that live analysis
// is not configured yet (it does not silently pretend to be a real model).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CATEGORIES = ["pothole", "road_crack", "waterlogging", "streetlight", "fallen_tree", "debris", "damaged_sign", "open_manhole", "obstruction", "other"];

interface AnalyzeBody { action: "analyze"; image: string }
interface CompareBody { action: "compare"; before: string; after: string }

// Example using an OpenAI-compatible vision endpoint. Set OPENAI_API_KEY to enable it;
// swap the fetch below for Gemini, a Hugging Face endpoint, or your own OpenCV/model
// service — the response shape below is all the frontend needs.
async function analyzeWithModel(imageBase64: string): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new NotConfigured();
  const prompt = `You are a road-damage inspector. Look at this road photo and respond with ONLY minified JSON: {"category": one of ${JSON.stringify(CATEGORIES)}, "confidence": 0..1, "severity": "low"|"medium"|"high", "description": "one short sentence starting with 'Possible'", "evidence": ["short factual observation", ...max 3]}. If the photo does not show a road, use category "other" and low confidence.`;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }] }],
      max_tokens: 300,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`Model request failed (${res.status})`);
  const data = await res.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
  return { ...parsed, model: "gpt-4o-mini" };
}

async function compareWithModel(beforeB64: string, afterB64: string): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new NotConfigured();
  const prompt = `Compare these two road photos, BEFORE then AFTER a claimed repair. Respond with ONLY minified JSON: {"verdict": "improved"|"unclear"|"not_improved", "confidence": 0..1, "beforeSummary": "one short sentence", "afterSummary": "one short sentence"}.`;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${beforeB64}` } }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${afterB64}` } }] }],
      max_tokens: 200,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`Model request failed (${res.status})`);
  const data = await res.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
  return { ...parsed, model: "gpt-4o-mini" };
}

class NotConfigured extends Error {}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = (await req.json()) as AnalyzeBody | CompareBody;
    let result: Record<string, unknown>;
    if (body.action === "analyze") result = await analyzeWithModel(body.image);
    else if (body.action === "compare") result = await compareWithModel(body.before, body.after);
    else return new Response("Unknown action", { status: 400, headers: corsHeaders });
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    if (e instanceof NotConfigured) {
      return new Response(JSON.stringify({ error: "No vision model is configured on the server yet. Set OPENAI_API_KEY (or wire in another provider) and redeploy." }), { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Analysis failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
