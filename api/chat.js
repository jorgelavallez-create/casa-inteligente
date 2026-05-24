module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  
  try {
    const { prompt, imageBase64, imageMediaType } = req.body;
    
    const parts = [];
    if (imageBase64) {
      parts.push({ inlineData: { mimeType: imageMediaType, data: imageBase64 } });
    }
    parts.push({ text: prompt });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
  contents: [{ parts }],
  generationConfig: {
    maxOutputTokens: 2048
  }
})
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
