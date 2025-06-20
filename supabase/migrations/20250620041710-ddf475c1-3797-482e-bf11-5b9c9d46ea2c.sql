
-- Create user profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create game categories table
CREATE TABLE public.game_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create games table
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.game_categories(id),
  difficulty_level INTEGER DEFAULT 1 CHECK (difficulty_level >= 1 AND difficulty_level <= 5),
  game_type TEXT NOT NULL CHECK (game_type IN ('quiz', 'puzzle', 'vocabulary', 'logic', 'matching')),
  game_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user game progress table
CREATE TABLE public.user_game_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0,
  best_score INTEGER DEFAULT 0,
  completion_time INTEGER, -- in seconds
  attempts INTEGER DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, game_id)
);

-- Create user points/rewards table
CREATE TABLE public.user_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  badges JSONB DEFAULT '[]',
  streak_days INTEGER DEFAULT 0,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_game_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Create RLS policies for game categories (public read)
CREATE POLICY "Anyone can view game categories" ON public.game_categories FOR SELECT USING (true);

-- Create RLS policies for games (public read)
CREATE POLICY "Anyone can view active games" ON public.games FOR SELECT USING (is_active = true);

-- Create RLS policies for user game progress
CREATE POLICY "Users can view own progress" ON public.user_game_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON public.user_game_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.user_game_progress FOR UPDATE USING (auth.uid() = user_id);

-- Create RLS policies for user rewards
CREATE POLICY "Users can view own rewards" ON public.user_rewards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own rewards" ON public.user_rewards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rewards" ON public.user_rewards FOR UPDATE USING (auth.uid() = user_id);

-- Insert sample game categories
INSERT INTO public.game_categories (name, description, icon) VALUES
('Vocabulary', 'Word games and language learning', '📚'),
('Logic', 'Critical thinking and problem solving', '🧩'),
('Math', 'Number games and calculations', '🔢'),
('Memory', 'Memory training and recall games', '🧠'),
('Trivia', 'General knowledge quizzes', '❓');

-- Insert sample games
INSERT INTO public.games (title, description, category_id, difficulty_level, game_type, game_config) VALUES
('Word Match', 'Match words with their definitions', 
 (SELECT id FROM public.game_categories WHERE name = 'Vocabulary'), 
 1, 'matching', 
 '{"timeLimit": 300, "wordPairs": []}'),
('Quick Math', 'Solve math problems quickly', 
 (SELECT id FROM public.game_categories WHERE name = 'Math'), 
 2, 'quiz', 
 '{"timeLimit": 60, "operations": ["add", "subtract"]}'),
('Logic Puzzle', 'Solve pattern-based puzzles', 
 (SELECT id FROM public.game_categories WHERE name = 'Logic'), 
 3, 'puzzle', 
 '{"gridSize": 4, "patternType": "sequence"}');

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  
  INSERT INTO public.user_rewards (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
