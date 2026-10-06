// MorphoDeutsch — sync endpoint test (/api/adjectives) against a mocked Blob store. No key or network needed.
// Checks that workbook progress (wb) is stored, and that a device still running an older copy of the app,
// which sends no wb, does not wipe it.
// Run:  node tests/sync-test.mjs
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'morpho-sync-'));
fs.mkdirSync(path.join(dir, 'node_modules/@vercel/blob'), {recursive:true});
fs.mkdirSync(path.join(dir, 'api'));
fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
fs.writeFileSync(path.join(dir, 'node_modules/@vercel/blob/package.json'), '{"name":"@vercel/blob","version":"0.0.0","type":"module","main":"index.js"}');
fs.writeFileSync(path.join(dir, 'node_modules/@vercel/blob/index.js'), `const store = globalThis.__store;
export async function put(p, text){ store.set(p, text); return {url:'blob://' + p}; }
export async function list({prefix}){ return {blobs: Array.from(store.keys()).filter(k => k.startsWith(prefix)).map(k => ({pathname:k, url:'blob://' + k}))}; }`);
fs.copyFileSync(path.join(ROOT, 'api/adjectives.js'), path.join(dir, 'api/adjectives.js'));

const store = globalThis.__store = new Map();
let failFetch = false;
globalThis.fetch = async url => { if (failFetch) throw new Error('down'); const k = String(url).replace('blob://', '').split('?')[0]; return {json: async () => JSON.parse(store.get(k))}; };
process.env.SYNC_KEY = 'k'; process.env.BLOB_READ_WRITE_TOKEN = 't';
const { default: handler } = await import(pathToFileURL(path.join(dir, 'api/adjectives.js')).href);
const call = async (method, body, key = 'k') => {
  let status = 0, json = null;
  const res = {setHeader(){}, status(s){ status = s; return res; }, json(j){ json = j; return res; }};
  await handler({method, headers:{'x-sync-key':key}, body}, res);
  return {status, json};
};
let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log('  FAIL', m); } };

ok((await call('GET', null, 'bad')).status === 401, '401 with a wrong key');
let g = await call('GET');
ok(g.status === 200 && JSON.stringify(g.json.wb) === '{"it":{}}' && Array.isArray(g.json.items), 'the empty document has an empty workbook');
ok((await call('PUT', {items:[], log:{}})).status === 200, 'PUT without wb, nothing stored yet');
ok(JSON.stringify((await call('GET')).json.wb) === '{"it":{}}', 'stored with an empty workbook');
ok((await call('PUT', {items:[{id:'a'}], wb:{it:{'mix:sonnig':{n:1, ok:1, s:1, r:1, t:5}}}})).status === 200, 'PUT with wb');
g = await call('GET');
ok(g.json.wb.it['mix:sonnig'].t === 5 && g.json.items.length === 1, 'workbook progress is stored');
ok((await call('PUT', {items:[{id:'a'}, {id:'b'}], deleted:{}, patterns:{}, events:[], log:{x:1}})).status === 200, 'PUT from an older app copy (no wb)');
g = await call('GET');
ok(g.json.wb.it['mix:sonnig'].t === 5 && g.json.items.length === 2 && g.json.log.x === 1, 'an older app copy does not wipe the workbook');
ok((await call('PUT', JSON.stringify({items:[], wb:{it:{}}}))).status === 200, 'PUT as a string, with an empty wb on purpose');
ok(Object.keys((await call('GET')).json.wb.it).length === 0, 'an explicit empty workbook is stored as sent');
await call('PUT', {items:[], wb:{it:{q:{n:1, t:9}}}});
failFetch = true;
ok((await call('PUT', {items:[{id:'z'}]})).status === 200, 'PUT without wb still saves when the old document cannot be read');
failFetch = false;
ok((await call('PUT', {wb:{}})).status === 400, 'items are still required');
ok((await call('PUT', {items:[], wb:'x'})).status === 200 && typeof (await call('GET')).json.wb.it === 'object', 'a malformed wb is ignored');
ok((await call('DELETE')).status === 405, '405 for other methods');
delete process.env.SYNC_KEY;
ok((await call('GET')).status === 503, 'sync stays off without a server key');

fs.rmSync(dir, {recursive:true, force:true});
console.log(fails ? `${fails} of ${n} sync endpoint checks FAILED` : `all ${n} sync endpoint checks passed`);
process.exit(fails ? 1 : 0);
