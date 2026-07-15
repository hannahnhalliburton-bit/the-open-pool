// Vercel serverless function.
// Returns the tournament field split into three tiers (A / B / C).
//
// It reuses the SAME endpoint the leaderboard uses (/leaderboard), which is
// confirmed working, to fetch the full field. It then orders players using the
// SEED_ORDER favourites list below (best first) and splits them:
//   top 15 = Tier A, next 15 = Tier B, the rest = Tier C.
// Any player not in the seed list falls into the pool after the seeded ones,
// sorted alphabetically — so the whole field is always draftable.
//
// Your RapidAPI key is read from env var RAPIDAPI_KEY and never sent to the browser.

const RAPIDAPI_HOST = 'live-golf-data.p.rapidapi.com';
const YEAR = process.env.TOURN_YEAR || '2026';
const ORG_ID = process.env.ORG_ID || '1';
const TOURN_ID = process.env.TOURN_ID || '100';
const TIER_A_SIZE = parseInt(process.env.TIER_A_SIZE || '15', 10);
const TIER_B_SIZE = parseInt(process.env.TIER_B_SIZE || '15', 10);

// Favourites order for The Open 2026, best-first. Used to rank the field so the
// tier dropdowns are sensible before any scores exist. Edit freely.
const SEED_ORDER = [
  'Scottie Scheffler', 'Rory McIlroy', 'Jon Rahm', 'Xander Schauffele',
  'Bryson DeChambeau', 'Ludvig Åberg', 'Tommy Fleetwood', 'Collin Morikawa',
  'Joaquin Niemann', 'Viktor Hovland', 'Shane Lowry', 'Justin Thomas',
  'Brooks Koepka', 'Tyrrell Hatton', 'Cameron Smith',
  'Matt Fitzpatrick', 'Cameron Young', 'Patrick Cantlay', 'Hideki Matsuyama',
  'Jordan Spieth', 'Wyndham Clark', 'Robert MacIntyre', 'Sepp Straka',
  'Russell Henley', 'Sam Burns', 'Min Woo Lee', 'Keegan Bradley',
  'Corey Conners', 'Sungjae Im', 'Aaron Rai',
  'Justin Rose', 'Adam Scott', 'Brian Harman', 'Chris Gotterup',
  'J.J. Spaun', 'Harris English', 'Akshay Bhatia', 'Ben Griffin',
  'Maverick McNealy', 'Jason Day', 'Si Woo Kim', 'Tom Kim',
  'Nick Taylor', 'Billy Horschel', 'Aldrich Potgieter',
];

function normalise(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z ]/g, '')
    .trim();
}

async function fetchJson(path, key) {
  const r = await fetch(`https://${RAPIDAPI_HOST}${path}`, {
    headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': RAPIDAPI_HOST },
  });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return res.status(500).json({ error: 'Server missing RAPIDAPI_KEY.' });

  try {
    // Use the proven leaderboard endpoint to get the full field.
    const data = await fetchJson(`/leaderboard?orgId=${ORG_ID}&tournId=${TOURN_ID}&year=${YEAR}`, key);
    const field = (data.leaderboardRows || []).map((row) => {
      return { name: `${row.firstName || ''} ${row.lastName || ''}`.trim() };
    }).filter((p) => p.name);

    // Build a seed rank lookup.
    const seedRank = {};
    SEED_ORDER.forEach((nm, i) => { seedRank[normalise(nm)] = i + 1; });

    const BIG = 99999;
    const ranked = field.map((p) => ({
      name: p.name,
      order: seedRank[normalise(p.name)] ?? BIG,
    }));
    // Seeded players first (by seed order), then the rest alphabetically.
    ranked.sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));

    const tierA = ranked.slice(0, TIER_A_SIZE);
    const tierB = ranked.slice(TIER_A_SIZE, TIER_A_SIZE + TIER_B_SIZE);
    const tierC = ranked.slice(TIER_A_SIZE + TIER_B_SIZE);

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).json({
      source: 'seed',
      count: field.length,
      tiers: {
        A: tierA.map((p) => p.name),
        B: tierB.map((p) => p.name),
        C: tierC.map((p) => p.name),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Could not build tiers', detail: String(err).slice(0, 300) });
  }
}
