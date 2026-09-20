// redeploy test
// MCP Voice Service for Vercel — 让AI能说话
const MOSS_API = 'https://api.mosi.cn/v1/audio/speech';

// 解析 JSON body（带超时兜底，防止卡死）
async function parseBody(req) {
  try {
    const text = await new Promise((resolve) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => resolve(body));
      // 3 秒超时兜底——如果 body 一直读不完，就给空值
      setTimeout(() => resolve('{}'), 3000);
    });
    return JSON.parse(text || '{}');
  } catch (e) {
    return {};
  }
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  try {
    // === GET: 健康检查 ===
    if (req.method === 'GET') {
      return res.status(200).json({
        status: 'ok',
        message: 'MCP Voice Service is running on Vercel',
        endpoint: '/mcp',
        method: 'POST'
      });
    }

    // === POST: 语音生成 ===
    if (req.method === 'POST') {
      const body = await parseBody(req);
      const params = body.params || {};
      const inputText = params?.arguments?.text || params?.text || '';

      if (!inputText) {
        return res.status(400).json({
          jsonrpc: '2.0',
          id: body.id || null,
          error: { code: -32602, message: 'Missing text parameter' }
        });
      }

      const apiKey = process.env.MOSS_API_KEY;
      const voiceId = process.env.MOSS_VOICE_ID || '0376f20a';

      if (!apiKey) {
        return res.status(500).json({
          jsonrpc: '2.0',
          id: body.id || null,
          error: { code: -32000, message: 'MOSS_API_KEY not configured' }
        });
      }

      const mossResponse = await fetch(MOSS_API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'moss-speech-tts',
          input: inputText,
          voice: { id: voiceId }
        })
      });

      if (!mossResponse.ok) {
        return res.status(502).json({
          jsonrpc: '2.0',
          id: body.id || null,
          error: { code: -32001, message: `MOSS API error: ${mossResponse.status}` }
        });
      }

      const audioBuffer = await mossResponse.arrayBuffer();
      const base64Audio = Buffer.from(audioBuffer).toString('base64');

      return res.status(200).json({
        jsonrpc: '2.0',
        id: body.id || null,
        result: {
          content: [
            { type: 'audio', data: base64Audio, mimeType: 'audio/mpeg' }
          ]
        }
      });
    }

    // === 其他方法：405 ===
    return res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Method not allowed' }
    });

  } catch (err) {
    return res.status(500).json({
      jsonrpc: '2.0',
      error: { code: -32603, message: err.message }
    });
  }
}
