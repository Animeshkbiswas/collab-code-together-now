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
    maxTokens: 512,
    temperature: 0.6,
    topP: 0.9,
};

// Types
export interface SummaryRequest {
    type: 'text' | 'url' | 'youtube' | 'file' | 'image';
    content?: string;
    url?: string;
    youtubeUrl?: string;
    file?: File;
    imageFile?: File;
    length: 'short' | 'medium' | 'long';
    style: 'bullet' | 'paragraph' | 'executive';
    manualTranscript?: string; // For fallback when auto-extraction fails
    manualContent?: string; // For fallback when content extraction fails
    extractionOptions?: ExtractionOptions; // Custom extraction options
}

export interface SummaryResponse {
    summary: string;
    originalLength: number;
    summaryLength: number;
    compressionRatio: number;
    topics: string[];
    keywords: string[];
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
}

export interface SummaryOptions {
    length: 'short' | 'medium' | 'long';
    style: 'bullet' | 'paragraph' | 'executive';
    sourceType: string;
}

/**
 * Generate summary using Nebius API with chunked content support
 * @param content - Content to summarize
 * @param options - Summary options
 * @returns Promise<string> - Generated summary
 */
const generateNebiusSummary = async (content: string, options: SummaryOptions): Promise<string> => {
    if (!import.meta.env.VITE_NEBIUS_API_KEY) {
        throw new Error('Nebius API key is not set in the environment variables');
    }

    try {
        const lengthInstructions = {
            short: 'in 2-3 sentences',
            medium: 'in 1-2 paragraphs',
            long: 'in 3-4 paragraphs with detailed analysis'
        };

        const styleInstructions = {
            bullet: 'Format the summary as bullet points with key highlights',
            paragraph: 'Write the summary in clear, flowing paragraphs',
            executive: 'Write an executive summary focusing on key takeaways and actionable insights'
        };

        // Check if content needs to be chunked
        const estimatedTokens = Math.ceil(content.length / 4); // Rough token estimation
        const maxTokensForContent = 3000; // Leave room for prompt and response

        if (estimatedTokens > maxTokensForContent) {
            // Content is too long, need to chunk it
            console.log(`Content too long (${estimatedTokens} estimated tokens), chunking for processing`);
            return await generateChunkedSummary(content, options);
        }

        const prompt = `
Summarize the following ${options.sourceType} content ${lengthInstructions[options.length]}.
${styleInstructions[options.style]}.

Content to summarize:
${content}

Please provide a comprehensive summary that captures the main points, key insights, and important details.
        `;

        const response = await client.chat.completions.create({
            model: NEBIUS_CONFIG.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: NEBIUS_CONFIG.maxTokens,
            temperature: NEBIUS_CONFIG.temperature,
            top_p: NEBIUS_CONFIG.topP,
        });

        const summary = response.choices?.[0]?.message?.content;
        if (!summary) {
            throw new Error('No summary generated from Nebius API');
        }

        return summary.trim();
    } catch (error) {
        console.error('Nebius summary generation failed:', error);
        throw error;
    }
};

/**
 * Generate summary for long content by chunking and processing in parts
 * @param content - Long content to summarize
 * @param options - Summary options
 * @returns Promise<string> - Generated summary
 */
const generateChunkedSummary = async (content: string, options: SummaryOptions): Promise<string> => {
    // Split content into chunks
    const words = content.split(/\s+/);
    const chunkSize = 2000; // Words per chunk
    const chunks: string[] = [];
    
    for (let i = 0; i < words.length; i += chunkSize) {
        chunks.push(words.slice(i, i + chunkSize).join(' '));
    }

    console.log(`Processing ${chunks.length} chunks for summary generation`);

    // Generate summaries for each chunk
    const chunkSummaries = await Promise.all(
        chunks.map(async (chunk, index) => {
            try {
                const chunkPrompt = `
Summarize this part ${index + 1} of ${chunks.length} of the content in 1-2 sentences:

${chunk}

Focus on the key points and main ideas from this section.
                `;

                const response = await client.chat.completions.create({
                    model: NEBIUS_CONFIG.model,
                    messages: [{ role: 'user', content: chunkPrompt }],
                    max_tokens: 200,
                    temperature: 0.5,
                    top_p: 0.9,
                });

                return response.choices?.[0]?.message?.content?.trim() || '';
            } catch (error) {
                console.warn(`Failed to summarize chunk ${index + 1}:`, error);
                return '';
            }
        })
    );

    // Combine chunk summaries and generate final summary
    const combinedSummaries = chunkSummaries.filter(s => s.length > 0).join(' ');
    
    if (combinedSummaries.length === 0) {
        throw new Error('Failed to generate summaries for any content chunks');
    }

    const styleInstructions = {
        bullet: 'Format the summary as bullet points with key highlights',
        paragraph: 'Write the summary in clear, flowing paragraphs',
        executive: 'Write an executive summary focusing on key takeaways and actionable insights'
    };

    // Generate final summary from combined chunk summaries
    const finalPrompt = `
Create a comprehensive ${options.length} summary from these partial summaries:
${styleInstructions[options.style]}.

Partial summaries:
${combinedSummaries}

Please provide a coherent, well-structured summary that captures all the main points.
    `;

    const response = await client.chat.completions.create({
        model: NEBIUS_CONFIG.model,
        messages: [{ role: 'user', content: finalPrompt }],
        max_tokens: NEBIUS_CONFIG.maxTokens,
        temperature: 0.6,
        top_p: 0.9,
    });

    const finalSummary = response.choices?.[0]?.message?.content;
    if (!finalSummary) {
        throw new Error('Failed to generate final summary from chunk summaries');
    }

    return finalSummary.trim();
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
            const result = await extractPDFContent(buffer, file.name, options);
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
 * Main summarization function with enhanced content extraction
 * @param request - Summary request
 * @returns Promise<SummaryResponse> - Summary response with metadata
 */
export const generateSummary = async (request: SummaryRequest): Promise<SummaryResponse> => {
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
                    throw new Error('URL is required for URL summarization');
                }
                const articleResult = await extractArticle(request.url);
                content = articleResult.content;
                extractedContent = content;
                sourceType = 'website';
                break;
            case 'file':
                if (!request.file) {
                    throw new Error('File is required for file summarization');
                }
                content = await extractPDFContent(request.file);
                extractedContent = content;
                sourceType = 'document';
                break;
            case 'image':
                if (!request.imageFile) {
                    throw new Error('Image file is required for image summarization');
                }
                content = await extractImageText(request.imageFile);
                extractedContent = content;
                sourceType = 'image';
                break;
            case 'youtube':
                if (!request.youtubeUrl) {
                    throw new Error('YouTube URL is required for YouTube summarization');
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
            throw new Error('No content to summarize');
        }

        if (!request.length || !request.style) {
            throw new Error('Missing required options: length and style');
        }

        const summary = await generateNebiusSummary(content, {
            length: request.length,
            style: request.style,
            sourceType: sourceType
        });

        const response: SummaryResponse = {
            summary,
            originalLength: content.length,
            summaryLength: summary.length,
            compressionRatio: content.length > 0 ? (summary.length / content.length) : 0,
            topics: extractTopics(content),
            keywords: extractKeywords(content),
            source: {
                type: request.type,
                url: request.url || request.youtubeUrl,
                fileSize: request.file?.size || request.imageFile?.size,
                videoId,
                fileName: request.file?.name || request.imageFile?.name,
                ...extractionMetadata
            },
            transcript: transcript,
            extractedContent: extractedContent
        };

        return response;

    } catch (error) {
        console.error('Summary generation failed:', error);
        
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

// Extract topics from content (simplified)
const extractTopics = (content: string): string[] => {
    const words = content.toLowerCase().split(/\s+/);
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']);
    
    const wordFreq: { [key: string]: number } = {};
    words.forEach(word => {
        const cleanWord = word.replace(/[^\w]/g, '');
        if (cleanWord.length > 3 && !commonWords.has(cleanWord)) {
            wordFreq[cleanWord] = (wordFreq[cleanWord] || 0) + 1;
        }
    });

    return Object.entries(wordFreq)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([word]) => word);
};

// Extract keywords from content (simplified)
const extractKeywords = (content: string): string[] => {
    // This is a simplified keyword extraction
    // In production, you'd want to use NLP libraries or AI services
    const topics = extractTopics(content);
    return topics.slice(0, 10);
};

// Additional utility functions
export const validateSummaryRequest = (request: SummaryRequest): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!request.type) {
        errors.push('Request type is required');
    }
    
    if (!request.length || !request.style) {
        errors.push('Length and style options are required');
    }
    
    switch (request.type) {
        case 'text':
            if (!request.content || !request.content.trim()) {
                errors.push('Content is required for text summarization');
            }
            break;
        case 'url':
            if (!request.url || !request.url.trim()) {
                errors.push('URL is required for URL summarization');
            }
            break;
        case 'file':
            if (!request.file) {
                errors.push('File is required for file summarization');
            }
            break;
        case 'image':
            if (!request.imageFile) {
                errors.push('Image file is required for image summarization');
            }
            break;
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

export const getSummaryMetrics = (response: SummaryResponse) => {
    return {
        efficiency: response.compressionRatio,
        readabilityScore: response.summaryLength / response.originalLength,
        topicCoverage: response.topics.length,
        keywordDensity: response.keywords.length / response.summaryLength
    };
};

export const generateQuizFromSummary = async (summary: string) => {
    const prompt = `Generate 5 multiple choice questions based on the following summary. Return the questions in this exact JSON format:\n{\n  "questions": [\n    {\n      "question": "Question text here?",\n      "options": ["Option A", "Option B", "Option C", "Option D"],\n      "answer": "Correct option text"\n    }\n  ]\n}`;
    const response = await client.chat.completions.create({
        model: NEBIUS_CONFIG.model,
        messages: [
            { role: 'user', content: `${prompt}\n\nSummary:\n${summary}` }
        ],
        max_tokens: 800,
        temperature: 0.7,
    });
    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error('No quiz generated from Nebius API');
    try {
        const startIdx = content.indexOf('{');
        const endIdx = content.lastIndexOf('}') + 1;
        if (startIdx !== -1 && endIdx !== 0) {
            const jsonStr = content.substring(startIdx, endIdx);
            const data = JSON.parse(jsonStr);
            return data.questions;
        } else {
            throw new Error('No JSON found in response');
        }
    } catch (e) {
        return [
            {
                question: 'What is the main topic discussed?',
                options: ['Topic A', 'Topic B', 'Topic C', 'Topic D'],
                answer: 'Topic A'
            }
        ];
    }
};

export const generateMatchingPairsFromSummary = async (summary: string) => {
    const prompt = `Based on the following summary, generate 5 term-definition pairs for a matching game. Return the pairs in this exact JSON format:\n{\n  "pairs": [\n    {\n      "term": "Term here",\n      "definition": "Definition here"\n    }\n  ]\n}`;
    const response = await client.chat.completions.create({
        model: NEBIUS_CONFIG.model,
        messages: [
            { role: 'user', content: `${prompt}\n\nSummary:\n${summary}` }
        ],
        max_tokens: 600,
        temperature: 0.7,
    });
    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error('No matching pairs generated from Nebius API');
    try {
        const startIdx = content.indexOf('{');
        const endIdx = content.lastIndexOf('}') + 1;
        if (startIdx !== -1 && endIdx !== 0) {
            const jsonStr = content.substring(startIdx, endIdx);
            const data = JSON.parse(jsonStr);
            return data.pairs;
        } else {
            throw new Error('No JSON found in response');
        }
    } catch (e) {
        return [
            {
                term: 'Key Concept',
                definition: 'An important idea from the summary.'
            }
        ];
    }
};
