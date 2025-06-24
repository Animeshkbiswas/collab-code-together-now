import OpenAI from 'openai';
import { 
  getFullTranscript, 
  getChunkedTranscript, 
  TranscriptError, 
  extractVideoId,
  isValidYouTubeInput 
} from './transcriptService';
import {
  extractArticle,
  extractPDFContent,
  extractImageText,
  validateUrl,
  validatePdfFile,
  validateImageFile,
  getExtractionFallbackMessage,
  ContentExtractionError,
  ExtractionOptions
} from './contentExtractionService';

// Initialize OpenAI client with Nebius API configuration
const client = new OpenAI({
    baseURL: 'https://api.studio.nebius.com/v1/',
    apiKey: import.meta.env.VITE_NEBIUS_API_KEY,
    dangerouslyAllowBrowser: true,
});

// Configuration for Nebius API
const NEBIUS_CONFIG = {
    model: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
    maxTokens: 1024,
    temperature: 0.7,
    topP: 0.9,
};

// Types
export interface QuizRequest {
    type: 'text' | 'url' | 'youtube' | 'file' | 'image';
    content?: string;
    url?: string;
    youtubeUrl?: string;
    file?: File;
    imageFile?: File;
    difficulty: 'easy' | 'medium' | 'hard';
    questionCount: number;
    questionTypes: ('multiple-choice' | 'true-false' | 'fill-in-blank')[];
    manualTranscript?: string; // For fallback when auto-extraction fails
    manualContent?: string; // For fallback when content extraction fails
    extractionOptions?: ExtractionOptions; // Custom extraction options
    sourceType?: string; // Type of content source for API prompts
}

export interface QuizQuestion {
    id: string;
    type: 'multiple-choice' | 'true-false' | 'fill-in-blank';
    question: string;
    options?: string[];
    correctAnswer: string;
    explanation: string;
    difficulty: 'easy' | 'medium' | 'hard';
}

export interface QuizResponse {
    questions: QuizQuestion[];
    source: {
        type: string;
        url?: string;
        fileSize?: number;
        videoId?: string;
        fileName?: string;
        extractionTime?: number;
        contentLength?: number;
        language?: string;
    };
    transcript?: string; // Include transcript in response for reference
    extractedContent?: string; // Include extracted content for reference
    metadata: {
        totalQuestions: number;
        difficulty: string;
        questionTypes: string[];
        estimatedTime: number; // in minutes
    };
}

/**
 * Generate quiz questions using Nebius API with chunked content support
 * @param content - Content to generate quiz from
 * @param options - Quiz options
 * @returns Promise<QuizQuestion[]> - Generated quiz questions
 */
const generateNebiusQuiz = async (content: string, options: QuizRequest): Promise<QuizQuestion[]> => {
    if (!import.meta.env.VITE_NEBIUS_API_KEY) {
        throw new Error('Nebius API key is not set in the environment variables');
    }

    try {
        const difficultyInstructions = {
            easy: 'Create simple, straightforward questions that test basic understanding',
            medium: 'Create moderately challenging questions that test comprehension and application',
            hard: 'Create complex questions that test deep understanding, analysis, and synthesis'
        };

        const questionTypeInstructions = options.questionTypes.map(type => {
            switch (type) {
                case 'multiple-choice':
                    return 'multiple-choice questions with 4 options (A, B, C, D)';
                case 'true-false':
                    return 'true/false questions';
                case 'fill-in-blank':
                    return 'fill-in-the-blank questions';
                default:
                    return type;
            }
        }).join(', ');

        // Check if content needs to be chunked
        const estimatedTokens = Math.ceil(content.length / 4); // Rough token estimation
        const maxTokensForContent = 3000; // Leave room for prompt and response

        if (estimatedTokens > maxTokensForContent) {
            // Content is too long, need to chunk it
            console.log(`Content too long (${estimatedTokens} estimated tokens), chunking for quiz generation`);
            return await generateChunkedQuiz(content, options);
        }

        const prompt = `
Generate ${options.questionCount} quiz questions based on the following ${options.sourceType} content.

Requirements:
- Difficulty: ${difficultyInstructions[options.difficulty]}
- Question types: ${questionTypeInstructions}
- Each question should have a clear explanation
- Questions should test different aspects of the content
- Avoid overly specific or trivial questions

Content to base questions on:
${content}

Please format the response as a JSON array with the following structure:
[
  {
    "id": "unique-id",
    "type": "multiple-choice|true-false|fill-in-blank",
    "question": "Question text",
    "options": ["A", "B", "C", "D"] (only for multiple-choice),
    "correctAnswer": "Correct answer",
    "explanation": "Explanation of why this is correct",
    "difficulty": "easy|medium|hard"
  }
]
        `;

        const response = await client.chat.completions.create({
            model: NEBIUS_CONFIG.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: NEBIUS_CONFIG.maxTokens,
            temperature: NEBIUS_CONFIG.temperature,
            top_p: NEBIUS_CONFIG.topP,
        });

        const quizText = response.choices?.[0]?.message?.content;
        if (!quizText) {
            throw new Error('No quiz generated from Nebius API');
        }

        // Parse JSON response
        try {
            const questions = JSON.parse(quizText);
            if (!Array.isArray(questions)) {
                throw new Error('Invalid quiz format: expected array');
            }

            // Validate and clean questions
            const validatedQuestions = questions.map((q, index) => ({
                id: q.id || `q${index + 1}`,
                type: q.type || 'multiple-choice',
                question: q.question || '',
                options: q.options || [],
                correctAnswer: q.correctAnswer || '',
                explanation: q.explanation || '',
                difficulty: q.difficulty || options.difficulty
            })).filter(q => q.question && q.correctAnswer);

            return validatedQuestions;
        } catch (parseError) {
            console.error('Failed to parse quiz JSON:', parseError);
            throw new Error('Failed to parse quiz response from API');
        }

    } catch (error) {
        console.error('Nebius quiz generation failed:', error);
        throw error;
    }
};

/**
 * Generate quiz for long content by chunking and processing in parts
 * @param content - Long content to generate quiz from
 * @param options - Quiz options
 * @returns Promise<QuizQuestion[]> - Generated quiz questions
 */
const generateChunkedQuiz = async (content: string, options: QuizRequest): Promise<QuizQuestion[]> => {
    // Split content into chunks
    const words = content.split(/\s+/);
    const chunkSize = 2000; // Words per chunk
    const chunks: string[] = [];
    
    for (let i = 0; i < words.length; i += chunkSize) {
        chunks.push(words.slice(i, i + chunkSize).join(' '));
    }

    console.log(`Processing ${chunks.length} chunks for quiz generation`);

    // Generate questions for each chunk
    const chunkQuestions = await Promise.all(
        chunks.map(async (chunk, index) => {
            try {
                const questionsPerChunk = Math.ceil(options.questionCount / chunks.length);
                const chunkPrompt = `
Generate ${questionsPerChunk} quiz questions based on this part ${index + 1} of ${chunks.length} of the content.

Requirements:
- Difficulty: ${options.difficulty}
- Question types: ${options.questionTypes.join(', ')}
- Focus on key concepts and important information from this section

Content:
${chunk}

Format as JSON array with questions.
                `;

                const response = await client.chat.completions.create({
                    model: NEBIUS_CONFIG.model,
                    messages: [{ role: 'user', content: chunkPrompt }],
                    max_tokens: 800,
                    temperature: 0.6,
                    top_p: 0.9,
                });

                const quizText = response.choices?.[0]?.message?.content;
                if (!quizText) return [];

                try {
                    const questions = JSON.parse(quizText);
                    return Array.isArray(questions) ? questions : [];
                } catch {
                    return [];
                }
            } catch (error) {
                console.warn(`Failed to generate questions for chunk ${index + 1}:`, error);
                return [];
            }
        })
    );

    // Combine and deduplicate questions
    const allQuestions = chunkQuestions.flat().filter(q => q.question && q.correctAnswer);
    
    // Remove duplicates based on question text
    const uniqueQuestions = allQuestions.filter((q, index, self) => 
        index === self.findIndex(question => question.question === q.question)
    );

    // Limit to requested number of questions
    const finalQuestions = uniqueQuestions.slice(0, options.questionCount);

    if (finalQuestions.length === 0) {
        throw new Error('Failed to generate any valid quiz questions');
    }

    return finalQuestions.map((q, index) => ({
        id: q.id || `q${index + 1}`,
        type: q.type || 'multiple-choice',
        question: q.question,
        options: q.options || [],
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || 'No explanation provided',
        difficulty: q.difficulty || options.difficulty
    }));
};

/**
 * Extract content from URL using Readability
 * @param url - URL to extract content from
 * @param options - Extraction options
 * @returns Promise<string> - Extracted content
 */
const extractContentFromUrl = async (url: string, options: ExtractionOptions = {}): Promise<string> => {
    try {
        // Validate URL first
        if (!await validateUrl(url)) {
            throw new ContentExtractionError(
                'URL is not accessible or does not contain extractable content',
                'NETWORK_ERROR',
                url
            );
        }

        // Extract article content using Readability
        const result = await extractArticle(url, options);
        return result.content;
    } catch (error) {
        if (error instanceof ContentExtractionError) {
            throw error;
        }
        throw new ContentExtractionError(
            `Failed to extract content from URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'EXTRACTION_FAILED',
            url
        );
    }
};

/**
 * Extract YouTube transcript with fallback to manual input
 * @param youtubeUrl - YouTube URL
 * @param manualTranscript - Optional manual transcript fallback
 * @returns Promise<string> - Transcript text
 */
const extractYouTubeTranscript = async (youtubeUrl: string, manualTranscript?: string): Promise<string> => {
    try {
        // Validate YouTube URL
        if (!isValidYouTubeInput(youtubeUrl)) {
            throw new TranscriptError('Invalid YouTube URL format', 'PARSE_ERROR');
        }

        // Try to extract transcript automatically
        const transcript = await getFullTranscript(youtubeUrl);
        console.log('Successfully extracted YouTube transcript automatically');
        return transcript;

    } catch (error) {
        console.warn('Automatic transcript extraction failed:', error);

        // If manual transcript is provided, use it as fallback
        if (manualTranscript && manualTranscript.trim().length > 0) {
            console.log('Using manual transcript as fallback');
            return manualTranscript.trim();
        }

        // If it's a transcript error, provide helpful message
        if (error instanceof TranscriptError) {
            throw new Error(`${error.message}\n\nTo resolve this:\n1. Ensure the video has captions enabled\n2. Try a different video with captions\n3. Provide the transcript manually in the input field`);
        }

        // Generic error
        throw new Error(`Failed to extract transcript from YouTube video: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease provide the transcript manually or try a different video.`);
    }
};

/**
 * Extract text from file (PDF or text file)
 * @param file - File to extract text from
 * @param options - Extraction options
 * @returns Promise<string> - Extracted text content
 */
const extractTextFromFile = async (file: File, options: ExtractionOptions = {}): Promise<string> => {
    try {
        // Check if it's a PDF file
        if (validatePdfFile(file)) {
            console.log('Processing PDF file');
            const text = await extractPDFContent(file);
            return text;
        }

        // Handle text files
        if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
            console.log('Processing text file');
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsText(file);
            });
        }

        throw new ContentExtractionError(
            `Unsupported file type: ${file.type}. Supported types: PDF, TXT`,
            'UNSUPPORTED_FORMAT',
            file.name
        );
    } catch (error) {
        if (error instanceof ContentExtractionError) {
            throw error;
        }
        throw new ContentExtractionError(
            `Failed to extract text from file: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'EXTRACTION_FAILED',
            file.name
        );
    }
};

/**
 * Extract text from image using OCR
 * @param imageFile - Image file to extract text from
 * @param options - Extraction options
 * @returns Promise<string> - Extracted text content
 */
const extractTextFromImage = async (imageFile: File, options: ExtractionOptions = {}): Promise<string> => {
    try {
        // Validate image file
        if (!validateImageFile(imageFile)) {
            throw new ContentExtractionError(
                `Unsupported image format: ${imageFile.type}`,
                'UNSUPPORTED_FORMAT',
                imageFile.name
            );
        }

        console.log('Processing image file with OCR');
        const result = await extractImageText(imageFile, options);
        return result.content;
    } catch (error) {
        if (error instanceof ContentExtractionError) {
            throw error;
        }
        throw new ContentExtractionError(
            `Failed to extract text from image: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'EXTRACTION_FAILED',
            imageFile.name
        );
    }
};

/**
 * Main quiz generation function with enhanced content extraction
 * @param request - Quiz request
 * @returns Promise<QuizResponse> - Quiz response with metadata
 */
export const generateQuiz = async (request: QuizRequest): Promise<QuizResponse> => {
    let content = '';
    let sourceType = 'text';
    let videoId: string | undefined;
    let transcript: string | undefined;
    let extractedContent: string | undefined;
    let extractionMetadata: any = {};

    try {
        switch (request.type) {
            case 'text':
                content = request.content || '';
                sourceType = 'text';
                break;
            case 'url':
                if (!request.url) {
                    throw new Error('URL is required for URL quiz generation');
                }
                const urlResult = await extractContentFromUrl(request.url, request.extractionOptions);
                content = urlResult;
                extractedContent = urlResult;
                sourceType = 'website';
                break;
            case 'file':
                if (!request.file) {
                    throw new Error('File is required for file quiz generation');
                }
                const fileResult = await extractTextFromFile(request.file, request.extractionOptions);
                content = fileResult;
                extractedContent = fileResult;
                sourceType = 'document';
                break;
            case 'image':
                if (!request.imageFile) {
                    throw new Error('Image file is required for image quiz generation');
                }
                const imageResult = await extractTextFromImage(request.imageFile, request.extractionOptions);
                content = imageResult;
                extractedContent = imageResult;
                sourceType = 'image';
                break;
            case 'youtube':
                if (!request.youtubeUrl) {
                    throw new Error('YouTube URL is required for YouTube quiz generation');
                }
                
                // Extract video ID for metadata
                try {
                    videoId = extractVideoId(request.youtubeUrl);
                } catch {
                    // Continue without video ID if extraction fails
                }

                // Extract transcript
                transcript = await extractYouTubeTranscript(request.youtubeUrl, request.manualTranscript);
                content = transcript;
                extractedContent = transcript;
                sourceType = 'youtube video';
                break;
            default:
                throw new Error('Invalid request type');
        }

        if (!content.trim()) {
            throw new Error('No content to generate quiz from');
        }

        if (!request.difficulty || !request.questionCount || !request.questionTypes) {
            throw new Error('Missing required options: difficulty, questionCount, and questionTypes');
        }

        const questions = await generateNebiusQuiz(content, request);

        // Calculate estimated time based on question count and difficulty
        const timePerQuestion = {
            easy: 1,
            medium: 2,
            hard: 3
        };
        const estimatedTime = questions.length * timePerQuestion[request.difficulty];

        const response: QuizResponse = {
            questions,
            source: {
                type: request.type,
                url: request.url || request.youtubeUrl,
                fileSize: request.file?.size || request.imageFile?.size,
                videoId,
                fileName: request.file?.name || request.imageFile?.name,
                ...extractionMetadata
            },
            transcript: transcript,
            extractedContent: extractedContent,
            metadata: {
                totalQuestions: questions.length,
                difficulty: request.difficulty,
                questionTypes: request.questionTypes,
                estimatedTime
            }
        };

        return response;

    } catch (error) {
        console.error('Quiz generation failed:', error);
        
        // Provide helpful error messages for common issues
        if (error instanceof TranscriptError) {
            throw new Error(`YouTube transcript extraction failed: ${error.message}\n\nSolutions:\n1. Check if the video has captions enabled\n2. Try a different video with captions\n3. Provide the transcript manually in the input field`);
        }
        
        if (error instanceof ContentExtractionError) {
            const fallbackMessage = getExtractionFallbackMessage(request.type, error.source || 'unknown');
            throw new Error(`${error.message}\n\n${fallbackMessage}`);
        }
        
        throw error;
    }
};
