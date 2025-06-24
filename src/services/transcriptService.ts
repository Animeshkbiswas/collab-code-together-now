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
 * Gets the full transcript text from YouTube video
 * @param videoId - YouTube video ID or URL
 * @param options - Transcript extraction options
 * @returns Promise<string> - Full transcript text
 */
export const getFullTranscript = async (
  videoIdOrUrl: string,
  options: TranscriptOptions = {}
): Promise<string> => {
  try {
    // Extract video ID if URL is provided
    const videoId = extractVideoId(videoIdOrUrl);
    
    // Fetch transcript segments
    const segments = await fetchTranscript(videoId, options);
    
    // Concatenate segments into full transcript
    const fullTranscript = segments
      .map(segment => segment.text.trim())
      .join(' ');
    
    console.log(`Generated full transcript (${fullTranscript.length} characters)`);
    return fullTranscript;
    
  } catch (error) {
    if (error instanceof TranscriptError) {
      throw error;
    }
    
    throw new TranscriptError(
      `Failed to get transcript: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'UNKNOWN',
      videoIdOrUrl
    );
  }
};

/**
 * Gets chunked transcript for API processing
 * @param videoId - YouTube video ID or URL
 * @param options - Transcript extraction options
 * @returns Promise<ChunkedTranscript> - Chunked transcript data
 */
export const getChunkedTranscript = async (
  videoIdOrUrl: string,
  options: TranscriptOptions = {}
): Promise<ChunkedTranscript> => {
  const fullTranscript = await getFullTranscript(videoIdOrUrl, options);
  return chunkTranscript(fullTranscript);
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