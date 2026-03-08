# Implementation Summary — v2.6 Localization & Multi-Language Support

**Version:** 2.6  
**Spec:** `docs/spec_v2.6_localization.md`  
**Status:** ✅ Complete  
**Languages:** English (default) + Hungarian  
**Build:** `ng build` passes — zero compilation errors

---

## Overview

v2.6 adds full multi-language support to OpenMath. The i18n infrastructure uses **@jsverse/transloco v7** for runtime locale switching with lazy-loaded JSON translation files. Every user-facing string across all 14 Angular components is now translated. Users can select their language at registration, in their profile, or via the header dropdown — switching takes effect immediately without a page reload.

---

## Database Changes

### Migration `0016_user_locale.sql`

- Added `locale TEXT NOT NULL DEFAULT 'en'` column to `users` table
- Added `CHECK` constraint limiting values to `'en'` and `'hu'`
- Added `idx_users_locale` index for locale-based queries

### Migration `0017_review_templates_locale.sql`

- Added `locale TEXT NOT NULL DEFAULT 'en'` column to `review_templates` table
- Created unique index `idx_review_templates_role_locale_sort` on `(reviewer_role, locale, sort_order)`
- Seeded 9 Hungarian teacher review templates
- Seeded 9 Hungarian parent review templates

---

## Backend Changes (Python API)

### Schemas

| File | Change |
|---|---|
| `app/schemas/auth.py` | Added `locale` field to `RegisterRequest` and `AdminCreateUserRequest` (default `"en"`, validated `^(en\|hu)$`) |
| `app/schemas/user.py` | Added `locale` field to `UpdateUserRequest` (optional, validated `^(en\|hu)$`) |

### Queries (`app/queries.py`)

- 6 functions updated to accept and persist `locale` parameter:
  - `create_user` — stores locale on new user
  - `create_user_google` — stores locale for Google SSO users
  - `update_user` — updates locale on profile save
  - `list_review_templates` — filters by locale

### Routers

| File | Change |
|---|---|
| `app/routers/auth.py` | Register endpoint passes `locale` to `create_user`; `/me` endpoint returns `locale` field |
| `app/routers/users.py` | Update and create endpoints pass `locale` through |
| `app/routers/notifications.py` | Added `locale` query param to `/review-templates` endpoint; added `NOTIFICATION_MESSAGES` dict with EN/HU translations for notification generation |

---

## Frontend Infrastructure

### New Files Created

| File | Purpose |
|---|---|
| `angular-app/src/app/transloco-loader.ts` | `TranslocoHttpLoader` — loads `/assets/i18n/{lang}.json` via HTTP |
| `angular-app/src/app/core/services/locale.service.ts` | Central locale management — switches Transloco language, applies PrimeNG locale config (day/month names, button labels), exposes `getCalendarDateFormat()` |
| `angular-app/src/app/shared/pipes/local-date.pipe.ts` | `LocalDatePipe` — locale-aware date formatting using `hu-HU` or `en-US` based on active locale |
| `angular-app/src/assets/i18n/en.json` | English translations — **338 lines**, ~330 translation keys |
| `angular-app/src/assets/i18n/hu.json` | Hungarian translations — **338 lines**, ~330 translation keys |

### Config Changes

| File | Change |
|---|---|
| `angular-app/src/app/app.config.ts` | Added `provideTransloco()` with `availableLangs: ['en', 'hu']`, `defaultLang: 'en'`, lazy-loaded via `TranslocoHttpLoader` |
| `angular-app/angular.json` | Increased production bundle budget from 1MB to 2MB to accommodate Transloco library |

### Model Updates

| File | Change |
|---|---|
| `app/models/auth.model.ts` | Added `locale` field to `RegisterRequest`, `AdminCreateUserRequest`, `MeResponse` |
| `app/models/user.model.ts` | Added `locale` field to `UpdateUserRequest` |

### Service Updates

| File | Change |
|---|---|
| `app/core/services/auth.service.ts` | Injected `LocaleService`; `getMe()` calls `localeService.initFromProfile(me.locale)` to set locale on login |
| `app/core/services/api.service.ts` | `getReviewTemplates()` now accepts optional `locale` parameter and passes it as query string |
| `app/app.component.ts` | Calls `auth.getMe()` on startup to initialize locale from profile |

---

## Translated Components (14 total)

Every component wraps its template in `<ng-container *transloco="let t">` and replaces all hardcoded English strings with `t('key')` calls.

### Shared Components

| Component | Key Changes |
|---|---|
| **Header** | All nav links translated; language dropdown added (EN/Magyar); notification text translated; logout confirmation translated; `\| localDate:'short'` for dates |
| **Footer** | Version string, tech stack label, source link all translated |

### Auth Components

| Component | Key Changes |
|---|---|
| **Register** | All labels/placeholders translated; locale dropdown added (defaults to `'en'`); `genderOptions` converted to getter using `translocoService.translate()`; locale sent in registration payload; calendar `dateFormat` dynamic via `localeService.getCalendarDateFormat()` |
| **Login** | All labels/buttons/links translated; error messages translated |

### Feature Components

| Component | Key Changes |
|---|---|
| **Profile** | All labels translated; locale dropdown added; locale saved to backend on profile update; `localeService.setLocale()` called on save; `genderOptions` as getter; `\| localDate:'mediumDate'` for dates; dynamic calendar `dateFormat` |
| **Start** | Quiz type selector, category filter, difficulty, preview text all translated; `categoryOptions` uses `translate()` for "All" option |
| **Quiz** | Question/score display, feedback messages, answer placeholders, submit button all translated |
| **History List** | Table headers, filter dropdown, empty state, date columns (`\| localDate:'short'`), confirm-delete dialog, toast messages all translated |
| **Session Detail** | All detail labels, question table headers, review sections, status tags, date formatting all translated |
| **User Guide** | Entire content (~150 lines of prose) extracted to translation keys (`userGuide.*`); rendered per active locale |

### Dashboard Components

| Component | Key Changes |
|---|---|
| **Teacher Dashboard** | All labels/headers/tooltips translated; review dialog translated; `getReviewTemplates()` passes locale; toast messages translated; `\| localDate:'short'` for dates |
| **Parent Dashboard** | All labels/headers/tooltips translated; sign-off dialog translated; `getReviewTemplates()` passes locale; toast messages translated; `\| localDate:'short'` for dates |

### Admin Components

| Component | Key Changes |
|---|---|
| **Admin (Database)** | Stats labels, table browser, refresh/delete buttons, confirm dialog, toast messages all translated; `statItems` and `tableOptions` use `translate()` |
| **User Admin** | Table headers, dialog labels, reset password dialog all translated; `genderOptions` and `roleOptions` converted to getters; calendar `dateFormat` dynamic; toast messages translated |
| **Quiz Type Editor** | Table headers, dialog labels, form fields, preview dialog all translated; `categoryFilterOptions` uses `translate()`; confirm-delete and toast messages translated |

---

## Translation Key Organization

Keys in `en.json` / `hu.json` are organized by feature area using dot notation:

| Prefix | Scope | Example Keys |
|---|---|---|
| `common.*` | Shared labels | `common.save`, `common.cancel`, `common.loading`, `common.error`, `common.success` |
| `nav.*` | Navigation links | `nav.start`, `nav.profile`, `nav.history` |
| `header.*` | Header UI | `header.logout`, `header.confirmLogout`, `header.notifications` |
| `auth.*` | Login/Register | `auth.signInTo`, `auth.createAccount`, `auth.loginFailed` |
| `gender.*` | Gender options | `gender.female`, `gender.male`, `gender.preferNotToSay` |
| `role.*` | Role labels | `role.student`, `role.teacher`, `role.admin` |
| `profile.*` | Profile page | `profile.editProfile`, `profile.birthday`, `profile.performance` |
| `quiz.*` | Quiz flow | `quiz.startAQuiz`, `quiz.submit`, `quiz.correctFeedback` |
| `history.*` | History list | `history.quizType`, `history.score`, `history.noSessions` |
| `session.*` | Session detail | `session.question`, `session.reviewed`, `session.signed` |
| `review.*` | Review workflow | `review.quickFeedback`, `review.submitReview`, `review.addComment` |
| `teacher.*` | Teacher dashboard | `teacher.myStudents`, `teacher.addStudent`, `teacher.pending` |
| `parent.*` | Parent dashboard | `parent.myChild`, `parent.signOff`, `parent.waitingForTeacher` |
| `admin.*` | Admin pages | `admin.databaseAdmin`, `admin.userAdmin`, `admin.resetPassword` |
| `quizEditor.*` | Quiz type editor | `quizEditor.newQuizType`, `quizEditor.preview`, `quizEditor.confirmDelete` |
| `footer.*` | Footer | `footer.version`, `footer.techStack`, `footer.source` |
| `userGuide.*` | User guide content | `userGuide.title`, `userGuide.introText`, `userGuide.takingQuiz` |

---

## Locale Switching Flow

1. **Registration** — User selects language from dropdown → locale stored in DB via `RegisterRequest.locale`
2. **Login** — `AuthService.getMe()` returns `locale` → `LocaleService.initFromProfile()` sets Transloco lang + PrimeNG config
3. **Header dropdown** — User switches language → `LocaleService.setLocale()` → immediate UI update (no reload)
4. **Profile** — User changes language → saved to backend → `LocaleService.setLocale()` called on save success
5. **Date formatting** — `LocalDatePipe` reads active locale → formats dates with `hu-HU` or `en-US`
6. **Calendar widgets** — `dateFormat` bound dynamically via `localeService.getCalendarDateFormat()` → `"yy.mm.dd"` (HU) or `"mm/dd/yy"` (EN)
7. **PrimeNG components** — `LocaleService` applies full PrimeNG translation object (day names, month names, button labels) on locale change
8. **Review templates** — Dashboard review dialogs pass `locale` to API → backend filters templates by locale

---

## Files Modified / Created

### Created (7 files)

```
db/migrations/0016_user_locale.sql
db/migrations/0017_review_templates_locale.sql
angular-app/src/app/transloco-loader.ts
angular-app/src/app/core/services/locale.service.ts
angular-app/src/app/shared/pipes/local-date.pipe.ts
angular-app/src/assets/i18n/en.json
angular-app/src/assets/i18n/hu.json
```

### Modified — Backend (6 files)

```
python-api/app/schemas/auth.py
python-api/app/schemas/user.py
python-api/app/queries.py
python-api/app/routers/auth.py
python-api/app/routers/users.py
python-api/app/routers/notifications.py
```

### Modified — Frontend (20 files)

```
angular-app/angular.json
angular-app/src/app/app.config.ts
angular-app/src/app/app.component.ts
angular-app/src/app/models/auth.model.ts
angular-app/src/app/models/user.model.ts
angular-app/src/app/core/services/auth.service.ts
angular-app/src/app/core/services/api.service.ts
angular-app/src/app/shared/components/header/header.component.ts
angular-app/src/app/shared/components/footer/footer.component.ts
angular-app/src/app/features/auth/register.component.ts
angular-app/src/app/features/auth/login.component.ts
angular-app/src/app/features/profile/profile.component.ts
angular-app/src/app/features/start/start.component.ts
angular-app/src/app/features/quiz/quiz.component.ts
angular-app/src/app/features/history/history-list.component.ts
angular-app/src/app/features/history/session-detail.component.ts
angular-app/src/app/features/user-guide/user-guide.component.ts
angular-app/src/app/features/teacher/teacher-dashboard.component.ts
angular-app/src/app/features/parent/parent-dashboard.component.ts
angular-app/src/app/features/admin/admin.component.ts
angular-app/src/app/features/quiz-type-editor/quiz-type-editor.component.ts
angular-app/src/app/features/user-admin/user-admin.component.ts
```

**Total: 7 created + 26 modified = 33 files touched**

---

## Acceptance Criteria Status

| # | Criterion | Status |
|---|---|---|
| 1 | Transloco installed and configured with lazy-loaded JSON translations | ✅ |
| 2 | `en.json` and `hu.json` contain all UI strings (~330 keys each) | ✅ |
| 3 | `locale` column added to `users` table with CHECK constraint | ✅ |
| 4 | Language selector in header, registration, and profile | ✅ |
| 5 | Runtime locale switching without page reload | ✅ |
| 6 | Dates formatted per locale (`LocalDatePipe` + `hu-HU`/`en-US`) | ✅ |
| 7 | PrimeNG Calendar `dateFormat` dynamic per locale | ✅ |
| 8 | PrimeNG component labels (day/month names) set per locale | ✅ |
| 9 | User guide content fully translated via translation keys | ✅ |
| 10 | Review templates table has `locale` column + HU seed data (18 rows) | ✅ |
| 11 | Review template API accepts `locale` query parameter | ✅ |
| 12 | Notification messages have EN/HU translations | ✅ |
| 13 | All 14 components wrapped with `*transloco="let t"` | ✅ |
| 14 | All `\| date:` pipes replaced with `\| localDate:` | ✅ |
| 15 | `ng build` compiles with zero errors | ✅ |
