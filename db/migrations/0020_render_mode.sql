-- v2.75: Add render_mode to quiz_types for KaTeX rendering support
ALTER TABLE quiz_types ADD COLUMN render_mode VARCHAR(20) NOT NULL DEFAULT 'text';
