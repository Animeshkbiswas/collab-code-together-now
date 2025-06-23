import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';

interface Video {
  id: string;
  title: string;
  progress?: number; // percent watched
}

interface Playlist {
  id: string;
  name: string;
  videos: Video[];
}

interface ProgressTabProps {
  playlists: Playlist[];
  onPlaylistSelect?: (playlistId: string) => void;
  onVideoSelect?: (videoId: string, title: string) => void;
}

export const ProgressTab: React.FC<ProgressTabProps> = ({ playlists, onPlaylistSelect, onVideoSelect }) => {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(playlists[0]?.id || null);

  const selectedPlaylist = playlists.find(p => p.id === selectedPlaylistId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your Playlists</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            {playlists.map(playlist => (
              <Button
                key={playlist.id}
                variant={playlist.id === selectedPlaylistId ? 'default' : 'outline'}
                onClick={() => {
                  setSelectedPlaylistId(playlist.id);
                  onPlaylistSelect?.(playlist.id);
                }}
              >
                {playlist.name}
              </Button>
            ))}
          </div>
          {selectedPlaylist ? (
            <div>
              <h3 className="font-semibold mb-2">Videos in "{selectedPlaylist.name}"</h3>
              <ul className="space-y-2">
                {selectedPlaylist.videos.length === 0 && (
                  <li className="text-muted-foreground text-sm">No videos in this playlist.</li>
                )}
                {selectedPlaylist.videos.map(video => (
                  <li key={video.id} className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      className="px-2 py-1"
                      onClick={() => onVideoSelect?.(video.id, video.title)}
                    >
                      {video.title}
                    </Button>
                    {video.progress !== undefined && (
                      <span className="text-xs text-muted-foreground">{video.progress}% watched</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">Select a playlist to view its videos.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}; 