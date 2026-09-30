// /api/adjectives — MorphoDeutsch cloud copy (Vercel Blob).
// GET        → the saved document {items, deleted, patterns, events, log, updatedAt} (empty document if none yet)
// PUT / POST → save the document (the app merges first, so a PUT is always the union of both devices)
//
// Vercel setup:
//   1. Storage → connect a Blob store to this project (adds BLOB_READ_WRITE_TOKEN).
//   2. Optional: env var SYNC_KEY — any password. When set, every request must send it in x-sync-key;
//      the app asks for it once per device. (VERB_SYNC_SECRET is accepted as a fallback name.)

import { put, list } from '@vercel/blob';

const BLOB_PATH = 'morphodeutsch/adjectives.json';
const MAX_BYTES = 4 * 1024 * 1024;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const secret = process.env.SYNC_KEY || process.env.VERB_SYNC_SECRET;
  if (secret && req.headers['x-sync-key'] !== secret) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: 'storage not configured', hint: 'Connect a Blob store to this Vercel project.' });
  }

  try {
    if (req.method === 'GET') {
      const { blobs } = await list({ prefix: 'morphodeutsch/' });
      const doc = blobs.find(b => b.pathname === BLOB_PATH);
      if (!doc) return res.status(200).json({ items: [], deleted: {}, patterns: {}, events: [], log: {}, updatedAt: null });
      const r = await fetch(doc.url + '?t=' + Date.now(), { cache: 'no-store' });
      return res.status(200).json(await r.json());
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      if (!Array.isArray(body.items)) return res.status(400).json({ error: 'items array required' });
      const doc = {
        items: body.items,
        deleted: body.deleted || {},
        patterns: body.patterns || {},
        events: Array.isArray(body.events) ? body.events.slice(-800) : [],
        log: body.log || {},
        updatedAt: new Date().toISOString(),
      };
      const text = JSON.stringify(doc);
      if (text.length > MAX_BYTES) return res.status(413).json({ error: 'document too large' });
      await put(BLOB_PATH, text, {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
        cacheControlMaxAge: 60,
      });
      return res.status(200).json({ ok: true, updatedAt: doc.updatedAt });
    }

    res.setHeader('Allow', 'GET, PUT, POST');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'storage error', detail: String((err && err.message) || err) });
  }
}
