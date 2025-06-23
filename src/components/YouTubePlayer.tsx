import React, { useState, useEffect, useRef, useCallback } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, Camera, CameraOff } from 'lucide-react';
import { useEmotionAnalysis } from '@/hooks/useEmotionAnalysis';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { EmotionHeatmap } from './EmotionHeatmap';
import { GameEngine } from './GameEngine';
import { YouTubePlayerState } from '@/types/studysync';
import { toast } from '@/components/ui/use-toast';

interface YouTubePlayerProps {
  videoId: string;
  title: string;
  onProgressUpdate?: (progress: number) => void;
  onMilestoneReached?: (milestone: number) => void;
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  title,
  onProgressUpdate,
  onMilestoneReached
}) => {
  const { user } = useAuth();
  const [playerState, setPlayerState] = useState<YouTubePlayerState>({
    currentTime: 0,
    duration: 0,
    playerState: -1,
    isPlaying: false
  });
  const [showGame, setShowGame] = useState(false);
  const [currentMilestone, setCurrentMilestone] = useState<25 | 50 | 75 | null>(null);
  const [milestonesReached, setMilestonesReached] = useState<Set<number>>(new Set());
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  
  const playerRef = useRef<any>(null);
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { emotionData, analyzeFrame } = useEmotionAnalysis(videoId);

  const opts: YouTubeProps['opts'] = {
    height: '400',
    width: '100%',
    playerVars: {
      autoplay: 0,
      controls: 1,
      modestbranding: 1,
      rel: 0
    },
  };

  // Check camera permission on component mount
  useEffect(() => {
    checkCameraPermission();
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
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraPermission('granted');
      stream.getTracks().forEach(track => track.stop()); // Stop the stream immediately
      toast({
        title: "Camera Access Granted",
        description: "Emotion analysis is now active!"
      });
    } catch (error) {
      setCameraPermission('denied');
      toast({
        title: "Camera Access Denied",
        description: "Emotion analysis will use mock data instead.",
        variant: "destructive"
      });
    }
  };

  const onReady: YouTubeProps['onReady'] = (event) => {
    playerRef.current = event.target;
    setPlayerState(prev => ({
      ...prev,
      duration: event.target.getDuration()
    }));
  };

  const onStateChange: YouTubeProps['onStateChange'] = (event) => {
    const isPlaying = event.data === 1;
    setPlayerState(prev => ({
      ...prev,
      playerState: event.data,
      isPlaying
    }));

    if (isPlaying) {
      startEmotionAnalysis();
    } else {
      stopEmotionAnalysis();
    }
  };

  const startEmotionAnalysis = useCallback(() => {
    if (analysisIntervalRef.current) return;

    analysisIntervalRef.current = setInterval(() => {
      if (playerRef.current) {
        const currentTime = playerRef.current.getCurrentTime();
        const videoElement = document.querySelector('video');
        
        if (videoElement && cameraPermission === 'granted') {
          analyzeFrame(videoElement, currentTime);
        }

        // Update progress
        const progress = (currentTime / playerState.duration) * 100;
        setPlayerState(prev => ({ ...prev, currentTime }));
        onProgressUpdate?.(progress);

        // Check for milestones
        checkMilestones(progress);

        // Save progress to database
        if (user) {
          saveVideoProgress(progress);
        }
      }
    }, 10000); // Every 10 seconds
  }, [analyzeFrame, playerState.duration, onProgressUpdate, user, cameraPermission]);

  const stopEmotionAnalysis = useCallback(() => {
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }
  }, []);

  const checkMilestones = useCallback((progress: number) => {
    const milestones = [25, 50, 75];
    for (const milestone of milestones) {
      if (progress >= milestone && !milestonesReached.has(milestone)) {
        setMilestonesReached(prev => new Set([...prev, milestone]));
        setCurrentMilestone(milestone as 25 | 50 | 75);
        setShowGame(true);
        onMilestoneReached?.(milestone);
        break;
      }
    }
  }, [milestonesReached, onMilestoneReached]);

  const saveVideoProgress = useCallback(async (progress: number) => {
    if (!user) return;

    try {
      await supabase.from('user_game_progress').upsert({
        user_id: user.id,
        youtube_video_id: videoId,
        video_progress: Math.floor(progress)
      }, {
        onConflict: 'user_id, youtube_video_id'
      });
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  }, [user, videoId]);

  const handleGameComplete = useCallback((score: number) => {
    setShowGame(false);
    setCurrentMilestone(null);
    
    if (user && currentMilestone) {
      // Save milestone completion
      supabase.from('learning_milestones').insert({
        user_id: user.id,
        video_id: videoId,
        milestone_percentage: currentMilestone,
        game_type: 'term-match', // Default game type
        completed: true,
        score: score
      });
    }
  }, [user, videoId, currentMilestone]);

  useEffect(() => {
    return () => {
      stopEmotionAnalysis();
    };
  }, [stopEmotionAnalysis]);

  const progressPercentage = playerState.duration > 0 
    ? (playerState.currentTime / playerState.duration) * 100 
    : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0 relative">
          <YouTube
            videoId={videoId}
            opts={opts}
            onReady={onReady}
            onStateChange={onStateChange}
            className="w-full"
          />
          
          {/* Camera permission indicator */}
          <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white p-2 rounded flex items-center gap-2">
            {cameraPermission === 'granted' ? (
              <>
                <Camera size={16} className="text-green-400" />
                <span className="text-xs">Camera Active</span>
              </>
            ) : (
              <>
                <CameraOff size={16} className="text-red-400" />
                <span className="text-xs">Camera Disabled</span>
                <Button 
                  size="sm" 
                  variant="secondary" 
                  onClick={requestCameraPermission}
                  className="ml-2 text-xs py-1 px-2 h-auto"
                >
                  Enable
                </Button>
              </>
            )}
          </div>
          
          {/* Emotion indicator overlay */}
          {emotionData && (
            <div className="absolute top-4 right-4 bg-black bg-opacity-70 text-white p-2 rounded">
              <div className="text-xs space-y-1">
                <div>Engagement: {Math.round(emotionData.engagement)}%</div>
                {emotionData.confusion && <div className="text-yellow-400">⚠️ Confusion detected</div>}
                {emotionData.distraction && <div className="text-red-400">📱 Distraction detected</div>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress bar with emotion heatmap */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>{title}</span>
              <span>{Math.round(progressPercentage)}% complete</span>
            </div>
            <div className="relative">
              <Progress value={progressPercentage} className="h-2" />
              <EmotionHeatmap videoId={videoId} duration={playerState.duration} />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>{Math.floor(playerState.currentTime / 60)}:{String(Math.floor(playerState.currentTime % 60)).padStart(2, '0')}</span>
              <span>{Math.floor(playerState.duration / 60)}:{String(Math.floor(playerState.duration % 60)).padStart(2, '0')}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mini-game modal */}
      {showGame && currentMilestone && (
        <GameEngine
          milestone={currentMilestone}
          videoId={videoId}
          onComplete={handleGameComplete}
          onClose={() => setShowGame(false)}
        />
      )}
    </div>
  );
};
