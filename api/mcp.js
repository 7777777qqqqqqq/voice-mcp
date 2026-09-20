// MCP Voice Service for Vercel — 让AI能说话
const MOSS_API = 'https://api.mosi.cn/v1/audio/speech';

export default async function handler(req, res) {
  // CORS头——让Operit AI能访问
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host}`);

  // GET /mcp — 健康检查
  if (req.method === 'GET') {
    return res.json({ status: 'ok', service: 'voice-mcp', version: '1.0.0' });
  }

  if (req.method !== 'POST') return res.status(405).end();

  try {
    const body = req.body || {};
    const { method, params, id = null } = body;

    // tools/list — 返回工具列表
    if (method === 'tools/list') {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: [{
            name: 'speak',
            description: '用柒柒的克隆音色说话——把文字变成语音播放出来',
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

    // tools/call — 调用语音合成
    if (method === 'tools/call') {
      const { name, arguments: args } = params || {};
      if (name !== 'speak' || !args?.text) {
        return res.json({
          jsonrpc: '2.0', id,
          error: { code: -32602, message: 'Invalid params' }
        });
      }

      console.log('[voice-mcp] Speaking:', args.text);

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

      return res.json({
        jsonrpc: '2.0', id,
        result: {
          content: [{ type: 'audio', url: ttsData.url }],
          isError: false
        }
      });
    }

    return res.json({
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
