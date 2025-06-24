import React, { useState, useEffect, useRef, useCallback } from 'react';
import YouTube, { YouTubePlayer as PlayerInstance, YouTubeProps } from 'react-youtube';
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
  emotionDetectionPaused: boolean;
  setEmotionDetectionPaused: React.Dispatch<React.SetStateAction<boolean>>;
  showGame?: boolean;
  onCloseGame?: () => void;
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  title,
  onProgressUpdate,
  onMilestoneReached,
  emotionDetectionPaused,
  setEmotionDetectionPaused,
  showGame = false,
  onCloseGame
}) => {
  const { user } = useAuth();
  const [playerState, setPlayerState] = useState<YouTubePlayerState>({
    currentTime: 0,
    duration: 0,
    playerState: -1,
    isPlaying: false
  });
  const [currentMilestone, setCurrentMilestone] = useState<25 | 50 | 75 | null>(null);
  const [milestonesReached, setMilestonesReached] = useState<Set<number>>(new Set());
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [lastMilestonePopup, setLastMilestonePopup] = useState<25 | 50 | 75 | null>(null);
  
  const playerRef = useRef<PlayerInstance | null>(null);
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
      // First check if we can access the camera
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      
      // Stop the stream immediately after getting permission
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

  const onReady = (event: { target: PlayerInstance }) => {
    playerRef.current = event.target;
    const saved = localStorage.getItem(`dashboard_last_video_progress_${videoId}`);
    if (saved) {
      const time = parseFloat(saved);
      if (!isNaN(time) && time > 0) {
        event.target.seekTo(time, true);
      }
    }
    setPlayerState(prev => ({
      ...prev,
      duration: event.target.getDuration()
    }));
    if (cameraPermission !== 'granted') {
      setEmotionDetectionPaused(true);
    }
  };

  const onStateChange = (event: { target: PlayerInstance; data: number }) => {
    const isPlaying = event.data === 1;
    setPlayerState(prev => ({
      ...prev,
      playerState: event.data,
      isPlaying
    }));
    
    if (!isPlaying) {
      handlePauseOrStop();
    }
    
    if (isPlaying && !emotionDetectionPaused && cameraPermission === 'granted') {
      startEmotionAnalysis();
    } else {
      stopEmotionAnalysis();
    }
    
    updateProgressAndEmotion();
  };

  // Auto-pause/resume based on showGame state
  useEffect(() => {
    if (showGame && playerRef.current) {
      playerRef.current.pauseVideo();  // Pause when modal appears
    } else if (!showGame && playerRef.current) {
      playerRef.current.playVideo();   // Resume when modal closes
    }
  }, [showGame]);

  const checkMilestones = useCallback((progress: number) => {
    if (showGame) return;  // Guard against re-triggering while modal is open

    const milestones = [25, 50, 75];
    const lastTriggered = lastMilestonePopup;

    for (const milestone of milestones) {
      if (
        progress >= milestone &&
        !milestonesReached.has(milestone) &&
        lastTriggered !== milestone
      ) {
        setMilestonesReached(prev => new Set([...prev, milestone]));
        setCurrentMilestone(milestone as 25 | 50 | 75);
        setLastMilestonePopup(milestone as 25 | 50 | 75);
        onMilestoneReached?.(milestone);
        break;
      }
    }
  }, [milestonesReached, showGame, onMilestoneReached, lastMilestonePopup]);

  const saveVideoProgress = useCallback(async (progress: number) => {
    if (!user) return;
    try {
      // Save to user_game_progress table
      await supabase.from('user_game_progress').upsert({
        user_id: user.id,
        youtube_video_id: videoId,
        video_progress: Math.floor(progress)
      }, {
        onConflict: 'user_id, youtube_video_id'
      });
      // Also save to playlist_items if this video is in any playlist
      const { data: playlistItems } = await supabase
        .from('playlist_items')
        .select('id')
        .eq('video_id', videoId);
      if (playlistItems && playlistItems.length > 0) {
        // Update progress for all playlist items containing this video
        for (const item of playlistItems) {
          await supabase
            .from('playlist_items')
            .update({ progress: Math.floor(progress) })
            .eq('id', item.id);
        }
      }
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  }, [user, videoId]);

  const updateProgressAndEmotion = useCallback(() => {
    if (!playerRef.current) return;

    const currentTime = playerRef.current.getCurrentTime();
    const duration = playerRef.current.getDuration();
    
    if (duration > 0) {
      const progress = Math.floor((currentTime / duration) * 100);
      setPlayerState(prev => ({
        ...prev,
        currentTime,
        duration
      }));
      
      onProgressUpdate?.(progress);
      checkMilestones(progress);
      saveVideoProgress(progress);
      
      // Save current time to localStorage
      localStorage.setItem(`dashboard_last_video_progress_${videoId}`, currentTime.toString());
    }
  }, [onProgressUpdate, checkMilestones, saveVideoProgress, videoId]);

  const startEmotionAnalysis = useCallback(() => {
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
    }
    
    analysisIntervalRef.current = setInterval(() => {
      if (playerRef.current && !emotionDetectionPaused) {
        // Get current video frame for analysis
        const currentTime = playerRef.current.getCurrentTime();
        analyzeFrame(null, currentTime); // Pass null for video element since we're analyzing YouTube
      }
    }, 10000); // Analyze every 10 seconds
  }, [analyzeFrame, emotionDetectionPaused]);

  const stopEmotionAnalysis = useCallback(() => {
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }
  }, []);

  const handlePauseOrStop = useCallback(() => {
    stopEmotionAnalysis();
    updateProgressAndEmotion();
  }, [stopEmotionAnalysis, updateProgressAndEmotion]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopEmotionAnalysis();
    };
  }, [stopEmotionAnalysis]);

  // Set up progress tracking interval when playing
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (playerState.isPlaying && !showGame) {
      interval = setInterval(() => {
        updateProgressAndEmotion();
      }, 1000); // Update every second
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [playerState.isPlaying, showGame, updateProgressAndEmotion]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = playerState.duration > 0 
    ? (playerState.currentTime / playerState.duration) * 100 
    : 0;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="relative">
          <YouTube
            videoId={videoId}
            opts={opts}
            onReady={onReady}
            onStateChange={onStateChange}
          />
          
          {/* Progress Bar with Emotion Heatmap */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">
                {formatTime(playerState.currentTime)} / {formatTime(playerState.duration)}
              </span>
              <span className="text-sm text-gray-600">{Math.floor(progressPercentage)}%</span>
            </div>
            
            <div className="relative">
              <Progress value={progressPercentage} className="h-2" />
              <EmotionHeatmap 
                videoId={videoId}
                duration={playerState.duration}
              />
            </div>
            
            {/* Camera Permission Status */}
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                {cameraPermission === 'granted' ? (
                  <Camera className="h-4 w-4 text-green-600" />
                ) : (
                  <CameraOff className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm text-gray-600">
                  {cameraPermission === 'granted' ? 'Emotion Analysis Active' : 'Camera Access Required'}
                </span>
              </div>
              
              {cameraPermission !== 'granted' && (
                <Button 
                  onClick={requestCameraPermission} 
                  variant="outline" 
                  size="sm"
                >
                  Enable Camera
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
