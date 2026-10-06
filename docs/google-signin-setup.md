# Setting up "Continue with Google"

Everything below happens in the Google Cloud console and takes about ten
minutes, once. You need a Google account — the same one you will sign in with,
or any other you add as a test user.

> **Run the app on your own machine for this.** The consent screen opens in
> your browser, but the step that finishes the sign-in (trading Google's code
> for your profile) is a call from the *server* to `oauth2.googleapis.com`.
> A sandbox or container with no outbound internet gets through the consent
> screen and then fails on that call. See "Troubleshooting" at the bottom.

---

## Part 1 — a project and a consent screen

The consent screen is the "XMarket wants to access your name and email"
page. Google requires it to exist before it will issue a client ID.

1. Open **https://console.cloud.google.com/** and sign in.
2. In the top bar, open the project dropdown → **New project**.
   Name it anything (`xmarket`) → **Create**. Select it once it exists.
3. Go to **APIs & Services → OAuth consent screen**
   (Google may bounce you to the newer **Google Auth Platform → Overview**
   page — that is the same thing; press **Get started**).
4. **User type:** choose **External** → **Create**.
   (*Internal* is only available to Google Workspace organisations; a personal
   Gmail account must use External.)
5. **App information** — only two fields matter:
   - *App name*: `XMarket`
   - *User support email*: your email address
   - (App logo, home page, privacy policy: optional, leave blank.)
   Save and continue.
6. **Scopes** — press **Add or remove scopes** and tick:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`

   These are Google's *non-sensitive* scopes, which is why this app never
   needs Google's app-verification process. Save and continue.
7. **Test users** — press **Add users** and add **your own Gmail address**
   (and anyone else who should be able to sign in). While the app's publishing
   status is *Testing*, only listed users can sign in.

   You can leave it in Testing forever for personal use — publishing is only
   required for sensitive scopes or large audiences.

---

## Part 2 — the OAuth client (the Client ID and Secret)

1. **APIs & Services → Credentials** → **+ Create credentials** →
   **OAuth client ID**.
2. **Application type: Web application.**
   Not *Desktop app* and not *iOS/Android* — those issue credentials that
   cannot do a server-side code exchange.
3. **Name:** `XMarket web` (anything you will recognise later).
4. **Authorised JavaScript origins** — optional, leave empty. This app's
   sign-in is a full-page redirect, not a browser-side popup.
5. **Authorised redirect URIs** → **+ Add URI**, and paste:

   ```
   http://localhost:3000/fastapi/v1/oauth2/callback/google
   ```

   This exact string is the one thing that has to match. Note `http://`
   (not https) and the `:3000` — Google allows plain-HTTP localhost
   redirects for development.

   Add more URIs later if you deploy: run
   `curl -s localhost:3000/fastapi/health | jq .data.google.redirectUri`
   on the deployed host to get the right one, and add it here too.
6. **Create.**

Google now shows your **Client ID** (`….apps.googleusercontent.com`) and
**Client secret** (`GOCSPX-…`). Copy both, or press **Download JSON** — the
values are in it as `client_id` and `client_secret`.

---

## Part 3 — into the app

Open `.env.local` in the project root (I left the lines there, commented out)
and fill them in:

```bash
GOOGLE_CLIENT_ID=123456789-abc….apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-…
```

`.env.local` is gitignored, so your secret never enters the repository. Do not
paste these values into a chat, issue, or commit.

---

## Part 4 — restart and verify

Both processes read the file at startup, so restart both:

```bash
npm run dev        # Next.js on :3000
npm run py:dev     # FastAPI OAuth service on :8000
```

Then ask the service what it thinks of its own configuration:

```bash
curl -s localhost:3000/fastapi/health | jq .data.google
```

You want:

```json
{
  "configured": true,
  "redirectUri": "http://localhost:3000/fastapi/v1/oauth2/callback/google",
  "reachable": true,
  "detail": "Google answered HTTP 404"
}
```

`reachable: true` is the one people miss — it proves the server can actually
open a TLS connection to Google. (Any HTTP answer below 500 counts; a 404 to a
bare probe still means the route works.)

The **Continue with Google** button on `/signin/buyer` and `/signin/seller`
checks this on page load. If any of it is wrong, the button says which part
and why instead of failing silently.

---

## Part 5 — what happens on the first sign-in

- You land on Google, pick an account, and approve the consent screen.
  In *Testing* mode you will first see **"Google hasn't verified this app"** →
  **Advanced → Continue** — that is expected for an unverified test app.
- Google redirects back to the callback, which creates your account
  (role = the page you started on: buyer or seller; sellers also get a
  merchant ID), sets the `xmarket_jwt` cookie and drops you on `/buyer`
  or `/seller` signed in.
- Signing in again with the same Google email reuses that account.
- Email/password sign-in keeps working, and so does signing out.

---

## Troubleshooting

| What you see | Why | Fix |
| --- | --- | --- |
| Google: **Error 400: redirect_uri_mismatch** | the URI your app sent is not in the client's list | copy `google.redirectUri` from `/fastapi/health` into **Authorised redirect URIs** — character for character |
| Google: **"This app isn't verified"** | publishing status is *Testing* | click **Advanced → Continue**; or add yourself as a test user |
| Google: **Error 403: access_denied** | your email is not a test user, or an admin policy blocks the app | add the address under **OAuth consent screen → Test users** |
| App: *"This server cannot reach Google"* | no outbound internet from the machine running `npm run py:dev` | run it somewhere with egress to `oauth2.googleapis.com`; `/fastapi/health` carries the connection error |
| App: *"Google sign-in is not configured"* | env vars missing, or the FastAPI service started before you saved them | fill in `.env.local` and restart **both** processes |
| App: *"The OAuth service … is not responding"* | `npm run py:dev` is not running | start it (`npm run py:install` first time only) |
| App: *"Google did not accept the OAuth client"* | wrong secret, or the client is not type **Web application** | re-copy the secret; check the client type |
