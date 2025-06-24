import React, { useState, useEffect, useContext } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Clock, Star, Gamepad2, Brain, Loader2, Download, Settings, Key, Video, HelpCircle, Alert, AlertCircle, AlertDescription } from 'lucide-react';
import { generateQuiz, QuizQuestion, QuizGenerationRequest, getApiKey, storeApiKey, clearApiKey } from '@/services/aiQuizService';
import { VideoContext } from './Dashboard';

// Sample game data - in a real app, this would come from your backend
const GAME_DATA = {
  'term-match': {
    title: 'Term Match',
    description: 'Match the terms with their definitions',
    difficulty: 2,
    timeLimit: 60,
    category: 'Vocabulary',
    icon: '🔤',
    pairs: [
      { term: 'Algorithm', definition: 'A step-by-step procedure for solving a problem' },
      { term: 'Variable', definition: 'A storage location with an associated name' },
      { term: 'Function', definition: 'A reusable block of code that performs a specific task' },
      { term: 'Loop', definition: 'A programming construct that repeats a block of code' },
    ]
  },
  'ai-quiz': {
    title: 'AI Quiz Generator',
    description: 'Generate custom quizzes from any content',
    difficulty: 3,
    timeLimit: 120,
    category: 'AI',
    icon: '🧠'
  },
  'snake': {
    title: 'Snake',
    description: 'Classic snake game with educational twist',
    difficulty: 1,
    timeLimit: 120,
    category: 'Logic',
    icon: '🐍'
  },
  'tic-tac-toe': {
    title: 'Tic Tac Toe',
    description: 'Play against AI with strategic thinking',
    difficulty: 1,
    timeLimit: 60,
    category: 'Logic',
    icon: '⭕'
  },
  'concept-sort': {
    title: 'Concept Sort',
    description: 'Drag and drop concepts into the correct categories',
    difficulty: 3,
    timeLimit: 90,
    category: 'Logic',
    icon: '📂',
    categories: {
      'Data Types': ['String', 'Integer', 'Boolean', 'Array'],
      'Control Structures': ['If Statement', 'For Loop', 'While Loop', 'Switch'],
      'Operations': ['Addition', 'Comparison', 'Assignment', 'Logical AND']
    }
  },
  'timeline-challenge': {
    title: 'Timeline Challenge',
    description: 'Arrange these events in chronological order',
    difficulty: 3,
    timeLimit: 75,
    category: 'Logic',
    icon: '📅',
    events: [
      { name: 'Variable Declaration', order: 1 },
      { name: 'Function Definition', order: 2 },
      { name: 'Function Call', order: 3 },
      { name: 'Return Statement', order: 4 },
    ]
  }
};

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

interface EducationalGamesProps {
  onGameSelect?: (gameType: string) => void;
}

// Nebius API config for matching pairs
const NEBIUS_API_CONFIG = {
  baseUrl: 'https://api.studio.nebius.com/v1/chat/completions',
  apiKey: import.meta.env.VITE_NEBIUS_API_KEY,
  model: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
};

async function fetchNebiusChatCompletion(messages: any[], options = {}) {
  const res = await fetch(NEBIUS_API_CONFIG.baseUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Api-Key ${NEBIUS_API_CONFIG.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: NEBIUS_API_CONFIG.model,
      messages,
      max_tokens: 512,
      temperature: 0.6,
      top_p: 0.9,
      top_k: 50,
      ...options,
    }),
  });
  if (!res.ok) throw new Error('Nebius API error');
  return res.json();
}

export const EducationalGames: React.FC<EducationalGamesProps> = ({ onGameSelect }) => {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'completed'>('menu');
  const [score, setScore] = useState(0);

  const videoContext = useContext(VideoContext);
  const currentVideoId = videoContext?.videoId;
  const currentVideoTitle = videoContext?.videoTitle;

  const [customVideoUrl, setCustomVideoUrl] = useState('');
  const [customVideoId, setCustomVideoId] = useState<string | null>(null);
  const [customVideoTitle, setCustomVideoTitle] = useState<string>('');

  const [isGeneratingPairs, setIsGeneratingPairs] = useState(false);
  const [pairsError, setPairsError] = useState<string | null>(null);

  // Helper to extract video ID from YouTube URL
  const extractVideoId = (url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    return match ? match[1] : null;
  };

  // When user enters a custom link, update customVideoId and customVideoTitle
  useEffect(() => {
    if (customVideoUrl.trim()) {
      const vid = extractVideoId(customVideoUrl.trim());
      setCustomVideoId(vid);
      setCustomVideoTitle(customVideoUrl.trim());
    } else {
      setCustomVideoId(null);
      setCustomVideoTitle('');
    }
  }, [customVideoUrl]);

  // For quiz/matching, use customVideoId/customVideoTitle if set, else use Dashboard video
  const quizVideoId = customVideoId || currentVideoId;
  const quizVideoTitle = customVideoTitle || currentVideoTitle;

  // AI Quiz Game Component
  const AIQuizGame = () => {
    const [content, setContent] = useState('');
    const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isAnswered, setIsAnswered] = useState(false);
    const [correctAnswers, setCorrectAnswers] = useState(0);
    const [showExplanation, setShowExplanation] = useState(false);
    const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
    const [numQuestions, setNumQuestions] = useState(5);
    const [quizSummary, setQuizSummary] = useState<string>('');
    const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
    const [quizError, setQuizError] = useState<string>('');
    const [currentQuiz, setCurrentQuiz] = useState<QuizQuestion[]>([]);
    const [quizTitle, setQuizTitle] = useState<string>('');
    const [quizDifficulty, setQuizDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
    const [showQuizDialog, setShowQuizDialog] = useState(false);
    const [videoId, setVideoId] = useState<string>('');
    const [videoTitle, setVideoTitle] = useState<string>('');
    const [useVideoContent, setUseVideoContent] = useState(false);

    // Generate quiz using the AI service
    const handleGenerateQuiz = async () => {
      setIsGeneratingQuiz(true);
      setQuizError('');
      setCurrentQuiz([]);
      try {
        const questions = await generateQuiz({
          content: quizVideoTitle || 'YouTube video',
          videoId: quizVideoId,
          videoTitle: quizVideoTitle,
          difficulty: quizDifficulty,
          numQuestions,
        });
        
        // Validate the questions array
        if (!Array.isArray(questions) || questions.length === 0) {
          throw new Error('No valid questions generated');
        }
        
        // Validate each question has required properties
        const validQuestions = questions.filter((q, index) => {
          if (!q || !q.question || !Array.isArray(q.options) || q.options.length === 0) {
            console.warn(`Invalid question at index ${index}:`, q);
            return false;
          }
          return true;
        });
        
        if (validQuestions.length === 0) {
          throw new Error('No valid questions found in response');
        }
        
        setCurrentQuiz(validQuestions);
        setQuizQuestions(validQuestions);
        setQuizSummary('Quiz generated successfully!');
      } catch (err) {
        setQuizError(err instanceof Error ? err.message : 'Failed to generate quiz');
        console.error('Quiz generation error:', err);
      } finally {
        setIsGeneratingQuiz(false);
      }
    };

    const handleAnswerSelect = (answerIndex: number) => {
      if (isAnswered) return;
      setSelectedAnswer(answerIndex);
      setIsAnswered(true);
      
      if (answerIndex === quizQuestions[currentQuestionIndex].correctAnswer) {
        setCorrectAnswers(prev => prev + 1);
      }
      
      setShowExplanation(true);
    };

    const handleNextQuestion = () => {
      if (currentQuestionIndex < quizQuestions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedAnswer(null);
        setIsAnswered(false);
        setShowExplanation(false);
      } else {
        // Quiz completed
        const finalScore = Math.round((correctAnswers / quizQuestions.length) * 100);
        setScore(finalScore);
        setGameState('completed');
      }
    };

    const handlePlayAgain = () => {
      setQuizQuestions([]);
      setCurrentQuestionIndex(0);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setShowExplanation(false);
      setCorrectAnswers(0);
      setContent('');
      setQuizSummary('');
    };

    const handleExportQuiz = () => {
      const quizData = {
        title: 'Generated Quiz',
        questions: quizQuestions,
        summary: quizSummary,
        generatedAt: new Date().toISOString(),
        userScore: correctAnswers,
        totalQuestions: quizQuestions.length,
        videoContext: useVideoContent ? { videoId, videoTitle } : undefined
      };
      
      const blob = new Blob([JSON.stringify(quizData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quiz-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    if (quizQuestions.length === 0) {
      return (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">{GAME_DATA['ai-quiz'].title}</h3>
          </div>
          
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Generate custom quizzes from any content or YouTube video using AI!
            </p>
            
            {/* Content Source Selection */}
            <div className="space-y-4">
              <div className="flex gap-4">
                <Button
                  variant={!useVideoContent ? "default" : "outline"}
                  onClick={() => setUseVideoContent(false)}
                  className="flex-1"
                >
                  <Brain className="h-4 w-4 mr-2" />
                  Text Content
                </Button>
                <Button
                  variant={useVideoContent ? "default" : "outline"}
                  onClick={() => setUseVideoContent(true)}
                  className="flex-1"
                >
                  <Video className="h-4 w-4 mr-2" />
                  YouTube Video
                </Button>
              </div>
            </div>
            
            {!useVideoContent ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Content or Topic:</label>
                <Textarea
                  placeholder="Enter content, paste text, or describe a topic for quiz generation..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">YouTube Link (optional)</label>
                  <Input
                    placeholder="Paste a YouTube link to use a different video"
                    value={customVideoUrl}
                    onChange={(e) => setCustomVideoUrl(e.target.value)}
                  />
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {quizVideoId
                    ? <>Using video: <span className="font-semibold">{quizVideoTitle}</span> (ID: {quizVideoId})</>
                    : <>No video selected.</>
                  }
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Difficulty:</label>
                <Select value={difficulty} onValueChange={(value: 'easy' | 'medium' | 'hard') => setDifficulty(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Number of Questions:</label>
                <Select value={numQuestions.toString()} onValueChange={(value) => setNumQuestions(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 Questions</SelectItem>
                    <SelectItem value="5">5 Questions</SelectItem>
                    <SelectItem value="10">10 Questions</SelectItem>
                    <SelectItem value="15">15 Questions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Button 
              onClick={handleGenerateQuiz} 
              disabled={(!content.trim() && !useVideoContent) || (!videoId && useVideoContent) || isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Quiz...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  Generate Quiz
                </>
              )}
            </Button>
            
            {isGenerating && (
              <div className="text-center text-sm text-gray-500">
                <p>AI is analyzing your content and creating questions...</p>
                <p>This may take a few moments.</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    const currentQuestion = quizQuestions[currentQuestionIndex];

    // Safety check for currentQuestion
    if (!currentQuestion || !currentQuestion.options || !Array.isArray(currentQuestion.options)) {
      return (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">{GAME_DATA['ai-quiz'].title}</h3>
          </div>
          <div className="text-center py-8">
            <div className="text-red-500 mb-4">
              <p className="font-medium">Invalid question data</p>
              <p className="text-sm">The current question is missing required properties.</p>
            </div>
            <Button onClick={handlePlayAgain}>
              Restart Quiz
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">{GAME_DATA['ai-quiz'].title}</h3>
        </div>
        
        {quizSummary && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">{quizSummary}</p>
          </div>
        )}
        
        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>Question {currentQuestionIndex + 1} of {quizQuestions.length}</span>
            <span>Score: {correctAnswers}/{currentQuestionIndex + (isAnswered ? 1 : 0)}</span>
          </div>
          
          <Card className="p-6">
            <h4 className="text-lg font-medium mb-4">{currentQuestion.question}</h4>
            
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={isAnswered}
                  className={`w-full p-4 text-left rounded-lg border transition-colors ${
                    selectedAnswer === index
                      ? index === currentQuestion.correctAnswer
                        ? 'bg-green-100 border-green-500 text-green-800'
                        : 'bg-red-100 border-red-500 text-red-800'
                      : isAnswered && index === currentQuestion.correctAnswer
                      ? 'bg-green-100 border-green-500 text-green-800'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  } ${isAnswered ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className="font-medium mr-2">{String.fromCharCode(65 + index)}.</span>
                  {option}
                </button>
              ))}
            </div>
            
            {showExplanation && currentQuestion.explanation && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h5 className="font-medium text-blue-800 mb-2">Explanation:</h5>
                <p className="text-blue-700 text-sm">{currentQuestion.explanation}</p>
              </div>
            )}
          </Card>
          
          {isAnswered && (
            <div className="flex justify-between">
              <Button variant="outline" onClick={handlePlayAgain}>
                Restart Quiz
              </Button>
              <Button onClick={handleNextQuestion}>
                {currentQuestionIndex < quizQuestions.length - 1 ? 'Next Question' : 'Finish Quiz'}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Term Match Game Component
  const TermMatchGame = () => {
    const [selectedCards, setSelectedCards] = useState<string[]>([]);
    const [matchedPairs, setMatchedPairs] = useState<Set<number>>(new Set());
    const [lastMatch, setLastMatch] = useState<boolean | null>(null);
    const gameData = GAME_DATA['term-match'];

    // Show loading state while generating pairs
    if (isGeneratingPairs) {
      return (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">{gameData.title}</h3>
          </div>
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Generating matching pairs from AI...</p>
          </div>
        </div>
      );
    }

    // Show error if pair generation failed
    if (pairsError) {
      return (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">{gameData.title}</h3>
          </div>
          <div className="text-center py-8">
            <div className="text-red-500 mb-4">
              <p className="font-medium">Failed to generate pairs</p>
              <p className="text-sm">{pairsError}</p>
            </div>
            <Button onClick={() => {
              setPairsError(null);
              handleGenerateMatchingPairs();
            }}>
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    const handleCardClick = (id: string, index: number, isTerm: boolean) => {
      if (selectedCards.length === 2 || matchedPairs.has(index)) return;
      const newSelected = [...selectedCards, id];
      setSelectedCards(newSelected);
      if (newSelected.length === 2) {
        const [first, second] = newSelected;
        const firstIdx = parseInt(first.split('-')[1]);
        const secondIdx = parseInt(second.split('-')[1]);
        if (
          ((first.startsWith('term') && second.startsWith('def')) ||
            (first.startsWith('def') && second.startsWith('term')))
          && firstIdx === secondIdx
        ) {
          setTimeout(() => {
            setMatchedPairs(prev => new Set([...prev, firstIdx]));
            setSelectedCards([]);
            setLastMatch(true);
          }, 500);
        } else {
          setTimeout(() => {
            setSelectedCards([]);
            setLastMatch(false);
          }, 800);
        }
      }
    };

    useEffect(() => {
      if (matchedPairs.size === gameData.pairs.length) {
        setTimeout(() => {
          setScore(matchedPairs.size * 10);
          setGameState('completed');
        }, 500);
      }
    }, [matchedPairs]);

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">{gameData.title}</h3>
        </div>
        <p className="text-sm text-gray-600">{gameData.description}</p>
        <div className="grid grid-cols-2 gap-4">
          {gameData.pairs.map((pair, index) => (
            <React.Fragment key={index}>
              <Card
                className={`cursor-pointer transition-colors ${
                  selectedCards.includes(`term-${index}`) ? 'bg-blue-100' : ''
                } ${matchedPairs.has(index) ? 'bg-green-100' : ''}`}
                onClick={() => handleCardClick(`term-${index}`, index, true)}
              >
                <CardContent className="p-4 text-center">
                  <div className="font-medium">{pair.term}</div>
                </CardContent>
              </Card>
              <Card
                className={`cursor-pointer transition-colors ${
                  selectedCards.includes(`def-${index}`) ? 'bg-blue-100' : ''
                } ${matchedPairs.has(index) ? 'bg-green-100' : ''}`}
                onClick={() => handleCardClick(`def-${index}`, index, false)}
              >
                <CardContent className="p-4 text-center">
                  <div className="text-sm">{pair.definition}</div>
                </CardContent>
              </Card>
            </React.Fragment>
          ))}
        </div>
        <div className="text-center mt-2">
          <span className="font-semibold">Score: {matchedPairs.size * 10}</span>
        </div>
        {lastMatch === false && <div className="text-red-500 text-center">Not a match!</div>}
        {lastMatch === true && <div className="text-green-600 text-center">Matched!</div>}
      </div>
    );
  };

  // Snake Game Component
  const SnakeGame = () => {
    const boardSize = 10;
    const [snake, setSnake] = useState([[5, 5]]);
    const [direction, setDirection] = useState<[number, number]>([0, 1]);
    const [food, setFood] = useState<[number, number]>([2, 2]);
    const [gameOver, setGameOver] = useState(false);
    const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);

    useEffect(() => {
      if (gameOver) return;
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'ArrowUp') setDirection([-1, 0]);
        if (e.key === 'ArrowDown') setDirection([1, 0]);
        if (e.key === 'ArrowLeft') setDirection([0, -1]);
        if (e.key === 'ArrowRight') setDirection([0, 1]);
      };
      window.addEventListener('keydown', handleKey);
      return () => window.removeEventListener('keydown', handleKey);
    }, [gameOver]);

    useEffect(() => {
      if (gameOver) return;
      const id = setInterval(() => {
        setSnake(prev => {
          const newHead = [prev[0][0] + direction[0], prev[0][1] + direction[1]];
          if (
            newHead[0] < 0 || newHead[0] >= boardSize ||
            newHead[1] < 0 || newHead[1] >= boardSize ||
            prev.some(([x, y]) => x === newHead[0] && y === newHead[1])
          ) {
            setGameOver(true);
            setScore(prev.length * 10);
            return prev;
          }
          let newSnake = [newHead, ...prev];
          if (newHead[0] === food[0] && newHead[1] === food[1]) {
            setFood([
              Math.floor(Math.random() * boardSize),
              Math.floor(Math.random() * boardSize)
            ]);
          } else {
            newSnake.pop();
          }
          return newSnake;
        });
      }, 200);
      setIntervalId(id);
      return () => clearInterval(id);
    }, [direction, food, gameOver]);

    useEffect(() => {
      if (gameOver && intervalId) clearInterval(intervalId);
      if (gameOver) setTimeout(() => setGameState('completed'), 1000);
    }, [gameOver]);

    const handlePlayAgain = () => {
      setSnake([[5, 5]]);
      setDirection([0, 1]);
      setFood([2, 2]);
      setGameOver(false);
      setScore(0);
    };

    return (
      <div className="flex flex-col items-center">
        <div className="flex justify-between items-center w-full mb-4">
          <h3 className="text-lg font-semibold">{GAME_DATA['snake'].title}</h3>
        </div>
        <div className="grid grid-cols-10 gap-0.5 bg-gray-800 p-2 rounded">
          {Array.from({ length: boardSize * boardSize }).map((_, i) => {
            const x = Math.floor(i / boardSize);
            const y = i % boardSize;
            const isSnake = snake.some(([sx, sy]) => sx === x && sy === y);
            const isHead = snake[0][0] === x && snake[0][1] === y;
            const isFood = food[0] === x && food[1] === y;
            return (
              <div
                key={i}
                className={`w-5 h-5 rounded ${isHead ? 'bg-green-400' : isSnake ? 'bg-green-700' : isFood ? 'bg-red-500' : 'bg-gray-900'}`}
              />
            );
          })}
        </div>
        <div className="text-center mt-2">
          <span className="font-semibold">Score: {snake.length * 10}</span>
        </div>
        {gameOver && <div className="text-red-500 mt-2">Game Over!</div>}
        <div className="text-xs text-gray-400 mt-1">Use arrow keys to move</div>
        {gameOver && <Button className="mt-2" onClick={handlePlayAgain}>Play Again</Button>}
      </div>
    );
  };

  // Tic Tac Toe Game Component
  const TicTacToeGame = () => {
    const [board, setBoard] = useState<(null | 'X' | 'O')[]>(Array(9).fill(null));
    const [isX, setIsX] = useState(true);
    const [winner, setWinner] = useState<null | 'X' | 'O' | 'draw'>(null);

    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];

    const checkWinner = (b: (null | 'X' | 'O')[]) => {
      for (const [a, bIdx, c] of lines) {
        if (b[a] && b[a] === b[bIdx] && b[a] === b[c]) return b[a];
      }
      if (b.every(cell => cell)) return 'draw';
      return null;
    };

    const aiMove = (b: (null | 'X' | 'O')[]) => {
      // Try to win
      for (const [a, bIdx, c] of lines) {
        if (b[a] === 'O' && b[bIdx] === 'O' && b[c] === null) return c;
        if (b[a] === 'O' && b[c] === 'O' && b[bIdx] === null) return bIdx;
        if (b[bIdx] === 'O' && b[c] === 'O' && b[a] === null) return a;
      }
      // Block X
      for (const [a, bIdx, c] of lines) {
        if (b[a] === 'X' && b[bIdx] === 'X' && b[c] === null) return c;
        if (b[a] === 'X' && b[c] === 'X' && b[bIdx] === null) return bIdx;
        if (b[bIdx] === 'X' && b[c] === 'X' && b[a] === null) return a;
      }
      // Otherwise random
      const empty = b.map((v, i) => v === null ? i : null).filter(v => v !== null) as number[];
      if (empty.length > 0) {
        return empty[Math.floor(Math.random() * empty.length)];
      }
      return null;
    };

    const handleClick = (idx: number) => {
      if (board[idx] || winner) return;
      const newBoard = [...board];
      newBoard[idx] = isX ? 'X' : 'O';
      setBoard(newBoard);
      setIsX(!isX);
    };

    useEffect(() => {
      const w = checkWinner(board);
      if (w) {
        setWinner(w);
        setTimeout(() => {
          setScore(w === 'X' ? 100 : w === 'draw' ? 50 : 0);
          setGameState('completed');
        }, 1000);
      } else if (!isX) {
        const move = aiMove(board);
        if (move !== null && winner === null) {
          setTimeout(() => {
            setBoard(b => {
              const nb = [...b];
              nb[move] = 'O';
              return nb;
            });
            setIsX(true);
          }, 500);
        }
      }
    }, [board, isX]);

    const handlePlayAgain = () => {
      setBoard(Array(9).fill(null));
      setIsX(true);
      setWinner(null);
      setScore(0);
    };

    return (
      <div className="flex flex-col items-center">
        <div className="flex justify-between items-center w-full mb-4">
          <h3 className="text-lg font-semibold">{GAME_DATA['tic-tac-toe'].title}</h3>
        </div>
        <div className="grid grid-cols-3 gap-1 bg-gray-800 p-2 rounded">
          {board.map((cell, i) => (
            <button
              key={i}
              className={`w-12 h-12 text-2xl font-bold rounded bg-gray-900 text-white ${cell ? 'cursor-not-allowed' : 'hover:bg-blue-600'}`}
              onClick={() => handleClick(i)}
              disabled={!!cell || !!winner}
            >
              {cell}
            </button>
          ))}
        </div>
        <div className="text-center mt-2">
          <span className="font-semibold">Score: {winner === 'X' ? 100 : winner === 'draw' ? 50 : winner === 'O' ? 0 : 0}</span>
        </div>
        {winner && <div className="mt-2 text-lg font-semibold text-green-400">{winner === 'draw' ? 'Draw!' : `${winner} wins!`}</div>}
        <div className="text-xs text-gray-400 mt-1">You are X. AI is O.</div>
        {winner && <Button className="mt-2" onClick={handlePlayAgain}>Play Again</Button>}
      </div>
    );
  };

  const getDifficultyColor = (level: number) => {
    switch (level) {
      case 1: return 'bg-green-100 text-green-800';
      case 2: return 'bg-yellow-100 text-yellow-800';
      case 3: return 'bg-orange-100 text-orange-800';
      case 4: return 'bg-red-100 text-red-800';
      case 5: return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDifficultyLabel = (level: number) => {
    const labels = ['', 'Beginner', 'Easy', 'Medium', 'Hard', 'Expert'];
    return labels[level] || 'Unknown';
  };

  const handleGameSelect = (gameType: string) => {
    setSelectedGame(gameType);
    setGameState('playing');
    setScore(0);
    onGameSelect?.(gameType);
  };

  const handleBackToMenu = () => {
    setGameState('menu');
    setSelectedGame(null);
    setScore(0);
  };

  // When starting the matching game, call handleGenerateMatchingPairs to get pairs from the AI service
  useEffect(() => {
    if (gameState === 'playing' && selectedGame === 'matching') {
      handleGenerateMatchingPairs();
    }
  }, [gameState, selectedGame]);

  async function handleGenerateMatchingPairs() {
    setIsGeneratingPairs(true);
    setPairsError(null);
    try {
      const context = `Generate 4 term-definition pairs for a matching game based on this content: "${quizVideoTitle || 'General knowledge'}". 
      
      Return ONLY a valid JSON array with this exact format:
      [
        {"term": "Term 1", "definition": "Definition of term 1"},
        {"term": "Term 2", "definition": "Definition of term 2"},
        {"term": "Term 3", "definition": "Definition of term 3"},
        {"term": "Term 4", "definition": "Definition of term 4"}
      ]
      
      Make sure each pair has both "term" and "definition" properties.
      Do not include any text before or after the JSON array.`;
      
      const response = await fetchNebiusChatCompletion([{ role: 'user', content: context }]);
      const aiResponse = response.choices?.[0]?.message?.content;
      
      if (!aiResponse) {
        throw new Error('No response from AI for matching pairs');
      }
      
      let pairs = [];
      try {
        // Try to extract JSON array from the response
        const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          pairs = JSON.parse(jsonMatch[0]);
        } else {
          // Try parsing the entire response
          pairs = JSON.parse(aiResponse);
        }
      } catch (e) {
        console.error('Failed to parse AI response for pairs:', aiResponse);
        throw new Error('Failed to parse AI response for pairs');
      }
      
      // Validate the pairs structure
      if (!Array.isArray(pairs)) {
        throw new Error('AI response is not an array of pairs');
      }
      
      // Validate each pair has required properties
      const validPairs = pairs.filter((pair, index) => {
        if (!pair.term || !pair.definition || typeof pair.term !== 'string' || typeof pair.definition !== 'string') {
          console.warn(`Invalid pair at index ${index}:`, pair);
          return false;
        }
        return true;
      });
      
      if (validPairs.length === 0) {
        throw new Error('No valid pairs generated from AI response');
      }
      
      // Use the valid pairs, or fallback to default if not enough
      const finalPairs = validPairs.length >= 4 ? validPairs.slice(0, 4) : [
        ...validPairs,
        ...GAME_DATA['term-match'].pairs.slice(0, 4 - validPairs.length)
      ];
      
      GAME_DATA['term-match'].pairs = finalPairs;
      
    } catch (err: any) {
      console.error('Failed to generate matching pairs:', err);
      setPairsError(err.message || 'Failed to generate pairs');
      // Keep the default pairs if AI generation fails
    } finally {
      setIsGeneratingPairs(false);
    }
  }

  if (gameState === 'playing' && selectedGame) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="mb-4 p-2 bg-muted rounded text-xs">
          <strong>Debug:</strong> quizVideoId = <span className="font-mono">{quizVideoId || 'null'}</span>, quizVideoTitle = <span className="font-mono">{quizVideoTitle || 'null'}</span>
        </div>
        {selectedGame === 'term-match' && <TermMatchGame />}
        {selectedGame === 'ai-quiz' && <AIQuizGame />}
        {selectedGame === 'snake' && <SnakeGame />}
        {selectedGame === 'tic-tac-toe' && <TicTacToeGame />}
        {selectedGame === 'concept-sort' && (
          <div className="text-center py-8">
            <h3 className="text-lg font-semibold mb-4">{GAME_DATA['concept-sort'].title}</h3>
            <p>Concept Sort game coming soon!</p>
            <Button className="mt-4" onClick={handleBackToMenu}>Back to Menu</Button>
          </div>
        )}
        {selectedGame === 'timeline-challenge' && (
          <div className="text-center py-8">
            <h3 className="text-lg font-semibold mb-4">{GAME_DATA['timeline-challenge'].title}</h3>
            <p>Timeline Challenge game coming soon!</p>
            <Button className="mt-4" onClick={handleBackToMenu}>Back to Menu</Button>
          </div>
        )}
      </div>
    );
  }

  if (gameState === 'completed') {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h3 className="text-xl font-semibold mb-2">Great Job!</h3>
        <p className="text-gray-600 mb-4">You scored {score} points!</p>
        <div className="flex gap-3">
          <Button onClick={handleBackToMenu}>Back to Menu</Button>
          {selectedGame && (
            <Button onClick={() => handleGameSelect(selectedGame)}>
              Play Again
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Educational Games</h1>
        <p className="text-gray-600">Choose from our collection of learning games</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(GAME_DATA).map(([gameType, game]) => (
          <Card key={gameType} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">{game.icon}</span>
                  <div>
                    <h3 className="text-lg font-semibold">{game.title}</h3>
                    <p className="text-sm text-gray-500">{game.category}</p>
                  </div>
                </div>
                <Badge className={getDifficultyColor(game.difficulty)}>
                  {getDifficultyLabel(game.difficulty)}
                </Badge>
              </div>
              
              <p className="text-gray-600 mb-4">{game.description}</p>
              
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <div className="flex items-center space-x-1">
                    <Clock size={14} />
                    <span>{game.timeLimit}s</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Star size={14} />
                    <span>{game.difficulty}/5</span>
                  </div>
                </div>
              </div>
              
              <Button 
                className="w-full"
                onClick={() => handleGameSelect(gameType)}
              >
                <Gamepad2 size={16} className="mr-2" />
                Play Game
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}; 