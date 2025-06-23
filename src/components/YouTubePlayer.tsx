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
  emotionDetectionPaused: boolean;
  setEmotionDetectionPaused: React.Dispatch<React.SetStateAction<boolean>>;
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  title,
  onProgressUpdate,
  onMilestoneReached,
  emotionDetectionPaused,
  setEmotionDetectionPaused
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
  const [lastMilestonePopup, setLastMilestonePopup] = useState<25 | 50 | 75 | null>(null);
  
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

  const onReady: YouTubeProps['onReady'] = (event) => {
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

  const onStateChange: YouTubeProps['onStateChange'] = (event) => {
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

  const checkMilestones = useCallback((progress: number) => {
    const milestones = [25, 50, 75];
    for (const milestone of milestones) {
      if (
        progress >= milestone &&
        !milestonesReached.has(milestone) &&
        lastMilestonePopup !== milestone
      ) {
        setMilestonesReached(prev => new Set([...prev, milestone]));
        setCurrentMilestone(milestone as 25 | 50 | 75);
        setShowGame(true);
        setLastMilestonePopup(milestone as 25 | 50 | 75);
        onMilestoneReached?.(milestone);
        break;
      }
    }
  }, [milestonesReached, onMilestoneReached, lastMilestonePopup]);

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
    if (playerRef.current) {
      const currentTime = playerRef.current.getCurrentTime();
      const videoElement = document.querySelector('video');
      if (
        videoElement &&
        cameraPermission === 'granted' &&
        !emotionDetectionPaused
      ) {
        analyzeFrame(videoElement, currentTime);
      }
      const progress = (currentTime / playerState.duration) * 100;
      setPlayerState(prev => ({ ...prev, currentTime }));
      onProgressUpdate?.(progress);
      checkMilestones(progress);
      if (user && !emotionDetectionPaused) {
        saveVideoProgress(progress);
      }
    }
  }, [analyzeFrame, playerState.duration, onProgressUpdate, user, cameraPermission, emotionDetectionPaused, checkMilestones, saveVideoProgress]);

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

  // Listen for seek events
  useEffect(() => {
    if (!playerRef.current) return;
    const ytPlayer = playerRef.current;
    const onSeek = () => updateProgressAndEmotion();
    ytPlayer.addEventListener && ytPlayer.addEventListener('onStateChange', onSeek);
    return () => {
      ytPlayer.removeEventListener && ytPlayer.removeEventListener('onStateChange', onSeek);
    };
  }, [updateProgressAndEmotion]);

  // Save progress to localStorage on pause, stop, or unmount
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        const currentTime = playerRef.current.getCurrentTime();
        localStorage.setItem(`dashboard_last_video_progress_${videoId}`, String(currentTime));
      }
    };
  }, [videoId]);

  // Pause the video only when the popup is first shown
  useEffect(() => {
    if (showGame && playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
      playerRef.current.pauseVideo();
    }
  }, [showGame]);

  const handlePauseOrStop = () => {
    if (playerRef.current) {
      const currentTime = playerRef.current.getCurrentTime();
      localStorage.setItem(`dashboard_last_video_progress_${videoId}`, String(currentTime));
    }
  };

  const progressPercentage = playerState.duration > 0 
    ? (playerState.currentTime / playerState.duration) * 100 
    : 0;

  // Reset milestonesReached and lastMilestonePopup when videoId changes
  useEffect(() => {
    setMilestonesReached(new Set());
    setLastMilestonePopup(null);
  }, [videoId]);

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
          
          {/* Camera permission indicator and emotion detection toggle */}
          <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white p-2 rounded flex items-center gap-2">
            {cameraPermission === 'granted' ? (
              <>
                <Camera size={16} className="text-green-400" />
                <span className="text-xs">Emotion Analysis {emotionDetectionPaused ? 'Paused' : 'Active'}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setEmotionDetectionPaused(p => !p)}
                  className="ml-2 text-xs py-1 px-2 h-auto"
                >
                  {emotionDetectionPaused ? 'Resume' : 'Pause'}
                </Button>
              </>
            ) : (
              <>
                <CameraOff size={16} className="text-red-400" />
                <span className="text-xs">Emotion Analysis Disabled</span>
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
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${emotionData.engagement > 70 ? 'bg-green-400' : emotionData.engagement > 40 ? 'bg-yellow-400' : 'bg-red-400'}`}></div>
                  <span>Engagement: {Math.round(emotionData.engagement)}%</span>
                </div>
                {emotionData.confusion && (
                  <div className="flex items-center gap-1 text-yellow-400">
                    <span>⚠️</span>
                    <span>Confusion detected</span>
                  </div>
                )}
                {emotionData.distraction && (
                  <div className="flex items-center gap-1 text-red-400">
                    <span>📱</span>
                    <span>Distraction detected</span>
                  </div>
                )}
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
