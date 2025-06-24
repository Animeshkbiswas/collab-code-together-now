const formidable = require('formidable');
const fs = require('fs');
const { createWorker } = require('tesseract.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('[extractImage] Formidable error:', err);
      res.status(500).json({ error: 'Failed to parse form data.' });
      return;
    }
    try {
      const file = files.file;
      if (!file || !file.path) {
        res.status(400).json({ error: 'No file uploaded.' });
        return;
      }
      const imageBuffer = fs.readFileSync(file.path);
      const worker = await createWorker();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      const { data: { text } } = await worker.recognize(imageBuffer);
      await worker.terminate();
      res.status(200).json({ text });
    } catch (e) {
      console.error('[extractImage] OCR error:', e);
      res.status(500).json({ error: 'Failed to extract image text.' });
    }
  });
}; 