import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile = file => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const core = {};
vm.runInNewContext(compile('../lib/api-core.ts'), { exports: core });
let response;
const client = {};
vm.runInNewContext(compile('../lib/fastapi-client.ts'), {
  exports: client, require: () => core, URLSearchParams,
  fetch: async url => url.includes('/oauth2/') ? new Response('{}') : response,
});
// Provider failures must surface as API errors, NOT duplicate paid calls via fallback.
for (const [status, code] of [[502, 'auth'], [503, 'ai_unavailable'], [429, 'rate_limited'], [401, 'unauthorized']]) {
  response = new Response(JSON.stringify({ ok: false, error: { code, message: 'original diagnosis' } }), { status });
  await assert.rejects(client.fastapiRequest('/v1/ai/copilot'), error => error instanceof core.ApiClientError && error.code === code);
}
response = new Response('Bad Gateway', { status: 502 });
await assert.rejects(client.fastapiRequest('/v1/ai/copilot'), client.FastapiUnreachableError);
response = new Response(JSON.stringify({ ok: true, data: { reply: 'hello' } }));
assert.equal((await client.fastapiRequest('/v1/ai/copilot')).reply, 'hello');
console.log('AI transport regression checks passed.');
