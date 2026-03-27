import http from 'node:http';

const port = Number.parseInt(process.env.MOCK_COPILOT_PORT ?? '3031', 10);
const host = process.env.MOCK_COPILOT_HOST ?? '127.0.0.1';

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');

    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('Request body too large'));
      }
    });

    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON request body'));
      }
    });

    req.on('error', reject);
  });
}

function createCompletion(payload) {
  const language = payload?.language || 'code';
  const fieldId = payload?.fieldId || 'Content';
  const prefix = typeof payload?.prefix === 'string' ? payload.prefix : '';
  const suffix = typeof payload?.suffix === 'string' ? payload.suffix : '';
  const promptLine = prefix.split('\n').pop()?.trim() || 'start typing here';

  return [
    `// Mock Copilot suggestion for ${language} (${fieldId})`,
    `// Context tail: ${promptLine.slice(0, 80)}`,
    suffix.length > 0 ? `// Suffix length: ${suffix.length}` : '// No suffix context',
    '',
  ].join('\n');
}

const server = http.createServer(async (req, res) => {
  const method = req.method || 'GET';
  const url = req.url || '/';

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (method === 'GET' && url === '/api/copilot/status') {
    sendJson(res, 200, {
      enabled: true,
      configured: true,
      endpointConfigured: true,
      model: 'gpt-4o-mini',
    });
    return;
  }

  if (method === 'POST' && url === '/api/copilot/complete') {
    try {
      const payload = await readRequestBody(req);
      const completion = createCompletion(payload);
      sendJson(res, 200, {
        completion,
        completions: [completion],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bad request';
      sendJson(res, 400, { error: message });
    }
    return;
  }

  sendJson(res, 404, {
    error: 'Not found',
    availableEndpoints: ['/api/copilot/status', '/api/copilot/complete'],
  });
});

server.listen(port, host, () => {
  console.log(`Mock Copilot server listening at http://${host}:${port}`);
  console.log('Completion endpoint: /api/copilot/complete');
  console.log('Status endpoint: /api/copilot/status');
});

server.on('error', (error) => {
  console.error('Failed to start mock server:', error);
  process.exit(1);
});
