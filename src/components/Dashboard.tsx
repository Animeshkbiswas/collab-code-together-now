/**
 * Dashboard Component with Milestone-Based Game System
 * 
 * This component implements a milestone system that:
 * 1. Tracks video progress and triggers milestones at 25%, 50%, and 75%
 * 2. Shows a modal when milestones are reached
 * 3. Allows users to play mini-games or skip
 * 4. Automatically pauses/resumes video playback during modal display
 * 
 * The YouTubePlayer component handles the core milestone logic and video control,
 * while this Dashboard component manages the UI state and modal display.
 */

import React, { useState, useEffect, useRef, useCallback, createContext } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Trophy, 
  BookOpen, 
  Target, 
  Zap, 
  Camera, 
  CameraOff, 
  AlertCircle, 
  Play, 
  Plus, 
  List,
  Pause, 
  RotateCcw, 
  CheckCircle,
  XCircle,
  RefreshCw,
  Activity,
  Info,
  AlertTriangle
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { YouTubePlayer } from '@/components/YouTubePlayer';
import { PlaylistManager } from '@/components/PlaylistManager';
import { WebcamFeed } from './WebcamFeed';
import { useEmotionAnalysis } from '@/hooks/useEmotionAnalysis';
import { toast } from '@/components/ui/use-toast';
import { ChartContainer } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ProgressTab } from './ProgressTab';
import { SummarizerTab } from './SummarizerTab';

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

export const VideoContext = createContext<{ videoId: string | null, videoTitle: string } | undefined>(undefined);

export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [rewards, setRewards] = useState<UserRewards | null>(null);
  const [categories, setCategories] = useState<GameCategory[]>([]);
  const [videoId, setVideoId] = useState<string | null>(null); // No default video
  const [inputVideoId, setInputVideoId] = useState('');
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [showPlaylistManager, setShowPlaylistManager] = useState(false);
  const [currentVideoTitle, setCurrentVideoTitle] = useState('Learning Video');
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const [emotionDetectionPaused, setEmotionDetectionPaused] = useState(true);

  // Milestone system state - removed since YouTubePlayer handles this
  const [progress, setProgress] = useState<number>(0);
  const [showMilestoneModal, setShowMilestoneModal] = useState<boolean>(false);
  const [currentMilestone, setCurrentMilestone] = useState<number | null>(null);

  const { emotionData, isAnalyzing, analyzeFrame, modelStatus, apiHealth, debugInfo, checkAPIHealth } = useEmotionAnalysis(videoId);

  // Mood Timeline state
  const [moodTimeline, setMoodTimeline] = useState<{ time: string; mood: string; value: number }[]>([]);

  // Map emotionData to mood timeline
  useEffect(() => {
    if (emotionData) {
      // Determine main mood (highest value)
      const moodScores = [
        { mood: 'Excited', value: emotionData.engagement },
        { mood: 'Confused', value: emotionData.confusion ? 100 : 0 },
        { mood: 'Focused', value: emotionData.confidence },
        { mood: 'Tired', value: emotionData.distraction ? 100 : 0 },
      ];
      const mainMood = moodScores.reduce((prev, curr) => (curr.value > prev.value ? curr : prev));
      setMoodTimeline((prev) => [
        ...prev.slice(-19),
        { time: new Date().toLocaleTimeString(), mood: mainMood.mood, value: mainMood.value }
      ]);
    }
  }, [emotionData]);

  // Color mapping for moods
  const moodColors: Record<string, string> = {
    Excited: '#22c55e',
    Engaged: '#a21caf',
    Focused: '#2563eb',
    Neutral: '#6b7280',
    Confused: '#eab308',
    Tired: '#ef4444',
  };

  useEffect(() => {
    if (user) {
      fetchUserRewards();
      fetchGameCategories();
      checkCameraPermission();
    }
  }, [user]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (webcamVideoRef.current && modelStatus === 'ready') {
      interval = setInterval(() => {
        analyzeFrame(webcamVideoRef.current!, Date.now() / 1000);
      }, 10000); // 10 seconds (or use EMOTION_MODEL_CONFIG.analysisInterval)
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [analyzeFrame, modelStatus]);

  useEffect(() => {
    if (location.state && location.state.videoId) {
      setVideoId(location.state.videoId);
      setCurrentVideoTitle(location.state.title || 'Learning Video');
      // Clear navigation state so it doesn't override future selections
      window.history.replaceState({}, document.title);
    }
    // eslint-disable-next-line
  }, []);

  // On mount, restore video from localStorage if not set
  useEffect(() => {
    if (!videoId) {
      const saved = localStorage.getItem('dashboard_last_video');
      if (saved) {
        try {
          const { videoId: savedId, videoTitle: savedTitle } = JSON.parse(saved);
          if (savedId) {
            setVideoId(savedId);
            setCurrentVideoTitle(savedTitle || 'Learning Video');
          }
        } catch {}
      }
    }
  }, []);

  const checkCameraPermission = async () => {
    try {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      setCameraPermission(result.state);
      
      result.onchange = () => {
        setCameraPermission(result.state);
      };
    } catch (error) {
      console.log('Permission API not supported, will request when needed');
    }
  };

  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      
      stream.getTracks().forEach(track => track.stop());
      setCameraPermission('granted');
      
      toast({
        title: "Camera Access Granted",
        description: "Emotion analysis is now active!"
      });
    } catch (error) {
      console.error('Camera permission error:', error);
      setCameraPermission('denied');
      
      let errorMessage = "Camera access was denied.";
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = "Camera access was denied. Please enable it in your browser settings.";
        } else if (error.name === 'NotFoundError') {
          errorMessage = "No camera found on your device.";
        } else if (error.name === 'NotSupportedError') {
          errorMessage = "Camera is not supported in your browser.";
        }
      }
      
      toast({
        title: "Camera Access Denied",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

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

  // Whenever a video is loaded, save to localStorage
  const handleVideoSelect = (videoId: string, title: string) => {
    setVideoId(videoId);
    setCurrentVideoTitle(title);
    setShowPlaylistManager(false);
    window.history.replaceState({}, document.title);
    localStorage.setItem('dashboard_last_video', JSON.stringify({ videoId, videoTitle: title }));
    toast({
      title: "Video Loaded",
      description: `Now playing: ${title}`
    });
  };

  const handlePlaylistSelect = (playlistId: string) => {
    // Handle playlist selection if needed
    console.log('Playlist selected:', playlistId);
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
    setCurrentVideoTitle('Custom Video');
    setInputVideoId('');
    localStorage.setItem('dashboard_last_video', JSON.stringify({ videoId: extractedId, videoTitle: 'Custom Video' }));
    toast({
      title: "Video Loaded",
      description: "YouTube video loaded successfully!"
    });
  };

  const handleProgressUpdate = (newProgress: number) => {
    setProgress(newProgress);
  };

  const handleMilestoneReached = (milestone: number) => {
    console.log('Milestone reached:', milestone);
    setCurrentMilestone(milestone);
    setShowMilestoneModal(true);
    toast({
      title: "Milestone Reached!",
      description: `You've reached ${milestone}% of the video!`
    });
  };

  const handleCloseMilestoneModal = () => {
    setShowMilestoneModal(false);
    setCurrentMilestone(null);
  };

  const levelProgress = rewards ? ((rewards.total_points % 1000) / 1000) * 100 : 0;

  // Function to get API status color
  const getApiStatusColor = () => {
    if (apiHealth.isHealthy) return 'text-green-600';
    if (apiHealth.errorCount > 0) return 'text-red-600';
    return 'text-yellow-600';
  };

  // Function to get API status icon
  const getApiStatusIcon = () => {
    if (apiHealth.isHealthy) return <CheckCircle className="h-4 w-4" />;
    if (apiHealth.errorCount > 0) return <XCircle className="h-4 w-4" />;
    return <AlertTriangle className="h-4 w-4" />;
  };

  // Debug: log key state
  useEffect(() => {
    console.log('user:', user);
    console.log('rewards:', rewards);
    console.log('categories:', categories);
    console.log('emotionData:', emotionData);
    console.log('moodTimeline:', moodTimeline);
    console.log('apiHealth:', apiHealth);
  }, [user, rewards, categories, emotionData, moodTimeline, apiHealth]);

  // Add a function to show the milestone popup (reuse existing logic)
  const showMilestonePopup = (message: string) => {
    toast({
      title: 'Milestone!',
      description: message,
      variant: 'default',
    });
  };

  // Detect significant emotion and show popup
  useEffect(() => {
    if (emotionData) {
      // Example: show popup if confusion or excitement is high
      if (emotionData.confusion) {
        showMilestonePopup('High confusion detected! Need a break or help?');
      } else if (emotionData.engagement > 0.8) {
        showMilestonePopup('Great engagement! Keep it up!');
      }
      // Add more emotion triggers as needed
    }
  }, [emotionData]);

  // Fallback UI if user is not loaded
  if (!user) {
    return <div className="flex items-center justify-center min-h-screen text-xl">Loading user...</div>;
  }

  // Mock playlists data for now
  const playlists = [
    { id: '1', name: 'Programming Tutorials', videos: [] },
    { id: '2', name: 'Math Lessons', videos: [] },
    { id: '3', name: 'Science Videos', videos: [] }
  ];

  // Error boundary for main render
  try {
    return (
      <VideoContext.Provider value={{ videoId, videoTitle: currentVideoTitle }}>
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

            {/* API Health Status */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  API Health Status
                </CardTitle>
                <CardDescription>
                  Monitor the connection to your Hugging Face emotion detection API
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getApiStatusIcon()}
                    <span className={`font-medium ${getApiStatusColor()}`}>
                      {apiHealth.isHealthy ? 'API Healthy' : 'API Issues Detected'}
                    </span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={checkAPIHealth}
                    disabled={isAnalyzing}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Check Health
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Last Check</p>
                    <p className="font-medium">
                      {apiHealth.lastCheck ? 
                        new Date(apiHealth.lastCheck).toLocaleTimeString() : 
                        'Never'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Response Time</p>
                    <p className="font-medium">
                      {apiHealth.responseTime ? `${apiHealth.responseTime}ms` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Error Count</p>
                    <p className="font-medium text-red-600">{apiHealth.errorCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge variant={apiHealth.isHealthy ? 'default' : 'destructive'} className="text-xs">
                      {apiHealth.isHealthy ? 'Online' : 'Offline'}
                    </Badge>
                  </div>
                </div>

                {apiHealth.lastError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Last Error:</strong> {apiHealth.lastError}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Debug Information */}
            {debugInfo && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="h-5 w-5" />
                    Debug Information
                  </CardTitle>
                  <CardDescription>
                    Technical details about the last API response
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="response" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="response">API Response</TabsTrigger>
                      <TabsTrigger value="health">Health Data</TabsTrigger>
                      <TabsTrigger value="raw">Raw Data</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="response" className="mt-4">
                      <div className="bg-muted p-4 rounded-lg">
                        <pre className="text-xs overflow-auto max-h-40">
                          {JSON.stringify(debugInfo.rawResponse, null, 2)}
                        </pre>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="health" className="mt-4">
                      <div className="bg-muted p-4 rounded-lg">
                        <pre className="text-xs overflow-auto max-h-40">
                          {JSON.stringify(debugInfo.apiHealth, null, 2)}
                        </pre>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="raw" className="mt-4">
                      <div className="bg-muted p-4 rounded-lg">
                        <pre className="text-xs overflow-auto max-h-40">
                          {JSON.stringify(debugInfo, null, 2)}
                        </pre>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}

            {/* YouTube Player Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Camera className="h-5 w-5" />
                      Interactive Learning Video
                    </CardTitle>
                    <CardDescription>
                      Enter a YouTube URL or video ID to start learning with real-time emotion analysis
                    </CardDescription>
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
                      <Button 
                        variant="outline" 
                        onClick={() => setShowPlaylistManager(true)}
                        className="flex items-center gap-2"
                      >
                        <List className="h-4 w-4" />
                        Playlists
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Debug log and fallback UI for YouTubePlayer */}
                {(() => { console.log('Dashboard render: videoId =', videoId, 'title =', currentVideoTitle); return null; })()}
                {videoId ? (
                  <YouTubePlayer
                    key={videoId}
                    videoId={videoId}
                    title={currentVideoTitle}
                    onProgressUpdate={handleProgressUpdate}
                    onMilestoneReached={handleMilestoneReached}
                    emotionDetectionPaused={emotionDetectionPaused}
                    setEmotionDetectionPaused={setEmotionDetectionPaused}
                  />
                ) : (
                  <div className="p-8 text-center text-gray-400">No video selected.</div>
                )}

                {/* Milestone Modal */}
                {showMilestoneModal && (
                  <Dialog open={showMilestoneModal} onOpenChange={setShowMilestoneModal}>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Trophy className="h-5 w-5 text-yellow-600" />
                          Milestone Reached!
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <p className="text-center text-lg">
                          Congratulations! You reached {currentMilestone}% progress.
                        </p>
                        <p className="text-center text-sm text-gray-600">
                          Take a quick break and complete a mini-game to reinforce your learning!
                        </p>
                        <div className="flex justify-center gap-2">
                          <Button onClick={handleCloseMilestoneModal} variant="outline">
                            Skip for Now
                          </Button>
                          <Button onClick={() => {
                            handleCloseMilestoneModal();
                            navigate('/games');
                          }}>
                            Play Mini-Game
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              <div className="space-y-6">
                {/* Webcam Preview for Live Emotion Detection */}
                <WebcamFeed onVideoReady={video => { webcamVideoRef.current = video; }} paused={emotionDetectionPaused} />

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {cameraPermission === 'granted' ? (
                        <Camera className="h-5 w-5 text-green-600" />
                      ) : (
                        <CameraOff className="h-5 w-5 text-red-600" />
                      )}
                      Emotion Analysis
                    </CardTitle>
                    <CardDescription>
                      {cameraPermission === 'granted' 
                        ? 'Real-time learning effectiveness tracking'
                        : 'Enable camera for emotion analysis'
                      }
                    </CardDescription>
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
                      
                      {cameraPermission !== 'granted' && (
                        <Button 
                          onClick={requestCameraPermission} 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                        >
                          <Camera className="h-4 w-4 mr-2" />
                          Enable Camera Access
                        </Button>
                      )}
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
                      <div className="text-sm text-gray-600">Video Progress: {progress}%</div>
                      <div className="text-sm text-gray-600">Games Completed: 0</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>How It Works</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm space-y-2">
                      <p>• Enter a YouTube video URL or ID above</p>
                      <p>• Enable camera access for emotion analysis</p>
                      <p>• Watch the video to trigger real-time analysis</p>
                      <p>• Complete mini-games at 25%, 50%, and 75% progress</p>
                      <p>• View your emotion heatmap on the progress bar</p>
                      <p>• Create playlists to organize your learning</p>
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
                        onClick={() => navigate('/games')}
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
              </CardContent>
            </Card>

            {/* Detected Emotions and Mood Timeline */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Detected Emotions</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* ... existing detected emotions UI ... */}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Mood Timeline</CardTitle>
                  <CardDescription>Real-time mood/emotion trend</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={moodTimeline} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} minTickGap={20} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} />
                      {Object.keys(moodColors).map((mood) => (
                        <Line
                          key={mood}
                          type="monotone"
                          dataKey={mood}
                          data={moodTimeline.map((d) => ({ ...d, [d.mood]: d.value }))}
                          stroke={moodColors[mood]}
                          dot={false}
                          isAnimationActive={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-2 mt-2 text-xs">
                    {Object.entries(moodColors).map(([mood, color]) => (
                      <span key={mood} className="flex items-center gap-1">
                        <span className="inline-block w-3 h-3 rounded-full" style={{ background: color }} />
                        {mood}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {showPlaylistManager && (
              <PlaylistManager
                onVideoSelect={handleVideoSelect}
                onClose={() => setShowPlaylistManager(false)}
              />
            )}
          </div>
        </div>
      </VideoContext.Provider>
    );
  } catch (err) {
    console.error('Dashboard render error:', err);
    return <div className="text-red-600 p-8">An error occurred: {String(err)}</div>;
  }
};
