const formidable = require('formidable');
const fs = require('fs');
const pdfParse = require('pdf-parse');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) {
      res.status(400).json({ error: 'Failed to parse form data' });
      return;
    }
    const file = files.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    try {
      const data = fs.readFileSync(file.filepath);
      const pdfData = await pdfParse(data);
      res.status(200).json({ text: pdfData.text });
    } catch (e) {
      res.status(500).json({ error: 'Failed to extract PDF text', details: e.message });
    }
  });
}; 