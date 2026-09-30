/**
 * Thin wrapper around the Gemini SDK shared by the API routes and the
 * `npm run check:gemini` script, so both use the same call settings.
 */
import { GoogleGenAI } from '@google/genai';

// The strongest model: "gemini-pro-latest" always points to Google's newest
// Pro release. Pro needs billing enabled on the key's Google Cloud project
// (the free tier allows it 0 requests); until then the fallbacks answer.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-pro-latest';

// Tried in order when the model before is out of quota or overloaded.
// Comma-separated; set GEMINI_FALLBACK_MODELS to an empty string to disable.
const DEFAULT_FALLBACK_MODELS = 'gemini-3.8-flash,gemini-3.7-flash,gemini-3.5-flash';
export const GEMINI_MODELS = [
  ...new Set([
    GEMINI_MODEL,
    ...(process.env.GEMINI_FALLBACK_MODELS ?? DEFAULT_FALLBACK_MODELS).split(',').map((model) => model.trim()).filter(Boolean),
  ]),
];

// Per HTTP attempt; Pro with high thinking can take a minute or more
const ATTEMPT_TIMEOUT_MS = 120000;
// Quota (429) and "high demand" (503) errors move straight on to the next
// model, which has its own quota and capacity. Other server errors get one
// quick retry. The last model has nothing to fall back on, so it also waits
// out 429 and 503.
const RETRY_OPTIONS = { attempts: 2, initialDelay: 2, maxDelay: 4, httpStatusCodes: [500, 502, 504] };
const LAST_MODEL_RETRY_OPTIONS = { attempts: 3, initialDelay: 2, maxDelay: 8, httpStatusCodes: [429, 500, 502, 503, 504] };

// A model that is out of quota or overloaded is skipped for a while, so
// requests don't each wait on a call that is sure to fail
const COOLDOWN_MS = { 429: 10 * 60 * 1000, 503: 60 * 1000 };
const cooldownUntil = new Map();

/** Forget which models are cooling down (used by tests). */
export const resetModelCooldowns = () => cooldownUntil.clear();

/** True when a key is set and isn't an obvious placeholder. */
export const isGeminiConfigured = (apiKey = process.env.GEMINI_API_KEY) =>
  Boolean(apiKey) && !apiKey.includes('your-');

export const GEMINI_NOT_CONFIGURED_NOTICE =
  'AI recommendations are not set up on this server: no Gemini API key was found (GEMINI_API_KEY). Standard recommendations are shown instead.';

/** A clear, user-facing explanation of why a Gemini call failed. */
export function describeGeminiFailure(error) {
  const status = error?.status;
  const text = String(error?.message ?? '');
  const shown = 'Standard recommendations are shown instead.';
  if (status === 429 || /quota|RESOURCE_EXHAUSTED/i.test(text)) {
    return `The Gemini usage limit for this API key has been reached (a free-tier key allows only a few requests a day). ${shown} Enable billing on the key's Google Cloud project for full access.`;
  }
  if (status === 401 || status === 403 || /API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(text)) {
    return `The Gemini API key on the server was rejected. Check GEMINI_API_KEY. ${shown}`;
  }
  if (status === 404) {
    return `The configured Gemini model isn't available to this API key. Check GEMINI_MODEL. ${shown}`;
  }
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError' || /timed? ?out|aborted/i.test(text)) {
    return `Gemini took too long to answer. ${shown} Please try again in a few minutes.`;
  }
  if ((status >= 500 && status < 600) || /high demand|overloaded|UNAVAILABLE/i.test(text)) {
    return `Gemini is busy right now. ${shown} Please try again in a few minutes.`;
  }
  return `AI recommendations couldn't be generated this time. ${shown} Please try again in a few minutes.`;
}

/**
 * Call Gemini and return the reply text, trying the next model in
 * GEMINI_MODELS when one is out of quota or overloaded.
 *
 * Throws a descriptive error when the reply is empty, blocked, or cut off by
 * the output-token limit, since a truncated JSON reply can't be used.
 * Pass `signal` to bound the total time across models and retries.
 */
export async function generateText({ apiKey, contents, config = {}, signal }) {
  const ai = new GoogleGenAI({ apiKey });
  const ready = GEMINI_MODELS.filter((model) => (cooldownUntil.get(model) ?? 0) <= Date.now());
  // If every model is cooling down, trying again beats failing without a call
  const chain = ready.length > 0 ? ready : GEMINI_MODELS;

  let result;
  for (const [index, model] of chain.entries()) {
    const isLast = index === chain.length - 1;
    try {
      result = await ai.models.generateContent({
        model,
        contents,
        config: {
          ...config,
          ...(signal ? { abortSignal: signal } : {}),
          httpOptions: { timeout: ATTEMPT_TIMEOUT_MS, retryOptions: isLast ? LAST_MODEL_RETRY_OPTIONS : RETRY_OPTIONS },
        },
      });
      if (model !== GEMINI_MODEL) console.warn(`Gemini reply came from fallback model ${model}`);
      break;
    } catch (error) {
      const cooldown = COOLDOWN_MS[error.status];
      if (cooldown) cooldownUntil.set(model, Date.now() + cooldown);
      if (!cooldown || isLast || signal?.aborted) throw error;
      console.warn(`${model} unavailable (${error.status}); trying ${chain[index + 1]}`);
    }
  }

  const blockReason = result.promptFeedback?.blockReason;
  if (blockReason) {
    throw new Error(`Gemini blocked the request (${blockReason})`);
  }
  const finishReason = result.candidates?.[0]?.finishReason;
  if (finishReason === 'MAX_TOKENS') {
    throw new Error('Gemini reply was cut off by the output token limit');
  }
  const text = result.text;
  if (!text) {
    throw new Error(`Gemini returned no text (finish reason: ${finishReason ?? 'unknown'})`);
  }
  return text;
}
