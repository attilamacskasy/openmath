export interface Prompt {
  template?: Record<string, any>;
  expr?: Record<string, any>;
  answer: { type: string; options?: string[]; arity?: number };
  render: string;
  constraints?: Record<string, any>;
}

export interface QuestionOut {
  id: string;
  position: number;
  prompt: Prompt;
}

export interface CreateSessionRequest {
  difficulty: string;
  totalQuestions: number;
  quizTypeCode?: string;
  userId?: string | null;
  userName?: string;
  userAge?: number | null;
  userGender?: string | null;
  learnedTimetables?: number[];
}

export interface CreateSessionResponse {
  sessionId: string;
  quizTypeCode: string;
  quizTypeDescription: string;
  quizTypeCategory: string;
  questions: QuestionOut[];
}

export interface SessionListItem {
  id: string;
  user_id: string | null;
  difficulty: string;
  total_questions: number;
  score_percent: number;
  started_at: string;
  finished_at: string | null;
  user_name: string | null;
  quiz_type_code: string | null;
  quiz_type_description: string | null;
}

export interface SessionDetailQuestion {
  id: string;
  sessionId: string;
  position: number;
  prompt: Prompt | null;
  correct: number;
  a: number | null;
  b: number | null;
  c: number | null;
  d: number | null;
  answer: {
    id: string;
    response: Record<string, any>;
    is_correct: boolean;
    answered_at: string;
    value?: number;
  } | null;
}

export interface SessionDetailSession {
  id: string;
  user_id: string | null;
  quiz_type_id: string;
  difficulty: string;
  total_questions: number;
  correct_count: number;
  wrong_count: number;
  score_percent: string;
  started_at: string;
  finished_at: string | null;
  userName: string | null;
  quizTypeCode: string | null;
}

export interface SessionDetail {
  session: SessionDetailSession;
  questions: SessionDetailQuestion[];
}
