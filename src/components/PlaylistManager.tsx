import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Playlist, PlaylistItem } from '@/types/studysync';
import { Plus, Play, Trash2, PlusCircle, Save, ListVideo } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

interface PlaylistManagerProps {
  onVideoSelect?: (videoId: string, title: string) => void;
  onClose?: () => void;
}

export const PlaylistManager: React.FC<PlaylistManagerProps> = ({ onVideoSelect, onClose }) => {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddVideoDialog, setShowAddVideoDialog] = useState(false);
  const [showAddPlaylistDialog, setShowAddPlaylistDialog] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [youtubePlaylistUrl, setYoutubePlaylistUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPlaylists();
    }
  }, [user]);

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

  const deletePlaylist = async (playlistId: string) => {
    const { error } = await supabase.from('playlists').delete().eq('id', playlistId);
    
    if (!error) {
      fetchPlaylists();
      if (selectedPlaylist === playlistId) {
        setSelectedPlaylist(null);
        setPlaylistItems([]);
      }
      toast({
        title: "Playlist Deleted",
        description: "Playlist has been deleted successfully."
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to delete playlist. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handlePlaylistSelect = (playlistId: string) => {
    setSelectedPlaylist(playlistId);
    fetchPlaylistItems(playlistId);
  };

  const extractVideoId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    return match ? match[1] : url;
  };

  const extractPlaylistId = (url: string) => {
    const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };

  const importYouTubePlaylist = async () => {
    if (!selectedPlaylist || !youtubePlaylistUrl.trim()) {
      toast({
        title: "Error",
        description: "Please select one of your playlists as the destination before importing a YouTube playlist.",
        variant: "destructive"
      });
      return;
    }
    const playlistId = extractPlaylistId(youtubePlaylistUrl.trim());
    if (!playlistId) {
      toast({
        title: "Error",
        description: "Invalid YouTube playlist URL.",
        variant: "destructive"
      });
      return;
    }
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
      console.log('[YT Import] Importing playlistId:', playlistId);
      do {
        const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${YOUTUBE_API_KEY}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
        console.log('[YT Import] Fetching URL:', url);
        const res = await fetch(url);
        const data = await res.json();
        console.log('[YT Import] API response:', data);
        if (data.error) throw new Error(data.error.message);
        const videos = (data.items || []).map((item: any) => ({
          videoId: item.snippet.resourceId.videoId,
          title: item.snippet.title
        }));
        console.log(`[YT Import] Fetched ${videos.length} videos in this page.`);
        allVideos = allVideos.concat(videos);
        nextPageToken = data.nextPageToken;
      } while (nextPageToken);
      console.log(`[YT Import] Total videos fetched: ${allVideos.length}`);
      const maxPosition = playlistItems.length > 0 
        ? Math.max(...playlistItems.map(item => item.position))
        : -1;
      let position = maxPosition + 1;
      let successCount = 0;
      let failCount = 0;
      let errorMessages: string[] = [];
      for (const video of allVideos) {
        const { error } = await supabase.from('playlist_items').insert({
          playlist_id: selectedPlaylist,
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
      setShowAddPlaylistDialog(false);
      fetchPlaylistItems(selectedPlaylist);
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

  const addVideoToPlaylist = async () => {
    if (!selectedPlaylist || !newVideoUrl.trim() || !newVideoTitle.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    const videoId = extractVideoId(newVideoUrl.trim());
    
    const maxPosition = playlistItems.length > 0 
      ? Math.max(...playlistItems.map(item => item.position))
      : -1;

    const { error } = await supabase.from('playlist_items').insert({
      playlist_id: selectedPlaylist,
      video_id: videoId,
      title: newVideoTitle.trim(),
      position: maxPosition + 1,
      progress: 0
    });

    if (!error) {
      setNewVideoUrl('');
      setNewVideoTitle('');
      setShowAddVideoDialog(false);
      fetchPlaylistItems(selectedPlaylist);
      toast({
        title: "Video Added",
        description: "Video has been added to the playlist successfully!"
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to add video. Please try again.",
        variant: "destructive"
      });
    }
  };

  const updateVideoProgress = async (itemId: string, progress: number) => {
    const { error } = await supabase
      .from('playlist_items')
      .update({ progress })
      .eq('id', itemId);

    if (!error && selectedPlaylist) {
      fetchPlaylistItems(selectedPlaylist);
    }
  };

  const deleteVideoFromPlaylist = async (itemId: string) => {
    const { error } = await supabase
      .from('playlist_items')
      .delete()
      .eq('id', itemId);

    if (!error && selectedPlaylist) {
      fetchPlaylistItems(selectedPlaylist);
      toast({
        title: "Video Removed",
        description: "Video has been removed from the playlist."
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to remove video. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Playlists</CardTitle>
            <div className="flex items-center gap-2">
              {onClose && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Close Playlist Manager"
                  onClick={onClose}
                  className="text-gray-500 hover:text-red-500"
                >
                  <span className="sr-only">Close</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              )}
              <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Create
              </Button>
            </div>
          </div>
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
                    selectedPlaylist === playlist.id ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handlePlaylistSelect(playlist.id)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium">{playlist.title}</h4>
                      {playlist.description && (
                        <p className="text-sm text-gray-600">{playlist.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={e => { e.stopPropagation(); setShowAddPlaylistDialog(true); }}
                        title="Import YouTube Playlist"
                      >
                        <ListVideo className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePlaylist(playlist.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {selectedPlaylist && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Playlist Videos</CardTitle>
              <Button 
                size="sm" 
                onClick={() => setShowAddVideoDialog(true)}
                className="flex items-center gap-1"
              >
                <PlusCircle className="h-4 w-4" />
                Add Video
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {playlistItems.length === 0 ? (
                <p className="text-gray-500 text-sm">No videos in this playlist yet.</p>
              ) : (
                playlistItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center p-3 border rounded hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <h5 className="font-medium">{item.title}</h5>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${item.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600">{item.progress}%</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => onVideoSelect?.(item.video_id, item.title)}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Play
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteVideoFromPlaylist(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Playlist Dialog */}
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

      {/* Add Video Dialog */}
      <Dialog open={showAddVideoDialog} onOpenChange={setShowAddVideoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Video to Playlist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="YouTube URL..."
              value={newVideoUrl}
              onChange={(e) => setNewVideoUrl(e.target.value)}
            />
            <Input
              placeholder="Video title..."
              value={newVideoTitle}
              onChange={(e) => setNewVideoTitle(e.target.value)}
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAddVideoDialog(false)}>
                Cancel
              </Button>
              <Button onClick={addVideoToPlaylist}>Add Video</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add YouTube Playlist Dialog */}
      <Dialog open={showAddPlaylistDialog} onOpenChange={setShowAddPlaylistDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import YouTube Playlist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded p-2">
              Please select one of your playlists on the left as the destination before importing a YouTube playlist. If you don't have any playlists, create one first.
            </div>
            <Input
              placeholder="YouTube playlist URL..."
              value={youtubePlaylistUrl}
              onChange={e => setYoutubePlaylistUrl(e.target.value)}
              disabled={isImporting}
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAddPlaylistDialog(false)} disabled={isImporting}>
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
