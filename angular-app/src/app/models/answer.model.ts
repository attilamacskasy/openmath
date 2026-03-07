export interface SubmitAnswerRequest {
  questionId: string;
  response?: {
    raw: string;
    parsed: Record<string, any>;
  };
  value?: number | string;
}

export interface SubmitAnswerResponse {
  isCorrect: boolean;
  correctValue: number | string;
  session: {
    correct: number;
    wrong: number;
    percent: number;
  };
}
