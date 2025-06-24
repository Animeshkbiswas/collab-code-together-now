# Vercel Deployment Guide for YouTube Transcript API

This guide walks you through setting up and deploying the YouTube transcript extraction API on Vercel.

## Prerequisites

- Node.js 18+ installed
- Vercel CLI installed (`npm install -g vercel`)
- A Vercel account (free tier available)

## Setup Steps

### 1. Install Dependencies

```bash
npm install youtube-transcript-api
```

### 2. Login to Vercel

```bash
vercel login
```

Follow the prompts to authenticate with your Vercel account.

### 3. Initialize Vercel Project

```bash
vercel init
```

Select "Other" for framework type since this is a custom setup.

### 4. Deploy to Vercel

```bash
vercel --prod
```

This will deploy your API and return a production URL.

## API Endpoint

Once deployed, your API will be available at:
```
https://your-project-name.vercel.app/api/getTranscript?videoId=VIDEO_ID
```

### Example Usage

```javascript
// Test the API endpoint
const response = await fetch('https://your-project-name.vercel.app/api/getTranscript?videoId=dQw4w9WgXcQ');
const data = await response.json();
console.log(data.transcript);
```

## Environment Variables

In your Vercel dashboard, you can set environment variables:

1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add any required variables (e.g., `YOUTUBE_API_KEY` if needed)

## Local Development

To test the API locally:

```bash
npm run dev:api
```

This starts the Vercel development server on `http://localhost:3000`.

## Frontend Integration

The frontend has been updated to use the Vercel API as a fallback. The `transcriptService.ts` now includes:

- `fetchTranscriptViaAPI()` - Uses the Vercel API endpoint
- `fetchTranscriptWithFallback()` - Tries direct extraction first, then falls back to API

### Usage in Components

```typescript
import { getFullTranscript } from '../services/transcriptService';

// This will automatically use the API fallback if direct extraction fails
const transcript = await getFullTranscript(videoId);
```

## Error Handling

The API includes comprehensive error handling:

- **400**: Missing videoId parameter
- **404**: No transcript available or video not found
- **500**: Server error during extraction

## Rate Limiting

The API includes built-in retry logic with exponential backoff for rate limiting.

## CORS Configuration

The API is configured to allow cross-origin requests from any domain. For production, you may want to restrict this to your specific domain.

## Monitoring

Check your Vercel dashboard for:
- Function execution logs
- Performance metrics
- Error rates

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure the API is properly deployed and accessible
2. **Rate Limiting**: The API includes retry logic, but you may need to implement additional caching
3. **Missing Transcripts**: Some videos don't have captions available

### Debug Steps

1. Check Vercel function logs in the dashboard
2. Test the API endpoint directly in a browser
3. Verify the video ID is correct
4. Ensure the video has captions enabled

## Production Considerations

1. **Caching**: Consider implementing Redis or similar for transcript caching
2. **Rate Limiting**: Monitor usage and implement additional rate limiting if needed
3. **Error Monitoring**: Set up error tracking (e.g., Sentry)
4. **Performance**: Monitor function execution times and optimize if needed

## Security

- The API is public by default
- Consider adding authentication if needed
- Monitor for abuse and implement rate limiting
- Validate video IDs to prevent injection attacks 