const { getTranscript, fetchTranscript } = require('youtube-transcript-api');
const { google } = require('googleapis');

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

/**
 * Fetches the full transcript for a YouTube video.
 * @param {string} videoId
 * @returns {Promise<string>}
 */
async function getFullTranscript(videoId) {
  try {
    const segments = await fetchTranscript(videoId);
    return segments.map(s => s.text.trim()).join(' ');
  } catch (err) {
    // Fallback to YouTube Data API v3
    try {
      const youtube = google.youtube({ version: 'v3', auth: process.env.YOUTUBE_API_KEY });
      const captionsList = await youtube.captions.list({ part: 'snippet', videoId });
      const caption = captionsList.data.items && captionsList.data.items[0];
      if (!caption) throw new Error('No captions found');
      const captionId = caption.id;
      const res = await youtube.captions.download({ id: captionId, tfmt: 'srt' }, { responseType: 'stream' });
      let srt = '';
      for await (const chunk of res.data) srt += chunk;
      // Parse SRT to plain text
      return srt.replace(/\d+\n\d{2}:\d{2}:\d{2},\d{3} --> .*\n/g, '').replace(/\n+/g, ' ').trim();
    } catch (apiErr) {
      console.error('[getTranscript] Error:', apiErr);
      throw new Error('Failed to fetch transcript. Please try manual input.');
    }
  }
}

module.exports = async (req, res) => {
  const { videoId } = req.query;
  if (!videoId) {
    res.status(400).json({ error: 'Missing videoId' });
    return;
  }
  try {
    const transcript = await getFullTranscript(videoId);
    res.status(200).json({ transcript });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Transcript extraction failed.' });
  }
}; 