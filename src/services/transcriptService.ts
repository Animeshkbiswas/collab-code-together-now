import YoutubeTranscript from 'youtube-transcript-api';

/**
 * Interface for YouTube transcript segment
 */
export interface TranscriptSegment {
  text: string;
  duration: number;
  offset: number;
}

/**
 * Interface for transcript extraction options
 */
export interface TranscriptOptions {
  language?: string;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * Interface for chunked transcript data
 */
export interface ChunkedTranscript {
  chunks: string[];
  totalTokens: number;
  chunkCount: number;
}

/**
 * Error types for transcript extraction
 */
export class TranscriptError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_CAPTIONS' | 'NETWORK_ERROR' | 'PARSE_ERROR' | 'RATE_LIMIT' | 'UNKNOWN',
    public readonly videoId?: string
  ) {
    super(message);
    this.name = 'TranscriptError';
  }
}

/**
 * Configuration for transcript processing
 */
const TRANSCRIPT_CONFIG = {
  maxTokensPerChunk: 4096,
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
  maxRetryDelay: 5000, // 5 seconds
};

/**
 * Extracts video ID from various YouTube URL formats
 * @param url - YouTube URL or video ID
 * @returns Video ID string
 */
export const extractVideoId = (url: string): string => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /^[a-zA-Z0-9_-]{11}$/ // Direct video ID format
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }

  throw new TranscriptError(
    'Invalid YouTube URL format. Please provide a valid YouTube URL or video ID.',
    'PARSE_ERROR'
  );
};

/**
 * Fetches transcript segments from YouTube video
 * @param videoId - YouTube video ID
 * @param options - Transcript extraction options
 * @returns Promise<TranscriptSegment[]>
 */
export const fetchTranscript = async (
  videoId: string,
  options: TranscriptOptions = {}
): Promise<TranscriptSegment[]> => {
  const { language, retryAttempts = TRANSCRIPT_CONFIG.retryAttempts, retryDelay = TRANSCRIPT_CONFIG.retryDelay } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    try {
      console.log(`Attempting to fetch transcript for video ${videoId} (attempt ${attempt}/${retryAttempts})`);
      
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: language || 'en',
        country: 'US'
      });
      
      console.log(`Successfully fetched transcript with ${transcript.length} segments`);
      return transcript;
      
    } catch (error) {
      lastError = error as Error;
      console.warn(`Transcript fetch attempt ${attempt} failed:`, error);
      
      // Determine error type and handle accordingly
      if (error instanceof Error) {
        if (error.message.includes('Could not get transcripts')) {
          throw new TranscriptError(
            'No captions available for this video. Please enable captions or provide a transcript manually.',
            'NO_CAPTIONS',
            videoId
          );
        }
        
        if (error.message.includes('rate limit') || error.message.includes('429')) {
          if (attempt < retryAttempts) {
            const delay = Math.min(retryDelay * Math.pow(2, attempt - 1), TRANSCRIPT_CONFIG.maxRetryDelay);
            console.log(`Rate limited, waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw new TranscriptError(
            'Rate limit exceeded. Please try again later.',
            'RATE_LIMIT',
            videoId
          );
        }
        
        if (error.message.includes('network') || error.message.includes('fetch')) {
          if (attempt < retryAttempts) {
            const delay = retryDelay * attempt;
            console.log(`Network error, waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw new TranscriptError(
            'Network error occurred while fetching transcript. Please check your connection and try again.',
            'NETWORK_ERROR',
            videoId
          );
        }
      }
      
      // If we've exhausted retries, throw the last error
      if (attempt === retryAttempts) {
        throw new TranscriptError(
          `Failed to fetch transcript after ${retryAttempts} attempts: ${lastError?.message || 'Unknown error'}`,
          'UNKNOWN',
          videoId
        );
      }
    }
  }
  
  throw new TranscriptError(
    'Unexpected error during transcript extraction',
    'UNKNOWN',
    videoId
  );
};

/**
 * Estimates token count for a text string (rough approximation)
 * @param text - Text to count tokens for
 * @returns Estimated token count
 */
const estimateTokenCount = (text: string): number => {
  // Rough approximation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
};

/**
 * Splits transcript into chunks that fit within token limits
 * @param transcript - Full transcript text
 * @param maxTokensPerChunk - Maximum tokens per chunk
 * @returns ChunkedTranscript object
 */
export const chunkTranscript = (
  transcript: string,
  maxTokensPerChunk: number = TRANSCRIPT_CONFIG.maxTokensPerChunk
): ChunkedTranscript => {
  const words = transcript.split(/\s+/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentTokenCount = 0;
  
  for (const word of words) {
    const wordTokenCount = estimateTokenCount(word + ' ');
    
    if (currentTokenCount + wordTokenCount > maxTokensPerChunk && currentChunk.length > 0) {
      // Current chunk is full, save it and start a new one
      chunks.push(currentChunk.join(' '));
      currentChunk = [word];
      currentTokenCount = wordTokenCount;
    } else {
      // Add word to current chunk
      currentChunk.push(word);
      currentTokenCount += wordTokenCount;
    }
  }
  
  // Add the last chunk if it has content
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }
  
  const totalTokens = estimateTokenCount(transcript);
  
  return {
    chunks,
    totalTokens,
    chunkCount: chunks.length
  };
};

/**
 * Gets full transcript text from YouTube video with API fallback
 * @param videoIdOrUrl - YouTube video ID or URL
 * @param options - Transcript extraction options
 * @returns Promise<string>
 */
export const getFullTranscript = async (
  videoIdOrUrl: string,
  options: TranscriptOptions = {}
): Promise<string> => {
  const isBrowser = typeof window !== 'undefined';
  try {
    if (isBrowser) {
      // Use serverless API endpoint in browser (GET)
      const videoId = extractVideoId(videoIdOrUrl);
      const response = await fetch(`/api/getTranscript?videoId=${encodeURIComponent(videoId)}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || response.statusText);
      }
      const data = await response.json();
      if (!data.transcript) {
        throw new Error('No transcript returned from server');
      }
      return data.transcript;
    }
    // Server-side: use youtube-transcript-api directly
    const videoId = extractVideoId(videoIdOrUrl);
    const segments = await fetchTranscript(videoId, options);
    return segments.map(s => s.text).join(' ');
  } catch (error) {
    throw new TranscriptError(
      `Failed to extract transcript: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'UNKNOWN',
      videoIdOrUrl
    );
  }
};

/**
 * Gets chunked transcript for processing with API fallback
 * @param videoIdOrUrl - YouTube video ID or URL
 * @param options - Transcript extraction options
 * @returns Promise<ChunkedTranscript>
 */
export const getChunkedTranscript = async (
  videoIdOrUrl: string,
  options: TranscriptOptions = {}
): Promise<ChunkedTranscript> => {
  try {
    const videoId = extractVideoId(videoIdOrUrl);
    const segments = await fetchTranscriptWithFallback(videoId, options);
    
    const fullText = segments.map(segment => segment.text.trim()).join(' ');
    return chunkTranscript(fullText);
  } catch (error) {
    if (error instanceof TranscriptError) {
      throw error;
    }
    
    throw new TranscriptError(
      `Failed to get chunked transcript: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'UNKNOWN',
      videoIdOrUrl
    );
  }
};

/**
 * Validates if a YouTube URL or video ID is valid
 * @param input - YouTube URL or video ID
 * @returns boolean - True if valid
 */
export const isValidYouTubeInput = (input: string): boolean => {
  try {
    extractVideoId(input);
    return true;
  } catch {
    return false;
  }
};

/**
 * Gets available languages for a video (if supported by the API)
 * @param videoId - YouTube video ID
 * @returns Promise<string[]> - Available language codes
 */
export const getAvailableLanguages = async (videoId: string): Promise<string[]> => {
  try {
    // This is a simplified implementation
    // In a full implementation, you might want to fetch available captions
    const transcript = await fetchTranscript(videoId);
    return transcript.length > 0 ? ['en'] : [];
  } catch {
    return [];
  }
};

/**
 * Fallback function for when transcript extraction fails
 * @param videoId - YouTube video ID
 * @returns string - Fallback message
 */
export const getTranscriptFallbackMessage = (videoId: string): string => {
  return `Transcript extraction failed for video ${videoId}. Please provide the transcript manually or ensure captions are enabled for this video.`;
};

/**
 * Fetches transcript using Vercel API endpoint as fallback
 * @param videoId - YouTube video ID
 * @param options - Transcript extraction options
 * @returns Promise<TranscriptSegment[]>
 */
export const fetchTranscriptViaAPI = async (
  videoId: string,
  options: TranscriptOptions = {}
): Promise<TranscriptSegment[]> => {
  const { retryAttempts = TRANSCRIPT_CONFIG.retryAttempts, retryDelay = TRANSCRIPT_CONFIG.retryDelay } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    try {
      console.log(`Attempting to fetch transcript via API for video ${videoId} (attempt ${attempt}/${retryAttempts})`);
      
      // Use the Vercel API endpoint
      const apiUrl = process.env.NODE_ENV === 'production' 
        ? `https://${process.env.VERCEL_URL || 'your-app.vercel.app'}/api/getTranscript`
        : '/api/getTranscript';
      
      const response = await fetch(`${apiUrl}?videoId=${encodeURIComponent(videoId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.transcript) {
        throw new Error('No transcript data received from API');
      }
      
      // Convert the transcript text back to segments format
      // This is a simplified conversion - you might want to preserve timing if available
      const segments: TranscriptSegment[] = data.segments || [{
        text: data.transcript,
        duration: 0,
        offset: 0
      }];
      
      console.log(`Successfully fetched transcript via API with ${segments.length} segments`);
      return segments;
      
    } catch (error) {
      lastError = error as Error;
      console.warn(`API transcript fetch attempt ${attempt} failed:`, error);
      
      if (error instanceof Error) {
        if (error.message.includes('No captions') || error.message.includes('No transcript')) {
          throw new TranscriptError(
            'No captions available for this video. Please enable captions or provide a transcript manually.',
            'NO_CAPTIONS',
            videoId
          );
        }
        
        if (error.message.includes('rate limit') || error.message.includes('429')) {
          if (attempt < retryAttempts) {
            const delay = Math.min(retryDelay * Math.pow(2, attempt - 1), TRANSCRIPT_CONFIG.maxRetryDelay);
            console.log(`Rate limited, waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw new TranscriptError(
            'Rate limit exceeded. Please try again later.',
            'RATE_LIMIT',
            videoId
          );
        }
        
        if (error.message.includes('network') || error.message.includes('fetch')) {
          if (attempt < retryAttempts) {
            const delay = retryDelay * attempt;
            console.log(`Network error, waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw new TranscriptError(
            'Network error occurred while fetching transcript. Please check your connection and try again.',
            'NETWORK_ERROR',
            videoId
          );
        }
      }
      
      // If we've exhausted retries, throw the last error
      if (attempt === retryAttempts) {
        throw new TranscriptError(
          `Failed to fetch transcript via API after ${retryAttempts} attempts: ${lastError?.message || 'Unknown error'}`,
          'UNKNOWN',
          videoId
        );
      }
    }
  }
  
  throw new TranscriptError(
    'Unexpected error during API transcript extraction',
    'UNKNOWN',
    videoId
  );
};

/**
 * Enhanced transcript fetching with API fallback
 * @param videoId - YouTube video ID
 * @param options - Transcript extraction options
 * @returns Promise<TranscriptSegment[]>
 */
export const fetchTranscriptWithFallback = async (
  videoId: string,
  options: TranscriptOptions = {}
): Promise<TranscriptSegment[]> => {
  try {
    // First try direct YouTube API
    console.log('Attempting direct YouTube transcript extraction...');
    return await fetchTranscript(videoId, options);
  } catch (error) {
    console.log('Direct extraction failed, trying API fallback...');
    
    // If direct extraction fails, try the Vercel API
    try {
      return await fetchTranscriptViaAPI(videoId, options);
    } catch (apiError) {
      console.error('Both direct and API extraction failed:', { direct: error, api: apiError });
      
      // Re-throw the original error if API also fails
      if (error instanceof TranscriptError) {
        throw error;
      }
      
      throw new TranscriptError(
        `Failed to extract transcript: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNKNOWN',
        videoId
      );
    }
  }
}; 