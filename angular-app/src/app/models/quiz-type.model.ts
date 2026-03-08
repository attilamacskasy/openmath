export interface QuizType {
  id: string;
  code: string;
  description: string;
  answer_type: string;
  template_kind: string | null;
  category: string | null;
  recommended_age_min: number | null;
  recommended_age_max: number | null;
  is_active: boolean;
  sort_order: number;
  render_mode: string;
}

export interface QuizTypeCreate {
  code: string;
  description: string;
  template_kind: string;
  answer_type: string;
  category?: string | null;
  recommended_age_min?: number | null;
  recommended_age_max?: number | null;
  is_active?: boolean;
  sort_order?: number;
  render_mode?: string;
}

export interface QuizTypeUpdate {
  description?: string;
  template_kind?: string;
  answer_type?: string;
  category?: string | null;
  recommended_age_min?: number | null;
  recommended_age_max?: number | null;
  is_active?: boolean;
  sort_order?: number;
  render_mode?: string;
}

export interface PreviewQuestion {
  render: string;
  correct: string;
  answer_type: string;
}
