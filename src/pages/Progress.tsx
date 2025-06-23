
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { YouTubePlayer } from '@/components/YouTubePlayer';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

const Progress = () => {
  const [videoId, setVideoId] = useState('dQw4w9WgXcQ'); // Default to a sample video
  const [inputVideoId, setInputVideoId] = useState('');

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

  return (
    <div>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">StudySync - YouTube Learning</h1>
            <p className="text-gray-600">Experience interactive learning with emotion analysis and mini-games</p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Load YouTube Video</CardTitle>
                  <CardDescription>Enter a YouTube URL or video ID to start learning</CardDescription>
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
        </div>
      </div>
    </div>
  );
};

export default Progress;
