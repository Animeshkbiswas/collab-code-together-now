
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { EmotionSnapshot } from '@/types/studysync';

interface EmotionHeatmapProps {
  videoId: string;
  duration: number;
}

export const EmotionHeatmap: React.FC<EmotionHeatmapProps> = ({ videoId, duration }) => {
  const { user } = useAuth();
  const [emotionData, setEmotionData] = useState<EmotionSnapshot[]>([]);

  useEffect(() => {
    if (!user || !videoId) return;

    const fetchEmotionData = async () => {
      const { data } = await supabase
        .from('emotion_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .eq('video_id', videoId)
        .order('timestamp');

      if (data) {
        setEmotionData(data);
      }
    };

    fetchEmotionData();
  }, [user, videoId]);

  if (!emotionData.length || duration === 0) {
    return null;
  }

  // Create heatmap segments
  const segments = [];
  const segmentDuration = duration / 100; // 100 segments

  for (let i = 0; i < 100; i++) {
    const segmentStart = i * segmentDuration;
    const segmentEnd = (i + 1) * segmentDuration;
    
    // Find emotions in this segment
    const segmentEmotions = emotionData.filter(
      emotion => emotion.timestamp >= segmentStart && emotion.timestamp < segmentEnd
    );

    let color = 'transparent';
    if (segmentEmotions.length > 0) {
      const avgEngagement = segmentEmotions.reduce((sum, e) => sum + e.emotions.engagement, 0) / segmentEmotions.length;
      const hasConfusion = segmentEmotions.some(e => e.emotions.confusion);
      const hasDistraction = segmentEmotions.some(e => e.emotions.distraction);

      if (hasDistraction) {
        color = 'rgba(239, 68, 68, 0.7)'; // Red for distraction
      } else if (hasConfusion) {
        color = 'rgba(245, 158, 11, 0.7)'; // Yellow for confusion
      } else if (avgEngagement > 70) {
        color = 'rgba(34, 197, 94, 0.7)'; // Green for high engagement
      } else if (avgEngagement > 40) {
        color = 'rgba(59, 130, 246, 0.7)'; // Blue for medium engagement
      } else {
        color = 'rgba(156, 163, 175, 0.7)'; // Gray for low engagement
      }
    }

    segments.push(
      <div
        key={i}
        className="h-1 flex-1"
        style={{ backgroundColor: color }}
        title={`${Math.round(segmentStart)}s - Engagement: ${segmentEmotions.length > 0 ? Math.round(segmentEmotions.reduce((sum, e) => sum + e.emotions.engagement, 0) / segmentEmotions.length) : 0}%`}
      />
    );
  }

  return (
    <div className="absolute inset-0 flex rounded overflow-hidden pointer-events-none">
      {segments}
    </div>
  );
};
