const fs = require("fs");
const path = require("path");

const localesDir = path.join(process.cwd(), "public", "locales");

const files = {
  en: path.join(localesDir, "en.json"),
  hi: path.join(localesDir, "hi.json"),
  kn: path.join(localesDir, "kn.json"),
};

function readLocale(locale) {
  return JSON.parse(fs.readFileSync(files[locale], "utf8"));
}

function writeLocale(locale, data) {
  fs.writeFileSync(
    files[locale],
    JSON.stringify(data, null, 2) + "\n",
    "utf8"
  );
}

/*
 * ============================================================
 * ENGLISH
 * ============================================================
 */

const enHealthcare = {
  badge: "Healthcare Portal",
  footerNote:
    "Healthcare access is role-based. Patient information is handled confidentially.",
  ashaDescription:
    "Manage assigned households, members, cases, referrals and follow-ups.",
  doctorDescription:
    "Review referred cases, clinical information, prescriptions and follow-ups.",
  healthCampsDescription:
    "View, manage and participate in community health camps.",

  status: {
    OPEN: "Open",
    REFERRED: "Referred",
    UNDER_REVIEW: "Under review",
    FOLLOW_UP: "Follow-up",
    CLOSED: "Closed",
    PENDING: "Pending",
    ACCEPTED: "Accepted",
    IN_REVIEW: "In review",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    MISSED: "Missed",
    DRAFT: "Draft",
    PUBLISHED: "Published",
    REGISTERED: "Registered",
    ATTENDED: "Attended",
    ABSENT: "Absent",
    ROUTINE: "Routine",
    URGENT: "Urgent",
    MILD: "Mild",
    MODERATE: "Moderate",
    SEVERE: "Severe",
  },

  errors: {
    invalid_request: "Invalid request",
    unauthenticated: "You must sign in to continue",
    forbidden: "You do not have permission to perform this action",
    not_found: "The requested information was not found",
    conflict: "This action conflicts with the current state",
    not_configured: "The healthcare portal is not configured",
    upstream_unavailable:
      "The healthcare service is temporarily unavailable",
    rate_limited: "Too many requests. Please try again later",
    unknown: "Something went wrong",
  },

  roles: {
    ADMIN: "Administrator",
    ASHA: "ASHA Worker",
    DOCTOR: "Doctor",
  },

  actions: {
    back: "Back",
    column: "Column",
    open: "Open",
    save: "Save",
  },

  dashboard: {
    ashaTitle: "ASHA Dashboard",
    doctorTitle: "Doctor Dashboard",
    assignedHouseholds: "Assigned households",
    campActivity: "Camp activity",
    campsThisMonth: "Camps this month",
    casesUnderReview: "Cases under review",
    followUpList: "Follow-up list",
    followUpsDue: "Follow-ups due",
    householdMembers: "Household members",
    openCases: "Open cases",
    pendingReferralList: "Pending referrals",
    pendingReferrals: "Pending referrals",
    recentCases: "Recent cases",
    upcomingFollowUps: "Upcoming follow-ups",
    viewAll: "View all",
  },

  households: {
    title: "Households",
    code: "Household code",
    members: "Members",
    openCases: "Open cases",
    empty: {
      title: "No households found",
      body: "There are no households assigned to you yet.",
    },
  },

  household: {
    assignedWorker: "Assigned worker",
    noWorker: "No worker assigned",
    openCases: "Open cases",
    emptyMembers: {
      title: "No members",
      body: "No members have been added to this household yet.",
    },
  },

  members: {
    title: "Members",
    age: "Age",
    ageUnknown: "Age unknown",
    relation: "Relation",
    relationUnknown: "Relation unknown",
    note: "Note",
    sex: "Sex",
    sexUnknown: "Sex unknown",
    years: "years",
    countOne: "member",
    countMany: "members",
    sexValues: {
      FEMALE: "Female",
      MALE: "Male",
      OTHER: "Other",
    },
  },

  cases: {
    title: "Cases",
    household: "Household",
    member: "Member",
    opened: "Opened",
    priority: "Priority",
    status: "Status",
    summary: "Summary",
    empty: {
      title: "No cases",
      body: "There are no cases to display.",
    },
  },

  caseReview: {
    title: "Case review",
    member: "Member",
    referralReason: "Referral reason",
    history: "History",
    observations: "Observations",
    clinicalNotes: "Clinical notes",
    prescription: "Prescription",
    followUps: "Follow-ups",
    emptyObservations: {
      title: "No observations",
    },
    emptyNotes: {
      title: "No clinical notes",
    },
    emptyPrescriptions: {
      title: "No prescriptions",
    },
    emptyFollowUps: {
      title: "No follow-ups",
    },
  },

  observations: {
    symptoms: "Symptoms",
    severity: "Severity",
    duration: "Duration",
    durationDays: "Duration in days",
    durationUnknown: "Duration unknown",
    notes: "Notes",
    recordedBy: "Recorded by",
    none: "No observations recorded",
  },

  clinicalNotes: {
    assessment: "Assessment",
    advice: "Advice",
    observations: "Observations",
    author: "Author",
    followUpOn: "Follow-up on",
  },

  prescriptions: {
    medicine: "Medicine",
    dosage: "Dosage",
    frequency: "Frequency",
    duration: "Duration",
    instructions: "Instructions",
    prescriber: "Prescriber",
  },

  referrals: {
    title: "Referrals",
    referredTo: "Referred to",
    raised: "Raised",
    reason: "Reason",
    priority: "Priority",
    status: "Status",
    unassigned: "Unassigned",
    noDoctors: {
      title: "No doctors on the roster",
      body: "There are currently no doctors available for referral.",
    },
    empty: {
      title: "No referrals",
      body: "There are no referrals to display.",
    },
    action: {
      accept: "Accept",
      cancel: "Cancel",
      complete: "Complete",
      startReview: "Start review",
    },
  },

  followUps: {
    title: "Follow-ups",
    assignedTo: "Assigned to",
    due: "Due",
    completedAt: "Completed at",
    notes: "Notes",
    empty: {
      title: "No follow-ups",
      body: "There are no follow-ups to display.",
    },
    action: {
      complete: "Mark complete",
      cancel: "Cancel",
      markMissed: "Mark missed",
    },
  },

  camps: {
    title: "Health camps",
    subtitle: "Community health camps and registrations",
    date: "Date",
    time: "Time",
    location: "Location",
    capacity: "Capacity",
    spotsLeft: "Spots left",
    statusChanges: "Status changes",
    open: "Open",
    full: "Full",
    registered: "Registered",
    attended: "Attended",
    register: "Register",
    registered_action: "Registered",
    cancelRegistration: "Cancel registration",
    cancelCamp: "Cancel camp",
    completeCamp: "Complete camp",
    publish: "Publish camp",
    empty: {
      title: "No health camps",
      body: "There are no health camps to display.",
    },
    roster: {
      title: "Camp roster",
      attendee: "Attendee",
      attendance: "Attendance",
      markAttended: "Mark attended",
      markAbsent: "Mark absent",
      empty: {
        title: "Nobody registered yet",
        body: "There are no registrations for this camp yet.",
      },
    },
  },

  forms: {
    name: "Name",
    address: "Address",
    choose: "Choose",
    optional: "Optional",
    newHousehold: "New household",
    editHousehold: "Edit household",
    newMember: "New member",
    newObservation: "New observation",
    newNote: "New clinical note",
    newPrescription: "New prescription",
    newReferral: "New referral",
    newFollowUp: "New follow-up",
    symptomsHint: "Describe the symptoms",
    invalidSummary: "Please check the entered information.",
  },

  confidentialityNote:
    "Healthcare information is confidential and should only be accessed for authorized care purposes.",

  forbidden: {
    title: "Access restricted",
  },

  wrongRole: {
    title: "Wrong role",
    body: "Your account does not have access to this healthcare portal.",
    action: "Return to your portal",
  },

  notConfigured: {
    title: "The healthcare portal is not configured",
    body: "Healthcare services are not configured for this environment yet.",
  },

  loading: "Loading...",
};

/*
 * ============================================================
 * HINDI
 * ============================================================
 */

const hiHealthcare = {
  badge: "स्वास्थ्य सेवा पोर्टल",
  footerNote:
    "स्वास्थ्य सेवा तक पहुंच भूमिका के आधार पर नियंत्रित है। मरीज की जानकारी गोपनीय रखी जाती है।",
  ashaDescription:
    "सौंपे गए परिवारों, सदस्यों, मामलों, रेफरल और फॉलो-अप का प्रबंधन करें।",
  doctorDescription:
    "रेफर किए गए मामलों, चिकित्सकीय जानकारी, प्रिस्क्रिप्शन और फॉलो-अप की समीक्षा करें।",
  healthCampsDescription:
    "सामुदायिक स्वास्थ्य शिविर देखें, प्रबंधित करें और उनमें भाग लें।",

  status: {
    OPEN: "खुला",
    REFERRED: "रेफर किया गया",
    UNDER_REVIEW: "समीक्षा में",
    FOLLOW_UP: "फॉलो-अप",
    CLOSED: "बंद",
    PENDING: "लंबित",
    ACCEPTED: "स्वीकृत",
    IN_REVIEW: "समीक्षा में",
    COMPLETED: "पूरा हुआ",
    CANCELLED: "रद्द",
    MISSED: "छूट गया",
    DRAFT: "ड्राफ्ट",
    PUBLISHED: "प्रकाशित",
    REGISTERED: "पंजीकृत",
    ATTENDED: "उपस्थित",
    ABSENT: "अनुपस्थित",
    ROUTINE: "सामान्य",
    URGENT: "तत्काल",
    MILD: "हल्का",
    MODERATE: "मध्यम",
    SEVERE: "गंभीर",
  },

  errors: {
    invalid_request: "अमान्य अनुरोध",
    unauthenticated: "जारी रखने के लिए साइन इन करें",
    forbidden: "आपको यह कार्य करने की अनुमति नहीं है",
    not_found: "मांगी गई जानकारी नहीं मिली",
    conflict: "यह कार्य वर्तमान स्थिति से मेल नहीं खाता",
    not_configured: "स्वास्थ्य सेवा पोर्टल कॉन्फ़िगर नहीं किया गया है",
    upstream_unavailable:
      "स्वास्थ्य सेवा अभी अस्थायी रूप से उपलब्ध नहीं है",
    rate_limited: "बहुत अधिक अनुरोध किए गए हैं। बाद में फिर प्रयास करें",
    unknown: "कुछ गलत हो गया",
  },

  roles: {
    ADMIN: "प्रशासक",
    ASHA: "आशा कार्यकर्ता",
    DOCTOR: "डॉक्टर",
  },

  actions: {
    back: "वापस",
    column: "कॉलम",
    open: "खोलें",
    save: "सहेजें",
  },

  dashboard: {
    ashaTitle: "आशा डैशबोर्ड",
    doctorTitle: "डॉक्टर डैशबोर्ड",
    assignedHouseholds: "सौंपे गए परिवार",
    campActivity: "शिविर गतिविधि",
    campsThisMonth: "इस महीने के शिविर",
    casesUnderReview: "समीक्षा में मामले",
    followUpList: "फॉलो-अप सूची",
    followUpsDue: "लंबित फॉलो-अप",
    householdMembers: "परिवार के सदस्य",
    openCases: "खुले मामले",
    pendingReferralList: "लंबित रेफरल सूची",
    pendingReferrals: "लंबित रेफरल",
    recentCases: "हाल के मामले",
    upcomingFollowUps: "आगामी फॉलो-अप",
    viewAll: "सभी देखें",
  },

  households: {
    title: "परिवार",
    code: "परिवार कोड",
    members: "सदस्य",
    openCases: "खुले मामले",
    empty: {
      title: "कोई परिवार नहीं मिला",
      body: "अभी तक आपको कोई परिवार नहीं सौंपा गया है।",
    },
  },

  household: {
    assignedWorker: "सौंपा गया कार्यकर्ता",
    noWorker: "कोई कार्यकर्ता नहीं सौंपा गया",
    openCases: "खुले मामले",
    emptyMembers: {
      title: "कोई सदस्य नहीं",
      body: "इस परिवार में अभी तक कोई सदस्य नहीं जोड़ा गया है।",
    },
  },

  members: {
    title: "सदस्य",
    age: "उम्र",
    ageUnknown: "उम्र अज्ञात",
    relation: "संबंध",
    relationUnknown: "संबंध अज्ञात",
    note: "नोट",
    sex: "लिंग",
    sexUnknown: "लिंग अज्ञात",
    years: "वर्ष",
    countOne: "सदस्य",
    countMany: "सदस्य",
    sexValues: {
      FEMALE: "महिला",
      MALE: "पुरुष",
      OTHER: "अन्य",
    },
  },

  cases: {
    title: "मामले",
    household: "परिवार",
    member: "सदस्य",
    opened: "खोला गया",
    priority: "प्राथमिकता",
    status: "स्थिति",
    summary: "सारांश",
    empty: {
      title: "कोई मामला नहीं",
      body: "दिखाने के लिए कोई मामला नहीं है।",
    },
  },

  caseReview: {
    title: "मामले की समीक्षा",
    member: "सदस्य",
    referralReason: "रेफरल का कारण",
    history: "इतिहास",
    observations: "अवलोकन",
    clinicalNotes: "चिकित्सकीय नोट्स",
    prescription: "प्रिस्क्रिप्शन",
    followUps: "फॉलो-अप",
    emptyObservations: {
      title: "कोई अवलोकन नहीं",
    },
    emptyNotes: {
      title: "कोई चिकित्सकीय नोट नहीं",
    },
    emptyPrescriptions: {
      title: "कोई प्रिस्क्रिप्शन नहीं",
    },
    emptyFollowUps: {
      title: "कोई फॉलो-अप नहीं",
    },
  },

  observations: {
    symptoms: "लक्षण",
    severity: "गंभीरता",
    duration: "अवधि",
    durationDays: "अवधि (दिन)",
    durationUnknown: "अवधि अज्ञात",
    notes: "नोट्स",
    recordedBy: "दर्ज करने वाला",
    none: "कोई अवलोकन दर्ज नहीं है",
  },

  clinicalNotes: {
    assessment: "आकलन",
    advice: "सलाह",
    observations: "अवलोकन",
    author: "लेखक",
    followUpOn: "फॉलो-अप की तारीख",
  },

  prescriptions: {
    medicine: "दवा",
    dosage: "खुराक",
    frequency: "आवृत्ति",
    duration: "अवधि",
    instructions: "निर्देश",
    prescriber: "प्रिस्क्राइबर",
  },

  referrals: {
    title: "रेफरल",
    referredTo: "रेफर किया गया",
    raised: "बनाया गया",
    reason: "कारण",
    priority: "प्राथमिकता",
    status: "स्थिति",
    unassigned: "सौंपा नहीं गया",
    noDoctors: {
      title: "रोस्टर पर कोई डॉक्टर नहीं",
      body: "वर्तमान में रेफरल के लिए कोई डॉक्टर उपलब्ध नहीं है।",
    },
    empty: {
      title: "कोई रेफरल नहीं",
      body: "दिखाने के लिए कोई रेफरल नहीं है।",
    },
    action: {
      accept: "स्वीकार करें",
      cancel: "रद्द करें",
      complete: "पूरा करें",
      startReview: "समीक्षा शुरू करें",
    },
  },

  followUps: {
    title: "फॉलो-अप",
    assignedTo: "सौंपा गया",
    due: "देय तिथि",
    completedAt: "पूरा होने का समय",
    notes: "नोट्स",
    empty: {
      title: "कोई फॉलो-अप नहीं",
      body: "दिखाने के लिए कोई फॉलो-अप नहीं है।",
    },
    action: {
      complete: "पूरा हुआ चिह्नित करें",
      cancel: "रद्द करें",
      markMissed: "छूटा हुआ चिह्नित करें",
    },
  },

  camps: {
    title: "स्वास्थ्य शिविर",
    subtitle: "सामुदायिक स्वास्थ्य शिविर और पंजीकरण",
    date: "तारीख",
    time: "समय",
    location: "स्थान",
    capacity: "क्षमता",
    spotsLeft: "बची हुई जगह",
    statusChanges: "स्थिति परिवर्तन",
    open: "खुला",
    full: "भरा हुआ",
    registered: "पंजीकृत",
    attended: "उपस्थित",
    register: "पंजीकरण करें",
    registered_action: "पंजीकृत",
    cancelRegistration: "पंजीकरण रद्द करें",
    cancelCamp: "शिविर रद्द करें",
    completeCamp: "शिविर पूरा करें",
    publish: "शिविर प्रकाशित करें",
    empty: {
      title: "कोई स्वास्थ्य शिविर नहीं",
      body: "दिखाने के लिए कोई स्वास्थ्य शिविर नहीं है।",
    },
    roster: {
      title: "शिविर रोस्टर",
      attendee: "प्रतिभागी",
      attendance: "उपस्थिति",
      markAttended: "उपस्थित चिह्नित करें",
      markAbsent: "अनुपस्थित चिह्नित करें",
      empty: {
        title: "अभी किसी ने पंजीकरण नहीं किया",
        body: "इस शिविर के लिए अभी कोई पंजीकरण नहीं है।",
      },
    },
  },

  forms: {
    name: "नाम",
    address: "पता",
    choose: "चुनें",
    optional: "वैकल्पिक",
    newHousehold: "नया परिवार",
    editHousehold: "परिवार संपादित करें",
    newMember: "नया सदस्य",
    newObservation: "नया अवलोकन",
    newNote: "नया चिकित्सकीय नोट",
    newPrescription: "नया प्रिस्क्रिप्शन",
    newReferral: "नया रेफरल",
    newFollowUp: "नया फॉलो-अप",
    symptomsHint: "लक्षणों का विवरण दें",
    invalidSummary: "कृपया दर्ज की गई जानकारी जांचें",
  },

  confidentialityNote:
    "स्वास्थ्य सेवा की जानकारी गोपनीय है और इसका उपयोग केवल अधिकृत देखभाल के लिए किया जाना चाहिए।",

  forbidden: {
    title: "पहुंच प्रतिबंधित",
  },

  wrongRole: {
    title: "गलत भूमिका",
    body: "आपके खाते को इस स्वास्थ्य सेवा पोर्टल तक पहुंच नहीं है।",
    action: "अपने पोर्टल पर वापस जाएं",
  },

  notConfigured: {
    title: "स्वास्थ्य सेवा पोर्टल कॉन्फ़िगर नहीं किया गया है",
    body: "इस वातावरण में स्वास्थ्य सेवाएं अभी कॉन्फ़िगर नहीं की गई हैं।",
  },

  loading: "लोड हो रहा है...",
};

/*
 * ============================================================
 * KANNADA
 * ============================================================
 */

const knHealthcare = {
  badge: "ಆರೋಗ್ಯ ಸೇವಾ ಪೋರ್ಟಲ್",
  footerNote:
    "ಆರೋಗ್ಯ ಸೇವೆಗೆ ಪ್ರವೇಶವು ಪಾತ್ರದ ಆಧಾರದ ಮೇಲೆ ನಿಯಂತ್ರಿತವಾಗಿದೆ. ರೋಗಿಯ ಮಾಹಿತಿಯನ್ನು ಗೌಪ್ಯವಾಗಿ ನಿರ್ವಹಿಸಲಾಗುತ್ತದೆ.",
  ashaDescription:
    "ನಿಯೋಜಿಸಲಾದ ಕುಟುಂಬಗಳು, ಸದಸ್ಯರು, ಪ್ರಕರಣಗಳು, ರೆಫರಲ್‌ಗಳು ಮತ್ತು ಫಾಲೋ-ಅಪ್‌ಗಳನ್ನು ನಿರ್ವಹಿಸಿ.",
  doctorDescription:
    "ರೆಫರ್ ಮಾಡಲಾದ ಪ್ರಕರಣಗಳು, ವೈದ್ಯಕೀಯ ಮಾಹಿತಿ, ಪ್ರಿಸ್ಕ್ರಿಪ್ಶನ್‌ಗಳು ಮತ್ತು ಫಾಲೋ-ಅಪ್‌ಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.",
  healthCampsDescription:
    "ಸಮುದಾಯ ಆರೋಗ್ಯ ಶಿಬಿರಗಳನ್ನು ವೀಕ್ಷಿಸಿ, ನಿರ್ವಹಿಸಿ ಮತ್ತು ಭಾಗವಹಿಸಿ.",

  status: {
    OPEN: "ತೆರೆದಿದೆ",
    REFERRED: "ರೆಫರ್ ಮಾಡಲಾಗಿದೆ",
    UNDER_REVIEW: "ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ",
    FOLLOW_UP: "ಫಾಲೋ-ಅಪ್",
    CLOSED: "ಮುಚ್ಚಲಾಗಿದೆ",
    PENDING: "ಬಾಕಿಯಿದೆ",
    ACCEPTED: "ಸ್ವೀಕರಿಸಲಾಗಿದೆ",
    IN_REVIEW: "ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ",
    COMPLETED: "ಪೂರ್ಣಗೊಂಡಿದೆ",
    CANCELLED: "ರದ್ದಾಗಿದೆ",
    MISSED: "ತಪ್ಪಿಹೋಗಿದೆ",
    DRAFT: "ಕರಡು",
    PUBLISHED: "ಪ್ರಕಟಿಸಲಾಗಿದೆ",
    REGISTERED: "ನೋಂದಾಯಿಸಲಾಗಿದೆ",
    ATTENDED: "ಹಾಜರಾಗಿದ್ದಾರೆ",
    ABSENT: "ಗೈರುಹಾಜರಿ",
    ROUTINE: "ಸಾಮಾನ್ಯ",
    URGENT: "ತುರ್ತು",
    MILD: "ಸೌಮ್ಯ",
    MODERATE: "ಮಧ್ಯಮ",
    SEVERE: "ತೀವ್ರ",
  },

  errors: {
    invalid_request: "ಅಮಾನ್ಯ ವಿನಂತಿ",
    unauthenticated: "ಮುಂದುವರಿಯಲು ಸೈನ್ ಇನ್ ಮಾಡಿ",
    forbidden: "ಈ ಕಾರ್ಯವನ್ನು ಮಾಡಲು ನಿಮಗೆ ಅನುಮತಿ ಇಲ್ಲ",
    not_found: "ಕೋರಿದ ಮಾಹಿತಿ ಕಂಡುಬಂದಿಲ್ಲ",
    conflict: "ಈ ಕಾರ್ಯವು ಪ್ರಸ್ತುತ ಸ್ಥಿತಿಗೆ ಹೊಂದಿಕೆಯಾಗುವುದಿಲ್ಲ",
    not_configured: "ಆರೋಗ್ಯ ಸೇವಾ ಪೋರ್ಟಲ್ ಅನ್ನು ಕಾನ್ಫಿಗರ್ ಮಾಡಲಾಗಿಲ್ಲ",
    upstream_unavailable:
      "ಆರೋಗ್ಯ ಸೇವೆಯು ತಾತ್ಕಾಲಿಕವಾಗಿ ಲಭ್ಯವಿಲ್ಲ",
    rate_limited:
      "ಹೆಚ್ಚಿನ ಸಂಖ್ಯೆಯ ವಿನಂತಿಗಳು ಬಂದಿವೆ. ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ",
    unknown: "ಏನೋ ತಪ್ಪಾಗಿದೆ",
  },

  roles: {
    ADMIN: "ನಿರ್ವಾಹಕರು",
    ASHA: "ಆಶಾ ಕಾರ್ಯಕರ್ತೆ",
    DOCTOR: "ವೈದ್ಯರು",
  },

  actions: {
    back: "ಹಿಂದಕ್ಕೆ",
    column: "ಕಾಲಮ್",
    open: "ತೆರೆಯಿರಿ",
    save: "ಉಳಿಸಿ",
  },

  dashboard: {
    ashaTitle: "ಆಶಾ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
    doctorTitle: "ವೈದ್ಯರ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
    assignedHouseholds: "ನಿಯೋಜಿಸಲಾದ ಕುಟುಂಬಗಳು",
    campActivity: "ಶಿಬಿರ ಚಟುವಟಿಕೆ",
    campsThisMonth: "ಈ ತಿಂಗಳ ಶಿಬಿರಗಳು",
    casesUnderReview: "ಪರಿಶೀಲನೆಯಲ್ಲಿರುವ ಪ್ರಕರಣಗಳು",
    followUpList: "ಫಾಲೋ-ಅಪ್ ಪಟ್ಟಿ",
    followUpsDue: "ಬಾಕಿಯಿರುವ ಫಾಲೋ-ಅಪ್‌ಗಳು",
    householdMembers: "ಕುಟುಂಬದ ಸದಸ್ಯರು",
    openCases: "ತೆರೆದ ಪ್ರಕರಣಗಳು",
    pendingReferralList: "ಬಾಕಿಯಿರುವ ರೆಫರಲ್ ಪಟ್ಟಿ",
    pendingReferrals: "ಬಾಕಿಯಿರುವ ರೆಫರಲ್‌ಗಳು",
    recentCases: "ಇತ್ತೀಚಿನ ಪ್ರಕರಣಗಳು",
    upcomingFollowUps: "ಮುಂಬರುವ ಫಾಲೋ-ಅಪ್‌ಗಳು",
    viewAll: "ಎಲ್ಲವನ್ನೂ ವೀಕ್ಷಿಸಿ",
  },

  households: {
    title: "ಕುಟುಂಬಗಳು",
    code: "ಕುಟುಂಬ ಕೋಡ್",
    members: "ಸದಸ್ಯರು",
    openCases: "ತೆರೆದ ಪ್ರಕರಣಗಳು",
    empty: {
      title: "ಯಾವುದೇ ಕುಟುಂಬಗಳು ಕಂಡುಬಂದಿಲ್ಲ",
      body: "ಇನ್ನೂ ಯಾವುದೇ ಕುಟುಂಬಗಳನ್ನು ನಿಮಗೆ ನಿಯೋಜಿಸಲಾಗಿಲ್ಲ.",
    },
  },

  household: {
    assignedWorker: "ನಿಯೋಜಿಸಲಾದ ಕಾರ್ಯಕರ್ತರು",
    noWorker: "ಯಾವುದೇ ಕಾರ್ಯಕರ್ತರನ್ನು ನಿಯೋಜಿಸಲಾಗಿಲ್ಲ",
    openCases: "ತೆರೆದ ಪ್ರಕರಣಗಳು",
    emptyMembers: {
      title: "ಯಾವುದೇ ಸದಸ್ಯರಿಲ್ಲ",
      body: "ಈ ಕುಟುಂಬಕ್ಕೆ ಇನ್ನೂ ಯಾವುದೇ ಸದಸ್ಯರನ್ನು ಸೇರಿಸಲಾಗಿಲ್ಲ.",
    },
  },

  members: {
    title: "ಸದಸ್ಯರು",
    age: "ವಯಸ್ಸು",
    ageUnknown: "ವಯಸ್ಸು ತಿಳಿದಿಲ್ಲ",
    relation: "ಸಂಬಂಧ",
    relationUnknown: "ಸಂಬಂಧ ತಿಳಿದಿಲ್ಲ",
    note: "ಟಿಪ್ಪಣಿ",
    sex: "ಲಿಂಗ",
    sexUnknown: "ಲಿಂಗ ತಿಳಿದಿಲ್ಲ",
    years: "ವರ್ಷಗಳು",
    countOne: "ಸದಸ್ಯ",
    countMany: "ಸದಸ್ಯರು",
    sexValues: {
      FEMALE: "ಮಹಿಳೆ",
      MALE: "ಪುರುಷ",
      OTHER: "ಇತರೆ",
    },
  },

  cases: {
    title: "ಪ್ರಕರಣಗಳು",
    household: "ಕುಟುಂಬ",
    member: "ಸದಸ್ಯ",
    opened: "ತೆರೆದ ದಿನಾಂಕ",
    priority: "ಆದ್ಯತೆ",
    status: "ಸ್ಥಿತಿ",
    summary: "ಸಾರಾಂಶ",
    empty: {
      title: "ಯಾವುದೇ ಪ್ರಕರಣಗಳಿಲ್ಲ",
      body: "ತೋರಿಸಲು ಯಾವುದೇ ಪ್ರಕರಣಗಳಿಲ್ಲ.",
    },
  },

  caseReview: {
    title: "ಪ್ರಕರಣ ಪರಿಶೀಲನೆ",
    member: "ಸದಸ್ಯ",
    referralReason: "ರೆಫರಲ್ ಕಾರಣ",
    history: "ಇತಿಹಾಸ",
    observations: "ವೀಕ್ಷಣೆಗಳು",
    clinicalNotes: "ವೈದ್ಯಕೀಯ ಟಿಪ್ಪಣಿಗಳು",
    prescription: "ಪ್ರಿಸ್ಕ್ರಿಪ್ಶನ್",
    followUps: "ಫಾಲೋ-ಅಪ್‌ಗಳು",
    emptyObservations: {
      title: "ಯಾವುದೇ ವೀಕ್ಷಣೆಗಳಿಲ್ಲ",
    },
    emptyNotes: {
      title: "ಯಾವುದೇ ವೈದ್ಯಕೀಯ ಟಿಪ್ಪಣಿಗಳಿಲ್ಲ",
    },
    emptyPrescriptions: {
      title: "ಯಾವುದೇ ಪ್ರಿಸ್ಕ್ರಿಪ್ಶನ್‌ಗಳಿಲ್ಲ",
    },
    emptyFollowUps: {
      title: "ಯಾವುದೇ ಫಾಲೋ-ಅಪ್‌ಗಳಿಲ್ಲ",
    },
  },

  observations: {
    symptoms: "ಲಕ್ಷಣಗಳು",
    severity: "ತೀವ್ರತೆ",
    duration: "ಅವಧಿ",
    durationDays: "ಅವಧಿ (ದಿನಗಳು)",
    durationUnknown: "ಅವಧಿ ತಿಳಿದಿಲ್ಲ",
    notes: "ಟಿಪ್ಪಣಿಗಳು",
    recordedBy: "ದಾಖಲಿಸಿದವರು",
    none: "ಯಾವುದೇ ವೀಕ್ಷಣೆಗಳನ್ನು ದಾಖಲಿಸಲಾಗಿಲ್ಲ",
  },

  clinicalNotes: {
    assessment: "ಮೌಲ್ಯಮಾಪನ",
    advice: "ಸಲಹೆ",
    observations: "ವೀಕ್ಷಣೆಗಳು",
    author: "ಲೇಖಕರು",
    followUpOn: "ಫಾಲೋ-ಅಪ್ ದಿನಾಂಕ",
  },

  prescriptions: {
    medicine: "ಔಷಧಿ",
    dosage: "ಪ್ರಮಾಣ",
    frequency: "ಆವರ್ತನೆ",
    duration: "ಅವಧಿ",
    instructions: "ಸೂಚನೆಗಳು",
    prescriber: "ಪ್ರಿಸ್ಕ್ರೈಬರ್",
  },

  referrals: {
    title: "ರೆಫರಲ್‌ಗಳು",
    referredTo: "ರೆಫರ್ ಮಾಡಿದವರು",
    raised: "ರಚಿಸಿದ ದಿನಾಂಕ",
    reason: "ಕಾರಣ",
    priority: "ಆದ್ಯತೆ",
    status: "ಸ್ಥಿತಿ",
    unassigned: "ನಿಯೋಜಿಸಲಾಗಿಲ್ಲ",
    noDoctors: {
      title: "ರೋಸ್ಟರ್‌ನಲ್ಲಿ ಯಾವುದೇ ವೈದ್ಯರಿಲ್ಲ",
      body: "ಪ್ರಸ್ತುತ ರೆಫರಲ್‌ಗಾಗಿ ಯಾವುದೇ ವೈದ್ಯರು ಲಭ್ಯವಿಲ್ಲ.",
    },
    empty: {
      title: "ಯಾವುದೇ ರೆಫರಲ್‌ಗಳಿಲ್ಲ",
      body: "ತೋರಿಸಲು ಯಾವುದೇ ರೆಫರಲ್‌ಗಳಿಲ್ಲ.",
    },
    action: {
      accept: "ಸ್ವೀಕರಿಸಿ",
      cancel: "ರದ್ದುಮಾಡಿ",
      complete: "ಪೂರ್ಣಗೊಳಿಸಿ",
      startReview: "ಪರಿಶೀಲನೆ ಪ್ರಾರಂಭಿಸಿ",
    },
  },

  followUps: {
    title: "ಫಾಲೋ-ಅಪ್‌ಗಳು",
    assignedTo: "ನಿಯೋಜಿಸಲಾದವರು",
    due: "ನಿಗದಿತ ದಿನಾಂಕ",
    completedAt: "ಪೂರ್ಣಗೊಂಡ ಸಮಯ",
    notes: "ಟಿಪ್ಪಣಿಗಳು",
    empty: {
      title: "ಯಾವುದೇ ಫಾಲೋ-ಅಪ್‌ಗಳಿಲ್ಲ",
      body: "ತೋರಿಸಲು ಯಾವುದೇ ಫಾಲೋ-ಅಪ್‌ಗಳಿಲ್ಲ.",
    },
    action: {
      complete: "ಪೂರ್ಣಗೊಂಡಿದೆ ಎಂದು ಗುರುತಿಸಿ",
      cancel: "ರದ್ದುಮಾಡಿ",
      markMissed: "ತಪ್ಪಿಹೋಗಿದೆ ಎಂದು ಗುರುತಿಸಿ",
    },
  },

  camps: {
    title: "ಆರೋಗ್ಯ ಶಿಬಿರಗಳು",
    subtitle: "ಸಮುದಾಯ ಆರೋಗ್ಯ ಶಿಬಿರಗಳು ಮತ್ತು ನೋಂದಣಿ",
    date: "ದಿನಾಂಕ",
    time: "ಸಮಯ",
    location: "ಸ್ಥಳ",
    capacity: "ಸಾಮರ್ಥ್ಯ",
    spotsLeft: "ಉಳಿದ ಸ್ಥಳಗಳು",
    statusChanges: "ಸ್ಥಿತಿ ಬದಲಾವಣೆಗಳು",
    open: "ತೆರೆದಿದೆ",
    full: "ತುಂಬಿದೆ",
    registered: "ನೋಂದಾಯಿಸಲಾಗಿದೆ",
    attended: "ಹಾಜರಾಗಿದ್ದಾರೆ",
    register: "ನೋಂದಣಿ ಮಾಡಿ",
    registered_action: "ನೋಂದಾಯಿಸಲಾಗಿದೆ",
    cancelRegistration: "ನೋಂದಣಿ ರದ್ದುಮಾಡಿ",
    cancelCamp: "ಶಿಬಿರ ರದ್ದುಮಾಡಿ",
    completeCamp: "ಶಿಬಿರ ಪೂರ್ಣಗೊಳಿಸಿ",
    publish: "ಶಿಬಿರ ಪ್ರಕಟಿಸಿ",
    empty: {
      title: "ಯಾವುದೇ ಆರೋಗ್ಯ ಶಿಬಿರಗಳಿಲ್ಲ",
      body: "ತೋರಿಸಲು ಯಾವುದೇ ಆರೋಗ್ಯ ಶಿಬಿರಗಳಿಲ್ಲ.",
    },
    roster: {
      title: "ಶಿಬಿರ ರೋಸ್ಟರ್",
      attendee: "ಭಾಗವಹಿಸಿದವರು",
      attendance: "ಹಾಜರಾತಿ",
      markAttended: "ಹಾಜರಾಗಿದೆ ಎಂದು ಗುರುತಿಸಿ",
      markAbsent: "ಗೈರುಹಾಜರಿ ಎಂದು ಗುರುತಿಸಿ",
      empty: {
        title: "ಇನ್ನೂ ಯಾರೂ ನೋಂದಾಯಿಸಿಲ್ಲ",
        body: "ಈ ಶಿಬಿರಕ್ಕೆ ಇನ್ನೂ ಯಾವುದೇ ನೋಂದಣಿಗಳಿಲ್ಲ.",
      },
    },
  },

  forms: {
    name: "ಹೆಸರು",
    address: "ವಿಳಾಸ",
    choose: "ಆಯ್ಕೆಮಾಡಿ",
    optional: "ಐಚ್ಛಿಕ",
    newHousehold: "ಹೊಸ ಕುಟುಂಬ",
    editHousehold: "ಕುಟುಂಬ ಸಂಪಾದಿಸಿ",
    newMember: "ಹೊಸ ಸದಸ್ಯ",
    newObservation: "ಹೊಸ ವೀಕ್ಷಣೆ",
    newNote: "ಹೊಸ ವೈದ್ಯಕೀಯ ಟಿಪ್ಪಣಿ",
    newPrescription: "ಹೊಸ ಪ್ರಿಸ್ಕ್ರಿಪ್ಶನ್",
    newReferral: "ಹೊಸ ರೆಫರಲ್",
    newFollowUp: "ಹೊಸ ಫಾಲೋ-ಅಪ್",
    symptomsHint: "ಲಕ್ಷಣಗಳನ್ನು ವಿವರಿಸಿ",
    invalidSummary: "ದಯವಿಟ್ಟು ನಮೂದಿಸಿದ ಮಾಹಿತಿಯನ್ನು ಪರಿಶೀಲಿಸಿ.",
  },

  confidentialityNote:
    "ಆರೋಗ್ಯ ಸೇವೆಯ ಮಾಹಿತಿಯು ಗೌಪ್ಯವಾಗಿದ್ದು, ಅನುಮೋದಿತ ಆರೈಕೆ ಉದ್ದೇಶಗಳಿಗೆ ಮಾತ್ರ ಬಳಸಬೇಕು.",

  forbidden: {
    title: "ಪ್ರವೇಶ ನಿರ್ಬಂಧಿಸಲಾಗಿದೆ",
  },

  wrongRole: {
    title: "ತಪ್ಪಾದ ಪಾತ್ರ",
    body: "ನಿಮ್ಮ ಖಾತೆಗೆ ಈ ಆರೋಗ್ಯ ಸೇವಾ ಪೋರ್ಟಲ್‌ಗೆ ಪ್ರವೇಶವಿಲ್ಲ.",
    action: "ನಿಮ್ಮ ಪೋರ್ಟಲ್‌ಗೆ ಹಿಂತಿರುಗಿ",
  },

  notConfigured: {
    title: "ಆರೋಗ್ಯ ಸೇವಾ ಪೋರ್ಟಲ್ ಅನ್ನು ಕಾನ್ಫಿಗರ್ ಮಾಡಲಾಗಿಲ್ಲ",
    body: "ಈ ಪರಿಸರದಲ್ಲಿ ಆರೋಗ್ಯ ಸೇವೆಗಳನ್ನು ಇನ್ನೂ ಕಾನ್ಫಿಗರ್ ಮಾಡಲಾಗಿಲ್ಲ.",
  },

  loading: "ಲೋಡ್ ಆಗುತ್ತಿದೆ...",
};

/*
 * ============================================================
 * MERGE + PATCH
 * ============================================================
 */

function mergeHealthcare(localeData, healthcare) {
  localeData.healthcare = {
    ...(localeData.healthcare || {}),
    ...healthcare,
  };
}

/*
 * English
 */
const en = readLocale("en");

mergeHealthcare(en, enHealthcare);

en.nav = {
  ...(en.nav || {}),
  households: "Households",
};

writeLocale("en", en);

/*
 * Hindi
 */
const hi = readLocale("hi");

mergeHealthcare(hi, hiHealthcare);

hi.nav = {
  ...(hi.nav || {}),
  households: "परिवार",
};

writeLocale("hi", hi);

/*
 * Kannada
 */
const kn = readLocale("kn");

mergeHealthcare(kn, knHealthcare);

kn.nav = {
  ...(kn.nav || {}),
  households: "ಕುಟುಂಬಗಳು",
};

writeLocale("kn", kn);

console.log("Healthcare translations updated successfully.");
console.log("Updated:");
console.log("  - public/locales/en.json");
console.log("  - public/locales/hi.json");
console.log("  - public/locales/kn.json");
console.log("Added:");
console.log("  - healthcare.status");
console.log("  - healthcare.errors");
console.log("  - healthcare.roles");
console.log("  - healthcare.notConfigured");
console.log("  - healthcare.wrongRole");
console.log("  - healthcare dashboard/household/case/referral/follow-up/camp translations");
console.log("  - nav.households");