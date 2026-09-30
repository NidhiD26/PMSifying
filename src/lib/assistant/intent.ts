/**
 * Deterministic intent classification.
 *
 * Pure lexical matching. No model, no network, no randomness, and no dependence
 * on the current time — the same text always yields the same intent, which is
 * what makes the safety rules testable and auditable.
 *
 * ---------------------------------------------------------------------------
 * WHY THE KEYWORDS ARE MULTILINGUAL
 * ---------------------------------------------------------------------------
 * PMSify serves English, Hindi, and Kannada. A crisis or medication guardrail
 * that only understood English would be trivially bypassed by asking the same
 * question in Hindi — the user who most needs the escalation is exactly the one
 * writing in their first language. Every safety-critical term list therefore
 * carries all three languages. Educational terms are multilingual too, because
 * retrieval runs against a corpus that is already localised.
 *
 * ---------------------------------------------------------------------------
 * A DELIBERATE ASYMMETRY: CONDITION NAMES
 * ---------------------------------------------------------------------------
 * Naming a condition is not, by itself, a request for a diagnosis.
 *
 *   "what is PCOS"            -> education   (retrieval finds the article)
 *   "do I have PCOS"          -> diagnosis   (refused, points to a clinician)
 *   "tell me about PCOS"      -> education
 *   "I have PCOS"             -> diagnosis   (a claim about the reader)
 *
 * So a condition noun only becomes `diagnosis` when it is paired with a
 * personal reference ("I", "my", "मेरा", "ನನ್ನ"). Self-claim grammar
 * ("do I have", "diagnos", "symptoms of") is also a diagnosis signal on its own.
 * This keeps the common educational question working while still refusing the
 * personal one.
 */

import type { AssistantIntent } from './types';

/** Punctuation and script-specific separators collapsed to spaces. */
const SEPARATORS = /[\s!,.;:?"'()[\]{}<>|/\\#+*=%~$^&@_\u2000-\u206f\u0964\u0965]+/g;

/**
 * Lowercases, replaces punctuation with spaces, and collapses runs of spaces.
 * Devanagari and Kannada have no case, so lowercasing is a no-op for them and
 * harmless.
 */
export function normalize(text: string): string {
  return text.toLowerCase().replace(SEPARATORS, ' ').trim();
}

/** Space-padded so whole-word matching needs no regular expression. */
function pad(normalized: string): string {
  return ` ${normalized} `;
}

/**
 * Whole-word match for a single token, phrase match for a multi-word term.
 * Word boundaries matter: "late" must not match "later", and the greeting "hi"
 * must not match "this".
 *
 * Takes an already space-padded haystack. Internal on purpose — the padding
 * requirement is an implementation detail that would be easy to misuse.
 */
function matchesTerm(haystack: string, term: string): boolean {
  return haystack.includes(` ${term} `);
}

function anyTerm(haystack: string, terms: readonly string[]): boolean {
  return terms.some((term) => matchesTerm(haystack, term));
}

/* -------------------------------------------------------------------------- */
/* Crisis matching is stem-tolerant                                             */
/* -------------------------------------------------------------------------- */

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/** Crude but effective English suffix stripping, used only for crisis terms. */
function stemToken(token: string): string {
  let stem = token;
  if (stem.length > 5 && stem.endsWith('ing')) stem = stem.slice(0, -3);
  else if (stem.length > 4 && (stem.endsWith('ed') || stem.endsWith('es'))) stem = stem.slice(0, -2);
  else if (stem.length > 3 && stem.endsWith('s')) stem = stem.slice(0, -1);

  // Undo the doubled consonant left by "-ing": cutting -> cutt -> cut.
  const last = stem.at(-1);
  if (stem.length > 2 && last && last === stem.at(-2) && !VOWELS.has(last)) {
    stem = stem.slice(0, -1);
  }
  return stem;
}

/**
 * Stems the whole phrase so inflected forms match a stored term.
 *
 * Applied to the crisis list alone. There, a missed variant is a missed
 * escalation, so "harming myself", "killing myself" and "hurting myself" must
 * all reach the "harm myself" / "kill myself" / "hurt myself" rules. The other
 * lists match exactly, because for them a false positive is the cheaper error.
 */
function stemPhrase(normalized: string): string {
  return normalized
    .split(' ')
    .filter(Boolean)
    .map(stemToken)
    .join(' ');
}

function stemAnyTerm(haystack: string, terms: readonly string[]): boolean {
  const stemmed = pad(stemPhrase(haystack));
  return terms.some((term) => matchesTerm(stemmed, stemPhrase(term)));
}

/* -------------------------------------------------------------------------- */
/* Crisis — checked before anything else, always                                */
/* -------------------------------------------------------------------------- */

const CRISIS_TERMS: readonly string[] = [
  // English
  'kill myself', 'killing myself', 'suicide', 'suicidal', 'end my life',
  'end it all', 'want to die', 'wanna die', 'better off dead', 'not worth living',
  'no reason to live', 'cant go on', 'cannot go on', 'self harm', 'self-harm',
  'harm myself', 'hurt myself', 'cut myself', 'hopeless', 'give up on myself',
  // Hindi
  'मरना', 'मर जाना', 'आत्महत्या', 'आत्मघात', 'जीवन समाप्त', 'स्वयं को नुकसान',
  'खुद को नुकसान', 'आत्महत्या करना', 'बेकार जीवन',
  // Kannada
  'ಸಾವು', 'ಸಾಯಿರಿದ್ದು', 'ಆತ್ಮಹತ್ಯೆ', 'ಆತ್ಮಘಾತ', 'ಜೀವನ ಕೊಡುವುದು',
  'ನನ್ನನ್ನು ನಿನ್ನ', 'ನಿನ್ನನ್ನು ಹಾನಿ', 'ನಿರಾಸಕ್ಷ',
];

/* -------------------------------------------------------------------------- */
/* Medication — treatment decisions are a clinician's, not an assistant's      */
/* -------------------------------------------------------------------------- */

/**
 * Medication — treatment decisions are a clinician's, not an assistant's.
 *
 * Matched on the substance, not on the request frame. "Should I take …?" is
 * deliberately absent: it also introduces a pregnancy test ("should I take a
 * pregnancy test"), which is a diagnostic question and should be refused as
 * one. Keeping the frame out means the substance decides the category.
 */
const MEDICATION_TERMS: readonly string[] = [
  // English
  'medication', 'medicine', 'tablet', 'tablets', 'pill', 'pills', 'capsule',
  'dose', 'dosage', 'overdose', 'prescription', 'prescribed', 'antibiotic',
  'antidepressant', 'hormonal pill', 'birth control', 'iron tablet',
  'iron supplement', 'supplement', 'which medicine', 'stop taking',
  'start taking', 'increase dose', 'reduce dose', 'ayurvedic',
  'herbal remedy', 'home remedy', 'supplement', 'supplements',
  /*
   * Herbal preparations are the most common thing a reader names when they want
   * dosing advice, and they are usually named by their own name rather than as a
   * category. Missing them meant "should I try ashwagandha for PMS" reached the
   * retrieval layer and came back with an article about PMS — which is dosing
   * advice about a preparation, arrived at by a different route.
   */
  'ashwagandha', 'shatavari', 'gulab', 'jeera water', 'fenugreek', 'methi',
  'aloevera', 'aloe vera', 'multani mitti', 'clove', 'honey', 'आयुर्वेदिक दवा',
  'अश्वगंधा', 'शतावरी', 'एलोवेरा', 'लौंग', 'शहद', 'जीरा', 'अजवाइन',
  'ಅಶ್ವಗಂಧಾ', 'ಅಲೋವೇರಾ', 'ದಾಲ್ಚಿನಿ', 'ಜೀರೆ ನೀರು', 'ಅರಿಸಿನ್',
  /*
   * Named products matter as much as the generic nouns, and more: "I want to take
   * crocin for cramps" contains no word in the vocabulary above, and crocin is
   * the brand an Indian reader is most likely to type about period pain. A
   * medication rule that only understands the class name misses exactly the
   * message it exists to catch, so the common over-the-counter analgesics are
   * listed by name. The rule still refuses; naming a brand is how the request
   * arrives, not a licence to answer it.
   */
  'crocin', 'crocin pain', 'paracetamol', 'disprin', 'ibuprofen', 'aspirin',
  'combiflam', 'nimol', 'cyclopam', 'meftal', 'meftal p', 'dolo', 'dolo 650',
  'vicks', 'calpol', 'tylenol', 'panadol', 'moxicip', 'flexon', 'diclonac',
  'naproxen', 'tramadol', 'amitriptyline', 'mefenamic', 'methyl salicylate',
  'crocin 650', 'sugar free',
  // Hindi
  'क्रोसिन', 'पैरासिटामोल', 'डिस्प्रिन', 'आइबूप्रोफेन', 'एस्पिरिन', 'कॉम्बीफ्लेम',
  'दवा', 'दवाई', 'गोली', 'खुराक', 'नसीला', 'दवाइयों', 'प्रिस्क्रिप्शन',
  'एंटीबायोटिक', 'आयुर्वेदिक', 'घरेलू उपाय', 'कौन सी दवा', 'दवा लेनी चाहिए',
  'दवा बंद', 'मात्रा',
  // Kannada
  'ಕ್ರೋಸಿನ್', 'ಪ್ಯಾರಾಸಿಟಮಾಲ್', 'ಔಷಧಿ', 'ಔಷಧ', 'ಮದ್ದು', 'ಗುಳ್ಳೆ', 'ಅಂಶ', 'ಪ್ರಿಸ್ಕ್ರಿಪ್ಶನ್', 'ನಿರೋಧಕ',
  'ಆಯುರ್ವೇದಿಕ', 'ಮನೆ ಪರಿಹಾರ', 'ಯಾವ ಔಷಧಿ', 'ಔಷಧಿ ತೆಗೆದುಕೊಳ್ಳಬೇಕೆ',
];

/* -------------------------------------------------------------------------- */
/* Diagnosis — self-claim grammar, or a condition name plus a personal reference */
/* -------------------------------------------------------------------------- */

/**
 * Grammar that asserts or asks about the reader's own body.
 *
 * Note what is deliberately absent: a bare "am I". "How am I doing?" is a
 * personal-data question, not a diagnostic one. "Am I pregnant?" is caught by
 * the explicit term below, and "Am I diabetic?" by the condition-plus-personal
 * rule in `hasPersonalDiagnosisClaim`.
 *
 * The diagnosis words are listed in full rather than as the prefix "diagnos",
 * because whole-word matching would otherwise never see it.
 */
const DIAGNOSIS_FRAME_TERMS: readonly string[] = [
  'do i have', 'do i suffer', 'could i have', 'might i have', 'i think i have',
  'it could be', 'this could be', 'symptoms of', 'symptom of',
  'diagnosis', 'diagnose', 'diagnosing', 'diagnostic',
  'what is wrong', 'whats wrong', 'something wrong', 'something is wrong',
  'should i be worried', 'should i worry', 'am i pregnant', 'pregnancy test',
  'positive test', 'is it cancer', 'why do i bleed',
  'क्या मुझे', 'मुझे क्या', 'मेरे लक्षण', 'लक्षण क्या', 'धक्कन है', 'गर्भवती',
  'गर्भावस्था', 'परीक्षण', 'कैंसर', 'चिंता करूं',
  'ನನಗೆ', 'ನನ್ನ ಲಕ್ಷಣ', 'ಲಕ್ಷಣ ಏನು', 'ಗರ್ಭಿಣಿ', 'ಗರ್ಭಾವಸ್ಥೆ', 'ಪರೀಕ್ಷೆ',
  'ಕ್ಯಾನ್ಸರ್', 'ಚಿಂತಿಸಬೇಕೆ',
];

/** Condition nouns. Neutral on their own; see the module comment. */
const CONDITION_TERMS: readonly string[] = [
  'pcos', 'pcod', 'endometriosis', 'fibroid', 'thyroid', 'hypothyroid',
  'hyperthyroid', 'adenomyosis', 'diabetes', 'diabetic', 'anemia', 'anaemia',
  'infection', 'uti', 'std', 'sti', 'hiv', 'cancer', 'tumor', 'tumour', 'cyst',
  'miscarriage', 'ectopic', 'menopause', 'perimenopause', 'pmdd', 'pms',
  'बच्चेदानी', 'पीसीओएस', 'एंडोमेट्रियोसिस', 'फाइब्रॉइड', 'थायरॉयड',
  'एनीमिया', 'संक्रमण', 'मधुमेह', 'कैंसर', 'रजोनिवृत्ति',
  'ಪಿಸಿಒಎಸ್', 'ಎಂಡೊಮೆಟ್ರಿಯೋಸಿಸ್', 'ಥೈರಾಯ್ಡ್', 'ಅನೀಮಿಯಾ', 'ಸೋಂಕು',
  'ಮಧುಮೇಹ', 'ಕ್ಯಾನ್ಸರ್', 'ಗರ್ಭಾಶಯ',
];

/**
 * First-person reference. Used only in combination with a condition noun.
 *
 * "me" and its Hindi counterpart "मुझे" are deliberately excluded: they are
 * object forms that appear in perfectly ordinary educational questions such as
 * "tell me about endometriosis" and "मुझे बताइए", and treating those as a
 * personal diagnostic claim would refuse the most common health question there
 * is. A genuine self-claim uses a subject or possessive form instead.
 */
const PERSONAL_MARKER_TERMS: readonly string[] = [
  'i', 'i m', 'i ve', 'my', 'mine', 'myself',
  'मैं', 'मेरा', 'मेरी', 'मेरे', 'खुद',
  'ನಾನು', 'ನನ್ನ', 'ನನ್ನನ್ನು', 'ನನ್ನದು',
];

/* -------------------------------------------------------------------------- */
/* Prediction — dates and windows, which the cycle engine already computes      */
/* -------------------------------------------------------------------------- */

const PREDICTION_TERMS: readonly string[] = [
  'next period', 'period due', 'missed period', 'late period', 'am i late',
  'period late', 'delay', 'delayed', 'ovulation', 'fertile window', 'fertile',
  'when will my period', 'cycle length', 'irregular', 'spotting between',
  /*
   * "am i going to get my period soon" is the single most common way a reader
   * asks for a prediction, and it names no prediction word at all — the whole
   * question is a date question wearing ordinary words. `soon`, `coming` and
   * `due` are what make it one, so they are listed here rather than left to the
   * reader to phrase the question the way the classifier wants.
   */
  'soon', 'coming up', 'due when', 'am i going to get', 'get my period',
  'period soon', 'when will it come', 'when does it start',
  'अगली पीरियड', 'पीरियड कब', 'पीरियड देर', 'ओव्यूलेशन', 'सहायक गर्भाधान',
  'अनियमित', 'चक्र', 'कब आएगी', 'जल्दी',
  'ಮುಂದಿನ ಮುಟ್ಟು', 'ಮುಟ್ಟು ಯಾವಾಗ', 'ಅಂಡೋತ್ಪತ್ತಿ', 'ಸಹಜ ಗರ್ಭಾಧಾನ',
  'ಅಸಮಂಗತ', 'ಚಕ್ರ', 'ಯಾವಾಗ ಬರುತ್ತದೆ',
];

/* -------------------------------------------------------------------------- */
/* Personal summary — a request for a recap, not a possessive                    */
/* -------------------------------------------------------------------------- */

/**
 * Grammar that asks the assistant to summarise what has already been recorded.
 *
 * An earlier version of this list held bare possessives — `my period`, `my
 * symptoms`, `my cycle` — on the reasoning that a possessive marks a
 * self-reference. That is what it does, and it is why "why do my periods hurt so
 * much" was answered with a personal-data summary: the reader mentioned their
 * own period, and a question about *why periods hurt* is the single most
 * important educational question in the product.
 *
 * So the rule is now the frame, not the noun. A recap is something being
 * requested — "summarise", "how am I doing", "what does my data show" — and a
 * possessive on its own is a symptom, not a request for one. That distinction
 * holds for the awkward cases too: "tell me about my symptoms" is a recap
 * because of `tell me about my`, while "why do my symptoms get worse" is not,
 * because nothing there asks for a summary.
 */
const SUMMARY_FRAME_TERMS: readonly string[] = [
  // English
  'summarise', 'summarize', 'summarise my', 'summarize my', 'summary of my',
  'how am i doing', 'how have i been', 'what does my data', 'tell me about my',
  'show me my', 'my progress', 'my stats', 'my numbers', 'overall picture',
  'in short', 'briefly', 'recap', 'overview of my',
  // Hindi
  'सारांश', 'सारांश बताइए', 'मेरा सारांश', 'मेरा डेटा', 'मेरी औसत', 'मैं कैसा',
  'कुल मिलाकर', 'संक्षेप में',
  // Kannada
  'ಸಾರಾಂಶ', 'ಸಾರಾಂಶ ತಿಳಿಸಿ', 'ನನ್ನ ಸಾರಾಂಶ', 'ನನ್ನ ಡೇಟಾ', 'ನನ್ನ ಸರಾಸರಿ',
  'ನಾನು ಹೇಗಿದ್ದೇನೆ', 'ಸಾರಾಂಶದಲ್ಲಿ',
];

/* -------------------------------------------------------------------------- */
/* App help — how to use this app, not how the body works                        */
/* -------------------------------------------------------------------------- */

/**
 * Questions about the software.
 *
 * These are not health questions and they used to be answered as if they were:
 * "how do I log my period" matched the `my period` possessive, and a reader
 * trying to find the button that records a period was told the assistant had
 * looked at their data and could not find any. The answer is a place in the
 * interface, so it gets its own intent and its own response keys.
 */
const APP_HELP_TERMS: readonly string[] = [
  // English
  'how do i log', 'how to log', 'how do i record', 'how to record', 'how do i track',
  'how to track', 'where do i', 'how do i use', 'how do i change', 'how do i set',
  'how do i edit', 'how do i delete', 'how do i export', 'how do i find',
  'how do i explain', 'how do i update', 'how do i add', 'how do i save',
  'log in', 'sign in', 'sign out', 'log out', 'my account', 'settings',
  'notifications', 'reminder', 'reminders', 'this app', 'the app',
  // Hindi
  'कैसे दर्ज', 'कैसे लॉग', 'कहाँ', 'ऐप में', 'सेटिंग', 'भाषा बदलें', 'साइन इन',
  'साइन आउट', 'नोटिफिकेशन', 'रिमाइंडर', 'यह ऐप',
  // Kannada
  'ಹೇಗೆ ದಾಖಲಿಸುವುದು', 'ಎಲ್ಲಿ', 'ಆ್ಯಪ್', 'ಸೆಟ್ಟಿಂಗ್', 'ಭಾಷೆ ಬದಲಿಸು', 'ಸೈನ್ ಇನ್',
  'ಸೈನ್ ಔಟ್', 'ಅಧಿಸೂಚನೆ',
];

/**
 * Nouns that name a part of this application rather than a part of a body.
 *
 * "How do I …" is the most common shape of a question in the product and it is
 * genuinely ambiguous, because the verb phrase alone cannot tell the two apart:
 * "how do I log my period" wants a button and "how do I know if my period is
 * irregular" wants an answer. Listing every verb phrase that could follow would
 * be endless and would still miss one, so the discriminator is the object.
 * A navigational question is about the interface; everything else is health.
 */
const APP_OBJECT_TERMS: readonly string[] = [
  'button', 'screen', 'page', 'tab', 'menu', 'icon', 'app', 'application',
  'dates', 'predictions', 'prediction', 'calendar', 'entries', 'entry',
  'history', 'records', 'settings', 'profile', 'account', 'notification',
  'notifications', 'reminder', 'reminders', 'language', 'languages', 'pin',
  'chart', 'charts', 'report', 'reports', 'insight', 'insights',
  'बटन', 'स्क्रीन', 'पेज', 'ऐप', 'तारीख', 'तारीखें', 'अनुमान', 'कैलेंडर', 'रिकॉर्ड', 'इतिहास',
  'ಸೆಟ್ಟಿಂಗ್', 'ದಿನಾಂಕ', 'ಅಂಡೋತ್ಪತ್ತಿ', 'ದಾಖಲೆ', 'ಇತಿಹಾಸ', 'ವರದಿ', 'ಆ್ಯಪ್',
];

/** Question openings that ask where something is or how to do it in the app. */
const NAVIGATION_OPENINGS: readonly string[] = [
  'how do i', 'how to', 'where do i', 'how can i', 'can i', 'where can i',
  'कैसे', 'कहाँ', 'कहां', 'ಹೇಗೆ', 'ಎಲ್ಲಿ',
];

/* -------------------------------------------------------------------------- */
/* Education — general "explain this"                                           */
/* -------------------------------------------------------------------------- */

const EDUCATION_TERMS: readonly string[] = [
  'what is', 'what are', 'whats', 'explain', 'tell me about', 'how does',
  'how do i', 'how do', 'how can i', 'how to', 'how come', 'how much',
  'how many', 'how long', 'why do i', 'why do', 'why does', 'why is', 'why are',
  'why am', 'why are my', 'why does my', 'what can i do', 'what should',
  'what happens', 'what are the', 'what makes', 'learn about', 'guide',
  'in simple words', 'difference between', 'signs of', 'meaning of',
  'tell me', 'i want to know', 'i would like to know', 'anything about',
  'is it', 'are they', 'can i', 'should i', 'is there', 'are there',
  'क्या है', 'क्या हैं', 'क्या होता', 'बताइए', 'समझाइए', 'कैसे', 'क्यों',
  'क्यों मेरा', 'मुझे क्या', 'बताओ', 'क्या करूं', 'क्या करें', 'कितना', 'कितनी',
  'ಏನು', 'ಏನಾಗುತ್ತದೆ', 'ತಿಳಿಸಿ', 'ವಿವರಿಸಿ', 'ಹೇಗೆ', 'ಏಕೆ', 'ಎಷ್ಟು', 'ಏನು ಮಾಡಬೇಕು',
];

/* -------------------------------------------------------------------------- */
/* Greeting — matched last, so "hi, what is PCOS" is still education            */
/* -------------------------------------------------------------------------- */

const GREETING_TERMS: readonly string[] = [
  'hi', 'hello', 'hey', 'good morning', 'good evening', 'good afternoon',
  'namaste', 'namaskara',
  'नमस्ते', 'नमस्कार', 'हैलो',
  'ನಮಸ್ಕಾರ', 'ಹಲೋ',
];

/* -------------------------------------------------------------------------- */
/* Out of scope — not a health question at all                                 */
/* -------------------------------------------------------------------------- */

const OUT_OF_SCOPE_TERMS: readonly string[] = [
  'weather', 'stock market', 'share price', 'crypto', 'bitcoin', 'recipe',
  'cook', 'movie', 'film plot', 'song', 'football', 'cricket score', 'ipl',
  'write code', 'programming', 'python', 'javascript', 'homework', 'joke',
  'tell me a joke', 'translate this to english',
  'मौसम', 'शेयर भाव', 'रेसिपी', 'फिल्म', 'गाना', 'क्रिकेट', 'मजाक', 'कोड',
  'ಹವಾಮಾನ', 'ಸಹಿ ಬೆಲೆ', 'ಅನ್ನಡ', 'ಸಿನೆಮಾ', 'ಗೀತಿ', 'ಕ್ರಿಕೆಟ್', 'ಕೋಡ್',
];

/* -------------------------------------------------------------------------- */
/* Public detectors — the guardrail layer re-uses these rather than owning its  */
/* own vocabulary, so there is exactly one place a safety term can live.       */
/* -------------------------------------------------------------------------- */

export function detectCrisis(text: string): boolean {
  const haystack = pad(normalize(text));
  if (anyTerm(haystack, CRISIS_TERMS)) return true;
  return stemAnyTerm(haystack, CRISIS_TERMS);
}

export function detectMedicationRequest(text: string): boolean {
  return anyTerm(pad(normalize(text)), MEDICATION_TERMS);
}

/**
 * True when the reader is asserting or asking about a condition in themselves.
 * A bare condition name is not enough — see the module comment.
 */
export function detectPersonalDiagnosisClaim(text: string): boolean {
  const haystack = pad(normalize(text));
  if (anyTerm(haystack, DIAGNOSIS_FRAME_TERMS)) return true;
  return anyTerm(haystack, CONDITION_TERMS) && anyTerm(haystack, PERSONAL_MARKER_TERMS);
}

export function detectOutOfScope(text: string): boolean {
  return anyTerm(pad(normalize(text)), OUT_OF_SCOPE_TERMS);
}

/**
 * True when the reader is asking how to use the app rather than about a body.
 *
 * Two routes, both narrow. An explicit verb phrase ("how do I log") is
 * unambiguous. Otherwise the question has to be a navigational one *and* name
 * something in the interface — see `APP_OBJECT_TERMS` for why the object carries
 * the meaning and the verb phrase cannot.
 */
export function detectAppHelpRequest(text: string): boolean {
  const haystack = pad(normalize(text));
  if (anyTerm(haystack, APP_HELP_TERMS)) return true;

  return anyTerm(haystack, NAVIGATION_OPENINGS) && anyTerm(haystack, APP_OBJECT_TERMS);
}

/** True when the reader is asking for a recap of their own records. */
export function detectSummaryRequest(text: string): boolean {
  return anyTerm(pad(normalize(text)), SUMMARY_FRAME_TERMS);
}

/**
 * Classifies a message.
 *
 * Precedence is deliberate and one-way. Crisis is checked first so that a
 * message that also reads as a medication or diagnosis question still
 * escalates. App help sits above education so that "how do I log my period" is
 * answered with a place in the interface rather than with an article about
 * menstruation. Greeting is checked near-last so that "hi, what is PCOS" is
 * education rather than a bare greeting.
 */
export function classifyIntent(text: string): AssistantIntent {
  const haystack = pad(normalize(text));
  if (haystack.trim().length === 0) return 'unknown';

  if (detectCrisis(text)) return 'crisis';
  if (anyTerm(haystack, MEDICATION_TERMS)) return 'medication';
  if (anyTerm(haystack, OUT_OF_SCOPE_TERMS)) return 'outOfScope';
  if (detectPersonalDiagnosisClaim(text)) return 'diagnosis';
  if (anyTerm(haystack, PREDICTION_TERMS)) return 'prediction';
  if (detectSummaryRequest(text)) return 'personalSummary';
  if (detectAppHelpRequest(text)) return 'appHelp';
  if (anyTerm(haystack, EDUCATION_TERMS)) return 'education';
  if (anyTerm(haystack, GREETING_TERMS)) return 'greeting';

  return 'unknown';
}
