// Configuration for your custom Hugging Face emotion analysis model
export const EMOTION_MODEL_CONFIG = {
  // ========================================
  // CUSTOM HUGGING FACE SPACE API
  // ========================================
  
  // Your custom Hugging Face Space API endpoint
  apiEndpoint: 'https://animeshakb-emotion.hf.space/predict_image',
  
  // API configuration
  apiConfig: {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 30000, // 30 seconds timeout
  },
  
  // ========================================
  // EMOTION CLASS MAPPING
  // ========================================
  // Update these based on your model's output classes
  // The system will look for these keywords in your model's predictions
  
  emotionClasses: {
    // Engagement indicators - high scores indicate the user is engaged
    engagement: [
      'engaged', 'focused', 'attentive', 'interested', 'concentrated',
      'alert', 'active', 'responsive', 'curious', 'involved', 'happy',
      'excited', 'enthusiastic', 'motivated', 'energetic'
    ],
    
    // Confusion indicators - high scores indicate the user is confused
    confusion: [
      'confused', 'puzzled', 'uncertain', 'unsure', 'perplexed',
      'bewildered', 'baffled', 'mystified', 'disoriented', 'lost',
      'surprised', 'shocked', 'amazed', 'astonished'
    ],
    
    // Distraction indicators - high scores indicate the user is distracted
    distraction: [
      'distracted', 'bored', 'unfocused', 'inattentive', 'disengaged',
      'uninterested', 'drowsy', 'tired', 'sleepy', 'absent-minded',
      'sad', 'depressed', 'melancholy', 'gloomy', 'disappointed'
    ],
    
    // Confidence indicators - high scores indicate the user is confident
    confidence: [
      'confident', 'sure', 'certain', 'determined', 'assured',
      'positive', 'optimistic', 'self-assured', 'bold', 'decisive',
      'proud', 'satisfied', 'content', 'fulfilled'
    ]
  },
  
  // ========================================
  // THRESHOLD SETTINGS
  // ========================================
  // Adjust these thresholds based on your model's confidence scores
  
  thresholds: {
    engagement: 0.5,   // Minimum confidence for engagement (0.0 - 1.0)
    confusion: 0.4,    // Minimum confidence for confusion (0.0 - 1.0)
    distraction: 0.4,  // Minimum confidence for distraction (0.0 - 1.0)
    confidence: 0.5    // Minimum confidence for confidence (0.0 - 1.0)
  },
  
  // ========================================
  // ANALYSIS SETTINGS
  // ========================================
  
  // How often to analyze frames (in milliseconds)
  analysisInterval: 10000, // 10 seconds
  
  // Image quality for analysis (0.1 - 1.0)
  imageQuality: 0.8,
  
  // Maximum image size for analysis (pixels)
  maxImageSize: {
    width: 640,
    height: 480
  }
};

// Helper function to validate model configuration
export const validateModelConfig = () => {
  const config = EMOTION_MODEL_CONFIG;
  
  if (!config.apiEndpoint) {
    console.error('❌ API endpoint not configured!');
    return false;
  }
  
  if (!config.apiEndpoint.includes('hf.space')) {
    console.warn('⚠️  Using custom API endpoint:', config.apiEndpoint);
  }
  
  return true;
};

// Helper function to get model info for debugging
export const getModelInfo = () => {
  return {
    apiEndpoint: EMOTION_MODEL_CONFIG.apiEndpoint,
    emotionClasses: Object.keys(EMOTION_MODEL_CONFIG.emotionClasses),
    thresholds: EMOTION_MODEL_CONFIG.thresholds
  };
}; 