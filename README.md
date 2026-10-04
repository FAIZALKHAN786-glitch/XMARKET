# XMARKET
A needs-first reverse marketplace where buyers post custom requirements (budget, deadline, specs) and providers submit competitive offers evaluated by an intelligent compatibility-matching engine.


# 🔄 ReverseMarket — Needs-First Procurement Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

> **Flip the traditional marketplace dynamic.** Instead of searching through endless listings, buyers post exact requirements, and qualified providers submit tailored offers ranked by an intelligent compatibility algorithm.

---

## 📌 Problem Statement
Traditional online marketplaces force users to browse through hundreds of irrelevant listings to find products or services matching their needs. This process is time-consuming, inefficient, and often fails when buyers have strict budgets, tight deadlines, or unique specifications.

## 💡 Solution
**XMARKET** is a reverse-bidding and procurement ecosystem designed to put the buyer's needs first:
1. **Buyers** post detailed requirements (specifications, category, max budget, deadline).
2. **Providers** submit targeted bids and proposals.
3. **The Matching Engine** scores each proposal based on compatibility (budget alignment, delivery speed, and relevance).
4. **The Comparison Dashboard** allows buyers to easily compare, shortlist, and accept the best offer.

---

## 🚀 Key Features

### 👤 For Buyers
- **Requirement Posting:** Create detailed requests with categories, budget caps, delivery deadlines, and custom tags.
- **Comparison Dashboard:** Side-by-side evaluation of all incoming bids.
- **Offer Management:** Shortlist promising offers, reject outliers, and finalize deals.
- **Smart Filtering:** Sort bids by compatibility score, lowest price, or fastest delivery.

### 🏢 For Providers / Sellers
- **Opportunity Feed:** Browse and search buyer requests relevant to your domain/skills.
- **Custom Bid Submission:** Propose pricing, estimated delivery date, and a customized pitch/milestones.
- **Status Tracking:** Track whether bids are pending, shortlisted, accepted, or rejected.

### 🧠 Smart Compatibility Engine
Every offer is automatically evaluated using a multi-factor scoring algorithm:
* **Budget Compatibility:** Evaluates how close the offer is to the buyer’s target budget.
* **Timeline Match:** Rewards proposals that meet or beat the expected delivery deadline.
* **Requirement Relevance:** Matches provider category, keywords, and qualifications to the request.

$$\text{Compatibility Score} = w_1(\text{Budget}) + w_2(\text{Timeline}) + w_3(\text{Relevance})$$

---

## 🛠️ Tech Stack

- **Frontend:** React.js / Next.js / Tailwind CSS / Lucide Icons
- **Backend:** Node.js / Express.js / Python (FastAPI)
- **Database:** PostgreSQL / MongoDB
- **Authentication:** JWT / Firebase Auth / NextAuth

---

## 🔄 How It Works (Workflow)

```mermaid
graph TD
    A[Buyer Posts Requirement] --> B[Stored in Marketplace Feed]
    B --> C[Providers Submit Proposals]
    C --> D[Matching Engine Calculates Compatibility Score]
    D --> E[Comparison Dashboard Displays Ranked Offers]
    E --> F[Buyer Shortlists & Accepts Best Offer]
    F --> G[Deal Finalized / Work Begins]

---

## 🖥️ Frontend (Implemented)

The design directive ships as a complete Next.js 14 (App Router) frontend:

| Route | Page |
|---|---|
| `/` (and `/login`) | **Login** — split editorial layout, atmospheric left panel, auth form right |
| `/dashboard` | **Requirement Posting** — command input, autocomplete, AI extraction panel, requirement builder |
| `/matches` | **Match Results** — ranked offer grid, why-this-match, shortlist + comparison sidebar |
| `/provider` | **Provider Dashboard** — sidebar nav, requirements feed, submit-offer modal, offers table |

### Stack
- Next.js 14 · React 18 · Lucide icons
- Monochrome glassmorphism design system in `app/globals.css`
- Mock API layer in `lib/api.js` with `// TODO` markers mapping every call to its real endpoint contract

### Run locally
```bash
npm install
npm run dev     # http://localhost:3000
```

### Backend integration
All data flows through `lib/api.js`. Swap the mock implementations for the
documented endpoints (see the endpoint map at the top of that file) and set:

```
NEXT_PUBLIC_API_URL=…   GEMINI_API_KEY=…   GROQ_API_KEY=…
NEXTAUTH_SECRET=…       GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=…
```
