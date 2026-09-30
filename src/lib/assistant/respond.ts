import { evaluateGuardrails, isRefusal } from './guardrails';
import { classifyAppTopic, routeQuestion } from './route';
import {
  APP_HELP_PATHS,
  KNOWLEDGE_ENTRIES,
  knowledgeKey,
  matchKnowledge,
  qualifyKnowledgeKey,
  type AppHelpTopic,
  type KnowledgeEntry,
  type KnowledgeMatch,
  type KnowledgeProvenance,
} from './knowledge';
import type {
  AssistantBlock,
  AssistantIntent,
  AssistantReply,
  AssistantRoute,
  EducationSource,
  RedactedAssistantContext,
} from './types';

/**
 * The offline response composer — the assistant's default and only required
 * path.
 *
 * It works with zero AI configuration and zero network access. There is no model
 * call, no timeout to wait on, and nothing that can fail for reasons outside the
 * reader's own device, which is what makes the assistant usable on a patchy rural
 * connection and testable without a network.
 *
 * A reply is *described*, never written: i18n keys plus parameters. The view
 * renders them with next-intl. This keeps three properties intact:
 *
 *   - No layer of the assistant contains prose, so all of it is translatable.
 *   - The offline and gateway replies have the same shape, so the UI can swap one
 *     for the other without a special case.
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

interface ReplyParts {
  messageKey: string;
  params?: Record<string, string | number>;
  blocks?: AssistantBlock[];
  provenance?: KnowledgeProvenance[];
  citations?: EducationSource[];
}

function reply(
  turn: number,
  intent: AssistantIntent,
  route: AssistantRoute,
  parts: ReplyParts,
  refused = false
): AssistantReply {
  return {
    id: `reply-${turn}`,
    intent,
    route,
    messageKey: parts.messageKey,
    params: parts.params ?? {},
    blocks: parts.blocks ?? [],
    provenance: parts.provenance ?? [],
    citations: parts.citations ?? [],
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

/**
 * The red-flag guidance for a message, if it names one.
 *
 * Deliberately independent of `routeQuestion`, because this runs on the refusal
 * path — after the guardrails have already decided the assistant must decline —
 * and a decline is not routed at all. Matching here is therefore only ever
 * additive: it can attach "seek care now" guidance to a reply that is already a
 * refusal, and it can never replace the refusal with an answer.
 *
 * Scoped to the `safety` domain on purpose. `matchKnowledge` returns the single
 * best entry overall, and a refusal message about a diagnosis could easily be
 * about an ordinary topic; only an entry that is itself a red flag qualifies.
 */
function medicalSafetyMatch(text: string): KnowledgeMatch | null {
  const match = matchKnowledge(KNOWLEDGE_ENTRIES, text);
  return match?.entry.domain === 'safety' ? match : null;
}

/**
 * The warning and care lines a red-flag match contributes to a refusal.
 *
 * The `answer` slot is skipped here even though the match has one: the refusal's
 * own message is the lead, and a second lead paragraph underneath a crisis
 * message would bury it.
 */
function medicalSafetyBlocks(match: KnowledgeMatch): AssistantBlock[] {
  const { entry } = match;
  const blocks: AssistantBlock[] = [];
  const cite = entry.articles ?? [];
  if (entry.warningKey) {
    blocks.push({ kind: 'warning', key: qualifyKnowledgeKey(entry.warningKey), articleIds: cite });
  }
  if (entry.careKey) {
    blocks.push({ kind: 'care', key: qualifyKnowledgeKey(entry.careKey), articleIds: cite });
  }
  return blocks;
}

/**
 * A refusal is specific about what it declined and where to go instead.
 *
 * `medicalSafety` is passed in rather than looked up here, so the decision about
 * whether a message carries a red flag is made in exactly one place and is
 * visible at the call site.
 *
 * The two safety systems are additive and neither suppresses the other:
 *
 *   - `guardrails.ts` owns self-harm and distress. It is authoritative and runs
 *     first; its message key is never replaced.
 *   - the knowledge `safety` domain owns physical urgency. It contributes
 *     warning and care blocks underneath whatever the guardrail decided.
 *
 * So "I am pregnant, I am bleeding badly and I want to kill myself" returns the
 * crisis message *and* the pregnancy red-flag care line, and a reader is not
 * made to choose which of the two urgent things to act on.
 */
function composeRefusal(
  turn: number,
  intent: AssistantIntent,
  reasonKey: string,
  medicalSafety: KnowledgeMatch | null
): AssistantReply {
  const blocks = medicalSafety ? medicalSafetyBlocks(medicalSafety) : [];
  const provenance: KnowledgeProvenance[] = blocks.length > 0 ? ['healthKnowledge'] : [];

  return reply(
    turn,
    intent,
    // A refusal has no area: it declines to answer rather than answering badly.
    'unknown',
    {
      messageKey: REFUSAL_MESSAGE_KEYS[reasonKey] ?? 'responses.noMatch',
      blocks,
      provenance,
    },
    true
  );
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
      return reply(turn, 'prediction', 'personal_health_data', {
        messageKey: 'responses.predictionWithWindow',
        params: {
          estimatedDate: prediction.estimatedStartDate,
          windowStart: prediction.fertileWindowStartDate,
          windowEnd: prediction.fertileWindowEndDate,
        },
        provenance: ['personalData'],
        citations: sources,
      });
    }

    return reply(turn, 'prediction', 'personal_health_data', {
      messageKey: 'responses.predictionReady',
      params: { estimatedDate: prediction.estimatedStartDate },
      provenance: ['personalData'],
      citations: sources,
    });
  }

  if (prediction.status === 'invalid_input') {
    return reply(turn, 'prediction', 'personal_health_data', {
      messageKey: 'responses.noData',
      provenance: ['personalData'],
      citations: sources,
    });
  }

  return reply(turn, 'prediction', 'personal_health_data', {
    messageKey: 'responses.predictionInsufficient',
    params: { recordedCycles: context.recordedCycles },
    provenance: ['personalData'],
    citations: sources,
  });
}

/**
 * Summarises what the reader has already recorded.
 *
 * Only aggregates that already exist in the context are quoted. Free-text notes
 * are not in the context, so they cannot be echoed back — a point worth making
 * in the UI, because "the assistant knows my data" is exactly the worry a
 * privacy-first product has to answer.
 */
function composeSummaryReply(turn: number, context: RedactedAssistantContext): AssistantReply {
  const { cycle, daily } = context;

  if (context.recordedCycles === 0 && context.recordedDailyLogs === 0) {
    return reply(turn, 'personalSummary', 'personal_health_data', {
      messageKey: 'responses.summaryNoData',
    });
  }

  if (cycle.averageCycleLengthDays !== null) {
    return reply(turn, 'personalSummary', 'personal_health_data', {
      messageKey: 'responses.summaryWithCycle',
      params: {
        recordedCycles: context.recordedCycles,
        recordedDays: daily.recordedDays,
        averageCycle: cycle.averageCycleLengthDays,
        averagePeriod: cycle.averagePeriodLengthDays ?? 0,
      },
      provenance: ['personalData'],
    });
  }

  return reply(turn, 'personalSummary', 'personal_health_data', {
    messageKey: 'responses.summaryNoCycle',
    params: {
      recordedCycles: context.recordedCycles,
      recordedDays: daily.recordedDays,
    },
    provenance: ['personalData'],
  });
}

export type { AppHelpTopic };

/**
 * Which part of the app a "how do I …" question is about.
 *
 * A thin wrapper over the app-help knowledge matcher, kept as its own export
 * because the classification is worth testing on its own rather than only
 * observable through a rendered reply. The topics are the ids of the app-help
 * entries, so there is exactly one list of screens in the codebase.
 */
export function appHelpTopicFor(text: string): AppHelpTopic | null {
  return classifyAppTopic(text);
}

/**
 * Turns a matched knowledge entry into the parts of a reply.
 *
 * The entry's `answer` is the lead — it becomes `messageKey` — and everything
 * else becomes a block. Splitting them this way is what keeps a bubble readable:
 * the first sentence stays the sentence the reader reads first, and the warning
 * and care lines render underneath it as distinct sections.
 */
function knowledgeBlocks(match: KnowledgeMatch): AssistantBlock[] {
  const { entry } = match;
  const blocks: AssistantBlock[] = [];
  const cite = entry.articles ?? [];

  if (entry.detailKey) {
    blocks.push({ kind: 'text', key: qualifyKnowledgeKey(entry.detailKey), articleIds: cite });
  }
  if (entry.warningKey) {
    blocks.push({ kind: 'warning', key: qualifyKnowledgeKey(entry.warningKey), articleIds: cite });
  }
  if (entry.careKey) {
    blocks.push({ kind: 'care', key: qualifyKnowledgeKey(entry.careKey), articleIds: cite });
  }

  return blocks;
}

/**
 * The citations an entry is allowed to show.
 *
 * Intersected with what retrieval actually found, in the entry's own declared
 * order. Two reasons it is an intersection rather than a lookup:
 *
 *   - A citation must be something the reader can open. Inventing an
 *     `EducationSource` for an article id would produce a source card that 404s.
 *   - An entry is allowed to name articles it only partly relies on, and
 *     narrowing to what was retrieved keeps the list short.
 */
function citationsFor(
  entry: KnowledgeEntry,
  sources: EducationSource[]
): EducationSource[] {
  const wanted = entry.articles ?? [];
  if (wanted.length === 0) return [];
  return wanted
    .map((id) => sources.find((source) => source.articleId === id))
    .filter((source): source is EducationSource => source !== undefined);
}

/**
 * Composes a substantive answer from a knowledge entry.
 *
 * `provenance` is built from what actually happened here rather than from the
 * entry's domain, which is the whole point of having it: a health answer whose
 * articles were not retrieved says only `healthKnowledge`, and an app answer says
 * only `appHelp`, so the reader is never shown a source card that supports
 * nothing in the text above it.
 */
function composeKnowledgeReply(
  turn: number,
  intent: AssistantIntent,
  route: AssistantRoute,
  match: KnowledgeMatch,
  related: readonly KnowledgeMatch[],
  sources: EducationSource[]
): AssistantReply {
  const { entry } = match;
  const citations = citationsFor(entry, sources);
  const isApp = entry.domain === 'appHelp';
  const target = isApp ? APP_HELP_PATHS[entry.id as AppHelpTopic] : undefined;

  const blocks = knowledgeBlocks(match);
  for (const extra of related) {
    if (extra.entry.domain === entry.domain) continue;
    blocks.push({
      kind: 'related',
      key: qualifyKnowledgeKey(extra.entry.answerKey),
      articleIds: extra.entry.articles ?? [],
    });
  }

  const provenance: KnowledgeProvenance[] = [isApp ? 'appHelp' : 'healthKnowledge'];
  if (citations.length > 0) provenance.push('education');

  return reply(turn, intent, route, {
    messageKey: knowledgeKey(entry.id, 'answer'),
    // Only app answers carry a destination. A health answer has nowhere to send
    // the reader that would be more useful than the citations it already has.
    params: target ? { target } : {},
    blocks,
    provenance,
    citations,
  });
}

/**
 * Produces the reply for one turn.
 *
 * Order matters twice over. Guardrails run before routing, so a safety outcome can
 * never be overwritten by a later branch. And within the answer branches, the
 * knowledge entry is consulted before the old Education fallback, because a
 * matched entry is a real answer and the fallback is only honest when nothing
 * matched.
 */
export function composeOfflineReply(input: ComposeReplyInput): AssistantReply {
  const { text, turn, context, sources } = input;

  const guardrail = evaluateGuardrails(text);
  if (isRefusal(guardrail)) {
    // The medical red-flag lookup happens on every refusal, not only on crisis,
    // so "my periods are soaking through and I feel faint, what is that" still
    // carries its care guidance even when the intent layer refuses the question.
    return composeRefusal(turn, guardrail.intent, guardrail.reasonKey, medicalSafetyMatch(text));
  }

  const intent = guardrail.intent;

  // A greeting has no area and needs no lookup: it is a sentence about what the
  // assistant can do, not an answer to anything.
  if (intent === 'greeting') {
    return reply(turn, intent, 'unknown', { messageKey: 'responses.greeting' });
  }

  const decision = routeQuestion(text);

  if (decision.route === 'personal_health_data') {
    if (intent === 'prediction') return composePredictionReply(turn, context, sources);
    return composeSummaryReply(turn, context);
  }

  if (decision.knowledge) {
    return composeKnowledgeReply(
      turn,
      decision.route === 'app_help' ? 'appHelp' : intent,
      decision.route,
      decision.knowledge,
      decision.related,
      sources
    );
  }

  // No knowledge entry and no area, but retrieval may still have found an article
  // on vocabulary the matcher does not know. That is still a real answer.
  if (decision.route === 'health_education' && sources.length > 0) {
    return reply(turn, intent, 'health_education', {
      messageKey: 'responses.education',
      params: { count: sources.length },
      provenance: ['education'],
      citations: sources,
    });
  }

  return reply(turn, intent, 'unknown', { messageKey: 'responses.noMatch' });
}