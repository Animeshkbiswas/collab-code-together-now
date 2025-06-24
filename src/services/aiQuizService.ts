import OpenAI from 'openai';

// Initialize OpenAI client with Nebius API configuration
const client = new OpenAI({
    baseURL: 'https://api.studio.nebius.com/v1/',
    apiKey: import.meta.env.VITE_NEBIUS_API_KEY,
    dangerouslyAllowBrowser: true,
});

// Configuration for Nebius API
const NEBIUS_CONFIG = {
    model: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
    maxTokens: 512,
    temperature: 0.6,
    topP: 0.9,
    // Note: OpenAI client doesn't support top_k parameter directly
};

// Types
export interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
    difficulty: 'easy' | 'medium' | 'hard';
    category: string;
}

export interface QuizGenerationRequest {
    content: string;
    videoTitle?: string;
    videoTranscript?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    numQuestions?: number;
}

export interface QuizResponse {
    questions: QuizQuestion[];
    metadata: {
        totalQuestions: number;
        difficulty: string;
        category: string;
        generatedAt: string;
    };
}

// Predefined quiz templates for fallback
const QUIZ_TEMPLATES = {
    programming: [
        {
            question: "What is a variable in programming?",
            options: ["A container for storing data", "A type of loop", "A function", "A comment"],
            correctAnswer: 0,
            explanation: "A variable is a container that holds data values that can be changed during program execution.",
            difficulty: 'easy' as const,
            category: 'programming'
        },
        {
            question: "Which of the following is NOT a programming paradigm?",
            options: ["Object-Oriented", "Functional", "Procedural", "Database"],
            correctAnswer: 3,
            explanation: "Database is not a programming paradigm; it's a way of storing and organizing data.",
            difficulty: 'medium' as const,
            category: 'programming'
        }
    ],
    science: [
        {
            question: "What is the chemical symbol for water?",
            options: ["H2O", "CO2", "NaCl", "O2"],
            correctAnswer: 0,
            explanation: "Water is composed of two hydrogen atoms and one oxygen atom, hence H2O.",
            difficulty: 'easy' as const,
            category: 'science'
        }
    ],
    general: [
        {
            question: "Which planet is known as the Red Planet?",
            options: ["Earth", "Mars", "Jupiter", "Saturn"],
            correctAnswer: 1,
            explanation: "Mars is called the Red Planet due to its reddish appearance from iron oxide on its surface.",
            difficulty: 'easy' as const,
            category: 'general'
        }
    ]
};

// Content analysis function
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

// Generate AI-powered quiz using Nebius API
const generateNebiusQuiz = async (request: QuizGenerationRequest): Promise<QuizQuestion[]> => {
    const { content, videoTitle, videoTranscript, difficulty = 'medium', numQuestions = 5 } = request;
    
    if (!import.meta.env.VITE_NEBIUS_API_KEY) {
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
        
        const response = await client.chat.completions.create({
            model: NEBIUS_CONFIG.model,
            messages: [{ role: 'user', content: context }],
            max_tokens: NEBIUS_CONFIG.maxTokens,
            temperature: NEBIUS_CONFIG.temperature,
            top_p: NEBIUS_CONFIG.topP,
        });
        
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

// Main quiz generation function with fallback
export const generateQuiz = async (request: QuizGenerationRequest): Promise<QuizResponse> => {
    try {
        const questions = await generateNebiusQuiz(request);
        return {
            questions,
            metadata: {
                totalQuestions: questions.length,
                difficulty: request.difficulty || 'medium',
                category: 'AI Generated',
                generatedAt: new Date().toISOString()
            }
        };
    } catch (error) {
        console.warn('Falling back to template-based quiz generation:', error);
        // Fallback to template-based generation
        const questions = generateQuestionsFromContent(request.content, request.numQuestions);
        return {
            questions,
            metadata: {
                totalQuestions: questions.length,
                difficulty: request.difficulty || 'medium',
                category: analyzeContent(request.content),
                generatedAt: new Date().toISOString()
            }
        };
    }
};

// Advanced quiz generation with Nebius API integration
export const generateQuizWithAI = async (request: QuizGenerationRequest): Promise<QuizResponse> => {
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
