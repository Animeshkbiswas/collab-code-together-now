// AI Quiz Generation Service
// This service handles quiz generation using Nebius AI API and YouTube video content

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  category?: string;
  timestamp?: number; // Video timestamp where this concept was discussed
}

export interface QuizGenerationRequest {
  content: string;
  videoId?: string;
  videoTitle?: string;
  videoTranscript?: string;
  topic?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  numQuestions?: number;
  questionTypes?: ('multiple-choice' | 'true-false' | 'fill-blank')[];
  apiKey?: string;
}

export interface QuizGenerationResponse {
  questions: QuizQuestion[];
  summary?: string;
  topics?: string[];
  estimatedTime?: number;
  videoContext?: {
    videoId: string;
    title: string;
    topics: string[];
  };
}

// Configuration for Nebius API
const NEBIUS_API_CONFIG = {
  baseUrl: 'https://api.studio.nebius.com/v1/chat/completions',
  apiKey: import.meta.env.VITE_NEBIUS_API_KEY,
  model: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
};

// Sample quiz templates for different topics
const QUIZ_TEMPLATES = {
  programming: [
    {
      question: "What is the primary purpose of a variable in programming?",
      options: [
        "To store and manipulate data",
        "To create visual effects", 
        "To connect to the internet",
        "To play sounds"
      ],
      correctAnswer: 0,
      explanation: "Variables are used to store and manipulate data in programming. They act as containers for values that can change during program execution."
    },
    {
      question: "Which of the following is NOT a basic data type?",
      options: ["String", "Integer", "Boolean", "Algorithm"],
      correctAnswer: 3,
      explanation: "Algorithm is not a data type. It's a step-by-step procedure for solving a problem. String, Integer, and Boolean are basic data types."
    },
    {
      question: "What does a function do in programming?",
      options: [
        "Only displays text on screen",
        "Performs a specific task and can be reused",
        "Connects to databases only", 
        "Creates visual graphics"
      ],
      correctAnswer: 1,
      explanation: "Functions are reusable blocks of code that perform specific tasks. They help organize code and avoid repetition."
    }
  ],
  science: [
    {
      question: "What is the chemical symbol for water?",
      options: ["H2O", "CO2", "O2", "N2"],
      correctAnswer: 0,
      explanation: "H2O is the chemical formula for water, consisting of two hydrogen atoms and one oxygen atom."
    },
    {
      question: "Which planet is closest to the Sun?",
      options: ["Venus", "Mercury", "Earth", "Mars"],
      correctAnswer: 1,
      explanation: "Mercury is the closest planet to the Sun in our solar system."
    }
  ],
  history: [
    {
      question: "In which year did World War II end?",
      options: ["1943", "1944", "1945", "1946"],
      correctAnswer: 2,
      explanation: "World War II ended in 1945 with the surrender of Germany in May and Japan in September."
    }
  ],
  general: [
    {
      question: "What is the capital of France?",
      options: ["London", "Berlin", "Paris", "Madrid"],
      correctAnswer: 2,
      explanation: "Paris is the capital and largest city of France."
    }
  ]
};

// Content analysis to determine topic
const analyzeContent = (content: string): string => {
  const lowerContent = content.toLowerCase();
  
  if (lowerContent.includes('programming') || lowerContent.includes('code') || 
      lowerContent.includes('variable') || lowerContent.includes('function') ||
      lowerContent.includes('algorithm') || lowerContent.includes('software') ||
      lowerContent.includes('javascript') || lowerContent.includes('python') ||
      lowerContent.includes('react') || lowerContent.includes('html') ||
      lowerContent.includes('css') || lowerContent.includes('api')) {
    return 'programming';
  }
  
  if (lowerContent.includes('science') || lowerContent.includes('chemistry') ||
      lowerContent.includes('physics') || lowerContent.includes('biology') ||
      lowerContent.includes('molecule') || lowerContent.includes('atom') ||
      lowerContent.includes('experiment') || lowerContent.includes('research')) {
    return 'science';
  }
  
  if (lowerContent.includes('history') || lowerContent.includes('war') ||
      lowerContent.includes('ancient') || lowerContent.includes('century') ||
      lowerContent.includes('battle') || lowerContent.includes('kingdom') ||
      lowerContent.includes('empire') || lowerContent.includes('civilization')) {
    return 'history';
  }
  
  return 'general';
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

// Generate AI-powered quiz using Nebius API
const generateNebiusQuiz = async (request: QuizGenerationRequest): Promise<QuizQuestion[]> => {
  const { content, videoTitle, videoTranscript, difficulty = 'medium', numQuestions = 5 } = request;
  if (!NEBIUS_API_CONFIG.apiKey) {
    throw new Error('Nebius API key is not set in the environment variables');
  }
  try {
    const context = `
      Generate ${numQuestions} multiple-choice questions based on this content.
      Video Title: ${videoTitle || 'Unknown'}
      Content: ${content}
      ${videoTranscript ? `Video Transcript: ${videoTranscript.substring(0, 2000)}...` : ''}
      Difficulty level: ${difficulty}
      
      Return ONLY a valid JSON array with this exact format:
      [
        {
          "id": "q1",
          "question": "Question text here?",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": 0,
          "explanation": "Explanation of why this is correct"
        }
      ]
      
      Make sure each question has exactly 4 options and correctAnswer is 0-3.
      Do not include any text before or after the JSON array.
    `;
    const response = await fetchNebiusChatCompletion([{ role: 'user', content: context }]);
    const aiResponse = response.choices?.[0]?.message?.content;
    if (!aiResponse) {
      console.error('No response from Nebius API', response);
      throw new Error('No response from Nebius API');
    }

    // Try to extract JSON from the response
    let questions: QuizQuestion[] = [];
    try {
      // Look for JSON array in the response
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      } else {
        // Try parsing the entire response
        questions = JSON.parse(aiResponse);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse);
      throw new Error('Failed to parse quiz questions from AI response');
    }

    // Validate the questions structure
    if (!Array.isArray(questions)) {
      throw new Error('AI response is not an array of questions');
    }

    // Validate each question has required properties
    const validQuestions = questions.filter((q, index) => {
      if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || 
          typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
        console.warn(`Invalid question at index ${index}:`, q);
        return false;
      }
      return true;
    });

    if (validQuestions.length === 0) {
      throw new Error('No valid questions generated from AI response');
    }

    // Add missing properties
    return validQuestions.map((q, index) => ({
      id: q.id || `q${index + 1}`,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || 'No explanation provided',
      difficulty,
      category: 'AI Generated'
    }));

  } catch (error) {
    console.error('Nebius AI quiz generation failed:', error);
    throw error;
  }
};

// Generate questions based on content analysis (fallback)
const generateQuestionsFromContent = (content: string, numQuestions: number = 5): QuizQuestion[] => {
  const topic = analyzeContent(content);
  const template = QUIZ_TEMPLATES[topic as keyof typeof QUIZ_TEMPLATES] || QUIZ_TEMPLATES.general;
  
  // Shuffle and select questions
  const shuffled = [...template].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(numQuestions, shuffled.length));
  
  // Add more variety by modifying questions based on content
  return selected.map((q, index) => ({
    ...q,
    id: `q${index + 1}`,
    category: topic
  }));
};

// Extract video transcript (placeholder - you can integrate with YouTube API)
const extractVideoTranscript = async (videoId: string): Promise<string> => {
  // This is a placeholder. You would typically:
  // 1. Use YouTube Data API to get video details
  // 2. Use a transcript extraction service
  // 3. Or use a third-party service like YouTube Transcript API
  
  try {
    // Example implementation (you'll need to implement this based on your needs)
    const response = await fetch(`/api/youtube/transcript?videoId=${videoId}`);
    if (response.ok) {
      const data = await response.json();
      return data.transcript;
    }
  } catch (error) {
    console.warn('Failed to extract transcript:', error);
  }
  
  return '';
};

// Main quiz generation function
export const generateQuiz = generateNebiusQuiz;

// Advanced quiz generation with Nebius API integration
export const generateQuizWithAI = async (request: QuizGenerationRequest): Promise<QuizGenerationResponse> => {
  return await generateQuiz(request);
};

// Validate quiz questions
export const validateQuiz = (questions: QuizQuestion[]): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (questions.length === 0) {
    errors.push('Quiz must have at least one question');
  }
  
  questions.forEach((question, index) => {
    if (!question.question.trim()) {
      errors.push(`Question ${index + 1} is empty`);
    }
    
    if (question.options.length < 2) {
      errors.push(`Question ${index + 1} must have at least 2 options`);
    }
    
    if (question.correctAnswer < 0 || question.correctAnswer >= question.options.length) {
      errors.push(`Question ${index + 1} has invalid correct answer index`);
    }
    
    if (question.options.some(option => !option.trim())) {
      errors.push(`Question ${index + 1} has empty options`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Calculate quiz difficulty
export const calculateQuizDifficulty = (questions: QuizQuestion[]): 'easy' | 'medium' | 'hard' => {
  if (questions.length === 0) return 'medium';
  
  const avgDifficulty = questions.reduce((sum, q) => {
    const difficulty = q.difficulty === 'easy' ? 1 : q.difficulty === 'hard' ? 3 : 2;
    return sum + difficulty;
  }, 0) / questions.length;
  
  if (avgDifficulty < 1.5) return 'easy';
  if (avgDifficulty > 2.5) return 'hard';
  return 'medium';
};

// Export quiz data
export const exportQuiz = (questions: QuizQuestion[], title: string = 'Generated Quiz'): string => {
  const quizData = {
    title,
    questions,
    generatedAt: new Date().toISOString(),
    difficulty: calculateQuizDifficulty(questions)
  };
  
  return JSON.stringify(quizData, null, 2);
}; 