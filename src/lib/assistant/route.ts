import { classifyIntent } from './intent';
import { matchKnowledgeWithRelated, APP_HELP_ENTRIES, KNOWLEDGE_ENTRIES } from './knowledge';
import type { AppHelpTopic, KnowledgeMatch } from './knowledge';

/**
 * Where a question goes.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A SEPARATE DECISION FROM `classifyIntent`
 * ---------------------------------------------------------------------------
 * `classifyIntent` answers "is this a refusal, a greeting, or a question?" and is
 * load-bearing for the guardrails and for a lot of existing tests, so it stays
 * exactly as it is. It also cannot express the brief's five categories: it has no
 * idea whether a question is *safety* or *general education*, and both arrive as
 * `education`.
 *
 * So this module sits on top and answers the different question the brief asks:
 * which of the five areas owns this message? It reuses `classifyIntent` rather
 * than replacing it, so the refusals, the greeting and the existing app-help and
 * personal-data behaviour are inherited rather than reimplemented.
 *
 * ---------------------------------------------------------------------------
 * WHY THE ORDER IS SAFETY, THEN PERSONAL, THEN APP, THEN EDUCATION
 * ---------------------------------------------------------------------------
 * The order encodes which answer is more useful when two are possible, and it is
 * not alphabetical or cheapest-first:
 *
 *   safety first     — a question that names a red flag needs the red flag, even
 *                      if it also mentions the reader's own period. Getting this
 *                      one wrong is the only one in the list that can hurt someone.
 *   personal second  — "when will my next period be" is about this reader's own
 *                      computed dates. The cycle engine already answered it, and
 *                      demoting it to a general explanation would throw away the
 *                      only answer with a number in it.
 *   app third        — "where can I see my predicted dates" wants a screen. It is
 *                      personal in wording but not in answer, and the existing
 *                      test suite pins this precedence deliberately.
 *   education last   — the fallback for everything else.
 */
export type AssistantRoute =
  | 'app_help'
  | 'personal_health_data'
  | 'health_education'
  | 'safety'
  | 'unknown';

export interface RouteDecision {
  route: AssistantRoute;
  /** The best knowledge entry for the question, if any. */
  knowledge: KnowledgeMatch | null;
  /** Close runner-ups, for genuinely two-topic questions. */
  related: readonly KnowledgeMatch[];
  /** Which screen an app question is about, for app_help routes. */
  appTopic: AppHelpTopic | null;
  /** The `classifyIntent` result, passed through for the composer's branches. */
  intent: ReturnType<typeof classifyIntent>;
}

/**
 * Chooses the area that owns a question.
 *
 * Assumes the guardrails have already run and passed. A refusal is not routed:
 * `composeOfflineReply` returns before it reaches here, because a message the
 * assistant declines to answer has no area.
 */
export function routeQuestion(text: string): RouteDecision {
  const intent = classifyIntent(text);
  const best = matchKnowledgeWithRelated(KNOWLEDGE_ENTRIES, text);
  const appMatch = best?.related.find((match) => match.entry.domain === 'appHelp');

  const empty = {
    knowledge: best?.best ?? null,
    related: best?.related ?? [],
    intent,
  } satisfies Omit<RouteDecision, 'route' | 'appTopic'>;

  // Safety owns anything a red-flag entry recognises. Checked against the
  // knowledge result rather than a second keyword pass, so "does this need a
  // doctor" and "my period pain is so bad I cannot move" reach the same answer by
  // the same route.
  if (best?.best.entry.domain === 'safety') {
    return { ...empty, route: 'safety', appTopic: null };
  }

  // A red flag that lost the ranking to a general topic still has to surface:
  // "bleeding and feeling faint, and is it just stress" ranks stress high and
  // faint second, and answering the stress half alone would be the failure this
  // module exists to prevent.
  const safetyRelated = best?.related.find((match) => match.entry.domain === 'safety');
  if (safetyRelated) {
    return {
      ...empty,
      route: 'safety',
      knowledge: safetyRelated,
      appTopic: null,
    };
  }

  // Personal data: the two intents that already mean "about this reader".
  if (intent === 'prediction' || intent === 'personalSummary') {
    return { ...empty, route: 'personal_health_data', appTopic: null };
  }

  // App help: either the classifier says so, or an app entry matched outright.
  // The second clause matters because "can I use PMSify without an account" has
  // no navigation word in it and still deserves a PMSify answer.
  if (intent === 'appHelp' || appMatch) {
    const topic = (appMatch?.entry.id ?? classifyAppTopic(text)) as AppHelpTopic | null;
    return {
      ...empty,
      route: topic ? 'app_help' : 'health_education',
      // Prefer the app entry as the primary match so the answer comes from it.
      knowledge: appMatch ?? empty.knowledge,
      appTopic: topic,
    };
  }

  if (best && (intent === 'education' || best.best.entry.domain !== 'appHelp')) {
    return { ...empty, route: 'health_education', appTopic: null };
  }

  // Nothing in the knowledge base matched, but the intent layer still called
  // this educational. It is the health-education *area* either way: whether it
  // earns a citation is decided by the composer, from whether retrieval found
  // an article. Routing it to `unknown` here would send a question with a
  // perfectly good article — "tell me about endometriosis" hits no knowledge
  // entry but retrieves `endometriosisOverview` — past the composer's
  // education branch and into `noMatch`, losing both the answer and the source.
  if (intent === 'education') {
    return { ...empty, route: 'health_education', appTopic: null };
  }

  return { ...empty, route: 'unknown', appTopic: null };
}

/**
 * Which screen an app question is about, decided by the app-help entries alone.
 *
 * Runs the matcher over the app-help table rather than the whole knowledge base,
 * so a health topic can never be mistaken for a screen and vice versa.
 */
export function classifyAppTopic(text: string): AppHelpTopic | null {
  const match = matchKnowledgeWithRelated(APP_HELP_ENTRIES, text);
  const entry = match?.best;
  return entry && entry.entry.domain === 'appHelp' ? (entry.entry.id as AppHelpTopic) : null;
}