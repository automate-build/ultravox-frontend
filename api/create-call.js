export default async function handler(req, res) {
  // CORS headers (though not needed for same-origin)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const apiKey = process.env.ULTRAVOX_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'ULTRAVOX_API_KEY not configured' })
    }

    const callConfig = {
      systemPrompt: req.body.systemPrompt || "You are a helpful AI assistant.",
      model: req.body.model || "fixie-ai/ultravox", 
      voice: req.body.voice || "Mark",
      medium: req.body.medium || { webRtc: {} },
      ...req.body
    }

    const response = await fetch('https://api.ultravox.ai/api/calls', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(callConfig)
    })

    if (!response.ok) {
      const errorText = await response.text()
      return res.status(response.status).json({ 
        error: `Ultravox API Error: ${response.status}`,
        details: errorText
      })
    }

    const data = await response.json()
    res.json(data)
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    })
  }
}
