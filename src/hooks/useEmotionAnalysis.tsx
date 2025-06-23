
import { useState, useEffect, useCallback } from 'react';
import { HfInference } from '@huggingface/inference';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface EmotionData {
  engagement: number;
  confusion: boolean;
  distraction: boolean;
  confidence: number;
}

export const useEmotionAnalysis = (videoId: string) => {
  const { user } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [emotionData, setEmotionData] = useState<EmotionData | null>(null);
  
  // Initialize HF with a fallback for missing token
  const [hf] = useState(() => {
    const token = import.meta.env.VITE_HUGGING_FACE_TOKEN;
    if (!token) {
      console.warn('VITE_HUGGING_FACE_TOKEN not found. Using mock emotion analysis.');
      return null;
    }
    return new HfInference(token);
  });

  const analyzeFrame = useCallback(async (videoElement: HTMLVideoElement, timestamp: number) => {
    if (!user || !videoElement) return;

    try {
      setIsAnalyzing(true);
      
      // If no HF token, use mock data
      if (!hf) {
        const mockEmotions: EmotionData = {
          engagement: Math.random() * 100,
          confusion: Math.random() > 0.7,
          distraction: Math.random() > 0.8,
          confidence: Math.random() * 100
        };
        
        setEmotionData(mockEmotions);
        
        // Save mock data to database
        await supabase.from('emotion_snapshots').insert({
          user_id: user.id,
          video_id: videoId,
          timestamp: Math.floor(timestamp),
          emotions: mockEmotions as any
        });
        
        return;
      }
      
      // Capture frame from video
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      ctx.drawImage(videoElement, 0, 0);
      
      // Convert to blob for analysis
      canvas.toBlob(async (blob) => {
        if (!blob) return;

        try {
          // Use your custom Hugging Face model here
          const result = await hf.imageClassification({
            data: blob,
            model: 'microsoft/resnet-50' // Fallback model - replace with your model
          });

          // Process results into emotion data
          const emotions: EmotionData = {
            engagement: Math.random() * 100, // Replace with actual model output processing
            confusion: Math.random() > 0.7,
            distraction: Math.random() > 0.8,
            confidence: Math.random() * 100
          };

          setEmotionData(emotions);

          // Save to database
          await supabase.from('emotion_snapshots').insert({
            user_id: user.id,
            video_id: videoId,
            timestamp: Math.floor(timestamp),
            emotions: emotions as any
          });

        } catch (error) {
          console.error('Emotion analysis failed:', error);
          // Fall back to mock data on error
          const mockEmotions: EmotionData = {
            engagement: Math.random() * 100,
            confusion: Math.random() > 0.7,
            distraction: Math.random() > 0.8,
            confidence: Math.random() * 100
          };
          setEmotionData(mockEmotions);
        }
      }, 'image/jpeg', 0.8);

    } catch (error) {
      console.error('Frame capture failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [user, videoId, hf]);

  return {
    emotionData,
    isAnalyzing,
    analyzeFrame
  };
};
