
# OpenMath Specification — v2.7
## Badge System, Incentives, PDF Certificates, and Session Export

**Version:** 2.7  
**Status:** Draft Specification  
**Module:** Gamification / Incentives / Reporting

---

# 1. Overview

The **Incentive System** introduces gamification features designed to improve student engagement and motivation through achievements, visible progress, and recognition.

This module includes:

- Badge / Achievement system
- Leaderboards
- PDF Certificates for milestones
- PDF export of quiz sessions
- Progress tracking and visual mastery indicators

The system must be **fully automated**, **scalable**, and **extensible**, allowing new achievements or certificates to be added without major code changes.

---

# 2. Goals

Primary objectives:

1. Encourage frequent practice
2. Reward learning milestones
3. Provide measurable progress indicators
4. Allow teachers and parents to recognize student achievements
5. Generate printable reports and certificates
6. Increase student motivation through friendly competition

---

# 3. Architecture Overview

The Incentive System is composed of several subsystems:

```
Quiz Engine
     │
     ▼
Session Results
     │
     ▼
Achievement Engine
     │
     ├── Badge Evaluation
     ├── Streak Tracking
     ├── Milestone Detection
     │
     ▼
Badge Awarded
     │
     ├── Stored in database
     ├── Notification shown to student
     └── Optional certificate generation
```

---

# 4. Badge System

## 4.1 Concept

Badges are **permanent achievements** awarded automatically when a student fulfills specific conditions.

Badges are:

- Visible on the student profile
- Displayed on dashboards
- Optionally shareable
- Stored permanently in the database

Badges may be granted:

- Immediately after a quiz
- After cumulative milestones
- After streak achievements

---

# 4.2 Badge Examples

### Speed Demon
Complete a **10-question quiz in under 60 seconds**

### Perfect Score
Score **100% on a quiz session**

### Streak Master
Answer **5 questions correctly in a row**

### First Quiz
Complete the **first quiz session**

### Timetable Champion
Achieve **100% accuracy on hard difficulty for all timetables (1–10)**

### Practice Makes Perfect
Complete **50 quiz sessions**

### Daily Learner
Complete **one quiz per day for 7 consecutive days**

### Multi‑Talent
Score **above 80% on all available quiz types**

---

# 5. Badge Database Model

### badges

| field | type | description |
|-----|-----|-----|
| id | uuid | badge id |
| name | string | badge name |
| description | text | badge explanation |
| icon | string | icon asset |
| rule_type | string | rule engine identifier |
| created_at | timestamp | creation time |

### user_badges

| field | type | description |
|-----|-----|-----|
| id | uuid |
| user_id | uuid |
| badge_id | uuid |
| awarded_at | timestamp |
| session_id | uuid nullable |

---

# 6. Achievement Evaluation Engine

The achievement engine runs after each quiz session.

### Workflow

```
Student completes quiz
        │
        ▼
Session stored
        │
        ▼
Achievement engine triggered
        │
        ├── Check score rules
        ├── Check streak rules
        ├── Check milestone rules
        └── Check daily activity
        │
        ▼
New badges detected
        │
        ▼
Insert into user_badges
        │
        ▼
Notification shown to student
```

---

# 7. Leaderboards

Leaderboards allow students to compare progress.

### Types

**Weekly Leaderboard**
- resets every week

**All‑Time Leaderboard**
- cumulative results

### Ranking Metrics

Leaderboard ranking can use:

- Average score
- Total quizzes completed
- Fastest average quiz time

### Filters

Leaderboards must support:

- quiz type
- difficulty
- time range

### Display

Leaderboard entries show:

- rank
- student name
- avatar
- score metrics

Students may **opt out** of leaderboard participation via profile settings.

---

# 8. Certificates (PDF Generation)

## 8.1 Purpose

Certificates provide official recognition for learning achievements and milestones.

They are:

- downloadable
- printable
- branded with OpenMath identity

---

## 8.2 Example Certificate

Example text:

"Anna completed 100 multiplication quizzes with an average score of 92%"

---

## 8.3 Certificate Contents

Certificates must include:

- student name
- milestone description
- quiz type
- difficulty level
- date range
- number of quizzes
- number of questions answered
- accuracy percentage
- OpenMath branding
- signature line (optional)

---

## 8.4 Generation

Certificates are generated **server-side**.

Recommended libraries:

- `reportlab`
- `weasyprint`
- `wkhtmltopdf`

PDF generation endpoint:

```
GET /api/certificates/{certificate_id}/download
```

---

# 9. Session PDF Export

Students, teachers, or parents can export quiz sessions to PDF.

This allows:

- progress review
- teacher feedback
- printed homework review

---

## 9.1 Export Contents

Session PDF includes:

- student name
- quiz date
- quiz type
- difficulty
- total questions
- correct answers
- incorrect answers
- time taken
- full list of questions
- student answers
- correct answers
- teacher comments (if present)

---

## 9.2 Export API

```
GET /api/sessions/{session_id}/export-pdf
```

Permissions:

- student (own sessions)
- teacher (class sessions)
- parent (child sessions)

---

# 10. Progress Tracking

Students can visually track mastery progress.

Progress metrics include:

- accuracy per timetable
- completion counts
- improvement over time

---

## 10.1 Timetable Mastery

Displayed as progress bars:

```
1 × table   ██████████ 100%
2 × table   ████████░░ 80%
3 × table   ██████░░░░ 60%
```

---

## 10.2 Mastery Definition

Mastery =

```
accuracy >= 90%
AND
minimum attempts >= 10
```

---

# 11. Progress Charts

Charts display:

- score improvement over time
- quiz frequency
- difficulty progression

Recommended libraries:

- Chart.js
- Recharts
- ECharts

---

# 12. Notifications

Students receive notifications when:

- earning a badge
- reaching a milestone
- unlocking a certificate

Example:

```
🎉 New Badge Unlocked!
Speed Demon — completed a quiz in under 60 seconds!
```

---

# 13. Extensibility

The system must allow:

- adding new badges without schema changes
- adding new certificate types
- defining rule-based achievements

Future examples:

- Class competitions
- Teacher‑assigned goals
- Seasonal events

---

# 14. Security & Privacy

Requirements:

- Students can hide leaderboard ranking
- Parents can view child achievements
- Teachers can review progress
- Certificates include verification metadata

---

# 15. Future Enhancements

Potential future improvements:

- shareable achievement links
- printable sticker badges
- school-level leaderboards
- AI-based learning milestones
- classroom competitions
