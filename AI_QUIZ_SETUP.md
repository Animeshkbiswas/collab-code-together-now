# AI Quiz Setup Guide

This guide explains how to set up and use the AI-powered quiz generation feature in your educational app.

## Overview

The AI quiz feature generates personalized quizzes based on YouTube video content using the Nebius AI API. It can create multiple-choice questions, analyze video transcripts, and provide explanations for answers.

## Prerequisites

1. **Nebius AI Account**: You need a Nebius AI account to get an API key
2. **YouTube Video**: The feature works best with educational YouTube videos
3. **Modern Browser**: Supports webcam access for emotion detection

## Setup Instructions

### 1. Get Your Nebius API Key

1. Visit [Nebius AI](https://nebius.ai)
2. Sign up for an account
3. Navigate to your API settings
4. Generate a new API key
5. Copy the API key (it will look like: `neb-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

### 2. Configure the API Key

You have two options for storing your API key:

#### Option A: Environment Variable (Recommended for Development)
Create a `.env` file in your project root:
```env
VITE_NEBIUS_API_KEY=your_nebius_api_key_here
```

#### Option B: In-App Storage (User-Friendly)
1. Open the app and go to the Games section
2. Click on "AI Quiz Generator"
3. Enter your Nebius API key in the provided field
4. The key will be stored securely in your browser's localStorage

### 3. Using the AI Quiz Feature

#### Basic Usage
1. Navigate to the Games section
2. Click on "AI Quiz Generator"
3. Enter a YouTube video URL or paste video content
4. Select difficulty level (Easy, Medium, Hard)
5. Choose number of questions (3-10)
6. Click "Generate Quiz"

#### Advanced Features
- **Video Integration**: Paste YouTube URLs to generate context-aware quizzes
- **Difficulty Levels**: Choose from Easy, Medium, or Hard questions
- **Question Types**: Multiple choice questions with explanations
- **Export Options**: Download quizzes as JSON for offline use

## API Configuration

The app uses the following Nebius AI configuration:
- **Base URL**: `https://api.nebius.ai`
- **Model**: `gpt-3.5-turbo` (configurable)
- **Max Tokens**: 1000
- **Temperature**: 0.7

## Security Considerations

- API keys are stored locally in your browser
- Keys are never sent to our servers
- Direct communication with Nebius AI API
- Keys can be cleared at any time

## Troubleshooting

### Common Issues

1. **"API key is required" error**
   - Make sure you've entered your Nebius API key
   - Check that the key is valid and active

2. **"Failed to generate quiz" error**
   - Verify your internet connection
   - Check if your Nebius API key has sufficient credits
   - Try with a different video or content

3. **"Invalid response format" error**
   - This usually indicates an API issue
   - The app will fall back to template questions
   - Check Nebius AI service status

### Fallback System

If AI generation fails, the app automatically falls back to:
- Pre-built question templates
- Content-based question generation
- Topic-specific question banks

## Customization

### Adding New Question Templates

You can extend the quiz templates by modifying the `QUIZ_TEMPLATES` object in `src/services/aiQuizService.ts`:

```typescript
const QUIZ_TEMPLATES = {
  your_topic: [
    {
      question: "Your question here?",
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctAnswer: 0,
      explanation: "Explanation of the correct answer"
    }
  ]
};
```

### Modifying AI Prompts

To customize the AI generation prompts, edit the `context` variable in the `generateNebiusQuiz` function.

## Integration with YouTube

The quiz generator can extract context from YouTube videos:
- Video titles and descriptions
- Transcript analysis (when available)
- Content categorization
- Topic-specific question generation

## Performance Tips

1. **Content Length**: Provide sufficient content for better quiz generation
2. **Video Quality**: Use educational videos with clear audio for better transcript analysis
3. **Question Count**: Start with 5 questions and adjust based on content length
4. **Difficulty**: Match difficulty to your audience's knowledge level

## Support

For technical support:
1. Check the browser console for error messages
2. Verify your Nebius API key is valid
3. Ensure you have sufficient API credits
4. Try with different content or videos

## Future Enhancements

Planned features:
- Support for multiple AI providers
- Advanced question types (fill-in-the-blank, matching)
- Quiz analytics and progress tracking
- Integration with learning management systems
- Custom quiz templates and themes 