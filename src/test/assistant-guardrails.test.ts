import { describe, it, expect } from 'vitest';
import {
  CRISIS_RESOURCES,
  GUARDRAIL_SEVERITY,
  evaluateGuardrails,
  isRefusal,
} from '../lib/assistant/guardrails';

describe('crisis always escalates', () => {
  it('escalates a direct statement of self-harm', () => {
    const decision = evaluateGuardrails('I want to kill myself');
    expect(decision.outcome).toBe('escalate');
    expect(decision.reasonKey).toBe('guardrails.crisis');
    expect(decision.intent).toBe('crisis');
  });

  it('escalates the same message in Hindi and Kannada', () => {
    expect(evaluateGuardrails('मैं आत्महत्या करना चाहती हूँ').outcome).toBe('escalate');
    expect(evaluateGuardrails('ನಾನು ಆತ್ಮಹತ್ಯೆ ಮಾಡಲು ಬಯಸುತ್ತೇನೆ').outcome).toBe('escalate');
  });

  it('escalates even when the message also looks like a normal question', () => {
    expect(evaluateGuardrails('my cramps are bad and i am harming myself').outcome).toBe(
      'escalate'
    );
  });

  it('escalates on the raw text even when handed a misleading intent', () => {
    // Defence in depth: the guardrail re-scans rather than trusting the caller.
    const decision = evaluateGuardrails('I want to die', 'education');
    expect(decision.outcome).toBe('escalate');
    expect(decision.intent).toBe('crisis');
  });

  it('ships reachable crisis resources', () => {
    expect(CRISIS_RESOURCES.length).toBeGreaterThan(0);
    for (const resource of CRISIS_RESOURCES) {
      expect(resource.value).toMatch(/^[0-9-]+$/);
      expect(resource.labelKey.startsWith('resources.')).toBe(true);
    }
    expect(CRISIS_RESOURCES.map((r) => r.value)).toContain('112');
  });
});

describe('medication, diagnosis and out-of-scope are refusals', () => {
  it.each([
    ['should I take iron tablets', 'guardrails.medication'],
    ['do I have PCOS', 'guardrails.diagnosis'],
    ['what is the weather today', 'guardrails.outOfScope'],
  ])('refuses %j', (text, reasonKey) => {
    const decision = evaluateGuardrails(text);
    expect(decision.outcome).toBe('refuse');
    expect(decision.reasonKey).toBe(reasonKey);
  });

  it('flags all three as refusals', () => {
    expect(isRefusal(evaluateGuardrails('take a tablet'))).toBe(true);
    expect(isRefusal(evaluateGuardrails('do I have PCOS'))).toBe(true);
  });
});

describe('ordinary questions are allowed', () => {
  it.each([
    'hello',
    'what is the fertile window',
    'summarise my data',
    'why do I get cramps',
    'when is my next period',
  ])('allows %j', (text) => {
    const decision = evaluateGuardrails(text);
    expect(decision.outcome).toBe('allow');
    expect(decision.reasonKey).toBe('guardrails.allow');
    expect(isRefusal(decision)).toBe(false);
  });

  it('allows an educational question about a condition', () => {
    expect(evaluateGuardrails('what is PCOS').outcome).toBe('allow');
  });
});

describe('severity ordering', () => {
  it('ranks allow below refuse below escalate', () => {
    expect(GUARDRAIL_SEVERITY.allow).toBeLessThan(GUARDRAIL_SEVERITY.refuse);
    expect(GUARDRAIL_SEVERITY.refuse).toBeLessThan(GUARDRAIL_SEVERITY.escalate);
  });
});

describe('determinism', () => {
  it('returns an identical decision for identical input', () => {
    const text = 'I want to die, also should I take a tablet';
    const first = evaluateGuardrails(text);
    for (let i = 0; i < 25; i += 1) {
      expect(evaluateGuardrails(text)).toEqual(first);
    }
  });

  it('agrees with the classifier when no intent is supplied', () => {
    for (const text of ['do I have PCOS', 'what is PCOS', 'hello', 'take a tablet']) {
      expect(evaluateGuardrails(text).intent).toBe(evaluateGuardrails(text).intent);
    }
  });
});
