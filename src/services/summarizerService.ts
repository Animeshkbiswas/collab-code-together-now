// AI Summarizer Service
// This service handles content summarization using Nebius AI API

export interface SummaryRequest {
  type: 'text' | 'url' | 'youtube' | 'image' | 'file';
  content?: string;
  url?: string;
  youtubeUrl?: string;
  file?: File;
  imageFile?: File;
  length: 'short' | 'medium' | 'long';
  style: 'bullet' | 'paragraph' | 'detailed';
}

export interface SummaryResponse {
  summary: string;
  originalLength?: number;
  summaryLength?: number;
  compressionRatio?: number;
  topics?: string[];
  keywords?: string[];
  source?: {
    type: string;
    url?: string;
    title?: string;
    fileSize?: number;
  };
}

// Configuration for Nebius API
const NEBIUS_API_CONFIG = {
  baseUrl: 'https://api.studio.nebius.com/v1/chat/completions',
  apiKey: import.meta.env.VITE_NEBIUS_API_KEY,
  model: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
};

// Debug logging for API configuration
console.log('Nebius API Config:', {
  baseUrl: NEBIUS_API_CONFIG.baseUrl,
  model: NEBIUS_API_CONFIG.model,
  hasApiKey: !!NEBIUS_API_CONFIG.apiKey,
  apiKeyLength: NEBIUS_API_CONFIG.apiKey?.length || 0
});

async function fetchNebiusChatCompletion(messages: any[], options = {}) {
  if (!NEBIUS_API_CONFIG.apiKey) {
    throw new Error('Nebius API key is not configured. Please check your environment variables.');
  }

  try {
    const requestBody = {
      model: NEBIUS_API_CONFIG.model,
      messages,
      max_tokens: 512,
      temperature: 0.6,
      top_p: 0.9,
      top_k: 50,
      ...options,
    };

    console.log('Nebius API Request:', {
      url: NEBIUS_API_CONFIG.baseUrl,
      model: NEBIUS_API_CONFIG.model,
      messageCount: messages.length,
      hasApiKey: !!NEBIUS_API_CONFIG.apiKey
    });

    const res = await fetch(NEBIUS_API_CONFIG.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Api-Key ${NEBIUS_API_CONFIG.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Nebius API Error Response:', {
        status: res.status,
        statusText: res.statusText,
        body: errorText
      });
      
      let errorMessage = `Nebius API error: ${res.status} ${res.statusText}`;
      
      // Try to parse error details
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.message) {
          errorMessage = `Nebius API error: ${errorData.error.message}`;
        }
      } catch (e) {
        // If we can't parse the error, use the raw text
        if (errorText) {
          errorMessage = `Nebius API error: ${errorText}`;
        }
      }
      
      throw new Error(errorMessage);
    }

    const responseData = await res.json();
    console.log('Nebius API Response:', {
      hasChoices: !!responseData.choices,
      choiceCount: responseData.choices?.length,
      hasContent: !!responseData.choices?.[0]?.message?.content
    });

    return responseData;
  } catch (error) {
    console.error('Nebius API request failed:', error);
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(`Nebius API request failed: ${error}`);
    }
  }
}

// Extract text from file (basic implementation)
const extractTextFromFile = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        resolve(content);
      } catch (error) {
        reject(new Error('Failed to read file content'));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    
    if (file.type === 'text/plain' || file.type === 'text/markdown') {
      reader.readAsText(file);
    } else {
      // For other file types, we'll need more sophisticated parsing
      // This is a simplified version - in production you'd want proper PDF/DOC parsing
      reject(new Error('File type not supported yet. Please use text files.'));
    }
  });
};

// Extract text from image using OCR (placeholder)
const extractTextFromImage = async (file: File): Promise<string> => {
  // This is a placeholder. In a real implementation, you would:
  // 1. Use a proper OCR service (like Tesseract.js, Google Vision API, etc.)
  // 2. Convert image to text
  // 3. Return the extracted text
  
  // For now, we'll return a placeholder message
  return `[Image content: ${file.name}] - OCR processing not implemented yet. Please use text input for now.`;
};

// Extract content from URL
const extractContentFromUrl = async (url: string): Promise<string> => {
  try {
    // This is a simplified version. In production, you'd want to:
    // 1. Use a proper web scraping service
    // 2. Handle CORS issues
    // 3. Extract main content (not just HTML)
    
    const response = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
    if (response.ok) {
      const data = await response.json();
      return data.content || `[Website content from: ${url}]`;
    }
    
    // Fallback: return URL as placeholder
    return `[Website content from: ${url}] - Web scraping not implemented yet. Please use text input for now.`;
  } catch (error) {
    return `[Website content from: ${url}] - Failed to extract content. Please use text input for now.`;
  }
};

// Extract transcript from YouTube URL
const extractYouTubeTranscript = async (url: string): Promise<string> => {
  try {
    // Extract video ID from URL
    const videoId = extractVideoId(url);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }
    
    // This is a placeholder. In production, you'd want to:
    // 1. Use YouTube Data API or a transcript service
    // 2. Extract actual video transcript
    // 3. Handle different languages
    
    return `[YouTube video transcript: ${videoId}] - Transcript extraction not implemented yet. Please use text input for now.`;
  } catch (error) {
    return `[YouTube video: ${url}] - Failed to extract transcript. Please use text input for now.`;
  }
};

// Extract video ID from YouTube URL
const extractVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
};

// Generate summary using Nebius API
const generateNebiusSummary = async (content: string, options: {
  length: string;
  style: string;
  sourceType: string;
}): Promise<string> => {
  if (!NEBIUS_API_CONFIG.apiKey) {
    throw new Error('Nebius API key is not set in the environment variables');
  }
  const { length, style, sourceType } = options;
  const lengthGuidance = {
    short: '2-3 sentences',
    medium: '4-6 sentences',
    long: '8-10 sentences'
  };
  const styleGuidance = {
    bullet: 'as bullet points',
    paragraph: 'as a paragraph',
    detailed: 'in detail with explanations'
  };
  
  try {
    const prompt = `
      Summarize the following ${sourceType} content in ${lengthGuidance[length as keyof typeof lengthGuidance]} ${styleGuidance[style as keyof typeof styleGuidance]}.
      
      Content: ${content}
      
      Return ONLY the summary text. Do not include any additional formatting, labels, or explanations.
    `;
    
    const response = await fetchNebiusChatCompletion([{ role: 'user', content: prompt }]);
    const aiResponse = response.choices?.[0]?.message?.content;
    
    if (!aiResponse) {
      console.error('No response from Nebius API', response);
      throw new Error('No response from Nebius API');
    }
    
    // Clean up the response - remove any markdown formatting or extra text
    let summary = aiResponse.trim();
    
    // Remove markdown formatting if present
    summary = summary.replace(/^#+\s*/gm, ''); // Remove headers
    summary = summary.replace(/\*\*(.*?)\*\*/g, '$1'); // Remove bold
    summary = summary.replace(/\*(.*?)\*/g, '$1'); // Remove italic
    summary = summary.replace(/`(.*?)`/g, '$1'); // Remove code blocks
    
    // Remove any prefix like "Summary:" or "Here's the summary:"
    summary = summary.replace(/^(summary|here's the summary|here is the summary):\s*/i, '');
    
    if (!summary || summary.length < 10) {
      throw new Error('Generated summary is too short or empty');
    }
    
    return summary;
    
  } catch (error) {
    console.error('Nebius AI summary generation failed:', error);
    throw error;
  }
};

// Main summarization function
export const generateSummary = async (request: SummaryRequest): Promise<SummaryResponse> => {
  try {
    let content = '';
    let sourceType = 'text';

    // Extract content based on request type
    switch (request.type) {
      case 'text':
        content = request.content || '';
        sourceType = 'text';
        break;
      case 'url':
        content = await extractContentFromUrl(request.url || '');
        sourceType = 'website';
        break;
      case 'youtube':
        content = await extractYouTubeTranscript(request.youtubeUrl || '');
        sourceType = 'YouTube video';
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
      default:
        throw new Error('Invalid request type');
    }

    if (!content.trim()) {
      throw new Error('No content to summarize');
    }

    // Validate options
    if (!request.length || !request.style) {
      throw new Error('Missing required options: length and style');
    }

    // Generate summary using Nebius API
    const summary = await generateNebiusSummary(content, {
      length: request.length,
      style: request.style,
      sourceType: sourceType
    });

    // Create response object
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
  } catch (error) {
    console.error('Summary generation failed:', error);
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