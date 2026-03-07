<template>
  <main class="page">
    <h1>User Guide</h1>
    <p>
      OpenMath helps students improve accuracy and speed. The main objective is to achieve the highest correct score in the
      least amount of time.
    </p>

    <section class="card">
      <h2>Quick Start Workflow</h2>
      <ol>
        <li>Select an <strong>Active user</strong> in the top bar, or leave empty to create a new user from Start.</li>
        <li>Go to <strong>Start</strong>, choose quiz type and difficulty, then start the quiz.</li>
        <li>Answer all questions and submit each answer to complete the session.</li>
        <li>Use <strong>History</strong> to review score, time spent, and average time per question.</li>
        <li>Repeat quizzes and aim for better accuracy with lower completion time.</li>
      </ol>
    </section>

    <section class="card">
      <h2>Create and Manage Users</h2>
      <ul>
        <li>
          <strong>Create new user:</strong> in <strong>Start</strong>, keep active user as "No user", fill name/profile, and
          start a quiz.
        </li>
        <li><strong>Switch user:</strong> use the <strong>Active user</strong> selector in the header.</li>
        <li>
          <strong>Edit profile:</strong> open <strong>Profile</strong> to update name, age, gender, and learned timetables.
        </li>
      </ul>
    </section>

    <section class="card">
      <h2>How to Take a Test</h2>
      <ul>
        <li>Open <strong>Start</strong>.</li>
        <li>Select <strong>Quiz type</strong>, <strong>Difficulty</strong>, and total question count.</li>
        <li>Submit answers one by one until session completion.</li>
        <li>For unfinished sessions, open <strong>History</strong> and click <strong>In progress</strong> to resume.</li>
      </ul>
    </section>

    <section class="card">
      <h2>Review History and Improve</h2>
      <ul>
        <li><strong>History</strong> groups sessions by quiz type.</li>
        <li>Use "Show only active user results" to focus on one user.</li>
        <li>Check these key metrics:</li>
      </ul>
      <ul class="metrics">
        <li><strong>Score %</strong> → correctness quality.</li>
        <li><strong>Time Spent</strong> → total duration for each quiz.</li>
        <li><strong>Avg / Question</strong> → speed indicator per question.</li>
      </ul>
      <p>
        Best performance means combining high score with low time: be both correct and fast.
      </p>
    </section>

    <section class="card">
      <h2>Menu Points</h2>
      <ul>
        <li><strong>Start</strong>: create a session and begin a quiz.</li>
        <li><strong>Profile</strong>: edit user preferences and view performance statistics.</li>
        <li><strong>History</strong>: review sessions, resume unfinished quizzes, and inspect summaries.</li>
        <li><strong>User Guide</strong>: this page with usage instructions.</li>
        <li><strong>Database Statistics</strong>: admin-style table counts, data browsing, and reset actions.</li>
        <li><strong>Active user (top selector)</strong>: sets the current user across all pages.</li>
      </ul>
    </section>

    <NuxtLink to="/">Go to Start</NuxtLink>
  </main>
</template>

<style scoped>
.page {
  max-width: 60rem;
  margin: 2rem auto;
  padding: 0 1rem;
  display: grid;
  gap: 1rem;
}

.card {
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1rem;
  display: grid;
  gap: 0.75rem;
}

ol,
ul {
  margin: 0;
  padding-left: 1.25rem;
}

.metrics {
  margin-top: -0.25rem;
}
</style>
