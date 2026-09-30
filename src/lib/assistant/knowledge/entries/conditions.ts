import type { KnowledgeEntry } from '../types';

/**
 * Gynaecological and related conditions.
 *
 * ---------------------------------------------------------------------------
 * HOW A CONDITION IS DESCRIBED HERE
 * ---------------------------------------------------------------------------
 * Every entry follows the same four-part shape, because the four parts are what
 * makes a condition answer safe to give without a consultation:
 *
 *   answer    what it is, in plain words
 *   detail    what it commonly does, and how it is usually found
 *   warningKey the signs that mean "see someone, soon, rather than read on"
 *   careKey   what a clinician would usually do about it
 *
 * A condition entry NEVER says whether the reader has it. That is what
 * `detectPersonalDiagnosisClaim` and the diagnosis guardrail are for, and the
 * two are complementary: the guardrail refuses "do I have PCOS", and this entry
 * is what the reader is pointed at afterwards so the refusal is still useful.
 *
 * ---------------------------------------------------------------------------
 * WHY THE ARTICLES ARE ALLOWLISTED
 * ---------------------------------------------------------------------------
 * The corpus already has articles for PCOS, endometriosis, anaemia, pelvic pain
 * and when to see a doctor. Those are named here so the answer's citation is the
 * long read on that exact condition, not whatever else happened to score well in
 * retrieval.
 */
export const CONDITION_ENTRIES: readonly KnowledgeEntry[] = [
  {
    id: 'pcos',
    domain: 'conditions',
    answerKey: 'pcos.answer',
    detailKey: 'pcos.detail',
    warningKey: 'pcos.warning',
    careKey: 'pcos.care',
    articles: ['pcosOverview'],
    strong: [
      'what is pcos', 'what does pcos stand for', 'what is polycystic ovary syndrome',
      'is pcos common', 'what causes pcos', 'can pcos be cured',
      'does pcos go away', 'what are the signs of pcos', 'what happens if pcos is untreated',
      'do you have to have cysts to have pcos', 'is pcos the same as pcod',
      'पीसीओएस क्या है', 'पॉलीसिस्टिक ओवरी सिंड्रोम क्या है',
      'ಪಿಸಿಒಎಸ್ ಏನು',
    ],
    weak: [
      'pcos', 'pcod', 'polycystic', 'ovary syndrome', 'insulin resistance',
      'पीसीओएस', 'पीसीओडी', 'ಪಿಸಿಒಎಸ್',
    ],
  },
  {
    id: 'endometriosis',
    domain: 'conditions',
    answerKey: 'endometriosis.answer',
    detailKey: 'endometriosis.detail',
    warningKey: 'endometriosis.warning',
    careKey: 'endometriosis.care',
    articles: ['endometriosisOverview'],
    strong: [
      'what is endometriosis', 'what causes endometriosis', 'is endometriosis serious',
      'how bad is endometriosis', 'does endometriosis go away', 'can endometriosis be cured',
      'what are the symptoms of endometriosis', 'can endometriosis cause infertility',
      'is endometriosis the same as fibroids', 'endometriosis or adenomyosis',
      'एंडोमेट्रियोसिस क्या है', 'एंडोमेट्रियोसिस के कारण',
      'ಎಂಡೊಮೆಟ್ರಿಯೋಸಿಸ್ ಏನು',
    ],
    weak: [
      'endometriosis', 'endometriotic', 'adenomyosis', 'एंडोमेट्रियोसिस', 'ಎಂಡೊಮೆಟ್ರಿಯೋಸಿಸ್',
    ],
  },
  {
    id: 'fibroids',
    domain: 'conditions',
    answerKey: 'fibroids.answer',
    detailKey: 'fibroids.detail',
    warningKey: 'fibroids.warning',
    careKey: 'fibroids.care',
    articles: ['whenToSeeDoctor'],
    strong: [
      'what are fibroids', 'what is a fibroid', 'what is a uterine fibroid',
      'what causes fibroids', 'are fibroids dangerous', 'do fibroids go away',
      'do fibroids need to be removed', 'can fibroids cause infertility',
      'what are the signs of fibroids', 'do fibroids turn into cancer',
      'फाइब्रॉइड क्या है', 'गर्भाशय का फाइब्रॉइड', 'फाइब्रोइड्स',
      'ಫೈಬ್ರಾಯ್ಡ್ ಏನು', 'ಗರ್ಭಾಶಯ ಟ್ಯೂಮರ್',
    ],
    weak: [
      'fibroid', 'fibroids', 'leiomyoma', 'myoma',
      'फाइब्रॉइड', 'फाइब्रोइड्स', 'ಫೈಬ್ರಾಯ್ಡ್',
    ],
  },
  {
    id: 'ovarianCysts',
    domain: 'conditions',
    answerKey: 'ovarianCysts.answer',
    detailKey: 'ovarianCysts.detail',
    warningKey: 'ovarianCysts.warning',
    careKey: 'ovarianCysts.care',
    strong: [
      'what is an ovarian cyst', 'what are ovarian cysts', 'what causes ovarian cysts',
      'is an ovarian cyst dangerous', 'do ovarian cysts go away', 'what is a cyst on the ovary',
      'can ovarian cysts be cancer', 'how big can an ovarian cyst get',
      'अंडाशय की सिस्ट क्या है', 'ओवरी सिस्ट', 'सिस्टी',
      'ಅಂಡಕೋಶದ ಸಿಸ್ಟ್ ಏನು', 'ಅಂಡಕೋಶ ಸಿಸ್ಟ್',
    ],
    weak: [
      'ovarian cyst', 'ovarian cysts', 'cysts on ovaries', 'cyst on ovary',
      'अंडाशय सिस्ट', 'सिस्ट', 'ಅಂಡಕೋಶ ಸಿಸ್ಟ್',
    ],
  },
  {
    id: 'thyroid',
    domain: 'conditions',
    answerKey: 'thyroid.answer',
    detailKey: 'thyroid.detail',
    warningKey: 'thyroid.warning',
    careKey: 'thyroid.care',
    strong: [
      'what is a thyroid problem', 'what does a thyroid disorder do',
      'can thyroid problems affect periods', 'thyroid and irregular periods',
      'thyroid and weight gain', 'how is the thyroid tested',
      'does a thyroid problem stop periods', 'what is hypothyroidism', 'what is hyperthyroidism',
      'थायरॉइड क्या है', 'थायरॉइड से पीरियड पर असर', 'हाइपरथायरॉइड',
      'ಥೈರಾಯ್ಡ್ ಏನು',
    ],
    weak: [
      'thyroid', 'hypothyroid', 'hyperthyroid', 'tsh', 'thyroxine',
      'थायरॉइड', 'ಥೈರಾಯ್ಡ್',
    ],
  },
  {
    id: 'anaemia',
    domain: 'conditions',
    answerKey: 'anaemia.answer',
    detailKey: 'anaemia.detail',
    careKey: 'anaemia.care',
    articles: ['anaemiaFatigue'],
    strong: [
      'what is anaemia', 'what is anemia', 'what causes anaemia',
      'what are the signs of anaemia', 'am i anaemic', 'how is anaemia diagnosed',
      'why am i short of breath and tired', 'does anaemia affect periods',
      'can heavy periods cause anaemia', 'low haemoglobin', 'low iron',
      'एनीमिया क्या है', 'एनीमिया के कारण', 'खून की कमी',
      'ಅನೀಮಿಯಾ ಏನು', 'ರಕ್ತ ಕೊರತೆ',
    ],
    weak: [
      'anaemia', 'anemia', 'anaemic', 'hemoglobin', 'haemoglobin', 'iron deficiency',
      'iron', 'एनीमिया', 'खून की कमी', 'ಅನೀಮಿಯಾ',
    ],
  },
  {
    id: 'pelvicPain',
    domain: 'conditions',
    answerKey: 'pelvicPain.answer',
    detailKey: 'pelvicPain.detail',
    warningKey: 'pelvicPain.warning',
    careKey: 'pelvicPain.care',
    articles: ['painTracking', 'whenToSeeDoctor'],
    strong: [
      'what causes pelvic pain', 'why do i have pelvic pain', 'what is pelvic pain',
      'lower abdominal pain that is not a period', 'pain in my lower belly all month',
      'what is chronic pelvic pain', 'is pelvic pain serious',
      'one sided pelvic pain', 'pain between my legs',
      'कमर के नीचे दर्द', 'पेल्विक दर्द क्यों', 'श्रोणि दर्द',
      'ಕೆಳಗಿನ ಹಿಂದು ನೋವು', 'ಪೆಲ್ವಿಕ್ ನೋವು',
    ],
    weak: [
      'pelvic pain', 'pelvic', 'lower abdominal pain', 'lower belly',
      'दर्द', 'नीचे का पेट', 'ನೋವು', 'ಪೆಲ್ವಿಕ್',
    ],
  },
  {
    id: 'uti',
    domain: 'conditions',
    answerKey: 'uti.answer',
    detailKey: 'uti.detail',
    warningKey: 'uti.warning',
    careKey: 'uti.care',
    strong: [
      'what is a uti', 'what is a urinary tract infection', 'what causes a uti',
      'uti symptoms', 'why do i get utis', 'do utis come back',
      'burning when i pee', 'why does it burn when i urinate',
      'frequent uti', 'can a uti affect my period',
      'मूत्र संक्रमण क्या है', 'पेशाब में जलन क्यों', 'यूटीआई',
      'ಮೂತ್ರ ಸೋಂಕಣ ಏನು',
    ],
    weak: [
      'uti', 'utis', 'urinary tract', 'urine infection', 'burning urine',
      'यूटीआई', 'मूत्र संक्रमण', 'ಯೂಟಿಐ', 'ಮೂತ್ರ ಸೋಂಕಣ',
    ],
  },
  {
    id: 'yeastInfection',
    domain: 'conditions',
    answerKey: 'yeastInfection.answer',
    detailKey: 'yeastInfection.detail',
    warningKey: 'yeastInfection.warning',
    careKey: 'yeastInfection.care',
    strong: [
      'what is a yeast infection', 'what is thrush', 'what causes a yeast infection',
      'why do i get thrush', 'is it a yeast infection', 'candida infection',
      'itchy discharge what is it', 'what is bacterial vaginosis', 'what is bv',
      'योनि में खुजली क्यों', 'यीस्ट संक्रमण क्या है', 'थ्रश',
      'ಯೋಸ್ಟ್ ಸೋಂಕಣ ಏನು',
    ],
    weak: [
      'yeast', 'thrush', 'candida', 'bacterial vaginosis', 'bv',
      'योस्ट', 'खमनीरिया', 'ಯೋಸ್ಟ್', 'ಥ್ರಶ್',
    ],
  },
  {
    id: 'pid',
    domain: 'conditions',
    answerKey: 'pid.answer',
    detailKey: 'pid.detail',
    warningKey: 'pid.warning',
    careKey: 'pid.care',
    strong: [
      'what is pid', 'what is pelvic inflammatory disease', 'what causes pid',
      'can pid cause infertility', 'is pid an sti', 'pain after sex and fever',
      'what happens if an sti is not treated', 'does pid go away on its own',
      'पेल्विक इन्फ्लेमेटरी डिज़ीज़', 'पीआईडी क्या है',
      'ಪೆಲ್ವಿಕ್ ಇನ್ಫ್ಲಮ್ಮೇಟರಿ ಡಿಸೀಸ್',
    ],
    weak: [
      'pid', 'pelvic inflammatory', 'pelvic infection',
      'पीआईडी', 'ಪಿಐಡಿ',
    ],
  },
];