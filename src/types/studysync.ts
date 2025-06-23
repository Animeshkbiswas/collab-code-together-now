
export interface EmotionSnapshot {
  id: string;
  user_id: string;
  video_id: string;
  timestamp: number;
  emotions: {
    engagement: number;
    confusion: boolean;
    distraction: boolean;
    confidence: number;
  };
  created_at: string;
}

export interface PlaylistItem {
  id: string;
  playlist_id: string;
  video_id: string;
  title: string;
  thumbnail_url?: string;
  duration?: number;
  position: number;
  progress: number;
  created_at: string;
}

export interface Playlist {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  is_auto_generated: boolean;
  generation_criteria?: any;
  created_at: string;
  updated_at: string;
  playlist_items?: PlaylistItem[];
}

export interface LearningMilestone {
  id: string;
  user_id: string;
  video_id: string;
  milestone_percentage: 25 | 50 | 75;
  game_type: 'term-match' | 'concept-sort' | 'timeline-challenge';
  completed: boolean;
  score: number;
  completion_time?: number;
  created_at: string;
}

export interface GameData {
  type: 'term-match' | 'concept-sort' | 'timeline-challenge';
  title: string;
  description: string;
  config: any;
}

export interface YouTubePlayerState {
  currentTime: number;
  duration: number;
  playerState: number;
  isPlaying: boolean;
}
