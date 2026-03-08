# OpenMath Specification — v2.75
## KaTeX Rendering for Quiz Types, Session Review, and Fraction-Based Quizzes

**Version:** 2.75  
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

# 10. Exam Paper Review Style

When KaTeX rendering is enabled in session detail or review pages, the session should be displayed in a style closer to a corrected school exam paper.

Goals:

- clearer readability
- visible correctness markers
- teacher-like correction formatting
- easier parent/student understanding

---

# 11. Correct Answer Visual Feedback

## 11.1 Correct Answers

If an answer is correct:

- display the result normally
- add a **green tick** after the result

Example concept:

```text
\frac{1}{2} + \frac{1}{2} = 1   ✓
```

## 11.2 Wrong Answers

If an answer is wrong:

- underline the submitted answer in red
- display the correct answer in red
- make the result feel like a teacher correction on paper

Example concept:

```text
Student answer:  \frac{2}{3}    ← underlined in red
Correct answer:  1               ← shown in red
```

This should look like a school correction rather than a technical validation message.

---

# 12. Review Layout Requirements

In review/session detail pages with KaTeX enabled:

Each question should show:

- question number
- rendered question content
- user answer
- correctness marker
- correct answer when wrong
- optional teacher comment if present
- optional parent comment/sign-off if present

Recommended visual style:

- one question block per row/card/section
- enough spacing to resemble printed exercises
- correction markers aligned clearly
- no cluttered developer-style debug layout

---

# 13. Suggested Review UX Behavior

## 13.1 Correct Answer Example

```text
1.  \frac{1}{2} + \frac{1}{2} = 1    ✓
```

Rendered outcome:

- expression shown with KaTeX
- green tick at end

## 13.2 Incorrect Answer Example

```text
2.  \frac{1}{4} \times 3 = ?
    Your answer:  \frac{1}{2}
    Correct answer:  \frac{3}{4}
```

Rendered outcome:

- question displayed with KaTeX
- submitted answer underlined in red
- correct answer shown in red underneath or beside it

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
10. correct answers show a green tick in exam-style review
11. wrong answers show red underline on submitted answer and red correct answer
12. a new Basic Fractional Numbers quiz type exists
13. the new fraction quiz type defaults to `render_mode = katex`
14. rendering failures fall back safely to text

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
