import { evaluateGuardrails, isRefusal } from './guardrails';
import type {
  AssistantIntent,
  AssistantReply,
  EducationSource,
  RedactedAssistantContext,
} from './types';

/**
 * The offline response composer — the assistant's default and only required
 * path.
 *
 * It works with zero AI configuration and zero network access. There is no
 * model call, no timeout to wait on, and nothing that can fail for reasons
 * outside the reader's own device, which is what makes the assistant usable on a
 * patchy rural connection and testable without a network.
 *
 * A reply is *described*, never written: an i18n key plus parameters. The view
 * renders it with next-intl. This keeps three properties intact:
 *
 *   - No layer of the assistant contains prose, so all of it is translatable.
 *   - The offline and gateway replies have the same shape, so the UI can swap
 *     one for the other without a special case.
 *   - Nothing here can compute a health fact. Every number is read out of the
 *     redacted context, which the cycle engine and analytics engine produced.
 *     The composer selects and formats; it never calculates.
 */

export interface ComposeReplyInput {
  /** The reader's raw message. */
  text: string;
  /** Zero-based conversation turn, used to build a deterministic reply id. */
  turn: number;
  context: RedactedAssistantContext;
  /** Already-retrieved, already-localised education sources. */
  sources: EducationSource[];
}

function reply(
  turn: number,
  intent: AssistantIntent,
  messageKey: string,
  params: Record<string, string | number> = {},
  citations: EducationSource[] = [],
  refused = false
): AssistantReply {
  return {
    id: `reply-${turn}`,
    intent,
    messageKey,
    params,
    citations,
    isRefusal: refused,
    source: 'offline',
  };
}

/**
 * Maps a guardrail reason to its reply key.
 *
 * Written out rather than derived from the reason string: a rename of a
 * guardrail key should be a compile error here, not a silently missing
 * translation that renders as a raw key in the reader's language.
 */
const REFUSAL_MESSAGE_KEYS: Record<string, string> = {
  'guardrails.crisis': 'responses.crisisRefusal',
  'guardrails.diagnosis': 'responses.diagnosisRefusal',
  'guardrails.medication': 'responses.medicationRefusal',
  'guardrails.outOfScope': 'responses.outOfScopeRefusal',
};

/** A refusal is specific about what it declined and where to go instead. */
function composeRefusal(
  turn: number,
  intent: AssistantIntent,
  reasonKey: string
): AssistantReply {
  return reply(turn, intent, REFUSAL_MESSAGE_KEYS[reasonKey] ?? 'responses.noMatch', {}, [], true);
}

/**
 * Answers a prediction question purely from the cycle engine's own output.
 *
 * When the engine reports `insufficient_data` the assistant says so. It does not
 * estimate, average, or reason about dates — that is the single most important
 * behaviour in this file, because a wrong date is the failure users would act on.
 */
function composePredictionReply(
  turn: number,
  context: RedactedAssistantContext,
  sources: EducationSource[]
): AssistantReply {
  const { prediction } = context;

  if (prediction.status === 'predicted' && prediction.estimatedStartDate) {
    if (prediction.fertileWindowStartDate && prediction.fertileWindowEndDate) {
      return reply(
        turn,
        'prediction',
        'responses.predictionWithWindow',
        {
          estimatedDate: prediction.estimatedStartDate,
          windowStart: prediction.fertileWindowStartDate,
          windowEnd: prediction.fertileWindowEndDate,
        },
        sources
      );
    }

    return reply(
      turn,
      'prediction',
      'responses.predictionReady',
      { estimatedDate: prediction.estimatedStartDate },
      sources
    );
  }

  if (prediction.status === 'invalid_input') {
    return reply(turn, 'prediction', 'responses.noData', {}, sources);
  }

  return reply(
    turn,
    'prediction',
    'responses.predictionInsufficient',
    { recordedCycles: context.recordedCycles },
    sources
  );
}

/**
 * Summarises what the reader has already recorded.
 *
 * Only aggregates that already exist in the context are quoted. Free-text notes
 * are not in the context, so they cannot be echoed back — a point worth making
 * in the UI, because "the assistant knows my data" is exactly the worry a
 * privacy-first product has to answer.
 */
function composeSummaryReply(
  turn: number,
  context: RedactedAssistantContext
): AssistantReply {
  const { cycle, daily } = context;

  if (context.recordedCycles === 0 && context.recordedDailyLogs === 0) {
    return reply(turn, 'personalSummary', 'responses.summaryNoData');
  }

  if (cycle.averageCycleLengthDays !== null) {
    return reply(turn, 'personalSummary', 'responses.summaryWithCycle', {
      recordedCycles: context.recordedCycles,
      recordedDays: daily.recordedDays,
      averageCycle: cycle.averageCycleLengthDays,
      averagePeriod: cycle.averagePeriodLengthDays ?? 0,
    });
  }

  return reply(turn, 'personalSummary', 'responses.summaryNoCycle', {
    recordedCycles: context.recordedCycles,
    recordedDays: daily.recordedDays,
  });
}

/**
 * Produces the reply for one turn.
 *
 * Order matters: guardrails run before intent routing, so a safety outcome can
 * never be overwritten by a later branch.
 */
export function composeOfflineReply(input: ComposeReplyInput): AssistantReply {
  const { text, turn, context, sources } = input;

  const guardrail = evaluateGuardrails(text);
  if (isRefusal(guardrail)) {
    return composeRefusal(turn, guardrail.intent, guardrail.reasonKey);
  }

  const intent = guardrail.intent;

  switch (intent) {
    case 'greeting':
      return reply(turn, intent, 'responses.greeting');

    case 'prediction':
      return composePredictionReply(turn, context, sources);

    case 'personalSummary':
      return composeSummaryReply(turn, context);

    case 'education':
    case 'unknown':
    default:
      // `unknown` still attempts retrieval: a message with no recognisable
      // intent may simply share vocabulary with an article. When nothing
      // matches, the assistant says so and points at the library rather than
      // improvising.
      if (sources.length > 0) {
        return reply(turn, intent, 'responses.education', { count: sources.length }, sources);
      }
      return reply(turn, intent, 'responses.noMatch');
  }
}
