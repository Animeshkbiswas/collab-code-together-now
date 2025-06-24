const { fetchTranscript } = require('youtube-transcript-api');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { videoId } = req.query;

  if (!videoId) {
    return res.status(400).json({
      error: 'Missing videoId parameter',
      message: 'Please provide a valid YouTube video ID'
    });
  }

  try {
    const segments = await fetchTranscript(videoId);
    if (!segments || segments.length === 0) {
      return res.status(404).json({
        error: 'No transcript available',
        message: 'This video does not have available captions/transcripts'
      });
    }
    const text = segments.map(segment => segment.text.trim()).join(' ');
    return res.status(200).json({
      transcript: text,
      segments: segments,
      videoId: videoId,
      wordCount: text.split(' ').length
    });
  } catch (err) {
    return res.status(500).json({
      error: 'ServerError',
      message: 'Failed to extract transcript: ' + err.message
    });
  }
}; 