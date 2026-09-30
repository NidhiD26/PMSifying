import type { KnowledgeEntry } from '../types';

/**
 * Myths.
 *
 * ---------------------------------------------------------------------------
 * WHY A QUESTION THAT IS *WRONG* STILL GETS A REAL ANSWER
 * ---------------------------------------------------------------------------
 * "Is period blood dirty?" is not a request to be told the belief is silly. It
 * is usually one of three things: a worry about being touched by someone who
 * would not touch period blood, a worry about being leak-prone, or a worry that
 * blood carries waste. A dismissive answer loses all three.
 *
 * So each entry here leads with the corrected fact as a *fact about the body*,
 * not as a correction of the reader. The reader gets to decide what they think
 * about the belief; what they do not get to do is leave believing something
 * medically untrue.
 *
 * ---------------------------------------------------------------------------
 * WHY THE `myths` DOMAIN IS CHECKED BEFORE EDUCATION RETRIEVAL
 * ---------------------------------------------------------------------------
 * A myth question almost always shares vocabulary with a real article — "period
 * blood dirty" matches the menstrual-cycle articles on every word except the
 * important one. So the myth entry has to be decided from the question's own
 * vocabulary, with the article attached as a citation afterwards. Otherwise the
 * retrieval layer answers the myth question and leaves the myth standing.
 */
export const MYTH_ENTRIES: readonly KnowledgeEntry[] = [
  {
    id: 'periodBlood',
    domain: 'myths',
    answerKey: 'periodBlood.answer',
    detailKey: 'periodBlood.detail',
    articles: ['cyclePhases'],
    strong: [
      'is period blood dirty', 'is period blood unhygienic', 'is period blood toxic',
      'is period blood poisonous', 'why is period blood brown', 'why is period blood dark',
      'is period blood supposed to be bright red', 'does period blood smell bad',
      'is period blood less blood', 'is period blood waste',
      'क्या पीरियड का खून गंदा होता है', 'पीरियड का खून जहरीला है',
      'ಮುಟ್ಟಿನ ರಕ್ತ ಕೊಳೆಯಾಗಿದೆಯೇ', 'ಮುಟ್ಟಿನ ರಕ್ತ ಕೊಳೆಯೇ',
    ],
    weak: [
      'period blood', 'dirty blood', 'unhygienic blood',
      'पीरियड का खून', 'मासिक धर्म का रक्त', 'ಮುಟ್ಟಿನ ರಕ್ತ',
    ],
  },
  {
    id: 'tamponMyths',
    domain: 'myths',
    answerKey: 'tamponMyths.answer',
    detailKey: 'tamponMyths.detail',
    strong: [
      'do tampons have toxins', 'do tampons contain toxins', 'do tampons give you toxic shock',
      'is a tampon full of bacteria', 'why was tampons banned',
      'are tampons less safe than pads', 'how often should i change a tampon',
      'tampons leak why',
      'टैम्पून में विषैले पदार्थ होते हैं', 'टैम्पून खतरनाक है',
      'ಟ್ಯಾಂಪನ್ ವಿಷ ಇದೆಯೇ',
    ],
    weak: [
      'tampon', 'tampons', 'toxic shock', 'टैम्पून', 'ಟ್ಯಾಂಪನ್',
    ],
  },
  {
    id: 'virginityMyth',
    domain: 'myths',
    answerKey: 'virginityMyth.answer',
    detailKey: 'virginityMyth.detail',
    articles: ['whenToSeeDoctor'],
    strong: [
      'can you lose your virginity', 'does sex change your body forever',
      'does having sex ruin you', 'can you tell if someone has had sex',
      'is there a proof of virginity', 'is the hymen proof of virginity',
      'do tampons prove you have had sex', 'does bleeding mean it is the first time',
      'क्या सेक्स से शरीर बदल जाता है', 'क्या यौन संबंध से वर्जिनिटी जाती है',
      'ಕನ್ನಡಿ ಕಳೆದುಕೊಳ್ಳುತ್ತದೆಯೇ',
    ],
    weak: [
      'virginity', 'virgin', 'used to be', 'first time',
      'वर्जिनिटी', 'कंचन', 'ಕನ್ನಡಿ',
    ],
  },
  {
    id: 'sharkMyth',
    domain: 'myths',
    answerKey: 'sharkMyth.answer',
    strong: [
      'does period blood attract sharks', 'do sharks come when you are on your period',
      'are sharks attracted to periods',
      'क्या पीरियड में शार्क आते हैं', 'क्या खून से शार्क आते हैं',
      'ಹುಲ್ಲು ರಕ್ತ ಸಮುದ್ರದ ಮೀನು ಆಗುತ್ತದೆಯೇ',
    ],
    weak: ['shark', 'sharks', 'मगरमच्छ', 'ಮೀನು'],
  },
  {
    id: 'exerciseMyth',
    domain: 'myths',
    answerKey: 'exerciseMyth.answer',
    detailKey: 'exerciseMyth.detail',
    articles: ['sleepStressCycle'],
    strong: [
      'does exercise stop your period', 'does running stop periods',
      'can too much exercise cause a missed period',
      'does gym stop periods', 'does exercising during your period make it worse',
      'should i exercise during my period', 'can i exercise on my period',
      'क्या व्यायाम से पीरियड रुकता है', 'जिम से पीरियड बंद होता है',
      'ವ್ಯಾಯಾಮದಿಂದ ಮುಟ್ಟು ನಿಂತುವರೆಯೇ',
    ],
    weak: [
      'exercise', 'running', 'gym', 'workout', 'training', 'sport',
      'व्यायाम', 'दौड़ना', 'ಜಿಮ್', 'ವ್ಯಾಯಾಮ',
    ],
  },
  {
    id: 'firstTimeMyth',
    domain: 'myths',
    answerKey: 'firstTimeMyth.answer',
    detailKey: 'firstTimeMyth.detail',
    articles: ['whenToSeeDoctor'],
    strong: [
      'is sex supposed to hurt the first time', 'will it hurt the first time',
      'does bleeding mean my first time was rough', 'should there be blood the first time',
      'is pain normal the first time', 'why does it hurt every time',
      'क्या पहली बार सेक्स में दर्द होना चाहिए', 'पहली बार में दर्द होता है क्या',
      'ಮೊದಲ ಬಾರಿ ಸೆಕ್ಸ್ ನೋವಾಗುತ್ತದೆಯೇ',
    ],
    weak: [
      'first time', 'every time', 'should hurt', 'rough',
      'पहली बार', 'दर्द', 'ಮೊದಲ ಬಾರಿ',
    ],
  },
];