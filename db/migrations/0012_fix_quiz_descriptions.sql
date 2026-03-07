-- Migration 0012: Replace → with = in quiz type descriptions
-- v2.4: Arrow-to-equals cleanup

UPDATE quiz_types SET description = REPLACE(description, '→', '=') WHERE description LIKE '%→%';
