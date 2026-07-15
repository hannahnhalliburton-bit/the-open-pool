# The Open Draft Pool — Setup Guide

A self-updating golf pool. Live scores pull in on their own, and tiers are
assigned automatically by world ranking. Free to run.

## What you'll end up with

A web page at your own address (like `open-pool.vercel.app`) that you share with
your friends. Everyone drafts six golfers — two from each auto-sorted tier — and
the standings update by themselves during the tournament. No one types scores.

## What it costs

Nothing. Two free accounts (RapidAPI for the golf data, Vercel for hosting), and
the free data plan (250 calls/month) comfortably covers one tournament.

---

## Step 1 — Get a free golf-data API key

1. Go to **https://rapidapi.com/slashgolf/api/live-golf-data/pricing**
2. Sign up (free), then subscribe to the **Basic — Free** plan (250 calls/month).
3. Open the API's "Endpoints" tab and copy your key. It's the long string
   labelled **X-RapidAPI-Key**. Keep it handy for Step 3.

## Step 2 — Put these files on GitHub

1. Create a free account at **https://github.com** if you don't have one.
2. Make a new repository (call it `open-pool`), then upload this whole folder —
   the `api` folder, the `public` folder, `vercel.json`, and `package.json`.
   (GitHub lets you drag-and-drop files in the browser: "Add file" → "Upload files".)

## Step 3 — Deploy on Vercel

1. Go to **https://vercel.com** and sign up with your GitHub account (free).
2. Click **Add New → Project**, and import your `open-pool` repository.
3. Before clicking Deploy, open **Environment Variables** and add these:

   | Name          | Value                                   |
   |---------------|-----------------------------------------|
   | `RAPIDAPI_KEY`| *(paste the key from Step 1)*           |
   | `TOURN_ID`    | *(see Step 4 — the tournament's ID)*    |
   | `TOURN_YEAR`  | `2026`                                  |

4. Click **Deploy**. After a minute you'll get a live URL. That's the link you
   share with your friends.

## Step 4 — Point it at The Open (one-time)

The app needs the correct `tournId` for The Open. To find it:

1. Once deployed, visit `https://YOUR-URL/api/tiers` in your browser.
   - If you see a list of golfers split into tiers, you're done — the default ID
     was right.
   - If you see an error or the wrong event, you need the correct ID.
2. To get the ID: in RapidAPI, open the **/schedules** endpoint, run it with
   `year=2026`, and find "The Open Championship" in the results. Copy its
   `tournId` value.
3. In Vercel: **Settings → Environment Variables**, update `TOURN_ID`, and
   **redeploy** (Deployments tab → ⋯ → Redeploy).

## Step 5 — Run your pool

1. Open your URL. Add an entrant for each friend (the ✕ removes one).
2. Each person picks two golfers from each tier dropdown — the lists are already
   sorted for you.
3. During the tournament, scores refresh every 2 minutes on their own. The green
   dot near the top means it's live; "Refresh scores now" forces an update.

---

## Adjusting things

- **Tier sizes:** add env vars `TIER_A_SIZE` and `TIER_B_SIZE` (default 15 each);
  everyone else falls into Tier C.
- **Scores that count:** the best 4 of 6 count by default. To change it, edit
  `const COUNT = 4;` near the top of the script in `public/index.html`.
- **If rankings aren't available on the free plan:** the app will say so in a
  banner and fall back. To fix tier order, open `api/tiers.js` and paste an
  ordered list of favourites into `SEED_ORDER` (best first), then redeploy.

## Notes & limits

- The free plan allows 250 API calls/month. The app caches results (90s for
  scores, 1h for tiers) to stay well under that for a single tournament.
- Entrants and picks live in each visitor's browser session. For a shared pool,
  one person should be the "scorekeeper" who holds the roster; everyone else can
  watch the same live standings. Making rosters shared across devices would need
  a database, which is beyond this free setup.
- Name-matching between the feed and the dropdowns is automatic (it ignores
  accents and punctuation). Because picks come from the feed's own name list,
  matches should be exact.
