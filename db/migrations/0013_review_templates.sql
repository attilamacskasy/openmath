-- v2.5: Template review responses for teachers and parents
CREATE TABLE IF NOT EXISTS review_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reviewer_role TEXT NOT NULL CHECK (reviewer_role IN ('teacher', 'parent')),
    sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    label TEXT NOT NULL,
    message TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed teacher templates
INSERT INTO review_templates (reviewer_role, sentiment, label, message, sort_order) VALUES
  ('teacher', 'positive', 'Excellent work',     'Excellent work! You showed great understanding of the material. Keep it up!', 1),
  ('teacher', 'positive', 'Well done',          'Well done! Your effort really shows. I''m proud of your progress.', 2),
  ('teacher', 'positive', 'Great improvement',  'Great improvement since your last session. You''re getting much stronger at this!', 3),
  ('teacher', 'neutral',  'Good effort',        'Good effort. Review the questions you got wrong and try again to improve your score.', 4),
  ('teacher', 'neutral',  'Keep practicing',    'Keep practicing — you''re on the right track but need more repetition to build fluency.', 5),
  ('teacher', 'neutral',  'Room for growth',    'Solid attempt. Focus on the areas where you made mistakes and ask for help if needed.', 6),
  ('teacher', 'negative', 'Needs more work',    'This topic needs more practice. Please review the material and try again.', 7),
  ('teacher', 'negative', 'Below expectations', 'Your score is below expectations. Let''s work together to identify what''s giving you trouble.', 8),
  ('teacher', 'negative', 'Please retry',       'Too many errors on this session. Please try again after reviewing the correct answers.', 9)
ON CONFLICT DO NOTHING;

-- Seed parent templates
INSERT INTO review_templates (reviewer_role, sentiment, label, message, sort_order) VALUES
  ('parent', 'positive', 'So proud!',           'So proud of you! Your hard work is paying off. Amazing result!', 1),
  ('parent', 'positive', 'Wonderful job',       'Wonderful job! You did really well on this quiz. Let''s celebrate!', 2),
  ('parent', 'positive', 'Keep shining',        'Fantastic effort! You''re doing an incredible job with your maths practice.', 3),
  ('parent', 'neutral',  'Good try',            'Good try! Let''s go over the ones you missed together and see if we can do better next time.', 4),
  ('parent', 'neutral',  'Practice makes perfect', 'Not bad! A bit more practice and you''ll get there. Want to try again together?', 5),
  ('parent', 'neutral',  'Almost there',        'You''re getting closer! Let''s focus on the tricky parts and do one more round.', 6),
  ('parent', 'negative', 'Let''s review',       'This was a tough one. Let''s sit down together and review the questions you found difficult.', 7),
  ('parent', 'negative', 'Need to focus',       'Your score shows we need to spend more time on this topic. Let''s practice together this week.', 8),
  ('parent', 'negative', 'Try again',           'Don''t worry — everyone struggles sometimes. Let''s go through the answers and try again.', 9)
ON CONFLICT DO NOTHING;
