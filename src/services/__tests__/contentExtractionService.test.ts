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
} from '../contentExtractionService';

// Mock the external libraries
jest.mock('@mozilla/readability', () => ({
  Readability: jest.fn().mockImplementation(() => ({
    parse: jest.fn().mockReturnValue({
      textContent: 'Mock article content extracted from website',
      language: 'en'
    })
  }))
}));

jest.mock('jsdom', () => ({
  JSDOM: jest.fn().mockImplementation(() => ({
    window: {
      document: {}
    }
  }))
}));

jest.mock('pdf-parse', () => jest.fn().mockResolvedValue({
  text: 'Mock PDF content extracted from file',
  language: 'en'
}));

jest.mock('tesseract.js', () => ({
  createWorker: jest.fn().mockResolvedValue({
    loadLanguage: jest.fn().mockResolvedValue(undefined),
    initialize: jest.fn().mockResolvedValue(undefined),
    setParameters: jest.fn().mockResolvedValue(undefined),
    recognize: jest.fn().mockResolvedValue({
      data: {
        text: 'Mock text extracted from image'
      }
    }),
    terminate: jest.fn().mockResolvedValue(undefined)
  })
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('Content Extraction Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractArticle', () => {
    it('should extract article content from a valid URL', async () => {
      const mockHtml = '<html><body><article>Test content</article></body></html>';
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('text/html; charset=utf-8')
        },
        text: jest.fn().mockResolvedValue(mockHtml)
      });

      const result = await extractArticle('https://example.com/article');

      expect(result.content).toBe('Mock article content extracted from website');
      expect(result.metadata.sourceType).toBe('website');
      expect(result.metadata.url).toBe('https://example.com/article');
      expect(result.metadata.language).toBe('en');
    });

    it('should handle network errors with retry logic', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: jest.fn().mockReturnValue('text/html; charset=utf-8')
          },
          text: jest.fn().mockResolvedValue('<html><body>Content</body></html>')
        });

      const result = await extractArticle('https://example.com/article');

      expect(result.content).toBe('Mock article content extracted from website');
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should throw ContentExtractionError for invalid content type', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('application/json')
        },
        text: jest.fn().mockResolvedValue('{"data": "json"}')
      });

      await expect(extractArticle('https://example.com/api'))
        .rejects
        .toThrow(ContentExtractionError);
    });

    it('should throw ContentExtractionError for HTTP errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(extractArticle('https://example.com/notfound'))
        .rejects
        .toThrow(ContentExtractionError);
    });

    it('should respect content length limits', async () => {
      const longContent = 'A'.repeat(200000); // 200KB content
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('text/html; charset=utf-8')
        },
        text: jest.fn().mockResolvedValue('<html><body>Content</body></html>')
      });

      const { Readability } = require('@mozilla/readability');
      Readability.mockImplementationOnce(() => ({
        parse: jest.fn().mockReturnValue({
          textContent: longContent,
          language: 'en'
        })
      }));

      const result = await extractArticle('https://example.com/article', {
        maxContentLength: 100000
      });

      expect(result.content.length).toBeLessThanOrEqual(100000);
      expect(result.content).toContain('...');
    });
  });

  describe('extractPdf', () => {
    it('should extract text content from PDF buffer', async () => {
      const mockBuffer = Buffer.from('mock pdf content');
      const fileName = 'test.pdf';

      const result = await extractPdf(mockBuffer, fileName);

      expect(result.content).toBe('Mock PDF content extracted from file');
      expect(result.metadata.sourceType).toBe('pdf');
      expect(result.metadata.fileName).toBe(fileName);
      expect(result.metadata.fileSize).toBe(mockBuffer.length);
      expect(result.metadata.language).toBe('en');
    });

    it('should throw ContentExtractionError for empty PDF content', async () => {
      const mockBuffer = Buffer.from('mock pdf content');
      const fileName = 'test.pdf';

      const pdf = require('pdf-parse');
      pdf.mockResolvedValueOnce({
        text: '',
        language: 'en'
      });

      await expect(extractPdf(mockBuffer, fileName))
        .rejects
        .toThrow(ContentExtractionError);
    });

    it('should handle PDF parsing errors', async () => {
      const mockBuffer = Buffer.from('invalid pdf content');
      const fileName = 'test.pdf';

      const pdf = require('pdf-parse');
      pdf.mockRejectedValueOnce(new Error('PDF parsing failed'));

      await expect(extractPdf(mockBuffer, fileName))
        .rejects
        .toThrow(ContentExtractionError);
    });
  });

  describe('extractImageText', () => {
    it('should extract text from valid image file', async () => {
      const mockFile = new File(['mock image data'], 'test.jpg', {
        type: 'image/jpeg'
      });

      const result = await extractImageText(mockFile);

      expect(result.content).toBe('Mock text extracted from image');
      expect(result.metadata.sourceType).toBe('image');
      expect(result.metadata.fileName).toBe('test.jpg');
      expect(result.metadata.fileSize).toBe(mockFile.size);
      expect(result.metadata.language).toBe('en');
    });

    it('should throw ContentExtractionError for unsupported image format', async () => {
      const mockFile = new File(['mock image data'], 'test.webp', {
        type: 'image/webp'
      });

      await expect(extractImageText(mockFile))
        .rejects
        .toThrow(ContentExtractionError);
    });

    it('should throw ContentExtractionError for empty OCR result', async () => {
      const mockFile = new File(['mock image data'], 'test.jpg', {
        type: 'image/jpeg'
      });

      const { createWorker } = require('tesseract.js');
      createWorker.mockResolvedValueOnce({
        loadLanguage: jest.fn().mockResolvedValue(undefined),
        initialize: jest.fn().mockResolvedValue(undefined),
        setParameters: jest.fn().mockResolvedValue(undefined),
        recognize: jest.fn().mockResolvedValue({
          data: {
            text: ''
          }
        }),
        terminate: jest.fn().mockResolvedValue(undefined)
      });

      await expect(extractImageText(mockFile))
        .rejects
        .toThrow(ContentExtractionError);
    });

    it('should handle OCR processing errors', async () => {
      const mockFile = new File(['mock image data'], 'test.jpg', {
        type: 'image/jpeg'
      });

      const { createWorker } = require('tesseract.js');
      createWorker.mockRejectedValueOnce(new Error('OCR processing failed'));

      await expect(extractImageText(mockFile))
        .rejects
        .toThrow(ContentExtractionError);
    });

    it('should always terminate worker even if processing fails', async () => {
      const mockFile = new File(['mock image data'], 'test.jpg', {
        type: 'image/jpeg'
      });

      const mockTerminate = jest.fn().mockResolvedValue(undefined);
      const { createWorker } = require('tesseract.js');
      createWorker.mockResolvedValueOnce({
        loadLanguage: jest.fn().mockResolvedValue(undefined),
        initialize: jest.fn().mockResolvedValue(undefined),
        setParameters: jest.fn().mockResolvedValue(undefined),
        recognize: jest.fn().mockRejectedValue(new Error('OCR failed')),
        terminate: mockTerminate
      });

      await expect(extractImageText(mockFile))
        .rejects
        .toThrow(ContentExtractionError);

      expect(mockTerminate).toHaveBeenCalled();
    });
  });

  describe('validateUrl', () => {
    it('should return true for valid HTML URL', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('text/html; charset=utf-8')
        }
      });

      const result = await validateUrl('https://example.com');

      expect(result).toBe(true);
    });

    it('should return false for non-HTML URL', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('application/json')
        }
      });

      const result = await validateUrl('https://example.com/api');

      expect(result).toBe(false);
    });

    it('should return false for network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await validateUrl('https://example.com');

      expect(result).toBe(false);
    });

    it('should return false for HTTP errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const result = await validateUrl('https://example.com/notfound');

      expect(result).toBe(false);
    });
  });

  describe('validatePdfFile', () => {
    it('should return true for PDF files', () => {
      const pdfFile = new File(['pdf content'], 'test.pdf', {
        type: 'application/pdf'
      });

      expect(validatePdfFile(pdfFile)).toBe(true);
    });

    it('should return true for files with .pdf extension', () => {
      const pdfFile = new File(['pdf content'], 'test.pdf', {
        type: 'text/plain'
      });

      expect(validatePdfFile(pdfFile)).toBe(true);
    });

    it('should return false for non-PDF files', () => {
      const textFile = new File(['text content'], 'test.txt', {
        type: 'text/plain'
      });

      expect(validatePdfFile(textFile)).toBe(false);
    });
  });

  describe('validateImageFile', () => {
    it('should return true for supported image formats', () => {
      const supportedFormats = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/bmp',
        'image/tiff'
      ];

      supportedFormats.forEach(format => {
        const imageFile = new File(['image data'], `test.${format.split('/')[1]}`, {
          type: format
        });

        expect(validateImageFile(imageFile)).toBe(true);
      });
    });

    it('should return false for unsupported image formats', () => {
      const unsupportedFormats = [
        'image/webp',
        'image/svg+xml',
        'application/pdf'
      ];

      unsupportedFormats.forEach(format => {
        const file = new File(['file data'], 'test.file', {
          type: format
        });

        expect(validateImageFile(file)).toBe(false);
      });
    });
  });

  describe('getExtractionFallbackMessage', () => {
    it('should return appropriate fallback message for website', () => {
      const message = getExtractionFallbackMessage('website', 'https://example.com');
      
      expect(message).toContain('Content extraction failed for https://example.com');
      expect(message).toContain('copy the text manually');
    });

    it('should return appropriate fallback message for PDF', () => {
      const message = getExtractionFallbackMessage('pdf', 'document.pdf');
      
      expect(message).toContain('PDF text extraction failed for document.pdf');
      expect(message).toContain('image-based or password-protected');
    });

    it('should return appropriate fallback message for image', () => {
      const message = getExtractionFallbackMessage('image', 'image.jpg');
      
      expect(message).toContain('Image OCR failed for image.jpg');
      expect(message).toContain('readable text or the text may be too small/blurry');
    });

    it('should return generic fallback message for unknown type', () => {
      const message = getExtractionFallbackMessage('unknown', 'file.xyz');
      
      expect(message).toContain('Content extraction failed for file.xyz');
      expect(message).toContain('provide the content manually');
    });
  });

  describe('ContentExtractionError', () => {
    it('should create error with correct properties', () => {
      const error = new ContentExtractionError(
        'Test error message',
        'NETWORK_ERROR',
        'https://example.com'
      );

      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.source).toBe('https://example.com');
      expect(error.name).toBe('ContentExtractionError');
    });

    it('should be instanceof Error', () => {
      const error = new ContentExtractionError(
        'Test error message',
        'EXTRACTION_FAILED'
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ContentExtractionError);
    });
  });

  describe('Extraction Options', () => {
    it('should respect custom timeout option', async () => {
      const mockHtml = '<html><body>Content</body></html>';
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('text/html; charset=utf-8')
        },
        text: jest.fn().mockResolvedValue(mockHtml)
      });

      const options: ExtractionOptions = {
        timeout: 5000,
        retryAttempts: 2,
        retryDelay: 500,
        maxContentLength: 50000
      };

      await extractArticle('https://example.com/article', options);

      // Verify that fetch was called with the correct timeout
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/article',
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      );
    });

    it('should respect custom content length limit', async () => {
      const longContent = 'A'.repeat(100000);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('text/html; charset=utf-8')
        },
        text: jest.fn().mockResolvedValue('<html><body>Content</body></html>')
      });

      const { Readability } = require('@mozilla/readability');
      Readability.mockImplementationOnce(() => ({
        parse: jest.fn().mockReturnValue({
          textContent: longContent,
          language: 'en'
        })
      }));

      const options: ExtractionOptions = {
        maxContentLength: 50000
      };

      const result = await extractArticle('https://example.com/article', options);

      expect(result.content.length).toBeLessThanOrEqual(50000);
      expect(result.content).toContain('...');
    });
  });

  describe('Error Handling and Retry Logic', () => {
    it('should implement exponential backoff for retries', async () => {
      const mockHtml = '<html><body>Content</body></html>';
      
      // First two attempts fail with timeout
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('AbortError'))
        .mockRejectedValueOnce(new Error('AbortError'))
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: jest.fn().mockReturnValue('text/html; charset=utf-8')
          },
          text: jest.fn().mockResolvedValue(mockHtml)
        });

      const startTime = Date.now();
      await extractArticle('https://example.com/article');
      const endTime = Date.now();

      // Should have waited at least 1 second (1000ms) for retry delay
      expect(endTime - startTime).toBeGreaterThanOrEqual(1000);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should handle network errors with retry', async () => {
      const mockHtml = '<html><body>Content</body></html>';
      
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockRejectedValueOnce(new Error('NetworkError'))
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: jest.fn().mockReturnValue('text/html; charset=utf-8')
          },
          text: jest.fn().mockResolvedValue(mockHtml)
        });

      const result = await extractArticle('https://example.com/article');

      expect(result.content).toBe('Mock article content extracted from website');
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retry attempts', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValue(new Error('Network error'));

      await expect(extractArticle('https://example.com/article'))
        .rejects
        .toThrow(ContentExtractionError);

      // Should have tried 3 times (default retry attempts)
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });
}); 