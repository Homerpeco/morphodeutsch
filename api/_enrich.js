// MorphoDeutsch AI enrichment (Gemini). Shared code, not an endpoint (files starting with _ are ignored by Vercel).
// Turns one adjective into a reviewable learning object: meanings, typed word family, formation,
// meaning-linked synonyms/antonyms, collocations, nouns, prepositions, examples, grammar, uncertainty notes.

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
10. "partner": only for participle adjectives whose Partizip I/II counterpart is really used as an adjective and the contrast helps (aufregend / aufgeregt); otherwise "".
11. "uncertain": list anything ambiguous (a form that may be rare, a regional sense, an unsure classification). Empty list if nothing.
12. If "${word}" is not an adjective or is misspelled, set "isAdjective": false and explain in "uncertain".
Return only JSON, exactly in this shape:
${SHAPE}`;
}

const SECTION_TEXT = {
  formation: 'the "formation" object',
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
  return { word: w, isAdjective: d.isAdjective !== false, formation, meanings, family, partner, grammar, uncertain: uniq(uncertain) };
}
function uniq(a) { const s = new Set(); return a.filter(x => { const k = lc(x); if (!x || s.has(k)) return false; s.add(k); return true; }); }
function uniqBy(a, k) { const s = new Set(); return a.filter(x => { const v = lc(x[k]); if (s.has(v)) return false; s.add(v); return true; }); }

export function parseJson(text) {
  let t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  try { return JSON.parse(t); } catch { throw new EnrichError('Gemini did not return valid JSON'); }
}

function retryDelay(json, headers) {
  const h = headers && headers.get && headers.get('retry-after');
  if (h && !isNaN(Number(h))) return Number(h);
  for (const d of (json && json.error && json.error.details) || []) {
    const m = /([\d.]+)s/.exec((d && d.retryDelay) || '');
    if (m) return Math.ceil(Number(m[1]));
  }
  return 60;
}

export async function enrich(wordRaw, { section = 'all', draft = null, fetchImpl = fetch, key, budgetMs = 52000 } = {}) {
  if (!key) throw new EnrichError('No Gemini key in the Vercel project.', { status: 503 });
  const word = lc(String(wordRaw || '').trim());
  if (!/^[a-zäöüß-]{2,40}$/.test(word)) throw new EnrichError('Enter a single German word.', { status: 400 });
  const sec = SECTIONS.includes(section) ? section : 'all';
  const body = {
    contents: [{ role: 'user', parts: [{ text: buildPrompt(word, sec, draft) }] }],
    generationConfig: { temperature: sec === 'all' ? 0.25 : 0.7, responseMimeType: 'application/json' },
  };
  const started = Date.now();
  let last = null, quota = null;
  for (const model of enrichModels()) {
    const left = budgetMs - (Date.now() - started);
    if (left < 8000) break;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), Math.min(45000, left));
    try {
      const res = await fetchImpl(`${API}/models/${model}:generateContent`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body), signal: ctl.signal,
      });
      let json = null;
      try { json = await res.json(); } catch { /* not JSON */ }
      if (!res.ok) {
        const msg = (json && json.error && json.error.message) || 'HTTP ' + res.status;
        if (res.status === 401 || res.status === 403) throw new EnrichError('Gemini rejected the API key: ' + msg, { status: 502 });
        if (res.status === 429) { quota = new EnrichError('Gemini quota reached: ' + msg, { status: 429, retryAfter: retryDelay(json, res.headers) }); continue; }
        last = new EnrichError(`Gemini ${res.status}: ${msg}`);
        continue;
      }
      const parts = (json && json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts) || [];
      const text = parts.filter(p => p && !p.thought && typeof p.text === 'string').map(p => p.text).join('');
      if (!text) { last = new EnrichError('Gemini answered without text'); continue; }
      const data = normalize(parseJson(text), word);
      if (!data.meanings.length && sec === 'all') { last = new EnrichError('Gemini returned no meanings'); continue; }
      return { data, model, section: sec };
    } catch (e) {
      if (e instanceof EnrichError && /API key/.test(e.message)) throw e;
      last = e instanceof EnrichError ? e : new EnrichError(e && e.name === 'AbortError' ? 'Gemini took too long to answer' : 'Gemini request failed: ' + ((e && e.message) || e), { status: 504 });
    } finally { clearTimeout(timer); }
  }
  throw quota || last || new EnrichError('Gemini failed');
}
