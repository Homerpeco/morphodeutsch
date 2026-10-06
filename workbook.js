/* MorphoDeutsch — Workbook: Wortbildung der Adjektive.
   Worksheets laid out like a printed exercise: base word → gap + noun. The adjective is typed with its ending,
   and every answer comes back with its rule (element, signal, joint, ending, words of the same pattern).
   Loaded after app.js and uses its globals (DB, G, save, toast, esc, speakBtn, openSheet, ACT, route, …).
   Progress lives in DB.wb and syncs with the rest; the sheet in progress is kept per device in localStorage. */
'use strict';

const WB_KEY = 'morphodeutsch_wb_v1';
const WB_LINK = /^(s|es|n|en|e|er|ent|d|t|or)$/;          // a piece between base and suffix: shown as a linking element
const WB_ENDS = ['', 'e', 'en', 'er', 'es', 'em'];
const WB_SUFS = ['mäßig','gemäß','fähig','reich','frei','haft','lich','isch','abel','ibel','iell','voll','wert','iös','ell','bar','sam','los','ial','ös','al','iv','ig'];
const WB_SUF_FAMILY = {iell:'ell', ell:'ell', ial:'al', al:'al', 'iös':'ös', 'ös':'ös', abel:'abel', ibel:'abel'};
const WB_PRES = ['miss','des','non','dis','un','in','im','il','ir','de','a'];
const WB_GROUPS = [
  {id:'suffix', title:'Suffixes', blurb:'From a noun or a verb to an adjective.'},
  {id:'pairs', title:'Same base, different suffix', blurb:'Two adjectives from one word, with two meanings.'},
  {id:'prefix', title:'Prefixes and opposites', blurb:'Turn an adjective into its opposite.'},
  {id:'bonus', title:'Bonus', blurb:'Not a suffix or a prefix, but part of the same chapter.'}
];

/* ======================= index ======================= */
const WBX = (() => {
  const byId = new Map();
  WB_SETS.forEach((s, i) => {
    s.n = i + 1;
    s.items.forEach(it => {
      it.set = s.id; it.id = s.id + ':' + it.w;
      if (byId.has(it.id)) console.error('MorphoDeutsch workbook: duplicate item', it.id);
      byId.set(it.id, it);
    });
    if (s.example) { s.example.set = s.id; s.example.id = s.id + ':example'; }
  });
  return {byId};
})();
const wbItem = id => WBX.byId.get(id);
const wbSet = id => WB_SETS.find(s => s.id === id);
const wbAll = () => WB_SETS.flatMap(s => s.items);
const wbElem = it => WB_ELEMS[it.el];
const wbBusy = () => currentTab === 'workbook' && !!WBS;      // a sheet is on screen: do not re-render it from outside

/* ======================= forms ======================= */
const wbStem = w => /e$/.test(w) ? w.slice(0, -1) : G.declStem(w);     // müde → müd-, variabel → variabl-
const wbInfl = (w, e) => e ? wbStem(w) + e : w;
function wbNoun(spec){
  const m = /^(der|die|das|pl)\s+(.+)$/.exec(spec || '');
  return m ? {g:{der:'m', die:'f', das:'n', pl:'p'}[m[1]], art:m[1], text:m[2]} : null;
}
// the gap and what stands around it
function wbFrame(it){
  if (it.k === 'T') {
    const [pre, post] = it.s.split('___');
    return {pre:pre.trim(), post:(post || '').trim(), ending:'', answer:it.a, sentence:true};
  }
  const n = wbNoun(it.noun);
  const pre = it.art === 'zero' ? '' : G.ARTICLES[it.art].N[n.g];
  const ending = G.ENDINGS[it.art].N[n.g];
  return {pre, post:n.text, ending, answer:wbInfl(it.w, ending), g:n.g, noun:n};
}
function wbPhrase(it, word){
  const f = wbFrame(it), w = word == null ? f.answer : word;
  return f.sentence ? it.s.replace('___', w) : [f.pre, w, f.post].filter(Boolean).join(' ');
}
// colour roles of the pieces: base | fug | suf | pre
function wbSegs(it){
  const kind = wbElem(it).kind, p = it.parts, n = p.length;
  if (kind === 'prefix') return p.map((t, i) => [t, i === 0 ? 'pre' : 'base']);
  if (kind === 'first') return p.map((t, i) => [t, i === n - 1 ? 'suf' : 'base']);
  return p.map((t, i) => [t, i === n - 1 ? 'suf' : (i > 0 && WB_LINK.test(t) ? 'fug' : 'base')]);
}
// the word as it stands in the phrase: coloured pieces plus the adjective ending
function wbWordHtml(it, ending){
  const seg = wbSegs(it).map(x => x.slice());
  let end = '';
  if (ending) {
    const stem = wbStem(it.w);
    if (stem !== it.w) seg[seg.length - 1][0] = stem.slice(seg.slice(0, -1).map(x => x[0]).join('').length);
    end = `<span class="m-suf2">${esc(ending)}</span>`;
  }
  return `<span class="word">${seg.map(([t, r]) => `<span class="m-${r}">${esc(t)}</span>`).join('')}${end}</span>`;
}
function wbElLabel(id){ const e = WB_ELEMS[id]; return e ? e.form : id; }
function wbElChip(id, n){
  const e = WB_ELEMS[id]; if (!e) return '';
  const cls = e.kind === 'prefix' ? 'pre' : e.kind === 'first' ? 'first' : 'suf';
  return `<button type="button" class="wb-el ${cls}" data-act="wb-rule" data-el="${esc(id)}" title="${esc(e.mean)}">${esc(e.form)}${n != null ? `<span class="n">${n}</span>` : ''}</button>`;
}

/* ======================= progress (DB.wb, synced) ======================= */
function wbRec(id){ return (DB.wb && DB.wb.it && DB.wb.it[id]) || null; }
// res: 1 = right at the first try, 2 = right at the second try, 0 = not known
function wbRecord(id, res){
  if (!DB.wb || typeof DB.wb !== 'object') DB.wb = {it:{}};
  if (!DB.wb.it || typeof DB.wb.it !== 'object') DB.wb.it = {};
  const r = DB.wb.it[id] || {n:0, ok:0, s:0};
  r.n++;
  if (res === 1) { r.ok++; r.s = (r.s || 0) + 1; }
  else if (res === 0) r.s = 0;
  r.r = res; r.t = Date.now();
  DB.wb.it[id] = r;
  DB.log[dateKey()] = (DB.log[dateKey()] || 0) + 1;
  save();
}
// new | missed | learning | known
function wbStatus(id){ const r = wbRec(id); return !r || !r.n ? 'new' : r.r === 0 ? 'missed' : ((r.s || 0) >= 2 ? 'known' : 'learning'); }
function wbCounts(items){
  const c = {new:0, missed:0, learning:0, known:0, total:items.length};
  items.forEach(it => c[wbStatus(it.id)]++);
  return c;
}
// lower comes first: missed, then new, then shaky, then known (longest unseen first)
function wbPrio(it){
  const r = wbRec(it.id);
  if (!r || !r.n) return 1;
  if (r.r === 0) return 0;
  if (r.r === 2 || (r.s || 0) < 2) return 2;
  return 3 + Math.max(0, 1 - (Date.now() - (r.t || 0)) / (30 * DAY));
}
function wbPick(pool, n){
  return shuffle(pool.map(it => ({it, k:wbPrio(it) + Math.random() * 0.9})).sort((a, b) => a.k - b.k).slice(0, n).map(x => x.it.id));
}

/* ======================= sheets (device-local, resumable) ======================= */
let WBST = {sheets:{}};
try { const j = JSON.parse(lsGet(WB_KEY) || '{}'); if (j && j.sheets && typeof j.sheets === 'object') WBST = j; } catch (e) {}
let WBS = null;                      // the sheet on screen
let wbSaveTimer = null;
const wbSaveState = () => lsSet(WB_KEY, JSON.stringify(WBST));
const wbSaveSoon = () => { clearTimeout(wbSaveTimer); wbSaveTimer = setTimeout(wbSaveState, 400); };
const wbFinal = r => !!r && r.st !== 'open';
const wbReviewPool = () => wbAll().filter(it => wbSet(it.set).group !== 'bonus');
function wbValidKey(key){ return !!(wbSet(key) || key === 'review' || (/^el-/.test(key) && WB_ELEMS[key.slice(3)] && wbAll().some(it => it.el === key.slice(3)))); }
function wbDraw(key){
  const set = wbSet(key);
  if (set) return shuffle(set.items.map(it => it.id));
  if (key === 'review') return wbPick(wbReviewPool(), UI.wbSize || 12);
  if (/^el-/.test(key)) return wbPick(wbAll().filter(it => it.el === key.slice(3)), 16);
  return [];
}
function wbNewSheet(key, ids){
  ids = ids || wbDraw(key);
  if (!ids.length) return null;
  const sh = {key, ids, rows:{}, t:Date.now(), mixed: !wbSet(key)};
  ids.forEach(id => { sh.rows[id] = {v:'', st:'open', tries:0, typed:[], ptr:''}; });
  WBST.sheets[key] = sh;
  const keys = Object.keys(WBST.sheets);
  if (keys.length > 8) keys.sort((a, b) => (WBST.sheets[a].t || 0) - (WBST.sheets[b].t || 0)).slice(0, keys.length - 8).forEach(k => delete WBST.sheets[k]);
  wbSaveState();
  return sh;
}
// a sheet in progress is resumed; a finished one is replaced by a fresh one
function wbSheetFor(key){
  const sh = WBST.sheets[key];
  const valid = sh && Array.isArray(sh.ids) && sh.ids.length && sh.rows && sh.ids.every(id => wbItem(id) && sh.rows[id]);
  if (valid && !sh.ids.every(id => wbFinal(sh.rows[id]))) return sh;
  return wbNewSheet(key);
}
function wbSheetProgress(key){
  const sh = WBST.sheets[key];
  if (!sh || !Array.isArray(sh.ids) || !sh.rows) return null;
  const done = sh.ids.filter(id => wbFinal(sh.rows[id])).length;
  return done > 0 && done < sh.ids.length ? {done, total:sh.ids.length} : null;
}

/* ======================= judging an answer ======================= */
const wbNorm = s => translit(cleanAnswer(s));                                   // case, quotes, ä = ae
const wbSame = (a, b) => translit(a) === translit(b);
const wbLoose = (a, b) => wbSame(a, b) || fold(a) === fold(b);                  // also with the umlaut left out or put in
// a trap text starting with ~ is a note about a form that is not a standard word of its own
const wbTrapText = m => String(m || '').replace(/^~/, '');
// "launig means …" with the word in bold; a ~ text stands as it is
function wbTrapHtml(lemma, msg){
  const t = wbTrapText(msg);
  if (/^~/.test(msg)) return esc(t);
  return t.startsWith(lemma + ' ') ? `<b>${esc(lemma)}</b>${esc(t.slice(lemma.length))}` : `<b>${esc(lemma)}</b>: ${esc(t)}`;
}
// someone who types the whole phrase gets the adjective picked out of it
function wbToken(it, raw){
  let t = cleanAnswer(raw);
  if (/\s/.test(t)) {
    const f = wbFrame(it);
    const around = lc(f.sentence ? it.s.replace('___', ' ') : f.pre + ' ' + f.post);
    const drop = new Set(around.split(/[^a-zäöüß]+/).filter(Boolean));
    const rest = t.split(/\s+/).map(w => w.replace(/[.,;:!?]+$/, '')).filter(w => w && !drop.has(w));
    if (rest.length === 1) t = rest[0];
  }
  return t;
}
// → {k: right | ending | trap | joint | elem | pre | same | needsuffix | first | wrong | empty, …}
function wbJudge(it, raw){
  const f = wbFrame(it), el = wbElem(it);
  const t = wbToken(it, raw);                                                    // lower case, as typed
  if (!t) return {k:'empty'};
  if (wbSame(t, f.answer)) return {k:'right'};
  for (const a of it.alts || []) if (wbSame(t, wbInfl(a, f.ending))) return {k:'right', alt:a};
  for (const l of [it.w, ...(it.alts || [])]) {
    const e = WB_ENDS.find(x => wbSame(wbInfl(l, x), t));
    if (e != null) return {k:'ending', lemma:l, got:e};
  }
  for (const l of Object.keys(it.traps || {})) if (WB_ENDS.some(x => wbSame(wbInfl(l, x), t))) return {k:'trap', lemma:l, msg:it.traps[l]};
  // what the dictionary form may have been: the answer as typed, and with an adjective ending taken off
  const cands = [t];
  WB_ENDS.filter(e => e && t.endsWith(e) && t.length - e.length >= 4).sort((a, b) => b.length - a.length).forEach(e => {
    const c = t.slice(0, -e.length);
    cands.push(c);
    if (/[^aeiouäöü]l$/.test(c)) cands.push(c.slice(0, -1) + 'el');           // akzeptabl-er → akzeptabel, dunkl-e → dunkel
  });
  const target = lc(it.w), parts = it.parts.map(lc);
  if (cands.some(c => !wbSame(c, target) && fold(c) === fold(target))) return {k:'joint', why:'umlaut'};
  if (el.kind === 'suffix') {
    const sfx = parts[parts.length - 1];
    if (it.k === 'O') {
      const pos = lc(it.pos);
      if (cands.some(c => wbSame(c, pos))) return {k:'same'};
      if (cands.some(c => translit(c).endsWith(translit(pos)) && c.length > pos.length)) return {k:'needsuffix'};
    }
    const linkAt = i => i > 0 && i < parts.length - 1 && WB_LINK.test(parts[i]);
    const noLink = parts.filter((p, i) => !linkAt(i)).join('');
    const stem = parts.slice(0, -1).filter((p, i) => !linkAt(i)).join('');
    // the right ending with a slip of the pen in it (regelmäsig): a spelling matter, not another suffix
    const front = translit(parts.slice(0, -1).join('')), nsfx = translit(sfx);
    for (const c of cands) {
      const nc = translit(c);
      if (!nc.startsWith(front) || nc.length <= front.length) continue;
      const tail = nc.slice(front.length);
      if (tail !== nsfx && !WB_SUFS.some(x => translit(x) === tail) && editDistance(tail, nsfx) === 1) return {k:'joint', why:'suffix-spell'};
    }
    for (const c of cands) {
      const nc = translit(c);
      const used = WB_SUFS.find(x => nc.endsWith(translit(x)) && nc.length > translit(x).length + 1);
      if (!used) continue;
      if (!wbSame(used, sfx)) {
        if (WB_SUF_FAMILY[used] && WB_SUF_FAMILY[used] === it.el) return {k:'joint', why:'variant'};
        if (!(nc.endsWith(translit(sfx)) && sfx.length > used.length)) return {k:'elem', used};
      }
      if (noLink !== target && wbLoose(c, noLink)) return {k:'joint', why:'link'};
      if (noLink === target && ['s', 'es', 'n', 'en'].some(x => wbLoose(c, stem + x + sfx))) return {k:'joint', why:'nolink'};
      if (c.length > target.length) return {k:'joint', why:'drop'};
      return {k:'joint', why:'spell'};
    }
    return {k:'wrong'};
  }
  if (el.kind === 'prefix') {
    const pre = parts[0], rest = parts.slice(1).join(''), pos = lc(it.pos || rest);
    for (const c of cands) {
      const nc = translit(c);
      if (wbSame(c, pos)) return {k:'same'};
      for (const tail of uniq([pos, rest])) {
        const nt = translit(tail);
        if (!nc.endsWith(nt) || nc.length <= nt.length) continue;
        const used = nc.slice(0, -nt.length);
        if (used === pre) return tail === rest ? {k:'joint', why:'spell'} : {k:'joint', why:'replace'};
        return {k:'pre', used: WB_PRES.includes(used) ? used : ''};
      }
    }
    if (cands.some(c => c.startsWith(pre))) return {k:'joint', why:'spell'};
    return {k:'wrong'};
  }
  // first element of a compound
  const head = parts[parts.length - 1];
  if (cands.some(c => wbSame(c, head))) return {k:'same'};
  if (cands.some(c => translit(c).endsWith(translit(head)) && c.length > head.length)) return {k:'first'};
  return {k:'wrong'};
}
const WB_IN = ['in','im','il','ir'], WB_DE = ['de','des'];
// what to say before the second try: points at the problem without giving the answer
function wbPointer(it, j){
  const f = wbFrame(it), el = wbElem(it);
  const what = el.kind === 'prefix' ? 'prefix' : el.kind === 'first' ? 'word from the box' : 'ending from the list';
  switch (j.k) {
    case 'ending': {
      if (f.sentence) return 'Right adjective. After <b>sein</b> it takes no ending.';
      const n = f.noun, facts = (f.g === 'p' ? `${esc(n.text)} is plural` : `${esc(n.art)} ${esc(n.text)} is ${G.GENDER_EN[f.g]}`)
        + (it.art === 'zero' ? ', and there is no article in front' : `, after <b>${esc(f.pre)}</b>`);
      return j.got === '' ? `Right adjective. Before a noun it needs an ending: ${facts}.` : `Right adjective. Check the ending: ${facts}.`;
    }
    case 'trap': return `${/^~/.test(j.msg) ? '' : 'That is a different word. '}${wbTrapHtml(j.lemma, j.msg)} Try another ${what}.`;
    case 'elem': return `Not <b>-${esc(j.used)}</b> with this word. Try another ending from the list.`;
    case 'joint':
      if (j.why === 'umlaut') return /[äöü]/.test(it.w) ? 'Almost. Check the vowel: this word takes an umlaut.' : 'Almost. No umlaut in this word.';
      if (j.why === 'link') return 'Right ending. Something is missing where the two parts meet.';
      if (j.why === 'nolink') return 'Right ending. Nothing goes between the two parts here.';
      if (j.why === 'drop') return 'Right ending. The base word loses something before it.';
      if (j.why === 'variant') return 'Almost. This word takes a slightly different form of that ending.';
      if (j.why === 'suffix-spell') return 'Almost. Check the spelling of the ending.';
      if (j.why === 'replace') return 'Right prefix. Look at the beginning of the word it goes on: something has to go.';
      return el.kind === 'prefix' ? 'Right prefix. Check the spelling of the rest.' : 'Right ending. Check the spelling of the base word.';
    case 'pre':
      if (it.el === 'in' && WB_IN.includes(j.used)) return 'Almost. <b>in-</b> changes its last letter before some sounds.';
      if (it.el === 'de' && WB_DE.includes(j.used)) return 'Almost. Check again: <b>de-</b> or <b>des-</b>?';
      if (it.el === 'in' && j.used === 'un') return 'Not <b>un-</b> here: this is a Latin word.';
      if (it.el === 'un' && WB_IN.includes(j.used)) return `Not <b>${esc(j.used)}-</b> here. This word takes the German prefix.`;
      return j.used ? `Not <b>${esc(j.used)}-</b> with this word. Try another prefix.` : 'Not this prefix. Try another one from the list.';
    case 'same': return el.kind === 'first' ? 'Put a word from the box in front of it.' : 'That is the word itself. Build its opposite.';
    case 'needsuffix': return 'No prefix this time. Change the ending of the word.';
    case 'first': return 'Not this one. Take another word from the box.';
  }
  return `Not yet. Check the spelling, or try another ${what}.`;
}

/* ======================= feedback ======================= */
function wbEndingWhy(it){
  const f = wbFrame(it);
  if (f.sentence) return 'After <b>sein</b> the adjective takes no ending.';
  const n = f.noun, e = f.ending;
  const noun = f.g === 'p' ? `${esc(n.text)} is plural` : `${esc(n.art)} ${esc(n.text)} is ${G.GENDER_EN[f.g]}`;
  if (it.art === 'indef') return f.g === 'f' ? `${noun}. After <b>eine</b> the ending is <b>-e</b>.` : `${noun}. <b>ein</b> does not show the gender, so the adjective does: <b>-${e}</b>.`;
  if (it.art === 'def') return f.g === 'p' ? `${noun}. After the plural article <b>die</b> the ending is <b>-en</b>.` : `${noun}. After <b>${esc(f.pre)}</b> in the nominative the ending is <b>-e</b>.`;
  return `${noun}, with no article. The adjective takes the ending the article would have: ${({m:'der', f:'die', n:'das', p:'die'})[f.g]} → <b>-${e}</b>.`;
}
// base + element → word
function wbBuildHtml(it){
  const el = wbElem(it), seg = wbSegs(it);
  const last = it.parts[it.parts.length - 1];
  const tag = t => `<span class="tag">${esc(t)}</span>`;
  const plus = '<span class="arr">+</span>', arrow = '<span class="arr">→</span>';
  let lhs;
  if (el.kind === 'prefix') lhs = `<span class="word m-pre">${esc(it.parts[0])}-</span>${plus}${tag(it.pos || it.parts.slice(1).join(''))}`;
  else if (el.kind === 'first') lhs = seg.map(([t, r]) => `<span class="word m-${r}">${esc(t)}</span>`).join(plus);
  else lhs = `${tag(it.k === 'O' ? (it.base || it.pos) : it.from)}${plus}<span class="word m-suf">-${esc(last)}</span>`;
  return `<span class="chain">${lhs}${arrow}${wbWordHtml(it)}</span>`;
}
function wbSiblings(it){
  const pool = WB_SETS.flatMap(s => (s.example ? [s.example] : []).concat(s.items)).filter(o => o.el === it.el && o.w !== it.w);
  const seen = new Set(), list = pool.filter(o => !seen.has(o.w) && seen.add(o.w));
  // a rare element in the workbook: fill up from the pattern library
  const lib = list.length < 3 ? AFFIXES.find(a => a.id === it.el && a.kind === wbElem(it).kind) : null;
  if (lib) lib.ex.forEach(e => { if (list.length < 3 && e.w !== it.w && !seen.has(e.w)) { seen.add(e.w); list.push({w:e.w, parts:e.parts, el:it.el, en:e.en}); } });
  if (!list.length) return [];
  const start = list.findIndex(o => o.w > it.w);
  const from = start < 0 ? 0 : start;
  return [0, 1, 2].filter(k => k < list.length).map(k => list[(from + k) % list.length]);
}
function wbWhyWrong(it, r){
  if (!r.typed || !r.typed.length) return '';
  const j = r.j || {};
  if (j.k === 'trap') return wbTrapHtml(j.lemma, j.msg);
  if (j.k === 'elem') return `<b>-${esc(j.used)}</b> does not go with this word.`;
  if (j.k === 'ending') return 'The adjective was right; only the ending was not.';
  if (j.k === 'pre' && j.used) return `<b>${esc(j.used)}-</b> does not go with this word.`;
  return '';
}
function wbFbHtml(it, r){
  const f = wbFrame(it), el = wbElem(it), full = wbPhrase(it);
  const rows = [];
  rows.push(['Rule', `<b>${esc(el.form)}</b>: ${esc(el.mean)}`]);
  rows.push(['Signal', esc(el.sig)]);
  rows.push(['Joint', esc(it.note || el.joint)]);
  rows.push(['Ending', wbEndingWhy(it)]);
  if (it.alts && it.alts.length) rows.push(['Also right', it.alts.map(a => `<span class="word">${esc(wbInfl(a, f.ending))}</span>`).join(', ')]);
  const sib = wbSiblings(it);
  if (sib.length) rows.push(['Same pattern', `<span class="chain">${sib.map(o => `<span title="${esc(o.en)}">${wbWordHtml(o)}</span>`).join('<span class="arr">·</span>')}</span>`]);
  const traps = Object.keys(it.traps || {});
  if (it.tip) rows.push(['Note', esc(it.tip)]);
  if (traps.length) rows.push(['Do not mix up', traps.map(l => wbTrapHtml(l, it.traps[l])).join('<br>')]);
  else if (el.warn) rows.push(['Watch out', esc(el.warn)]);
  if (r.st !== 'right' && r.typed && r.typed.length) {
    const why = wbWhyWrong(it, r);
    rows.unshift(['You wrote', `${r.typed.map(x => `<span class="wb-typed">${esc(x)}</span>`).join(' then ')}${why ? `<div class="small">${why}</div>` : ''}`]);
  }
  const inDeck = DB.items.some(x => lc(x.w) === lc(it.w));
  return `<div class="wb-fb">
      <div class="wb-fbline">${wbBuildHtml(it)}<span class="wb-en">${esc(it.en)}</span>${speakBtn(full)}</div>
      <details ${r.st === 'right' ? '' : 'open'}><summary>Rule, joint and ending</summary>
        <dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>
        <div class="wb-fbact">${inDeck ? '<span class="small muted">In your words</span>' : `<button type="button" class="btn quiet sm" data-act="wb-add" data-id="${esc(it.id)}">Add to my words</button>`}${r.st === 'wrong' && r.typed && r.typed.length ? `<button type="button" class="btn quiet sm" data-act="wb-count" data-id="${esc(it.id)}">My answer also fits — count it</button>` : ''}</div>
      </details>
    </div>`;
}

/* ======================= rendering: a sheet ======================= */
function wbElsText(set){ return set.els.map(wbElLabel).join(', '); }
// -bar, un-: never break the line at the hyphen
function wbProse(text){ return esc(text).replace(/(^|[\s(])(-[a-zäöüß]+|[a-zäöüß]+-)(?=[\s,.;:?!)]|$)/g, '$1<span class="nb">$2</span>'); }
function wbLeftHtml(it, f){
  const set = wbSet(it.set);
  if (it.k === 'T') return `<span class="wb-cue-s">${esc(it.cue)}</span>`;
  if (it.k === 'O') return `<span class="wb-pos">${f.pre ? esc(f.pre) + ' ' : ''}<b>${esc(wbInfl(it.pos, f.ending))}</b> ${esc(f.post)}</span>`;
  return `<span class="wb-base">${esc(it.from)}</span>${set.cueEn ? `<span class="wb-cue">${esc(it.en)}</span>` : ''}`;
}
function wbToHtml(f, gap){
  const post = f.post ? (f.sentence && /^[.,!?;:]/.test(f.post) ? `<span class="wb-post tight">${esc(f.post)}</span>` : `<span class="wb-post">${esc(f.post)}</span>`) : '';
  return `${f.pre ? `<span class="wb-pre">${esc(f.pre)}</span>` : ''}${gap}${post}`;
}
function wbExampleHtml(set){
  const it = set.example; if (!it) return '';
  const f = wbFrame(it);
  return `<li class="wb-row example k-${it.k}">
      <span class="wb-n" aria-hidden="true">●</span>
      <div class="wb-from">${wbLeftHtml(it, f)}</div>
      <span class="wb-arrow" aria-hidden="true">${it.k === 'O' ? '↔' : '→'}</span>
      <div class="wb-to" data-arrow="${it.k === 'O' ? '↔' : '→'}">${wbToHtml(f, wbWordHtml(it, f.ending))}${set.cueEn ? '' : `<span class="wb-en">${esc(it.en)}</span>`}</div>
    </li>`;
}
function wbRowHtml(sh, id, i){
  const it = wbItem(id), r = sh.rows[id], f = wbFrame(it), set = wbSet(it.set);
  const final = wbFinal(r);
  let left = wbLeftHtml(it, f);
  if (sh.mixed) left += `<span class="wb-src">Aufgabe ${set.n} · ${esc(wbElsText(set))}</span>`;
  let gap;
  if (!final) {
    gap = `<input class="wb-in" data-id="${esc(id)}" value="${esc(r.v || '')}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="next" aria-label="Answer ${i + 1}">`;
  } else {
    const wrote = r.st === 'wrong' && r.typed.length ? `<span class="wb-typed big">${esc(r.typed[r.typed.length - 1])}</span>` : '';
    gap = `${wrote}<span class="wb-ans ${r.st}">${esc(f.answer)}</span>`;
  }
  const arrow = it.k === 'O' ? '↔' : '→';
  const label = r.over ? 'Counted as right' : ({right:'Right', help:'Right at the second try', wrong: r.typed.length ? 'Not right' : 'Shown'}[r.st] || '');
  return `<li class="wb-row k-${it.k} is-${r.st}${r.v ? ' has-v' : ''}" data-id="${esc(id)}">
      <span class="wb-n">${i + 1}.</span>
      <div class="wb-from">${left}</div>
      <span class="wb-arrow" aria-hidden="true">${arrow}</span>
      <div class="wb-to" data-arrow="${arrow}">${wbToHtml(f, gap)}${final ? `<span class="wb-verdict ${r.st}">${label}</span>` : `<button type="button" class="btn sm wb-go" data-act="wb-check" data-id="${esc(id)}" tabindex="-1">Check</button>`}</div>
      ${final ? `<div class="wb-extra">${wbFbHtml(it, r)}</div>` : `<div class="wb-extra">
        <div class="wb-pad chips">${['ä','ö','ü','ß'].map(c => `<button class="chip" type="button" data-act="ins" data-ch="${c}" tabindex="-1">${c}</button>`).join('')}</div>
        ${r.ptr ? `<div class="wb-msg">${r.ptr} <button type="button" class="wb-link" data-act="wb-reveal" data-id="${esc(id)}">Show the answer</button></div>` : ''}
      </div>`}
    </li>`;
}
function wbSheetMeta(sh){
  const set = wbSet(sh.key);
  if (set) return {pill:`Aufgabe ${set.n}`, title:set.title, task:set.task, els:set.els, bank:set.bank, level:set.level, example:set};
  if (sh.key === 'review') return {pill:'Mixed review', title:'Mixed review', task:'Items from all the sheets. The ones you missed come first, then new ones, then the ones you know least.', els:[]};
  const id = sh.key.slice(3), e = WB_ELEMS[id];
  const src = WB_SETS.find(s => s.bank && s.els.includes(id));
  return {pill:'One element', title: e.kind === 'first' ? 'Stronger with a noun in front' : `Everything with ${e.form}`, task:`${e.mean} ${e.joint}`, els:[id], bank: src ? src.bank : null};
}
function wbTally(sh){
  const c = {right:0, help:0, wrong:0, open:0};
  sh.ids.forEach(id => c[sh.rows[id].st]++);
  c.total = sh.ids.length; c.done = c.total - c.open;
  return c;
}
function wbFootHtml(sh){
  const c = wbTally(sh);
  if (c.open) {
    return `<div class="wb-actions">
        <button type="button" class="btn primary" data-act="wb-check-all">Check answers</button>
        <button type="button" class="btn quiet sm" data-act="wb-reveal-all">Show the remaining answers</button>
        <span class="small muted" style="margin-left:auto">${c.done} of ${c.total} done${c.done ? ` · ${c.right} right` : ''}</span>
      </div>
      <p class="small muted wb-tip">Press Enter in a gap to check that line. ae, oe, ue and ss count as ä, ö, ü and ß.</p>`;
  }
  const set = wbSet(sh.key);
  const next = set ? WB_SETS[set.n] : null;
  const missed = sh.ids.filter(id => sh.rows[id].st !== 'right');
  const pct = Math.round(c.right / c.total * 100);
  return `<div class="panel wb-summary">
      <h2>Sheet done</h2>
      <div class="score">${pct}%</div>
      <p class="muted">${c.right} of ${c.total} right at the first try${c.help ? `, ${c.help} at the second try` : ''}${c.wrong ? `, ${c.wrong} to repeat` : ''}.</p>
      <div class="btn-row">
        ${missed.length ? `<button type="button" class="btn primary" data-act="wb-retry">Repeat the ${missed.length} I did not get at once</button>` : ''}
        ${next ? `<a class="btn ${missed.length ? '' : 'primary'}" href="#workbook/${esc(next.id)}">Next: Aufgabe ${next.n}</a>` : ''}
        ${sh.key === 'review' ? `<button type="button" class="btn ${missed.length ? '' : 'primary'}" data-act="wb-restart">Another mixed review</button>` : `<button type="button" class="btn" data-act="wb-restart">Start this sheet again</button>`}
        <a class="btn quiet" href="#workbook">Back to the workbook</a>
      </div>
    </div>`;
}
function wbRenderSheet(){
  const sh = WBS, m = wbSheetMeta(sh), c = wbTally(sh);
  view().innerHTML = `<div class="wb-sheet">
      <div class="progress"><a class="btn quiet sm" href="#workbook">← Workbook</a><div class="bar"><i id="wbBar" style="width:${Math.round(c.done / c.total * 100)}%"></i></div><span id="wbCount">${c.done} of ${c.total}</span></div>
      <div class="wb-headline"><span class="wb-pill">${esc(m.pill)}</span><span class="wb-line"></span><span class="wb-topic">Wortbildung der Adjektive${m.level ? ` · ${esc(m.level)}` : ''}</span></div>
      <h1>${esc(m.title)}</h1>
      <p class="wb-task">${wbProse(m.task)}</p>
      ${m.els.length ? `<div class="wb-els">${m.els.map(e => wbElChip(e)).join('')}<span class="small muted">Tap one for its rule.</span></div>` : ''}
      ${m.bank ? `<div class="wb-bank"><span class="small muted">Box:</span> ${m.bank.map(w => `<span class="tag">${esc(w)}</span>`).join(' ')}</div>` : ''}
      <ol class="wb-list" id="wbList">${m.example ? wbExampleHtml(m.example) : ''}${sh.ids.map((id, i) => wbRowHtml(sh, id, i)).join('')}</ol>
      <div id="wbFoot">${wbFootHtml(sh)}</div>
    </div>`;
}
function wbRefreshFoot(){
  const sh = WBS; if (!sh) return;
  const c = wbTally(sh);
  const foot = $('#wbFoot'); if (foot) foot.innerHTML = wbFootHtml(sh);
  const bar = $('#wbBar'); if (bar) bar.style.width = Math.round(c.done / c.total * 100) + '%';
  const cnt = $('#wbCount'); if (cnt) cnt.textContent = `${c.done} of ${c.total}`;
}
function wbRerow(id){
  const sh = WBS; if (!sh) return null;
  const li = $$('#wbList .wb-row').find(x => x.dataset.id === id);
  if (!li) return null;
  const tmp = document.createElement('ol');
  tmp.innerHTML = wbRowHtml(sh, id, sh.ids.indexOf(id));
  const fresh = tmp.firstElementChild;
  li.replaceWith(fresh);
  return fresh;
}
function wbFocus(id, end){
  const el = $$('#wbList .wb-in').find(x => x.dataset.id === id);
  if (!el) return false;
  el.focus({preventScroll:false});
  if (end) { const n = el.value.length; try { el.setSelectionRange(n, n); } catch (e) {} }
  return true;
}
function wbNextOpen(after){
  const sh = WBS; if (!sh) return null;
  const i = sh.ids.indexOf(after);
  const order = sh.ids.slice(i + 1).concat(sh.ids.slice(0, i));
  return order.find(id => !wbFinal(sh.rows[id]) && !sh.rows[id].ptr) || order.find(id => !wbFinal(sh.rows[id])) || null;
}

/* ======================= interaction ======================= */
// one line: first wrong try → a pointer and one more try; then it is final
function wbCheck(id, opts){
  const sh = WBS, o = opts || {}; if (!sh) return 'none';
  const r = sh.rows[id], it = wbItem(id);
  if (!r || !it || wbFinal(r)) return 'none';
  const inp = $$('#wbList .wb-in').find(x => x.dataset.id === id);
  if (inp) r.v = inp.value;
  const j = wbJudge(it, r.v);
  if (j.k === 'empty') { if (!o.quiet) { toast('Type the adjective first.'); wbFocus(id); } return 'empty'; }
  r.tries++;
  let res;
  if (j.k === 'right') { r.st = r.tries > 1 ? 'help' : 'right'; r.alt = j.alt || ''; res = 'final'; wbRecord(id, r.tries > 1 ? 2 : 1); }
  else {
    r.typed.push(wbToken(it, r.v));
    r.j = j;
    if (r.tries >= 2) { r.st = 'wrong'; res = 'final'; r.prev = wbRec(id) ? JSON.stringify(wbRec(id)) : ''; wbRecord(id, 0); }
    else { r.ptr = wbPointer(it, j); res = 'pointer'; }
  }
  wbSaveState();
  wbRerow(id);
  if (!o.batch) {
    wbRefreshFoot();
    if (res === 'final') { const nx = wbNextOpen(id); if (nx) wbFocus(nx, true); }
    else wbFocus(id, true);
  }
  return res;
}
function wbReveal(id, opts){
  const sh = WBS; if (!sh) return;
  const r = sh.rows[id]; if (!r || wbFinal(r)) return;
  r.st = 'wrong';
  wbRecord(id, 0);
  wbSaveState();
  wbRerow(id);
  if (!(opts && opts.batch)) { wbRefreshFoot(); const nx = wbNextOpen(id); if (nx) wbFocus(nx, true); }
}
// a real word the answer key does not know: the learner can count it (the item's record is put back first)
function wbCountIt(id){
  const sh = WBS; if (!sh) return;
  const r = sh.rows[id]; if (!r || r.st !== 'wrong' || !r.typed.length) return;
  if (r.prev) DB.wb.it[id] = JSON.parse(r.prev); else delete DB.wb.it[id];
  DB.log[dateKey()] = Math.max(0, (DB.log[dateKey()] || 1) - 1);
  r.st = 'right'; r.over = true;
  wbRecord(id, 1);
  wbSaveState();
  wbRerow(id);
  wbRefreshFoot();
}
function wbCheckAll(){
  const sh = WBS; if (!sh) return;
  $$('#wbList .wb-in').forEach(inp => { const r = sh.rows[inp.dataset.id]; if (r) r.v = inp.value; });
  const open = sh.ids.filter(id => !wbFinal(sh.rows[id]));
  const filled = open.filter(id => cleanAnswer(sh.rows[id].v));
  if (!filled.length) { toast('Fill in at least one gap first.'); if (open[0]) wbFocus(open[0]); return; }
  filled.forEach(id => wbCheck(id, {batch:true, quiet:true}));
  wbRefreshFoot();
  const again = sh.ids.find(id => !wbFinal(sh.rows[id]) && sh.rows[id].ptr) || sh.ids.find(id => !wbFinal(sh.rows[id]));
  if (again) { const li = $$('#wbList .wb-row').find(x => x.dataset.id === again); if (li) li.scrollIntoView({behavior:'smooth', block:'center'}); }
  else { const f = $('#wbFoot'); if (f) f.scrollIntoView({behavior:'smooth', block:'nearest'}); }
}
function wbRuleSheet(id){
  const e = WB_ELEMS[id]; if (!e) return;
  const words = [];
  WB_SETS.forEach(s => (s.example ? [s.example] : []).concat(s.items).forEach(o => { if (o.el === id && !words.some(x => x.w === o.w)) words.push(o); }));
  const cls = e.kind === 'prefix' ? 'pre' : 'suf';
  openSheet(`<div class="pcard" style="border:0;padding:0">
      <div class="affix ${cls}" id="sheetTitle">${esc(e.form)}</div>
      <div class="mean">${esc(e.mean)}</div>
      <dl class="gram" style="margin-top:8px">
        <dt>Signal</dt><dd>${esc(e.sig)}</dd>
        <dt>Joint</dt><dd>${esc(e.joint)}</dd>
        ${e.warn ? `<dt>Watch out</dt><dd>${esc(e.warn)}</dd>` : ''}
      </dl>
      <div class="exs" style="margin-top:6px">${words.slice(0, 10).map(o => `<span>${wbWordHtml(o)} <span class="muted small">${esc(o.en)}</span></span>`).join('')}</div>
      ${words.length ? `<div class="btn-row" style="margin-top:14px"><a class="btn sm" href="#workbook/el-${encodeURIComponent(id)}">Practise ${esc(e.form)} (${wbAll().filter(o => o.el === id).length})</a></div>` : ''}
    </div>`);
}
// put a workbook adjective into the learner's own deck (the Words tab)
function wbDeckFields(it){
  const el = wbElem(it), f = wbFrame(it);
  const kind = el.kind === 'prefix' ? 'prefix' : el.kind === 'first' ? 'compound' : 'suffix';
  const plain = (it.from || '').replace(/\s*\(.*\)$/, '');
  let base = '';
  if (kind === 'prefix') base = it.pos || '';
  else if (kind === 'suffix') base = it.k === 'O' ? (it.base || '') : (/^(der|die|das) \S+$/.test(plain) || /^[a-zäöüß]+n$/.test(plain) ? plain : '');   // a noun with its article, or a verb
  const um = /([aou]) → ([äöü])/.exec(it.note || '');
  const noun = f.noun && f.g !== 'p' ? [`${f.noun.art} ${f.noun.text}`] : [];
  // the word's neighbours go into its family, so the deck's exercises never offer one of them as a wrong answer:
  // other right answers that share a piece with it (fürchterlich), and look-alikes with another meaning (furchtsam)
  const shares = a => it.parts.some(p => p.length >= 3 && fold(a).includes(fold(p)));
  const family = uniq([/^(der|die|das) /.test(base) ? base : '', ...(it.alts || []).filter(shares),
    ...Object.keys(it.traps || {}).filter(t => !/^~/.test(it.traps[t]))].filter(Boolean));
  return {w:it.w, en:it.en, kind, affix: kind === 'compound' ? '' : it.el, base, parts:it.parts.slice(), change: um ? um[0] : '', family,
    ant: it.k === 'O' ? [it.pos] : [], nouns:noun, phrases: f.sentence ? [] : [wbPhrase(it)], ex: f.sentence ? [wbPhrase(it)] : [],
    source:'Workbook: Wortbildung der Adjektive', chapter:''};
}
function wbAddToDeck(id){
  const it = wbItem(id); if (!it) return;
  if (DB.items.some(x => lc(x.w) === lc(it.w))) { toast('Already in your words.'); return; }
  DB.items.push(normalize(Object.assign({id:uid(), created:Date.now()}, wbDeckFields(it))));
  save();
  toast(`${it.w} is now in your words.`);
  $$('#wbList [data-act="wb-add"]').filter(b => b.dataset.id === id).forEach(b => { b.outerHTML = '<span class="small muted">In your words</span>'; });
}

Object.assign(ACT, {
  'wb-check': el => wbCheck(el.dataset.id),
  'wb-reveal': el => wbReveal(el.dataset.id),
  'wb-check-all': () => wbCheckAll(),
  'wb-reveal-all': el => {
    const sh = WBS; if (!sh) return;
    // two taps, so a slip of the finger does not give the sheet away
    if (el.dataset.armed !== '1') { el.dataset.armed = '1'; el.textContent = 'Tap again to show them all'; setTimeout(() => { if (el.isConnected) { el.dataset.armed = ''; el.textContent = 'Show the remaining answers'; } }, 3500); return; }
    sh.ids.filter(id => !wbFinal(sh.rows[id])).forEach(id => wbReveal(id, {batch:true}));
    wbRefreshFoot();
    const f = $('#wbFoot'); if (f) f.scrollIntoView({behavior:'smooth', block:'nearest'});
  },
  'wb-restart': () => { if (!WBS) return; WBS = wbNewSheet(WBS.key); if (WBS) { wbRenderSheet(); window.scrollTo(0, 0); } },
  'wb-retry': () => {
    const sh = WBS; if (!sh) return;
    const ids = sh.ids.filter(id => sh.rows[id].st !== 'right');
    if (!ids.length) return;
    WBS = wbNewSheet(sh.key, shuffle(ids));
    wbRenderSheet(); window.scrollTo(0, 0);
  },
  'wb-rule': el => wbRuleSheet(el.dataset.el),
  'wb-add': el => wbAddToDeck(el.dataset.id),
  'wb-count': el => wbCountIt(el.dataset.id),
  'wb-size': el => { UI.wbSize = +el.dataset.n; saveUI(); if (!wbSheetProgress('review')) { delete WBST.sheets.review; wbSaveState(); } wbHome(); },   // a review in progress keeps its length
  'wb-filter': el => { UI.wbFilter = el.dataset.f; saveUI(); wbHome(); }
});
document.addEventListener('input', e => {
  const el = e.target;
  if (!el.classList || !el.classList.contains('wb-in') || !WBS) return;
  const r = WBS.rows[el.dataset.id]; if (!r) return;
  r.v = el.value;
  const li = el.closest('.wb-row'); if (li) li.classList.toggle('has-v', !!el.value);
  wbSaveSoon();
});
document.addEventListener('keydown', e => {
  const el = e.target;
  if (e.key !== 'Enter' || e.repeat || e.isComposing || !el.classList || !el.classList.contains('wb-in')) return;
  e.preventDefault();
  wbCheck(el.dataset.id);
});

/* ======================= rendering: the workbook home ======================= */
function wbBarHtml(c){
  const seg = (n, cls) => n ? `<i class="${cls}" style="flex:${n}"></i>` : '';
  return `<span class="wb-bar" role="img" aria-label="${c.known} known, ${c.learning} right once, ${c.missed} to repeat, ${c.new} new">${seg(c.known, 'known')}${seg(c.learning, 'learning')}${seg(c.missed, 'missed')}${seg(c.new, 'new')}</span>`;
}
function wbSetCard(s){
  const c = wbCounts(s.items), prog = wbSheetProgress(s.id), ex = s.example, f = ex ? wbFrame(ex) : null;
  const demo = !ex ? '' : ex.k === 'T' ? `<span class="word">${esc(f.pre)} ${wbWordHtml(ex, f.ending)}${esc(f.post)}</span>`
    : ex.k === 'O' ? `<span class="word">${esc(wbInfl(ex.pos, f.ending))}</span><span class="muted">↔</span>${wbWordHtml(ex, f.ending)}`
    : `<span class="word">${esc(ex.from)}</span><span class="muted">→</span>${wbWordHtml(ex, f.ending)}`;
  const status = prog ? `In progress: ${prog.done} of ${prog.total}` : c.new === c.total ? 'Not started' : `${c.known + c.learning} of ${c.total} right${c.missed ? `, ${c.missed} to repeat` : ''}`;
  return `<a class="module wb-card" href="#workbook/${esc(s.id)}">
      <div class="wb-cardtop"><span class="wb-pill">Aufgabe ${s.n}</span><span class="pill">${esc(s.level)}</span></div>
      <h3>${esc(s.title)}</h3>
      <div class="demo">${demo}</div>
      <p>${esc(s.els.map(wbElLabel).join(' · '))}</p>
      ${wbBarHtml(c)}
      <span class="avail">${s.items.length} items · ${esc(status)}</span>
    </a>`;
}
function wbHome(){
  WBS = null;
  const all = wbAll(), c = wbCounts(all);
  const size = UI.wbSize || 12, filter = UI.wbFilter || 'all';
  const prog = wbSheetProgress('review');
  const groups = WB_GROUPS.filter(g => filter === 'all' || g.id === filter);
  const elIds = Object.keys(WB_ELEMS).filter(id => all.some(it => it.el === id));
  const perEl = id => { let n = 0, ok = 0; all.forEach(it => { if (it.el === id) { const r = wbRec(it.id); if (r) { n += r.n; ok += r.ok; } } }); return {n, ok}; };
  const weak = elIds.map(id => [id, perEl(id)]).filter(x => x[1].n >= 3).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n).slice(0, 6);
  view().innerHTML = `
    <div class="page-head"><div><h1>Wortbildung der Adjektive</h1>
      <p class="lede" style="margin:0">A workbook for building adjectives with suffixes and prefixes. Type the adjective with its ending; every line comes back with its rule.</p></div></div>
    <div class="today">
      <section class="panel today-main">
        <h2>Your progress</h2>
        <div class="today-count">
          <div><b>${c.total - c.new}</b><span>of ${c.total} items tried</span></div>
          <div><b>${c.known}</b><span>right twice in a row</span></div>
          <div><b>${c.missed}</b><span>to repeat</span></div>
        </div>
        ${wbBarHtml(c)}
        <div class="size-pick">Mixed review
          <div class="chips">${[8, 12, 20].map(n => `<button class="chip ${size === n ? 'on' : ''}" data-act="wb-size" data-n="${n}">${n}</button>`).join('')}</div>
          <span class="small muted">items</span>
        </div>
        <div class="btn-row">
          <a class="btn primary" href="#workbook/review">${prog ? `Continue the mixed review (${prog.done} of ${prog.total})` : 'Start a mixed review'}</a>
        </div>
        <p class="small muted" style="margin:0">The mixed review takes items from all the sheets: first the ones you missed, then new ones, then the ones you know least.</p>
      </section>
      <section class="panel">
        <h2>How a sheet works</h2>
        <ol class="loop">
          <li><span class="n">1</span><div><b>Build the adjective</b><span>Pick the suffix or prefix and write the word in the gap, with the ending the noun asks for.</span></div></li>
          <li><span class="n">2</span><div><b>Second try</b><span>A first wrong answer gets a pointer, not the solution: wrong ending, wrong suffix, missing umlaut.</span></div></li>
          <li><span class="n">3</span><div><b>Read the rule</b><span>Every line shows how the word is built, what happens at the joint, why the ending is what it is, and three words of the same pattern.</span></div></li>
        </ol>
        ${weak.length ? `<h3 style="margin-top:14px">Your accuracy by element</h3><div class="hbars">${weak.map(([id, p]) => `<span class="word">${esc(wbElLabel(id))}</span><span class="track"><i style="width:${p.ok / p.n * 100}%;background:var(--suf)"></i></span><span>${p.ok}/${p.n}</span>`).join('')}</div>` : ''}
      </section>
    </div>
    <div class="toolbar" style="margin-top:22px"><div class="chips">${[['all','All sheets'], ...WB_GROUPS.map(g => [g.id, g.title])].map(([k, l]) => `<button class="chip ${filter === k ? 'on' : ''}" data-act="wb-filter" data-f="${k}">${esc(l)}</button>`).join('')}</div></div>
    ${groups.map(g => `<div class="pgroup" style="margin-top:14px"><h2>${esc(g.title)}</h2><p class="muted" style="max-width:70ch">${esc(g.blurb)}</p>
      <div class="modules">${WB_SETS.filter(s => s.group === g.id).map(wbSetCard).join('')}</div></div>`).join('')}
    <div class="pgroup"><h2>One element at a time</h2><p class="muted" style="max-width:70ch">All the items that use one suffix or prefix, up to 16 per sheet. Tap an element for its rule.</p>
      <div class="wb-els">${elIds.map(id => wbElChip(id, all.filter(it => it.el === id).length)).join('')}</div></div>
    <details class="pgroup wb-rules"><summary><h2>The rules at a glance</h2><span class="small muted">${elIds.length} suffixes and prefixes: meaning, signal, joint</span></summary>
      <div class="pgrid">${elIds.map(id => { const e = WB_ELEMS[id]; const words = all.filter(it => it.el === id); const seen = new Set();
        return `<article class="pcard">
          <div class="affix ${e.kind === 'prefix' ? 'pre' : 'suf'}">${esc(e.form)}</div>
          <div class="mean">${esc(e.mean)}</div>
          <div class="pn"><b>Signal.</b> ${esc(e.sig)}</div>
          <div class="pn"><b>Joint.</b> ${esc(e.joint)}</div>
          ${e.warn ? `<div class="pn"><b>Watch out.</b> ${esc(e.warn)}</div>` : ''}
          <div class="exs">${words.filter(o => !seen.has(o.w) && seen.add(o.w)).slice(0, 5).map(o => `<span>${wbWordHtml(o)} <span class="muted small">${esc(o.en)}</span></span>`).join('')}</div>
          <div><a class="btn sm" href="#workbook/el-${encodeURIComponent(id)}">Practise ${esc(e.form)} (${words.length})</a></div>
        </article>`; }).join('')}</div></details>`;
}
// a panel for the Stats page
function wbStatsHtml(){
  const all = wbAll(), c = wbCounts(all);
  if (c.new === c.total) return `<section class="panel" style="margin-top:14px"><h2>Workbook</h2><p class="muted">Wortbildung der Adjektive: ${WB_SETS.length} sheets, ${c.total} items, not started yet.</p><a class="btn sm" href="#workbook">Open the workbook</a></section>`;
  const rows = WB_SETS.map(s => [s, wbCounts(s.items)]).filter(x => x[1].new < x[1].total);
  return `<section class="panel" style="margin-top:14px"><h2>Workbook</h2>
      <p class="small muted">Wortbildung der Adjektive: ${c.total - c.new} of ${c.total} items tried, ${c.known} right twice in a row, ${c.missed} to repeat.</p>
      <div class="hbars">${rows.map(([s, k]) => `<span>${s.n}. ${esc(s.title)}</span>${wbBarHtml(k)}<span>${k.known + k.learning}/${k.total}</span>`).join('')}</div>
      <div class="btn-row" style="margin-top:12px"><a class="btn sm" href="#workbook">Open the workbook</a>${c.missed ? `<a class="btn sm" href="#workbook/review">Repeat what I missed</a>` : ''}</div>
    </section>`;
}
function renderWorkbook(arg){
  WBS = null;
  if (!arg) return wbHome();
  if (!wbValidKey(arg)) { location.hash = '#workbook'; return; }
  const sh = wbSheetFor(arg);
  if (!sh) { toast('Nothing to practise here yet.'); return wbHome(); }
  WBS = sh;
  wbRenderSheet();
}

// app.js booted before this file was loaded: draw the workbook now if the address asks for it
if (typeof currentTab !== 'undefined' && currentTab === 'workbook') route();
