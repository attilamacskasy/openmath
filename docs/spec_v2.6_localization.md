# OpenMath v2.6 — Localization & Multi-Language Support

## Feature Summary

**Version:** 2.6  
**Scope:** Multi-language support (EN default + HU), language as user profile property, date formatting per locale, translated user guide and review templates, i18n infrastructure with Transloco  
**Depends on:** v2.5 (notifications, review templates, header/footer/profile polish)  
**Tech stack:** Angular 18 + PrimeNG 17 + Transloco 7 | FastAPI + asyncpg | PostgreSQL 16

---

## 1. Overview

### Current state (v2.5)

- **i18n infrastructure**: None. No `LOCALE_ID` provider, no `@angular/localize`, no translation library. All UI text is hardcoded English in Angular templates.
- **Date formatting**: Angular `DatePipe` used with `'short'` and `'mediumDate'` formats — renders in default `en-US` locale. PrimeNG Calendar uses hardcoded `dateFormat="yy-mm-dd"`.
- **User profile**: No `locale` column on `users` table. No language preference stored anywhere.
- **User guide**: ~150 lines of English prose hardcoded in `user-guide.component.ts`. Entirely inline, no external content source.
- **Review templates**: 18 seed rows (9 teacher + 9 parent) in `review_templates` table — English only, no `locale` column.
- **Notification messages**: Generated server-side with English strings (e.g., `"Teacher {name} has added you to their class"`).
- **Backend errors**: HTTP error `detail` strings are English (e.g., `"Email already registered"`, `"Invalid birthday format"`).
- **Form labels & buttons**: All hardcoded English across every component — register, login, profile, quiz, history, header, footer, dashboards.
- **Gender/role labels**: Duplicated in `register.component.ts` and `profile.component.ts` as `genderOptions` arrays with English labels.
- **PrimeNG translations**: Default PrimeNG component labels (calendar day/month names, filter labels, button labels) use built-in English defaults via `PrimeNGConfig.translation`.

### v2.6 delivers

1. **Transloco i18n infrastructure** — install and configure `@jsverse/transloco` as the Angular i18n library with lazy-loaded translation files
2. **Translation files** — `en.json` and `hu.json` containing all UI strings organized by feature area
3. **User locale preference** — add `locale` column to `users` table, expose in registration/profile/API
4. **Dynamic locale switching** — language selector in header and profile, runtime locale change without page reload
5. **Date formatting per locale** — configure Angular `LOCALE_ID` dynamically + PrimeNG locale settings based on user preference
6. **Translated user guide** — extract all prose to translation files, render per active locale
7. **Translated review templates** — add `locale` column to `review_templates`, seed Hungarian translations, filter by user locale
8. **Translated notification messages** — generate notification title/message per recipient's locale preference
9. **Translated backend errors** — map error codes to frontend translation keys (client-side override)
10. **PrimeNG locale configuration** — set PrimeNG `translation` object (day names, month names, button labels) per locale
11. **Registration language selection** — add locale dropdown to registration form (default: `en`)
12. **Calendar date format per locale** — adjust PrimeNG Calendar `dateFormat` based on active locale

---

## 2. Technology Choice: Transloco

### Why Transloco over alternatives

| Library | Pros | Cons | Verdict |
|---|---|---|---|
| **@angular/localize** (built-in) | Build-time extraction, AOT support | Requires separate build per locale, no runtime switching | ❌ No runtime switch |
| **ngx-translate** | Mature, large community | Maintenance concerns, no signals support, legacy patterns | ❌ Legacy |
| **@jsverse/transloco** | Runtime switching, lazy loading, Angular 18 signals support, active maintenance, SSR ready, plugin ecosystem | Newer than ngx-translate | ✅ **Best fit** |

**Decision:** Use `@jsverse/transloco` v7+ for runtime i18n with lazy-loaded JSON translation files.

### Key Transloco features used

- **Lazy-loaded translations**: JSON files loaded on demand per locale
- **Runtime locale switching**: Change language without page reload
- **Pipe + directive syntax**: `{{ 'key' | transloco }}` and `*transloco="let t"` structural directive
- **Scoped translations**: Feature-area scoping (optional, start with flat namespace)
- **PrimeNG integration**: Manual sync via `TranslocoService.langChanges$` → `PrimeNGConfig.setTranslation()`

---

## 3. Database Changes

### 3.1 Migration `0016_user_locale.sql`

Add locale preference to users table.

```sql
-- v2.6: User locale preference for multi-language support
ALTER TABLE users ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en';

-- Validate locale values
ALTER TABLE users ADD CONSTRAINT chk_users_locale CHECK (locale IN ('en', 'hu'));

-- Index for locale-based queries (review templates, notifications)
CREATE INDEX IF NOT EXISTS idx_users_locale ON users(locale);
```

### 3.2 Migration `0017_review_templates_locale.sql`

Add locale column to review templates and seed Hungarian translations.

```sql
-- v2.6: Locale support for review templates
ALTER TABLE review_templates ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en';

-- Update unique constraint to include locale
-- (allows same label in different locales)
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_templates_role_locale_sort
  ON review_templates(reviewer_role, locale, sort_order);

-- Seed Hungarian teacher templates
INSERT INTO review_templates (reviewer_role, sentiment, label, message, sort_order, locale) VALUES
  ('teacher', 'positive', 'Kiváló munka',         'Kiváló munka! Nagyszerű megértést mutattál az anyagban. Így tovább!', 1, 'hu'),
  ('teacher', 'positive', 'Szép munka',            'Szép munka! Az erőfeszítésed meglátszik. Büszke vagyok a fejlődésedre.', 2, 'hu'),
  ('teacher', 'positive', 'Nagy fejlődés',         'Nagyszerű fejlődés az előző alkalom óta. Egyre jobban megy!', 3, 'hu'),
  ('teacher', 'neutral',  'Jó próbálkozás',        'Jó próbálkozás. Nézd át a hibásan megoldott feladatokat és próbáld újra, hogy javíts az eredményeden.', 4, 'hu'),
  ('teacher', 'neutral',  'Gyakorolj tovább',      'Gyakorolj tovább — jó úton haladsz, de több ismétlésre van szükség a magabiztossághoz.', 5, 'hu'),
  ('teacher', 'neutral',  'Van hova fejlődni',     'Szolid próbálkozás. Koncentrálj azokra a területekre, ahol hibáztál, és kérj segítséget, ha kell.', 6, 'hu'),
  ('teacher', 'negative', 'Több gyakorlás kell',   'Ez a téma még több gyakorlást igényel. Kérlek, nézd át az anyagot és próbáld újra.', 7, 'hu'),
  ('teacher', 'negative', 'Elvárt szint alatt',    'Az eredményed az elvárt szint alatt van. Dolgozzunk együtt, hogy kiderítsük, mi okoz nehézséget.', 8, 'hu'),
  ('teacher', 'negative', 'Próbáld újra',          'Túl sok hiba volt ebben a feladatsorban. Kérlek, próbáld újra, miután átnézted a helyes válaszokat.', 9, 'hu')
ON CONFLICT DO NOTHING;

-- Seed Hungarian parent templates
INSERT INTO review_templates (reviewer_role, sentiment, label, message, sort_order, locale) VALUES
  ('parent', 'positive', 'Nagyon büszke vagyok!',  'Nagyon büszke vagyok rád! A kemény munkád meghozta gyümölcsét. Fantasztikus eredmény!', 1, 'hu'),
  ('parent', 'positive', 'Csodás munka',           'Csodás munka! Nagyon jól teljesítettél ezen a kvízen. Ünnepeljünk!', 2, 'hu'),
  ('parent', 'positive', 'Ragyogj tovább',         'Fantasztikus erőfeszítés! Hihetetlen munkát végzel a matekgyakorlásoddal.', 3, 'hu'),
  ('parent', 'neutral',  'Jó próbálkozás',         'Jó próbálkozás! Nézzük át együtt azokat, amiket elhibáztál, és legközelebb még jobban fog menni.', 4, 'hu'),
  ('parent', 'neutral',  'Gyakorlás a mester',     'Nem rossz! Még egy kis gyakorlás és ott leszel. Szeretnéd újra megpróbálni együtt?', 5, 'hu'),
  ('parent', 'neutral',  'Majdnem sikerült',       'Közel vagy! Koncentráljunk a nehéz részekre és csináljunk még egy kört.', 6, 'hu'),
  ('parent', 'negative', 'Nézzük át együtt',       'Ez egy nehéz volt. Üljünk le együtt és nézzük át azokat a feladatokat, amiket nehéznek találtál.', 7, 'hu'),
  ('parent', 'negative', 'Több időt kell szánni',  'Az eredményed azt mutatja, hogy több időt kell szánnunk erre a témára. Gyakoroljunk együtt ezen a héten.', 8, 'hu'),
  ('parent', 'negative', 'Próbáld újra',           'Ne aggódj — mindenkinek vannak nehéz pillanatai. Nézzük át a válaszokat és próbáljuk újra.', 9, 'hu')
ON CONFLICT DO NOTHING;
```

---

## 4. Backend Changes (FastAPI)

### 4.1 Schema changes

**`python-api/app/schemas/auth.py`** — Add `locale` to registration and admin-create:

```python
class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6)
    birthday: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    gender: str | None = Field(default=None, pattern=r"^(female|male|other|prefer_not_say)$")
    learned_timetables: list[int] = Field(default_factory=list, alias="learnedTimetables")
    locale: str = Field(default="en", pattern=r"^(en|hu)$")
```

```python
class AdminCreateUserRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6)
    birthday: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    gender: str | None = Field(default=None, pattern=r"^(female|male|other|prefer_not_say)$")
    role: str = Field(default="student", pattern=r"^(student|admin|teacher|parent)$")
    learned_timetables: list[int] = Field(default_factory=list, alias="learnedTimetables")
    locale: str = Field(default="en", pattern=r"^(en|hu)$")
```

**`python-api/app/schemas/auth.py`** — Add `locale` to `MeResponse`:

```python
class MeResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    role: str
    roles: list[str]
    age: int | None
    birthday: str | None
    gender: str | None
    auth_provider: str = Field(alias="authProvider")
    learned_timetables: list[int] = Field(alias="learnedTimetables")
    locale: str = "en"
```

**`python-api/app/schemas/user.py`** — Add `locale` to update request and profile output:

```python
class UpdateUserRequest(BaseModel):
    name: str | None = None
    age: int | None = None
    gender: str | None = Field(default=None, pattern=r"^(female|male|other|prefer_not_say)$")
    learned_timetables: list[int] | None = Field(default=None, alias="learnedTimetables")
    birthday: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    email: EmailStr | None = None
    locale: str | None = Field(default=None, pattern=r"^(en|hu)$")
```

### 4.2 Query changes

**`python-api/app/queries.py`** — Update `create_user_with_auth()`:

```python
async def create_user_with_auth(
    pool, *, name, email, password_hash, role="student",
    auth_provider="local", google_sub=None,
    birthday=None, gender=None, learned_timetables=None,
    locale="en"
):
    row = await pool.fetchrow("""
        INSERT INTO users (name, email, password_hash, role, auth_provider, google_sub,
                           birthday, gender, learned_timetables, locale)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING id, name, email, role, roles, birthday, gender, auth_provider, learned_timetables, locale
    """, name, email, password_hash, role, auth_provider, google_sub,
         birthday, gender, learned_timetables or [], locale)
    return row
```

**`python-api/app/queries.py`** — Update `find_user_by_id()` and `find_user_by_email()` to include `locale` in SELECT.

**`python-api/app/queries.py`** — Update `update_user()` to accept and persist `locale`.

**`python-api/app/queries.py`** — Update `list_review_templates()`:

```python
async def list_review_templates(pool, role: str = None, locale: str = "en"):
    if role:
        rows = await pool.fetch(
            "SELECT * FROM review_templates WHERE reviewer_role = $1 AND locale = $2 ORDER BY sort_order",
            role, locale
        )
    else:
        rows = await pool.fetch(
            "SELECT * FROM review_templates WHERE locale = $1 ORDER BY reviewer_role, sort_order",
            locale
        )
    return [dict(r) for r in rows]
```

### 4.3 Router changes

**`python-api/app/routers/auth.py`** — Pass `locale` through registration:

```python
@router.post("/register")
async def register(req: RegisterRequest, ...):
    # ... existing validation ...
    user = await create_user_with_auth(
        pool, name=req.name, email=req.email, password_hash=hashed,
        birthday=bd, gender=req.gender,
        learned_timetables=req.learned_timetables,
        locale=req.locale
    )
```

**`python-api/app/routers/auth.py`** — Include `locale` in `/me` response.

**`python-api/app/routers/notifications.py`** — Use recipient's locale for notification message generation:

```python
async def create_notification_for_user(pool, *, user_id, type, title, message):
    # Existing — messages are generated by caller
    # Caller should look up recipient locale and use appropriate message
    pass

# Helper: locale-aware notification messages
NOTIFICATION_MESSAGES = {
    "en": {
        "student_associated_teacher": ("New Teacher", "Teacher {name} has added you to their class"),
        "student_associated_parent": ("New Parent", "Parent {name} has linked your account"),
        "quiz_completed": ("Quiz Completed", "Student {name} completed {quiz_type} — Score: {score}%"),
        "review_submitted": ("New Review", "Teacher {name} reviewed your {quiz_type} session"),
        "signoff_submitted": ("Signed Off", "Parent {name} signed off on your {quiz_type} session"),
        "role_changed": ("Roles Updated", "Your roles have been updated to: {roles}"),
        "student_removed_teacher": ("Teacher Removed", "You have been removed from {name}'s class"),
        "student_removed_parent": ("Parent Removed", "Parent {name} has unlinked your account"),
    },
    "hu": {
        "student_associated_teacher": ("Új tanár", "{name} tanár hozzáadott az osztályához"),
        "student_associated_parent": ("Új szülő", "{name} szülő összekapcsolta a fiókodat"),
        "quiz_completed": ("Kvíz kész", "{name} tanuló teljesítette: {quiz_type} — Eredmény: {score}%"),
        "review_submitted": ("Új értékelés", "{name} tanár értékelte a(z) {quiz_type} feladatsorodat"),
        "signoff_submitted": ("Jóváhagyva", "{name} szülő jóváhagyta a(z) {quiz_type} feladatsorodat"),
        "role_changed": ("Szerepkörök frissítve", "A szerepköreid frissítve lettek: {roles}"),
        "student_removed_teacher": ("Tanár eltávolítva", "Eltávolítottak {name} tanár osztályából"),
        "student_removed_parent": ("Szülő eltávolítva", "{name} szülő leválasztotta a fiókodat"),
    },
}
```

**`python-api/app/routers/notifications.py`** — Update `GET /review-templates` to accept `locale` query parameter:

```python
@router.get("/review-templates")
async def get_review_templates(role: str = None, locale: str = "en", ...):
    return await list_review_templates(pool, role=role, locale=locale)
```

### 4.4 API endpoint summary

| Method | Path | Change |
|---|---|---|
| `POST` | `/auth/register` | Accept `locale` field (default `"en"`) |
| `GET` | `/auth/me` | Return `locale` in response |
| `PATCH` | `/users/{id}` | Accept `locale` in update body |
| `GET` | `/notifications/review-templates` | Accept `?locale=en\|hu` query param |
| `POST` | (notification triggers) | Look up recipient locale, generate localized message |

---

## 5. Frontend Changes (Angular + Transloco)

### 5.1 Install & configure Transloco

```bash
npm install @jsverse/transloco
```

**`angular-app/src/app/transloco-loader.ts`** (new file):

```typescript
import { inject, Injectable } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private http = inject(HttpClient);

  getTranslation(lang: string) {
    return this.http.get<Translation>(`/assets/i18n/${lang}.json`);
  }
}
```

**`angular-app/src/app/app.config.ts`** — Add Transloco providers:

```typescript
import { provideTransloco } from '@jsverse/transloco';
import { TranslocoHttpLoader } from './transloco-loader';
import { isDevMode } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    provideTransloco({
      config: {
        availableLangs: ['en', 'hu'],
        defaultLang: 'en',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
  ],
};
```

### 5.2 Translation files

**`angular-app/src/assets/i18n/en.json`** — English translations (flat keys grouped by prefix):

```json
{
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.loading": "Loading...",
  "common.yes": "Yes",
  "common.no": "No",
  "common.back": "Back",
  "common.error": "Error",
  "common.success": "Success",
  "common.noResults": "No results found.",

  "header.logout": "Logout",
  "header.logoutConfirm": "Are you sure you want to log out?",
  "header.notifications": "Notifications",
  "header.markAllRead": "Mark all read",
  "header.noNotifications": "No new notifications",

  "auth.login": "Sign In",
  "auth.register": "Register",
  "auth.createAccount": "Create your account",
  "auth.email": "Email",
  "auth.emailPlaceholder": "your@email.com",
  "auth.password": "Password",
  "auth.passwordHint": "Password (min 6 characters)",
  "auth.name": "Name",
  "auth.namePlaceholder": "Your name",
  "auth.birthday": "Birthday (optional)",
  "auth.gender": "Gender (optional)",
  "auth.language": "Language",
  "auth.timetablesLearned": "Timetables learned",
  "auth.alreadyHaveAccount": "Already have an account?",
  "auth.signIn": "Sign in",
  "auth.noAccount": "Don't have an account?",
  "auth.signUp": "Sign up",
  "auth.signInWithGoogle": "Sign in with Google",
  "auth.orSeparator": "or",
  "auth.registrationFailed": "Registration failed",
  "auth.loginFailed": "Login failed",
  "auth.invalidCredentials": "Invalid email or password",

  "gender.female": "Female",
  "gender.male": "Male",
  "gender.other": "Other",
  "gender.preferNotToSay": "Prefer not to say",

  "role.student": "student",
  "role.teacher": "teacher",
  "role.parent": "parent",
  "role.admin": "admin",

  "profile.editProfile": "Edit Profile",
  "profile.email": "Email",
  "profile.authProvider": "Auth Provider",
  "profile.name": "Name",
  "profile.birthday": "Birthday",
  "profile.age": "Age",
  "profile.gender": "Gender",
  "profile.language": "Language",
  "profile.learnedTimetables": "Learned Timetables",
  "profile.performance": "Performance",
  "profile.overall": "Overall",
  "profile.sessions": "Sessions:",
  "profile.completed": "Completed:",
  "profile.questions": "Questions:",
  "profile.correct": "Correct:",
  "profile.wrong": "Wrong:",
  "profile.avgScore": "Avg Score:",
  "profile.associations": "My Teachers & Parents",
  "profile.relationship": "Relationship",
  "profile.since": "Since",
  "profile.noAssociations": "No associations found.",
  "profile.saved": "Saved",
  "profile.profileUpdated": "Profile updated successfully.",
  "profile.updateFailed": "Failed to update profile.",

  "quiz.startQuiz": "Start Quiz",
  "quiz.quizType": "Quiz Type",
  "quiz.numberOfQuestions": "Number of Questions",
  "quiz.start": "Start",
  "quiz.submit": "Submit",
  "quiz.next": "Next",
  "quiz.finish": "Finish",
  "quiz.question": "Question",
  "quiz.of": "of",
  "quiz.score": "Score",
  "quiz.correct": "Correct",
  "quiz.wrong": "Wrong",
  "quiz.yourAnswer": "Your answer",
  "quiz.correctAnswer": "Correct answer",
  "quiz.answer1": "Answer 1",
  "quiz.answer2": "Answer 2",
  "quiz.exampleQuestions": "Example Questions",
  "quiz.difficulty": "Difficulty",
  "quiz.easy": "Easy",
  "quiz.medium": "Medium",
  "quiz.hard": "Hard",

  "history.title": "History",
  "history.quizType": "Quiz Type",
  "history.date": "Date",
  "history.score": "Score",
  "history.status": "Status",
  "history.completed": "Completed",
  "history.inProgress": "In Progress",
  "history.finished": "Finished",
  "history.started": "Started",
  "history.noSessions": "No sessions found.",
  "history.student": "Student",
  "history.details": "Details",
  "history.teacherReview": "Teacher Review",
  "history.parentSignoff": "Parent Sign-off",

  "review.selectTemplate": "Select a template...",
  "review.submitReview": "Submit Review",
  "review.submitSignoff": "Sign Off",
  "review.comment": "Comment",
  "review.signoffDisabled": "Teacher review required before sign-off",
  "review.reviewSubmitted": "Review submitted successfully",
  "review.signoffSubmitted": "Sign-off submitted successfully",

  "teacher.myStudents": "My Students",
  "teacher.addStudent": "Add Student",
  "teacher.removeStudent": "Remove Student",
  "teacher.studentEmail": "Student Email",
  "teacher.recentSessions": "Recent Sessions",
  "teacher.reviewSession": "Review Session",
  "teacher.noStudents": "No students associated.",

  "parent.myChildren": "My Children",
  "parent.addChild": "Add Child",
  "parent.removeChild": "Remove Child",
  "parent.childEmail": "Child Email",
  "parent.recentSessions": "Recent Sessions",
  "parent.noChildren": "No children associated.",

  "admin.userManagement": "User Management",
  "admin.quizTypeEditor": "Quiz Type Editor",
  "admin.databaseStats": "Database & Statistics",
  "admin.createUser": "Create User",
  "admin.editUser": "Edit User",
  "admin.deleteUser": "Delete User",
  "admin.roles": "Roles",
  "admin.resetStats": "Reset Statistics",

  "footer.version": "OpenMath v2.6",
  "footer.source": "Source",

  "userGuide.title": "User Guide",
  "userGuide.introduction": "Introduction",
  "userGuide.introText": "OpenMath is an interactive maths practice portal designed for primary-school students, their teachers. and parents. It offers timed quizzes on multiplication tables, addition, subtraction, and other arithmetic topics. Teachers and parents can track progress, review sessions, and provide feedback.",
  "userGuide.purpose": "Purpose",
  "userGuide.purposeText": "The main goal is to help children build fluency and confidence in mental arithmetic through regular, structured practice with immediate feedback.",
  "userGuide.coreFeatures": "Core Features",
  "userGuide.feature1": "Timed maths quizzes with adjustable difficulty",
  "userGuide.feature2": "Instant scoring and answer review",
  "userGuide.feature3": "Performance history and statistics",
  "userGuide.feature4": "Teacher review and parent sign-off workflow",
  "userGuide.feature5": "Notification system for all role-based events",
  "userGuide.gettingStarted": "Getting Started",
  "userGuide.gettingStartedText": "Create an account on the registration page by providing your name, email, and a password. Optionally set your birthday, gender, and which timetables you have already learned. After registration, sign in and you will land on the Start page where you can begin a quiz.",
  "userGuide.takingQuiz": "Taking a Quiz",
  "userGuide.takingQuizText": "Select a quiz type from the dropdown, choose the number of questions, and click Start. Answer each question within the time limit. When finished you will see your score, the correct answers, and a summary of your performance.",
  "userGuide.yourProfile": "Your Profile",
  "userGuide.yourProfileText": "Visit the Profile page to view and edit your personal details, see your overall performance statistics, and check which teachers and parents are associated with your account.",
  "userGuide.notifications": "Notifications",
  "userGuide.notificationsText": "The bell icon in the header shows your unread notification count. Click it to see recent events such as new associations, quiz completions, reviews, and role changes. You can mark individual notifications or all as read.",
  "userGuide.history": "History",
  "userGuide.historyText": "The History page lists all your past quiz sessions. Click on any session to see the full details including each question, your answer, the correct answer, and any teacher review or parent sign-off.",
  "userGuide.teacherSection": "Teacher — My Students",
  "userGuide.teacherSectionText": "Teachers can add students by email from the Teacher dashboard. Once associated, you can see all your students' recent sessions, review their quizzes, and leave feedback using template messages or free-text comments.",
  "userGuide.parentSection": "Parent — My Child",
  "userGuide.parentSectionText": "Parents can link their child's account by email from the Parent dashboard. You can view your child's recent sessions, see teacher reviews, and sign off on reviewed sessions with your own feedback.",
  "userGuide.adminUsers": "Admin — User Management",
  "userGuide.adminUsersText": "Admins can view all users, create new users with specific roles, edit user details, manage role assignments, and delete accounts.",
  "userGuide.adminQuizTypes": "Admin — Quiz Type Editor",
  "userGuide.adminQuizTypesText": "Admins can create, edit, and delete quiz types. Each quiz type defines the operation, difficulty range, number format, and example questions shown on the Start page.",
  "userGuide.adminDatabase": "Admin — Database & Statistics",
  "userGuide.adminDatabaseText": "Admins can view database table statistics and reset all quiz data for testing purposes."
}
```

**`angular-app/src/assets/i18n/hu.json`** — Hungarian translations:

```json
{
  "common.save": "Mentés",
  "common.cancel": "Mégse",
  "common.delete": "Törlés",
  "common.loading": "Betöltés...",
  "common.yes": "Igen",
  "common.no": "Nem",
  "common.back": "Vissza",
  "common.error": "Hiba",
  "common.success": "Sikeres",
  "common.noResults": "Nincs találat.",

  "header.logout": "Kijelentkezés",
  "header.logoutConfirm": "Biztosan ki szeretnél jelentkezni?",
  "header.notifications": "Értesítések",
  "header.markAllRead": "Összes olvasottnak jelölése",
  "header.noNotifications": "Nincsenek új értesítések",

  "auth.login": "Bejelentkezés",
  "auth.register": "Regisztráció",
  "auth.createAccount": "Fiók létrehozása",
  "auth.email": "E-mail",
  "auth.emailPlaceholder": "pelda@email.com",
  "auth.password": "Jelszó",
  "auth.passwordHint": "Jelszó (min. 6 karakter)",
  "auth.name": "Név",
  "auth.namePlaceholder": "A neved",
  "auth.birthday": "Születésnap (opcionális)",
  "auth.gender": "Nem (opcionális)",
  "auth.language": "Nyelv",
  "auth.timetablesLearned": "Tanult szorzótáblák",
  "auth.alreadyHaveAccount": "Már van fiókod?",
  "auth.signIn": "Jelentkezz be",
  "auth.noAccount": "Nincs még fiókod?",
  "auth.signUp": "Regisztrálj",
  "auth.signInWithGoogle": "Bejelentkezés Google fiókkal",
  "auth.orSeparator": "vagy",
  "auth.registrationFailed": "A regisztráció sikertelen",
  "auth.loginFailed": "Sikertelen bejelentkezés",
  "auth.invalidCredentials": "Hibás e-mail cím vagy jelszó",

  "gender.female": "Nő",
  "gender.male": "Férfi",
  "gender.other": "Egyéb",
  "gender.preferNotToSay": "Nem kívánom megadni",

  "role.student": "tanuló",
  "role.teacher": "tanár",
  "role.parent": "szülő",
  "role.admin": "admin",

  "profile.editProfile": "Profil szerkesztése",
  "profile.email": "E-mail",
  "profile.authProvider": "Hitelesítési mód",
  "profile.name": "Név",
  "profile.birthday": "Születésnap",
  "profile.age": "Kor",
  "profile.gender": "Nem",
  "profile.language": "Nyelv",
  "profile.learnedTimetables": "Tanult szorzótáblák",
  "profile.performance": "Teljesítmény",
  "profile.overall": "Összesített",
  "profile.sessions": "Munkamenetek:",
  "profile.completed": "Befejezett:",
  "profile.questions": "Kérdések:",
  "profile.correct": "Helyes:",
  "profile.wrong": "Hibás:",
  "profile.avgScore": "Átlag pontszám:",
  "profile.associations": "Tanáraim és szüleim",
  "profile.relationship": "Kapcsolat",
  "profile.since": "Mióta",
  "profile.noAssociations": "Nincsenek társítások.",
  "profile.saved": "Mentve",
  "profile.profileUpdated": "A profil sikeresen frissítve.",
  "profile.updateFailed": "A profil frissítése sikertelen.",

  "quiz.startQuiz": "Kvíz indítása",
  "quiz.quizType": "Kvíz típus",
  "quiz.numberOfQuestions": "Kérdések száma",
  "quiz.start": "Indítás",
  "quiz.submit": "Beküldés",
  "quiz.next": "Következő",
  "quiz.finish": "Befejezés",
  "quiz.question": "Kérdés",
  "quiz.of": "/",
  "quiz.score": "Pontszám",
  "quiz.correct": "Helyes",
  "quiz.wrong": "Hibás",
  "quiz.yourAnswer": "A te válaszod",
  "quiz.correctAnswer": "Helyes válasz",
  "quiz.answer1": "Válasz 1",
  "quiz.answer2": "Válasz 2",
  "quiz.exampleQuestions": "Példa kérdések",
  "quiz.difficulty": "Nehézség",
  "quiz.easy": "Könnyű",
  "quiz.medium": "Közepes",
  "quiz.hard": "Nehéz",

  "history.title": "Előzmények",
  "history.quizType": "Kvíz típus",
  "history.date": "Dátum",
  "history.score": "Pontszám",
  "history.status": "Állapot",
  "history.completed": "Befejezett",
  "history.inProgress": "Folyamatban",
  "history.finished": "Befejezve",
  "history.started": "Elkezdve",
  "history.noSessions": "Nincsenek munkamenetek.",
  "history.student": "Tanuló",
  "history.details": "Részletek",
  "history.teacherReview": "Tanári értékelés",
  "history.parentSignoff": "Szülői jóváhagyás",

  "review.selectTemplate": "Válassz sablont...",
  "review.submitReview": "Értékelés beküldése",
  "review.submitSignoff": "Jóváhagyás",
  "review.comment": "Megjegyzés",
  "review.signoffDisabled": "A jóváhagyáshoz először tanári értékelés szükséges",
  "review.reviewSubmitted": "Az értékelés sikeresen beküldve",
  "review.signoffSubmitted": "A jóváhagyás sikeresen beküldve",

  "teacher.myStudents": "Tanulóim",
  "teacher.addStudent": "Tanuló hozzáadása",
  "teacher.removeStudent": "Tanuló eltávolítása",
  "teacher.studentEmail": "Tanuló e-mail címe",
  "teacher.recentSessions": "Legutóbbi munkamenetek",
  "teacher.reviewSession": "Munkamenet értékelése",
  "teacher.noStudents": "Nincsenek társított tanulók.",

  "parent.myChildren": "Gyermekeim",
  "parent.addChild": "Gyermek hozzáadása",
  "parent.removeChild": "Gyermek eltávolítása",
  "parent.childEmail": "Gyermek e-mail címe",
  "parent.recentSessions": "Legutóbbi munkamenetek",
  "parent.noChildren": "Nincsenek társított gyermekek.",

  "admin.userManagement": "Felhasználókezelés",
  "admin.quizTypeEditor": "Kvíztípus szerkesztő",
  "admin.databaseStats": "Adatbázis és statisztikák",
  "admin.createUser": "Felhasználó létrehozása",
  "admin.editUser": "Felhasználó szerkesztése",
  "admin.deleteUser": "Felhasználó törlése",
  "admin.roles": "Szerepkörök",
  "admin.resetStats": "Statisztikák visszaállítása",

  "footer.version": "OpenMath v2.6",
  "footer.source": "Forráskód",

  "userGuide.title": "Felhasználói útmutató",
  "userGuide.introduction": "Bevezetés",
  "userGuide.introText": "Az OpenMath egy interaktív matematikai gyakorló portál, amelyet általános iskolás diákoknak, tanáraiknak és szüleiknek terveztek. Időzített kvízeket kínál szorzótáblákból, összeadásból, kivonásból és más aritmetikai témákból. A tanárok és szülők nyomon követhetik a haladást, áttekinthetik a munkameneteket és visszajelzést adhatnak.",
  "userGuide.purpose": "Cél",
  "userGuide.purposeText": "A fő cél, hogy segítse a gyerekeket a fejszámolás magabiztos és folyékony elsajátításában rendszeres, strukturált gyakorlással és azonnali visszajelzéssel.",
  "userGuide.coreFeatures": "Főbb funkciók",
  "userGuide.feature1": "Időzített matek kvízek állítható nehézséggel",
  "userGuide.feature2": "Azonnali pontozás és válaszok áttekintése",
  "userGuide.feature3": "Teljesítmény-előzmények és statisztikák",
  "userGuide.feature4": "Tanári értékelés és szülői jóváhagyás munkafolyamat",
  "userGuide.feature5": "Értesítési rendszer minden szerepkör-alapú eseményhez",
  "userGuide.gettingStarted": "Első lépések",
  "userGuide.gettingStartedText": "Hozz létre egy fiókot a regisztrációs oldalon a neved, e-mail címed és egy jelszó megadásával. Opcionálisan megadhatod a születésnapodat, nemedet és hogy mely szorzótáblákat tanultad már meg. Regisztráció után jelentkezz be, és a Kezdőoldalra kerülsz, ahol elindíthatsz egy kvízt.",
  "userGuide.takingQuiz": "Kvíz kitöltése",
  "userGuide.takingQuizText": "Válassz kvíz típust a legördülő menüből, állítsd be a kérdések számát, majd kattints az Indítás gombra. Válaszolj minden kérdésre az időkorláton belül. Befejezés után láthatod a pontszámodat, a helyes válaszokat és a teljesítményed összefoglalóját.",
  "userGuide.yourProfile": "Profilod",
  "userGuide.yourProfileText": "A Profil oldalon megtekintheted és szerkesztheted a személyes adataidat, láthatod az összesített teljesítmény-statisztikáidat, és ellenőrizheted, mely tanárok és szülők vannak a fiókodhoz társítva.",
  "userGuide.notifications": "Értesítések",
  "userGuide.notificationsText": "A fejlécben lévő harang ikon mutatja az olvasatlan értesítéseid számát. Kattints rá a legutóbbi események megtekintéséhez, mint például új társítások, kvíz befejezések, értékelések és szerepkör-változások. Az értesítéseket egyesével vagy egyszerre is olvasottnak jelölheted.",
  "userGuide.history": "Előzmények",
  "userGuide.historyText": "Az Előzmények oldal felsorolja az összes korábbi kvíz munkamenetedet. Kattints bármelyikre a teljes részletek megtekintéséhez, beleértve minden kérdést, a válaszodat, a helyes választ, valamint az esetleges tanári értékelést vagy szülői jóváhagyást.",
  "userGuide.teacherSection": "Tanár — Tanulóim",
  "userGuide.teacherSectionText": "A tanárok e-mail cím alapján adhatnak hozzá tanulókat a Tanári kezelőfelületen. A társítás után láthatod tanulóid legutóbbi munkameneteit, értékelheted kvízeiket, és visszajelzést hagyhatsz sablon üzenetek vagy szabad szöveges megjegyzések használatával.",
  "userGuide.parentSection": "Szülő — Gyermekem",
  "userGuide.parentSectionText": "A szülők e-mail cím alapján kapcsolhatják össze gyermekük fiókját a Szülői kezelőfelületen. Megtekintheted gyermeked legutóbbi munkameneteit, láthatod a tanári értékeléseket, és jóváhagyhatod az értékelt munkameneteket saját visszajelzéseddel.",
  "userGuide.adminUsers": "Admin — Felhasználókezelés",
  "userGuide.adminUsersText": "Az adminok megtekinthetik az összes felhasználót, létrehozhatnak új felhasználókat meghatározott szerepkörökkel, szerkeszthetik a felhasználói adatokat, kezelhetik a szerepkör-hozzárendeléseket és törölhetnek fiókokat.",
  "userGuide.adminQuizTypes": "Admin — Kvíztípus szerkesztő",
  "userGuide.adminQuizTypesText": "Az adminok létrehozhatnak, szerkeszthetnek és törölhetnek kvíztípusokat. Minden kvíztípus meghatározza a műveletet, nehézségi tartományt, számformátumot és a Kezdőoldalon megjelenő példakérdéseket.",
  "userGuide.adminDatabase": "Admin — Adatbázis és statisztikák",
  "userGuide.adminDatabaseText": "Az adminok megtekinthetik az adatbázis-táblák statisztikáit és visszaállíthatják az összes kvízadatot tesztelési célokra."
}
```

### 5.3 Locale service

**`angular-app/src/app/core/services/locale.service.ts`** (new file):

```typescript
import { Injectable, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { PrimeNGConfig } from 'primeng/api';

const PRIMENG_HU = {
  dayNames: ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'],
  dayNamesShort: ['Vas', 'Hét', 'Kedd', 'Sze', 'Csüt', 'Pén', 'Szo'],
  dayNamesMin: ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'],
  monthNames: [
    'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
    'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'
  ],
  monthNamesShort: [
    'Jan', 'Feb', 'Már', 'Ápr', 'Máj', 'Jún',
    'Júl', 'Aug', 'Szep', 'Okt', 'Nov', 'Dec'
  ],
  today: 'Ma',
  clear: 'Törlés',
  dateFormat: 'yy.mm.dd',
  firstDayOfWeek: 1,
  accept: 'Igen',
  reject: 'Nem',
  choose: 'Válassz',
  upload: 'Feltöltés',
  cancel: 'Mégse',
  weak: 'Gyenge',
  medium: 'Közepes',
  strong: 'Erős',
  passwordPrompt: 'Adj meg egy jelszót',
  emptyMessage: 'Nincs találat',
  emptyFilterMessage: 'Nincs találat',
};

const PRIMENG_EN = {
  // PrimeNG defaults are already English — only override dateFormat
  dateFormat: 'mm/dd/yy',
  firstDayOfWeek: 0,
};

@Injectable({ providedIn: 'root' })
export class LocaleService {
  private transloco = inject(TranslocoService);
  private primeConfig = inject(PrimeNGConfig);

  /** Switch active locale and update PrimeNG config */
  setLocale(locale: 'en' | 'hu'): void {
    this.transloco.setActiveLang(locale);
    this.applyPrimeNGLocale(locale);
  }

  getLocale(): string {
    return this.transloco.getActiveLang();
  }

  /** Initialize from user profile locale */
  initFromProfile(locale: string): void {
    const lang = locale === 'hu' ? 'hu' : 'en';
    this.setLocale(lang);
  }

  /** Get the PrimeNG Calendar dateFormat for active locale */
  getCalendarDateFormat(): string {
    return this.getLocale() === 'hu' ? 'yy.mm.dd' : 'yy-mm-dd';
  }

  private applyPrimeNGLocale(locale: string): void {
    if (locale === 'hu') {
      this.primeConfig.setTranslation(PRIMENG_HU);
    } else {
      this.primeConfig.setTranslation(PRIMENG_EN);
    }
  }
}
```

### 5.4 Auth model changes

**`angular-app/src/app/models/auth.model.ts`** — Add `locale`:

```typescript
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  birthday?: string | null;
  gender?: string | null;
  learnedTimetables?: number[];
  locale?: string;  // 'en' | 'hu'
}

export interface MeResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  roles: string[];
  age: number | null;
  birthday: string | null;
  gender: string | null;
  authProvider: string;
  learnedTimetables: number[];
  locale: string;  // 'en' | 'hu'
}

export interface AdminCreateUserRequest {
  name: string;
  email: string;
  password: string;
  birthday?: string | null;
  gender?: string | null;
  role?: string;
  learnedTimetables?: number[];
  locale?: string;  // 'en' | 'hu'
}
```

**`angular-app/src/app/models/user.model.ts`** — Add `locale` to `UpdateUserRequest`:

```typescript
export interface UpdateUserRequest {
  name?: string;
  age?: number;
  gender?: string;
  learnedTimetables?: number[];
  birthday?: string;
  email?: string;
  locale?: string;  // 'en' | 'hu'
}
```

### 5.5 Auth service — initialize locale on login

**`angular-app/src/app/core/services/auth.service.ts`** — After `/me` response, call `LocaleService.initFromProfile(user.locale)`:

```typescript
// In loadUser() or wherever MeResponse is consumed:
this.localeService.initFromProfile(meResponse.locale);
```

### 5.6 Component template changes — replace hardcoded strings

All components switch from hardcoded English to `transloco` pipe or structural directive.

**Pattern — Before:**
```html
<h3>Create your account</h3>
<label>Email</label>
<button>Register</button>
```

**Pattern — After:**
```html
<ng-container *transloco="let t">
  <h3>{{ t('auth.createAccount') }}</h3>
  <label>{{ t('auth.email') }}</label>
  <button>{{ t('auth.register') }}</button>
</ng-container>
```

**Components to update (all `.component.ts` files with inline templates):**

| # | Component | Key changes |
|---|---|---|
| 1 | `register.component.ts` | Form labels, placeholders, button, gender options, error messages. Add locale dropdown. |
| 2 | `login.component.ts` | Form labels, placeholders, button, links, Google button |
| 3 | `profile.component.ts` | All labels, stats labels, association headers, toast messages. Add locale dropdown. |
| 4 | `header.component.ts` | Logout button, confirm dialog text, notification labels |
| 5 | `footer.component.ts` | Version text, source link text |
| 6 | `user-guide.component.ts` | All section headings and prose paragraphs |
| 7 | `quiz.component.ts` | Start form labels, question UI, result summary, answer labels |
| 8 | `history-list.component.ts` | Table headers, status labels, empty state |
| 9 | `session-detail.component.ts` | Detail labels, review section, sign-off section |
| 10 | `teacher-dashboard.component.ts` | Section headers, table headers, review UI, template dropdown |
| 11 | `parent-dashboard.component.ts` | Section headers, table headers, sign-off UI, template dropdown |
| 12 | `start.component.ts` | Quiz selection form, example questions heading |
| 13 | `admin-dashboard.component.ts` | Tab labels, table headers, action buttons |
| 14 | `quiz-type-editor.component.ts` | Dialog labels, form fields |
| 15 | `database-stats.component.ts` | Headers, reset button, table labels |

### 5.7 Header — language selector

Add a language toggle/dropdown to the header, between the notification bell and logout button:

```html
<!-- Language selector -->
<span class="text-500">|</span>
<p-dropdown
  [options]="languageOptions"
  [(ngModel)]="selectedLanguage"
  (onChange)="onLanguageChange($event)"
  [style]="{ minWidth: '80px' }"
  optionLabel="label"
  optionValue="value">
</p-dropdown>
<span class="text-500">|</span>
```

```typescript
languageOptions = [
  { label: 'EN', value: 'en' },
  { label: 'HU', value: 'hu' },
];

selectedLanguage = 'en';

onLanguageChange(event: any) {
  this.localeService.setLocale(event.value);
  // Optionally persist to backend
  this.api.patch(`/users/${this.auth.user()?.id}`, { locale: event.value }).subscribe();
}
```

### 5.8 Registration — language dropdown

Add locale selection to the registration form (after gender, before timetables):

```html
<div class="field">
  <label>{{ t('auth.language') }}</label>
  <p-dropdown
    [options]="languageOptions"
    [(ngModel)]="locale"
    optionLabel="label"
    optionValue="value">
  </p-dropdown>
</div>
```

The selected locale is sent in the `RegisterRequest` and also applied immediately via `LocaleService.setLocale()` on change so the registration form itself switches language.

### 5.9 Profile — language dropdown

Add locale selection in the Edit Profile form (after gender):

```html
<div class="field">
  <label>{{ t('profile.language') }}</label>
  <p-dropdown
    [options]="languageOptions"
    [(ngModel)]="editLocale"
    optionLabel="label"
    optionValue="value"
    (onChange)="onLocaleChange($event)">
  </p-dropdown>
</div>
```

On save, include `locale` in the `UpdateUserRequest`. On change, immediately switch the active locale so the user sees the effect.

### 5.10 Date formatting

Angular's `DatePipe` respects `LOCALE_ID`. With Transloco handling runtime switching, configure a dynamic approach:

**Option A — Custom date pipe** (recommended):

```typescript
@Pipe({ name: 'localDate', standalone: true })
export class LocalDatePipe implements PipeTransform {
  private localeService = inject(LocaleService);

  transform(value: string | Date | null, format: string = 'short'): string {
    if (!value) return '';
    const locale = this.localeService.getLocale() === 'hu' ? 'hu-HU' : 'en-US';
    return formatDate(value, format, locale);
  }
}
```

Replace all `| date:'short'` with `| localDate:'short'` and `| date:'mediumDate'` with `| localDate:'mediumDate'` across all templates.

**Usage locations (11 occurrences):**
- `teacher-dashboard.component.ts` (3×)
- `parent-dashboard.component.ts` (3×)
- `session-detail.component.ts` (1×)
- `history-list.component.ts` (2×)
- `header.component.ts` (1×)
- `profile.component.ts` (1×)

### 5.11 Review templates — locale-aware loading

When loading review templates from the API, pass the active locale:

```typescript
// Before:
this.api.get('/notifications/review-templates?role=teacher')

// After:
this.api.get(`/notifications/review-templates?role=teacher&locale=${this.localeService.getLocale()}`)
```

Update in `teacher-dashboard.component.ts` and `parent-dashboard.component.ts`.

### 5.12 PrimeNG Calendar — locale-aware date format

Replace hardcoded `dateFormat="yy-mm-dd"` with dynamic format:

```html
<!-- Before -->
<p-calendar dateFormat="yy-mm-dd" ...>

<!-- After -->
<p-calendar [dateFormat]="localeService.getCalendarDateFormat()" ...>
```

Update in `register.component.ts` and `profile.component.ts`.

---

## 6. Implementation Steps

| # | Area | Task | Files |
|---|---|---|---|
| 1 | DB | Create migration `0016_user_locale.sql` | `db/migrations/0016_user_locale.sql` |
| 2 | DB | Create migration `0017_review_templates_locale.sql` | `db/migrations/0017_review_templates_locale.sql` |
| 3 | DB | Run migrations | `scripts/apply-migrations.ps1` |
| 4 | Backend | Add `locale` to auth schemas (`RegisterRequest`, `AdminCreateUserRequest`, `MeResponse`) | `python-api/app/schemas/auth.py` |
| 5 | Backend | Add `locale` to user schemas (`UpdateUserRequest`, `UserProfileOut`) | `python-api/app/schemas/user.py` |
| 6 | Backend | Update `create_user_with_auth()` query — accept and INSERT locale | `python-api/app/queries.py` |
| 7 | Backend | Update `find_user_by_id()`, `find_user_by_email()` — SELECT locale | `python-api/app/queries.py` |
| 8 | Backend | Update `update_user()` — accept and SET locale | `python-api/app/queries.py` |
| 9 | Backend | Update register endpoint — pass locale | `python-api/app/routers/auth.py` |
| 10 | Backend | Update `/me` response — include locale | `python-api/app/routers/auth.py` |
| 11 | Backend | Add `NOTIFICATION_MESSAGES` locale dict | `python-api/app/routers/notifications.py` |
| 12 | Backend | Update notification creation — use recipient locale | `python-api/app/routers/notifications.py` |
| 13 | Backend | Update `list_review_templates()` — filter by locale | `python-api/app/queries.py` |
| 14 | Backend | Update `GET /review-templates` — accept `locale` query param | `python-api/app/routers/notifications.py` |
| 15 | Frontend | Install `@jsverse/transloco` | `angular-app/package.json` |
| 16 | Frontend | Create `TranslocoHttpLoader` | `angular-app/src/app/transloco-loader.ts` |
| 17 | Frontend | Configure Transloco in `app.config.ts` | `angular-app/src/app/app.config.ts` |
| 18 | Frontend | Create `en.json` translation file | `angular-app/src/assets/i18n/en.json` |
| 19 | Frontend | Create `hu.json` translation file | `angular-app/src/assets/i18n/hu.json` |
| 20 | Frontend | Create `LocaleService` | `angular-app/src/app/core/services/locale.service.ts` |
| 21 | Frontend | Create `LocalDatePipe` | `angular-app/src/app/shared/pipes/local-date.pipe.ts` |
| 22 | Frontend | Add `locale` to auth models (`RegisterRequest`, `MeResponse`, `AdminCreateUserRequest`) | `angular-app/src/app/models/auth.model.ts` |
| 23 | Frontend | Add `locale` to user model (`UpdateUserRequest`) | `angular-app/src/app/models/user.model.ts` |
| 24 | Frontend | Init locale from profile in `AuthService` | `angular-app/src/app/core/services/auth.service.ts` |
| 25 | Frontend | Add language selector to header | `angular-app/src/app/shared/components/header/header.component.ts` |
| 26 | Frontend | Translate `register.component.ts` — add Transloco + locale dropdown | `angular-app/src/app/features/auth/register.component.ts` |
| 27 | Frontend | Translate `login.component.ts` — add Transloco | `angular-app/src/app/features/auth/login.component.ts` |
| 28 | Frontend | Translate `profile.component.ts` — add Transloco + locale dropdown | `angular-app/src/app/features/profile/profile.component.ts` |
| 29 | Frontend | Translate `header.component.ts` — Transloco for logout/notifications | `angular-app/src/app/shared/components/header/header.component.ts` |
| 30 | Frontend | Translate `footer.component.ts` | `angular-app/src/app/shared/components/footer/footer.component.ts` |
| 31 | Frontend | Translate `user-guide.component.ts` — full content via translation keys | `angular-app/src/app/features/user-guide/user-guide.component.ts` |
| 32 | Frontend | Translate `quiz.component.ts` + `start.component.ts` | `angular-app/src/app/features/quiz/quiz.component.ts`, `start.component.ts` |
| 33 | Frontend | Translate `history-list.component.ts` + `session-detail.component.ts` | `angular-app/src/app/features/history/*.component.ts` |
| 34 | Frontend | Translate `teacher-dashboard.component.ts` — review templates with locale | `angular-app/src/app/features/teacher/teacher-dashboard.component.ts` |
| 35 | Frontend | Translate `parent-dashboard.component.ts` — sign-off templates with locale | `angular-app/src/app/features/parent/parent-dashboard.component.ts` |
| 36 | Frontend | Translate `admin-dashboard.component.ts` + `quiz-type-editor.component.ts` | `angular-app/src/app/features/admin/*.component.ts` |
| 37 | Frontend | Translate `database-stats.component.ts` | `angular-app/src/app/features/admin/database-stats.component.ts` |
| 38 | Frontend | Replace all `| date` pipes with `| localDate` (11 occurrences) | Multiple template files |
| 39 | Frontend | Replace hardcoded `dateFormat="yy-mm-dd"` with dynamic format | `register.component.ts`, `profile.component.ts` |
| 40 | Frontend | Update footer version to v2.6 | `angular-app/src/app/shared/components/footer/footer.component.ts` |
| 41 | Test | Verify EN locale — all pages render correctly | Manual |
| 42 | Test | Switch to HU — verify all translations display | Manual |
| 43 | Test | Verify date formatting changes per locale | Manual |
| 44 | Test | Verify review templates load in correct language | Manual |
| 45 | Test | Verify notifications created with recipient locale | Manual |
| 46 | Test | Verify registration with locale selection | Manual |
| 47 | Test | Verify profile locale change persists and applies | Manual |

---

## 7. Translation Key Naming Convention

Use **dot-separated flat keys** with feature prefix:

```
{feature}.{element}
```

Examples:
- `auth.login` — Login button text
- `profile.editProfile` — Profile page heading
- `quiz.startQuiz` — Start quiz button
- `common.save` — Shared save button text
- `userGuide.introText` — User guide introduction paragraph

**Rules:**
1. Common/shared keys use `common.` prefix
2. Feature-specific keys use feature name prefix (`auth.`, `profile.`, `quiz.`, etc.)
3. Use camelCase for the element part
4. Long prose (user guide) uses descriptive suffixes (`introText`, `purposeText`, etc.)

---

## 8. Locale Lifecycle

```
Registration                 Login                         Runtime
┌──────────┐           ┌───────────┐              ┌─────────────────┐
│ User picks│──locale──▶│ POST      │              │ Header dropdown │
│ EN or HU  │          │ /register │              │ changes locale  │
│ in form   │          │ (locale   │              │                 │
└──────────┘           │  saved)   │              └────────┬────────┘
                       └─────┬─────┘                       │
                             │                             │
                       ┌─────▼─────┐              ┌───────▼────────┐
                       │ GET /me   │              │ PATCH /users/id│
                       │ returns   │──locale──▶   │ { locale: hu } │
                       │ locale    │              └───────┬────────┘
                       └─────┬─────┘                      │
                             │                            │
                       ┌─────▼─────┐              ┌──────▼─────────┐
                       │ AuthSvc   │              │ LocaleService  │
                       │ initFrom  │──────────▶   │ setLocale(hu)  │
                       │ Profile() │              │ → Transloco    │
                       └───────────┘              │ → PrimeNG cfg  │
                                                  └────────────────┘
```

---

## 9. Adding Future Languages

To add a new language (e.g., `de` — German):

1. **DB**: Add `'de'` to the `chk_users_locale` CHECK constraint
2. **DB**: Seed German review templates with `locale = 'de'`
3. **Backend**: Update regex pattern on `locale` fields: `r"^(en|hu|de)$"`
4. **Backend**: Add `"de"` entries to `NOTIFICATION_MESSAGES` dict
5. **Frontend**: Create `angular-app/src/assets/i18n/de.json`
6. **Frontend**: Add `'de'` to `availableLangs` in `app.config.ts`
7. **Frontend**: Add German PrimeNG translations to `LocaleService`
8. **Frontend**: Add `{ label: 'DE', value: 'de' }` to language dropdown options

---

## 10. Data Protection Notes

- **Locale is not sensitive data** — stored as a simple string preference
- **Translation files are public assets** — no access control needed
- **Review templates are per-locale** — ensure admin UI shows locale column if templates become editable
- **Backend error messages** — remain in English for logging; frontend overrides for display
- **Notification messages** — generated per recipient locale at creation time; changing locale does not retroactively translate existing notifications
