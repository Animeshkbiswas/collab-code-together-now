import { 
  getFullTranscript, 
  getChunkedTranscript, 
  fetchTranscript, 
  extractVideoId, 
  chunkTranscript,
  isValidYouTubeInput,
  TranscriptError,
  TranscriptSegment,
  ChunkedTranscript
} from '../transcriptService';

// Mock the youtube-transcript-api module
jest.mock('youtube-transcript-api', () => ({
  __esModule: true,
  default: {
    fetchTranscript: jest.fn(),
    listTranscripts: jest.fn()
  }
}));

// Import the mocked module
import YoutubeTranscript from 'youtube-transcript-api';

const mockYoutubeTranscript = YoutubeTranscript as jest.Mocked<typeof YoutubeTranscript>;

describe('transcriptService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.warn = jest.fn();
  });

  describe('extractVideoId', () => {
    it('should extract video ID from standard YouTube URL', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      const result = extractVideoId(url);
      expect(result).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from shortened YouTube URL', () => {
      const url = 'https://youtu.be/dQw4w9WgXcQ';
      const result = extractVideoId(url);
      expect(result).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from embed URL', () => {
      const url = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
      const result = extractVideoId(url);
      expect(result).toBe('dQw4w9WgXcQ');
    });

    it('should return video ID directly if already in correct format', () => {
      const videoId = 'dQw4w9WgXcQ';
      const result = extractVideoId(videoId);
      expect(result).toBe('dQw4w9WgXcQ');
    });

    it('should throw TranscriptError for invalid URL', () => {
      const invalidUrl = 'https://example.com/video';
      expect(() => extractVideoId(invalidUrl)).toThrow(TranscriptError);
      expect(() => extractVideoId(invalidUrl)).toThrow('Invalid YouTube URL format');
    });

    it('should throw TranscriptError for empty string', () => {
      expect(() => extractVideoId('')).toThrow(TranscriptError);
    });
  });

  describe('fetchTranscript', () => {
    const mockSegments: TranscriptSegment[] = [
      { text: 'Hello world', duration: 2000, offset: 0 },
      { text: 'This is a test', duration: 3000, offset: 2000 },
      { text: 'Thank you for watching', duration: 1500, offset: 5000 }
    ];

    it('should fetch transcript successfully', async () => {
      mockYoutubeTranscript.fetchTranscript.mockResolvedValue(mockSegments);

      const result = await fetchTranscript('dQw4w9WgXcQ');
      
      expect(result).toEqual(mockSegments);
      expect(mockYoutubeTranscript.fetchTranscript).toHaveBeenCalledWith('dQw4w9WgXcQ', {
        lang: 'en',
        country: 'US'
      });
    });

    it('should retry on network errors', async () => {
      const networkError = new Error('Network error');
      mockYoutubeTranscript.fetchTranscript
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(mockSegments);

      const result = await fetchTranscript('dQw4w9WgXcQ');
      
      expect(result).toEqual(mockSegments);
      expect(mockYoutubeTranscript.fetchTranscript).toHaveBeenCalledTimes(2);
    });

    it('should throw TranscriptError for no captions', async () => {
      const noCaptionsError = new Error('Could not get transcripts');
      mockYoutubeTranscript.fetchTranscript.mockRejectedValue(noCaptionsError);

      await expect(fetchTranscript('dQw4w9WgXcQ')).rejects.toThrow(TranscriptError);
      await expect(fetchTranscript('dQw4w9WgXcQ')).rejects.toThrow('NO_CAPTIONS');
    });

    it('should throw TranscriptError for rate limit', async () => {
      const rateLimitError = new Error('rate limit exceeded');
      mockYoutubeTranscript.fetchTranscript.mockRejectedValue(rateLimitError);

      await expect(fetchTranscript('dQw4w9WgXcQ')).rejects.toThrow(TranscriptError);
      await expect(fetchTranscript('dQw4w9WgXcQ')).rejects.toThrow('RATE_LIMIT');
    });

    it('should use custom options', async () => {
      mockYoutubeTranscript.fetchTranscript.mockResolvedValue(mockSegments);

      await fetchTranscript('dQw4w9WgXcQ', { language: 'es', retryAttempts: 1 });

      expect(mockYoutubeTranscript.fetchTranscript).toHaveBeenCalledWith('dQw4w9WgXcQ', {
        lang: 'es',
        country: 'US'
      });
    });
  });

  describe('chunkTranscript', () => {
    it('should chunk transcript into smaller pieces', () => {
      const longTranscript = 'This is a very long transcript that needs to be chunked into smaller pieces for processing. '.repeat(100);
      
      const result = chunkTranscript(longTranscript, 100); // Small chunk size for testing
      
      expect(result.chunks.length).toBeGreaterThan(1);
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.chunkCount).toBe(result.chunks.length);
    });

    it('should handle short transcript without chunking', () => {
      const shortTranscript = 'This is a short transcript.';
      
      const result = chunkTranscript(shortTranscript);
      
      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0]).toBe(shortTranscript);
    });

    it('should handle empty transcript', () => {
      const result = chunkTranscript('');
      
      expect(result.chunks).toHaveLength(0);
      expect(result.totalTokens).toBe(0);
      expect(result.chunkCount).toBe(0);
    });

    it('should respect maxTokensPerChunk parameter', () => {
      const transcript = 'word '.repeat(50);
      const maxTokens = 10;
      
      const result = chunkTranscript(transcript, maxTokens);
      
      // Each chunk should be within the token limit
      result.chunks.forEach(chunk => {
        const estimatedTokens = Math.ceil(chunk.length / 4);
        expect(estimatedTokens).toBeLessThanOrEqual(maxTokens);
      });
    });
  });

  describe('getFullTranscript', () => {
    const mockSegments: TranscriptSegment[] = [
      { text: 'Hello world', duration: 2000, offset: 0 },
      { text: 'This is a test', duration: 3000, offset: 2000 }
    ];

    it('should get full transcript from video ID', async () => {
      mockYoutubeTranscript.fetchTranscript.mockResolvedValue(mockSegments);

      const result = await getFullTranscript('dQw4w9WgXcQ');
      
      expect(result).toBe('Hello world This is a test');
    });

    it('should get full transcript from YouTube URL', async () => {
      mockYoutubeTranscript.fetchTranscript.mockResolvedValue(mockSegments);

      const result = await getFullTranscript('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      
      expect(result).toBe('Hello world This is a test');
    });

    it('should handle transcript extraction errors', async () => {
      const error = new TranscriptError('No captions available', 'NO_CAPTIONS', 'dQw4w9WgXcQ');
      mockYoutubeTranscript.fetchTranscript.mockRejectedValue(error);

      await expect(getFullTranscript('dQw4w9WgXcQ')).rejects.toThrow(TranscriptError);
    });

    it('should handle invalid URL format', async () => {
      await expect(getFullTranscript('invalid-url')).rejects.toThrow(TranscriptError);
    });
  });

  describe('getChunkedTranscript', () => {
    const mockSegments: TranscriptSegment[] = [
      { text: 'Hello world', duration: 2000, offset: 0 },
      { text: 'This is a test', duration: 3000, offset: 2000 }
    ];

    it('should return chunked transcript', async () => {
      mockYoutubeTranscript.fetchTranscript.mockResolvedValue(mockSegments);

      const result = await getChunkedTranscript('dQw4w9WgXcQ');
      
      expect(result).toHaveProperty('chunks');
      expect(result).toHaveProperty('totalTokens');
      expect(result).toHaveProperty('chunkCount');
      expect(Array.isArray(result.chunks)).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      const error = new TranscriptError('No captions available', 'NO_CAPTIONS', 'dQw4w9WgXcQ');
      mockYoutubeTranscript.fetchTranscript.mockRejectedValue(error);

      await expect(getChunkedTranscript('dQw4w9WgXcQ')).rejects.toThrow(TranscriptError);
    });
  });

  describe('isValidYouTubeInput', () => {
    it('should return true for valid YouTube URLs', () => {
      expect(isValidYouTubeInput('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
      expect(isValidYouTubeInput('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
      expect(isValidYouTubeInput('dQw4w9WgXcQ')).toBe(true);
    });

    it('should return false for invalid inputs', () => {
      expect(isValidYouTubeInput('https://example.com/video')).toBe(false);
      expect(isValidYouTubeInput('')).toBe(false);
      expect(isValidYouTubeInput('invalid')).toBe(false);
    });
  });

  describe('TranscriptError', () => {
    it('should create TranscriptError with correct properties', () => {
      const error = new TranscriptError('Test message', 'NO_CAPTIONS', 'dQw4w9WgXcQ');
      
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('NO_CAPTIONS');
      expect(error.videoId).toBe('dQw4w9WgXcQ');
      expect(error.name).toBe('TranscriptError');
    });

    it('should create TranscriptError without videoId', () => {
      const error = new TranscriptError('Test message', 'PARSE_ERROR');
      
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('PARSE_ERROR');
      expect(error.videoId).toBeUndefined();
    });
  });

  describe('Error handling and retries', () => {
    it('should retry on transient errors', async () => {
      const transientError = new Error('Network timeout');
      const mockSegments: TranscriptSegment[] = [
        { text: 'Success after retry', duration: 1000, offset: 0 }
      ];

      mockYoutubeTranscript.fetchTranscript
        .mockRejectedValueOnce(transientError)
        .mockRejectedValueOnce(transientError)
        .mockResolvedValueOnce(mockSegments);

      const result = await fetchTranscript('dQw4w9WgXcQ', { retryAttempts: 3 });
      
      expect(result).toEqual(mockSegments);
      expect(mockYoutubeTranscript.fetchTranscript).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const persistentError = new Error('Persistent error');
      mockYoutubeTranscript.fetchTranscript.mockRejectedValue(persistentError);

      await expect(fetchTranscript('dQw4w9WgXcQ', { retryAttempts: 2 })).rejects.toThrow(TranscriptError);
      expect(mockYoutubeTranscript.fetchTranscript).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance and edge cases', () => {
    it('should handle very long transcripts', async () => {
      const longSegments: TranscriptSegment[] = Array.from({ length: 1000 }, (_, i) => ({
        text: `Segment ${i} with some content`,
        duration: 1000,
        offset: i * 1000
      }));

      mockYoutubeTranscript.fetchTranscript.mockResolvedValue(longSegments);

      const result = await getFullTranscript('dQw4w9WgXcQ');
      
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('Segment 0');
      expect(result).toContain('Segment 999');
    });

    it('should handle empty segments array', async () => {
      mockYoutubeTranscript.fetchTranscript.mockResolvedValue([]);

      const result = await getFullTranscript('dQw4w9WgXcQ');
      
      expect(result).toBe('');
    });

    it('should handle segments with empty text', async () => {
      const segmentsWithEmpty: TranscriptSegment[] = [
        { text: 'Hello', duration: 1000, offset: 0 },
        { text: '', duration: 500, offset: 1000 },
        { text: 'World', duration: 1000, offset: 1500 }
      ];

      mockYoutubeTranscript.fetchTranscript.mockResolvedValue(segmentsWithEmpty);

      const result = await getFullTranscript('dQw4w9WgXcQ');
      
      expect(result).toBe('Hello World');
    });
  });
}); 