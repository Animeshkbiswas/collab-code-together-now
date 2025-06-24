from flask import Flask, request, jsonify
from flask_cors import CORS
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound, VideoUnavailable
import re
import openai
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure OpenAI client for version 0.28.1
openai.api_base = os.getenv('OPENAI_BASE_URL', 'https://api.openai.com/v1')
openai.api_key = os.getenv('OPENAI_API_KEY')

def extract_video_id(url):
    """Extract YouTube video ID from various URL formats."""
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)',
        r'youtube\.com\/watch\?.*v=([^&\n?#]+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def get_youtube_transcript(video_id):
    """Get transcript from YouTube video."""
    try:
        # Get available transcripts
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        
        # Try to get English transcript first
        try:
            transcript = transcript_list.find_transcript(['en'])
        except:
            # If no English transcript, get the first available one
            transcript = list(transcript_list)[0]
        
        # Get the transcript text
        transcript_data = transcript.fetch()
        
        # Combine all transcript parts into one text
        full_text = ' '.join([part['text'] for part in transcript_data])
        
        return full_text
    except (TranscriptsDisabled, NoTranscriptFound, VideoUnavailable) as e:
        raise Exception("No transcript available for this video.")
    except Exception as e:
        raise Exception(f"Failed to get transcript: {str(e)}")

def generate_summary_with_ai(transcript, length="medium"):
    """Generate summary using AI."""
    try:
        length_instructions = {
            "short": "in 2-3 sentences",
            "medium": "in 1-2 paragraphs", 
            "long": "in 3-4 paragraphs with detailed analysis"
        }
        
        prompt = f"""
        Summarize the following YouTube video transcript {length_instructions.get(length, 'in 1-2 paragraphs')}.
        
        Transcript:
        {transcript[:4000]}  # Limit to first 4000 characters to avoid token limits
        
        Please provide a comprehensive summary that captures the main points, key insights, and important details.
        """
        
        response = openai.ChatCompletion.create(
            model=os.getenv('OPENAI_MODEL', 'gpt-3.5-turbo'),
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500,
            temperature=0.7,
        )
        
        content = response.choices[0].message.content
        if not content:
            raise Exception("No content received from AI")
        
        return content.strip()
    except Exception as e:
        raise Exception(f"Failed to generate summary: {str(e)}")

def generate_quiz_with_ai(summary):
    """Generate quiz questions from summary."""
    try:
        prompt = f"""
        Based on the following summary, generate 5 multiple choice questions.
        
        Summary:
        {summary}
        
        Return the questions in this exact JSON format:
        {{
            "questions": [
                {{
                    "question": "Question text here?",
                    "options": ["Option A", "Option B", "Option C", "Option D"],
                    "answer": "Correct option text"
                }}
            ]
        }}
        
        Make sure the questions test understanding of key concepts from the summary.
        """
        
        response = openai.ChatCompletion.create(
            model=os.getenv('OPENAI_MODEL', 'gpt-3.5-turbo'),
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800,
            temperature=0.7,
        )
        
        # Parse the response to extract JSON
        content = response.choices[0].message.content
        if not content:
            raise Exception("No content received from AI")
        
        content = content.strip()
        
        # Try to extract JSON from the response
        import json
        try:
            # Look for JSON in the response
            start_idx = content.find('{')
            end_idx = content.rfind('}') + 1
            if start_idx != -1 and end_idx != 0:
                json_str = content[start_idx:end_idx]
                data = json.loads(json_str)
                return data.get('questions', [])
            else:
                raise Exception("No JSON found in response")
        except json.JSONDecodeError:
            # If JSON parsing fails, create a simple fallback
            return [
                {
                    "question": "What is the main topic discussed in the video?",
                    "options": ["Topic A", "Topic B", "Topic C", "Topic D"],
                    "answer": "Topic A"
                }
            ]
            
    except Exception as e:
        raise Exception(f"Failed to generate quiz: {str(e)}")

def generate_matching_pairs_with_ai(summary):
    """Generate matching pairs from summary."""
    try:
        prompt = f"""
        Based on the following summary, generate 5 term-definition pairs for a matching game.
        
        Summary:
        {summary}
        
        Return the pairs in this exact JSON format:
        {{
            "pairs": [
                {{
                    "term": "Term here",
                    "definition": "Definition here"
                }}
            ]
        }}
        
        Choose important terms and concepts from the summary that would be good for learning.
        """
        
        response = openai.ChatCompletion.create(
            model=os.getenv('OPENAI_MODEL', 'gpt-3.5-turbo'),
            messages=[{"role": "user", "content": prompt}],
            max_tokens=600,
            temperature=0.7,
        )
        
        # Parse the response to extract JSON
        content = response.choices[0].message.content
        if not content:
            raise Exception("No content received from AI")
        
        content = content.strip()
        
        # Try to extract JSON from the response
        import json
        try:
            # Look for JSON in the response
            start_idx = content.find('{')
            end_idx = content.rfind('}') + 1
            if start_idx != -1 and end_idx != 0:
                json_str = content[start_idx:end_idx]
                data = json.loads(json_str)
                return data.get('pairs', [])
            else:
                raise Exception("No JSON found in response")
        except json.JSONDecodeError:
            # If JSON parsing fails, create a simple fallback
            return [
                {
                    "term": "Key Concept",
                    "definition": "An important idea from the video"
                }
            ]
            
    except Exception as e:
        raise Exception(f"Failed to generate matching pairs: {str(e)}")

@app.route('/api/summarize', methods=['POST'])
def summarize():
    """Summarize YouTube video."""
    try:
        data = request.get_json()
        url = data.get('url')
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400
        
        # Extract video ID
        video_id = extract_video_id(url)
        if not video_id:
            return jsonify({'error': 'Invalid YouTube URL'}), 400
        
        # Get transcript
        transcript = get_youtube_transcript(video_id)
        
        # Generate summary
        summary = generate_summary_with_ai(transcript)
        
        return jsonify({
            'summary': summary,
            'transcript': transcript,
            'video_id': video_id
        })
        
    except Exception as e:
        print("Error in /api/summarize:", e, flush=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-quiz', methods=['POST'])
def generate_quiz():
    """Generate quiz from summary."""
    try:
        data = request.get_json()
        summary = data.get('summary')
        
        if not summary:
            return jsonify({'error': 'Summary is required'}), 400
        
        # Generate quiz
        questions = generate_quiz_with_ai(summary)
        
        return jsonify({
            'questions': questions
        })
        
    except Exception as e:
        print("Error in /api/generate-quiz:", e, flush=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-matching-pairs', methods=['POST'])
def generate_matching_pairs():
    """Generate matching pairs from summary."""
    try:
        data = request.get_json()
        summary = data.get('summary')
        
        if not summary:
            return jsonify({'error': 'Summary is required'}), 400
        
        # Generate matching pairs
        pairs = generate_matching_pairs_with_ai(summary)
        
        return jsonify({
            'pairs': pairs
        })
        
    except Exception as e:
        print("Error in /api/generate-matching-pairs:", e, flush=True)
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000) 