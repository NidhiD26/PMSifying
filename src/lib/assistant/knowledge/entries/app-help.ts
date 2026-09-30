import type { KnowledgeEntry } from '../types';

/**
 * AREA 1 — PMSify application knowledge.
 *
 * ---------------------------------------------------------------------------
 * EVERY CLAIM IN HERE WAS CHECKED AGAINST THE SHIPPED APP
 * ---------------------------------------------------------------------------
 * These answers describe PMSify itself, so an invented feature is not a small
 * inaccuracy — it sends somebody looking for a button that does not exist. Each
 * `appPath` below is a route that is in `nav-config.ts`, and each answer was
 * written from the shipped strings and components for that screen.
 *
 * Two existing answers were wrong and are corrected here rather than carried
 * forward:
 *
 *   - Predicted next period, fertile window, ovulation and cycle day live on
 *     **Home**, not the Calendar. The Calendar deliberately shows recorded facts
 *     only; its own subtitle says "recorded facts only (no prediction AI)".
 *   - The language selector is in the **app header**, not in Settings.
 *
 * ---------------------------------------------------------------------------
 * WHY APP QUESTIONS CANNOT BE ANSWERED FROM EDUCATION
 * ---------------------------------------------------------------------------
 * An article about menstrual cycles cannot say where a button is, and the old
 * code already made that point — so these entries carry no `articles` and the
 * composer emits no citations for them. Citing a health article under a
 * "where do I tap" answer is noise, and it trains the reader to ignore
 * citations.
 *
 * The `id` of each entry doubles as the `AppHelpTopic`, which is what
 * `appHelpTopicFor` returns. Reusing the ids keeps one table instead of two
 * that have to agree.
 */

export type AppHelpTopic =
  | 'log'
  | 'daily'
  | 'predictions'
  | 'cycleDay'
  | 'calendar'
  | 'insights'
  | 'reports'
  | 'exportData'
  | 'eraseData'
  | 'privacy'
  | 'secretChat'
  | 'reminders'
  | 'settings'
  | 'healthcare'
  | 'education'
  | 'assistantScope';

/**
 * Where each topic lives in the interface.
 *
 * Locale-agnostic on purpose: `withLocale` applies the reader's language at
 * render time, so the view has one place to prefix rather than a key that
 * already has one baked in.
 */
export const APP_HELP_PATHS = {
  log: '/health',
  daily: '/health',
  predictions: '/',
  cycleDay: '/',
  calendar: '/calendar',
  insights: '/insights',
  reports: '/reports',
  exportData: '/reports',
  eraseData: '/settings',
  privacy: '/privacy',
  secretChat: '/secret-chat',
  reminders: '/reminders',
  settings: '/settings',
  healthcare: '/health-camps',
  education: '/learn',
  assistantScope: '/ai-assistant',
} as const satisfies Record<AppHelpTopic, string>;

export const APP_HELP_ENTRIES: readonly KnowledgeEntry[] = [
  {
    id: 'log',
    domain: 'appHelp',
    answerKey: 'log.answer',
    detailKey: 'log.detail',
    strong: [
      'how do i log my period', 'how do i log a period', 'how to log my period',
      'how to log a period', 'how do i record my period', 'how do i record a period',
      'how to record my period', 'log my period', 'log a period', 'record my period',
      'where do i log', 'where can i log', 'add a period', 'add my period',
      'how do i track my period', 'how to track my period', 'start tracking',
      'period start date', 'flow intensity', 'how do i enter my period',
      'मेरा पीरियड कैसे दर्ज करें', 'पीरियड कैसे दर्ज करें', 'पीरियड दर्ज करें कैसे',
      'ಮನೆ ಮುಟ್ಟು ಹೇಗೆ ದಾಖಲಿಸುವುದು', 'ಮುಟ್ಟು ದಾಖಲಿಸುವುದು ಹೇಗೆ',
    ],
    weak: [
      'log period', 'period record', 'period records', 'log', 'record', 'tracking',
      'period', 'start date', 'flow', 'पीरियड', 'दर्ज', 'रिकॉर्ड', 'ಮುಟ್ಟು', 'ದಾಖಲಿಸು',
    ],
  },
  {
    id: 'daily',
    domain: 'appHelp',
    answerKey: 'daily.answer',
    detailKey: 'daily.detail',
    strong: [
      'how do i add symptoms', 'how do i add a symptom', 'how to add symptoms',
      'where do i log symptoms', 'daily health log', 'daily log', 'health log',
      'how do i record my mood', 'how do i track my mood', 'log my symptoms',
      'record my symptoms', 'how do i log sleep', 'how do i log water',
      'how do i log pain', 'how to record daily', 'daily check in', 'daily check-in',
      'daily symptoms', 'daily entry', 'daily entries',
      'रोज़ का लॉग', 'दैनिक लॉग', 'लक्षण कैसे जोड़ें', 'स्वास्थ्य लॉग',
      'ದೈನಂದಿನ ದಾಖಲೆ', 'ಲಕ್ಷಣ ಹೇಗೆ ಸೇರಿಸುವುದು', 'ಆರೋಗ್ಯ ದಾಖಲೆ',
    ],
    weak: [
      'symptoms', 'symptom', 'mood', 'sleep', 'water', 'hydration', 'pain', 'notes',
      'daily', 'log', 'लक्षण', 'नींद', 'दर्द', 'मनोदशा', 'ಲಕ್ಷಣ', 'ನಿದ್ದೆ', 'ನೀರು', 'ಹುಸುವಿಕೆ',
    ],
  },
  {
    id: 'predictions',
    domain: 'appHelp',
    answerKey: 'predictions.answer',
    detailKey: 'predictions.detail',
    strong: [
      'where can i see my predicted dates', 'where can i see my predictions',
      'where do i see my predictions', 'where are my predictions',
      'where can i see predicted', 'predicted dates', 'predicted dates',
      'how do i see my predicted dates', 'how can i see my predicted dates',
      'where do i see my predicted dates', 'how do i see predicted dates',
      'estimated dates', 'where can i see my next period dates',
      'where can i see my fertile window', 'where is my fertile window',
      'where can i see ovulation', 'when will my next period be',
      'when will my period start', 'how does pmsify predict',
      'how does the prediction work', 'how are predictions calculated',
      'अनुमान कहाँ देखें', 'अनुमित तारीखें कहाँ', 'सहायक गर्भाधान कहाँ',
      'ಅಂಡೋತ್ಪತ್ತಿ ಎಲ್ಲಿ', 'ಸಹಜ ಗರ್ಭಾಧಾನ ಎಲ್ಲಿ',
    ],
    weak: [
      'prediction', 'predictions', 'predicted', 'estimate', 'forecast', 'ovulation',
      'fertile window', 'next period', 'calendar', 'home', 'अनुमान', 'कैलेंडर',
      'ಅಂಡೋತ್ಪತ್ತಿ', 'ಕ್ಯಾಲೆಂಡರ್',
    ],
  },
  {
    id: 'cycleDay',
    domain: 'appHelp',
    answerKey: 'cycleDay.answer',
    strong: [
      'what does cycle day mean', 'what is a cycle day', 'what does my cycle day mean',
      'what does day mean on my cycle', 'what does the day number mean',
      'cycle day meaning', 'how is cycle day calculated', 'what is day 1 of my cycle',
      'cycle day क्या है', 'चक्र दिन क्या होता है',
      'ಚಕ್ರ ದಿನ ಎಂದರೇನು',
    ],
    weak: [
      'cycle day', 'day number', 'day count', 'चक्र दिन', 'ಚಕ್ರ ದಿನ',
    ],
  },
  {
    id: 'calendar',
    domain: 'appHelp',
    answerKey: 'calendar.answer',
    strong: [
      'how does the calendar work', 'how do i use the calendar', 'what does the calendar show',
      'what is on my calendar', 'what does the calendar display',
      'how do i open the calendar', 'can i log from the calendar',
      'calendar kaise kaam karta hai', 'कैलेंडर कैसे काम करता है',
      'ಕ್ಯಾಲೆಂಡರ್ ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ',
    ],
    weak: ['calendar', 'monthly view', 'कैलेंडर', 'ಕ್ಯಾಲೆಂಡರ್'],
  },
  {
    id: 'insights',
    domain: 'appHelp',
    answerKey: 'insights.answer',
    strong: [
      'where are my insights', 'where do i see my insights', 'where can i find insights',
      'how do i see insights', 'where do i see my trends', 'how do i see trends',
      'how do i see my trends', 'how can i see my trends',
      'what do insights show', 'what are insights', 'where is my insight screen',
      'insights kahan hain', 'इनसाइट कहाँ हैं', 'ट्रेंड कहाँ देखें',
      'ಇನ್ಸೈಟ್ ಎಲ್ಲಿ', 'ವರದಿ ಎಲ್ಲಿ',
    ],
    weak: [
      'insight', 'insights', 'trends', 'trend', 'patterns', 'summary', 'report',
      'इनसाइट', 'ट्रेंड', 'ಇನ್ಸೈಟ್', 'ವರದಿ',
    ],
  },
  {
    id: 'reports',
    domain: 'appHelp',
    answerKey: 'reports.answer',
    strong: [
      'where is the report', 'how do i see my report', 'how do i get a report',
      'what is in the report', 'how do i generate a report', 'health report',
      'my report', 'reports screen', 'report kaise nikale',
      'रिपोर्ट कैसे निकालें', 'ವರದಿ ಹೇಗೆ ತೆಗೆಯುವುದು',
    ],
    weak: ['report', 'reports', 'summary page', 'रिपोर्ट', 'ವರದಿ'],
  },
  {
    id: 'exportData',
    domain: 'appHelp',
    answerKey: 'exportData.answer',
    detailKey: 'exportData.detail',
    strong: [
      'how do i export my report', 'how do i export', 'how to export',
      'where can i export', 'export my data', 'export all my data',
      'export pdf', 'export csv', 'export json', 'can i download my data',
      'how do i download my data', 'how do i take my data out',
      'export kaise kare', 'रिपोर्ट एक्सपोर्ट कैसे करें', 'डेटा एक्सपोर्ट कैसे करें',
      'ಡೇಟಾ ರಫ್ತು ಹೇಗೆ', 'ಎಕ್ಸ್ಪೋರ್ಟ್ ಹೇಗೆ',
    ],
    weak: [
      'export', 'download', 'pdf', 'csv', 'json', 'backup', 'copy my data',
      'एक्सपोर्ट', 'डाउनलोड', 'ಎಕ್ಸ್ಪೋರ್ಟ್',
    ],
  },
  {
    id: 'eraseData',
    domain: 'appHelp',
    answerKey: 'eraseData.answer',
    strong: [
      'how do i delete everything', 'how do i delete all my data',
      'how do i erase my data', 'how do i wipe my data', 'erase all local data',
      'delete my account', 'how do i delete my account', 'remove all my records',
      'how do i reset pmsify', 'start over', 'delete everything from this device',
      'सब कुछ कैसे डिलीट करें', 'डेटा मिटाना है', 'ಎಲ್ಲಾ ಡೇಟಾ ಅಳಿಸಿ',
    ],
    weak: [
      'erase', 'wipe', 'delete all', 'clear my data', 'reset', 'start over',
      'मिटाना', 'डिलीट', 'ಅಳಿಸಿ', 'ತೆಗೆದುಹಾಕಿ',
    ],
  },
  {
    id: 'privacy',
    domain: 'appHelp',
    answerKey: 'privacy.answer',
    detailKey: 'privacy.detail',
    strong: [
      'how does the privacy feature work', 'how does privacy work', 'what does privacy do',
      'is my data private', 'is my data uploaded', 'do you upload my data',
      'where is my data stored', 'is my data stored on my phone',
      'is my data sent anywhere', 'does pmsify have cloud sync',
      'does pmsify track me', 'do you have analytics', 'privacy charter',
      'is my health data safe', 'is my data secure',
      'डेटा निजी है', 'डेटा कहाँ सेव होता है', 'गोपनीयता कैसे काम करती है',
      'ನನ್ನ ಡೇಟಾ ಖಾಸಗಿ ಇದೆಯೇ', 'ಡೇಟಾ ಎಲ್ಲಿ ಸಂಗ್ರಹವಾಗುತ್ತದೆ',
    ],
    weak: [
      'privacy', 'private', 'stored', 'storage', 'upload', 'sync', 'telemetry',
      'गोपनीयता', 'निजी', 'स्टोर', 'ಗೌರ್ತಮತೆ', 'ಸಂಗ್ರಹ',
    ],
  },
  {
    id: 'secretChat',
    domain: 'appHelp',
    answerKey: 'secretChat.answer',
    detailKey: 'secretChat.detail',
    strong: [
      'what is secretchat', 'what is secret chat', 'how does secretchat work',
      'is secretchat anonymous', 'can secretchat see my health data',
      'does secretchat show my name', 'who can see my posts',
      'can i post anonymously', 'what is the difference between secretchat and the tracker',
      'does secretchat need internet', 'why can i not post in secretchat',
      'सेक्रेटचैट क्या है', 'सेक्रेट चैट क्या है',
      'ಸೆಕ್ರೆಟ್‌ಚಾಟ್ ಏನು',
    ],
    weak: [
      'secretchat', 'secret chat', 'community', 'anonymous', 'posts', 'feed',
      'सेक्रेटचैट', 'ಸೆಕ್ರೆಟ್‌ಚಾಟ್',
    ],
  },
  {
    id: 'reminders',
    domain: 'appHelp',
    answerKey: 'reminders.answer',
    detailKey: 'reminders.detail',
    strong: [
      'how do i set a reminder', 'how do i set reminders', 'how do reminders work',
      'can i get a notification', 'how do i turn on notifications',
      'why am i not getting reminders', 'will reminders work if the app is closed',
      'रिमाइंडर कैसे सेट करें', 'नोटिफिकेशन कैसे चालू करें',
      'ಜ್ಞಾಪನೆ ಹೇಗೆ ಹೊಂದಿಸುವುದು', 'ರಿಮೈಂಡರ್ ಹೇಗೆ',
    ],
    weak: [
      'reminder', 'reminders', 'notification', 'notifications', 'alert', 'nudge',
      'रिमाइंडर', 'नोटिफिकेशन', 'ರಿಮೈಂಡರ್', 'ಅಧಿಸೂಚನೆ',
    ],
  },
  {
    id: 'settings',
    domain: 'appHelp',
    answerKey: 'settings.answer',
    strong: [
      'where are the settings', 'how do i open settings', 'what can i change in settings',
      'how do i set a pin', 'how do i change my pin', 'how do i remove my pin',
      'i forgot my pin', 'can i recover my pin', 'what is the pin for',
      'is the pin secure',
      // The language selector is a header control, not a Settings row, so the
      // answer points at the header. It is answered by this topic because there
      // is nowhere else in the app for it to go, and a Settings link is at least
      // the same neighbourhood rather than a dead end.
      'how do i change the language', 'how do i change my language',
      'how to switch language', 'how do i change language to hindi',
      'how do i change language to kannada', 'can i use this app in hindi',
      'can i use this app in kannada', 'where is the language option',
      'सेटिंग कहाँ है', 'पिन कैसे सेट करें', 'पिन भूल गई', 'भाषा कैसे बदलें',
      'ಸೆಟ್ಟಿಂಗ್ ಎಲ್ಲಿ', 'ಪಿನ್ ಹೇಗೆ', 'ಭಾಷೆ ಹೇಗೆ ಬದಲಿಸುವುದು',
    ],
    weak: [
      'settings', 'setting', 'pin', 'password', 'lock', 'security',
      'language', 'languages', 'hindi', 'kannada', 'translate',
      'सेटिंग', 'पिन', 'भाषा', 'हिंदी', 'सक्षेत्र', 'ಸೆಟ್ಟಿಂಗ್', 'ಪಿನ್', 'ಭಾಷೆ', 'ಹಿಂದಿ',
    ],
  },
  {
    id: 'healthcare',
    domain: 'appHelp',
    answerKey: 'healthcare.answer',
    detailKey: 'healthcare.detail',
    strong: [
      'what is the asha portal', 'what is the doctor portal', 'what is a health camp',
      'what are the healthcare portals', 'how do i use the asha portal',
      'can i use the doctor portal', 'who is an asha', 'what is asha',
      'what is the healthcare ecosystem', 'do i need to sign in for healthcare',
      'why do i have to sign in again', 'asha portal kya hai',
      'एशा पोर्टल क्या है', 'डॉक्टर पोर्टल क्या है', 'ಆಶಾ ಪೋರ್ಟಲ್ ಏನು',
    ],
    weak: [
      'asha', 'doctor portal', 'health camp', 'health camps', 'clinician', 'health worker',
      'healthcare', 'portal', 'एशा', 'शिविर', 'ಆಶಾ', 'ಆರೋಗ್ಯ ಶಿವಿರ',
    ],
  },
  {
    id: 'education',
    domain: 'appHelp',
    answerKey: 'education.answer',
    strong: [
      'what is the education section', 'what is the education library',
      'where are the articles', 'how do i browse articles', 'is there a library',
      'what can i read here', 'does pmsify have articles', 'education library',
      'एजुकेशन सेक्शन क्या है', 'लेख कहाँ हैं', 'ಶಿಕ್ಷಣಾರ್ಹ ಲೈಬ್ರರಿ',
    ],
    weak: [
      'education', 'library', 'articles', 'article', 'reading', 'learn',
      'एजुकेशन', 'लेख', 'ಶಿಕ್ಷಣೆ', 'ಲೇಖ',
    ],
  },
  {
    id: 'assistantScope',
    domain: 'appHelp',
    answerKey: 'assistantScope.answer',
    detailKey: 'assistantScope.detail',
    strong: [
      'what can pmsify tell me about my cycle', 'what can this app tell me about my cycle',
      'what do you know about me', 'what data do you have about me',
      'what can you tell me about my data', 'what can the assistant see',
      'what information do you have access to', 'do you see my notes',
      'can you read my health log', 'what should i be tracking',
      'what can pmsify tell me', 'what data does pmsify collect',
      'आप मेरे बारे में क्या जानते हैं', 'ऐप मेरे डेटा के बारे में क्या बता सकता है',
      'ನನ್ನ ಡೇಟಾ ಬಗ್ಗೆ ಏನು ಹೇಳುತ್ತೀರಿ',
    ],
    weak: [
      'what can you tell me', 'my data', 'my records', 'access', 'see my data',
      'मेरा डेटा', 'ನನ್ನ ಡೇಟಾ',
    ],
  },
];