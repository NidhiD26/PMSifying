import { evaluateGuardrails, isRefusal } from './guardrails';
import type { EducationSource, RedactedAssistantContext } from './types';

/**
 * Optional Gemma gateway. OFF by default.
 *
 * ---------------------------------------------------------------------------
 * SERVER ONLY
 * ---------------------------------------------------------------------------
 * This module reads a provider credential from the environment and must never
 * reach a browser bundle. Three things enforce that:
 *
 *   1. The variables are not `NEXT_PUBLIC_*`, so Next.js will not inline them.
 *   2. This file is deliberately NOT re-exported from `src/lib/assistant/index.ts`.
 *      The barrel is what the client view imports; omitting the gateway is what
 *      keeps it out of the graph. A test asserts the barrel stays that way.
 *   3. Only `/api/assistant` imports it, server-side.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE PROVIDER RECEIVES
 * ---------------------------------------------------------------------------
 * Exactly two things: the `RedactedAssistantContext` (an allowlist that cannot
 * hold PIN material, free-text notes, or raw records) and the retrieved
 * education excerpts, which are bundled public content in the reader's own
 * language. Nothing is read from the database here — the server has no access
 * to IndexedDB, and does not need any.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE PROVIDER IS NOT ALLOWED TO DO
 * ---------------------------------------------------------------------------
 * It may rephrase already-computed facts and nothing else. All arithmetic stays
 * in the cycle engine, per the "No AI for Math" principle; the prompt below
 * forbids the model from doing any, and the local reply is always composed
 * first so a gateway failure degrades to a working answer rather than an error.
 */

/** Set to exactly `enabled` to turn the gateway on. Anything else means off. */
export const GATEWAY_FLAG_VAR = 'PMSIFY_ASSISTANT_GATEWAY';
export const GATEWAY_KEY_VAR = 'PMSIFY_GEMMA_API_KEY';
export const GATEWAY_ENDPOINT_VAR = 'PMSIFY_GEMMA_ENDPOINT';
export const GATEWAY_MODEL_VAR = 'PMSIFY_GEMMA_MODEL';

const DEFAULT_MODEL = 'gemma-3-27b-it';
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_OUTPUT_CHARS = 1_500;
/** Guards against a pathological payload reaching the provider. */
const MAX_GROUNDING_CHARS = 12_000;

type EnvLike = Record<string, string | undefined>;

export function isGatewayEnabled(env: EnvLike = process.env): boolean {
  return (env[GATEWAY_FLAG_VAR] ?? '').trim().toLowerCase() === 'enabled';
}

export function isGatewayConfigured(env: EnvLike = process.env): boolean {
  if (!isGatewayEnabled(env)) return false;
  return Boolean((env[GATEWAY_KEY_VAR] ?? '').trim() && (env[GATEWAY_ENDPOINT_VAR] ?? '').trim());
}

/** Why a gateway attempt did not produce text. Never surfaced raw to the client. */
export type GatewayFailureReason =
  | 'disabled'
  | 'not_configured'
  | 'guardrail'
  | 'empty_message'
  | 'upstream_unavailable'
  | 'upstream_rejected'
  | 'empty_response';

export type GatewayResult =
  | { ok: true; text: string }
  | { ok: false; reason: GatewayFailureReason };

/**
 * The model is a voice, not a clinician and not a calculator.
 *
 * Deliberately written as prohibitions: a model asked to "be helpful" will
 * drift into advising, and the guardrail keywords cannot catch prose it invents.
 */
const SYSTEM_PROMPT = [
  'You are the writing voice of a menstrual health tracking app used in India.',
  'You explain health education and summarise facts the app has already computed.',
  '',
  'Hard rules, in priority order:',
  '1. Never diagnose, and never suggest the reader has any condition.',
  '2. Never recommend, change, or comment on any medication, supplement, or dose.',
  '3. Never perform or approximate any date or cycle calculation. If a number is',
  '   not present in the FACTS block, say you do not have it.',
  '4. Use only the FACTS and SOURCES blocks below. Do not add outside knowledge.',
  '5. If the reader appears to be in distress, do not answer the question at all:',
  '   encourage them to contact a health professional or the helpline shown in',
  '   the app, and stop.',
  '6. Reply in the language named by FACTS.locale, and in at most four sentences.',
  '',
  'You are not a doctor and nothing you write is medical advice.',
].join('\n');

export interface GatewayRequest {
  text: string;
  context: RedactedAssistantContext;
  sources: EducationSource[];
}

function buildGrounding(request: GatewayRequest): string {
  const sources = request.sources
    .map((source) => `- [${source.articleId}] ${source.title}: ${source.excerpt}`)
    .join('\n');

  const grounding = [
    'FACTS (already computed by the app; treat every number as exact and final):',
    JSON.stringify(request.context),
    '',
    'SOURCES (education articles the app can also show the reader):',
    sources.length > 0 ? sources : '(none matched)',
  ].join('\n');

  return grounding.length > MAX_GROUNDING_CHARS
    ? grounding.slice(0, MAX_GROUNDING_CHARS)
    : grounding;
}

/**
 * Re-runs the safety rules on the server.
 *
 * The client already refuses locally, so this should never fire. It exists so
 * that a crafted direct request to the API cannot use the provider to answer a
 * crisis, diagnostic, or medication question — the client is not a trust
 * boundary, the server is.
 */
export function shouldForwardToProvider(text: string): boolean {
  return !isRefusal(evaluateGuardrails(text));
}

/**
 * Asks the provider to phrase a reply.
 *
 * Never throws. Every failure mode collapses to a typed reason so the caller
 * can fall back to the deterministic reply without inspecting an exception.
 */
export async function requestGatewayReply(
  request: GatewayRequest,
  env: EnvLike = process.env
): Promise<GatewayResult> {
  if (!isGatewayEnabled(env)) return { ok: false, reason: 'disabled' };
  if (!isGatewayConfigured(env)) return { ok: false, reason: 'not_configured' };

  const text = request.text.trim();
  if (text.length === 0) return { ok: false, reason: 'empty_message' };
  if (!shouldForwardToProvider(text)) return { ok: false, reason: 'guardrail' };

  const apiKey = (env[GATEWAY_KEY_VAR] ?? '').trim();
  const endpoint = (env[GATEWAY_ENDPOINT_VAR] ?? '').trim();
  const model = (env[GATEWAY_MODEL_VAR] ?? '').trim() || DEFAULT_MODEL;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 400,
        stream: false,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `${buildGrounding(request)}\n\nREADER QUESTION: ${text}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    // Network failure, DNS failure, or timeout. Never surfaced with detail.
    return { ok: false, reason: 'upstream_unavailable' };
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, reason: 'upstream_rejected' };
  }
  if (!response.ok) {
    return { ok: false, reason: 'upstream_unavailable' };
  }

  let content: unknown;
  try {
    // OpenAI-compatible response shape: `choices[0].message.content`. This is
    // deliberate. Gemma is normally self-hosted behind an OpenAI-compatible
    // server (vLLM, llama.cpp, Ollama), so the endpoint is configured per
    // deployment and the payload shape is the one those servers share. A
    // native `candidates[].content.parts[]` body will parse as empty_response
    // and fall back to the deterministic reply, so a wrong endpoint degrades
    // rather than breaks.
    const payload = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    content = payload.choices?.[0]?.message?.content;
  } catch {
    return { ok: false, reason: 'upstream_unavailable' };
  }

  if (typeof content !== 'string' || content.trim().length === 0) {
    return { ok: false, reason: 'empty_response' };
  }

  return { ok: true, text: content.trim().slice(0, MAX_OUTPUT_CHARS) };
}
