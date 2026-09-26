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
  'herbal remedy', 'home remedy',
  // Hindi
  'दवा', 'दवाई', 'गोली', 'खुराक', 'नसीला', 'दवाइयों', 'प्रिस्क्रिप्शन',
  'एंटीबायोटिक', 'आयुर्वेदिक', 'घरेलू उपाय', 'कौन सी दवा', 'दवा लेनी चाहिए',
  'दवा बंद', 'मात्रा',
  // Kannada
  'ಔಷಧಿ', 'ಔಷಧ', 'ಮದ್ದು', 'ಗುಳ್ಳೆ', 'ಅಂಶ', 'ಪ್ರಿಸ್ಕ್ರಿಪ್ಶನ್', 'ನಿರೋಧಕ',
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
  'अगली पीरियड', 'पीरियड कब', 'पीरियड देर', 'ओव्यूलेशन', 'सहायक गर्भाधान',
  'अनियमित', 'चक्र',
  'ಮುಂದಿನ ಮುಟ್ಟು', 'ಮುಟ್ಟು ಯಾವಾಗ', 'ಅಂಡೋತ್ಪತ್ತಿ', 'ಸಹಜ ಗರ್ಭಾಧಾನ',
  'ಅಸಮಂಗತ', 'ಚಕ್ರ',
];

/* -------------------------------------------------------------------------- */
/* Personal summary — explicit self-reference, so "why do i cramp" is education */
/* -------------------------------------------------------------------------- */

const PERSONAL_SUMMARY_TERMS: readonly string[] = [
  'my data', 'my records', 'my record', 'my logs', 'my log', 'my history',
  'my symptoms', 'my moods', 'my cycle', 'my cycles', 'my period', 'my periods',
  'my average', 'my trend', 'my trends', 'my pain', 'my sleep',
  'my hydration', 'summarise my', 'summarize my', 'summarise', 'summarize',
  'how am i doing', 'tell me about my', 'what does my data', 'my progress',
  'मेरा डेटा', 'मेरा रिकॉर्ड', 'मेरे लक्षण', 'मेरा सारांश', 'मेरी औसत',
  'मैं कैसा', 'मेरा चक्र',
  'ನನ್ನ ಡೇಟಾ', 'ನನ್ನ ದಾಖಲೆ', 'ನನ್ನ ಲಕ್ಷಣ', 'ನನ್ನ ಸಾರಾಂಶ',
  'ನನ್ನ ಸರಾಸರಿ', 'ನಾನು ಹೇಗಿದ್ದೇನೆ', 'ನನ್ನ ಚಕ್ರ',
];

/* -------------------------------------------------------------------------- */
/* Education — general "explain this"                                           */
/* -------------------------------------------------------------------------- */

const EDUCATION_TERMS: readonly string[] = [
  'what is', 'what are', 'whats', 'explain', 'tell me about', 'how does',
  'how do i', 'why do i', 'why does', 'learn about', 'guide', 'in simple words',
  'difference between', 'signs of', 'meaning of',
  'क्या है', 'क्या हैं', 'क्या होता', 'बताइए', 'समझाइए', 'कैसे', 'क्यों',
  'ಏನು', 'ಏನಾಗುತ್ತದೆ', 'ತಿಳಿಸಿ', 'ವಿವರಿಸಿ', 'ಹೇಗೆ', 'ಏಕೆ',
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
 * Classifies a message.
 *
 * Precedence is deliberate and one-way. Crisis is checked first so that a
 * message that also reads as a medication or diagnosis question still
 * escalates. Greeting is checked near-last so that "hi, what is PCOS" is
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
  if (anyTerm(haystack, PERSONAL_SUMMARY_TERMS)) return 'personalSummary';
  if (anyTerm(haystack, EDUCATION_TERMS)) return 'education';
  if (anyTerm(haystack, GREETING_TERMS)) return 'greeting';

  return 'unknown';
}
