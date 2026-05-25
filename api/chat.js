module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  
  try {
    const { prompt, imageBase64, imageMediaType } = req.body;
    
    const content = [];
    if (imageBase64) {
      content.push({ type: "image", source: { type: "base64", media_type: imageMediaType, data: imageBase64 } });
    }
    content.push({ type: "text", text: prompt });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 2048,
        messages: [{ role: "user", content }]
      })
    });
    const data = await response.json();
    const text = data.content?.map(c => c.text || "").join("") || "";
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
