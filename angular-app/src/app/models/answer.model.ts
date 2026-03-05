export interface SubmitAnswerRequest {
  questionId: string;
  response?: {
    raw: string;
    parsed: Record<string, any>;
  };
  value?: number;
}

export interface SubmitAnswerResponse {
  isCorrect: boolean;
  correctValue: number;
  session: {
    correct: number;
    wrong: number;
    percent: number;
  };
}
