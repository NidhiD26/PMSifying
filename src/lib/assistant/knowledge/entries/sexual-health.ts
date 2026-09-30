import type { KnowledgeEntry } from '../types';

/**
 * Sexual health: consent, contraception, barrier protection and infections.
 *
 * ---------------------------------------------------------------------------
 * WHY CONSENT GETS ITS OWN ENTRY AND WHY IT IS WORDED CAREFULLY
 * ---------------------------------------------------------------------------
 * `consent` is on the brief's required list, which is a strong hint about the
 * audience. It is also the one answer in this whole module where being vague is
 * harmful in both directions: a reader who asks what consent is is often asking
 * because something happened that did not feel like agreement, and an answer
 * that says "consent means both people agree" and stops there teaches them that
 * agreeing once means agreeing always, or that not saying no is the same as
 * saying yes.
 *
 * So the answer states three things the legal definition alone does not:
 * agreement has to be there in the moment, it has to be freely given, and it can
 * be taken back at any time. It also names that consent can be affected by fear,
 * pressure, alcohol, or someone older — without asserting what the reader's
 * situation was, which is not this module's job and would be a diagnosis.
 *
 * The legal framing (age of consent, what counts as assault) is deliberately
 * left out of the answer and pointed at instead: those differ by place and need a
 * real source, not a chat reply. A refusal-adjacent answer that got the law wrong
 * would be worse than one that says who to ask.
 */
export const SEXUAL_HEALTH_ENTRIES: readonly KnowledgeEntry[] = [
  {
    id: 'consent',
    domain: 'sexualHealth',
    answerKey: 'consent.answer',
    detailKey: 'consent.detail',
    careKey: 'consent.care',
    strong: [
      'what is consent', 'what does consent mean', 'what counts as consent',
      'is consent a yes', 'can consent be withdrawn', 'can you take back consent',
      'what if i said yes but did not want it', 'did i consent if i did not say no',
      'is silence consent', 'what is not consent',
      'what is the age of consent', 'what is consent if i was drunk',
      'सहमति क्या है', 'सहमति का क्या अर्थ है', 'क्या सहमति वापस ली जा सकती है',
      'ಸಮ್ಮತಿ ಏನು', 'ಸಮ್ಮತಿ ಎಂದರೇನು',
    ],
    weak: [
      'consent', 'say yes', 'say no', 'agreed', 'permission',
      'सहमति', 'सहमती', 'ಸಮ್ಮತಿ',
    ],
  },
  {
    id: 'contraception',
    domain: 'sexualHealth',
    answerKey: 'contraception.answer',
    detailKey: 'contraception.detail',
    careKey: 'contraception.care',
    strong: [
      'what is contraception', 'what is a contraceptive', 'what are the contraceptive options',
      'what are my birth control options', 'what is birth control',
      'which contraceptive should i use', 'how do i avoid getting pregnant',
      'how does contraception work', 'what is a contraceptive pill',
      'what is the pill', 'what is an implant', 'what is an iud', 'what is a coil',
      'गर्भनिरोधन क्या है', 'गर्भनिरोधक क्या हैं', 'बर्थ कंट्रोल क्या है',
      'ಗರ್ಭನಿರೋಧ ಏನು', 'ಸಂತತಿ ನಿಯಂತ್ರಣ',
    ],
    weak: [
      'contraception', 'contraceptive', 'birth control', 'family planning', 'pills',
      'गर्भनिरोधन', 'गर्भनिरोधक', 'ಗರ್ಭನಿರೋಧ',
    ],
  },
  {
    id: 'condoms',
    domain: 'sexualHealth',
    answerKey: 'condoms.answer',
    detailKey: 'condoms.detail',
    strong: [
      'how do condoms work', 'what is a condom for', 'do condoms prevent pregnancy',
      'do condoms prevent stis', 'how to use a condom', 'how do i put on a condom',
      'is a condom protection against sti', 'condom broke what now',
      'what if the condom broke',
      'कंडोम क्या करता है', 'कंडोम से गर्भधारण रोक सकते हैं',
      'ಕಾಂಡಮ್ ಏನು ತಡೆಯುತ್ತದೆ',
    ],
    weak: [
      'condom', 'condoms', 'male condom', 'female condom', 'barrier protection',
      'कंडोम', 'ಕಾಂಡಮ್',
    ],
  },
  {
    id: 'sti',
    domain: 'sexualHealth',
    answerKey: 'sti.answer',
    detailKey: 'sti.detail',
    warningKey: 'sti.warning',
    careKey: 'sti.care',
    strong: [
      'what are stis', 'what is an sti', 'what is std', 'what is an std',
      'which stis are there', 'how do you get an sti', 'how is an sti spread',
      'can you get an sti from a toilet seat', 'do stis show symptoms',
      'how soon should i get tested for an sti', 'sti test',
      'क्या एसटीआई है', 'यौन रोग क्या हैं', 'एसटीडी क्या है',
      'ಲೈಂಗಿಕ ರೋಗ ಏನು', 'ಎಸ್‌ಟಿಐ',
    ],
    weak: [
      'sti', 'stis', 'std', 'stds', 'sexually transmitted', 'infection risk',
      'एसटीआई', 'एसटीडी', 'ಎಸ್‌ಟಿಐ',
    ],
  },
  {
    id: 'painDuringSex',
    domain: 'sexualHealth',
    answerKey: 'painDuringSex.answer',
    detailKey: 'painDuringSex.detail',
    warningKey: 'painDuringSex.warning',
    careKey: 'painDuringSex.care',
    strong: [
      'why does sex hurt', 'why is sex painful for me', 'why does intercourse hurt',
      'pain during sex', 'painful sex', 'burning during sex', 'why does it hurt when we have sex',
      'sex always hurts', 'is pain during sex normal', 'deep pain during sex',
      'सेक्स में दर्द क्यों', 'सेक्स के दौरान दर्द', 'यौन संबंध में दर्द',
      'ಲೈಂಗಿಕ ಸಂಬಂಧದಲ್ಲಿ ನೋವು', 'ಸೆಕ್ಸ್ ನೋವು ಏಕೆ',
    ],
    weak: [
      'pain during sex', 'painful intercourse', 'sex hurts', 'dyspareunia',
      'दर्द', 'ನೋವು',
    ],
  },
  {
    id: 'lubrication',
    domain: 'sexualHealth',
    answerKey: 'lubrication.answer',
    strong: [
      'why am i dry', 'what is vaginal dryness', 'why is there not enough lubrication',
      'what is lube', 'what is lubricant used for', 'do i need lubricant',
      'why is my vagina dry during sex', 'what is arousal',
      'योनि में सूखापन क्यों', 'लुब्रिकेंट क्या है',
      'ಯೋನಿ ಒಣಗುವುದು ಏಕೆ', 'ಲುಬ್ರಿಕೆಂಟ್ ಏನು',
    ],
    weak: [
      'dryness', 'dry', 'lube', 'lubricant', 'lubrication', 'arousal',
      'सूखापन', 'स्नेहक', 'ಒಣಗುವಿಕೆ',
    ],
  },
];