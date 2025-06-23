
-- Add YouTube-specific columns to existing tables
ALTER TABLE public.user_game_progress ADD COLUMN youtube_video_id TEXT;
ALTER TABLE public.user_game_progress ADD COLUMN video_progress INTEGER DEFAULT 0 CHECK (video_progress >= 0 AND video_progress <= 100);

-- Create emotion snapshots table
CREATE TABLE public.emotion_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  emotions JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create playlists table
CREATE TABLE public.playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_auto_generated BOOLEAN DEFAULT false,
  generation_criteria JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create playlist items table
CREATE TABLE public.playlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID REFERENCES public.playlists(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  duration INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create learning milestones table
CREATE TABLE public.learning_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  milestone_percentage INTEGER NOT NULL CHECK (milestone_percentage IN (25, 50, 75)),
  game_type TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  score INTEGER DEFAULT 0,
  completion_time INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE public.emotion_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_milestones ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for emotion snapshots
CREATE POLICY "Users can view own emotion data" ON public.emotion_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own emotion data" ON public.emotion_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for playlists
CREATE POLICY "Users can view own playlists" ON public.playlists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own playlists" ON public.playlists FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for playlist items
CREATE POLICY "Users can view playlist items they own" ON public.playlist_items 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.playlists 
      WHERE playlists.id = playlist_items.playlist_id 
      AND playlists.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can manage playlist items they own" ON public.playlist_items 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.playlists 
      WHERE playlists.id = playlist_items.playlist_id 
      AND playlists.user_id = auth.uid()
    )
  );

-- Create RLS policies for learning milestones
CREATE POLICY "Users can view own milestones" ON public.learning_milestones FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own milestones" ON public.learning_milestones FOR ALL USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_emotion_snapshots_user_video ON public.emotion_snapshots(user_id, video_id);
CREATE INDEX idx_emotion_snapshots_timestamp ON public.emotion_snapshots(timestamp);
CREATE INDEX idx_playlist_items_playlist ON public.playlist_items(playlist_id);
CREATE INDEX idx_learning_milestones_user_video ON public.learning_milestones(user_id, video_id);
