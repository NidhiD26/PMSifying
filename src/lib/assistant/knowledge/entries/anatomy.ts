import type { KnowledgeEntry } from '../types';

/**
 * Anatomy.
 *
 * ---------------------------------------------------------------------------
 * WHY NAMES ARE ANSWERED PLAINLY
 * ---------------------------------------------------------------------------
 * Most of these questions come from somewhere that either does not use these
 * words or does not use them accurately: a textbook with a different vocabulary,
 * a relative, a first lesson that got skipped, a translator. "What is a cervix",
 * "what is a vagina", "what is a vulva" are ordinary questions and the honest
 * answer is short, accurate and unembarrassed — no euphemism, no coyness, and no
 * assumption about who is asking.
 *
 * ---------------------------------------------------------------------------
 * THE ONE PLACE ANATOMY ENTRY NEEDS CARE
 * ---------------------------------------------------------------------------
 * Anatomy questions are *very* often screening questions ("do I have a vaginal
 * infection", "what does my vulva look like"). The diagnosis guardrail already
 * refuses a first-person symptom claim, so these entries stay descriptive: what
 * the structure is and what it does. They never say what a person's own body is
 * doing. `warningKey` exists on the genital ones because "unusual for you" is
 * the sentence worth getting in front of somebody, and it belongs in the answer
 * rather than in a diagnosis.
 */
export const ANATOMY_ENTRIES: readonly KnowledgeEntry[] = [
  {
    id: 'vulva',
    domain: 'anatomy',
    answerKey: 'vulva.answer',
    detailKey: 'vulva.detail',
    strong: [
      'what is a vulva', 'what is the vulva', 'what is my vulva',
      'what does a vulva do', 'what does the vulva do', 'vulva meaning',
      'what is the difference between vulva and vagina',
      'वल्वा क्या है', 'योनि और वल्वा में अंतर',
      'ವಲ್ವಾ ಏನು',
    ],
    weak: ['vulva', 'external genitals', 'outer lips', 'वल्वा', 'ವಲ್ವಾ'],
  },
  {
    id: 'vagina',
    domain: 'anatomy',
    answerKey: 'vagina.answer',
    detailKey: 'vagina.detail',
    warningKey: 'vagina.warning',
    strong: [
      'what is a vagina', 'what is the vagina', 'what does a vagina do',
      'what does the vagina do', 'what is a vagina for', 'vagina meaning',
      'how does the vagina work', 'what is inside the vagina',
      'योनि क्या है', 'योनि क्या करती है', 'ಯೋನಿ ಏನು', 'ಯೋನಿ ಏನು ಮಾಡುತ್ತದೆ',
    ],
    weak: ['vagina', 'vaginal', 'योनि', 'ಯೋನಿ'],
  },
  {
    id: 'vaginaOpening',
    domain: 'anatomy',
    answerKey: 'vaginaOpening.answer',
    strong: [
      'what is the vaginal opening', 'what is the opening of the vagina',
      'what is the vaginal hole', 'what is the hymen',
      'what is a hymen', 'does every vagina have a hymen',
      'can you see the vaginal opening', 'is the vaginal opening small',
      'योनि का छिद्र क्या है', 'हाइमन क्या है',
      'ಯೋನಿಯ ರಂಧ್ರ ಏನು', 'ಹೈಮೆನ್ ಏನು',
    ],
    weak: ['vaginal opening', 'vaginal hole', 'hymen', 'योनि का छिद्र', 'ಹೈಮೆನ್'],
  },
  {
    id: 'cervix',
    domain: 'anatomy',
    answerKey: 'cervix.answer',
    detailKey: 'cervix.detail',
    strong: [
      'what is the cervix', 'what is a cervix', 'what does the cervix do',
      'what is the cervix for', 'cervix meaning', 'where is the cervix',
      'what does a cervix look like', 'what is cervical fluid',
      'what is cervical mucus', 'what is the cervix opening',
      'how does the cervix change during a cycle',
      'सर्विस क्या है', 'सर्विस क्या करती है', 'गर्भाशय का मुख',
      'ಸರ್ವಿಕ್ಸ್ ಏನು', 'ಸರ್ವಿಕ್ಸ್ ಏನು ಮಾಡುತ್ತದೆ',
    ],
    weak: [
      'cervix', 'cervical', 'cervix position',
      'सर्विस', 'गर्भाशय मुख', 'ಸರ್ವಿಕ್ಸ್',
    ],
  },
  {
    id: 'uterus',
    domain: 'anatomy',
    answerKey: 'uterus.answer',
    detailKey: 'uterus.detail',
    strong: [
      'what is the uterus', 'what does the uterus do', 'what is a uterus',
      'what is the womb', 'what is the womb', 'what is the lining of the uterus',
      'what is the endometrium', 'what is the endometrium',
      'why does the uterus lining build up', 'what is a uterine fibroid',
      'गर्भाशय क्या है', 'एंडोमेट्रियम क्या है', 'गर्भाशय की परत',
      'ಗರ್ಭಾಶಯ ಏನು', 'ಎಂಡೊಮೆಟ್ರಿಯಂ ಏನು',
    ],
    weak: [
      'uterus', 'womb', 'uterine', 'endometrium', 'uterine lining',
      'गर्भाशय', 'एंडोमेट्रियम', 'ಗರ್ಭಾಶಯ',
    ],
  },
  {
    id: 'fallopianTubes',
    domain: 'anatomy',
    answerKey: 'fallopianTubes.answer',
    strong: [
      'what are fallopian tubes', 'what is a fallopian tube', 'what do fallopian tubes do',
      'where do fallopian tubes go', 'what happens in the fallopian tube',
      'what is tubal', 'what is tubal ligation', 'are my tubes tied',
      'फैलोपियन नलिका क्या है', 'ट्यूबलिंग क्या है',
      'ಫ್ಯಾಲೋಪಿಯನ್ ಟ್ಯೂಬ್ ಏನು',
    ],
    weak: ['fallopian tube', 'fallopian tubes', 'tube', 'tubes', 'ट्यूब', 'ಟ್ಯೂಬ್'],
  },
  {
    id: 'ovaries',
    domain: 'anatomy',
    answerKey: 'ovaries.answer',
    detailKey: 'ovaries.detail',
    strong: [
      'what are ovaries', 'what is an ovary', 'what do ovaries do',
      'what do the ovaries do', 'how many ovaries do women have', 'what do ovaries produce',
      'अंडाशय क्या हैं', 'अंडाशय क्या करते हैं', 'अंडाशय की सिस्ट',
      'ಅಂಡಕೋಶ ಏನು', 'ಅಂಡಕೋಶ ಏನು ಮಾಡುತ್ತವೆ',
    ],
    weak: [
      'ovary', 'ovaries', 'ovarian', 'egg', 'eggs', 'ovulation',
      'अंडाशय', 'अंडा', 'ಅಂಡಕೋಶ',
    ],
  },
];