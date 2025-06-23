import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress as ProgressBar } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Playlist, PlaylistItem } from '@/types/studysync';
import { 
  Calendar, 
  Clock, 
  Trophy, 
  Target, 
  TrendingUp, 
  BookOpen, 
  Zap, 
  BarChart3,
  Play,
  CheckCircle,
  CalendarDays,
  Flame
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';

interface LearningStats {
  totalVideosWatched: number;
  totalWatchTime: number;
  averageEngagement: number;
  streakDays: number;
  totalPoints: number;
  level: number;
  playlistsCompleted: number;
  videosCompleted: number;
}

interface DailyActivity {
  date: string;
  videosWatched: number;
  watchTime: number;
  engagement: number;
  points: number;
}

const Progress = () => {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const [stats, setStats] = useState<LearningStats>({
    totalVideosWatched: 0,
    totalWatchTime: 0,
    averageEngagement: 0,
    streakDays: 0,
    totalPoints: 0,
    level: 1,
    playlistsCompleted: 0,
    videosCompleted: 0
  });
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [youtubePlaylistUrl, setYoutubePlaylistUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchPlaylists(),
        fetchUserStats(),
        fetchDailyActivity()
      ]);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlaylists = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('playlists')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setPlaylists(data);
    }
  };

  const fetchPlaylistItems = async (playlistId: string) => {
    const { data } = await supabase
      .from('playlist_items')
      .select('*')
      .eq('playlist_id', playlistId)
      .order('position');

    if (data) {
      setPlaylistItems(data);
    }
  };

  const fetchUserStats = async () => {
    if (!user) return;

    // Fetch user rewards
    const { data: rewardsData } = await supabase
      .from('user_rewards')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Fetch video progress
    const { data: progressData } = await supabase
      .from('user_game_progress')
      .select('*')
      .eq('user_id', user.id);

    // Fetch emotion data for engagement calculation
    const { data: emotionData } = await supabase
      .from('emotion_snapshots')
      .select('*')
      .eq('user_id', user.id);

    // Calculate stats
    const totalVideosWatched = progressData?.length || 0;
    const totalWatchTime = progressData?.reduce((sum, p) => sum + (p.video_progress || 0), 0) || 0;
    const averageEngagement = emotionData?.length > 0 
      ? emotionData.reduce((sum, e) => sum + (e.emotions.engagement || 0), 0) / emotionData.length 
      : 0;
    const videosCompleted = progressData?.filter(p => (p.video_progress || 0) >= 90).length || 0;

    setStats({
      totalVideosWatched,
      totalWatchTime,
      averageEngagement: Math.round(averageEngagement),
      streakDays: rewardsData?.streak_days || 0,
      totalPoints: rewardsData?.total_points || 0,
      level: rewardsData?.level || 1,
      playlistsCompleted: playlists.filter(p => 
        playlistItems.filter(item => item.progress >= 90).length === playlistItems.length
      ).length,
      videosCompleted
    });
  };

  const fetchDailyActivity = async () => {
    if (!user) return;

    // Generate last 7 days of activity data
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    // Mock data for now - in real app, fetch from database
    const mockActivity = last7Days.map(date => ({
      date,
      videosWatched: Math.floor(Math.random() * 5) + 1,
      watchTime: Math.floor(Math.random() * 120) + 30,
      engagement: Math.floor(Math.random() * 40) + 60,
      points: Math.floor(Math.random() * 50) + 10
    }));

    setDailyActivity(mockActivity);
  };

  const handlePlaylistSelect = async (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    await fetchPlaylistItems(playlist.id);
  };

  const getLevelProgress = () => {
    return ((stats.totalPoints % 1000) / 1000) * 100;
  };

  const getStreakEmoji = (days: number) => {
    if (days >= 7) return '🔥';
    if (days >= 3) return '⚡';
    return '💪';
  };

  const createPlaylist = async () => {
    if (!user || !newPlaylistTitle.trim()) return;
    const { error } = await supabase.from('playlists').insert({
      user_id: user.id,
      title: newPlaylistTitle.trim(),
      description: 'Custom playlist'
    });
    if (!error) {
      setNewPlaylistTitle('');
      setShowCreateDialog(false);
      fetchPlaylists();
      toast({
        title: "Playlist Created",
        description: "Your new playlist has been created successfully!"
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to create playlist. Please try again.",
        variant: "destructive"
      });
    }
  };

  const importYouTubePlaylist = async () => {
    if (!selectedPlaylist || !youtubePlaylistUrl.trim()) {
      toast({
        title: "Error",
        description: "Please select a playlist and enter a YouTube playlist URL before importing.",
        variant: "destructive"
      });
      return;
    }
    const extractPlaylistId = (url: string) => {
      const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
      return match ? match[1] : null;
    };
    const playlistId = extractPlaylistId(youtubePlaylistUrl.trim());
    if (!playlistId) {
      toast({
        title: "Error",
        description: "Invalid YouTube playlist URL.",
        variant: "destructive"
      });
      return;
    }
    const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
    if (!YOUTUBE_API_KEY) {
      toast({
        title: "Error",
        description: "YouTube API key not configured.",
        variant: "destructive"
      });
      return;
    }
    setIsImporting(true);
    try {
      let nextPageToken = '';
      let allVideos: { videoId: string; title: string }[] = [];
      do {
        const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${YOUTUBE_API_KEY}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        const videos = (data.items || []).map((item: any) => ({
          videoId: item.snippet.resourceId.videoId,
          title: item.snippet.title
        }));
        allVideos = allVideos.concat(videos);
        nextPageToken = data.nextPageToken;
      } while (nextPageToken);
      const { data: existingItems } = await supabase
        .from('playlist_items')
        .select('position')
        .eq('playlist_id', selectedPlaylist.id);
      const maxPosition = existingItems && existingItems.length > 0
        ? Math.max(...existingItems.map((item: any) => item.position))
        : -1;
      let position = maxPosition + 1;
      let successCount = 0;
      let failCount = 0;
      let errorMessages: string[] = [];
      for (const video of allVideos) {
        const { error } = await supabase.from('playlist_items').insert({
          playlist_id: selectedPlaylist.id,
          video_id: video.videoId,
          title: video.title,
          position: position++,
          progress: 0
        });
        if (!error) {
          successCount++;
        } else {
          failCount++;
          errorMessages.push(`${video.title}: ${error.message}`);
        }
      }
      setYoutubePlaylistUrl('');
      setShowImportDialog(false);
      fetchPlaylistItems(selectedPlaylist.id);
      if (failCount === 0) {
        toast({
          title: "Playlist Imported",
          description: `Imported ${successCount} videos from YouTube playlist!`
        });
      } else {
        toast({
          title: "Partial Import",
          description: `Imported ${successCount} videos. ${failCount} failed. See console for details.`,
          variant: "destructive"
        });
        console.error('Failed to import videos:', errorMessages);
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || 'Failed to import playlist.',
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  };

  if (loading) {
    return (
      <div>
        <Navbar />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Learning Progress</h1>
            <p className="text-gray-600">Track your learning journey and achievements</p>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Videos</CardTitle>
                <BookOpen className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalVideosWatched}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.videosCompleted} completed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Watch Time</CardTitle>
                <Clock className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(stats.totalWatchTime / 60)}m</div>
                <p className="text-xs text-muted-foreground">
                  {Math.round(stats.totalWatchTime / 60 / 60)}h total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Streak</CardTitle>
                <Flame className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold flex items-center gap-1">
                  {stats.streakDays} {getStreakEmoji(stats.streakDays)}
                </div>
                <p className="text-xs text-muted-foreground">
                  days in a row
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Level</CardTitle>
                <Trophy className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.level}</div>
                <ProgressBar value={getLevelProgress()} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.totalPoints} points
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="playlists" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="playlists">Playlists</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="activity">Daily Activity</TabsTrigger>
            </TabsList>

            {/* Playlists Tab */}
            <TabsContent value="playlists" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Playlist List */}
                <div className="lg:col-span-1">
                  <Card className="mb-6">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle>Your Playlists</CardTitle>
                      <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                        + Create Playlist
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {playlists.length === 0 ? (
                          <p className="text-gray-500 text-sm">No playlists yet. Create your first playlist!</p>
                        ) : (
                          playlists.map((playlist) => (
                            <div
                              key={playlist.id}
                              className={`p-3 border rounded cursor-pointer transition-colors ${
                                selectedPlaylist?.id === playlist.id ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
                              }`}
                              onClick={() => handlePlaylistSelect(playlist)}
                            >
                              <div className="flex justify-between items-center">
                                <div>
                                  <h4 className="font-medium">{playlist.title}</h4>
                                  {playlist.description && (
                                    <p className="text-sm text-gray-600">{playlist.description}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Playlist Details */}
                <div className="lg:col-span-2">
                  {selectedPlaylist ? (
                    <Card className="mb-6">
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Playlist Videos</CardTitle>
                        <Button size="sm" variant="secondary" onClick={() => setShowImportDialog(true)}>
                          Import YouTube Playlist
                        </Button>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {playlistItems.length === 0 ? (
                            <p className="text-gray-500 text-sm">No videos in this playlist yet.</p>
                          ) : (
                            playlistItems.map((item) => (
                              <div
                                key={item.id}
                                className="flex justify-between items-center p-3 border rounded hover:bg-blue-50 cursor-pointer transition-colors"
                                onClick={() => navigate('/', { state: { videoId: item.video_id, title: item.title } })}
                              >
                                <div>
                                  <h5 className="font-medium">{item.title}</h5>
                                  <span className="text-xs text-gray-500">{item.progress}% complete</span>
                                </div>
                                <Button size="sm" variant="secondary" onClick={e => { e.stopPropagation(); navigate('/', { state: { videoId: item.video_id, title: item.title } }); }}>
                                  Play
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="flex items-center justify-center h-64">
                        <div className="text-center text-gray-500">
                          <BookOpen className="h-12 w-12 mx-auto mb-4" />
                          <p>Select a playlist to view details</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Engagement Overview</CardTitle>
                    <CardDescription>Your average engagement over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span>Average Engagement</span>
                        <span className="text-2xl font-bold text-green-600">{stats.averageEngagement}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Total Points Earned</span>
                        <span className="text-2xl font-bold text-blue-600">{stats.totalPoints}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Playlists Completed</span>
                        <span className="text-2xl font-bold text-purple-600">{stats.playlistsCompleted}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Learning Streak</CardTitle>
                    <CardDescription>Your daily learning consistency</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-orange-600 mb-2">
                        {stats.streakDays} {getStreakEmoji(stats.streakDays)}
                      </div>
                      <p className="text-gray-600">Current streak</p>
                      <div className="mt-4">
                        <Badge variant="outline" className="text-sm">
                          {stats.streakDays >= 7 ? '🔥 On Fire!' : 
                           stats.streakDays >= 3 ? '⚡ Building Momentum' : 
                           '💪 Keep Going!'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Daily Activity Tab */}
            <TabsContent value="activity" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Last 7 Days Activity</CardTitle>
                  <CardDescription>Your daily learning activity</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {dailyActivity.map((day) => (
                      <div key={day.date} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-4">
                          <CalendarDays className="h-5 w-5 text-gray-400" />
                          <div>
                            <p className="font-medium">
                              {new Date(day.date).toLocaleDateString('en-US', { 
                                weekday: 'short', 
                                month: 'short', 
                                day: 'numeric' 
                              })}
                            </p>
                            <p className="text-sm text-gray-600">
                              {day.videosWatched} videos • {day.watchTime} minutes
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-green-600">{day.engagement}% engagement</p>
                          <p className="text-sm text-gray-600">{day.points} points</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Playlist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Playlist name..."
              value={newPlaylistTitle}
              onChange={(e) => setNewPlaylistTitle(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createPlaylist()}
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={createPlaylist}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import YouTube Playlist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded p-2">
              Please select a playlist on the left as the destination before importing a YouTube playlist. If you don't have any playlists, create one first.
            </div>
            <Input
              placeholder="YouTube playlist URL..."
              value={youtubePlaylistUrl}
              onChange={e => setYoutubePlaylistUrl(e.target.value)}
              disabled={isImporting}
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowImportDialog(false)} disabled={isImporting}>
                Cancel
              </Button>
              <Button onClick={importYouTubePlaylist} loading={isImporting} disabled={isImporting || !selectedPlaylist}>
                {isImporting ? 'Importing...' : 'Import Playlist'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Progress;
