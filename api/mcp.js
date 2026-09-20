// redeploy test
// MCP Voice Service for Vercel — 让AI能说话
const MOSS_API = 'https://api.mosi.cn/v1/audio/speech';

// 手动解析 JSON body（Vercel 有时不自解析）
async function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

export default async function handler(req, res) {
  // CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET /mcp — 健康检查
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', service: 'voice-mcp', version: '1.0.0' });
  }

  if (req.method !== 'POST') return res.status(405).end();

  try {
    const body = await parseBody(req);
    const { method, params, id = null } = body;

    // tools/list
    if (method === 'tools/list') {
      return res.status(200).json({
        jsonrpc: '2.0', id,
        result: {
          tools: [{
            name: 'speak',
            description: '用柒柒的克隆音色说话',
            inputSchema: {
              type: 'object',
              properties: {
                text: { type: 'string', description: '要说的文字内容' }
              },
              required: ['text']
            }
          }]
        }
      });
    }

    // tools/call
    if (method === 'tools/call') {
      const { name, arguments: args } = params || {};
      if (name !== 'speak' || !args?.text) {
        return res.status(200).json({
          jsonrpc: '2.0', id,
          error: { code: -32602, message: 'Invalid params' }
        });
      }

      const ttsRes = await fetch(MOSS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.MOSS_API_KEY}`
        },
        body: JSON.stringify({
          model: 'moss-tts',
          voice_id: process.env.MOSS_VOICE_ID || '0376f20a',
          input: args.text,
          response_format: 'mp3',
          delivery_method: 'url'
        })
      });

      if (!ttsRes.ok) {
        const errText = await ttsRes.text();
        throw new Error(`TTS API Error ${ttsRes.status}: ${errText}`);
      }

      const ttsData = await ttsRes.json();

      return res.status(200).json({
        jsonrpc: '2.0', id,
        result: {
          content: [{ type: 'audio', url: ttsData.url }],
          isError: false
        }
      });
    }

    return res.status(200).json({
      jsonrpc: '2.0', id,
      error: { code: -32601, message: `Method not found: ${method}` }
    });

  } catch (err) {
    console.error('[voice-mcp] Error:', err);
    return res.status(500).json({
      jsonrpc: '2.0', id: null,
      error: { code: -32603, message: err.message }
    });
  }
}
