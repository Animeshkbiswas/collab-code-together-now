# Flask Backend for YouTube AI Summarizer

This Flask backend provides APIs for YouTube video summarization, quiz generation, and matching pairs generation.

## Features

- **YouTube Transcript Extraction**: Automatically extracts transcripts from YouTube videos
- **AI Summarization**: Generates summaries using OpenAI/Nebius API
- **Quiz Generation**: Creates multiple choice questions from summaries
- **Matching Pairs**: Generates term-definition pairs for learning games

## Setup

1. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure environment variables**:
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` and add your API keys:
   ```env
   OPENAI_BASE_URL=https://api.openai.com/v1  # or https://api.studio.nebius.com/v1
   OPENAI_API_KEY=your_api_key_here
   OPENAI_MODEL=gpt-3.5-turbo  # or meta-llama/Meta-Llama-3.1-70B-Instruct
   ```

3. **Run the server**:
   ```bash
   python app.py
   ```

The server will start on `http://localhost:5000`

## API Endpoints

### 1. Summarize YouTube Video
**POST** `/api/summarize`

**Request Body**:
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

**Response**:
```json
{
  "summary": "Generated summary text...",
  "transcript": "Full transcript text...",
  "video_id": "VIDEO_ID"
}
```

### 2. Generate Quiz
**POST** `/api/generate-quiz`

**Request Body**:
```json
{
  "summary": "Summary text to generate quiz from"
}
```

**Response**:
```json
{
  "questions": [
    {
      "question": "What is the main topic?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "Option A"
    }
  ]
}
```

### 3. Generate Matching Pairs
**POST** `/api/generate-matching-pairs`

**Request Body**:
```json
{
  "summary": "Summary text to generate pairs from"
}
```

**Response**:
```json
{
  "pairs": [
    {
      "term": "Key Concept",
      "definition": "Definition of the key concept"
    }
  ]
}
```

### 4. Health Check
**GET** `/health`

**Response**:
```json
{
  "status": "healthy"
}
```

## Usage with Frontend

The frontend React application is configured to call these endpoints. Make sure:

1. The Flask backend is running on `http://localhost:5000`
2. CORS is enabled (already configured in the app)
3. Your API keys are properly set in the `.env` file

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200`: Success
- `400`: Bad request (missing parameters)
- `500`: Server error (API issues, transcript extraction failures)

Error responses include a descriptive message:
```json
{
  "error": "Error description"
}
```

## Notes

- The backend uses `youtube-transcript-api` to extract transcripts
- Transcripts are limited to the first 4000 characters for AI processing
- The system tries to find English transcripts first, falls back to other languages
- JSON parsing includes fallback responses if AI doesn't return valid JSON 