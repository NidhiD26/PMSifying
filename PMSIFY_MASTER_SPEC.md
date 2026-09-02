# PMSify — Master Product Specification & Authoritative Architecture Blueprint

## 1. Product Vision & Ecosystem Overview
PMSify is a privacy-first, offline-first women's health ecosystem designed for dual deployment: individual personal cycle/symptom/mental health tracking (private & offline), alongside a secure, anonymous peer support network (SecretChat) and an offline-to-online community healthcare platform (ASHA workers, doctors, health camps, digital prescriptions).

## 2. Core Functional Pillars
1. **Personal Health System**: 100% offline cycle, symptom, mood, sleep, hydration, and pain tracking powered by Dexie.js (IndexedDB). Zero cloud sync by default for core tracking data.
2. **SecretChat (Anonymous Community)**: An online peer support platform utilizing pseudo-anonymous IDs (`Anonymous User #4821`) completely isolated from personal tracking data.
3. **Rural & Community Healthcare Platform**: Secure online portal for ASHA workers, doctors, health camps, and digital prescriptions with strict role-based access control (RBAC), consent-based authorization, and immutable audit logs.
4. **Deterministic Cycle Engine & AI Assistant**: Deterministic algorithms for all mathematical calculations (fertile window, predictions, period delay). Medical-safe AI assistant (Gemma) for conversational literacy and RAG education retrieval.
5. **Multi-Dialect Localization**: Centralized deterministic i18n architecture supporting English, Hindi, and Kannada initially, with extensibility for additional Indian languages (Tamil, Telugu, Malayalam, Marathi, Bengali, Gujarati, etc.).

## 3. Data Boundary Rules & Isolation
- **World A (Personal Tracking)**: Stored strictly in local IndexedDB via Dexie.js. Local security tradeoffs evaluated (optional local PIN lock with memory/recovery considerations). Zero cloud exposure.
- **World B (SecretChat)**: Stored in backend relational DB. Pseudo-anonymous profile ID only. Absolutely no query path to World A data.
- **World C (Healthcare Portal)**: Authenticated RBAC system with privacy-, consent-, least-privilege-, and audit-oriented architecture. Applicable legal/compliance requirements (including Indian health data frameworks) to be validated prior to production deployment.

## 4. Technical Constraints & Principles
- **No AI for Math**: Cycle calculations must be pure deterministic TypeScript functions.
- **Zero Hardcoded Strings**: All UI copy must leverage `next-intl` static JSON translation keys.
- **Accessibility & Design Dignity**: Modern, calm design language avoiding generic pink clichés, crowded cards, or bright neon palettes. Practical baseline: WCAG 2.2 AA compliance, exceeding AA where feasible.
