// Browser compatibility check
const isBrowser = typeof window !== 'undefined';
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

// Conditional imports for Node.js-only libraries
let Readability: any;
let JSDOM: any;
let pdf: any;

if (!isBrowser) {
  // Server-side: Import Node.js libraries
  try {
    const readabilityModule = require('@mozilla/readability');
    Readability = readabilityModule.Readability;
    const jsdomModule = require('jsdom');
    JSDOM = jsdomModule.JSDOM;
    const pdfModule = require('pdf-parse');
    pdf = pdfModule.default || pdfModule;
  } catch (error) {
    console.warn('Node.js libraries not available:', error);
  }
}

// Tesseract.js is browser-compatible, so we can import it directly
import { createWorker } from 'tesseract.js';

/**
 * Interface for content extraction options
 */
export interface ExtractionOptions {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  maxContentLength?: number;
}

/**
 * Interface for extraction result
 */
export interface ExtractionResult {
  content: string;
  metadata: {
    sourceType: 'website' | 'pdf' | 'image';
    url?: string;
    fileName?: string;
    fileSize?: number;
    extractionTime: number;
    contentLength: number;
    language?: string;
  };
}

/**
 * Custom error class for content extraction
 */
export class ContentExtractionError extends Error {
  constructor(
    message: string,
    public readonly code: 'NETWORK_ERROR' | 'PARSE_ERROR' | 'TIMEOUT_ERROR' | 'UNSUPPORTED_FORMAT' | 'EXTRACTION_FAILED' | 'UNKNOWN',
    public readonly source?: string
  ) {
    super(message);
    this.name = 'ContentExtractionError';
  }
}

/**
 * Configuration for content extraction
 */
const EXTRACTION_CONFIG = {
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
  maxRetryDelay: 5000, // 5 seconds
  maxContentLength: 100000, // 100KB
};

/**
 * Implements exponential backoff for retries
 * @param attempt - Current attempt number
 * @param baseDelay - Base delay in milliseconds
 * @param maxDelay - Maximum delay in milliseconds
 * @returns Delay in milliseconds
 */
const getBackoffDelay = (attempt: number, baseDelay: number, maxDelay: number): number => {
  const delay = baseDelay * Math.pow(2, attempt - 1);
  return Math.min(delay, maxDelay);
};

/**
 * Fetches HTML content from a URL with retry logic
 * @param url - URL to fetch
 * @param options - Fetch options
 * @returns Promise<string> - HTML content
 */
const fetchWithRetry = async (url: string, options: ExtractionOptions = {}): Promise<string> => {
  const { timeout = EXTRACTION_CONFIG.timeout, retryAttempts = EXTRACTION_CONFIG.retryAttempts } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    try {
      console.log(`Fetching content from ${url} (attempt ${attempt}/${retryAttempts})`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('text/html')) {
        throw new ContentExtractionError(
          `Invalid content type: ${contentType}. Expected HTML content.`,
          'UNSUPPORTED_FORMAT',
          url
        );
      }
      
      const html = await response.text();
      console.log(`Successfully fetched ${html.length} characters from ${url}`);
      return html;
      
    } catch (error) {
      lastError = error as Error;
      console.warn(`Fetch attempt ${attempt} failed:`, error);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          if (attempt < retryAttempts) {
            const delay = getBackoffDelay(attempt, EXTRACTION_CONFIG.retryDelay, EXTRACTION_CONFIG.maxRetryDelay);
            console.log(`Request timed out, waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw new ContentExtractionError(
            `Request timed out after ${timeout}ms`,
            'TIMEOUT_ERROR',
            url
          );
        }
        
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          if (attempt < retryAttempts) {
            const delay = getBackoffDelay(attempt, EXTRACTION_CONFIG.retryDelay, EXTRACTION_CONFIG.maxRetryDelay);
            console.log(`Network error, waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw new ContentExtractionError(
            `Network error occurred while fetching content: ${error.message}`,
            'NETWORK_ERROR',
            url
          );
        }
      }
      
      // If we've exhausted retries, throw the last error
      if (attempt === retryAttempts) {
        throw new ContentExtractionError(
          `Failed to fetch content after ${retryAttempts} attempts: ${lastError?.message || 'Unknown error'}`,
          'NETWORK_ERROR',
          url
        );
      }
    }
  }
  
  throw new ContentExtractionError(
    'Unexpected error during content fetching',
    'UNKNOWN',
    url
  );
};

/**
 * Extracts article content from a website using Readability
 * @param url - Website URL
 * @param options - Extraction options
 * @returns Promise<ExtractionResult> - Extracted content and metadata
 */
export const extractArticle = async (
  url: string, 
  options: ExtractionOptions = {}
): Promise<ExtractionResult> => {
  const startTime = Date.now();
  
  try {
    console.log(`Extracting article content from: ${url}`);
    
    // Check if we're in browser and Node.js libraries aren't available
    if (isBrowser && (!Readability || !JSDOM)) {
      console.warn('Node.js libraries not available in browser, using fallback method');
      return await extractArticleFallback(url, options);
    }
    
    // Fetch HTML content with retry logic
    const html = await fetchWithRetry(url, options);
    
    // Parse HTML with JSDOM
    const dom = new JSDOM(html, { url });
    const document = dom.window.document;
    
    // Extract article content using Readability
    const reader = new Readability(document);
    const article = reader.parse();
    
    if (!article || !article.textContent) {
      throw new ContentExtractionError(
        'Failed to extract article content. The page may not contain readable content.',
        'EXTRACTION_FAILED',
        url
      );
    }
    
    // Clean and truncate content if necessary
    let content = article.textContent.trim();
    const maxLength = options.maxContentLength || EXTRACTION_CONFIG.maxContentLength;
    
    if (content.length > maxLength) {
      console.warn(`Content truncated from ${content.length} to ${maxLength} characters`);
      content = content.substring(0, maxLength) + '...';
    }
    
    const extractionTime = Date.now() - startTime;
    
    console.log(`Successfully extracted ${content.length} characters in ${extractionTime}ms`);
    
    return {
      content,
      metadata: {
        sourceType: 'website',
        url,
        extractionTime,
        contentLength: content.length,
        language: article.language || undefined
      }
    };
    
  } catch (error) {
    console.error('Article extraction failed:', error);
    
    if (error instanceof ContentExtractionError) {
      throw error;
    }
    
    throw new ContentExtractionError(
      `Failed to extract article content: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'EXTRACTION_FAILED',
      url
    );
  }
};

/**
 * Browser-compatible fallback for article extraction
 * @param url - Website URL
 * @param options - Extraction options
 * @returns Promise<ExtractionResult> - Extracted content and metadata
 */
const extractArticleFallback = async (
  url: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> => {
  const startTime = Date.now();
  
  try {
    console.log(`Using browser-compatible fallback for: ${url}`);
    
    // Fetch HTML content with retry logic
    const html = await fetchWithRetry(url, options);
    
    // Simple text extraction (basic approach)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (!textContent || textContent.length < 100) {
      throw new ContentExtractionError(
        'Failed to extract meaningful content from the webpage. The page may be empty or contain only scripts/styles.',
        'EXTRACTION_FAILED',
        url
      );
    }
    
    // Clean and truncate content if necessary
    let content = textContent;
    const maxLength = options.maxContentLength || EXTRACTION_CONFIG.maxContentLength;
    
    if (content.length > maxLength) {
      console.warn(`Content truncated from ${content.length} to ${maxLength} characters`);
      content = content.substring(0, maxLength) + '...';
    }
    
    const extractionTime = Date.now() - startTime;
    
    console.log(`Successfully extracted ${content.length} characters using fallback method in ${extractionTime}ms`);
    
    return {
      content,
      metadata: {
        sourceType: 'website',
        url,
        extractionTime,
        contentLength: content.length,
        language: 'en' // Default to English for fallback
      }
    };
    
  } catch (error) {
    console.error('Fallback article extraction failed:', error);
    
    if (error instanceof ContentExtractionError) {
      throw error;
    }
    
    throw new ContentExtractionError(
      `Failed to extract article content using fallback method: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'EXTRACTION_FAILED',
      url
    );
  }
};

/**
 * Extracts text content from a PDF file
 * @param fileOrBuffer - PDF file or buffer
 * @param fileName - Original file name
 * @param options - Extraction options
 * @returns Promise<ExtractionResult> - Extracted content and metadata
 */
export const extractPdf = async (
  fileOrBuffer: File | Buffer,
  fileName: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> => {
  const startTime = Date.now();

  try {
    console.log(`Extracting PDF content from: ${fileName}`);

    // Browser: upload to server-side API
    if (isBrowser) {
      if (!(fileOrBuffer instanceof File)) {
        throw new ContentExtractionError(
          'In the browser, extractPdf expects a File object.',
          'UNSUPPORTED_FORMAT',
          fileName
        );
      }
      const formData = new FormData();
      formData.append('file', fileOrBuffer, fileName);
      const response = await fetch('/api/extractPdf', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ContentExtractionError(
          `Server extraction failed: ${error.error || response.statusText}`,
          'EXTRACTION_FAILED',
          fileName
        );
      }
      const data = await response.json();
      let content = (data.text || '').trim();
      if (!content) {
        throw new ContentExtractionError(
          'No text content found in PDF. The file may be image-based or corrupted.',
          'EXTRACTION_FAILED',
          fileName
        );
      }
      const maxLength = options.maxContentLength || EXTRACTION_CONFIG.maxContentLength;
      if (content.length > maxLength) {
        content = content.substring(0, maxLength) + '...';
      }
      const extractionTime = Date.now() - startTime;
      return {
        content,
        metadata: {
          sourceType: 'pdf',
          fileName,
          fileSize: fileOrBuffer.size,
          extractionTime,
          contentLength: content.length,
        },
      };
    }

    // Server: use pdf-parse
    const fileBuffer = fileOrBuffer as Buffer;
    if (!pdf) {
      throw new ContentExtractionError(
        'PDF text extraction is not available. Please install pdf-parse.',
        'UNSUPPORTED_FORMAT',
        fileName
      );
    }
    const data = await pdf(fileBuffer);
    if (!data.text || data.text.trim().length === 0) {
      throw new ContentExtractionError(
        'No text content found in PDF. The file may be image-based or corrupted.',
        'EXTRACTION_FAILED',
        fileName
      );
    }
    let content = data.text.trim();
    const maxLength = options.maxContentLength || EXTRACTION_CONFIG.maxContentLength;
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + '...';
    }
    const extractionTime = Date.now() - startTime;
    return {
      content,
      metadata: {
        sourceType: 'pdf',
        fileName,
        fileSize: fileBuffer.length,
        extractionTime,
        contentLength: content.length,
        language: data.language || undefined,
      },
    };
  } catch (error) {
    console.error('PDF extraction failed:', error);
    if (error instanceof ContentExtractionError) {
      throw error;
    }
    throw new ContentExtractionError(
      `Failed to extract PDF content: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'EXTRACTION_FAILED',
      fileName
    );
  }
};

/**
 * Extracts text content from an image using OCR
 * @param imageFile - Image file
 * @param options - Extraction options
 * @returns Promise<ExtractionResult> - Extracted content and metadata
 */
export const extractImageText = async (
  imageFile: File,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> => {
  const startTime = Date.now();
  
  try {
    console.log(`Extracting text from image: ${imageFile.name}`);
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff'];
    if (!validTypes.includes(imageFile.type)) {
      throw new ContentExtractionError(
        `Unsupported image format: ${imageFile.type}. Supported formats: ${validTypes.join(', ')}`,
        'UNSUPPORTED_FORMAT',
        imageFile.name
      );
    }
    
    // Convert file to buffer
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Create Tesseract worker
    const worker = await createWorker();
    
    try {
      // Initialize worker with English language
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      
      // Set worker parameters for better accuracy
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,!?;:()[]{}"\'- ',
        tessedit_pageseg_mode: '1', // Automatic page segmentation
        tessedit_ocr_engine_mode: '3', // Default OCR engine
      });
      
      // Perform OCR
      const { data } = await worker.recognize(buffer);
      
      if (!data.text || data.text.trim().length === 0) {
        throw new ContentExtractionError(
          'No text content found in image. The image may not contain readable text.',
          'EXTRACTION_FAILED',
          imageFile.name
        );
      }
      
      // Clean and truncate content if necessary
      let content = data.text.trim();
      const maxLength = options.maxContentLength || EXTRACTION_CONFIG.maxContentLength;
      
      if (content.length > maxLength) {
        console.warn(`Content truncated from ${content.length} to ${maxLength} characters`);
        content = content.substring(0, maxLength) + '...';
      }
      
      const extractionTime = Date.now() - startTime;
      
      console.log(`Successfully extracted ${content.length} characters in ${extractionTime}ms`);
      
      return {
        content,
        metadata: {
          sourceType: 'image',
          fileName: imageFile.name,
          fileSize: imageFile.size,
          extractionTime,
          contentLength: content.length,
          language: 'en' // Tesseract was initialized with English
        }
      };
      
    } finally {
      // Always terminate the worker
      await worker.terminate();
    }
    
  } catch (error) {
    console.error('Image OCR extraction failed:', error);
    
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
 * Validates if a URL is accessible and contains extractable content
 * @param url - URL to validate
 * @returns Promise<boolean> - True if URL is valid and accessible
 */
export const validateUrl = async (url: string): Promise<boolean> => {
  try {
    // In browser, we can't do a HEAD request due to CORS, so we'll do a basic validation
    if (isBrowser) {
      const urlPattern = /^https?:\/\/.+/;
      return urlPattern.test(url);
    }
    
    // Server-side: Full validation
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const contentType = response.headers.get('content-type');
    return response.ok && contentType && contentType.includes('text/html');
  } catch {
    return false;
  }
};

/**
 * Validates if a file is a supported PDF
 * @param file - File to validate
 * @returns boolean - True if file is a valid PDF
 */
export const validatePdfFile = (file: File): boolean => {
  const isValidPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  
  if (isBrowser && isValidPdf) {
    console.warn('PDF files are supported but text extraction requires server-side processing in browser environments.');
  }
  
  return isValidPdf;
};

/**
 * Validates if a file is a supported image for OCR
 * @param file - File to validate
 * @returns boolean - True if file is a valid image
 */
export const validateImageFile = (file: File): boolean => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff'];
  return validTypes.includes(file.type);
};

/**
 * Gets a fallback message for extraction failures
 * @param sourceType - Type of content source
 * @param source - Source identifier (URL, filename, etc.)
 * @returns string - Helpful fallback message
 */
export const getExtractionFallbackMessage = (sourceType: string, source: string): string => {
  const browserNote = isBrowser ? ' (Browser limitation - consider using server-side processing)' : '';
  
  switch (sourceType) {
    case 'website':
      return `Content extraction failed for ${source}. Please copy the text manually or try a different webpage.${browserNote}`;
    case 'pdf':
      return `PDF text extraction failed for ${source}. The PDF may be image-based, password-protected, or require server-side processing. Please provide the text manually.${browserNote}`;
    case 'image':
      return `Image OCR failed for ${source}. The image may not contain readable text or the text may be too small/blurry. Please provide the text manually.`;
    default:
      return `Content extraction failed for ${source}. Please provide the content manually.${browserNote}`;
  }
}; 