#!/usr/bin/env node
/** Diagnose Gemini directly without a running app, login, seed data or database.
 * Secrets are read only from server environment / .env.local, never CLI args.
 * --list-models lists models without generating content.
 * --model=<exact-id> tests an override without altering configuration.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), true);

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: npm run gemini:check -- [--list-models] [--model=exact-model-id]\nReads GEMINI_API_KEY (or GOOGLE_API_KEY) from the server environment / .env.local.\nNo credentials are printed or saved. A normal check makes two small generation requests.');
  process.exit(0);
}
if (args.some(arg => arg !== '--list-models' && !arg.startsWith('--model='))) {
  console.error('Unknown option. Use --help. Do not pass API keys on the command line.');
  process.exit(1);
}
const key = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
const base = (process.env.GEMINI_BASE_URL?.trim() || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
const model = (args.find(arg => arg.startsWith('--model='))?.slice(8) || process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite').replace(/^models\//, '');

async function request(endpoint, body) {
  const response = await fetch(`${base}/${endpoint}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30_000),
  });
  // Never print an upstream response; it may echo credentials or headers.
  if (!response.ok) {
    const reasons = {
      400: 'Request/key rejected. Check the key type, API restrictions and model configuration.',
      401: 'Credentials rejected. Check the server-side Gemini API key.',
      403: 'Access denied. Check API enablement, project permissions and key restrictions.',
      404: 'Model/endpoint not found or unavailable to this project. Use --list-models.',
      429: 'Quota or rate limit reached. Check Google AI Studio usage/billing before retrying.',
    };
    throw new Error(`HTTP ${response.status}: ${reasons[response.status] || 'Google is unavailable. Retry later.'}`);
  }
  return response.json();
}

async function main() {
  if (!key) throw new Error('No GEMINI_API_KEY configured. Set it privately in .env.local or your hosting secrets, then rerun. Do not paste it into chat.');
  if (new URL(base).protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(new URL(base).hostname)) {
    throw new Error('GEMINI_BASE_URL must use HTTPS outside local development.');
  }
  const models = [];
  let token;
  do {
    const page = await request(`models?pageSize=100${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`);
    models.push(...(page.models ?? []).filter(m => m.supportedGenerationMethods?.includes('generateContent')));
    token = page.nextPageToken;
  } while (token);
  if (args.includes('--list-models')) {
    console.log('Models returned by Google that support generateContent:');
    for (const entry of models) console.log(`  ${entry.name.replace(/^models\//, '')} — ${entry.displayName || ''}`);
    if (!models.length) throw new Error('No text generation models were returned for this project.');
    return;
  }
  const selected = models.find(m => m.name === `models/${model}`);
  if (!selected) throw new Error(`Configured model "${model}" was not returned by Google. Run npm run gemini:check -- --list-models and choose the exact ID. No replacement was selected automatically.`);
  console.log(`Testing ${model}; credentials are configured (not yet verified for generation).`);
  const thinkingConfig = /^gemini-2\.5-flash(?:-|$)/i.test(model)
    ? { thinkingBudget: 0 }
    : /^gemini-3/i.test(model)
      ? { thinkingLevel: ['low', 'medium', 'high'].includes(process.env.GEMINI_THINKING_LEVEL?.toLowerCase()) ? process.env.GEMINI_THINKING_LEVEL.toLowerCase() : 'low' }
      : undefined;
  for (const structured of [false, true]) {
    const result = await request(`models/${encodeURIComponent(model)}:generateContent`, {
      contents: [{ role: 'user', parts: [{ text: structured ? 'Reply with exactly this JSON object: {"ok":true}' : 'Reply with the single word: ok' }] }],
      generationConfig: {
        temperature: 0, maxOutputTokens: 2048,
        responseMimeType: structured ? 'application/json' : 'text/plain',
        ...(thinkingConfig ? { thinkingConfig } : {}),
      },
    });
    const text = (result.candidates?.[0]?.content?.parts ?? []).filter(p => !p.thought).map(p => p.text || '').join('').trim();
    if (!text) throw new Error('Google returned no answer. The response may be blocked or its output budget exhausted.');
    if (structured && JSON.parse(text).ok !== true) throw new Error('Structured JSON response did not validate.');
    console.log(`PASS: ${structured ? 'structured JSON (AI tools)' : 'text response (assistant)'}`);
  }
  console.log(`Gemini answered both tests. Set GEMINI_MODEL=${model} in your server configuration and restart BOTH services (or redeploy).\nThen open System status → Test the key to verify the app's actual serving backend.`);
}
main().catch(error => {
  // Report only controlled diagnostic messages, not raw fetch errors/URLs.
  console.error(error.name === 'TimeoutError' ? 'Gemini timed out after 30 seconds.' : error instanceof SyntaxError ? 'Google returned an invalid JSON response.' : error.message.replaceAll(key || '\0', '[redacted]'));
  process.exitCode = 1;
});
