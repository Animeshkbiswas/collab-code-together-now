const { getTranscript } = require('youtube-transcript-api');

function extractVideoId(url) {
  // Handles various YouTube URL formats
  const regex = /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{11})/;
  const match = url.match(regex);
  if (match && match[1]) return match[1];
  // Fallback: try to get v= param
  const vParam = url.split('v=')[1];
  if (vParam) return vParam.split('&')[0];
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const { youtubeUrl } = JSON.parse(body);
      if (!youtubeUrl) {
        res.status(400).json({ error: 'Missing YouTube URL' });
        return;
      }
      const videoId = extractVideoId(youtubeUrl);
      if (!videoId) {
        res.status(400).json({ error: 'Invalid YouTube URL' });
        return;
      }
      const transcript = await getTranscript(videoId);
      const text = transcript.map(segment => segment.text).join(' ');
      res.status(200).json({ transcript: text, segments: transcript, videoId });
    } catch (e) {
      res.status(500).json({ error: 'Failed to extract transcript', details: e.message });
    }
  });
}; 