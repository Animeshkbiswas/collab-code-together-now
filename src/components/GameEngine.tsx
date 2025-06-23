
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Shuffle, Clock, Trophy } from 'lucide-react';

interface GameEngineProps {
  milestone: 25 | 50 | 75;
  videoId: string;
  onComplete: (score: number) => void;
  onClose: () => void;
}

// Sample game data - in a real app, this would come from your backend
const GAME_DATA = {
  'term-match': {
    title: 'Term Match',
    description: 'Match the terms with their definitions',
    pairs: [
      { term: 'Algorithm', definition: 'A step-by-step procedure for solving a problem' },
      { term: 'Variable', definition: 'A storage location with an associated name' },
      { term: 'Function', definition: 'A reusable block of code that performs a specific task' },
      { term: 'Loop', definition: 'A programming construct that repeats a block of code' },
    ]
  },
  'concept-sort': {
    title: 'Concept Sort',
    description: 'Drag and drop concepts into the correct categories',
    categories: {
      'Data Types': ['String', 'Integer', 'Boolean', 'Array'],
      'Control Structures': ['If Statement', 'For Loop', 'While Loop', 'Switch'],
      'Operations': ['Addition', 'Comparison', 'Assignment', 'Logical AND']
    }
  },
  'timeline-challenge': {
    title: 'Timeline Challenge',
    description: 'Arrange these events in chronological order',
    events: [
      { name: 'Variable Declaration', order: 1 },
      { name: 'Function Definition', order: 2 },
      { name: 'Function Call', order: 3 },
      { name: 'Return Statement', order: 4 },
    ]
  }
};

export const GameEngine: React.FC<GameEngineProps> = ({
  milestone,
  videoId,
  onComplete,
  onClose
}) => {
  const [currentGame, setCurrentGame] = useState<'term-match' | 'concept-sort' | 'timeline-challenge'>('term-match');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameState, setGameState] = useState<'playing' | 'completed'>('playing');

  // Term Match Game Component
  const TermMatchGame = () => {
    const [selectedCards, setSelectedCards] = useState<string[]>([]);
    const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set());
    const gameData = GAME_DATA['term-match'];

    const handleCardClick = (id: string) => {
      if (selectedCards.length === 2) {
        setSelectedCards([id]);
        return;
      }

      const newSelected = [...selectedCards, id];
      setSelectedCards(newSelected);

      if (newSelected.length === 2) {
        // Check for match logic here
        setTimeout(() => {
          setSelectedCards([]);
        }, 1000);
      }
    };

    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">{gameData.description}</p>
        <div className="grid grid-cols-2 gap-4">
          {gameData.pairs.map((pair, index) => (
            <React.Fragment key={index}>
              <Card 
                className={`cursor-pointer transition-colors ${
                  selectedCards.includes(`term-${index}`) ? 'bg-blue-100' : ''
                } ${matchedPairs.has(`term-${index}`) ? 'bg-green-100' : ''}`}
                onClick={() => handleCardClick(`term-${index}`)}
              >
                <CardContent className="p-4 text-center">
                  <div className="font-medium">{pair.term}</div>
                </CardContent>
              </Card>
              <Card 
                className={`cursor-pointer transition-colors ${
                  selectedCards.includes(`def-${index}`) ? 'bg-blue-100' : ''
                } ${matchedPairs.has(`def-${index}`) ? 'bg-green-100' : ''}`}
                onClick={() => handleCardClick(`def-${index}`)}
              >
                <CardContent className="p-4 text-center">
                  <div className="text-sm">{pair.definition}</div>
                </CardContent>
              </Card>
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  const handleGameComplete = () => {
    const finalScore = Math.floor(Math.random() * 100); // Replace with actual scoring logic
    setScore(finalScore);
    setGameState('completed');
    onComplete(finalScore);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Milestone {milestone}% Reached!
          </DialogTitle>
        </DialogHeader>

        {gameState === 'playing' ? (
          <div className="space-y-6">
            {/* Game Header */}
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">Time: {timeLeft}s</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentGame('term-match')}
                  className={currentGame === 'term-match' ? 'bg-blue-100' : ''}
                >
                  Term Match
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentGame('concept-sort')}
                  className={currentGame === 'concept-sort' ? 'bg-blue-100' : ''}
                >
                  Concept Sort
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentGame('timeline-challenge')}
                  className={currentGame === 'timeline-challenge' ? 'bg-blue-100' : ''}
                >
                  Timeline
                </Button>
              </div>
            </div>

            {/* Game Content */}
            <div className="min-h-[300px]">
              {currentGame === 'term-match' && <TermMatchGame />}
              {currentGame === 'concept-sort' && (
                <div className="text-center py-8">
                  <p>Concept Sort game coming soon!</p>
                </div>
              )}
              {currentGame === 'timeline-challenge' && (
                <div className="text-center py-8">
                  <p>Timeline Challenge game coming soon!</p>
                </div>
              )}
            </div>

            {/* Game Actions */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={onClose}>
                Skip Game
              </Button>
              <Button onClick={handleGameComplete}>
                Complete Game
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-4 py-8">
            <div className="text-6xl">🎉</div>
            <h3 className="text-xl font-semibold">Great Job!</h3>
            <p className="text-gray-600">You scored {score} points!</p>
            <Button onClick={onClose}>Continue Watching</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
