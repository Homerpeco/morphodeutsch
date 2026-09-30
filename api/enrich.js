// /api/enrich — AI analysis of one adjective for MorphoDeutsch.
// POST {word, section?, draft?}  →  {ok, model, section, data}
// section: all | formation | relations | examples | collocations | family | grammar (the app shows the result for review
// and saves nothing on its own).
//
// Vercel setup: GEMINI_API_KEY (Google AI Studio key). Protected by the same SYNC_KEY as /api/adjectives,
// so nobody else can spend the Gemini quota.

import { enrich, EnrichError } from './_enrich.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const secret = process.env.SYNC_KEY || process.env.VERB_SYNC_SECRET;
  if (!secret) return res.status(503).json({ error: 'sync key not configured' });
  if (req.headers['x-sync-key'] !== secret) return res.status(401).json({ error: 'unauthorized' });
  const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: 'ai not configured', hint: 'Add GEMINI_API_KEY in Vercel and redeploy.' });

  let body = req.body;
  try { if (typeof body === 'string') body = JSON.parse(body); } catch { body = {}; }
  body = body || {};
  try {
    const out = await enrich(body.word, { section: body.section, draft: body.draft, key });
    return res.status(200).json({ ok: true, ...out });
  } catch (e) {
    const err = e instanceof EnrichError ? e : new EnrichError(String((e && e.message) || e));
    if (err.retryAfter) res.setHeader('Retry-After', String(err.retryAfter));
    return res.status(err.status || 502).json({ error: err.message, retryAfter: err.retryAfter || undefined });
  }
}
