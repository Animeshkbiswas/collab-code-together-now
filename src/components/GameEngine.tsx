import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trophy, Gamepad2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface GameEngineProps {
  milestone: 25 | 50 | 75;
  videoId: string;
  onComplete: (score: number) => void;
  onClose: () => void;
}

export const GameEngine: React.FC<GameEngineProps> = ({
  milestone,
  videoId,
  onComplete,
  onClose
}) => {
  const navigate = useNavigate();

  const handleContinue = () => {
    onComplete(0); // No score for milestone completion
    onClose();
  };

  const handlePlayGames = () => {
    onComplete(0);
    onClose();
    navigate('/games');
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Milestone {milestone}% Reached!
          </DialogTitle>
        </DialogHeader>

        <div className="text-center space-y-6 py-8">
          <div className="text-6xl">🎉</div>
          <div>
            <h3 className="text-xl font-semibold mb-2">Great Progress!</h3>
            <p className="text-gray-600">
              You've reached {milestone}% completion of this video. 
              Take a break and try some educational games to reinforce your learning!
            </p>
          </div>
          
          <div className="flex flex-col gap-3">
            <Button onClick={handlePlayGames} className="w-full">
              <Gamepad2 className="h-4 w-4 mr-2" />
              Play Educational Games
            </Button>
            <Button variant="outline" onClick={handleContinue}>
              Continue Watching
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
