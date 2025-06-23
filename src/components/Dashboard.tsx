
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Trophy, BookOpen, Target, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { YouTubePlayer } from '@/components/YouTubePlayer';
import { toast } from '@/components/ui/use-toast';

interface UserRewards {
  total_points: number;
  level: number;
  streak_days: number;
}

interface GameCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rewards, setRewards] = useState<UserRewards | null>(null);
  const [categories, setCategories] = useState<GameCategory[]>([]);
  const [videoId, setVideoId] = useState('dQw4w9WgXcQ'); // Default video
  const [inputVideoId, setInputVideoId] = useState('');

  useEffect(() => {
    if (user) {
      fetchUserRewards();
      fetchGameCategories();
    }
  }, [user]);

  const fetchUserRewards = async () => {
    const { data } = await supabase
      .from('user_rewards')
      .select('total_points, level, streak_days')
      .eq('user_id', user?.id)
      .single();
    
    if (data) setRewards(data);
  };

  const fetchGameCategories = async () => {
    const { data } = await supabase
      .from('game_categories')
      .select('*')
      .limit(4);
    
    if (data) setCategories(data);
  };

  const extractVideoId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    return match ? match[1] : url;
  };

  const handleLoadVideo = () => {
    if (!inputVideoId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a YouTube URL or video ID",
        variant: "destructive"
      });
      return;
    }
    
    const extractedId = extractVideoId(inputVideoId.trim());
    setVideoId(extractedId);
    setInputVideoId('');
    
    toast({
      title: "Video Loaded",
      description: "YouTube video loaded successfully!"
    });
  };

  const handleProgressUpdate = (progress: number) => {
    console.log('Video progress:', progress);
  };

  const handleMilestoneReached = (milestone: number) => {
    console.log('Milestone reached:', milestone);
    toast({
      title: "Milestone Reached!",
      description: `You've reached ${milestone}% of the video!`
    });
  };

  const levelProgress = rewards ? ((rewards.total_points % 1000) / 1000) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.email?.split('@')[0]}!
          </h1>
          <p className="text-gray-600">Ready to continue your learning journey?</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Points</CardTitle>
              <Trophy className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rewards?.total_points || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Level</CardTitle>
              <Target className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rewards?.level || 1}</div>
              <Progress value={levelProgress} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Streak Days</CardTitle>
              <Zap className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rewards?.streak_days || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Games Played</CardTitle>
              <BookOpen className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
            </CardContent>
          </Card>
        </div>

        {/* YouTube Player Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Load YouTube Video</CardTitle>
                <CardDescription>Enter a YouTube URL or video ID to start learning with emotion analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter YouTube URL or video ID..."
                    value={inputVideoId}
                    onChange={(e) => setInputVideoId(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleLoadVideo()}
                  />
                  <Button onClick={handleLoadVideo}>Load Video</Button>
                </div>
              </CardContent>
            </Card>

            <YouTubePlayer
              videoId={videoId}
              title="Learning Video"
              onProgressUpdate={handleProgressUpdate}
              onMilestoneReached={handleMilestoneReached}
            />
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Emotion Analysis</CardTitle>
                <CardDescription>Real-time learning effectiveness tracking</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-sm">
                    <div className="flex justify-between mb-1">
                      <span>Engagement</span>
                      <span className="text-green-600">Active</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span>Confusion</span>
                      <span className="text-yellow-600">Low</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Distraction</span>
                      <span className="text-red-600">None</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Learning Progress</CardTitle>
                <CardDescription>Your progress and achievements</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-sm text-gray-600">Video Progress: 0%</div>
                  <div className="text-sm text-gray-600">Milestones: 0/3</div>
                  <div className="text-sm text-gray-600">Games Completed: 0</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-2">
                  <p>• Enter a YouTube video URL or ID above</p>
                  <p>• Watch the video to trigger emotion analysis</p>
                  <p>• Complete mini-games at 25%, 50%, and 75% progress</p>
                  <p>• View your emotion heatmap on the progress bar</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Game Categories */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Game Categories</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((category) => (
              <Card key={category.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="text-center">
                  <div className="text-4xl mb-2">{category.icon}</div>
                  <CardTitle className="text-lg">{category.name}</CardTitle>
                  <CardDescription>{category.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full" 
                    onClick={() => navigate(`/games?category=${category.name.toLowerCase()}`)}
                  >
                    Play Games
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Quick Start */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Start</CardTitle>
            <CardDescription>Jump into a game and start learning!</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <Button onClick={() => navigate('/games')} size="lg">
              Browse All Games
            </Button>
            <Button variant="outline" onClick={() => navigate('/progress')} size="lg">
              View Detailed Progress
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
