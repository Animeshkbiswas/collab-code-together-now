from youtube_transcript_api import YouTubeTranscriptApi
import google.generativeai as genai
import json
import re

genai.configure(api_key="AIzaSyCt07QcDpiIcmMafQ8EzC1U0fhF2apfZ8o")
model = genai.GenerativeModel("models/gemini-1.5-flash")

class give_summary():
    def __init__(self,link):
        self.link=link
        neg='https://www.youtube.com/watch?v='
        if link.startswith(neg):
            self.pos=link[len(neg):]
        else:
            return 'not a valid yt link'
        print(f"Video ID: {self.pos}")
    
    def summarize(self,time_stamp=0):
        self.real_trasn=''
        video_id=self.pos
        video_id=video_id.split('=')[0]
        try:
            transcript = YouTubeTranscriptApi.get_transcript(video_id)
        except Exception as e:
            print(f'Transcript Exception: {e}')
        if time_stamp==0:
            self.real_trasn=" ".join([t['text'] for t in transcript])
        else:
            self.real_trasn=" ".join([t['text'] for t in transcript if t['start']<=time_stamp])

        prompt_s = f"Summarize this transcript briefly:\n\n{self.real_trasn}"
        try:
            response = model.generate_content(prompt_s)
        except Exception as e:
            print(f"Error generating summary:")
    
        prompt_q = f"""
        Generate 3 multiple choice questions from the following transcript:
        - Each question should have 4 options
        - Return the result in JSON with format:
        [{{"question": "...", "options": ["A", "B", "C", "D"], "answer": "B"}}, ...]

        Transcript:
        {self.real_trasn}
        """
        try:
            quiz_output = model.generate_content(prompt_q) 
        except Exception as e:
            print(f"Error generating quiz:")
        try:
            match = re.search(r"\[.*\]", quiz_output.text, re.DOTALL)
            quiz= json.loads(match.group(0))
        except json.JSONDecodeError:
            print('error') 
        return response.text,quiz


