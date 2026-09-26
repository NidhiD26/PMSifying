import { describe, it, expect } from 'vitest';
import {
  classifyIntent,
  detectCrisis,
  detectMedicationRequest,
  detectOutOfScope,
  detectPersonalDiagnosisClaim,
} from '../lib/assistant/intent';
import type { AssistantIntent } from '../lib/assistant/types';

/**
 * The classifier is the first thing standing between a typed message and a
 * reply, so these tests are mostly about two things: that safety signals win,
 * and that the rules behave the same in all three languages.
 */

function expectAll(text: string, expected: AssistantIntent) {
  expect(classifyIntent(text)).toBe(expected);
}

describe('crisis detection outranks everything', () => {
  it.each([
    'I want to kill myself',
    'I have been thinking about suicide',
    'my mood is not worth living',
    'i think i will self harm tonight',
  ])('escalates %j', (text) => {
    expectAll(text, 'crisis');
    expect(detectCrisis(text)).toBe(true);
  });

  // The point of the multilingual table: the same question asked in Hindi or
  // Kannada must not slip past the rule.
  it('escalates the same message written in Hindi', () => {
    const text = 'मैं आत्महत्या करना चाहती हूँ';
    expectAll(text, 'crisis');
    expect(detectCrisis(text)).toBe(true);
  });

  it('escalates the same message written in Kannada', () => {
    const text = 'ನಾನು ಆತ್ಮಹತ್ಯೆ ಮಾಡಲು ಬಯಸುತ್ತೇನೆ';
    expectAll(text, 'crisis');
    expect(detectCrisis(text)).toBe(true);
  });

  it('escalates even when the message is also a medication question', () => {
    // Precedence matters more than specificity: the medication rule is a
    // refusal, but a crisis needs a human, not a refusal.
    expectAll('should I take tablets, I want to die', 'crisis');
  });

  it('escalates even when the message is also a prediction question', () => {
    expectAll('when is my next period, I feel like harming myself', 'crisis');
  });
});

describe('medication requests are refused', () => {
  it.each([
    'should I take iron tablets',
    'what dose of paracetamol is safe',
    'is this antibiotic safe to take',
    'can I increase my dose',
    'which medicine should I buy',
  ])('refuses %j', (text) => {
    expectAll(text, 'medication');
    expect(detectMedicationRequest(text)).toBe(true);
  });

  it('refuses a medication question written in Hindi', () => {
    const text = 'मुझे कौन सी दवा लेनी चाहिए';
    expectAll(text, 'medication');
    expect(detectMedicationRequest(text)).toBe(true);
  });

  it('refuses a medication question written in Kannada', () => {
    const text = 'ಯಾವ ಔಷಧಿ ತೆಗೆದುಕೊಳ್ಳಬೇಕು';
    expectAll(text, 'medication');
  });

  it('does not fire on a non-medication mention of health', () => {
    expect(detectMedicationRequest('my sleep has been bad this week')).toBe(false);
  });
});

describe('a condition name alone is education, not diagnosis', () => {
  it.each([
    'what is PCOS',
    'tell me about endometriosis',
    'explain thyroid health',
    'what are the signs of anaemia',
  ])('treats %j as education', (text) => {
    expectAll(text, 'education');
    expect(detectPersonalDiagnosisClaim(text)).toBe(false);
  });

  it.each([
    'do I have PCOS',
    'could I have endometriosis',
    'I think I have a thyroid problem',
    'my periods are irregular, could I have PCOS',
  ])('refuses %j as a personal claim', (text) => {
    expectAll(text, 'diagnosis');
    expect(detectPersonalDiagnosisClaim(text)).toBe(true);
  });

  it('refuses an explicit diagnosis request', () => {
    expectAll('I need a diagnosis for my symptoms', 'diagnosis');
  });

  it('refuses a pregnancy question', () => {
    expectAll('am I pregnant', 'diagnosis');
    expectAll('should I take a pregnancy test', 'diagnosis');
  });

  it('refuses a Hindi personal claim', () => {
    expect(detectPersonalDiagnosisClaim('क्या मुझे पीसीओएस है')).toBe(true);
  });

  it('refuses a Kannada personal claim', () => {
    expect(detectPersonalDiagnosisClaim('ನನಗೆ ಪಿಸಿಒಎಸ್ ಇದೆಯೆ')).toBe(true);
  });

  it('does not treat a bare Kannada condition name as a personal claim', () => {
    expect(detectPersonalDiagnosisClaim('ಪಿಸಿಒಎಸ್ ಎಂದರೇನು')).toBe(false);
  });
});

describe('out of scope', () => {
  it.each([
    'what is the weather today',
    'tell me a joke',
    'write code in python',
    'what is the share price of tata motors',
  ])('refuses %j', (text) => {
    expectAll(text, 'outOfScope');
    expect(detectOutOfScope(text)).toBe(true);
  });

  it('refuses out-of-scope questions written in Hindi', () => {
    expect(detectOutOfScope('आज का मौसम कैसा है')).toBe(true);
  });
});

describe('prediction questions', () => {
  it.each([
    'when is my next period',
    'am I late',
    'my period is delayed',
    'when is my fertile window',
    'my ovulation date please',
  ])('routes %j to prediction', (text) => {
    expectAll(text, 'prediction');
  });

  it('matches whole words, so "late" does not fire on "later"', () => {
    expectAll('I will call you later', 'unknown');
  });

  it('routes a Hindi prediction question', () => {
    expectAll('मेरा अगला पीरियड कब आएगा', 'prediction');
  });

  it('routes a Kannada prediction question', () => {
    expectAll('ನನ್ನ ಮುಂದಿನ ಮುಟ್ಟು ಯಾವಾಗ', 'prediction');
  });
});

describe('personal summary needs an explicit self-reference', () => {
  it.each([
    'summarise my data',
    'what does my data show',
    'tell me about my symptoms',
    'how am I doing',
  ])('routes %j to personalSummary', (text) => {
    expectAll(text, 'personalSummary');
  });

  it('treats a general question with "I" as education, not a summary', () => {
    expectAll('why do I get cramps', 'education');
  });

  it('does not mistake "how am I doing" for a diagnostic claim', () => {
    expect(detectPersonalDiagnosisClaim('how am I doing')).toBe(false);
  });
});

describe('greetings and unknowns', () => {
  it.each(['hi', 'hello', 'hey there', 'namaste', 'नमस्ते', 'ನಮಸ್ಕಾರ'])(
    'routes %j to greeting',
    (text) => {
      expectAll(text, 'greeting');
    }
  );

  it('prefers education over greeting when both are present', () => {
    expectAll('hi, what is PMS', 'education');
  });

  it('returns unknown for text with no recognisable intent', () => {
    expectAll('asdfghjkl', 'unknown');
  });

  it.each(['', '   ', '!!!', '...'])('returns unknown for %j', (text) => {
    expectAll(text, 'unknown');
  });
});

describe('crisis terms tolerate English inflection', () => {
  it.each([
    ['harming myself', 'harm myself'],
    ['killing myself', 'kill myself'],
    ['hurting myself', 'hurt myself'],
    ['cutting myself', 'cut myself'],
  ])('escalates %j via the %j rule', (text) => {
    expectAll(text, 'crisis');
  });
});

describe('determinism', () => {
  it('returns the same intent for the same input every time', () => {
    const text = 'what is PCOS and when is my next period';
    const first = classifyIntent(text);
    for (let i = 0; i < 25; i += 1) {
      expect(classifyIntent(text)).toBe(first);
    }
  });

  it('ignores case and surrounding punctuation', () => {
    expectAll('WHAT IS PCOS???', 'education');
    expectAll('  Do I Have PCOS  ', 'diagnosis');
  });
});
