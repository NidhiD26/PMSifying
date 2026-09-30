import type { KnowledgeEntry } from '../types';

/**
 * Pregnancy, and the parts of it people are most anxious about.
 *
 * ---------------------------------------------------------------------------
 * `pregnancyDuringPeriod` IS THE ENTRY THAT MOST NEEDED WRITING
 * ---------------------------------------------------------------------------
 * "Can you get pregnant during your period?" is asked constantly and gets two
 * bad answers in equal numbers: a flat "no", which is false, and a flat "yes",
 * which frightens people unnecessarily. The truth is that it is *possible* and
 * usually unlikely, and the reason matters more than the verdict — ovulation
 * usually lands about two weeks before the next period, but cycle length varies
 * and ovulation timing does too, so a short or irregular cycle can put the
 * fertile window somewhere the reader does not expect it.
 *
 * So this entry says: possible, usually unlikely, here is why, and here is what
 * to do if a cycle is irregular. It does not say "you cannot get pregnant", and
 * it does not hand out a number, because the answer genuinely depends on where
 * ovulation happened in *this* cycle — which is data this assistant does not have
 * and must not invent.
 */
export const PREGNANCY_ENTRIES: readonly KnowledgeEntry[] = [
  {
    id: 'pregnancyDuringPeriod',
    domain: 'pregnancy',
    answerKey: 'pregnancyDuringPeriod.answer',
    detailKey: 'pregnancyDuringPeriod.detail',
    careKey: 'pregnancyDuringPeriod.care',
    articles: ['fertileWindow'],
    strong: [
      'can you get pregnant during your period', 'can i get pregnant on my period',
      'can you get pregnant while on your period', 'can i get pregnant while bleeding',
      'can you get pregnant when you have your period', 'is it safe to have sex during your period',
      'can i get pregnant during spotting', 'is pregnancy possible during my period',
      'क्या पीरियड में गर्भवती हो सकती हूँ', 'पीरियड के दौरान गर्भधारण संभव है',
      'ಮುಟ್ಟಿನಲ್ಲಿ ಗರ್ಭಿಣಿಯಾಗಬಹುದೇ', 'ಮುಟ್ಟಿನ ಸಮಯದಲ್ಲಿ ಗರ್ಭಾಧಾನ ಸಾಧ್ಯವೇ',
    ],
    weak: [
      'get pregnant', 'pregnant', 'pregnancy', 'conceive', 'conceiving',
      'during my period', 'while on my period', 'during bleeding',
      'गर्भवती', 'गर्भाधान', 'ಗರ್ಭಾಧಾನ', 'ಗರ್ಭಿಣಿ',
    ],
  },
  {
    id: 'pregnancyTest',
    domain: 'pregnancy',
    answerKey: 'pregnancyTest.answer',
    detailKey: 'pregnancyTest.detail',
    strong: [
      'when can i take a pregnancy test', 'how early can a pregnancy test detect',
      'how does a pregnancy test work', 'what is a home pregnancy test',
      'can a pregnancy test be wrong', 'why is my pregnancy test negative',
      'false negative pregnancy test', 'when should i take a pregnancy test',
      'should i take a pregnancy test', 'missed period should i take a test',
      'गर्भवती होने की जांच कब करें', 'प्रेगनेंसी टेस्ट कब करें', 'टेस्ट नकारात्मक है फिर भी',
      'ಗರ್ಭಿಣಿಯಾಗಿದೆ ಎಂದು ಪರೀಕ್ಷೆ', 'ಗರ್ಭಾಧಾನ ಪರೀಕ್ಷೆ ಯಾವಾಗ',
    ],
    weak: [
      'pregnancy test', 'pregnancy tests', 'test negative', 'test positive', 'hpt',
      'प्रेगनेंसी टेस्ट', 'गर्भवती टेस्ट', 'ಗರ್ಭಾಧಾನ ಪರೀಕ್ಷೆ',
    ],
  },
  {
    id: 'implantation',
    domain: 'pregnancy',
    answerKey: 'implantation.answer',
    strong: [
      'what is implantation', 'when does implantation happen', 'what is implantation bleeding',
      'does implantation cause bleeding', 'is there bleeding when a baby implants',
      'how soon does implantation happen', 'when do you feel implantation',
      'रोपण क्या है', 'इम्प्लांटेशन कब होता है', 'रोपण रक्तस्राव',
      'ಅಳವಳಿಕೆ ಏನು', 'ಎಂಬ್ರಿಯೋ ಇಮ್ಪ್ಲಾಂಟೇಷನ್',
    ],
    weak: ['implantation', 'implant', 'रोपण', 'ಅಳವಳಿಕೆ'],
  },
  {
    id: 'miscarriage',
    domain: 'pregnancy',
    answerKey: 'miscarriage.answer',
    detailKey: 'miscarriage.detail',
    careKey: 'miscarriage.care',
    warningKey: 'miscarriage.warning',
    strong: [
      'what is a miscarriage', 'what causes a miscarriage', 'what are the signs of a miscarriage',
      'am i having a miscarriage', 'how common are miscarriages', 'miscarriage at how many weeks',
      'does stress cause a miscarriage', 'can i have a miscarriage because i was stressed',
      'what happens after a miscarriage', 'when can i try again after a miscarriage',
      'गर्भपात क्या है', 'गर्भपात के कारण', 'मिसकैरेज क्या है',
      'ಮಿಸ್‌ಕ್ಯಾರ್ಯೇಜ್ ಏನು', 'ಗರ್ಭಪಾತ',
    ],
    weak: [
      'miscarriage', 'miscarriages', 'lost a pregnancy', 'pregnancy loss',
      'गर्भपात', 'मिसकैरेज', 'ಮಿಸ್‌ಕ್ಯಾರ್ಯೇಜ್',
    ],
  },
  {
    id: 'ectopicPregnancy',
    domain: 'pregnancy',
    answerKey: 'ectopicPregnancy.answer',
    warningKey: 'ectopicPregnancy.warning',
    careKey: 'ectopicPregnancy.care',
    strong: [
      'what is an ectopic pregnancy', 'what are the signs of an ectopic pregnancy',
      'is my pregnancy ectopic', 'one sided pain in early pregnancy',
      'pain on one side while pregnant', 'ectopic pregnancy after ivf',
      'एक्टोपिक प्रेगnancy क्या है', 'गर्भावस्था में एकतरफा दर्द',
      'ಎಕ್ಟೋಪಿಕ್ ಗರ್ಭಾಧಾನ ಏನು',
    ],
    weak: ['ectopic', 'ectopic pregnancy', 'एक्टोपिक', 'ಎಕ್ಟೋಪಿಕ್'],
  },
  {
    id: 'postpartum',
    domain: 'pregnancy',
    answerKey: 'postpartum.answer',
    detailKey: 'postpartum.detail',
    careKey: 'postpartum.care',
    strong: [
      'when does your period come back after birth', 'can you get pregnant while breastfeeding',
      'is it safe to get pregnant while breastfeeding', 'what is the postpartum period',
      'how long after birth can i get pregnant', 'bleeding after birth',
      'how long does bleeding last after delivery', 'when can i use contraception after birth',
      'प्रसव के बाद पीरियड कब आएगा', 'स्तनपान करते हुए गर्भवती हो सकती हूँ',
      'ಹೆಣ್ಣೆಯ ನಂತರ ಮುಟ್ಟು ಯಾವಾಗ', 'ಹಗುರಬೇಲೆ ಮಾಡುವಾಗ ಗರ್ಭಿಣಿ',
    ],
    weak: [
      'postpartum', 'after birth', 'after delivery', 'breastfeeding', 'postnatal',
      'स्तनपान', 'प्रसवोत्तर', 'ಹೆಣ್ಣೆಯ ನಂತರ',
    ],
  },
];