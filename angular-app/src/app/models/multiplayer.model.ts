export interface MultiplayerGame {
  id: string;
  game_code: string;
  host_user_id: string;
  host_name?: string;
  quiz_type_id: string;
  quiz_type_code?: string;
  quiz_type_description?: string;
  difficulty: string;
  total_questions: number;
  penalty_seconds: number;
  min_players: number;
  max_players: number;
  status: string;
  player_count: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface MultiplayerPlayer {
  id: string;
  user_id: string;
  user_name?: string;
  slot_number: number;
  is_ready: boolean;
  correct_count: number;
  wrong_count: number;
  total_time_ms?: number;
  penalty_time_ms: number;
  final_position?: number;
  joined_at: string;
  finished_at?: string;
}

export interface GameDetail {
  game: MultiplayerGame;
  players: MultiplayerPlayer[];
}

export interface MultiplayerQuestion {
  id: string;
  position: number;
  prompt?: any;
  a?: number;
  b?: number;
  c?: number;
  d?: number;
  correct?: string;
}

export interface MultiplayerAnswer {
  id: string;
  player_id: string;
  question_id: string;
  value?: string;
  is_correct: boolean;
  lap_time_ms: number;
  penalty_ms: number;
  answered_at: string;
}

export interface ChatMessage {
  id?: string;
  sender: string;
  sender_id?: string;
  text: string;
  time: string;
  user_name?: string;
}

export interface GameMessage {
  type: string;
  payload: any;
  timestamp: string;
}

export interface CreateGameRequest {
  quizTypeCode: string;
  difficulty: string;
  totalQuestions: number;
  penaltySeconds: number;
  minPlayers: number;
  maxPlayers: number;
  learnedTimetables?: number[];
}

export interface CreateGameResponse {
  gameCode: string;
  gameId: string;
  status: string;
}

export interface PositionEntry {
  player_id: string;
  player_name: string;
  pos: number;
  completed: number;
  total_time: number;
  finished: boolean;
}

export interface GameResult {
  player_id: string;
  name: string;
  position: number;
  correct_count: number;
  wrong_count: number;
  total_time_ms: number;
  penalty_time_ms: number;
}

export interface HistoryGame {
  id: string;
  game_code: string;
  host_name?: string;
  quiz_type_code?: string;
  quiz_type_description?: string;
  difficulty: string;
  total_questions: number;
  penalty_seconds: number;
  player_count: number;
  status: string;
  winner_name?: string;
  winner_time_ms?: number;
  created_at: string;
  completed_at?: string;
}

export interface HistoryDetail {
  game: MultiplayerGame;
  players: MultiplayerPlayer[];
  questions: MultiplayerQuestion[];
  answers: MultiplayerAnswer[];
  chat: ChatMessage[];
}
