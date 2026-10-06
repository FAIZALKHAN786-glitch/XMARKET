#!/usr/bin/env node
// Isolated adapter regression tests: no credentials, network or database required.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { z } from 'zod';
const require = createRequire(import.meta.url);
const env = { AI_PROVIDER: 'gemini', GEMINI_API_KEY: ' test-key ' };
let writes = 0;
let requests = [];
let response = { candidates: [{ content: { parts: [{ text: 'ok' }] } }] };
let status = 200;
class ApiError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/server/llm.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, {
  exports, process: { env }, AbortController, setTimeout, clearTimeout,
  require: (id) => id === './http' ? { ApiError } : id === './repo' ? {
    readCache: async () => undefined, writeCache: async () => { writes++; },
  } : require(id),
  fetch: async (url, init) => {
    requests.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    return new Response(JSON.stringify(response), { status });
  },
});
assert.equal(exports.config().model, 'gemini-3.5-flash-lite');
assert.equal(exports.config().apiKey, 'test-key');
env.GEMINI_MODEL = ' models/gemini-2.5-flash ';
env.GEMINI_BASE_URL = 'https://example.invalid/v1beta/';
assert.equal((await exports.health()).ok, true);
assert.equal(writes, 0, 'health must not depend on database writes');
assert.equal(requests[0].url, 'https://example.invalid/v1beta/models/gemini-2.5-flash:generateContent');
assert.equal(requests[0].body.generationConfig.thinkingConfig.thinkingBudget, 0);
assert.equal(requests[0].headers['x-goog-api-key'], 'test-key');
response = { candidates: [{ content: { parts: [{ thought: true, text: 'private thought' }, { text: 'answer' }] } }] };
assert.equal((await exports.chat([{ role: 'user', content: 'hello' }])).value, 'answer');
assert.equal(writes, 1);
response = { candidates: [{ content: { parts: [{ text: '{"answer":"yes"}' }] } }] };
const structured = await exports.chat([{ role: 'user', content: 'extract' }], { schema: z.object({ answer: z.string() }) });
assert.equal(structured.value.answer, 'yes');
assert.equal(requests.at(-1).body.generationConfig.responseMimeType, 'application/json');
for (const empty of [{}, { promptFeedback: { blockReason: 'SAFETY' } }, { candidates: [{ content: { parts: [{ thought: true, text: 'thinking only' }] } }] }]) {
  response = empty;
  assert.equal((await exports.health()).ok, false, 'empty/blocked/thought-only reply is not healthy');
}
for (const [httpStatus, code] of [[403, 'auth'], [429, 'rate_limited'], [404, 'bad_request']]) {
  status = httpStatus; response = { error: { message: 'Rejected' } };
  assert.equal((await exports.health()).code, code);
}
status = 200;
response = { candidates: [{ content: { parts: [{ text: 'ok' }] } }] };
env.GEMINI_MODEL = 'gemini-3-flash-preview';
await exports.health();
assert.equal(requests.at(-1).body.generationConfig.thinkingConfig.thinkingLevel, 'low');
// Custom IDs are preserved; a mocked response does not prove Google offers this ID.
env.GEMINI_MODEL = 'gemini-3.5-flash-lite';
assert.equal((await exports.health()).model, 'gemini-3.5-flash-lite');
assert.match(requests.at(-1).url, /gemini-3\.5-flash-lite:generateContent$/);
env.GEMINI_API_KEY = ' ';
env.GOOGLE_API_KEY = ' alias-key ';
assert.equal(exports.config().apiKey, 'alias-key');
delete env.GOOGLE_API_KEY;
assert.equal((await exports.health()).ok, false);
assert.equal(exports.config().provider, 'offline');
delete env.AI_PROVIDER;
env.OPENAI_API_KEY = 'unrelated-key';
assert.equal(exports.config().provider, 'offline', 'missing Gemini key must not select another provider');
env.GEMINI_API_KEY = 'test-key';
delete env.GEMINI_MODEL;
assert.equal(exports.config().provider, 'gemini');
assert.equal(exports.config().model, 'gemini-3.5-flash-lite');
console.log('Gemini adapter regression checks passed.');
