import { fetchTranscript } from 'youtube-transcript-api';

async function testTranscriptAPI() {
  try {
    console.log('Testing YouTube transcript API...');
    
    // Test with a known video that has captions
    const videoId = 'dQw4w9WgXcQ'; // Rick Astley - Never Gonna Give You Up
    console.log(`Fetching transcript for video: ${videoId}`);
    
    const segments = await fetchTranscript(videoId);
    
    if (segments && segments.length > 0) {
      const text = segments.map(s => s.text.trim()).join(' ');
      console.log('✅ Success! Transcript extracted:');
      console.log(`Length: ${text.length} characters`);
      console.log(`Segments: ${segments.length}`);
      console.log(`Preview: ${text.substring(0, 200)}...`);
    } else {
      console.log('❌ No transcript segments found');
    }
    
  } catch (error) {
    console.error('❌ Error testing transcript API:', error.message);
  }
}

testTranscriptAPI(); 