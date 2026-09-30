import { rankArticlesByRelevance, type ArticleSearchDoc } from '@/lib/learn/search';
import { ARTICLES, type ArticleTopic } from '@/lib/learn/articles';
import type { EducationSource } from './types';

/**
 * Education retrieval for the assistant.
 *
 * This is RAG with the model removed: the same deterministic `searchArticles()`
 * that powers the Education screen ranks the corpus here, so the assistant can
 * only ever say something the app can already show the reader in their own
 * language. There is no generation step, so there is nothing that can invent a
 * claim the corpus does not contain.
 *
 * The caller supplies the corpus as already-localised text, exactly as
 * `LearnView` does, which means retrieval works in Hindi and Kannada without
 * any translation step of its own.
 */

const EXCERPT_MAX_CHARS = 420;

/**
 * Question scaffolding to drop before ranking.
 *
 * `searchArticles` uses AND semantics on purpose — that is what makes the
 * Education screen narrow as you type — but it means a real question matches
 * nothing, because no article contains the words "what is" or "tell me about".
 * Without this, "what is the fertile window" would return zero sources and the
 * assistant would answer `noMatch` to the most natural question a reader can
 * ask.
 *
 * The words removed here carry no health meaning, so dropping them cannot change
 * which articles are relevant, only whether any are found. The list is
 * deliberately short and conservative: it is safer to leave a word in and get a
 * narrower result than to strip a content word.
 */
const QUESTION_WORDS = new Set([
  // English
  'a', 'an', 'the', 'is', 'are', 'am', 'do', 'does', 'did', 'can', 'could',
  'should', 'would', 'will', 'shall', 'may', 'might', 'must', 'i', 'me', 'my',
  'you', 'your', 'it', 'its', 'about', 'tell', 'explain', 'know', 'please',
  'want', 'need', 'like', 'what', 'whats', 'whats', 'how', 'why', 'when',
  'where', 'which', 'who', 'whom', 'whose', 'and', 'or', 'of', 'to', 'for',
  'in', 'on', 'at', 'be', 'been', 'have', 'has', 'had', 'there', 'that',
  // Hindi
  'क्या', 'कैसे', 'क्यों', 'कब', 'कहाँ', 'कौन', 'कौनसा', 'कितना', 'मुझे',
  'मुझ', 'मेरा', 'मेरी', 'मेरे', 'है', 'हैं', 'हो', 'बताइए', 'बताओ', 'बताएं',
  'कि', 'से', 'का', 'की', 'के', 'को', 'और', 'या', 'पर', 'यह', 'वह',
  // Kannada
  'ಏನು', 'ಏಕೆ', 'ಹೇಗೆ', 'ಯಾವಾಗ', 'ಎಲ್ಲಿ', 'ಯಾರು', 'ಎಷ್ಟು', 'ನನಗೆ', 'ನನ್ನ',
  'ನಾನು', 'ಇದೆ', 'ಇವೆ', 'ಆಗಿ', 'ತಿಳಿಸಿ', 'ಹೇಳಿ', 'ಮತ್ತು', 'ಅಥವಾ', 'ಮತ್ತು',
  'ಈ', 'ಆ', 'ಒಂದು', 'ಇದೆಯೆ', 'ಆಗ',
]);

/** Removes question scaffolding, keeping every content word. */
export function stripQuestionWords(query: string): string {
  const kept = query
    .toLowerCase()
    .split(/[\s\u2000-\u206f,.;:!?"'()[\]{}<>|/\\]+/)
    .filter((token) => token.length > 0 && !QUESTION_WORDS.has(token));
  // Fall back to the original if the question was *entirely* scaffolding, so
  // retrieval still gets a real chance rather than an empty query.
  return kept.length > 0 ? kept.join(' ') : query;
}

/** A corpus entry paired with the keys and topic the UI needs to render it. */
export interface EducationDoc extends ArticleSearchDoc {
  topic: ArticleTopic;
  titleKey: string;
  summaryKey: string;
}

/**
 * Bounded, sentence-aligned excerpt of an article body.
 *
 * The bodies in the locale files separate paragraphs with `||`. Truncating on
 * that boundary keeps an excerpt from ending mid-sentence, which matters
 * because this text is handed to a model as grounding.
 */
export function buildExcerpt(body: string, maxChars = EXCERPT_MAX_CHARS): string {
  const flattened = body
    .split('||')
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .join(' ');

  if (flattened.length <= maxChars) return flattened;

  const clipped = flattened.slice(0, maxChars);
  const lastBreak = Math.max(clipped.lastIndexOf('. '), clipped.lastIndexOf('। '));
  if (lastBreak > maxChars * 0.4) return clipped.slice(0, lastBreak + 1).trim();

  return `${clipped.trimEnd()}…`;
}

export interface RetrieveOptions {
  /** Maximum sources to return. Default 2 — enough to answer without padding. */
  limit?: number;
  /**
   * Narrows results to one topic. Used to keep a prediction question pointed at
   * cycle-basics material instead of an unrelated article that shares a word.
   */
  topic?: ArticleTopic;
  /**
   * Which article ids the caller believes this question is about, and by how much
   * to favour them. Normally `inferTopicHints`, which reads the question itself.
   */
  scoreBoostById?: ReadonlyMap<string, number>;
  /**
   * Ids that may be returned even with no word in common. Normally
   * `curatedArticleMatches`, the per-article table above.
   */
  qualifyingIds?: ReadonlySet<string>;
}

/* -------------------------------------------------------------------------- *
 * Topic hints                                                                  *
 * -------------------------------------------------------------------------- */

/**
 * How strongly one topic hint outranks a good ordinary match.
 *
 * Above the 7 points a title-and-body match on two strong words can reach, and
 * above the 4 a single title hit is worth, so a hinted article leads — but only
 * if it is in a topic the question actually named. A hint reorders real matches;
 * it never manufactures one.
 */
const STRONG_HINT_WEIGHT = 12;
const WEAK_HINT_WEIGHT = 5;

/**
 * Which part of the library a question lives in.
 *
 * Retrieval on its own gets this wrong in a specific, annoying way: "what is
 * worth knowing before a doctor visit" shares no title with the article that
 * answers it, and "what can I do for period cramps" shares the word *cramps*
 * with a cycle-phases article as readily as with the one about pain. The
 * article is right there in the corpus; nothing was linking the question to it.
 *
 * Terms are tiered because "cramps" and "period" are not the same kind of
 * evidence. A specific clinical word names one corner of the library and should
 * settle the question on its own; a generic one only suggests a neighbourhood,
 * and a question can easily be about two neighbourhoods at once ("irregular
 * periods, when should I see a doctor"). Treating them equally let a generic hit
 * outvote a specific one, which is the ranking bug this table exists to fix.
 *
 * Matching is whole-word against the normalised question. A term written with
 * its own spaces is matched as a phrase.
 */
interface TopicHint {
  topic: ArticleTopic;
  /** Names this topic and almost no other. Decides the answer on its own. */
  strong: readonly string[];
  /** Suggests this topic without pinning it. Nudges, never decides. */
  weak: readonly string[];
}

const TOPIC_HINTS: readonly TopicHint[] = [
  {
    topic: 'cycleBasics',
    strong: [
      'ovulation', 'ovulate', 'fertile window', 'menopause', 'follicular',
      'luteal', 'missed period', 'late period', 'period delay', 'menstrual phase',
      'ओव्यूलेशन', 'सहायक गर्भाधान', 'रजोनिवृत्ति', 'फॉलिक्युलर', 'ल्यूटियल',
      'ಅಂಡೋತ್ಪತ್ತಿ', 'ಸಹಜ ಗರ್ಭಾಧಾನ', 'ರಜೋನಿವೃತ್ತಿ',
    ],
    weak: [
      'period', 'periods', 'cycle', 'cycles', 'phase', 'phases', 'bleeding',
      'bleed', 'cycle length', 'period length', 'pad', 'pads', 'tampon',
      'पीरियड', 'पीरियड्स', 'चक्र', 'अवस्था', 'रक्तस्राव', 'मासिक धर्म',
      'ಮುಟ್ಟು', 'ಚಕ್ರ', 'ಹಂತ', 'ರಕ್ತಸ್ರಾವ',
    ],
  },
  {
    topic: 'symptoms',
    strong: [
      'cramp', 'cramps', 'cramping', 'migraine', 'bloating', 'tenderness',
      'breast tenderness', 'food cravings', 'acne', 'backache', 'spotting',
      'पीड़ा', 'ऐंठन', 'सूजन', 'सिरदर्द', 'माइग्रेन', 'ब्रेस्ट', 'मुँहासे',
      'ನೋವು', 'ಹುಸುವಿಕೆ', 'ಊಬ್ಬು', 'ತಲವುನೋವು', 'ಸ್ತನದುದು',
    ],
    weak: [
      'pain', 'pains', 'ache', 'aches', 'aching', 'headache', 'headaches', 'mood',
      'moods', 'tired', 'fatigue', 'tiredness', 'energy', 'cravings', 'breast',
      'swelling', 'nausea', 'pms', 'pmdd', 'symptom', 'symptoms',
      'दर्द', 'मनोदशा', 'थकान', 'ऊर्जा', 'लक्षण', 'सूजन', 'चिड़चिड़ापन',
      'ಹುಸುವಿಕೆ', 'ಮನಸ್ಸು', 'ಆಯಾಸ', 'ಶಕ್ತಿ', 'ಲಕ್ಷಣ', 'ಬದಲಾವಣೆ',
    ],
  },
  {
    topic: 'whenToSeeDoctor',
    strong: [
      'doctor visit', 'when to see a doctor', 'when should i see', 'emergency',
      'urgent', 'referral', 'screening', 'second opinion', 'concerns taken',
      'डॉक्टर से', 'डॉक्टर के पास', 'कब डॉक्टर', 'आपातकाल', 'जांच कराने',
      'ವೈದ್ಯರ ಬಗ್ಗೆ', 'ವೈದ್ಯರನ್ನು', 'ತುರ್ತು', 'ಅಲ್ಪಾಯ', 'ಪರೀಕ್ಷೆ',
    ],
    weak: [
      'doctor', 'doctors', 'visit', 'clinic', 'hospital', 'consult', 'consultation',
      'checkup', 'check up', 'concern', 'concerns', 'worried', 'worry', 'normal',
      'unusual', 'danger', 'dangerous', 'test', 'tests', 'refer', 'check',
      'डॉक्टर', 'मिलना', 'अस्पताल', 'जांच', 'चिंता', 'सामान्य', 'असामान्य', 'डॉक्टरी',
      'ವೈದ್ಯ', 'ವೈದ್ಯರ', 'ಆಸ್ಪತ್ರೆ', 'ಪರೀಕ್ಷೆ', 'ಚಿಂತಿಸುವುದು', 'ಸಾಮಾನ್ಯ', 'ಅಸಾಮಾನ್ಯ',
    ],
  },
  {
    topic: 'lifestyle',
    strong: [
      'hydration', 'how much water', 'drink enough', 'iron intake', 'iron rich',
      'physical activity', 'exercise', 'menstrual hygiene',
      'जलयोजन', 'कितना पानी', 'लोहा', 'व्यायाम', 'स्वास्थ्य',
      'ನೀರು ಎಷ್ಟು', 'ಕಬ್ಬಿ', 'ವ್ಯಾಯಾಮ', 'ಶರೀರಚರ್ಮೆ',
    ],
    weak: [
      'water', 'drink', 'drinking', 'sleep', 'sleeping', 'stress', 'food', 'diet',
      'eat', 'eating', 'nutrition', 'iron', 'activity', 'active', 'walk',
      'walking', 'yoga', 'hygiene', 'clean', 'cleaning', 'routine', 'rest',
      'पानी', 'पीना', 'नींद', 'तनाव', 'खाना', 'आहार', 'पोषण',
      'ನೀರು', 'ಕುಡಿಯಿ', 'ನಿದ್ದೆ', 'ಒತ್ತಡ', 'ಆಹಾರ', 'ಪೋಷಣೆ', 'ವಿಶ್ರಾಂತಿ',
    ],
  },
  {
    topic: 'conditions',
    strong: [
      'pcos', 'pcod', 'endometriosis', 'fibroid', 'fibroids', 'thyroid',
      'anaemia', 'anemia', 'adenomyosis',
      'पीसीओएस', 'एंडोमेट्रियोसिस', 'फाइब्रॉइड', 'थायरॉयड', 'एनीमिया',
      'ಪಿಸಿಒಎಸ್', 'ಎಂಡೊಮೆಟ್ರಿಯೋಸಿಸ್', 'ಥೈರಾಯ್ಡ್', 'ಅನೀಮಿಯಾ',
    ],
    weak: [
      'condition', 'conditions', 'diagnosis', 'diagnosed', 'hormone', 'hormones',
      'hormonal', 'स्थिति', 'निदान', 'हार्मोन', 'ಹರ್ಮೋನ್', 'ನಿರ್ಣಯ',
    ],
  },
];

/**
 * Points a few very common questions at one specific article.
 *
 * Topic hints answer "which shelf"; these answer "which book". They exist for
 * the questions where the topic is genuinely too coarse to be useful: `cramps`
 * belongs to the symptoms shelf, where the shelf holds both period pain and the
 * PMS/PMDD distinction, and "what can I do for period cramps" is about the
 * first and not the second. Without this the two tie on topic and the winner is
 * decided by catalogue order.
 *
 * Stacked on top of the topic hint rather than instead of it, so an article
 * hinted here still competes on its own text. An article absent from this table
 * is unaffected — the table is an accelerator, not the ranking mechanism, which
 * is what keeps it maintainable as the corpus grows.
 */
const ARTICLE_HINTS: ReadonlyArray<{
  articleId: string;
  strong: readonly string[];
  weak: readonly string[];
}> = [
  {
    articleId: 'painTracking',
    strong: ['cramps', 'cramping', 'period pain', 'period pains', 'pain diary', 'track my pain'],
    weak: ['cramp', 'hurt', 'aching', 'sore'],
  },
  {
    articleId: 'pmsVsPmd',
    strong: ['pms', 'pmdd', 'premenstrual dysphoric disorder'],
    weak: ['mood swings', 'before my period'],
  },
  {
    articleId: 'hydrationEnergy',
    strong: ['water', 'hydration', 'thirsty', 'thirst'],
    weak: ['drink', 'drinking', 'fluid', 'fluids', 'energy'],
  },
  {
    articleId: 'sleepStressCycle',
    strong: ['sleep', 'insomnia', 'stress'],
    weak: ['tired', 'rested', 'anxious', 'overwhelmed'],
  },
  {
    articleId: 'anaemiaFatigue',
    strong: ['anaemia', 'anemia', 'weakness', 'dizzy', 'dizziness', 'fainting'],
    weak: ['tired all the time', 'always tired', 'no energy', 'low haemoglobin', 'low hemoglobin'],
  },
  {
    articleId: 'fertileWindow',
    strong: ['fertile window', 'conceive', 'getting pregnant', 'trying to conceive'],
    weak: ['ovulation', 'ovulate'],
  },
  {
    articleId: 'cyclePhases',
    strong: ['follicular', 'luteal', 'menstrual phase'],
    weak: ['phases', 'phase'],
  },
  {
    articleId: 'talkingToDoctor',
    strong: ['talk to my doctor', 'talk to the doctor', 'tell my doctor', 'my concerns'],
    weak: ['how do i explain', 'appointment', 'not being believed'],
  },
  {
    articleId: 'whenToSeeDoctor',
    strong: ['warning signs', 'red flags', 'when to see someone'],
    weak: ['should i worry', 'is it serious', 'needs a doctor'],
  },
  {
    articleId: 'pcosOverview',
    strong: ['pcos', 'pcod', 'polycystic'],
    weak: ['irregular cycles', 'irregular periods', 'excess hair'],
  },
  {
    articleId: 'endometriosisOverview',
    strong: ['endometriosis', 'adenomyosis', 'endometrial'],
    weak: ['painful sex', 'infertility'],
  },
];

/**
 * Favours the articles in whichever topic the question is about, and the
 * specific article when the question names one.
 *
 * A question can point at more than one topic — "irregular periods, when should
 * I see a doctor" is legitimately both cycleBasics and whenToSeeDoctor — so every
 * hinted topic is boosted and none is filtered. Filtering would throw away the
 * half of the answer the reader asked for.
 *
 * Returns an empty map for a question that names no topic, which is the same as
 * having no hint and costs nothing.
 */
export function inferTopicHints(docs: EducationDoc[], query: string): Map<string, number> {
  const normalized = ` ${normalizeForHints(query)} `;

  const boosts = new Map<string, number>();
  if (normalized.trim().length === 0) return boosts;

  const byId = new Map(docs.map((doc) => [doc.id, doc]));

  for (const { topic, strong, weak } of TOPIC_HINTS) {
    const weight =
      countTerms(normalized, strong) * STRONG_HINT_WEIGHT +
      countTerms(normalized, weak) * WEAK_HINT_WEIGHT;
    if (weight === 0) continue;

    for (const article of docs.filter((doc) => doc.topic === topic)) {
      addBoost(boosts, article.id, weight);
    }
  }

  for (const { articleId, strong, weak } of ARTICLE_HINTS) {
    // A hint for an article the caller did not load is silently ignored, so a
    // smaller corpus is hinted consistently rather than partially.
    if (!byId.has(articleId)) continue;

    const weight =
      countTerms(normalized, strong) * STRONG_HINT_WEIGHT +
      countTerms(normalized, weak) * WEAK_HINT_WEIGHT;
    if (weight === 0) continue;

    addBoost(boosts, articleId, weight);
  }

  return boosts;
}

function addBoost(boosts: Map<string, number>, id: string, weight: number): void {
  boosts.set(id, (boosts.get(id) ?? 0) + weight);
}

/**
 * The articles this question names outright, for ones no word of the question
 * reaches.
 *
 * Split out from the boost map because the two carry different authority: a
 * boost may reorder, only this set may return. Kept separate so the ability to
 * return an article with zero lexical overlap is visible in the signature and in
 * the tests, rather than being a side effect of a number.
 */
export function curatedArticleMatches(docs: EducationDoc[], query: string): Set<string> {
  const normalized = ` ${normalizeForHints(query)} `;
  const loaded = new Set(docs.map((doc) => doc.id));

  const ids = new Set<string>();
  for (const { articleId, strong, weak } of ARTICLE_HINTS) {
    if (!loaded.has(articleId)) continue;
    if (countTerms(normalized, strong) === 0 && countTerms(normalized, weak) === 0) continue;
    ids.add(articleId);
  }
  return ids;
}

/** Normalises for whole-word hint matching, keeping Devanagari and Kannada. */
function normalizeForHints(query: string): string {
  return ` ${query
    .toLowerCase()
    .replace(/[\s!,.;:?"'()[\]{}<>|/\\#+*=%~$^&@_\u2000-\u206f\u0964\u0965]+/g, ' ')
    .trim()} `;
}

/** Counts how many of `terms` appear as whole words or phrases. */
function countTerms(normalized: string, terms: readonly string[]): number {
  return terms.filter((term) => normalized.includes(` ${term.trim()} `)).length;
}


/**
 * Ranks the corpus against a question.
 *
 * Relevance ranking rather than the Education screen's narrowing search, because
 * the input is a question and not a search string — see `rankArticlesByRelevance`
 * for why that distinction matters. Question scaffolding is stripped first, so
 * the words being matched are the words carrying the health meaning.
 *
 * A topic filter still wins over a hint: it is an explicit instruction from the
 * caller rather than an inference, so a prediction question stays pointed at
 * cycle-basics material.
 */
export function retrieveEducationSources(
  docs: EducationDoc[],
  query: string,
  options: RetrieveOptions = {}
): EducationSource[] {
  const {
    limit = 2,
    topic,
    scoreBoostById = inferTopicHints(docs, query),
    qualifyingIds = curatedArticleMatches(docs, query),
  } = options;

  const docById = new Map(docs.map((doc) => [doc.id, doc]));

  const ranked = rankArticlesByRelevance(docs, stripQuestionWords(query), {
    scoreBoostById,
    qualifyingIds,
  });

  const sources: EducationSource[] = [];

  for (const { id, score } of ranked) {
    if (sources.length >= Math.max(0, limit)) break;

    const doc = docById.get(id);
    if (!doc) continue;
    if (topic && doc.topic !== topic) continue;

    sources.push({
      articleId: doc.id,
      topic: doc.topic,
      score,
      titleKey: doc.titleKey,
      summaryKey: doc.summaryKey,
      title: doc.title,
      summary: doc.summary,
      excerpt: buildExcerpt(doc.body),
    });
  }

  return sources;
}

/** The article ids in the bundled corpus, in catalogue order. */
export function knownArticleIds(): string[] {
  return ARTICLES.map((article) => article.id);
}
