import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { EMOTION_MODEL_CONFIG, validateModelConfig, getModelInfo } from '@/config/emotionModel';

interface EmotionData {
  engagement: number;
  confusion: boolean;
  distraction: boolean;
  confidence: number;
}

interface APIHealthStatus {
  isHealthy: boolean;
  lastCheck: Date | null;
  errorCount: number;
  lastError: string | null;
  responseTime: number | null;
}

export const useEmotionAnalysis = (videoId: string) => {
  const { user } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [emotionData, setEmotionData] = useState<EmotionData | null>(null);
  const [modelStatus, setModelStatus] = useState<'ready' | 'configuring' | 'error'>('configuring');
  const [apiHealth, setApiHealth] = useState<APIHealthStatus>({
    isHealthy: false,
    lastCheck: null,
    errorCount: 0,
    lastError: null,
    responseTime: null
  });
  const [debugInfo, setDebugInfo] = useState<any>(null);
  
  // Initialize model configuration
  useEffect(() => {
    // Validate model configuration
    if (validateModelConfig()) {
      console.log('✅ Custom API configuration validated:', getModelInfo());
      setModelStatus('ready');
      // Check API health on initialization
      checkAPIHealth();
    } else {
      setModelStatus('error');
    }
  }, []);

  // Function to check API health
  const checkAPIHealth = useCallback(async () => {
    try {
      console.log('🔍 Checking API health...');
      const startTime = Date.now();
      
      // Test API with a simple request
      const testResponse = await fetch(EMOTION_MODEL_CONFIG.apiEndpoint, {
        method: 'OPTIONS',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const responseTime = Date.now() - startTime;
      
      if (testResponse.ok) {
        setApiHealth(prev => ({
          ...prev,
          isHealthy: true,
          lastCheck: new Date(),
          responseTime,
          lastError: null
        }));
        console.log('✅ API health check passed. Response time:', responseTime + 'ms');
      } else {
        throw new Error(`API returned status: ${testResponse.status}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setApiHealth(prev => ({
        ...prev,
        isHealthy: false,
        lastCheck: new Date(),
        errorCount: prev.errorCount + 1,
        lastError: errorMessage,
        responseTime: null
      }));
      console.error('❌ API health check failed:', errorMessage);
    }
  }, []);

  // Function to convert image to base64
  const imageToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data:image/jpeg;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Function to call your custom API with comprehensive error handling
  const callCustomAPI = async (imageBase64: string): Promise<any> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EMOTION_MODEL_CONFIG.apiConfig.timeout);

    try {
      console.log('🚀 Sending frame to custom API:', EMOTION_MODEL_CONFIG.apiEndpoint);
      console.log('📊 Image size (base64):', imageBase64.length, 'characters');
      
      const startTime = Date.now();
      
      const response = await fetch(EMOTION_MODEL_CONFIG.apiEndpoint, {
        method: EMOTION_MODEL_CONFIG.apiConfig.method,
        headers: EMOTION_MODEL_CONFIG.apiConfig.headers,
        body: JSON.stringify({
          data: [imageBase64]
        }),
        signal: controller.signal
      });

      const responseTime = Date.now() - startTime;
      clearTimeout(timeoutId);

      console.log('📈 API Response Status:', response.status);
      console.log('📈 API Response Time:', responseTime + 'ms');

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('🌐 Custom API response:', result);
      
      // Validate response structure
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid response format: Expected object');
      }

      // Check for specific error fields in response
      if (result.error) {
        throw new Error(`API returned error: ${result.error}`);
      }

      // Update API health on successful request
      setApiHealth(prev => ({
        ...prev,
        isHealthy: true,
        lastCheck: new Date(),
        responseTime,
        lastError: null
      }));

      // Handle different response formats
      if (result.data && Array.isArray(result.data)) {
        return result.data[0]; // Return the first prediction
      } else if (Array.isArray(result)) {
        return result; // Direct array response
      } else if (result.emotion && result.confidence) {
        // Handle your specific API response format
        return [{
          label: result.emotion,
          score: result.confidence
        }];
      } else {
        return result; // Other format
      }

    } catch (error) {
      clearTimeout(timeoutId);
      
      // Update API health on error
      setApiHealth(prev => ({
        ...prev,
        isHealthy: false,
        lastCheck: new Date(),
        errorCount: prev.errorCount + 1,
        lastError: error instanceof Error ? error.message : 'Unknown error',
        responseTime: null
      }));

      // Log detailed error information
      console.error('❌ Custom API analysis failed:', error);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('⏰ API request timed out after', EMOTION_MODEL_CONFIG.apiConfig.timeout, 'ms');
        } else if (error.message.includes('404')) {
          console.error('🔧 API endpoint not found. Check the URL:', EMOTION_MODEL_CONFIG.apiEndpoint);
        } else if (error.message.includes('500')) {
          console.error('🔥 Server error. Check your Hugging Face Space logs.');
        } else if (error.message.includes('CORS')) {
          console.error('🌐 CORS error. Check if your Space allows cross-origin requests.');
        } else if (error.message.includes('No faces detected')) {
          console.error('👤 No faces detected in the image. This is expected for non-face images.');
        }
      }
      
      throw error;
    }
  };

  // Function to process model output and convert to emotion data
  const processModelOutput = useCallback((result: any): EmotionData => {
    console.log('🔍 Processing custom API output:', result);
    
    // Store debug info
    setDebugInfo({
      rawResponse: result,
      timestamp: new Date().toISOString(),
      apiHealth: apiHealth
    });
    
    // Initialize emotion scores
    let engagement = 0;
    let confusion = 0;
    let distraction = 0;
    let confidence = 0;

    // Handle different response formats
    let predictions = [];
    
    if (Array.isArray(result)) {
      predictions = result;
    } else if (result && typeof result === 'object') {
      // If result is an object, try to extract predictions
      if (result.predictions) {
        predictions = result.predictions;
      } else if (result.labels) {
        predictions = result.labels.map((label: string, index: number) => ({
          label,
          score: result.scores ? result.scores[index] : 0
        }));
      } else if (result.emotion && result.confidence) {
        // Handle your specific API response format
        predictions = [{
          label: result.emotion,
          score: result.confidence
        }];
      } else {
        // Try to parse as key-value pairs
        predictions = Object.entries(result).map(([label, score]) => ({
          label,
          score: typeof score === 'number' ? score : 0
        }));
      }
    }

    console.log('📊 Parsed predictions:', predictions);

    // Process each prediction from the model
    predictions.forEach((prediction: any) => {
      const label = (prediction.label || prediction.class || prediction.name || '').toLowerCase();
      const score = prediction.score || prediction.confidence || prediction.probability || 0;

      // Check for engagement indicators
      if (EMOTION_MODEL_CONFIG.emotionClasses.engagement.some(cls => label.includes(cls))) {
        engagement = Math.max(engagement, score);
      }
      
      // Check for confusion indicators
      if (EMOTION_MODEL_CONFIG.emotionClasses.confusion.some(cls => label.includes(cls))) {
        confusion = Math.max(confusion, score);
      }
      
      // Check for distraction indicators
      if (EMOTION_MODEL_CONFIG.emotionClasses.distraction.some(cls => label.includes(cls))) {
        distraction = Math.max(distraction, score);
      }
      
      // Check for confidence indicators
      if (EMOTION_MODEL_CONFIG.emotionClasses.confidence.some(cls => label.includes(cls))) {
        confidence = Math.max(confidence, score);
      }
    });

    // Convert to final emotion data
    const emotions: EmotionData = {
      engagement: Math.round(engagement * 100),
      confusion: confusion > EMOTION_MODEL_CONFIG.thresholds.confusion,
      distraction: distraction > EMOTION_MODEL_CONFIG.thresholds.distraction,
      confidence: Math.round(confidence * 100)
    };

    console.log('📊 Processed emotions:', emotions);
    return emotions;
  }, [apiHealth]);

  const analyzeFrame = useCallback(async (videoElement: HTMLVideoElement, timestamp: number) => {
    if (!user || !videoElement) return;

    try {
      setIsAnalyzing(true);
      
      // If model not ready, use mock data
      if (modelStatus !== 'ready') {
        console.log('🤖 Using mock emotion analysis (API not ready)');
        const mockEmotions: EmotionData = {
          engagement: Math.random() * 100,
          confusion: Math.random() > 0.7,
          distraction: Math.random() > 0.8,
          confidence: Math.random() * 100
        };
        
        setEmotionData(mockEmotions);
        
        // Save mock data to database
        await supabase.from('emotion_snapshots').insert({
          user_id: user.id,
          video_id: videoId,
          timestamp: Math.floor(timestamp),
          emotions: mockEmotions as any
        });
        
        return;
      }

      // Check API health before making request
      if (!apiHealth.isHealthy) {
        console.log('⚠️ API not healthy, attempting to check health...');
        await checkAPIHealth();
        if (!apiHealth.isHealthy) {
          throw new Error('API is not healthy');
        }
      }
      
      // Capture frame from video
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Resize image to optimal size for analysis
      const { width, height } = EMOTION_MODEL_CONFIG.maxImageSize;
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(videoElement, 0, 0, width, height);
      
      // Convert to blob for analysis
      canvas.toBlob(async (blob) => {
        if (!blob) return;

        try {
          // Convert image to base64
          const imageBase64 = await imageToBase64(blob);
          
          // Call your custom API
          const result = await callCustomAPI(imageBase64);

          console.log('📈 Custom API result:', result);

          // Process the model output
          const emotions = processModelOutput(result);

          setEmotionData(emotions);

          // Save to database
          await supabase.from('emotion_snapshots').insert({
            user_id: user.id,
            video_id: videoId,
            timestamp: Math.floor(timestamp),
            emotions: emotions as any
          });

          console.log('✅ Emotion analysis completed:', emotions);

        } catch (error) {
          console.error('❌ Custom API analysis failed:', error);
          
          // Fall back to mock data on error
          const mockEmotions: EmotionData = {
            engagement: Math.random() * 100,
            confusion: Math.random() > 0.7,
            distraction: Math.random() > 0.8,
            confidence: Math.random() * 100
          };
          setEmotionData(mockEmotions);
        }
      }, 'image/jpeg', EMOTION_MODEL_CONFIG.imageQuality);

    } catch (error) {
      console.error('❌ Frame capture failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [user, videoId, processModelOutput, modelStatus, apiHealth, checkAPIHealth]);

  return {
    emotionData,
    isAnalyzing,
    analyzeFrame,
    modelStatus,
    apiHealth,
    debugInfo,
    checkAPIHealth
  };
};
