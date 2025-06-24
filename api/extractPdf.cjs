const formidable = require('formidable');
const fs = require('fs');
const pdf = require('pdf-parse');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('[extractPdf] Formidable error:', err);
      res.status(500).json({ error: 'Failed to parse form data.' });
      return;
    }
    try {
      const file = files.file;
      if (!file || !file.path) {
        res.status(400).json({ error: 'No file uploaded.' });
        return;
      }
      const dataBuffer = fs.readFileSync(file.path);
      const data = await pdf(dataBuffer);
      res.status(200).json({ text: data.text });
    } catch (e) {
      console.error('[extractPdf] PDF parse error:', e);
      res.status(500).json({ error: 'Failed to extract PDF text.' });
    }
  });
}; 