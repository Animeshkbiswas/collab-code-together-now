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
    };
}

export interface SummaryOptions {
    length: 'short' | 'medium' | 'long';
    style: 'bullet' | 'paragraph' | 'executive';
    sourceType: string;
}

// Generate summary using Nebius API
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

// Extract content from URL
const extractContentFromUrl = async (url: string): Promise<string> => {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        if (response.ok) {
            const html = await response.text();
            const textContent = html
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            if (textContent.length > 100) {
                return textContent.substring(0, 5000);
            }
        }
        throw new Error(`Failed to extract content from this website. This could be due to CORS restrictions, the site blocking automated requests, or the content being dynamically loaded. Please copy the content manually from the webpage or provide a description of what the page is about.`);
    } catch (error) {
        throw error;
    }
};

// Extract YouTube transcript with multiple methods
const extractYouTubeTranscript = async (youtubeUrl: string): Promise<string> => {
    // Browser-based extraction is not reliable due to CORS and YouTube API restrictions.
    // You can only extract transcript if CORS allows or if you use a backend proxy.
    throw new Error('Automatic YouTube transcript extraction is not supported in the browser. Please provide the transcript manually or use a backend proxy.');
};

// Extract text from file
const extractTextFromFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
    });
};

// Extract text from image (placeholder)
const extractTextFromImage = async (imageFile: File): Promise<string> => {
    throw new Error('Image OCR is not supported in the browser.');
};

// Main summarization function
export const generateSummary = async (request: SummaryRequest): Promise<SummaryResponse> => {
    let content = '';
    let sourceType = 'text';
    switch (request.type) {
        case 'text':
            content = request.content || '';
            sourceType = 'text';
            break;
        case 'url':
            content = await extractContentFromUrl(request.url || '');
            sourceType = 'website';
            break;
        case 'file':
            if (!request.file) {
                throw new Error('No file provided');
            }
            content = await extractTextFromFile(request.file);
            sourceType = 'document';
            break;
        case 'image':
            if (!request.imageFile) {
                throw new Error('No image file provided');
            }
            content = await extractTextFromImage(request.imageFile);
            sourceType = 'image';
            break;
        case 'youtube':
            // Not supported in browser
            throw new Error('Automatic YouTube transcript extraction is not supported in the browser. Please provide the transcript manually or use a backend proxy.');
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
            fileSize: request.file?.size || request.imageFile?.size
        }
    };
    return response;
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
