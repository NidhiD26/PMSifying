import { z } from 'zod';
import { assertRedactedContextIsSafe, RedactedContextViolation } from '@/lib/assistant/context';
import { requestGatewayReply } from '@/lib/assistant/gateway';
import { knownArticleIds } from '@/lib/assistant/retrieval';
import { REDACTED_CONTEXT_SCHEMA_VERSION } from '@/lib/assistant/types';
import { LOCALES, type Locale } from '@/types/i18n';

/**
 * The optional AI gateway, as a plain function.
 *
 * This lives outside `app/api/assistant/route.ts` on purpose. Next.js rejects
 * any export from a route module other than the HTTP verbs and a fixed list of
 * config fields, so a handler that is also unit-testable cannot be exported from
 * the route file. Keeping the logic here and leaving the route as a two-line
 * adapter means the request contract is directly testable, and the rule that
 * the gateway is reachable from exactly one place is enforced by Next itself.
 *
 * Server-only by construction: this imports the gateway, which holds the
 * provider credential, so it is deliberately absent from the client-safe barrel
 * in `index.ts`.
 *
 * This is the only place in the app where a reader's data can leave the device,
 * so the request body is validated as a strict allowlist before anything is
 * forwarded. The Zod schema below is the *second* allowlist, mirroring
 * `RedactedAssistantContext`:
 *
 *   - `.strict()` on every object rejects unknown keys outright, so a client
 *     that tries to smuggle `notes` or `pinHash` in an extra property is
 *     refused rather than silently stripped.
 *   - No field accepts free text. The longest strings permitted are an enum and
 *     a translation key, and every number is a finite `z.number()`.
 *
 * Behaviour when the gateway is off — the default — is a 200 with
 * `mode: 'offline'`, not an error. The client composes its deterministic reply
 * either way, so "off" is a normal outcome rather than a failure state.
 */

const MAX_QUESTION_CHARS = 500;
const MAX_ARTICLES = 3;
const MAX_EXCERPT_CHARS = 600;
const MAX_TITLE_CHARS = 200;

const frequencySchema = z
  .object({
    id: z.string().min(1).max(50),
    count: z.number().int().min(0),
  })
  .strict();

const cycleFactsSchema = z
  .object({
    recordedCycles: z.number().int().min(0),
    averageCycleLengthDays: z.number().nullable(),
    shortestCycleLengthDays: z.number().nullable(),
    longestCycleLengthDays: z.number().nullable(),
    averagePeriodLengthDays: z.number().nullable(),
    cycleLengthsDays: z.array(z.number().int().min(0).max(365)).max(12),
    variabilityCategory: z.enum([
      'stable',
      'moderate',
      'variable',
      'insufficient_data',
    ]),
  })
  .strict();

const predictionSchema = z
  .object({
    status: z.enum(['predicted', 'insufficient_data', 'invalid_input']),
    estimatedStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    estimatedOvulationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    fertileWindowStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    fertileWindowEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  })
  .strict();

const dailyFactsSchema = z
  .object({
    recordedDays: z.number().int().min(0),
    averagePainLevel: z.number().nullable(),
    averageSleepHours: z.number().nullable(),
    averageHydrationMl: z.number().nullable(),
    topSymptoms: z.array(frequencySchema).max(5),
    topMoods: z.array(frequencySchema).max(5),
  })
  .strict();

const insightSchema = z
  .object({
    id: z.string().min(1).max(80),
    category: z.enum([
      'cycle',
      'period',
      'symptoms',
      'mood',
      'pain',
      'sleep',
      'hydration',
      'general',
    ]),
    priority: z.enum(['low', 'medium', 'high']),
    titleKey: z.string().min(1).max(120),
    messageKey: z.string().min(1).max(120),
  })
  .strict();

/**
 * Locale is validated against `LOCALES` rather than a duplicated literal tuple,
 * so adding a language to the app cannot leave this route rejecting it.
 */
const localeSchema = z.custom<Locale>(
  (value) => typeof value === 'string' && (LOCALES as string[]).includes(value),
  { message: 'Unsupported locale' }
);

export const redactedContextSchema = z
  .object({
    schemaVersion: z.literal(REDACTED_CONTEXT_SCHEMA_VERSION),
    locale: localeSchema,
    dataSufficiency: z.enum(['sufficient_data', 'insufficient_data']),
    recordedCycles: z.number().int().min(0),
    recordedDailyLogs: z.number().int().min(0),
    cycle: cycleFactsSchema,
    prediction: predictionSchema,
    daily: dailyFactsSchema,
    insights: z.array(insightSchema).max(3),
  })
  .strict();

/**
 * Only article ids from the bundled corpus are accepted, so a caller cannot
 * cite an article the app does not ship. Real prose is still expected here and
 * it is length-capped.
 *
 * This is a citation allowlist, not a content attestation: the title and excerpt
 * are not re-derived from the corpus here, because the client localises article
 * text before sending it. The guarantee this route provides is therefore "no
 * records from this app's own storage", not "only corpus prose ever reaches the
 * provider". The boundary that is actually enforced is the redacted-context
 * schema, which rejects forbidden keys at any depth.
 */
const KNOWN_ARTICLE_IDS = new Set(knownArticleIds());

const articleIdSchema = z
  .string()
  .min(1)
  .max(60)
  .refine((id) => KNOWN_ARTICLE_IDS.has(id), { message: 'Unknown article id' });

const sourceSchema = z
  .object({
    articleId: articleIdSchema,
    topic: z.enum([
      'cycleBasics',
      'symptoms',
      'whenToSeeDoctor',
      'lifestyle',
      'conditions',
    ]),
    score: z.number().min(0),
    titleKey: z.string().min(1).max(120),
    summaryKey: z.string().min(1).max(120),
    title: z.string().min(1).max(MAX_TITLE_CHARS),
    summary: z.string().max(MAX_TITLE_CHARS),
    excerpt: z.string().max(MAX_EXCERPT_CHARS),
  })
  .strict();

export const assistantRequestSchema = z
  .object({
    text: z.string().trim().min(1).max(MAX_QUESTION_CHARS),
    context: redactedContextSchema,
    sources: z.array(sourceSchema).max(MAX_ARTICLES),
  })
  .strict();

export type AssistantRequestBody = z.infer<typeof assistantRequestSchema>;

type HandlerResult =
  | { status: number; body: Record<string, unknown> };

/**
 * Framework-free request handler.
 *
 * Kept separate from `POST` so the behaviour is testable without a Next
 * runtime, and so the response shape is decided in exactly one place.
 */
export async function handleAssistantRequest(
  payload: unknown,
  env: Record<string, string | undefined> = process.env
): Promise<HandlerResult> {
  const parsed = assistantRequestSchema.safeParse(payload);
  if (!parsed.success) {
    // The issue list can echo submitted values, so only the paths are reported.
    return {
      status: 400,
      body: {
        ok: false,
        error: 'invalid_request',
        fields: parsed.error.issues.map((issue) => issue.path.join('.')),
      },
    };
  }

  const { text, context, sources } = parsed.data;

  // Belt and braces: the schema already forbids these fields, this catches a
  // future schema edit that widens one back to free text.
  try {
    assertRedactedContextIsSafe(context);
  } catch (error) {
    if (error instanceof RedactedContextViolation) {
      return { status: 400, body: { ok: false, error: 'context_rejected' } };
    }
    throw error;
  }

  const result = await requestGatewayReply(
    { text, context, sources },
    env
  );

  if (!result.ok) {
    // These three are expected outcomes, not failures, so the client is told it
    // simply has no provider text and keeps its deterministic reply:
    //
    //   disabled / not_configured  the default configuration
    //   guardrail                   a refusal the client already composed
    //
    // `guardrail` matters most here. It is what a crisis or medication message
    // produces, and reporting that as a gateway error would put an error banner
    // in front of someone who just typed "I want to kill myself".
    const isExpectedOff =
      result.reason === 'disabled' ||
      result.reason === 'not_configured' ||
      result.reason === 'guardrail';
    return {
      status: isExpectedOff ? 200 : 502,
      body: isExpectedOff
        ? { ok: true, mode: 'offline' }
        : { ok: false, error: 'gateway_unavailable', reason: result.reason },
    };
  }

  return { status: 200, body: { ok: true, mode: 'gateway', text: result.text } };
}