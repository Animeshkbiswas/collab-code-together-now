
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Clock, Star } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface Game {
  id: string;
  title: string;
  description: string;
  difficulty_level: number;
  game_type: string;
  game_config: any;
  game_categories: {
    name: string;
    icon: string;
  };
}

export const GamesList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [games, setGames] = useState<Game[]>([]);
  const [filteredGames, setFilteredGames] = useState<Game[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    fetchGames();
  }, []);

  useEffect(() => {
    filterGames();
  }, [games, searchTerm, difficultyFilter, typeFilter, searchParams]);

  const fetchGames = async () => {
    const { data } = await supabase
      .from('games')
      .select(`
        *,
        game_categories (
          name,
          icon
        )
      `)
      .eq('is_active', true);
    
    if (data) setGames(data);
  };

  const filterGames = () => {
    let filtered = games;
    
    // Category filter from URL params
    const categoryParam = searchParams.get('category');
    if (categoryParam) {
      filtered = filtered.filter(game => 
        game.game_categories?.name.toLowerCase() === categoryParam
      );
    }
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(game =>
        game.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        game.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Difficulty filter
    if (difficultyFilter !== 'all') {
      filtered = filtered.filter(game => 
        game.difficulty_level === parseInt(difficultyFilter)
      );
    }
    
    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(game => game.game_type === typeFilter);
    }
    
    setFilteredGames(filtered);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Educational Games</h1>
          <p className="text-gray-600">Choose from our collection of learning games</p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search games..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-4">
                <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="1">Beginner</SelectItem>
                    <SelectItem value="2">Easy</SelectItem>
                    <SelectItem value="3">Medium</SelectItem>
                    <SelectItem value="4">Hard</SelectItem>
                    <SelectItem value="5">Expert</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Game Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                    <SelectItem value="puzzle">Puzzle</SelectItem>
                    <SelectItem value="vocabulary">Vocabulary</SelectItem>
                    <SelectItem value="logic">Logic</SelectItem>
                    <SelectItem value="matching">Matching</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGames.map((game) => (
            <Card key={game.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{game.game_categories?.icon}</span>
                    <div>
                      <CardTitle className="text-lg">{game.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {game.game_categories?.name}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className={getDifficultyColor(game.difficulty_level)}>
                    {getDifficultyLabel(game.difficulty_level)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">{game.description}</p>
                
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Clock size={14} />
                      <span>{game.game_config?.timeLimit || 60}s</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Star size={14} />
                      <span>{game.difficulty_level}/5</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {game.game_type}
                  </Badge>
                </div>
                
                <Button 
                  className="w-full"
                  onClick={() => navigate(`/play/${game.id}`)}
                >
                  <Play size={16} className="mr-2" />
                  Play Game
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredGames.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No games found matching your criteria.</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => {
                setSearchTerm('');
                setDifficultyFilter('all');
                setTypeFilter('all');
              }}
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
