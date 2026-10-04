// MorphoDeutsch — /api/enrich test with a mocked Gemini. No key and no network needed.
// Covers the failures seen on the phone (invalid JSON, cut-off answers, overloaded model) and the full split
// (un + zerbrechlich must end up as un · zer · brech · lich with its derivation chain).
// Run: node tests/enrich-test.mjs
import fs from 'fs';
import { enrich, normalize, containsAdj, buildPrompt, parseJsonLoose, morphIssues, finishMorph, readMorphemes, trailText, SCHEMA } from '../api/_enrich.js';
import handler from '../api/enrich.js';

const fixture = JSON.parse(fs.readFileSync(new URL('./fixture-entfernt.json', import.meta.url)));
let fail = 0, n = 0;
const ok = (name, cond, extra = '') => { n++; if (!cond) { fail++; console.log('FAIL ' + name, extra); } else if (process.env.VERBOSE) console.log('pass ' + name); };
const quiet = { log() {} };
const gem = (text, o = {}) => ({ ok: true, status: 200, headers: { get: () => null },
  json: async () => ({ candidates: [{ finishReason: o.finish || 'STOP', content: { parts: [...(o.thought === false ? [] : [{ thought: true, text: 'thinking…' }]), { text }] } }], usageMetadata: { candidatesTokenCount: 900, thoughtsTokenCount: 300 }, ...(o.block ? { promptFeedback: { blockReason: o.block } } : {}) }) });
const err = (status, message) => ({ ok: false, status, headers: { get: () => null }, json: async () => ({ error: { message, details: [{ retryDelay: '17s' }] } }) });
const isRecheck = body => /^Split the German adjective/.test(body.contents[0].parts[0].text);
let modelSeq = 0;
const freshModels = () => { modelSeq++; process.env.ENRICH_MODELS = `flash-${modelSeq},lite-${modelSeq}`; return [`flash-${modelSeq}`, `lite-${modelSeq}`]; };

// a full, correct analysis of unzerbrechlich, and the shallow one the weaker model gave
const MEANING = { id: 'm1', gloss: 'unbreakable, shatterproof', register: 'common', note: '', collocations: ['unzerbrechliches Glas'], synonyms: [{ w: 'bruchfest', confidence: 'high' }],
  antonyms: [{ w: 'zerbrechlich', confidence: 'high' }], nouns: ['das Glas, ¨-er'], prepositions: [], examples: [{ de: 'Das Glas ist unzerbrechlich.', en: 'The glass is unbreakable.', context: 'everyday' }] };
const BASE = { word: 'unzerbrechlich', isAdjective: true, formation: { kind: 'prefix', base: 'zerbrechlich', affix: 'un', parts: ['un', 'zerbrechlich'], change: '', explanation: 'un- + zerbrechlich', confidence: 'high' },
  meanings: [MEANING], family: [{ w: 'zerbrechen', type: 'direct', gloss: 'to break', meaning: '', confidence: 'high' }], partner: { w: '', note: '' },
  grammar: { predicative: 'Das Glas ist unzerbrechlich.', attributive: 'ein unzerbrechliches Glas', comparison: 'not usually compared', notes: [] }, uncertain: [] };
const FULL_M = [{ form: 'un', type: 'prefix', gloss: 'not', lemma: '' }, { form: 'zer', type: 'prefix', gloss: 'apart', lemma: '' }, { form: 'brech', type: 'root', gloss: 'break', lemma: 'brechen' }, { form: 'lich', type: 'suffix', gloss: '-able', lemma: '' }];
const FULL_D = ['brechen', 'zerbrechen', 'zerbrechlich', 'unzerbrechlich'];
const full = { ...BASE, morphemes: FULL_M, derivation: FULL_D };
const shallow = { ...BASE, morphemes: [{ form: 'un', type: 'prefix', gloss: 'not' }, { form: 'zerbrechlich', type: 'root', gloss: 'breakable' }], derivation: ['zerbrechlich', 'unzerbrechlich'] };
const J = JSON.stringify;
const blocks = d => d.morphemes.map(m => m.t).join('·');

// ---- 1. request shape, happy path
freshModels();
let calls = [];
let r = await enrich('Unzerbrechlich', { key: 'K', logger: quiet, fetchImpl: async (url, opt) => { calls.push({ url, body: JSON.parse(opt.body), headers: opt.headers }); return gem('```json\n' + J(full) + '\n```'); } });
const g0 = calls[0].body.generationConfig;
ok('one call when everything is right', calls.length === 1, calls.length);
ok('key in header, first model first', calls[0].headers['x-goog-api-key'] === 'K' && calls[0].url.includes('/flash-1:generateContent'));
ok('JSON mode + schema + token limit + thinking', g0.responseMimeType === 'application/json' && g0.responseSchema && g0.responseSchema.properties.morphemes && g0.maxOutputTokens === 16000 && g0.thinkingConfig && g0.thinkingConfig.thinkingLevel === 'low', J(g0).slice(0, 120));
ok('schema lists morphemes and derivation first', SCHEMA.propertyOrdering.indexOf('morphemes') < SCHEMA.propertyOrdering.indexOf('meanings') && SCHEMA.required.includes('derivation'));
ok('full split kept', blocks(r.data) === 'un·zer·brech·lich' && r.data.morphemes[2].lemma === 'brechen' && r.data.morphemes[2].k === 'root', blocks(r.data));
ok('derivation chain kept', r.data.derivation.join('>') === FULL_D.join('>'));
ok('first split still un + zerbrechlich', r.data.formation.parts.join('|') === 'un|zerbrechlich' && r.data.formation.kind === 'prefix');
ok('no "please confirm" note', r.data.uncertain.length === 0, J(r.data.uncertain));
ok('prompt has the rules and the worked example', /down to the root/.test(calls[0].body.contents[0].parts[0].text) && /unverständlich/.test(calls[0].body.contents[0].parts[0].text));

// ---- 2. the reported case: the model stops at un + zerbrechlich → asked once more → full split and chain
freshModels(); calls = [];
r = await enrich('unzerbrechlich', { key: 'K', logger: quiet, fetchImpl: async (url, opt) => { const b = JSON.parse(opt.body); calls.push(b); return gem(isRecheck(b) ? J({ morphemes: FULL_M, derivation: FULL_D }) : J(shallow)); } });
ok('shallow split triggers one re-check', calls.length === 2 && isRecheck(calls[1]), calls.length);
ok('re-check names the problem', /zer \+ brech \+ lich/.test(calls[1].contents[0].parts[0].text) && /skips steps|every derivation step/.test(calls[1].contents[0].parts[0].text));
ok('re-check is a small request', calls[1].generationConfig.maxOutputTokens === 6000 && !!calls[1].generationConfig.responseSchema.properties.derivation);
ok('after re-check: un·zer·brech·lich', blocks(r.data) === 'un·zer·brech·lich', blocks(r.data));
ok('after re-check: 4-step chain', r.data.derivation.length === 4 && r.data.derivation[0] === 'brechen');

// ---- 3. the model stays shallow even when asked again → the confirmed local split still cuts it fully
freshModels(); calls = [];
r = await enrich('unzerbrechlich', { key: 'K', logger: quiet, fetchImpl: async (url, opt) => { calls.push(1); return gem(J(shallow)); } });
ok('stubborn model: blocks repaired locally', blocks(r.data) === 'un·zer·brech·lich' && r.data.morphSource === 'ai+checked', blocks(r.data) + ' ' + r.data.morphSource);
ok('stubborn model: root lemma from the verb list', r.data.morphemes.find(m => m.k === 'root').lemma === 'brechen');
ok('stubborn model: chain is not invented, learner is told to check', r.data.derivation.join('>') === 'zerbrechlich>unzerbrechlich' && r.data.uncertain.some(u => /derivation chain/.test(u)), J(r.data.uncertain));
ok('stubborn model: only one re-check', calls.length === 2);

// ---- 4. morphemes that do not spell the word → local split from the first split
freshModels();
const bad = { ...BASE, morphemes: [{ form: 'un', type: 'prefix' }, { form: 'brech', type: 'root' }, { form: 'lich', type: 'suffix' }], derivation: FULL_D };
r = await enrich('unzerbrechlich', { key: 'K', logger: quiet, fetchImpl: async () => gem(J(bad)) });
ok('pieces that do not spell the word are replaced', blocks(r.data) === 'un·zer·brech·lich' && r.data.morphSource === 'local', blocks(r.data));
ok('glosses filled in for local pieces', r.data.morphemes[0].gloss === 'not' && /apart/.test(r.data.morphemes[1].gloss));

// ---- 5. old-style answer without morphemes (entfernt fixture)
freshModels();
r = await enrich('entfernt', { key: 'K', logger: quiet, fetchImpl: async () => gem(J(fixture)) });
ok('no morphemes given → confirmed local split', blocks(r.data) === 'ent·fern·t' && r.data.meanings.length === 3, blocks(r.data));
ok('family, examples and prepositions unchanged', !r.data.family.some(f => f.w === 'entfernt') && r.data.meanings.every(m => m.examples.every(e => !e.check)) && r.data.meanings[0].prepositions[0].c === 'D');

// ---- 6. a model that rejects the request shape (HTTP 400) gets simpler requests; the working one is remembered
freshModels(); calls = [];
const picky = async (url, opt) => { const b = JSON.parse(opt.body); calls.push(b.generationConfig); return b.generationConfig.thinkingConfig ? err(400, 'Unknown name "thinkingConfig"') : gem(J(full)); };
r = await enrich('unzerbrechlich', { key: 'K', logger: quiet, fetchImpl: picky });
ok('400 → next request shape, same model', r.model === 'flash-6' && calls.length === 3 && !calls[2].thinkingConfig && !!calls[2].responseSchema, calls.length);
calls = [];
await enrich('unzerbrechlich', { key: 'K', logger: quiet, fetchImpl: picky });
ok('working shape remembered', calls.length === 1 && !calls[0].thinkingConfig);
freshModels(); calls = [];
r = await enrich('unzerbrechlich', { key: 'K', logger: quiet, fetchImpl: async (url, opt) => { const b = JSON.parse(opt.body); calls.push(b.generationConfig); return b.generationConfig.responseSchema ? err(400, 'schema too complex') : gem(J(full)); } });
ok('schema rejected → plain JSON mode still works', r.model === 'flash-7' && calls.length === 4 && !calls[3].responseSchema && calls[3].responseMimeType === 'application/json');

// ---- 7. invalid JSON: same model is tried again before the weaker one
const [f8] = freshModels(); calls = []; let logs = [];
r = await enrich('unzerbrechlich', { key: 'K', logger: { log: (a, b) => logs.push(b) }, fetchImpl: async url => { calls.push(url); return calls.length === 1 ? gem('Sure! Here is the analysis: {"word": "unzerbrechlich", "meanings": [oops') : gem(J(full)); } });
ok('invalid JSON → retry on the same model', r.model === f8 && calls.length === 2 && calls.every(u => u.includes(f8)));
const badLog = logs.map(l => JSON.parse(l)).find(l => l.note === 'invalid JSON');
ok('raw answer is logged (start and end)', badLog && /Sure! Here is/.test(badLog.head) && /oops/.test(badLog.tail) && badLog.chars > 20 && badLog.word === 'unzerbrechlich', J(badLog));
ok('attempt trail readable', trailText(r.trail).length === 2 && /invalid JSON/.test(trailText(r.trail)[0]) && /: ok/.test(trailText(r.trail)[1]), J(trailText(r.trail)));

// ---- 8. invalid JSON twice → falls back to the second model
const [, l9] = freshModels(); calls = [];
r = await enrich('unzerbrechlich', { key: 'K', logger: quiet, fetchImpl: async url => { calls.push(url); return url.includes('lite') ? gem(J(full)) : gem('not json at all'); } });
ok('two bad answers → next model', r.model === l9 && calls.length === 3);

// ---- 9. answer cut off (MAX_TOKENS): retried with a higher limit; if it never completes, the usable part is kept
freshModels(); calls = [];
const cutText = J(full).slice(0, J(full).indexOf('"family"') - 1);
r = await enrich('unzerbrechlich', { key: 'K', logger: quiet, fetchImpl: async (url, opt) => { const b = JSON.parse(opt.body); calls.push(b.generationConfig.maxOutputTokens); return calls.length === 1 ? gem(cutText, { finish: 'MAX_TOKENS' }) : gem(J(full)); } });
ok('cut-off answer → retry with more room', calls[0] === 16000 && calls[1] === 40000 && r.data.family.length === 1 && !r.partial);
freshModels();
r = await enrich('unzerbrechlich', { key: 'K', logger: quiet, fetchImpl: async () => gem(cutText, { finish: 'MAX_TOKENS' }) });
ok('always cut off → partial analysis with a note', r.partial === true && r.data.meanings.length === 1 && r.data.family.length === 0 && r.data.uncertain.some(u => /cut off/.test(u)) && blocks(r.data) === 'un·zer·brech·lich', J(r.data.uncertain));
freshModels(); calls = [];
r = await enrich('unzerbrechlich', { key: 'K', logger: quiet, fetchImpl: async (url, opt) => { calls.push(JSON.parse(opt.body).generationConfig.maxOutputTokens); return calls.length === 1 ? gem('', { finish: 'MAX_TOKENS' }) : gem(J(full)); } });
ok('thinking used up all tokens (no text) → retry with more room', calls.length === 2 && calls[1] === 40000 && r.data.meanings.length === 1);

// ---- 10. overloaded (503): one more try on the same model, then the next model
const [f12, l12] = freshModels(); calls = [];
r = await enrich('unzerbrechlich', { key: 'K', logger: quiet, fetchImpl: async url => { calls.push(url); return url.includes(f12) ? err(503, 'The model is overloaded') : gem(J(full)); } });
ok('503 twice → second model', r.model === l12 && calls.filter(u => u.includes(f12)).length === 2 && calls.length === 3);

// ---- 11. quota, key, blocked, bad word
freshModels(); calls = [];
r = await enrich('unzerbrechlich', { key: 'K', logger: quiet, fetchImpl: async url => { calls.push(url); return url.includes('flash') ? err(429, 'quota') : gem(J(full)); } });
ok('429 → second model at once', calls.length === 2 && /lite/.test(r.model));
freshModels();
try { await enrich('unzerbrechlich', { key: 'K', logger: quiet, fetchImpl: async () => err(429, 'quota') }); ok('quota error thrown', false); } catch (e) { ok('both 429 → quota error with wait time and trail', e.status === 429 && e.retryAfter === 17 && e.trail.length === 2); }
for (const [status, msg] of [[403, 'API key not valid'], [400, 'API key not valid. Please pass a valid API key.']]) {
  freshModels(); calls = [];
  try { await enrich('unzerbrechlich', { key: 'K', logger: quiet, fetchImpl: async u => { calls.push(u); return err(status, msg); } }); ok('bad key throws', false); } catch (e) { ok(`bad key (${status}) fails after one call`, /API key/.test(e.message) && calls.length === 1, calls.length); }
}
const [, l15] = freshModels();
r = await enrich('unzerbrechlich', { key: 'K', logger: quiet, fetchImpl: async url => (url.includes('lite') ? gem(J(full)) : gem('', { block: 'SAFETY' })) });
ok('blocked answer → next model', r.model === l15);
try { await enrich('zwei Wörter', { key: 'K', logger: quiet, fetchImpl: async () => gem('{}') }); ok('multi-word rejected', false); } catch (e) { ok('multi-word rejected', e.status === 400); }

// ---- 12. regenerate one section: no split re-check, prompt keeps ids
freshModels(); calls = [];
r = await enrich('entfernt', { key: 'K', logger: quiet, section: 'examples', draft: normalize(fixture, 'entfernt'), fetchImpl: async (u, opt) => { calls.push(JSON.parse(opt.body)); return gem(J(fixture)); } });
ok('section regenerate: one call, higher temperature', calls.length === 1 && calls[0].generationConfig.temperature === 0.7 && r.section === 'examples');
const p = buildPrompt('entfernt', 'examples', normalize(fixture, 'entfernt'));
ok('section prompt', /Regenerate ONLY the "examples"/.test(p) && /Das Hotel liegt/.test(p) && /"m2"/.test(p));
ok('formation section covers morphemes and chain', /"morphemes" list and the "derivation" list/.test(buildPrompt('entfernt', 'formation', normalize(fixture, 'entfernt'))));

// ---- 13. tolerant JSON reader
ok('fences and prose around the object', parseJsonLoose('Here you go:\n```json\n{"a":1}\n```\nBye').value.a === 1);
ok('trailing commas', parseJsonLoose('{"a":[1,2,],"b":{"c":1,},}').repaired === 'commas');
const cut = parseJsonLoose('{"word":"x","meanings":[{"id":"m1","gloss":"g","examples":[{"de":"A","en":"B"},{"de":"C","e');
ok('cut-off answer keeps what was complete', cut.repaired === 'truncated' && cut.value.meanings[0].examples.length === 1 && cut.value.meanings[0].gloss === 'g', J(cut.value));
ok('braces inside strings do not confuse it', parseJsonLoose('{"a":"x } y","b":[{"c":"{"}]}').value.b[0].c === '{');
let threw = false; try { parseJsonLoose('no json here'); } catch { threw = true; }
ok('no object → error', threw);

// ---- 14. checks on the split and the chain
const mk = (morphemes, derivation, formation = BASE.formation, word = 'unzerbrechlich') => ({ word, formation, morphemes: readMorphemes(morphemes), derivation });
ok('correct split: no issues', J(morphIssues(mk(FULL_M, FULL_D))) === '{"hard":[],"soft":[]}', J(morphIssues(mk(FULL_M, FULL_D))));
ok('forms must spell the word', morphIssues(mk(bad.morphemes, FULL_D)).hard.length === 1);
ok('root that still holds a prefix', morphIssues(mk([{ form: 'un', type: 'prefix' }, { form: 'zerbrech', type: 'root' }, { form: 'lich', type: 'suffix' }], FULL_D)).soft.some(x => /zer \+ brech/.test(x)));
ok('chain must end with the word', morphIssues(mk(FULL_M, ['brechen', 'zerbrechen'])).soft.some(x => /must end/.test(x)));
ok('chain steps must be related', morphIssues(mk(FULL_M, ['brechen', 'Haus', 'zerbrechlich', 'unzerbrechlich'])).soft.some(x => /not one derivation step/.test(x)));
ok('ablaut step accepted (stehen → verständlich)', morphIssues(mk([{ form: 'un', type: 'prefix' }, { form: 'ver', type: 'prefix' }, { form: 'ständ', type: 'root', lemma: 'stehen' }, { form: 'lich', type: 'suffix' }], ['stehen', 'verstehen', 'verständlich', 'unverständlich'], { kind: 'prefix', parts: ['un', 'verständlich'], affix: 'un' }, 'unverständlich')).soft.length === 0);
ok('real roots are not suspected (gewöhn, ernst, erb)', ['gewöhn', 'ernst', 'erb', 'brech', 'antwort'].every(t => !globalThis.MORPH.looksUnsplit(t) && !globalThis.MORPH.finer(t)));
ok('type names from the model are mapped', J(readMorphemes([{ form: 'ge', type: 'prefix' }, { form: '-s-', type: 'Fugenelement' }, { form: 'reg', type: 'stem' }]).map(m => m.k)) === '["ge","linking","root"]');
const simple = finishMorph({ word: 'sicher', formation: { kind: 'simple', parts: ['sicher'], affix: '' }, morphemes: [], derivation: ['sicher'], uncertain: [] });
ok('simple word: one root, no chain', blocks(simple) === 'sicher' && simple.derivation.length === 0);

// ---- 15. older checks kept
const b2 = JSON.parse(J(fixture)); b2.meanings[1].examples.push({ de: 'Bitte entfernen Sie den Aufkleber.', en: 'x', context: 'work' });
ok('verb sentence flagged', normalize(b2, 'entfernt').meanings[1].examples.at(-1).check === true);
ok('comparative accepted', containsAdj('Das ist am entferntesten.', 'entfernt') && containsAdj('ein entfernterer Ort', 'entfernt'));
const wp = JSON.parse(J(fixture)); wp.formation.parts = ['ent', 'fernt', 'x'];
ok('wrong first split dropped', normalize(wp, 'entfernt').formation.parts.join('') === 'entfernt');

// ---- 16. the endpoint itself
const res0 = () => { const o = { h: {} }; o.status = c => (o.code = c, o); o.json = b => (o.body = b, o); o.setHeader = (k, v) => { o.h[k] = v; }; return o; };
for (const k of ['SYNC_KEY', 'VERB_SYNC_SECRET', 'GEMINI_API_KEY', 'VITE_GEMINI_API_KEY']) delete process.env[k];
let res = res0(); await handler({ method: 'POST', headers: {}, body: { word: 'entfernt' } }, res); ok('no sync key → 503', res.code === 503);
process.env.SYNC_KEY = 's';
res = res0(); await handler({ method: 'POST', headers: { 'x-sync-key': 'x' }, body: { word: 'entfernt' } }, res); ok('wrong key → 401', res.code === 401);
res = res0(); await handler({ method: 'POST', headers: { 'x-sync-key': 's' }, body: { word: 'entfernt' } }, res); ok('no Gemini key → 503', res.code === 503 && res.body.error === 'ai not configured');
res = res0(); await handler({ method: 'GET', headers: { 'x-sync-key': 's' } }, res); ok('GET → 405', res.code === 405);
process.env.GEMINI_API_KEY = 'G';
const realFetch = globalThis.fetch, realLog = console.log; console.log = () => {};
freshModels(); globalThis.fetch = async () => gem(J(full));
res = res0(); await handler({ method: 'POST', headers: { 'x-sync-key': 's' }, body: J({ word: 'unzerbrechlich' }) }, res);
ok('endpoint 200 with split, chain and attempts', res.code === 200 && res.body.ok && res.body.data.morphemes.length === 4 && res.body.data.derivation.length === 4 && Array.isArray(res.body.attempts) && !res.body.trail);
freshModels(); globalThis.fetch = async () => gem('not json');
res = res0(); await handler({ method: 'POST', headers: { 'x-sync-key': 's' }, body: { word: 'unzerbrechlich' } }, res);
ok('endpoint error says what each attempt returned', res.code === 502 && /valid JSON/.test(res.body.error) && res.body.attempts.length === 4 && /invalid JSON/.test(res.body.attempts[0]), J(res.body));
freshModels(); globalThis.fetch = async () => err(429, 'quota');
res = res0(); await handler({ method: 'POST', headers: { 'x-sync-key': 's' }, body: { word: 'entfernt' } }, res); ok('endpoint 429 + Retry-After', res.code === 429 && res.h['Retry-After'] === '17');
globalThis.fetch = realFetch; console.log = realLog;

console.log(fail ? `${fail} of ${n} FAILED` : `all ${n} endpoint checks passed`);
process.exit(fail ? 1 : 0);
