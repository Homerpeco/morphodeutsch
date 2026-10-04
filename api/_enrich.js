// MorphoDeutsch AI enrichment (Gemini). Shared code, not an endpoint (files starting with _ are ignored by Vercel).
// Turns one adjective into a reviewable learning object: meanings, typed word family, formation,
// meaning-linked synonyms/antonyms, collocations, nouns, prepositions, examples, grammar, uncertainty notes.

import '../morph.js';   // shared, confirmed morpheme splitter (sets globalThis.MORPH); the app loads the same file

const MORPH = globalThis.MORPH;
const API = 'https://generativelanguage.googleapis.com/v1beta';
export const SECTIONS = ['all', 'formation', 'relations', 'examples', 'collocations', 'family', 'grammar'];

export function enrichModels() {
  const env = (process.env.ENRICH_MODELS || '').split(',').map(s => s.trim()).filter(Boolean);
  // -latest aliases work on Tolomeo's key; the full Flash model first because accuracy matters more than speed here.
  return env.length ? env : ['gemini-flash-latest', 'gemini-flash-lite-latest'];
}

export class EnrichError extends Error {
  constructor(message, { status = 502, retryAfter = 0 } = {}) { super(message); this.status = status; this.retryAfter = retryAfter; }
}

const SHAPE = `{
 "word": "<the adjective, lowercase>",
 "isAdjective": true,
 "formation": {"kind": "suffix|prefix|p1|p2|compound|simple", "base": "<base word: noun with article, verb infinitive, or adjective>", "affix": "<building element without hyphen, e.g. lich, ig, bar, voll, los, fähig, un, or p1 / p2 for participles, '' for simple>", "parts": ["<lowercase pieces that spell the adjective exactly when joined>"], "change": "<spelling change such as 'a → ä', else ''>", "explanation": "<one or two English sentences>", "confidence": "high|medium|low"},
 "morphemes": [{"form": "<piece exactly as written in the word, lowercase>", "type": "prefix|root|suffix|linking|ge", "gloss": "<short English meaning of the piece>", "lemma": "<for a root: its dictionary word, e.g. brechen; else ''>"}],
 "derivation": ["<root word>", "<each later word adds ONE affix>", "<the adjective itself>"],
 "meanings": [
  {"id": "m1", "gloss": "<short English meaning>", "register": "common|formal|informal|literary|technical|context-dependent", "note": "<optional short English usage note>",
   "collocations": ["<German collocation with correct ending, e.g. 'ein entfernter Ort'>"],
   "synonyms": [{"w": "<German>", "note": "<optional English nuance>", "confidence": "high|medium|low"}],
   "antonyms": [{"w": "<German>", "note": "<optional English nuance>", "confidence": "high|medium|low"}],
   "nouns": ["<typical noun, e.g. 'der Ort, -e'>"],
   "prepositions": [{"p": "<preposition>", "case": "A|D|G", "pattern": "<e.g. 'weit entfernt von + Dat.'>", "de": "<German example>", "en": "<English translation>"}],
   "examples": [{"de": "<German sentence>", "en": "<English translation>", "context": "everyday|work|study"}]
  }
 ],
 "family": [{"w": "<German word, nouns with article>", "type": "direct|derived|compound|semantic", "gloss": "<English>", "meaning": "<meaning id it belongs to, or ''>", "confidence": "high|medium|low", "note": "<optional>"}],
 "partner": {"w": "<matching Partizip I/II adjective, or ''>", "note": "<why the contrast matters, or ''>"},
 "grammar": {"predicative": "<German example>", "attributive": "<German example with ending>", "comparison": "<comparative and superlative, or 'not usually compared'>", "notes": ["<short English notes: verb patterns, prepositions and case, register>"]},
 "uncertain": ["<short English note on anything the learner should confirm>"]
}`;

function rules(word) {
  return `You are an expert German lexicographer. Build a learning object for the German adjective "${word}" for a learner at B2 level. All explanations, glosses and notes are in English; German appears only in German words, collocations and example sentences.

Accuracy rules. They matter more than completeness:
1. Include only words that exist in standard German and that you are confident about. Never invent word-family members or rare forms. If a form is rare or questionable, leave it out, or include it with confidence "low" and say why in "note".
2. Family "type": "direct" = the base word and words sharing the same stem directly (e.g. entfernen, die Entfernung); "derived" = formed from the word or its base with an affix (e.g. entfernbar); "compound" = compound words containing the stem (e.g. die Entfernungspauschale); "semantic" = related in meaning only, not in form. Synonyms and antonyms do NOT go into "family". Do not list "${word}" itself.
3. If the adjective has more than one distinct meaning, create one meaning group per meaning (at most 4), most common first, ids m1, m2, ... Never mix meanings: every collocation, synonym, antonym, noun, preposition and example goes into the meaning it belongs to. One meaning group is fine when the word has only one meaning.
4. Synonyms and antonyms must fit that specific meaning: 2 to 5 each when good ones exist, otherwise an empty list.
5. Examples: 2 or 3 per meaning, natural German at B1 to B2 level, mixing everyday life with work or study. The adjective must be used AS AN ADJECTIVE: attributive with an ending, predicative after sein/werden/bleiben/wirken, or adverbially. Never as a finite verb, an imperative, or part of a passive or perfect verb form. Give a natural English translation.
6. Collocations: 3 to 5 common combinations per meaning, with correct adjective endings.
7. Nouns: 2 to 4 typical nouns per meaning in the form "der Ort, -e" (article, singular, plural suffix; "¨-e" for umlaut plurals, "-" when the plural is unchanged).
8. Prepositions only if the adjective really governs one in that meaning, with case A, D or G. The example must contain the preposition as a separate word, not contracted with the article (write "von dem", "zu der" only if natural; prefer examples like "weit von hier entfernt").
9. Formation: "parts" joined must spell exactly "${word}" in lowercase. Partizip II adjectives: kind "p2", affix "p2", base = infinitive, parts e.g. ["entfern","t"] or ["auf","ge","reg","t"]. Partizip I: kind "p1", affix "p1", parts [infinitive, "d"]. Suffix adjectives: kind "suffix", affix = the suffix, parts [stem, (linking s), suffix]. Prefix adjectives such as un-: kind "prefix". No derivation: kind "simple", parts ["${word}"].
10. "morphemes": split "${word}" completely, down to the root. One entry per piece, in order; the "form" values joined must spell exactly "${word}". The first split in "formation" stops at the last step (un + zerbrechlich); "morphemes" goes all the way (un, zer, brech, lich). Types: "prefix" (un, in, be, ent, er, ver, zer, miss, ab, an, auf, aus, ein, vor, zu ...), "root" (the core; it must NOT still contain a prefix or a suffix; put its dictionary word in "lemma": form "brech" → lemma "brechen", form "ständ" → lemma "stehen"), "suffix" (lich, bar, ig, isch, sam, los, voll, ung, heit, keit, schaft ..., and the participle endings t, en, d), "linking" (the linking s or n between two parts), "ge" (the ge of a Partizip II). List stacked prefixes separately (un + zer, un + be, un + ver, zu + ver). A compound has two roots. Do not split fossilised words that a learner would not recognise as built from parts (Gefahr, gesund, genau stay whole).
11. "derivation": the chain from the root word to "${word}". Each step adds exactly ONE affix, every step is a real German word, the last step is "${word}".
    Worked example for "unverständlich": "morphemes": [{"form":"un","type":"prefix","gloss":"not","lemma":""},{"form":"ver","type":"prefix","gloss":"(verb prefix)","lemma":""},{"form":"ständ","type":"root","gloss":"stand","lemma":"stehen"},{"form":"lich","type":"suffix","gloss":"-able","lemma":""}], "derivation": ["stehen","verstehen","verständlich","unverständlich"].
12. "partner": only for participle adjectives whose Partizip I/II counterpart is really used as an adjective and the contrast helps (aufregend / aufgeregt); otherwise "".
13. "uncertain": list anything ambiguous (a form that may be rare, a regional sense, an unsure classification). Empty list if nothing.
14. If "${word}" is not an adjective or is misspelled, set "isAdjective": false and explain in "uncertain".
Return only JSON, exactly in this shape:
${SHAPE}`;
}

const SECTION_TEXT = {
  formation: 'the "formation" object, the "morphemes" list and the "derivation" list',
  relations: 'the "synonyms" and "antonyms" of every meaning',
  examples: 'the "examples" of every meaning',
  collocations: 'the "collocations" and "nouns" of every meaning',
  family: 'the "family" list',
  grammar: 'the "grammar" object',
};

export function buildPrompt(word, section, draft) {
  let p = rules(word);
  if (section && section !== 'all' && draft) {
    const avoid = collectForAvoid(section, draft);
    p += `\n\nThe learner already has this analysis:\n${JSON.stringify(slimDraft(draft))}\n\nRegenerate ONLY ${SECTION_TEXT[section]} with fresh, different, equally accurate content. Keep every meaning id and gloss exactly as given. ${avoid.length ? 'Do not repeat these items: ' + avoid.slice(0, 40).map(x => JSON.stringify(x)).join(', ') + '.' : ''} Return the full JSON shape; everything outside that part may be copied unchanged.`;
  }
  return p;
}
function slimDraft(d) {
  return {
    word: d.word, formation: d.formation,
    meanings: (d.meanings || []).map(m => ({ id: m.id, gloss: m.gloss, register: m.register })),
    family: (d.family || []).map(f => ({ w: f.w, type: f.type })),
  };
}
function collectForAvoid(section, d) {
  const ms = d.meanings || [];
  if (section === 'relations') return ms.flatMap(m => [...(m.synonyms || []), ...(m.antonyms || [])].map(x => x.w || x));
  if (section === 'examples') return ms.flatMap(m => (m.examples || []).map(x => x.de || x));
  if (section === 'collocations') return ms.flatMap(m => [...(m.collocations || []), ...(m.nouns || [])].map(x => x.t || x));
  if (section === 'family') return (d.family || []).map(f => f.w);
  return [];
}

/* ---------- validation ---------- */
const S = (x, n = 200) => String(x == null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, n);
const CONF = new Set(['high', 'medium', 'low']);
const conf = c => (CONF.has(c) ? c : 'medium');
const KINDS = new Set(['suffix', 'prefix', 'p1', 'p2', 'compound', 'simple']);
const TYPES = new Set(['direct', 'derived', 'compound', 'semantic']);
const REG = new Set(['common', 'formal', 'informal', 'literary', 'technical', 'context-dependent']);
const CTX = new Set(['everyday', 'work', 'study']);
const lc = s => String(s || '').toLocaleLowerCase('de-DE');

// does the sentence contain the adjective (any ending, or comparative/superlative)?
export function containsAdj(sentence, word) {
  const w = lc(word);
  let stem = w;
  if (/[^e]el$/.test(w) && w.length > 4) stem = w.slice(0, -2) + 'l';
  if (/(au|eu)er$/.test(w)) stem = w.slice(0, -2) + 'r';
  return (sentence.match(/[A-Za-zÄÖÜäöüß-]+/g) || []).some(t => {
    const l = lc(t);
    if (l === w) return true;
    if (!l.startsWith(stem)) return false;
    return /^(e|en|er|es|em|ere|eren|erer|eres|erem|st|ste|sten|ster|stes|stem|este|esten|ester|estes|estem)?$/.test(l.slice(stem.length));
  });
}

export function normalize(raw, word) {
  const w = lc(word);
  const d = raw && typeof raw === 'object' ? raw : {};
  const uncertain = (Array.isArray(d.uncertain) ? d.uncertain : []).map(x => S(x, 240)).filter(Boolean).slice(0, 8);
  const f = d.formation || {};
  let parts = Array.isArray(f.parts) ? f.parts.map(p => lc(S(p, 40))).filter(Boolean) : [];
  const kind = KINDS.has(f.kind) ? f.kind : 'simple';
  if (parts.join('') !== w) {
    if (parts.length) uncertain.push('The suggested building blocks did not spell the word, so they were left out.');
    parts = [w];
  }
  const formation = {
    kind, base: S(f.base, 60), affix: S(f.affix, 20).replace(/^-|-$/g, ''), parts, change: S(f.change, 40),
    explanation: S(f.explanation, 400), confidence: conf(f.confidence),
  };
  if (kind === 'p1' || kind === 'p2') formation.affix = kind;
  if (kind === 'simple') { formation.affix = ''; formation.parts = [w]; }

  const rel = x => {
    const o = typeof x === 'string' ? { w: x } : (x || {});
    const ww = S(o.w, 50);
    return ww && lc(ww) !== w ? { w: ww, note: S(o.note, 160), confidence: conf(o.confidence) } : null;
  };
  const seenM = new Set();
  const meanings = (Array.isArray(d.meanings) ? d.meanings : []).slice(0, 4).map((m, i) => {
    let id = S(m && m.id, 8) || 'm' + (i + 1);
    if (seenM.has(id)) id = 'm' + (i + 1) + 'x';
    seenM.add(id);
    const examples = (Array.isArray(m.examples) ? m.examples : []).slice(0, 5).map(e => {
      const de = S(e && (e.de || e.german), 260), en = S(e && (e.en || e.english), 260);
      return de ? { de, en, context: CTX.has(e.context) ? e.context : 'everyday', check: !containsAdj(de, w) } : null;
    }).filter(Boolean);
    return {
      id, gloss: S(m.gloss, 120), register: REG.has(m.register) ? m.register : 'common', note: S(m.note, 240),
      collocations: uniq((Array.isArray(m.collocations) ? m.collocations : []).map(x => S(x, 80))).slice(0, 6),
      synonyms: uniqBy((Array.isArray(m.synonyms) ? m.synonyms : []).map(rel).filter(Boolean), 'w').slice(0, 6),
      antonyms: uniqBy((Array.isArray(m.antonyms) ? m.antonyms : []).map(rel).filter(Boolean), 'w').slice(0, 6),
      nouns: uniq((Array.isArray(m.nouns) ? m.nouns : []).map(x => S(x, 50)).filter(n => /^(der|die|das)\s/i.test(n))).slice(0, 5),
      prepositions: (Array.isArray(m.prepositions) ? m.prepositions : []).slice(0, 3).map(p => ({
        p: lc(S(p && p.p, 15)), c: ['A', 'D', 'G'].includes(p && p.case) ? p.case : (['A', 'D', 'G'].includes(p && p.c) ? p.c : 'D'),
        pattern: S(p && p.pattern, 80), de: S(p && p.de, 240), en: S(p && p.en, 240),
      })).filter(p => p.p && /^[a-zäöü]+$/.test(p.p)),
      examples,
    };
  }).filter(m => m.gloss);
  const ids = new Set(meanings.map(m => m.id));
  const family = uniqBy((Array.isArray(d.family) ? d.family : []).map(x => {
    const ww = S(x && x.w, 60);
    if (!ww || lc(ww) === w) return null;
    return { w: ww, type: TYPES.has(x.type) ? x.type : 'semantic', gloss: S(x.gloss, 120), meaning: ids.has(x.meaning) ? x.meaning : '', confidence: conf(x.confidence), note: S(x.note, 160) };
  }).filter(Boolean), 'w').slice(0, 14);
  const p = d.partner || {};
  const partner = { w: lc(S(typeof p === 'string' ? p : p.w, 40)), note: S(p.note, 200) };
  if (partner.w === w) partner.w = '';
  const g = d.grammar || {};
  const grammar = {
    predicative: S(g.predicative, 200), attributive: S(g.attributive, 200), comparison: S(g.comparison, 120),
    notes: (Array.isArray(g.notes) ? g.notes : []).map(x => S(x, 240)).filter(Boolean).slice(0, 6),
  };
  if (!meanings.length) uncertain.push('No meaning could be analysed. Check the spelling of the word.');
  return { word: w, isAdjective: d.isAdjective !== false, formation, morphemes: readMorphemes(d.morphemes), derivation: readDerivation(d.derivation),
    meanings, family, partner, grammar, uncertain: uniq(uncertain) };
}

/* ---------- morphemes and derivation chain ---------- */
const MTYPE = { prefix: 'prefix', praefix: 'prefix', 'präfix': 'prefix', root: 'root', stem: 'root', base: 'root', stamm: 'root', suffix: 'suffix', ending: 'suffix',
  inflection: 'suffix', linking: 'linking', interfix: 'linking', fuge: 'linking', fugenelement: 'linking', ge: 'ge', circumfix: 'ge' };
export function readMorphemes(list) {
  return (Array.isArray(list) ? list : []).slice(0, 12).map(x => {
    const o = typeof x === 'string' ? { form: x } : (x || {});
    const t = lc(S(o.form || o.t, 30)).replace(/^-+|-+$/g, '');
    let k = MTYPE[lc(S(o.type || o.k, 20))] || 'root';
    if (t === 'ge' && k === 'prefix') k = 'ge';
    return t ? { t, k, gloss: S(o.gloss, 60), lemma: k === 'root' ? S(o.lemma, 40) : '' } : null;
  }).filter(Boolean);
}
export function readDerivation(list) {
  const out = [];
  for (const x of (Array.isArray(list) ? list : []).slice(0, 8)) { const v = S(x, 50); if (v && (!out.length || lc(out[out.length - 1]) !== lc(v))) out.push(v); }
  return out;
}
const stripArt = x => lc(x).replace(/^(der|die|das|sich)\s+/, '');
const fold = x => lc(x).replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');
function sharesStem(a, b) {            // two neighbouring steps of a chain must share at least three letters in a row
  const x = fold(stripArt(a)), y = fold(stripArt(b));
  for (let i = 0; i + 3 <= x.length; i++) if (y.includes(x.slice(i, i + 3))) return true;
  return false;
}
// what is wrong with the split or the chain. hard = cannot be used as it is; soft = worth one more question to the model
export function morphIssues(data) {
  const w = data.word, ms = data.morphemes || [], ch = data.derivation || [];
  const hard = [], soft = [];
  if (!ms.length) hard.push('no morphemes were given');
  else if (ms.map(m => m.t).join('') !== w) hard.push(`the forms spell "${ms.map(m => m.t).join('')}", not "${w}"`);
  else {
    if (!ms.some(m => m.k === 'root')) hard.push('no piece is marked as the root');
    for (const m of ms) {
      if (m.k !== 'root') continue;
      if (m.t.length < 2 || !/[aeiouäöüy]/.test(m.t)) hard.push(`the root "${m.t}" is not a possible root`);
      else {
        const finer = MORPH.finer(m.t);
        if (finer) soft.push(`the root "${m.t}" is not a root yet: it splits into ${finer.map(p => p.t).join(' + ')}. Split it and give every derivation step`);
        else { const why = MORPH.looksUnsplit(m.t); if (why) soft.push(`the root "${m.t}" ${why}: split it further if that is a real prefix or suffix here`); }
      }
    }
  }
  // count the affixes on the fully split word (roots that can be split further are split here first)
  const full = ms.flatMap(m => (m.k === 'root' && MORPH.finer(m.t)) || [m]);
  const affixes = full.filter(m => m.k === 'prefix' || m.k === 'suffix').length;
  if (data.formation.kind !== 'simple' || affixes) {
    if (ch.length < 2) soft.push('the derivation chain is missing');
    else {
      if (lc(ch[ch.length - 1]) !== w) soft.push(`the derivation chain must end with "${w}"`);
      for (let i = 1; i < ch.length; i++) if (!sharesStem(ch[i - 1], ch[i]) && !(i === 1 && ms.some(m => m.k === 'root' && m.lemma && lc(m.lemma) === stripArt(ch[0])))) soft.push(`"${ch[i - 1]}" → "${ch[i]}" is not one derivation step`);
      if (affixes >= 2 && ch.length - 1 > affixes + 1) soft.push('the derivation chain has more steps than the word has affixes');
      if (affixes >= 3 && ch.length - 1 < affixes - 1) soft.push(`the derivation chain skips steps (${affixes} affixes, ${ch.length - 1} step${ch.length === 2 ? '' : 's'}): add one step per affix, starting from the root word`);
    }
  }
  return { hard, soft };
}
// Final form of the split: the model's own pieces when they spell the word, with any root that still holds a
// confirmed prefix or suffix split further; otherwise the confirmed local split of the first split in "formation".
export function finishMorph(data) {
  const w = data.word, f = data.formation;
  const gloss = p => p.gloss || MORPH.glossOf(p) || '';
  let pieces = data.morphemes || [], source = 'ai';
  const usable = pieces.length && pieces.map(m => m.t).join('') === w && pieces.some(m => m.k === 'root') && !pieces.some(m => m.k === 'root' && (m.t.length < 2 || !/[aeiouäöüy]/.test(m.t)));
  if (!usable) { pieces = MORPH.deepen(MORPH.immediate(f.kind, f.parts), f.kind, { affix: f.affix }); source = 'local'; }
  else {
    const out = [];
    for (const m of pieces) {
      const finer = m.k === 'root' ? MORPH.finer(m.t) : null;
      if (finer) { out.push(...finer); source = 'ai+checked'; } else out.push(m);
    }
    pieces = out;
  }
  data.morphemes = pieces.map(p => ({ t: p.t, k: p.k, gloss: gloss(p), lemma: p.k === 'root' ? (p.lemma || '') : '' }));
  data.morphSource = source;
  let ch = (data.derivation || []).filter(x => !/\s/.test(stripArt(x)));
  if (ch.length && lc(ch[ch.length - 1]) !== w) ch = ch.filter(x => lc(x) !== w).concat([w]);
  data.derivation = ch.length >= 2 ? ch : [];
  return data;
}
function uniq(a) { const s = new Set(); return a.filter(x => { const k = lc(x); if (!x || s.has(k)) return false; s.add(k); return true; }); }
function uniqBy(a, k) { const s = new Set(); return a.filter(x => { const v = lc(x[k]); if (s.has(v)) return false; s.add(v); return true; }); }

/* ---------- reading the model's answer ---------- */
// Tolerant JSON reader: code fences, text around the object, trailing commas, and (last resort) an answer that was
// cut off. Returns {value, repaired: '' | 'commas' | 'truncated'} or throws.
export function parseJsonLoose(text) {
  let t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const a = t.indexOf('{');
  if (a < 0) throw new EnrichError('Gemini did not return valid JSON');
  t = t.slice(a);
  const b = t.lastIndexOf('}');
  const whole = b > 0 ? t.slice(0, b + 1) : t;
  try { return { value: JSON.parse(whole), repaired: '' }; } catch { /* try repairs */ }
  const noCommas = whole.replace(/,(\s*[}\]])/g, '$1');
  try { return { value: JSON.parse(noCommas), repaired: 'commas' }; } catch { /* try the cut-off repair */ }
  // cut off: close the answer at the last point where a value had just ended
  const stack = [], safe = [];
  let inStr = false, esc = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') stack.push(c === '{' ? '}' : ']');
    else if (c === '}' || c === ']') { stack.pop(); safe.push([i + 1, stack.slice()]); if (!stack.length) break; }
  }
  for (let k = safe.length - 1; k >= 0 && k >= safe.length - 40; k--) {
    const [end, open] = safe[k];
    const cand = t.slice(0, end).replace(/,\s*$/, '') + open.slice().reverse().join('');
    try { const v = JSON.parse(cand); if (v && typeof v === 'object') return { value: v, repaired: 'truncated' }; } catch { /* earlier point */ }
  }
  throw new EnrichError('Gemini did not return valid JSON');
}
export function parseJson(text) { return parseJsonLoose(text).value; }

function retryDelay(json, headers) {
  const h = headers && headers.get && headers.get('retry-after');
  if (h && !isNaN(Number(h))) return Number(h);
  for (const d of (json && json.error && json.error.details) || []) {
    const m = /([\d.]+)s/.exec((d && d.retryDelay) || '');
    if (m) return Math.ceil(Number(m[1]));
  }
  return 60;
}

/* ---------- response schema (keeps the JSON well-formed; values are still checked in normalize) ---------- */
const str = { type: 'STRING' };
const arr = items => ({ type: 'ARRAY', items });
const obj = (properties, required) => ({ type: 'OBJECT', properties, required: required || Object.keys(properties), propertyOrdering: Object.keys(properties) });
const REL = obj({ w: str, note: str, confidence: str }, ['w']);
const MORPH_PROPS = {
  morphemes: arr(obj({ form: str, type: str, gloss: str, lemma: str }, ['form', 'type'])),
  derivation: arr(str),
};
export const MORPH_SCHEMA = obj(MORPH_PROPS);
export const SCHEMA = obj({
  word: str, isAdjective: { type: 'BOOLEAN' },
  formation: obj({ kind: str, base: str, affix: str, parts: arr(str), change: str, explanation: str, confidence: str }, ['kind', 'parts']),
  ...MORPH_PROPS,
  meanings: arr(obj({
    id: str, gloss: str, register: str, note: str, collocations: arr(str), synonyms: arr(REL), antonyms: arr(REL), nouns: arr(str),
    prepositions: arr(obj({ p: str, case: str, pattern: str, de: str, en: str }, ['p', 'case'])),
    examples: arr(obj({ de: str, en: str, context: str }, ['de', 'en'])),
  }, ['id', 'gloss', 'collocations', 'synonyms', 'antonyms', 'nouns', 'examples'])),
  family: arr(obj({ w: str, type: str, gloss: str, meaning: str, confidence: str, note: str }, ['w', 'type', 'gloss'])),
  partner: obj({ w: str, note: str }),
  grammar: obj({ predicative: str, attributive: str, comparison: str, notes: arr(str) }),
  uncertain: arr(str),
}, ['word', 'isAdjective', 'formation', 'morphemes', 'derivation', 'meanings', 'family', 'grammar', 'uncertain']);

// Request variants, most helpful first. A model that rejects one (HTTP 400) gets the next; the one that works is remembered.
const VARIANTS = [
  { name: 'schema+thinking-low', schema: true, thinking: { thinkingLevel: 'low' } },
  { name: 'schema+thinking-budget', schema: true, thinking: { thinkingBudget: 1024 } },
  { name: 'schema', schema: true },
  { name: 'plain-json' },
];
const variantFor = new Map();      // model → index into VARIANTS (kept while the server instance is warm)
const MAX_TOKENS = 16000, MAX_TOKENS_RETRY = 40000;   // thinking tokens count towards this limit, so it is generous

const sleep = ms => new Promise(r => setTimeout(r, ms));
function morphPrompt(word, prev, issues) {
  return `Split the German adjective "${word}" into its morphemes, all the way down to the root, and give its derivation chain.
Rules:
- "morphemes": one entry per piece, in order; the "form" values joined must spell exactly "${word}" (lowercase).
- Types: "prefix" (un, in, be, ent, er, ver, zer, miss, ab, an, auf, aus, ein, vor, zu ...), "root" (the core; it must NOT still contain a prefix or a suffix; "lemma" = its dictionary word, e.g. form "brech" → "brechen"), "suffix" (lich, bar, ig, isch, sam, los, voll, ung, heit, keit, schaft ..., participle endings t, en, d), "linking" (linking s or n), "ge" (the ge of a Partizip II).
- List stacked prefixes separately (un + zer, un + be, un + ver, zu + ver). Do not split fossilised words a learner would not recognise as built from parts (Gefahr, gesund, genau).
- "gloss": a short English meaning of each piece.
- "derivation": from the root word to "${word}", ONE affix per step, every step a real German word, last step "${word}".
Example for "unverständlich": {"morphemes":[{"form":"un","type":"prefix","gloss":"not","lemma":""},{"form":"ver","type":"prefix","gloss":"(verb prefix)","lemma":""},{"form":"ständ","type":"root","gloss":"stand","lemma":"stehen"},{"form":"lich","type":"suffix","gloss":"-able","lemma":""}],"derivation":["stehen","verstehen","verständlich","unverständlich"]}
${prev ? `A first attempt gave ${JSON.stringify(prev)}. Problems: ${issues.join('; ')}. Correct them; if the first attempt was already right, repeat it.` : ''}
Return only JSON: {"morphemes":[...],"derivation":[...]}`;
}

// One call to Gemini. Walks down the request variants on HTTP 400. Returns {ok, text, finish, status, ms, variant, error, json}.
async function callModel({ model, prompt, temperature, schema, maxTokens, key, fetchImpl, timeoutMs, log }) {
  let vi = variantFor.get(model) || 0;
  for (;;) {
    const v = VARIANTS[vi];
    const generationConfig = { temperature, responseMimeType: 'application/json', maxOutputTokens: maxTokens };
    if (v.schema && schema) generationConfig.responseSchema = schema;
    if (v.thinking) generationConfig.thinkingConfig = v.thinking;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    const t0 = Date.now();
    try {
      const res = await fetchImpl(`${API}/models/${model}:generateContent`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig }), signal: ctl.signal,
      });
      let json = null;
      try { json = await res.json(); } catch { /* not JSON */ }
      const ms = Date.now() - t0;
      const errMsg = (json && json.error && json.error.message) || '';
      if (res.status === 400 && vi < VARIANTS.length - 1 && !/api key/i.test(errMsg)) {     // this model does not take this request shape: try a simpler one
        log({ model, variant: v.name, status: 400, ms, note: ((json && json.error && json.error.message) || '').slice(0, 200) });
        vi++; continue;
      }
      if (!res.ok) return { ok: false, status: res.status, ms, variant: v.name, json, headers: res.headers, error: (json && json.error && json.error.message) || 'HTTP ' + res.status };
      variantFor.set(model, vi);
      const cand = (json && json.candidates && json.candidates[0]) || {};
      const parts = (cand.content && cand.content.parts) || [];
      const text = parts.filter(p => p && !p.thought && typeof p.text === 'string').map(p => p.text).join('');
      const block = json && json.promptFeedback && json.promptFeedback.blockReason;
      return { ok: true, status: 200, ms, variant: v.name, text, finish: block ? 'BLOCKED:' + block : (cand.finishReason || ''), usage: json && json.usageMetadata };
    } catch (e) {
      return { ok: false, status: 0, ms: Date.now() - t0, variant: v.name, error: e && e.name === 'AbortError' ? 'timeout' : 'request failed: ' + ((e && e.message) || e) };
    } finally { clearTimeout(timer); }
  }
}

export async function enrich(wordRaw, { section = 'all', draft = null, fetchImpl = fetch, key, budgetMs = 52000, logger = console } = {}) {
  if (!key) throw new EnrichError('No Gemini key in the Vercel project.', { status: 503 });
  const word = lc(String(wordRaw || '').trim());
  if (!/^[a-zäöüß-]{2,40}$/.test(word)) throw new EnrichError('Enter a single German word.', { status: 400 });
  const sec = SECTIONS.includes(section) ? section : 'all';
  const prompt = buildPrompt(word, sec, draft);
  const temperature = sec === 'all' ? 0.25 : 0.7;
  const started = Date.now();
  const left = () => budgetMs - (Date.now() - started);
  const trail = [];                                   // one line per attempt: what happened (also sent to the app on failure)
  const log = entry => { trail.push(entry); try { logger.log('[enrich]', JSON.stringify({ word, section: sec, ...entry })); } catch { /* logging must never break the request */ } };
  const fail = (message, opts) => { const e = new EnrichError(message, opts); e.trail = trail; return e; };
  let last = null, quota = null, salvage = null;

  for (const model of enrichModels()) {
    let maxTokens = MAX_TOKENS;
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (left() < 9000) break;
      const r = await callModel({ model, prompt, temperature, schema: SCHEMA, maxTokens, key, fetchImpl, timeoutMs: Math.min(34000, left() - 3000), log });
      const base = { model, variant: r.variant, attempt, status: r.status, ms: r.ms };
      if (!r.ok) {
        log({ ...base, note: String(r.error).slice(0, 200) });
        if (r.status === 401 || r.status === 403 || /api key/i.test(String(r.error))) throw fail('Gemini rejected the API key: ' + r.error, { status: 502 });
        if (r.status === 429) { quota = fail('Gemini quota reached: ' + r.error, { status: 429, retryAfter: retryDelay(r.json, r.headers) }); break; }
        last = fail(r.error === 'timeout' ? 'Gemini took too long to answer' : (r.status ? `Gemini ${r.status}: ${r.error}` : 'Gemini ' + r.error), { status: r.status ? 502 : 504 });
        if (r.status >= 500 && attempt === 1) { await sleep(900); continue; }      // overloaded: one more try, then the next model
        break;
      }
      const cut = r.finish === 'MAX_TOKENS';
      if (/^BLOCKED|SAFETY|RECITATION|PROHIBITED|SPII|BLOCKLIST/.test(r.finish)) { log({ ...base, finish: r.finish, note: 'answer blocked' }); last = fail('Gemini blocked the answer (' + r.finish + ')'); break; }
      if (!r.text) { log({ ...base, finish: r.finish, usage: r.usage, note: 'no text' }); last = fail(cut ? 'Gemini ran out of output tokens before answering' : 'Gemini answered without text'); maxTokens = MAX_TOKENS_RETRY; continue; }
      let parsed = null;
      try { parsed = parseJsonLoose(r.text); } catch { /* handled below */ }
      if (!parsed || parsed.repaired === 'truncated') {
        // show what actually came back: this is what to look at in the Vercel logs
        log({ ...base, finish: r.finish, usage: r.usage, chars: r.text.length, note: parsed ? 'answer was cut off' : 'invalid JSON', head: r.text.slice(0, 240), tail: r.text.slice(-240) });
        if (parsed) { const d = normalize(parsed.value, word); if (d.meanings.length && (!salvage || d.meanings.length > salvage.data.meanings.length)) salvage = { data: d, model }; }
        last = fail(parsed || cut ? 'Gemini’s answer was cut off' : 'Gemini did not return valid JSON');
        maxTokens = MAX_TOKENS_RETRY; continue;
      }
      const data = normalize(parsed.value, word);
      if (!data.meanings.length && sec === 'all') { log({ ...base, finish: r.finish, note: 'no meanings' }); last = fail('Gemini returned no meanings'); continue; }
      log({ ...base, finish: r.finish, usage: r.usage, note: parsed.repaired ? 'ok (repaired: ' + parsed.repaired + ')' : 'ok' });
      if (sec === 'all' || sec === 'formation') await checkMorph(data, { model, key, fetchImpl, left, log });
      return { data, model, section: sec, trail };
    }
  }
  if (salvage && !quota) {                             // better a partly complete analysis to review than none
    salvage.data.uncertain.push('The AI answer was cut off, so some sections may be missing. Use “Analyse again” if something is missing.');
    if (sec === 'all' || sec === 'formation') finishMorph(salvage.data);
    return { data: salvage.data, model: salvage.model, section: sec, trail, partial: true };
  }
  throw quota || last || fail('Gemini failed');
}

// Check the split and the chain; ask once more (a small, fast question) if something is off; then fix what can be confirmed.
async function checkMorph(data, { model, key, fetchImpl, left, log }) {
  let issues = morphIssues(data);
  if ((issues.hard.length || issues.soft.length) && left() > 14000) {
    const prev = { morphemes: data.morphemes.map(m => ({ form: m.t, type: m.k })), derivation: data.derivation };
    const r = await callModel({ model, prompt: morphPrompt(data.word, prev, [...issues.hard, ...issues.soft]), temperature: 0.1, schema: MORPH_SCHEMA, maxTokens: 6000, key, fetchImpl, timeoutMs: Math.min(15000, left() - 4000), log });
    let note = 'split re-check failed';
    if (r.ok && r.text) {
      try {
        const v = parseJsonLoose(r.text).value;
        const next = { ...data, morphemes: readMorphemes(v.morphemes), derivation: readDerivation(v.derivation) };
        const ni = morphIssues(next);
        if (!ni.hard.length && ni.hard.length + ni.soft.length <= issues.hard.length + issues.soft.length) { data.morphemes = next.morphemes; data.derivation = next.derivation; issues = ni; note = 'split re-checked'; }
        else note = 'split re-check not better';
      } catch { /* keep the first answer */ }
    }
    log({ model, variant: r.variant, status: r.status, ms: r.ms, note });
  }
  finishMorph(data);
  const after = morphIssues(data);
  if (after.soft.length) data.uncertain = uniq([...data.uncertain, 'Check the building blocks and the derivation chain: ' + after.soft.join('; ') + '.']);
  return data;
}

// the attempts in one readable line each (shown under the error in the app, and useful in a bug report)
export function trailText(trail) {
  return (trail || []).slice(-8).map(t => `${t.model}${t.variant ? ' [' + t.variant + ']' : ''}: ${t.note || ''}${t.finish && t.finish !== 'STOP' ? ' (' + t.finish + ')' : ''}${t.status && t.status !== 200 ? ' HTTP ' + t.status : ''}${t.ms ? ', ' + (t.ms / 1000).toFixed(1) + ' s' : ''}`);
}
