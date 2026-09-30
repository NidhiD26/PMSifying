import type { KnowledgeEntry } from '../types';

/**
 * Medical safety: the red flags, and when to stop reading and get care.
 *
 * ---------------------------------------------------------------------------
 * SELF-HARM IS NOT HERE, AND MUST NOT BE ADDED
 * ---------------------------------------------------------------------------
 * Crisis messaging already lives in `guardrails.ts`, runs *before* any routing,
 * and shows `CRISIS_RESOURCES` — helpline numbers and `112` — with a test that
 * asserts the API is never called for a crisis message. That path is the single
 * authority on distress of any kind.
 *
 * This file is only for *medical* urgency. Duplicating crisis content here would
 * create a second, weaker path to the same reader at exactly the moment it
 * matters most, so nothing in this file should mention self-harm, suicide,
 * helplines or `112`.
 *
 * ---------------------------------------------------------------------------
 * WHAT MAKES A RED FLAG ENTRY DIFFERENT FROM A CONDITION ENTRY
 * ---------------------------------------------------------------------------
 * A condition entry answers a question. A red-flag entry has to interrupt one.
 *
 * So these entries are written to be safe when quoted badly: the answer names the
 * signs plainly, the `warningKey` says in one sentence that this needs a
 * clinician now rather than an explanation, and the `careKey` says what kind of
 * care and how urgently. Nothing here waits for the reader to finish the
 * conversation, and nothing here suggests a home remedy.
 *
 * ---------------------------------------------------------------------------
 * NO TIMING NUMBERS ARE HARD-CODED
 * ---------------------------------------------------------------------------
 * "Within X hours" or "after 24 weeks" are clinical thresholds that vary by
 * guideline and country, and a wrong one here is a real harm. Where urgency is
 * genuinely graded, the answer says so in words ("straight away", "today",
 * "at your next appointment") and the specific thresholds live in the clinician's
 * hands, which is where the brief puts them too.
 */
export const SAFETY_ENTRIES: readonly KnowledgeEntry[] = [
  {
    id: 'emergencyQuestion',
    domain: 'safety',
    answerKey: 'emergencyQuestion.answer',
    detailKey: 'emergencyQuestion.detail',
    strong: [
      'is this an emergency', 'when should i go to the hospital', 'when should i go to a doctor',
      'when should i see a doctor', 'do i need to see a doctor',
      'should i go to urgent care', 'do i need urgent care', 'should i go to a hospital',
      'do i need the emergency room', 'how do i know if something is serious',
      'is this worth a doctor visit', 'can i wait and see if it improves',
      'क्या यह आपातकाल है', 'डॉक्टर से मिलना चाहिए', 'अस्पताल जाना चाहिए',
      'ಇದು ತುರ್ತು ಆಸ್ಪತ್ರೆ ಹೋಗಬೇಕೇ', 'ವೈದ್ಯರನ್ನು ಕಾಣಬೇಕೇ',
    ],
    weak: [
      'emergency', 'urgent', 'hospital', 'doctor', 'er', 'emergency room',
      'आपातकाल', 'अस्पताल', 'डॉक्टर', 'ತುರ್ತು', 'ಆಸ್ಪತ್ರೆ', 'ವೈದ್ಯ',
    ],
  },
  {
    id: 'redFlagPeriodPain',
    domain: 'safety',
    answerKey: 'redFlagPeriodPain.answer',
    warningKey: 'redFlagPeriodPain.warning',
    careKey: 'redFlagPeriodPain.care',
    articles: ['whenToSeeDoctor', 'painTracking'],
    strong: [
      'period pain so bad i cannot move', 'period pain so severe i cannot walk',
      'my period pain is unbearable', 'period pain worse than ever',
      'is severe period pain dangerous', 'period pain with fever',
      'period pain and vomiting', 'period pain and fainting', 'period pain one side severe',
      'why is my period pain getting worse every month', 'period pain not relieved by anything',
      'पीरियड दर्द बर्दाशत', 'पीरियड में बुखार', 'पीरियड दर्द इतना ज्यादा',
      'ಮುಟ್ಟಿನ ನೋವು ತೀವ್ರ', 'ಮುಟ್ಟಿನ ಹುಸುವಿಕೆ ಜಾರ',
    ],
    weak: [
      'severe period pain', 'worst pain', 'unbearable', 'cannot move', 'fainted',
      'बर्दाशत', 'ज्वर', 'ತೀವ್ರ', 'ಜಾರ',
    ],
  },
  {
    id: 'redFlagHeavyBleeding',
    domain: 'safety',
    answerKey: 'redFlagHeavyBleeding.answer',
    warningKey: 'redFlagHeavyBleeding.warning',
    careKey: 'redFlagHeavyBleeding.care',
    articles: ['whenToSeeDoctor', 'anaemiaFatigue'],
    strong: [
      'bleeding so much i cannot keep up', 'soaking a pad every hour',
      'soaking through pads every hour', 'passing clots the size of a coin',
      'large clots in my period blood', 'bleeding and feeling faint',
      'bleeding and dizzy', 'bleeding much heavier than usual and i feel weak',
      'is heavy bleeding an emergency',
      'बहुत ज्यादा रक्तस्राव और चक्कर', 'एक घंटे में पैड भर जाए',
      'ಗಂಟೆಗೆ ಪ್ಯಾಡ್ ನೆನೆಯುತ್ತಿದೆ',
    ],
    weak: [
      'soaking', 'every hour', 'clots', 'passing clots', 'faint', 'dizzy',
      'भारी रक्तस्राव', 'थक्का', 'ಗಂಟೆಗೆ', 'ಚಕಿತ',
    ],
  },
  {
    id: 'redFlagFainting',
    domain: 'safety',
    answerKey: 'redFlagFainting.answer',
    warningKey: 'redFlagFainting.warning',
    careKey: 'redFlagFainting.care',
    strong: [
      'i fainted', 'i keep fainting', 'fainting during my period',
      'dizzy when i stand up', 'chest pain and shortness of breath',
      'shortness of breath with chest pain', 'heart racing and dizzy',
      'one side of my body is weak', 'sudden blurred vision',
      'कई बार बेहोश हो गई', 'छाती में दर्द और सांस फूलना',
      'ನಿನಗೆ ಮಾರಾಟ್', 'ಎದೆ ನೋವು ಮತ್ತು ಉಸಿರುತ್ತಿಕೆ',
    ],
    weak: [
      'fainted', 'fainting', 'blackout', 'dizzy', 'chest pain',
      'chest pain and shortness of breath', 'shortness of breath', 'blurred vision',
      'बेहोश', 'चक्कर', 'छाती में दर्द', 'ನಿಕ್ಕಾವರೆ', 'ಎದೆ ನೋವು', 'ಮೈದುದು',
    ],
  },
  {
    id: 'redFlagPregnancy',
    domain: 'safety',
    answerKey: 'redFlagPregnancy.answer',
    warningKey: 'redFlagPregnancy.warning',
    careKey: 'redFlagPregnancy.care',
    articles: ['whenToSeeDoctor'],
    strong: [
      'pregnant and bleeding', 'bleeding in early pregnancy', 'positive test and bleeding',
      'pregnant and one sided pain', 'pregnant and severe stomach pain',
      'pregnant and shoulder pain', 'pregnant and fainting', 'pregnant and headache and vision',
      'severe headache in pregnancy', 'is bleeding in early pregnancy serious',
      'गर्भवती और रक्तस्राव', 'गर्भावस्था में पेट दर्द', 'गर्भावस्था में तेज सिरदर्द',
      'ಗರ್ಭಿಣಿ ಮತ್ತು ರಕ್ತಸ್ರಾವ', 'ಗರ್ಭಾಧಾನದಲ್ಲಿ ನೋವು',
    ],
    weak: [
      'in pregnancy', 'while pregnant', 'early pregnancy', 'positive test',
      'गर्भावस्था', 'गर्भवती', 'ಗರ್ಭಾಧಾನ',
    ],
  },
  {
    id: 'redFlagAllergicReaction',
    domain: 'safety',
    answerKey: 'redFlagAllergicReaction.answer',
    warningKey: 'redFlagAllergicReaction.warning',
    careKey: 'redFlagAllergicReaction.care',
    strong: [
      'anaphylaxis', 'severe allergic reaction', 'my throat is closing',
      'my face is swelling', 'swelling after an allergic reaction',
      'difficulty breathing after an allergy', 'hives all over with breathing trouble',
      'एनाफिलैक्सिस क्या है', 'गला बंद हो रहा है', 'साँस नहीं लग रही',
      'ಅನಾಫಿಲ್ಯಾಕ್ಸಿಸ್',
    ],
    weak: [
      'allergic reaction', 'anaphylaxis', 'throat closing', 'swelling',
      'एलर्जी', 'स्वाँस', 'ಅಲರ್ಜಿ', 'ಅನಾಫಿಲ್ಕ್ಸಿಸ್',
    ],
  },
];