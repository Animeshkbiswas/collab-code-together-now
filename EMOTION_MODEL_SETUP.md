# 🧠 Custom Emotion Analysis API Setup

This guide will help you configure your custom Hugging Face Space API for emotion analysis in the StudySync application.

## 📋 Prerequisites

1. **Hugging Face Account**: Create an account at [huggingface.co](https://huggingface.co)
2. **Custom Hugging Face Space**: Your emotion analysis model deployed as a Hugging Face Space
3. **API Endpoint**: Your Space's API endpoint (e.g., `https://your-space.hf.space/predict_image`)

## 🔧 Step 1: Configure Your API Endpoint

Edit the file `src/config/emotionModel.ts`:

### 1.1 Update API Endpoint

Replace the API endpoint with your custom Hugging Face Space:

```typescript
export const EMOTION_MODEL_CONFIG = {
  // Your custom Hugging Face Space API endpoint
  apiEndpoint: 'https://animeshakb-emotion.hf.space/predict_image',
  
  // Example: 'https://animeshakb-emotion.hf.space/predict_image'
  // Example: 'https://my-emotion-detector.hf.space/api/predict'
}
```

### 1.2 Configure API Settings

Adjust the API configuration based on your Space's requirements:

```typescript
apiConfig: {
  method: 'POST', // or 'GET' depending on your Space
  headers: {
    'Content-Type': 'application/json',
    // Add any additional headers your Space requires
  },
  timeout: 30000, // 30 seconds timeout
}
```

### 1.3 Update Emotion Classes

Configure the emotion classes that your model outputs. The system will look for these keywords in your model's predictions:

```typescript
emotionClasses: {
  // Engagement indicators - high scores = user is engaged
  engagement: [
    'engaged', 'focused', 'attentive', 'interested', 'concentrated',
    'alert', 'active', 'responsive', 'curious', 'involved', 'happy',
    'excited', 'enthusiastic', 'motivated', 'energetic','engagement'
    // Add your model's engagement-related class names
  ],
  
  // Confusion indicators - high scores = user is confused
  confusion: [
    'confused', 'puzzled', 'uncertain', 'unsure', 'perplexed',
    'bewildered', 'baffled', 'mystified', 'disoriented', 'lost',
    'surprised', 'shocked', 'amazed', 'astonished','confusion'
    // Add your model's confusion-related class names
  ],
  
  // Distraction indicators - high scores = user is distracted
  distraction: [
    'distracted', 'bored', 'unfocused', 'inattentive', 'disengaged',
    'uninterested', 'drowsy', 'tired', 'sleepy', 'absent-minded',
    'sad', 'depressed', 'melancholy', 'gloomy', 'disappointed'
    // Add your model's distraction-related class names
  ],
  
  // Confidence indicators - high scores = user is confident
  confidence: [
    'confident', 'sure', 'certain', 'determined', 'assured',
    'positive', 'optimistic', 'self-assured', 'bold', 'decisive',
    'proud', 'satisfied', 'content', 'fulfilled'
    // Add your model's confidence-related class names
  ]
}
```

### 1.4 Adjust Thresholds

Set confidence thresholds for each emotion type:

```typescript
thresholds: {
  engagement: 0.5,   // Minimum confidence for engagement (0.0 - 1.0)
  confusion: 0.4,    // Minimum confidence for confusion (0.0 - 1.0)
  distraction: 0.4,  // Minimum confidence for distraction (0.0 - 1.0)
  confidence: 0.5    // Minimum confidence for confidence (0.0 - 1.0)
}
```

## 🧪 Step 2: Test Your Configuration

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Open browser console** (F12) and look for these messages:
   - ✅ `Custom API configuration validated: {...}`
   - 🚀 `Sending frame to custom API: your-api-endpoint`
   - 🌐 `Custom API response: {...}`
   - 📊 `Processed emotions: {...}`

3. **Check for errors**:
   - ❌ `API endpoint not found` → Check your API URL
   - ❌ `API request timed out` → Increase timeout or check Space performance
   - ❌ `Server error` → Check your Hugging Face Space logs

## 📊 Step 3: Understand API Response Format

Your Hugging Face Space should return predictions in one of these formats:

### Format 1: Standard Gradio Response
```json
{
  "data": [
    [
      {"label": "happy", "score": 0.85},
      {"label": "focused", "score": 0.72},
      {"label": "confused", "score": 0.15}
    ]
  ]
}
```

### Format 2: Direct Array Response
```json
[
  {"label": "happy", "score": 0.85},
  {"label": "focused", "score": 0.72},
  {"label": "confused", "score": 0.15}
]
```

### Format 3: Object with Labels and Scores
```json
{
  "labels": ["happy", "focused", "confused"],
  "scores": [0.85, 0.72, 0.15]
}
```

### Format 4: Key-Value Pairs
```json
{
  "happy": 0.85,
  "focused": 0.72,
  "confused": 0.15
}
```

The system will automatically detect and parse these formats.

## 🔍 Step 4: Debugging

### Check API Response

Add this to your browser console to see detailed API responses:

```javascript
// In browser console
localStorage.setItem('debugEmotionAPI', 'true');
```

### Common Issues

1. **API endpoint not found (404)**:
   - Verify your Hugging Face Space URL
   - Check if your Space is public or you have access
   - Ensure the API endpoint path is correct

2. **CORS errors**:
   - Make sure your Hugging Face Space allows CORS
   - Check if your Space is configured for API access

3. **Wrong predictions**:
   - Update `emotionClasses` to match your model's output labels
   - Adjust thresholds based on your model's confidence scores
   - Check if your model outputs the expected format

4. **Slow performance**:
   - Reduce `analysisInterval` in config
   - Lower `maxImageSize` for faster processing
   - Check your Space's performance and upgrade if needed

## 📝 Example Configuration

Here's an example for your custom emotion detection API:

```typescript
export const EMOTION_MODEL_CONFIG = {
  apiEndpoint: 'https://animeshakb-emotion.hf.space/predict_image',
  
  apiConfig: {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  },
  
  emotionClasses: {
    engagement: ['happy', 'excited', 'focused', 'attentive', 'interested'],
    confusion: ['confused', 'surprised', 'puzzled', 'uncertain'],
    distraction: ['sad', 'bored', 'distracted', 'unfocused'],
    confidence: ['confident', 'proud', 'satisfied', 'determined']
  },
  
  thresholds: {
    engagement: 0.5,
    confusion: 0.4,
    distraction: 0.4,
    confidence: 0.5
  }
};
```

## 🚀 Advanced Configuration

### Custom Request Format

If your API expects a different request format, modify the `callCustomAPI` function in `src/hooks/useEmotionAnalysis.tsx`:

```typescript
// Example: Different request format
body: JSON.stringify({
  image: imageBase64,
  options: {
    threshold: 0.5
  }
})
```

### Custom Response Processing

If your API returns a different response format, modify the `processModelOutput` function:

```typescript
// Example: Custom response processing
const processModelOutput = useCallback((result: any): EmotionData => {
  // Your custom processing logic here
  return emotions;
}, []);
```

## 📞 Support

If you encounter issues:

1. Check the browser console for error messages
2. Test your Hugging Face Space directly to ensure it works
3. Check your Space's logs for server-side errors
4. Verify the API endpoint format and response structure

## 🎉 Success!

Once configured correctly, you should see:
- Real-time emotion analysis during video playback
- Emotion data saved to the database
- Visual indicators in the UI showing engagement, confusion, etc.
- Emotion heatmap on the video progress bar
- Console logs showing successful API calls and responses 

# Emotion Detection API Setup & Troubleshooting Guide

This guide helps you set up and troubleshoot the integration with your custom Hugging Face emotion detection API.

## 🚀 Quick Setup

### 1. Environment Variables
Create a `.env` file in your project root with:

```env
VITE_HF_TOKEN=your_hugging_face_token
VITE_YOUTUBE_API_KEY=your_youtube_api_key
```

### 2. API Configuration
Update `src/config/emotionModel.ts` with your Hugging Face Space API endpoint:

```typescript
export const EMOTION_MODEL_CONFIG = {
  apiEndpoint: "https://your-username-your-space-name.hf.space/api/predict",
  // ... other config
};
```

## 🔧 API Health Monitoring

The application now includes comprehensive API health monitoring:

### Health Status Indicators
- **🟢 Online**: API is responding correctly
- **🔴 Offline**: API is not accessible
- **🟡 Unknown**: Health check not performed yet

### Health Metrics
- **Response Time**: How long the API takes to respond
- **Error Count**: Number of failed requests
- **Last Check**: When the health check was last performed
- **Last Error**: Details of the most recent error

## 🧪 API Testing Features

### 1. Configuration Validation
Tests if your API configuration is properly set up:
- Validates endpoint URL format
- Checks required headers
- Verifies timeout settings

### 2. Endpoint Accessibility
Tests if your API endpoint is reachable:
- Sends OPTIONS request to check CORS
- Measures response time
- Validates HTTP status codes

### 3. Image Analysis Test
Tests actual emotion detection with a sample image:
- Upload any image file
- Sends to your API for analysis
- Validates response format
- Measures processing time

### 4. Response Format Validation
Ensures your API returns data in the expected format:
- Checks for required fields
- Validates data types
- Confirms emotion class mappings

## 🐛 Common Error Scenarios & Solutions

### 1. CORS Errors
**Error**: `CORS policy: No 'Access-Control-Allow-Origin' header`
**Solution**: 
- Add CORS headers to your FastAPI app:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or specify your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 2. 404 Not Found
**Error**: `API endpoint not found`
**Solution**:
- Verify your Hugging Face Space URL is correct
- Ensure the Space is public or you have access
- Check if the Space is running (not sleeping)

### 3. 500 Server Error
**Error**: `Internal server error`
**Solution**:
- Check your Hugging Face Space logs
- Verify your model files are properly uploaded
- Ensure all dependencies are installed

### 4. Timeout Errors
**Error**: `Request timed out`
**Solution**:
- Increase timeout in config (default: 30000ms)
- Check if your model is taking too long to load
- Consider using a smaller/faster model

### 5. No Faces Detected
**Error**: `No faces detected in the image`
**Solution**:
- This is expected for non-face images
- Ensure you're testing with images containing faces
- Check if your face detection model is working

### 6. Invalid Response Format
**Error**: `Invalid response format`
**Solution**:
- Ensure your API returns JSON
- Check the expected response format in the config
- Verify emotion class mappings

## 📊 Debug Information

The application provides detailed debug information:

### Debug Tabs
1. **API Response**: Raw response from your API
2. **Health Data**: Current API health status
3. **Raw Data**: Complete debug information

### Console Logging
Check browser console for detailed logs:
- `🔍 Checking API health...`
- `🚀 Sending frame to custom API...`
- `📈 API Response Status: 200`
- `🌐 Custom API response: {...}`

## 🔄 API Response Format Requirements

Your FastAPI should return one of these formats:

### Format 1: Standard Hugging Face
```json
{
  "data": [
    [
      {
        "label": "happy",
        "score": 0.85
      },
      {
        "label": "sad",
        "score": 0.15
      }
    ]
  ]
}
```

### Format 2: Direct Array
```json
[
  {
    "label": "happy",
    "score": 0.85
  },
  {
    "label": "sad",
    "score": 0.15
  }
]
```

### Format 3: Custom Format
```json
{
  "emotion": "happy",
  "confidence": 0.85
}
```

## 🎯 Emotion Class Mapping

The application maps these emotion classes:

### Engagement Classes
- `happy`, `excited`, `interested`, `engaged`, `focused`

### Confusion Classes
- `confused`, `puzzled`, `uncertain`, `unsure`, `perplexed`

### Distraction Classes
- `distracted`, `bored`, `uninterested`, `disengaged`, `tired`

### Confidence Classes
- `confident`, `sure`, `certain`, `determined`, `assured`

## 🚀 Testing Your API

### Step 1: Health Check
1. Go to the Dashboard
2. Click "Check Health" in the API Health Status card
3. Verify the API is online

### Step 2: Run Tests
1. Go to the Emotion Heatmap component
2. Upload a test image (optional)
3. Click "Run Tests"
4. Review test results

### Step 3: Real-time Testing
1. Load a YouTube video
2. Enable webcam permissions
3. Watch for emotion analysis results
4. Check console for detailed logs

## 🔧 Troubleshooting Checklist

- [ ] Environment variables set correctly
- [ ] Hugging Face Space is public and running
- [ ] API endpoint URL is correct
- [ ] CORS headers are configured
- [ ] Model files are uploaded to Space
- [ ] Dependencies are installed in Space
- [ ] Response format matches expected structure
- [ ] Emotion classes are properly mapped
- [ ] Timeout settings are appropriate
- [ ] Browser console shows no errors

## 📞 Getting Help

If you're still having issues:

1. **Check the Debug Information** in the Emotion Heatmap component
2. **Review Console Logs** for detailed error messages
3. **Run API Tests** to identify specific issues
4. **Verify Hugging Face Space Logs** for server-side errors
5. **Test API Endpoint** directly with tools like Postman

## 🔄 API Health Monitoring

The application automatically:
- Checks API health on initialization
- Monitors response times
- Tracks error counts
- Provides real-time status updates
- Falls back to mock data when API is unavailable

This ensures a smooth user experience even when the API is temporarily unavailable. 