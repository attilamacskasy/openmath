export interface StudentListItem {
  id: string;
  name: string;
}

export interface PerformanceBucket {
  quiz_type_code: string;
  quiz_type_description: string;
  sessions: number;
  completed_sessions: number;
  in_progress_sessions: number;
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  average_score_percent: number;
  total_time_seconds: number;
}

export interface StudentPerformanceStats {
  overall: PerformanceBucket;
  by_quiz_type: PerformanceBucket[];
}

export interface StudentProfile {
  id: string;
  name: string;
  age: number | null;
  gender: string | null;
  learned_timetables: number[];
  stats: StudentPerformanceStats;
}

export interface UpdateStudentRequest {
  name: string;
  age: number | null;
  gender: string | null;
  learned_timetables: number[];
  birthday?: string | null;
}
