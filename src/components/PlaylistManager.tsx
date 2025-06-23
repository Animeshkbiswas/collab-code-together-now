
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Playlist, PlaylistItem } from '@/types/studysync';
import { Plus, Play, Trash2 } from 'lucide-react';

interface PlaylistManagerProps {
  onVideoSelect?: (videoId: string, title: string) => void;
}

export const PlaylistManager: React.FC<PlaylistManagerProps> = ({ onVideoSelect }) => {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);

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
    }
  };

  const deletePlaylist = async (playlistId: string) => {
    await supabase.from('playlists').delete().eq('id', playlistId);
    fetchPlaylists();
    if (selectedPlaylist === playlistId) {
      setSelectedPlaylist(null);
      setPlaylistItems([]);
    }
  };

  const handlePlaylistSelect = (playlistId: string) => {
    setSelectedPlaylist(playlistId);
    fetchPlaylistItems(playlistId);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Playlists</CardTitle>
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create
            </Button>
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
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {selectedPlaylist && (
        <Card>
          <CardHeader>
            <CardTitle>Playlist Videos</CardTitle>
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
                      <p className="text-sm text-gray-600">Progress: {item.progress}%</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => onVideoSelect?.(item.video_id, item.title)}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Play
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
    </div>
  );
};
