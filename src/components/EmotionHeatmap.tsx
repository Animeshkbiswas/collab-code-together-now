import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { EmotionSnapshot } from '@/types/studysync';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  TestTube,
  Upload,
  Camera,
  Info,
  Zap
} from 'lucide-react';
import { EMOTION_MODEL_CONFIG, validateModelConfig, getModelInfo } from '@/config/emotionModel';

interface EmotionHeatmapProps {
  videoId: string;
  duration: number;
}

interface APIHealthStatus {
  isHealthy: boolean;
  lastCheck: Date | null;
  errorCount: number;
  lastError: string | null;
  responseTime: number | null;
}

interface TestResult {
  testName: string;
  status: 'success' | 'error' | 'pending';
  message: string;
  details?: any;
  timestamp: Date;
}

export const EmotionHeatmap: React.FC<EmotionHeatmapProps> = ({ videoId, duration }) => {
  const { user } = useAuth();
  const [emotionData, setEmotionData] = useState<EmotionSnapshot[]>([]);
  const [apiHealth, setApiHealth] = useState<APIHealthStatus>({
    isHealthy: false,
    lastCheck: null,
    errorCount: 0,
    lastError: null,
    responseTime: null
  });
  
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testImage, setTestImage] = useState<File | null>(null);

  useEffect(() => {
    if (!user || !videoId) return;

    const fetchEmotionData = async () => {
      const { data } = await supabase
        .from('emotion_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .eq('video_id', videoId)
        .order('timestamp');

      if (data) {
        // Type cast the data to match our EmotionSnapshot interface
        const typedData: EmotionSnapshot[] = data.map(item => ({
          ...item,
          emotions: item.emotions as {
            engagement: number;
            confusion: boolean;
            distraction: boolean;
            confidence: number;
          }
        }));
        setEmotionData(typedData);
      }
    };

    fetchEmotionData();
  }, [user, videoId]);

  // Check API health
  const checkAPIHealth = async () => {
    try {
      console.log('🔍 Checking API health...');
      const startTime = Date.now();
      
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
  };

  // Convert image to base64
  const imageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Test API with image
  const testAPIWithImage = async (imageBase64: string): Promise<any> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EMOTION_MODEL_CONFIG.apiConfig.timeout);

    try {
      console.log('🚀 Testing API with image...');
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

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('🌐 API test response:', result);
      
      return { result, responseTime };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  // Run comprehensive tests
  const runTests = async () => {
    setIsRunningTests(true);
    const newTests: TestResult[] = [];

    // Test 1: Configuration validation
    try {
      const isValid = validateModelConfig();
      newTests.push({
        testName: 'Configuration Validation',
        status: isValid ? 'success' : 'error',
        message: isValid ? 'Configuration is valid' : 'Configuration has errors',
        details: getModelInfo(),
        timestamp: new Date()
      });
    } catch (error) {
      newTests.push({
        testName: 'Configuration Validation',
        status: 'error',
        message: `Configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      });
    }

    // Test 2: API endpoint accessibility
    try {
      await checkAPIHealth();
      newTests.push({
        testName: 'API Endpoint Accessibility',
        status: apiHealth.isHealthy ? 'success' : 'error',
        message: apiHealth.isHealthy ? 
          `API is accessible (${apiHealth.responseTime}ms)` : 
          `API is not accessible: ${apiHealth.lastError}`,
        details: {
          endpoint: EMOTION_MODEL_CONFIG.apiEndpoint,
          responseTime: apiHealth.responseTime,
          lastError: apiHealth.lastError
        },
        timestamp: new Date()
      });
    } catch (error) {
      newTests.push({
        testName: 'API Endpoint Accessibility',
        status: 'error',
        message: `API accessibility test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      });
    }

    // Test 3: Image analysis (if test image is provided)
    if (testImage) {
      try {
        const imageBase64 = await imageToBase64(testImage);
        const { result, responseTime } = await testAPIWithImage(imageBase64);
        
        newTests.push({
          testName: 'Image Analysis',
          status: 'success',
          message: `Image analyzed successfully (${responseTime}ms)`,
          details: {
            imageSize: `${(testImage.size / 1024).toFixed(1)}KB`,
            base64Length: imageBase64.length,
            response: result,
            responseTime
          },
          timestamp: new Date()
        });
      } catch (error) {
        newTests.push({
          testName: 'Image Analysis',
          status: 'error',
          message: `Image analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date()
        });
      }
    }

    // Test 4: Response format validation
    if (testImage) {
      try {
        const imageBase64 = await imageToBase64(testImage);
        const { result } = await testAPIWithImage(imageBase64);
        
        // Validate response structure
        const isValidFormat = result && (
          Array.isArray(result) || 
          (typeof result === 'object' && (result.emotion || result.predictions || result.labels))
        );
        
        newTests.push({
          testName: 'Response Format Validation',
          status: isValidFormat ? 'success' : 'error',
          message: isValidFormat ? 'Response format is valid' : 'Response format is invalid',
          details: {
            responseType: typeof result,
            hasEmotion: result?.emotion,
            hasPredictions: Array.isArray(result?.predictions),
            hasLabels: Array.isArray(result?.labels),
            sampleResponse: result
          },
          timestamp: new Date()
        });
      } catch (error) {
        newTests.push({
          testName: 'Response Format Validation',
          status: 'error',
          message: `Format validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date()
        });
      }
    }

    setTestResults(newTests);
    setIsRunningTests(false);
  };

  // Handle test image upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setTestImage(file);
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-yellow-600';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4" />;
      case 'error': return <XCircle className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  if (!emotionData.length || duration === 0) {
    return null;
  }

  // Create heatmap segments
  const segments = [];
  const segmentDuration = duration / 100; // 100 segments

  for (let i = 0; i < 100; i++) {
    const segmentStart = i * segmentDuration;
    const segmentEnd = (i + 1) * segmentDuration;
    
    // Find emotions in this segment
    const segmentEmotions = emotionData.filter(
      emotion => emotion.timestamp >= segmentStart && emotion.timestamp < segmentEnd
    );

    let color = 'transparent';
    if (segmentEmotions.length > 0) {
      const avgEngagement = segmentEmotions.reduce((sum, e) => sum + e.emotions.engagement, 0) / segmentEmotions.length;
      const hasConfusion = segmentEmotions.some(e => e.emotions.confusion);
      const hasDistraction = segmentEmotions.some(e => e.emotions.distraction);

      if (hasDistraction) {
        color = 'rgba(239, 68, 68, 0.7)'; // Red for distraction
      } else if (hasConfusion) {
        color = 'rgba(245, 158, 11, 0.7)'; // Yellow for confusion
      } else if (avgEngagement > 70) {
        color = 'rgba(34, 197, 94, 0.7)'; // Green for high engagement
      } else if (avgEngagement > 40) {
        color = 'rgba(59, 130, 246, 0.7)'; // Blue for medium engagement
      } else {
        color = 'rgba(156, 163, 175, 0.7)'; // Gray for low engagement
      }
    }

    segments.push(
      <div
        key={i}
        className="h-1 flex-1"
        style={{ backgroundColor: color }}
        title={`${Math.round(segmentStart)}s - Engagement: ${segmentEmotions.length > 0 ? Math.round(segmentEmotions.reduce((sum, e) => sum + e.emotions.engagement, 0) / segmentEmotions.length) : 0}%`}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* API Health Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            API Health Status
          </CardTitle>
          <CardDescription>
            Monitor the connection to your Hugging Face emotion detection API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {apiHealth.isHealthy ? 
                <CheckCircle className="h-4 w-4 text-green-600" /> : 
                <XCircle className="h-4 w-4 text-red-600" />
              }
              <span className={`font-medium ${apiHealth.isHealthy ? 'text-green-600' : 'text-red-600'}`}>
                {apiHealth.isHealthy ? 'API Healthy' : 'API Issues Detected'}
              </span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={checkAPIHealth}
              disabled={isRunningTests}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Check Health
            </Button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Last Check</p>
              <p className="font-medium">
                {apiHealth.lastCheck ? 
                  new Date(apiHealth.lastCheck).toLocaleTimeString() : 
                  'Never'
                }
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Response Time</p>
              <p className="font-medium">
                {apiHealth.responseTime ? `${apiHealth.responseTime}ms` : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Error Count</p>
              <p className="font-medium text-red-600">{apiHealth.errorCount}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <Badge variant={apiHealth.isHealthy ? 'default' : 'destructive'} className="text-xs">
                {apiHealth.isHealthy ? 'Online' : 'Offline'}
              </Badge>
            </div>
          </div>

          {apiHealth.lastError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Last Error:</strong> {apiHealth.lastError}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* API Testing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            API Testing
          </CardTitle>
          <CardDescription>
            Test your Hugging Face API with comprehensive diagnostics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Test Image (Optional)</label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {testImage && (
                  <Badge variant="secondary" className="text-xs">
                    {testImage.name}
                  </Badge>
                )}
              </div>
            </div>
            <Button 
              onClick={runTests} 
              disabled={isRunningTests}
              className="flex items-center gap-2"
            >
              {isRunningTests ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Running Tests...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Run Tests
                </>
              )}
            </Button>
          </div>

          {testResults.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Test Results</h4>
              {testResults.map((test, index) => (
                <div key={index} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(test.status)}
                      <span className="font-medium">{test.testName}</span>
                    </div>
                    <Badge variant={test.status === 'success' ? 'default' : 'destructive'} className="text-xs">
                      {test.status}
                    </Badge>
                  </div>
                  <p className={`text-sm ${getStatusColor(test.status)}`}>
                    {test.message}
                  </p>
                  {test.details && (
                    <details className="mt-2">
                      <summary className="text-xs text-muted-foreground cursor-pointer">
                        View Details
                      </summary>
                      <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-32">
                        {JSON.stringify(test.details, null, 2)}
                      </pre>
                    </details>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {test.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Configuration Information
          </CardTitle>
          <CardDescription>
            Current API configuration details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="config" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="config">Config</TabsTrigger>
              <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
              <TabsTrigger value="classes">Classes</TabsTrigger>
            </TabsList>
            
            <TabsContent value="config" className="mt-4">
              <div className="bg-muted p-4 rounded-lg">
                <pre className="text-xs overflow-auto max-h-40">
                  {JSON.stringify(EMOTION_MODEL_CONFIG, null, 2)}
                </pre>
              </div>
            </TabsContent>
            
            <TabsContent value="endpoints" className="mt-4">
              <div className="space-y-2">
                <div>
                  <strong>API Endpoint:</strong> {EMOTION_MODEL_CONFIG.apiEndpoint}
                </div>
                <div>
                  <strong>Method:</strong> {EMOTION_MODEL_CONFIG.apiConfig.method}
                </div>
                <div>
                  <strong>Timeout:</strong> {EMOTION_MODEL_CONFIG.apiConfig.timeout}ms
                </div>
                <div>
                  <strong>Headers:</strong>
                  <pre className="text-xs bg-muted p-2 rounded mt-1">
                    {JSON.stringify(EMOTION_MODEL_CONFIG.apiConfig.headers, null, 2)}
                  </pre>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="classes" className="mt-4">
              <div className="space-y-2">
                <div>
                  <strong>Engagement Classes:</strong> {EMOTION_MODEL_CONFIG.emotionClasses.engagement.join(', ')}
                </div>
                <div>
                  <strong>Confusion Classes:</strong> {EMOTION_MODEL_CONFIG.emotionClasses.confusion.join(', ')}
                </div>
                <div>
                  <strong>Distraction Classes:</strong> {EMOTION_MODEL_CONFIG.emotionClasses.distraction.join(', ')}
                </div>
                <div>
                  <strong>Confidence Classes:</strong> {EMOTION_MODEL_CONFIG.emotionClasses.confidence.join(', ')}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="absolute inset-0 flex rounded overflow-hidden pointer-events-none">
        {segments}
      </div>
    </div>
  );
};
