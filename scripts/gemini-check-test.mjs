// Exercise the diagnostic against a local fake Google API, never real credentials.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
const key = 'local-test-secret';
let mode = 'success';
let generations = 0;
const server = createServer(async (req, res) => {
  assert.equal(req.headers['x-goog-api-key'], key);
  res.setHeader('content-type', 'application/json');
  if (req.method === 'GET') {
    if (req.url.includes('pageToken=second')) {
      res.end(JSON.stringify({ models: [{ name: 'models/test-flash-lite', supportedGenerationMethods: ['generateContent'] }] }));
    } else res.end(JSON.stringify({ models: [], nextPageToken: 'second' }));
    return;
  }
  generations++;
  if (mode === 'quota') { res.statusCode = 429; res.end(JSON.stringify({ error: { message: key } })); return; }
  if (mode === 'empty') { res.end('{}'); return; }
  let body = ''; for await (const chunk of req) body += chunk;
  const json = JSON.parse(body);
  res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: json.generationConfig.responseMimeType === 'application/json' ? '{"ok":true}' : 'ok' }] } }] }));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
async function run(args) {
  const child = spawn(process.execPath, ['scripts/gemini-check.mjs', ...args], {
    env: { ...process.env, GEMINI_API_KEY: key, GEMINI_MODEL: 'test-flash-lite', GEMINI_BASE_URL: `http://127.0.0.1:${server.address().port}/v1beta` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', b => { output += b; });
  child.stderr.on('data', b => { output += b; });
  const code = await new Promise(resolve => child.on('close', resolve));
  assert.ok(!output.includes(key), 'diagnostic must not leak credentials');
  return { code, output };
}
try {
  let result = await run(['--list-models']);
  assert.equal(result.code, 0); assert.match(result.output, /test-flash-lite/); assert.equal(generations, 0);
  result = await run([]);
  assert.equal(result.code, 0); assert.equal(generations, 2); assert.match(result.output, /structured JSON/);
  result = await run(['--model=unknown']);
  assert.equal(result.code, 1); assert.equal(generations, 2); assert.match(result.output, /No replacement/);
  mode = 'quota'; result = await run([]);
  assert.equal(result.code, 1); assert.match(result.output, /429/);
  mode = 'empty'; result = await run([]);
  assert.equal(result.code, 1); assert.match(result.output, /no answer/);
  console.log('Gemini diagnostic regression checks passed.');
} finally { server.close(); }
