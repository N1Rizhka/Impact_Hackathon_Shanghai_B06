/**
 * OpenAI-compatible chat client (OpenDev / openai-next credits).
 * Key stays server-side via env — never expose to the browser.
 */

const DEFAULT_BASE = 'https://api.openai-next.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';

export function hasAiConfig() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function chatCompletion({
  messages,
  model,
  temperature = 0.4,
  maxTokens = 2500,
  responseFormat,
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const base = (process.env.OPENAI_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
  const payload = {
    model: model || process.env.OPENAI_MODEL || DEFAULT_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (responseFormat) payload.response_format = responseFormat;

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      // openai-next sits behind Cloudflare; bare fetch can get 1010 without a UA.
      'User-Agent': 'BrainAid/1.0 (hackathon; server)',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`AI API returned non-JSON (${res.status})`);
  }

  if (!res.ok) {
    const msg = data?.error?.message || data?.message || text.slice(0, 200);
    throw new Error(`AI API ${res.status}: ${msg}`);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI API returned an empty response');
  return { content, model: data.model, usage: data.usage };
}
