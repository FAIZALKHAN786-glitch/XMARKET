# Gemini integration

## Configure privately

Add these server-side variables to `.env.local` (git-ignored), or to your deployment's secrets:

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=your-complete-key
GEMINI_MODEL=gemini-3.5-flash-lite
```

Do not put the API key in `NEXT_PUBLIC_*`, browser code, command-line arguments, commits or chat. `GOOGLE_API_KEY` is an accepted alias. Neither the key prefix nor a guessed model version determines whether Google accepts it.

`GEMINI_MODEL` is honored by both the Next.js and Python implementations. It accepts an ID with or without the `models/` prefix. No model fallback is silently selected. If unset, the current code default is `gemini-3.5-flash-lite`; this is not a guarantee of availability to a particular project. The default is the model ID requested for this project, not a claim that Google makes it available to every account. Other provider keys are never selected automatically.

## Preview setup when you cannot edit files

The assistant can start `node scripts/gemini-setup.mjs` as a separate **Gemini setup**
preview on port 3001. Open that preview and enter the random setup code supplied by
the assistant, then your API key. The key is never placed in chat or browser storage.
Select a model from Google's live list and press **Test connection & save**.
After a real model response, the helper saves the private `.env.local` with mode
0600 and locks itself. Ask the assistant to restart both services afterward.

This helper is not part of the deployed website. It refuses production mode,
requires a random bearer capability, has no CORS support, expires after 30 minutes,
and permits only one successful save. Do not share its access code. Both temporary
and final credential files are Git-ignored. The helper contacts only Google's fixed
HTTPS Gemini endpoint; it never returns or logs your API key.

## Find and verify your model

With the key already configured:

```sh
npm run gemini:check -- --list-models
npm run gemini:check -- --model=exact-id-from-the-list
```

The diagnostic loads `.env.local`, lists Google's paginated `generateContent` models, and tests the selected model with a text request and a JSON request. Listing alone does not generate content; a full check consumes a small amount of quota. It never saves or prints keys, and never rewrites the selected model.

After a successful test, put that exact ID into `GEMINI_MODEL` and restart the serving processes. On a hosting platform, configure the secrets for **both** deployed services and redeploy them. Local environment changes do not update a remote deployment.

## Start the app

```sh
npm install
# First copy .env.example to .env.local and fill in GEMINI_API_KEY.
npm run gemini:check
npm run py:install
npm run dev:all
```

For a Next.js-only setup, `npm run dev` is enough: the browser falls back to the built-in `/api/ai/*` implementation when the optional FastAPI service is unavailable. When FastAPI is running, it is the primary AI backend and loads the root `.env.local` at startup. All browser requests remain same-origin through `/fastapi/*`; the API key never goes to the browser.

## Verify the running app

Open **System status → Test the key**. “AI configured” means a key exists; “AI live” means the explicit test returned a non-empty answer. This is a point-in-time check, not continuous monitoring. The assistant shares that tested status; a successful chat shows the provider/model of the actual reply.

You can also probe each backend independently without demo data or authentication:

```sh
npm run ai:check -- --probe-only
npm run ai:check -- --probe-only --backend=fastapi
```

Both probes must pass if both backends are deployed. With marketplace data present, `npm run ai:check` exercises brief parsing, proposal drafting, bid scoring and shortlist summaries. Sign in as a buyer or seller to test the assistant; its context is restricted to that account. Health checks do not bypass sign-in for conversation.

## When it stops working

| Result | Next action |
| --- | --- |
| Missing key / offline | Configure the secret on the process actually serving AI, then restart it. |
| Model not listed / HTTP 404 | Run model discovery; copy an exact supported ID. Do not assume a display name equals an API ID. |
| HTTP 400 | Check the API key type, model name and supported generation parameters. |
| HTTP 401/403 | Check the key's validity, Google project/API permissions and restrictions. |
| HTTP 429 | Check the project's quota/billing and rate limits; repeated retries won't fix exhausted quota. |
| Empty/blocked response | Rephrase; inspect output budget/safety behavior. This is not a healthy model response. |
| Direct check passes, app fails | Compare the two backend probes; check stale processes, environment overrides and deployment secrets. |
| Both adapters unavailable | Check server logs, `FASTAPI_URL`, networking and HTTPS access to Google. |

Real provider errors from FastAPI are surfaced as errors, not mistaken for a dead service and submitted to Google a second time through Next.js. Structured tools may explicitly return heuristic results after model failures; that is not proof Gemini is online. The diagnostic exits with failure for missing keys, failed probes or heuristic-only results.

## Automated checks (no real Google requests)

```sh
npm run test:gemini
backend/.venv/bin/python -m unittest discover -s backend/tests -v
npm run build
```

These cover request formatting, custom model IDs, thinking-token budgets, structured output, empty/blocked replies, provider failures, credential-safe model discovery and browser fallback behavior. They validate the integration, but a real key and successful live probe are still required to claim a Google connection is online.
