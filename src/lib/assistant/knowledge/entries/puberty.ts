import type { KnowledgeEntry } from '../types';

/**
 * Puberty and first cycles.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS DOMAIN EXISTS IN A PMS TRACKER
 * ---------------------------------------------------------------------------
 * PMSify asks for a cycle start date, and the reader may be twelve, may be
 * fifteen, or may be forty and have just started tracking for the first time.
 * Every one of those readers is somewhere the product's own cycle assumptions do
 * not fit, and they are exactly the readers who most need a straight answer
 * about what is normal and what is worth mentioning to an adult or a doctor.
 *
 * ---------------------------------------------------------------------------
 * THE TWO THINGS THESE ANSWERS MUST NOT DO
 * ---------------------------------------------------------------------------
 *
 * 1. They must not create an expectation of a schedule. The whole reason a
 *    first-years cycle is described as irregular is that it is *normal* to be,
 *    and a reader who has been handed a fixed chart will think something is
 *    wrong when their body is not.
 * 2. They must not become a way to bypass the guardrails. A teenager asking
 *    "do I have PCOS" is still a diagnosis question and is still refused, then
 *    pointed at a doctor and at the article. What the entry adds is the plain
 *    education around the refusal, not an opening around it.
 */
export const PUBERTY_ENTRIES: readonly KnowledgeEntry[] = [
  {
    id: 'puberty',
    domain: 'puberty',
    answerKey: 'puberty.answer',
    detailKey: 'puberty.detail',
    strong: [
      'what is puberty', 'what happens during puberty', 'what is going on in my body',
      'why is my body changing', 'what is normal during puberty',
      'why am i changing so fast', 'how long does puberty take',
      'किशोरावस्था क्या है', 'प्यूबर्टी क्या होती है', 'शरीर में बदलाव क्यों',
      'ಬಾಲ್ಯ ಏನು', 'ಹುಲ್ಲು ಬರುವ ಕಾಲ ಏನು',
    ],
    weak: [
      'puberty', 'pubertal', 'adolescence', 'teenage body', 'growing',
      'किशोरावस्था', 'किशोर', 'ಬಾಲ್ಯ', 'ಹುಲ್ಲು',
    ],
  },
  {
    id: 'firstPeriod',
    domain: 'puberty',
    answerKey: 'firstPeriod.answer',
    detailKey: 'firstPeriod.detail',
    warningKey: 'firstPeriod.warning',
    strong: [
      'what is a first period', 'what happens when you get your first period',
      'i just got my first period', 'my first period came what now',
      'what is menarche', 'what age do girls start periods',
      'how do i know my period is starting', 'what does a first period feel like',
      'i am twelve and i just started bleeding', 'what happens to your body after your first period',
      'पहला पीरियड क्या होता है', 'पहला पीरियड आने पर क्या करें', 'मेनार्क क्या है',
      'ಮೊದಲ ಮುಟ್ಟು ಏನು', 'ಮೊದಲ ಮುಟ್ಟು ಬಂದರೆ',
    ],
    weak: [
      'first period', 'first time period', 'menarche', 'period just started',
      'पहला पीरियड', 'मेनार्क', 'ಮೊದಲ ಮುಟ್ಟು', 'ಮೆನಾರ್ಕ್',
    ],
  },
  {
    id: 'irregularFirstCycles',
    domain: 'puberty',
    answerKey: 'irregularFirstCycles.answer',
    detailKey: 'irregularFirstCycles.detail',
    careKey: 'irregularFirstCycles.care',
    strong: [
      'why are my periods irregular as a teenager', 'why are my periods irregular at first',
      'are irregular periods normal at first', 'is it normal for periods to be irregular when they start',
      'why is my cycle irregular while i am young', 'how often do periods come when they first start',
      'can periods be irregular for years', 'when should irregular periods at puberty be checked',
      'किशोरावस्था में पीरियड अनियमित क्यों', 'क्या शुरुआत में अनियमित पीरियड सामान्य है',
      'ಬಾಲ್ಯದಲ್ಲಿ ಮುಟ್ಟು ಅಸಮಂಗತ ಏಕೆ',
    ],
    weak: [
      'irregular at first', 'irregular while young', 'irregular as a teenager',
      'young and irregular', 'अनियमित', 'ಅಸಮಂಗತ',
    ],
  },
];