-- v2.75: Seed the basic-fractions quiz type with render_mode = katex
INSERT INTO quiz_types (code, description, template_kind, answer_type, category, recommended_age_min, recommended_age_max, is_active, sort_order, render_mode)
VALUES ('basic_fractions', 'Basic Fractional Numbers', 'basic_fractions', 'text', 'fractions', 8, 14, true, 200, 'katex')
ON CONFLICT (code) DO NOTHING;
