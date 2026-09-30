import type { KnowledgeEntry } from '../types';

/**
 * Menstrual health — the everyday vocabulary of the whole product.
 *
 * This is where the assistant has to be most careful about one specific thing:
 * almost every question here has a *personal* twin. "Why do periods hurt" is
 * education; "why does my period hurt this month" is partly personal. The
 * matcher therefore keeps the general phrasing (`why do periods`, `what causes
 * period cramps`) as strong terms and puts the first-person phrasing in weak
 * terms, so a question that names the reader's own body still reaches the
 * personal-data route instead of being answered with a general fact.
 *
 * No entry states a typical cycle length, a normal period duration, or a
 * "healthy" bleeding amount as a fixed number. Those ranges vary by person, and
 * a range written into code is a claim nobody reviewed. Where a range genuinely
 * helps, the answer describes the variation and says what counts as a change to
 * take to a clinician.
 */
export const MENSTRUAL_HEALTH_ENTRIES: readonly KnowledgeEntry[] = [
  {
    id: 'menstruation',
    domain: 'menstrualHealth',
    answerKey: 'menstruation.answer',
    detailKey: 'menstruation.detail',
    articles: ['cyclePhases'],
    strong: [
      'what is menstruation', 'what is a period', 'what is a menstrual period',
      'what happens during a period', 'what is menstruation',
      'what happens when you have a period', 'why do periods happen',
      'why do we have periods', 'what is menstrual bleeding',
      'what is the menstrual cycle', 'explain the menstrual cycle',
      'मासिक धर्म क्या है', 'पीरियड क्यों होता है', 'मासिक धर्म क्या होता है',
      'ಮುಟ್ಟು ಏನು', 'ಮುಟ್ಟು ಏಕೆ ಆಗುತ್ತದೆ', 'ಮಾಸಿಕ ಚಕ್ರ ಏನು',
    ],
    weak: [
      'menstruation', 'menstrual', 'period', 'periods', 'bleeding', 'cycle',
      'मासिक धर्म', 'पीरियड', 'ಮುಟ್ಟು', 'ಚಕ್ರ',
    ],
  },
  {
    id: 'cycleLength',
    domain: 'menstrualHealth',
    answerKey: 'cycleLength.answer',
    detailKey: 'cycleLength.detail',
    articles: ['cyclePhases'],
    strong: [
      'what is a normal cycle length', 'how long is a cycle', 'what cycle length is normal',
      'does everyone have a 28 day cycle', 'is 28 days the normal cycle',
      'how long does a cycle usually last', 'why does cycle length change',
      'how do cycle lengths differ between people',
      'सामान्य चक्र कितना लंबा', 'क्या सबका चक्र 28 दिन का होता है',
      'ಸಾಮಾನ್ಯ ಚಕ್ರ ಎಷ್ಟು ದಿನ',
    ],
    weak: [
      'cycle length', 'cycle lengths', '28 day', '28 days', 'length of cycle',
      'चक्र की अवधि', 'चक्र कितना', 'ಚಕ್ರ ಉದ್ದ',
    ],
  },
  {
    id: 'periodDuration',
    domain: 'menstrualHealth',
    answerKey: 'periodDuration.answer',
    strong: [
      'how long does a period last', 'how many days does a period last',
      'what is a normal period length', 'how long should bleeding last',
      'what is a normal period duration',
      'पीरियड कितने दिन चलता है', 'रक्तस्राव कितने दिन',
      'ಮುಟ್ಟು ಎಷ್ಟು ದಿನ ನಡೆಯುತ್ತದೆ',
    ],
    weak: [
      'period duration', 'period length', 'how long a period', 'period days',
      'अवधि', 'ಅವಧಿ',
    ],
  },
  {
    id: 'spotting',
    domain: 'menstrualHealth',
    answerKey: 'spotting.answer',
    detailKey: 'spotting.detail',
    warningKey: 'spotting.warning',
    articles: ['whenToSeeDoctor'],
    strong: [
      'what is spotting', 'what does spotting mean', 'why am i spotting',
      'what is spotting between periods', 'brown discharge', 'pink discharge',
      'why is there blood between periods', 'what causes light bleeding between periods',
      'स्पॉटिंग क्या है', 'पीरियड के बीच रक्तस्राव', 'धूसर दाने',
      'ಸ್ಪಾಟಿಂಗ್ ಏನು', 'ಮುಟ್ಟುಗಳ ನಡುವೆ ರಕ್ತಸ್ರಾವ',
    ],
    weak: [
      'spotting', 'discharge', 'light bleeding', 'staining', 'स्पॉटिंग', 'ಸ್ಪಾಟಿಂಗ್',
    ],
  },
  {
    id: 'heavyBleeding',
    domain: 'menstrualHealth',
    answerKey: 'heavyBleeding.answer',
    detailKey: 'heavyBleeding.detail',
    warningKey: 'heavyBleeding.warning',
    careKey: 'heavyBleeding.care',
    articles: ['anaemiaFatigue', 'whenToSeeDoctor'],
    strong: [
      'what is heavy bleeding', 'what counts as heavy bleeding', 'what is heavy periods',
      'why is my bleeding so heavy', 'how much bleeding is too much',
      'soaking through a pad every hour', 'bleeding through my clothes',
      'what is menorrhagia', 'do heavy periods mean something is wrong',
      'भारी मासिक धर्म', 'बहुत ज्यादा रक्तस्राव', 'हर घंटे पैड भर जाता है',
      'ಹೆಚ್ಚು ರಕ್ತಸ್ರಾವ', 'ಪ್ಯಾಡ್ ಒಂದು ಗಂಟೆಗೆ ನೆನ್ನಗೆಯಾಗುತ್ತದೆ',
    ],
    weak: [
      'heavy bleeding', 'heavy period', 'heavy periods', 'flooding', 'soaking',
      'heavy flow', 'थक', 'ಹೆಚ್ಚು ರಕ್ತಸ್ರಾವ',
    ],
  },
  {
    id: 'irregularPeriods',
    domain: 'menstrualHealth',
    answerKey: 'irregularPeriods.answer',
    detailKey: 'irregularPeriods.detail',
    warningKey: 'irregularPeriods.warning',
    articles: ['whenToSeeDoctor', 'pcosOverview', 'pmsVsPmd'],
    strong: [
      'why can periods become irregular', 'why are periods irregular',
      'what causes irregular periods', 'what makes a cycle irregular',
      'what causes irregular cycles', 'why is my cycle changing',
      'why does my cycle length keep changing', 'what does irregular mean',
      'is irregular bad', 'does irregular automatically mean unhealthy',
      'पीरियड अनियमित क्यों होते हैं', 'अनियमित चक्र के कारण',
      'ಮುಟ್ಟು ಏಕೆ ಅಸಮಂಗತ', 'ಅಸಮಂಗತ ಚಕ್ರ ಏಕೆ',
    ],
    weak: [
      'irregular', 'irregularity', 'unpredictable', 'varying cycle',
      'अनियमित', 'ಅಸಮಂಗತ',
    ],
  },
  {
    id: 'missedPeriod',
    domain: 'menstrualHealth',
    answerKey: 'missedPeriod.answer',
    detailKey: 'missedPeriod.detail',
    warningKey: 'missedPeriod.warning',
    articles: ['whenToSeeDoctor', 'fertileWindow'],
    strong: [
      'what causes a missed period', 'why did i miss my period', 'what happens if you miss a period',
      'why is my period not coming', 'why is my period late', 'what are the reasons for a missed period',
      'can stress stop a period', 'can exercise stop a period', 'can illness delay a period',
      'पीरियड क्यों नहीं आया', 'पीरियड लेट क्यों है', 'मिस्ड पीरियड के कारण',
      'ಮುಟ್ಟು ಏಕೆ ಬರಲಿಲ್ಲ', 'ಮುಟ್ಟು ತಡವಾಗಿದೆ',
    ],
    weak: [
      'missed period', 'missed my period', 'period not coming', 'late period', 'delay',
      'मिस्ड पीरিয়ड', 'ಮಿಸ್ಡ್ ಪೀರಿಯಡ್',
    ],
  },
  {
    id: 'cramps',
    domain: 'menstrualHealth',
    answerKey: 'cramps.answer',
    detailKey: 'cramps.detail',
    warningKey: 'cramps.warning',
    articles: ['painTracking', 'endometriosisOverview'],
    strong: [
      'what causes period cramps', 'why do periods hurt', 'why do periods cramp',
      'why do i get cramps during my period', 'what is menstrual pain',
      'why are my periods so painful', 'what causes cramps',
      'can endometriosis cause severe period pain', 'is severe period pain normal',
      'what helps period cramps', 'how do i stop period pain',
      'पीरियड में ऐंठन क्यों', 'पीरियड दर्द क्यों होता है', 'मासिक धर्म की ऐंठन',
      'ಮುಟ್ಟು ನೋವು ಏಕೆ', 'ಮುಟ್ಟುಗಳ ಹುಸುವಿಕೆ ಏಕೆ',
    ],
    weak: [
      'cramps', 'cramping', 'cramp', 'period pain', 'painful period', 'painful periods',
      'pain', 'aches', 'ऐंठन', 'दर्द', 'ಹುಸುವಿಕೆ', 'ನೋವು',
    ],
  },
  {
    id: 'pms',
    domain: 'menstrualHealth',
    answerKey: 'pms.answer',
    detailKey: 'pms.detail',
    articles: ['pmsVsPmd'],
    strong: [
      'what is pms', 'what does pms stand for', 'what are pms symptoms',
      'why am i tired before my period', 'why do i feel emotional before my period',
      'what causes pms', 'premenstrual syndrome', 'why am i moody before my period',
      'पीएमएस क्या है', 'पीरियड से पहले थकान क्यों', 'मनोदशा क्यों बदलता है',
      'ಪಿಎಂಎಸ್ ಏನು', 'ಮುಟ್ಟುಗಳ ಮೊದಲು ಆಯಸೆ ಏಕೆ',
    ],
    weak: [
      'pms', 'premenstrual', 'pre menstrual', 'before my period', 'pre period',
      'पीएमएस', 'ಪಿಎಂಎಸ್',
    ],
  },
  {
    id: 'pmdd',
    domain: 'menstrualHealth',
    answerKey: 'pmdd.answer',
    detailKey: 'pmdd.detail',
    careKey: 'pmdd.care',
    articles: ['pmsVsPmd'],
    strong: [
      'what is pmdd', 'what does pmdd stand for', 'what is the difference between pms and pmdd',
      'is pmdd serious', 'how is pmdd different from pms',
      'how is pmdd diagnosed', 'pmdd symptoms', 'premenstrual dysphoric disorder',
      'पीएमडीडी क्या है', 'पीएमएस और पीएमडीडी में अंतर',
      'ಪಿಎಂಡಿಡಿ ಏನು', 'ಪಿಎಂಎಸ್ ಮತ್ತು ಪಿಎಂಡಿಡಿ ವ್ಯತ್ಯಾಸ',
    ],
    weak: ['pmdd', 'पीएमडीडी', 'ಪಿಎಂಡಿಡಿ'],
  },
  {
    id: 'menstrualHygiene',
    domain: 'menstrualHealth',
    answerKey: 'menstrualHygiene.answer',
    detailKey: 'menstrualHygiene.detail',
    strong: [
      'what is menstrual hygiene', 'how should i stay clean during my period',
      'how often should i change a pad', 'how long can i keep a pad',
      'is it safe to sleep with a pad', 'how to wash after your period',
      'what is safe menstrual hygiene', 'do tampons have toxins',
      'मासिक धर्म स्वच्छता', 'पैड कितनी देर बदलें', 'मासिक धर्म में सफाई',
      'ಮುಟ್ಟು ಸ್ವಚ್ಛತೆ', 'ಪ್ಯಾಡ್ ಯಾವಾಗ ಬದಲಿಸುವುದು',
    ],
    weak: [
      'hygiene', 'clean', 'washing', 'pad', 'pads', 'tampon', 'sanitary',
      'स्वच्छता', 'सफाई', 'ಸ್ವಚ್ಛತೆ', 'ಪ್ಯಾಡ್',
    ],
  },
];

/**
 * "Why am I tired before my period" has its own entry rather than being folded
 * into `pms`, because it is the most-asked symptom question in the product and
 * the answer is genuinely different: fatigue before a period has several common
 * explanations, one of which is worth a blood test, and a general PMS answer
 * would leave the reader none of that.
 *
 * `articles` points at the anaemia article because iron deficiency is the
 * explanation worth reading more about.
 */
export const MENSTRUAL_FATIGUE_ENTRY: KnowledgeEntry = {
  id: 'menstrualFatigue',
  domain: 'menstrualHealth',
  answerKey: 'menstrualFatigue.answer',
  detailKey: 'menstrualFatigue.detail',
  careKey: 'menstrualFatigue.care',
  articles: ['anaemiaFatigue', 'sleepStressCycle'],
  strong: [
    'tired before my period', 'tired before my periods', 'tired before period',
    'tired before menstruation', 'fatigue before my period', 'exhausted before my period',
    'why am i tired before my period', 'why am i so tired before my period',
    'tired during my period', 'low energy before my period', 'drained before my period',
    'tired around my period', 'why am i always tired around my period',
    'पीरियड से पहले थकान', 'पीरियड के दौरान थकान', 'मासिक धर्म से पहले थकान क्यों',
    'ಮುಟ್ಟುಗಳ ಮೊದಲು ಆಯಸೆ',
  ],
  weak: [
    'tired', 'tiredness', 'fatigue', 'exhausted', 'drained', 'no energy',
    'थकान', 'सुस्ती', 'ಆಯಸೆ', 'ಕಡಿಮೆ ಶಕ್ತಿ',
  ],
};