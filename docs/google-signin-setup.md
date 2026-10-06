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

## Shortcut: skip the menus

Google reorganised this area into **Google Auth Platform**, so the menu names
in older tutorials ("APIs & Services → OAuth consent screen") no longer match
what you see. These four links go straight to each page — open them in order:

| Step | Direct link |
| --- | --- |
| 1. Create the project | **https://console.cloud.google.com/projectcreate** |
| 2. Consent screen (app name, support email) | **https://console.cloud.google.com/auth/branding** |
| 3. User type **External** + test users | **https://console.cloud.google.com/auth/audience** |
| 4. Create the OAuth client + redirect URI | **https://console.cloud.google.com/auth/clients** |

If a link lands on "no project selected", append your project id:
`https://console.cloud.google.com/auth/clients?project=YOUR-PROJECT-ID`.

The click-by-click version of the same four steps follows.

---

## Where the project dropdown is (if you want it)

It sits in the **top bar, immediately right of the "Google Cloud" logo**, and
shows the current project's name (`My First Project`, `Select a project`, …)
with a small ▾ next to it.

If you genuinely cannot see it, one of these is usually why:

- **The window is too narrow.** The selector collapses to just the logo.
  Widen the browser, or look behind the ☰ menu at the far left.
- **You are not in Cloud Console.** The address must start with
  `console.cloud.google.com`. Pages like `console.firebase.google.com`, the
  Google Admin console, or a `developers.google.com` docs page have a
  different (or no) top bar.
- **It is your first visit.** Cloud Console shows a welcome page and a terms
  prompt first. Accept it and you land in a project.
- **You are on a Google Auth Platform page.** Same bar, same place — it just
  looks different from the old screenshots.

You do not strictly need it: creating a project selects it automatically, and
the direct links above carry the project with you.

---

## Part 1 — a project and a consent screen

The consent screen is the "XMarket wants to access your name and email" page.
Google requires it to exist before it will issue a client ID.

### 1a. Create a project

Open **https://console.cloud.google.com/projectcreate**:
- **Project name:** `xmarket` (the id is generated for you; note it down)
- **Location:** leave as *No organisation*
- **Create**, then wait for the notification that it exists (10–20 seconds).

### 1b. Branding — the consent screen

Open **https://console.cloud.google.com/auth/branding**. If it says
*"Google Auth platform not configured yet"*, press **Get started** and fill in:
- **App name:** `XMarket`
- **User support email:** your email address
- Everything else (logo, home page, privacy policy) is optional — leave blank.

Save and continue.

### 1c. Scopes

Only three, all of them Google's *non-sensitive* scopes — which is exactly why
this app never needs Google's app-verification process:

- `openid`
- `.../auth/userinfo.email`
- `.../auth/userinfo.profile`

If the wizard offers a scopes step, add those. If it does not, skip it — the
app requests them at sign-in time and non-sensitive scopes need no pre-approval.

### 1d. Audience — user type and test users

Open **https://console.cloud.google.com/auth/audience**:
- **User type: External.**
  (*Internal* is only offered to Google Workspace organisations; a personal
  Gmail account must use External.)
- **Test users → Add users** → add **your own Gmail address** (and anyone else
  who should be able to sign in).

While the app's publishing status is **Testing**, only listed users can sign
in. You can leave it in Testing forever for personal use — publishing is only
required for sensitive scopes or large audiences.

---

## Part 2 — the OAuth client (the Client ID and Secret)

Open **https://console.cloud.google.com/auth/clients** → **Create client**:

1. **Application type: Web application.**
   Not *Desktop app*, not *iOS/Android* — those issue credentials that cannot
   do a server-side code exchange.
2. **Name:** `XMarket web` (anything you will recognise later).
3. **Authorised JavaScript origins** — optional, leave empty. This app's
   sign-in is a full-page redirect, not a browser-side popup.
4. **Authorised redirect URIs → + Add URI**, and paste:

   ```
   http://localhost:3000/fastapi/v1/oauth2/callback/google
   ```

   This exact string is the one thing that has to match. Note `http://`
   (not https) and the `:3000` — Google allows plain-HTTP localhost
   redirects for development.

   Add more URIs later if you deploy: run
   `curl -s localhost:3000/fastapi/health | jq .data.google.redirectUri`
   on the deployed host to get the right one, and add it here too.
5. **Create.**

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
| Google: **Error 403: access_denied** | your email is not a test user, or an admin policy blocks the app | add the address under **Audience → Test users** |
| No **Clients** / **Branding** menu at all | the project has no OAuth-compatible API enabled, or your account is only a Viewer | you need the Owner or Editor role on the project |
| App: *"This server cannot reach Google"* | no outbound internet from the machine running `npm run py:dev` | run it somewhere with egress to `oauth2.googleapis.com`; `/fastapi/health` carries the connection error |
| App: *"Google sign-in is not configured"* | env vars missing, or the FastAPI service started before you saved them | fill in `.env.local` and restart **both** processes |
| App: *"The OAuth service … is not responding"* | `npm run py:dev` is not running | start it (`npm run py:install` first time only) |
| App: *"Google did not accept the OAuth client"* | wrong secret, or the client is not type **Web application** | re-copy the secret; check the client type |
