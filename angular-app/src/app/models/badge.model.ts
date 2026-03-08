export interface Badge {
  id: string;
  code: string;
  name_en: string;
  name_hu: string;
  description_en: string;
  description_hu: string;
  icon: string;
  category: string;
  sort_order: number;
}

export interface UserBadge {
  id: string;
  badge: Badge;
  awarded_at: string;
  session_id: string | null;
}

export interface BadgeSummary {
  code: string;
  name_en: string;
  name_hu: string;
  icon: string;
}

export interface TimetableMastery {
  table: number;
  attempts: number;
  accuracy: number;
  mastered: boolean;
}
