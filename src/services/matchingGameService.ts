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
  extractPdf,
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
export interface MatchingGameRequest {
    type: 'text' | 'url' | 'youtube' | 'file' | 'image';
    content?: string;
    url?: string;
    youtubeUrl?: string;
    file?: File;
    imageFile?: File;
    difficulty: 'easy' | 'medium' | 'hard';
    pairCount: number;
    gameType: 'term-definition' | 'concept-example' | 'word-synonym' | 'question-answer';
    manualTranscript?: string; // For fallback when auto-extraction fails
    manualContent?: string; // For fallback when content extraction fails
    extractionOptions?: ExtractionOptions; // Custom extraction options
    sourceType?: string; // Type of content source for API prompts
}

export interface MatchingPair {
    id: string;
    left: string;
    right: string;
    category?: string;
    difficulty: 'easy' | 'medium' | 'hard';
    explanation?: string;
}

export interface MatchingGameResponse {
    pairs: MatchingPair[];
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
        totalPairs: number;
        difficulty: string;
        gameType: string;
        estimatedTime: number; // in minutes
        categories: string[];
    };
}

/**
 * Generate matching pairs using Nebius API with chunked content support
 * @param content - Content to generate pairs from
 * @param options - Game options
 * @returns Promise<MatchingPair[]> - Generated matching pairs
 */
const generateNebiusMatchingPairs = async (content: string, options: MatchingGameRequest): Promise<MatchingPair[]> => {
    if (!import.meta.env.VITE_NEBIUS_API_KEY) {
        throw new Error('Nebius API key is not set in the environment variables');
    }

    try {
        const difficultyInstructions = {
            easy: 'Create simple, straightforward pairs that are easy to match',
            medium: 'Create moderately challenging pairs that require some thinking',
            hard: 'Create complex pairs that require deep understanding and analysis'
        };

        const gameTypeInstructions = {
            'term-definition': 'Create pairs where the left side is a term/concept and the right side is its definition',
            'concept-example': 'Create pairs where the left side is a concept and the right side is a real-world example',
            'word-synonym': 'Create pairs where the left side is a word and the right side is its synonym or related term',
            'question-answer': 'Create pairs where the left side is a question and the right side is its answer'
        };

        // Check if content needs to be chunked
        const estimatedTokens = Math.ceil(content.length / 4); // Rough token estimation
        const maxTokensForContent = 3000; // Leave room for prompt and response

        if (estimatedTokens > maxTokensForContent) {
            // Content is too long, need to chunk it
            console.log(`Content too long (${estimatedTokens} estimated tokens), chunking for matching game generation`);
            return await generateChunkedMatchingPairs(content, options);
        }

        const prompt = `
Generate ${options.pairCount} matching pairs based on the following ${options.sourceType} content.

Requirements:
- Difficulty: ${difficultyInstructions[options.difficulty]}
- Game type: ${gameTypeInstructions[options.gameType]}
- Each pair should have a clear connection between left and right sides
- Pairs should test different aspects of the content
- Avoid overly specific or trivial pairs

Content to base pairs on:
${content}

Please format the response as a JSON array with the following structure:
[
  {
    "id": "unique-id",
    "left": "Left side text",
    "right": "Right side text",
    "category": "Optional category",
    "difficulty": "easy|medium|hard",
    "explanation": "Optional explanation of the connection"
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

        const pairsText = response.choices?.[0]?.message?.content;
        if (!pairsText) {
            throw new Error('No matching pairs generated from Nebius API');
        }

        // Parse JSON response
        try {
            const pairs = JSON.parse(pairsText);
            if (!Array.isArray(pairs)) {
                throw new Error('Invalid pairs format: expected array');
            }

            // Validate and clean pairs
            const validatedPairs = pairs.map((p, index) => ({
                id: p.id || `pair${index + 1}`,
                left: p.left || '',
                right: p.right || '',
                category: p.category || 'General',
                difficulty: p.difficulty || options.difficulty,
                explanation: p.explanation || ''
            })).filter(p => p.left && p.right);

            return validatedPairs;
        } catch (parseError) {
            console.error('Failed to parse pairs JSON:', parseError);
            throw new Error('Failed to parse matching pairs response from API');
        }

    } catch (error) {
        console.error('Nebius matching pairs generation failed:', error);
        throw error;
    }
};

/**
 * Generate matching pairs for long content by chunking and processing in parts
 * @param content - Long content to generate pairs from
 * @param options - Game options
 * @returns Promise<MatchingPair[]> - Generated matching pairs
 */
const generateChunkedMatchingPairs = async (content: string, options: MatchingGameRequest): Promise<MatchingPair[]> => {
    // Split content into chunks
    const words = content.split(/\s+/);
    const chunkSize = 2000; // Words per chunk
    const chunks: string[] = [];
    
    for (let i = 0; i < words.length; i += chunkSize) {
        chunks.push(words.slice(i, i + chunkSize).join(' '));
    }

    console.log(`Processing ${chunks.length} chunks for matching game generation`);

    // Generate pairs for each chunk
    const chunkPairs = await Promise.all(
        chunks.map(async (chunk, index) => {
            try {
                const pairsPerChunk = Math.ceil(options.pairCount / chunks.length);
                const chunkPrompt = `
Generate ${pairsPerChunk} matching pairs based on this part ${index + 1} of ${chunks.length} of the content.

Requirements:
- Difficulty: ${options.difficulty}
- Game type: ${options.gameType}
- Focus on key concepts and important information from this section

Content:
${chunk}

Format as JSON array with pairs.
                `;

                const response = await client.chat.completions.create({
                    model: NEBIUS_CONFIG.model,
                    messages: [{ role: 'user', content: chunkPrompt }],
                    max_tokens: 800,
                    temperature: 0.6,
                    top_p: 0.9,
                });

                const pairsText = response.choices?.[0]?.message?.content;
                if (!pairsText) return [];

                try {
                    const pairs = JSON.parse(pairsText);
                    return Array.isArray(pairs) ? pairs : [];
                } catch {
                    return [];
                }
            } catch (error) {
                console.warn(`Failed to generate pairs for chunk ${index + 1}:`, error);
                return [];
            }
        })
    );

    // Combine and deduplicate pairs
    const allPairs = chunkPairs.flat().filter(p => p.left && p.right);
    
    // Remove duplicates based on left side text
    const uniquePairs = allPairs.filter((p, index, self) => 
        index === self.findIndex(pair => pair.left === p.left)
    );

    // Limit to requested number of pairs
    const finalPairs = uniquePairs.slice(0, options.pairCount);

    if (finalPairs.length === 0) {
        throw new Error('Failed to generate any valid matching pairs');
    }

    return finalPairs.map((p, index) => ({
        id: p.id || `pair${index + 1}`,
        left: p.left,
        right: p.right,
        category: p.category || 'General',
        difficulty: p.difficulty || options.difficulty,
        explanation: p.explanation || ''
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
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const result = await extractPdf(buffer, file.name, options);
            return result.content;
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
 * Main matching game generation function with enhanced content extraction
 * @param request - Matching game request
 * @returns Promise<MatchingGameResponse> - Matching game response with metadata
 */
export const generateMatchingGame = async (request: MatchingGameRequest): Promise<MatchingGameResponse> => {
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
                    throw new Error('URL is required for URL matching game generation');
                }
                const urlResult = await extractContentFromUrl(request.url, request.extractionOptions);
                content = urlResult;
                extractedContent = urlResult;
                sourceType = 'website';
                break;
            case 'file':
                if (!request.file) {
                    throw new Error('File is required for file matching game generation');
                }
                const fileResult = await extractTextFromFile(request.file, request.extractionOptions);
                content = fileResult;
                extractedContent = fileResult;
                sourceType = 'document';
                break;
            case 'image':
                if (!request.imageFile) {
                    throw new Error('Image file is required for image matching game generation');
                }
                const imageResult = await extractTextFromImage(request.imageFile, request.extractionOptions);
                content = imageResult;
                extractedContent = imageResult;
                sourceType = 'image';
                break;
            case 'youtube':
                if (!request.youtubeUrl) {
                    throw new Error('YouTube URL is required for YouTube matching game generation');
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
            throw new Error('No content to generate matching game from');
        }

        if (!request.difficulty || !request.pairCount || !request.gameType) {
            throw new Error('Missing required options: difficulty, pairCount, and gameType');
        }

        const pairs = await generateNebiusMatchingPairs(content, request);

        // Calculate estimated time based on pair count and difficulty
        const timePerPair = {
            easy: 0.5,
            medium: 1,
            hard: 1.5
        };
        const estimatedTime = pairs.length * timePerPair[request.difficulty];

        // Extract unique categories
        const categories = [...new Set(pairs.map(p => p.category).filter(Boolean))];

        const response: MatchingGameResponse = {
            pairs,
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
                totalPairs: pairs.length,
                difficulty: request.difficulty,
                gameType: request.gameType,
                estimatedTime,
                categories
            }
        };

        return response;

    } catch (error) {
        console.error('Matching game generation failed:', error);
        
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

/**
 * Shuffle matching pairs for game play
 * @param pairs - Array of matching pairs
 * @returns MatchingPair[] - Shuffled pairs
 */
export const shuffleMatchingPairs = (pairs: MatchingPair[]): MatchingPair[] => {
    const shuffled = [...pairs];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

/**
 * Validate matching game pairs
 * @param pairs - Array of matching pairs
 * @returns { isValid: boolean; errors: string[] } - Validation result
 */
export const validateMatchingGame = (pairs: MatchingPair[]): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (pairs.length === 0) {
        errors.push('Matching game must have at least one pair');
    }
    
    pairs.forEach((pair, index) => {
        if (!pair.left.trim()) {
            errors.push(`Pair ${index + 1} left side is empty`);
        }
        
        if (!pair.right.trim()) {
            errors.push(`Pair ${index + 1} right side is empty`);
        }
        
        if (pair.left === pair.right) {
            errors.push(`Pair ${index + 1} left and right sides are identical`);
        }
    });
    
    return {
        isValid: errors.length === 0,
        errors
    };
}; 