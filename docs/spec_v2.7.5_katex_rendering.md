# OpenMath Specification — v2.7.5
## KaTeX Rendering for Quiz Types, Session Review, and Fraction-Based Quizzes

**Version:** 2.7.5  
**Status:** Draft Specification  
**Module:** Quiz Rendering / Review UX / Math Formatting

---

# 1. Overview

This specification introduces **KaTeX-based mathematical rendering** to OpenMath.

The goal is to support quiz types that should be displayed as properly formatted mathematical expressions instead of plain text. This is especially useful for fractions and other expressions where standard text rendering is less readable.

This version adds:

- a new `render_mode` property on `quiz_types`
- KaTeX rendering support across quiz play and review flows
- admin configurability per quiz type
- optional KaTeX toggle when viewing session details
- exam-paper style review display
- correction-style visual feedback for wrong answers
- a new fraction-focused quiz type where KaTeX is especially beneficial

---

# 2. Goals

Primary objectives:

1. Allow quiz types to define how math content is rendered
2. Support high-quality formula rendering using KaTeX
3. Preserve backward compatibility for existing text-based quizzes
4. Improve review experience for students, teachers, and parents
5. Make session detail screens look closer to real school exam corrections
6. Introduce a fraction quiz type that benefits strongly from math rendering

---

# 3. Scope

Included in this version:

- `render_mode` field on `quiz_types`
- allowed values: `text` and `katex`
- KaTeX rendering during live quiz sessions
- KaTeX rendering in session history details
- KaTeX rendering during teacher review
- KaTeX rendering during parent review
- review-page toggle for enabling/disabling KaTeX rendering
- exam-paper style corrected answer layout
- new fraction-based quiz type
- admin UI support for changing render mode

Not included in this version:

- symbolic algebra parsing
- advanced equation editor
- handwritten math recognition
- MathML authoring tools
- user-defined formula input syntax beyond supported quiz content generation rules

---

# 4. KaTeX Integration Concept

OpenMath should support two rendering modes for quiz content:

- `text`
- `katex`

When a quiz type uses `text`, rendering stays exactly as it works today.

When a quiz type uses `katex`, quiz expressions must be rendered through KaTeX in all relevant user flows.

This allows OpenMath to keep simple quiz types unchanged while enabling richer rendering for more mathematical content.

---

# 5. Database / Data Model Changes

## 5.1 quiz_types Table

Add a new property:

```text
render_mode = text | katex
```

### Example

| field | type | description |
|------|------|-------------|
| id | uuid / int | quiz type id |
| name | string | quiz type name |
| render_mode | enum/string | `text` or `katex` |

---

## 5.2 Rules

Allowed values:

- `text`
- `katex`

Default value:

- `text`

This ensures backward compatibility for all existing quiz types unless explicitly changed.

---

# 6. Rendering Rules by Mode

## 6.1 text Mode

If `quiz_types.render_mode = text`:

- render question content as plain text
- render answers as plain text
- preserve current behavior
- do not require KaTeX formatting logic

## 6.2 katex Mode

If `quiz_types.render_mode = katex`:

- render question content using KaTeX
- render answer options using KaTeX when applicable
- render submitted answer using KaTeX
- render correct answer using KaTeX
- use KaTeX in live quiz mode
- use KaTeX in session history details
- use KaTeX in teacher review
- use KaTeX in parent review

---

# 7. Areas Where KaTeX Must Be Applied

KaTeX rendering must be supported in the following screens when the quiz type uses `render_mode = katex`:

1. quiz run / live quiz play
2. session detail in history
3. teacher review session
4. parent review session

This ensures consistent rendering across the entire quiz lifecycle.

---

# 8. Admin Configuration

## 8.1 Quiz Type Admin

In **Admin → Quiz Types**, add a configurable field for rendering mode.

### Admin field

```text
Render Mode: [ text | katex ]
```

### Behavior

- admins can set render mode per quiz type
- changing render mode affects future rendering behavior for that quiz type
- existing stored session content should render according to the quiz type rules and review toggle logic
- default remains `text` for safety and compatibility

---

# 9. Session Detail / Review Toggle

## 9.1 New Checkbox

When viewing:

- session detail in history
- teacher review session
- parent review session

Add a checkbox:

```text
[ ] Enable KaTeX rendering
```

or, when selected:

```text
[x] Enable KaTeX rendering
```

## 9.2 Default State

The checkbox default should be:

- **selected** if `quiz_types.render_mode = katex`
- **unselected** if `quiz_types.render_mode = text`

## 9.3 Purpose

This toggle allows the viewer to switch between:

- raw/plain text style display
- math-rendered display

This is especially useful for review and troubleshooting if some content needs to be seen in plain source-like form.

---

# 10. Exam-Paper Style Corrected Answer Layout

## 10.1 Concept

When reviewing completed quiz sessions (session detail, teacher review, parent review), questions and answers should be displayed **exactly like a corrected school exam paper** — not in a data table or developer-style grid.

This applies to **all quiz types** regardless of `render_mode`:

- `text` mode → plain-text exam-paper style
- `katex` mode → KaTeX-rendered exam-paper style (fractions etc. look even more authentic)

The goal is to make the review screen look like a teacher has just marked a student's exercise sheet with a red pen.

## 10.2 Layout Rules

Each question occupies one line (or a compact block), displayed as a **complete equation** with the student's submitted answer filled in as the result:

```
  {number}.   {operand} {operator} {operand} = {student_answer}   {correction_mark}
```

Key layout rules:

- questions are rendered vertically, one per line, with consistent left alignment
- numbering is sequential: `1.`, `2.`, `3.`, …
- the full expression is shown inline: question + `=` + student's answer
- correction marking appears to the right of the answer
- generous vertical spacing between questions (like lined exercise paper)
- no table borders, no grid cells — free-flowing exam-paper feel
- font should be slightly larger than normal UI text (resembling handwritten exercise sheets)

## 10.3 Correct Answers

When the student's answer is **correct**:

- display the full equation with the answer: `5 × 4 = 20`
- add a **red/green checkmark** (✓) to the right of the answer
- the checkmark uses a handwriting-style or standard check icon
- no additional text needed — the tick speaks for itself

Visual example (text mode):

```
  1.   5 × 4  =  20   ✓
  2.   5 × 2  =  10   ✓
```

Visual example (KaTeX mode):

```
  1.   \frac{1}{2} + \frac{1}{2}  =  1   ✓
```

## 10.4 Wrong Answers

When the student's answer is **wrong**:

- display the full equation with the student's wrong answer
- the **wrong answer** is shown with a **red strikethrough** (line through the number)
- the **correct answer** is written next to / below the struck-through answer in **red ink**
- mimics a teacher crossing out the wrong answer and writing the correct one beside it

Visual example (text mode):

```
  3.   3 × 5  =  ̶2̶5̶   15
```

Here:
- `25` is the student's wrong answer, displayed with red strikethrough
- `15` is the correct answer, displayed in red to the right

Visual example (KaTeX mode):

```
  2.   \frac{1}{4} × 3  =  \frac{̶1̶}{̶2̶}   \frac{3}{4}
```

Here:
- `\frac{1}{2}` is the student's wrong answer, rendered in KaTeX with red strikethrough
- `\frac{3}{4}` is the correct answer, rendered in KaTeX in red

## 10.5 CSS / Styling Spec

```css
/* Exam paper container */
.exam-paper {
  max-width: 700px;
  padding: 1.5rem;
  font-size: 1.25rem;          /* larger text like exercise sheets */
  line-height: 2.5;            /* generous line spacing */
  font-family: inherit;        /* or a slightly more "handwritten" feel */
}

/* Each question line */
.exam-question {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

/* Question number */
.exam-question-number {
  min-width: 2rem;
  text-align: right;
  color: #333;
}

/* Correct answer checkmark */
.exam-correct-mark {
  color: #e53935;              /* red pen color — matching real teacher marking */
  font-size: 1.4rem;
  margin-left: 0.5rem;
}

/* Wrong answer — student's answer struck through */
.exam-wrong-answer {
  text-decoration: line-through;
  text-decoration-color: #e53935;
  text-decoration-thickness: 2px;
  color: #999;
}

/* Wrong answer — correct answer shown in red */
.exam-correct-answer {
  color: #e53935;
  font-weight: 600;
  margin-left: 0.5rem;
}
```

## 10.6 Unanswered Questions

If a question was not answered (quiz abandoned mid-session):

- display the question expression with `= ?` or `= —` at the end
- show a grey dash or "—" marker instead of a correction mark
- no tick, no strikethrough

Visual example:

```
  4.   7 × 3  =  —
```

## 10.7 Summary Section

Below all the question lines, show a compact summary block (like a score written at the bottom of an exam paper):

```
  ─────────────────────────────
  Score:  2 / 3  (67%)
  Time:   0:42
```

This replaces the current card-based summary when exam-paper mode is active. Keep it minimal, like a teacher's final score note at the bottom of the page.

## 10.8 Review Comments

If a teacher review or parent sign-off exists for the session, show it **below** the exam-paper questions section, visually separated — like a note written at the bottom of a marked test:

```
  ─────────────────────────────
  Score:  8 / 10  (80%)
  Time:   2:15

  Teacher note:  "Good effort, practice the 7× table more!"
  Parent sign-off:  ✓  "Well done, keep it up"
```

---

# 11. Exam-Paper Mode Activation

## 11.1 When to Show Exam-Paper Style

The exam-paper corrected view should be the **default** display mode for:

- session detail page (history)
- teacher review dialog / page
- parent review dialog / page

## 11.2 Toggle Behavior

A toggle or tab should allow switching between:

- **Exam paper view** — the corrected exam-paper layout described above
- **Table view** — the existing p-table-based question list (current behavior)

The toggle label:

```
  [📝 Exam Paper]   [📊 Table]
```

Default selection: **Exam Paper** (when quiz type has `render_mode = katex`, or configurable).

## 11.3 KaTeX Checkbox Interaction

When in exam-paper view:

- The KaTeX checkbox (section 9) controls whether math expressions are rendered via KaTeX or shown as plain text
- Both text and KaTeX versions use the same exam-paper layout — only the expression rendering differs

---

# 12. Exam-Paper Style for All Quiz Types

## 12.1 Multiplication / Arithmetic

The exam-paper style works naturally with all arithmetic quiz types:

```
  1.   5 × 4  =  20   ✓
  2.   5 × 2  =  10   ✓
  3.   3 × 5  =  ̶2̶5̶   15
```

## 12.2 Addition / Subtraction

```
  1.   23 + 17  =  40   ✓
  2.   50 − 28  =  ̶32̶   22
```

## 12.3 Sums & Products (multi-operand)

```
  1.   (3 × 4) + (2 × 5)  =  22   ✓
  2.   (6 × 2) + (3 × 3)  =  ̶20̶   21
```

## 12.4 Roman Numerals / Conversions

```
  1.   27  =  XXVII   ✓
  2.   43  =  ̶X̶L̶I̶I̶   XLIII
```

## 12.5 Fractions (KaTeX)

With `render_mode = katex`:

```
  1.   ½ + ½  =  1   ✓
  2.   ¼ × 3  =  ̶½̶   ¾
```

These render as proper KaTeX fractions — the most visually impactful use of exam-paper style.

---

# 13. Angular Component Structure

## 13.1 ExamPaperView Component

A new reusable Angular component should render the exam-paper view:

```text
selector:     app-exam-paper-view
inputs:       questions, katexEnabled
standalone:   true
```

This component:

- receives the question list with answers and correctness data
- renders each question line in exam-paper style
- applies KaTeX rendering when `katexEnabled = true`
- applies strikethrough + red correction for wrong answers
- shows checkmark for correct answers
- displays the score summary and review comments at the bottom

## 13.2 Usage Locations

The exam-paper component should be embedded in:

- `session-detail.component.ts` (history)
- teacher review dialog in `teacher-dashboard.component.ts`
- parent review dialog in `parent-dashboard.component.ts`

Each location provides a view toggle (exam paper vs. table) and a KaTeX checkbox.

## 13.3 Data Requirements per Question

Each question object passed to the exam-paper component must include:

```typescript
{
  position: number;          // 1-based question number
  expression: string;        // e.g. "5 × 4" or "\frac{1}{2} + \frac{1}{2}"
  correct: number | string;  // correct answer
  answer?: {
    value: number | string;  // student's submitted answer
    is_correct: boolean;
  };
}
```

The component handles rendering logic based on `answer.is_correct` and `katexEnabled`.

---

# 14. KaTeX Content Source Rules

For quiz types using `render_mode = katex`, question and answer content must be stored or generated in KaTeX-compatible syntax.

Examples:

```text
\frac{1}{2} + \frac{1}{2}
\frac{1}{4} \times 3
\frac{3}{5} - \frac{1}{5}
```

This means content generation logic for relevant quiz types must output valid KaTeX expressions.

---

# 15. Error Handling / Fallback

KaTeX rendering failures must not break quiz or review pages.

If a KaTeX expression fails to render:

- show the raw source text as fallback
- log the rendering issue
- do not block quiz completion or review display

This is important for resilience in production.

---

# 16. New Quiz Type: Basic Fractional Numbers

Add a new quiz type focused on basic fractions where KaTeX rendering provides clear value.

## 16.1 Quiz Type Name

Suggested name:

```text
Basic Fractional Numbers
```

Alternative internal slug example:

```text
basic-fractions
```

## 16.2 Render Mode

Default render mode for this new quiz type:

```text
katex
```

## 16.3 Purpose

This quiz type helps students practice simple fractional arithmetic with clearly formatted expressions.

---

# 17. Fraction Quiz Examples

Examples of supported exercises:

- `\frac{1}{2} + \frac{1}{2} = ?`
- `\frac{1}{4} \times 3 = ?`
- `\frac{3}{4} - \frac{1}{4} = ?`
- `\frac{2}{3} + \frac{1}{3} = ?`
- `\frac{1}{5} \times 2 = ?`
- `1 - \frac{1}{4} = ?`

These should render as proper mathematical fractions instead of plain-text slash notation.

---

# 18. Fraction Quiz Functional Rules

The first version of the fraction quiz type should focus on simple, school-friendly arithmetic.

Recommended initial scope:

- fraction addition with same denominator
- fraction subtraction with same denominator
- multiplication of fraction by whole number
- simple equivalence-style outcomes where result remains intuitive

Examples:

- `\frac{1}{2} + \frac{1}{2} = 1`
- `\frac{1}{4} \times 3 = \frac{3}{4}`
- `\frac{3}{5} - \frac{1}{5} = \frac{2}{5}`

Out of scope for initial version:

- complex fraction simplification engine
- mixed numbers
- division by fractions
- variable algebra
- advanced symbolic transformations

---

# 19. Backend / API Impact

The backend must support `render_mode` in quiz type responses and review/session detail payloads.

## 19.1 Quiz Type API

Quiz type payloads should include:

```json
{
  "id": "fraction-basic",
  "name": "Basic Fractional Numbers",
  "render_mode": "katex"
}
```

## 19.2 Session Detail API

Session detail responses should provide enough data to render:

- question content
- user answer
- correct answer
- correctness status
- quiz type render mode

The frontend can then apply KaTeX rendering based on:

- quiz type render mode
- user-selected checkbox state

---

# 20. Frontend Requirements

Frontend responsibilities include:

- loading KaTeX assets/library
- rendering question/answer expressions when enabled
- preserving plain-text fallback
- supporting the review-page checkbox state
- showing correction-style formatting
- showing green tick for correct answers
- showing red underline + red correct answer for wrong answers

Suggested UI behavior:

- render after content load
- re-render when checkbox changes
- avoid full page reload when toggling
- keep accessibility in mind for screen readability

---

# 21. Teacher and Parent Review Experience

Teachers and parents should see the same improved mathematical presentation in review screens.

## 21.1 Teacher Review

Teacher review page should support:

- KaTeX checkbox
- corrected exam-paper view
- teacher comments alongside rendered math content

## 21.2 Parent Review

Parent review page should support:

- KaTeX checkbox
- corrected exam-paper view
- easier readability of what student answered versus correct answer

This helps make home review clearer and more educational.

---

# 22. Backward Compatibility

This feature must not change behavior for existing quiz types unless admins opt in.

Compatibility rules:

- existing quiz types default to `render_mode = text`
- existing quizzes continue rendering as before
- KaTeX becomes active only for quiz types explicitly configured with `katex`
- session detail checkbox still allows manual enable/disable view behavior where supported

---

# 23. Suggested Migration

Recommended schema change:

```text
ALTER TABLE quiz_types ADD COLUMN render_mode VARCHAR(20) NOT NULL DEFAULT 'text';
```

Optional follow-up seed/update:

- set `render_mode = 'katex'` for the new Basic Fractional Numbers quiz type
- keep all existing quiz types on `text` initially

---

# 24. Acceptance Criteria

This spec is considered implemented when all of the following are true:

1. `quiz_types` contains a new `render_mode` property
2. allowed values are `text` and `katex`
3. existing quiz types continue to work with default `text`
4. quiz run renders KaTeX when render mode is `katex`
5. session history detail supports KaTeX rendering
6. teacher review supports KaTeX rendering
7. parent review supports KaTeX rendering
8. session/review pages include an enable/disable KaTeX checkbox
9. checkbox defaults to selected when quiz type render mode is `katex`
10. exam-paper style layout renders questions as inline equations (one per line)
11. correct answers show a red/green checkmark (✓) to the right of the answer
12. wrong answers show the student's answer with red strikethrough
13. wrong answers show the correct answer in red next to the struck-through answer
14. unanswered questions show `—` with no correction marks
15. exam-paper view includes a score summary at the bottom
16. review comments (teacher/parent) appear below the score summary
17. a view toggle allows switching between exam-paper and table views
18. exam-paper style works for all quiz types (multiplication, addition, roman, fractions, etc.)
19. a new Basic Fractional Numbers quiz type exists
20. the new fraction quiz type defaults to `render_mode = katex`
21. rendering failures fall back safely to text

---

# 25. Suggested Repository / Documentation Additions

Suggested spec filename:

```text
docs/specs/v2.75-katex-rendering.md
```

Potential implementation areas:

```text
frontend/src/app/quiz/
frontend/src/app/session-history/
frontend/src/app/review/
backend/quiz_types/
backend/sessions/
database/migrations/
```

---

# 26. Future Enhancements

Potential next improvements:

- more advanced fraction operations
- mixed numbers support
- exponent rendering
- algebra quiz types
- formula preview in admin quiz type editor
- server-side validation of KaTeX expressions
- printable exam-paper PDF export using math rendering
- MathML interoperability if needed later

---

# 27. Summary

Version 2.75 adds KaTeX-based rendering to OpenMath through a new `render_mode` property on quiz types.

It allows the system to:

- keep plain-text quiz types unchanged
- render fraction and formula-heavy quizzes more clearly
- improve session history and review screens
- present corrected answers in a school-style exam-paper format
- introduce a new basic fractions quiz type where KaTeX clearly improves usability

This creates a strong foundation for richer math-focused quiz content in future releases.
