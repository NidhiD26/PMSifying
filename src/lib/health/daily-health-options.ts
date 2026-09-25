export interface SymptomOption {
  id: string;
  i18nKey: string;
}

export interface MoodOption {
  id: string;
  i18nKey: string;
}

export const SYMPTOM_OPTIONS: SymptomOption[] = [
  { id: 'cramps', i18nKey: 'symptomCramps' },
  { id: 'headache', i18nKey: 'symptomHeadache' },
  { id: 'bloating', i18nKey: 'symptomBloating' },
  { id: 'breastTenderness', i18nKey: 'symptomBreastTenderness' },
  { id: 'fatigue', i18nKey: 'symptomFatigue' },
  { id: 'nausea', i18nKey: 'symptomNausea' },
  { id: 'backPain', i18nKey: 'symptomBackPain' },
  { id: 'acne', i18nKey: 'symptomAcne' },
  { id: 'cravings', i18nKey: 'symptomCravings' },
  { id: 'moodChanges', i18nKey: 'symptomMoodChanges' },
];

export const MOOD_OPTIONS: MoodOption[] = [
  { id: 'calm', i18nKey: 'moodCalm' },
  { id: 'happy', i18nKey: 'moodHappy' },
  { id: 'energetic', i18nKey: 'moodEnergetic' },
  { id: 'anxious', i18nKey: 'moodAnxious' },
  { id: 'irritable', i18nKey: 'moodIrritable' },
  { id: 'low', i18nKey: 'moodLow' },
];

export const PAIN_LABELS: { value: number; i18nKey: string }[] = [
  { value: 0, i18nKey: 'painNone' },
  { value: 1, i18nKey: 'painVeryMild' },
  { value: 2, i18nKey: 'painMild' },
  { value: 3, i18nKey: 'painMildModerate' },
  { value: 4, i18nKey: 'painModerate' },
  { value: 5, i18nKey: 'painModerateSevere' },
  { value: 6, i18nKey: 'painModerateSevere' },
  { value: 7, i18nKey: 'painSevere' },
  { value: 8, i18nKey: 'painSevere' },
  { value: 9, i18nKey: 'painVerySevere' },
  { value: 10, i18nKey: 'painWorstPossible' },
];

export const MOOD_INTENSITIES: { value: 1 | 2 | 3 | 4 | 5; i18nKey: string }[] = [
  { value: 1, i18nKey: 'intensityLow' },
  { value: 2, i18nKey: 'intensityMild' },
  { value: 3, i18nKey: 'intensityModerate' },
  { value: 4, i18nKey: 'intensityHigh' },
  { value: 5, i18nKey: 'intensityVeryHigh' },
];
