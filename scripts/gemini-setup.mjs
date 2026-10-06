#!/usr/bin/env node
/** Temporary, explicit local-development credential setup. NOT an app route.
 * Binds a separate preview port, requires a random capability code, expires in
 * 30 minutes, and accepts only one successful save. Never logs/returns keys.
 */
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, rename, chmod } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

if (process.env.NODE_ENV === 'production') throw new Error('Setup is for local development only. Configure deployment secrets instead.');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const code = randomBytes(16).toString('hex');
const port = Number(process.env.GEMINI_SETUP_PORT || 3001);
const expires = Date.now() + 30 * 60_000;
let saved = false;
let busy = false;
let attempts = 0;
const nonce = randomBytes(18).toString('base64');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect Gemini · XMARKET</title>
<style nonce="${nonce}">*{box-sizing:border-box}body{margin:0;background:#0c0e12;color:#f3f4f6;font:16px system-ui,sans-serif;display:grid;min-height:100vh;place-items:center;padding:24px}main{width:100%;max-width:560px;background:#15181f;border:1px solid #313640;border-radius:20px;padding:32px}small{color:#9cafff;letter-spacing:2px}h1{font-size:30px;margin:14px 0}p{color:#afb7c6;line-height:1.6}label{display:block;margin-top:22px;font-size:14px}input,select,button{width:100%;padding:13px;border-radius:9px;font:inherit;margin-top:8px}input,select{background:#0c0e12;border:1px solid #424957;color:white}button{border:0;background:#c7d2fe;color:#111827;cursor:pointer;font-weight:650;margin-top:22px}button:disabled{opacity:.45;cursor:not-allowed}#status{white-space:pre-wrap;padding:12px;border-radius:8px;background:#0c0e12;font-size:14px}footer{color:#8b95a7;font-size:12px;line-height:1.6;margin-top:24px}</style>
<main><small>XMARKET / PRIVATE SETUP</small><h1>Connect your Gemini</h1><p>Enter your key here—not in chat. We’ll ask Google which models you can use, then test and save your selection.</p>
<form id="setup" autocomplete="off"><label for="code">One-time setup code</label><input id="code" type="password" autocomplete="off" spellcheck="false" required placeholder="Copy the setup code from the assistant">
<label for="key">Gemini API key</label><input id="key" type="password" autocomplete="off" spellcheck="false" required placeholder="Paste your Google AI Studio key">
<button type="button" id="discover">Find my available models</button>
<label for="model">Model returned by Google</label><select id="model" disabled><option>Find models first</option></select>
<button id="save" type="submit" disabled>Test connection & save</button></form>
<p id="status" role="status" aria-live="polite">Waiting for your setup code and key.</p><footer>The key is sent only to this workspace server and Google’s Gemini API. It is saved in the Git-ignored .env.local with restricted permissions. Nothing is stored in browser storage. Saving makes one small, potentially billable model request. This screen expires after 30 minutes and locks after saving.</footer></main>
<script nonce="${nonce}">
const el=id=>document.getElementById(id);let pending=false;
function status(text){el('status').textContent=text;}
function reset(){el('model').replaceChildren(new Option('Find models first',''));el('model').disabled=true;el('save').disabled=true;}
for(const id of ['key','code'])el(id).addEventListener('input',reset);
async function call(route){
 const response=await fetch(route,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+el('code').value.trim()},body:JSON.stringify({key:el('key').value.trim(),model:el('model').value})});
 const data=await response.json();if(!response.ok)throw new Error(data.message||'Setup failed');return data;
}
el('discover').onclick=async()=>{if(pending)return;pending=true;el('discover').disabled=true;reset();status('Checking available models with Google…');try{const data=await call('/models');el('model').replaceChildren(...data.models.map(m=>new Option(m.label,m.id)));el('model').disabled=false;el('save').disabled=false;status('Choose your model, then test and save. No model has been selected on the server yet.');}catch(e){status(e.message);}finally{pending=false;el('discover').disabled=false;}};
el('setup').onsubmit=async event=>{event.preventDefault();if(pending)return;pending=true;el('save').disabled=true;el('discover').disabled=true;status('Testing your selected model with Google…');try{const result=await call('/save');el('key').value='';el('code').value='';el('setup').hidden=true;status(result.message);}catch(e){status(e.message);el('save').disabled=false;el('discover').disabled=false;}finally{pending=false;}};
</script></html>`;

function reply(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' });
  res.end(JSON.stringify(data));
}
async function google(key, endpoint, body) {
  let response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${endpoint}`, {
      method: body ? 'POST' : 'GET', headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30_000),
    });
  } catch { throw new Error('Google could not be reached within 30 seconds. Try again.'); }
  if (!response.ok) {
    const reason = {400:'Google rejected the key or model settings.',401:'Google rejected the API key.',403:'Google denied access. Check project permissions and key restrictions.',404:'This model is unavailable. Refresh the model list.',429:'Google quota/rate limit reached. Check AI Studio usage and billing.'}[response.status];
    throw new Error(reason || 'Google is temporarily unavailable. Try again later.');
  }
  try { return await response.json(); } catch { throw new Error('Google returned an unreadable response.'); }
}
async function models(key) {
  const result = [];let token;
  do {
    const page = await google(key, `models?pageSize=100${token ? '&pageToken='+encodeURIComponent(token) : ''}`);
    for (const model of page.models || []) if (model.supportedGenerationMethods?.includes('generateContent')) result.push({id:model.name.replace(/^models\//,''),label:model.name.replace(/^models\//,'')+' — '+(model.displayName || '')});
    token = page.nextPageToken;
  } while (token);
  return result;
}
async function saveEnv(key, model) {
  const file = path.join(root, '.env.local');
  let text;
  try { text = await readFile(file, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; text = ''; }
  for (const [name, value] of Object.entries({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: key, GEMINI_MODEL: model })) {
    text = text.split(/\r?\n/).filter(line => !new RegExp('^\\s*(?:export\\s+)?'+name+'\\s*=').test(line)).join('\n').replace(/\n*$/, '\n');
    text += name+'='+value+'\n';
  }
  // The temporary name also matches the repository's .env*.local ignore rule.
  const temp = path.join(root, '.env.gemini-setup.local');
  await writeFile(temp, text, { mode: 0o600 });
  await chmod(temp, 0o600);
  await rename(temp, file);
}
const server = createServer(async (req,res) => {
  if (Date.now() > expires || saved) return reply(res, 410, {message:'Setup is closed. Ask the assistant to reopen it if needed.'});
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, {'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','content-security-policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'none'`});
    return res.end(html);
  }
  if (req.method !== 'POST' || !['/models','/save'].includes(req.url)) return reply(res,404,{message:'Not found'});
  // No CORS support; bearer capability is mandatory and never embedded in HTML.
  if (req.headers['sec-fetch-site'] === 'cross-site') return reply(res,403,{message:'Open this form in the setup preview.'});
  const provided = Buffer.from((req.headers.authorization || '').replace(/^Bearer /,''));
  if (provided.length !== code.length || !timingSafeEqual(provided,Buffer.from(code))) return reply(res,403,{message:'Invalid setup code. Copy the code from the assistant.'});
  if (busy) return reply(res,409,{message:'A setup request is already running.'});
  if (++attempts > 40) return reply(res,429,{message:'Setup attempt limit reached. Ask the assistant to reopen setup.'});
  busy = true;
  try {
    let raw='';
    for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw)>8192) { reply(res,413,{message:'Request too large.'});return; } }
    let data;
    try { data=JSON.parse(raw); } catch { return reply(res,400,{message:'Invalid request.'}); }
    if (!data || typeof data.key !== 'string' || !/^[A-Za-z0-9_-]{16,512}$/.test(data.key)) return reply(res,400,{message:'Paste the complete API key without spaces or comments.'});
    const available = await models(data.key);
    if (!available.length) return reply(res,400,{message:'Google returned no generation models for this key.'});
    if (req.url === '/models') return reply(res,200,{models:available});
    if (!available.some(m=>m.id===data.model)) return reply(res,400,{message:'Choose an exact model from the list returned by Google.'});
    const thinkingConfig = /^gemini-2\.5-flash(?:-|$)/i.test(data.model) ? {thinkingBudget:0} : /^gemini-3/i.test(data.model) ? {thinkingLevel:'low'} : undefined;
    const result = await google(data.key,`models/${encodeURIComponent(data.model)}:generateContent`,{
      contents:[{role:'user',parts:[{text:'Reply with the single word: ok'}]}],
      generationConfig:{temperature:0,maxOutputTokens:2048,...(thinkingConfig?{thinkingConfig}:{})},
    });
    const text=(result.candidates?.[0]?.content?.parts || []).filter(p=>!p.thought).map(p=>p.text||'').join('').trim();
    if (!text) return reply(res,400,{message:'Google returned no answer. Try a different available model.'});
    try { await saveEnv(data.key,data.model); } catch { return reply(res,500,{message:'The key passed the test, but the workspace could not save .env.local. Ask the assistant for help.'}); }
    saved=true;
    reply(res,200,{message:'Google responded and your configuration was saved privately. Return to chat and say “saved” so the assistant can restart both services and verify the app. This setup screen is now locked.'});
    console.log('Gemini connection verified; private configuration saved. Restart both app services. Setup locked.');
  } catch (e) {
    // Only controlled Google diagnostic messages; never echo request/upstream data.
    const safe = e instanceof Error && /^(Google|This model)/.test(e.message) ? e.message : 'Setup failed. Retry or ask the assistant for help.';
    reply(res,400,{message:safe});
  } finally { busy=false; }
});
server.requestTimeout=35_000;
server.headersTimeout=10_000;
server.listen(port,'0.0.0.0',()=>console.log(`Gemini setup is listening on port ${port}.\nOne-time setup code: ${code}\nExpires in 30 minutes. Never paste the Gemini API key into chat.`));
setTimeout(()=>server.close(()=>process.exit(0)),30*60_000).unref();
