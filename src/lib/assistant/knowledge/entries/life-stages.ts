import type { KnowledgeEntry } from '../types';

/**
 * Life stages, and what changes at each one.
 *
 * ---------------------------------------------------------------------------
 * WHY PERIMENOPAUSE IS ITS OWN ENTRY
 * ---------------------------------------------------------------------------
 * "Perimenopause" and "menopause" get treated as one word in conversation, and
 * answering them as one is how somebody ends up convinced that a year of
 * irregular periods is something to be worried about rather than something
 * ordinary. They are not the same thing and the distinction is worth a sentence:
 * perimenopause is the *years before* the last period, when the cycle is still
 * happening but less predictably, and menopause is defined by a full year without
 * a period.
 *
 * ---------------------------------------------------------------------------
 * NO ENTRY HERE PREDICTS THE READER'S STAGE
 * ---------------------------------------------------------------------------
 * "Am I perimenopausal?" is a clinical question and would be refused by the
 * diagnosis guardrail. These entries describe the stages, what commonly happens
 * in them, and what a clinician looks at — they never place the reader inside a
 * stage, because PMSify has no data that could support that.
 */
export const LIFE_STAGE_ENTRIES: readonly KnowledgeEntry[] = [
  {
    id: 'menopauseStages',
    domain: 'lifeStages',
    answerKey: 'menopauseStages.answer',
    strong: [
      'what is menopause', 'what is menopause age', 'what is the difference between menopause and perimenopause',
      'when does menopause start', 'what happens during menopause',
      'what does menopause do to your body', 'at what age do periods stop',
      'what are the stages of menopause', 'how long does menopause last',
      'what is premature menopause', 'what is early menopause',
      'मेनोपॉज़ क्या है', 'रजोनिवृत्ति क्या है', 'मेनोपॉज़ की उम्र',
      'ಮೆನೋಪಾಸ್ ಏನು', 'ರಜೋನಿವೃತ್ತಿ ಏನು',
    ],
    weak: [
      'menopause', 'menopausal', 'menopause age', 'change of life',
      'मेनोपॉज़', 'रजोनिवृत्ति', 'ಮೆನೋಪಾಸ್', 'ರಜೋನಿವೃತ್ತಿ',
    ],
  },
  {
    id: 'perimenopause',
    domain: 'lifeStages',
    answerKey: 'perimenopause.answer',
    detailKey: 'perimenopause.detail',
    careKey: 'perimenopause.care',
    warningKey: 'perimenopause.warning',
    strong: [
      'what is perimenopause', 'what is the perimenopause stage', 'perimenopause meaning',
      'what happens in perimenopause', 'why are my periods irregular in my forties',
      'why has my period changed in my forties', 'am i going through perimenopause',
      'can you still get pregnant in perimenopause', 'how long does perimenopause last',
      'perimenopause symptoms', 'what is the difference between perimenopause and menopause',
      'पेरिमेनोपॉज़ क्या है', 'रजोनिवृत्ति से पहले का चरण',
      'ಪೆರಿಮೆನೋಪಾಸ್ ಏನು',
    ],
    weak: [
      'perimenopause', 'peri menopause', 'perimenopausal',
      'पेरिमेनोपॉज़', 'ಪೆರಿಮೆನೋಪಾಸ್',
    ],
  },
  {
    id: 'hormonalContraceptives',
    domain: 'lifeStages',
    answerKey: 'hormonalContraceptives.answer',
    detailKey: 'hormonalContraceptives.detail',
    careKey: 'hormonalContraceptives.care',
    strong: [
      'why do periods stop on the pill', 'can the pill stop my period',
      'can an implant stop your period', 'is bleeding free birth control safe',
      'can i take the pill for acne', 'does the pill cause weight gain',
      'what happens to periods on hormonal contraception', 'can the pill hide a period problem',
      'पिल से पीरियड क्यों नहीं आता', 'गर्भनिरोधक गोली से पीरियड बंद',
      'ಗರ್ಭನಿರೋಧಕ ಗೋಳಿ ಮುಟ್ಟು ಏಕೆ ನಿಲ್ಲುತ್ತದೆ',
    ],
    weak: [
      'on the pill', 'hormonal contraception', 'hormonal', 'birth control pill',
      'स्टॉक', 'गोली', 'ಗೋಳಿ', 'ಹಾರ್ಮೋನ್',
    ],
  },
];