/* MorphoDeutsch — app.
   State lives in localStorage (morphodeutsch_v1) and is mirrored to /api/adjectives when served from Vercel.
   Explanations are English; German appears only as the material being learned. */
'use strict';

/* ======================= utilities ======================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lc = G.lc, fold = G.fold;
const DAY = 86400000;
const INTERVAL = {1:0, 2:1, 3:3, 4:7, 5:14, 6:30};
const today0 = (t = Date.now()) => { const d = new Date(t); d.setHours(0,0,0,0); return d.getTime(); };
const dateKey = (t = Date.now()) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const uid = () => 'a_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const uniq = a => Array.from(new Set(a));
const splitList = s => (s || '').split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
const splitLines = s => (s || '').split(/\n|;/).map(x => x.trim()).filter(Boolean);
const stripArt = s => (s || '').replace(/^(der|die|das|sich)\s+/i, '').replace(/\s*\(.*\)$/, '').trim();
const translit = s => lc(s).replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
function sameAnswer(typed, target){
  const a = lc(typed).replace(/\s+/g, ' ').trim(), b = lc(target).trim();
  return a === b || a === translit(b) || (b === 'selbstständig' && a === 'selbständig');
}
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2800);
}
const SPEAK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const speakBtn = text => `<button class="speak" type="button" data-act="speak" data-text="${esc(text)}" aria-label="Listen: ${esc(text)}">${SPEAK_SVG}</button>`;
function speak(text){
  if (!('speechSynthesis' in window)) { toast('This browser cannot read text aloud.'); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-DE'; u.rate = 0.95;
  const v = speechSynthesis.getVoices().find(v => /^de[-_]/i.test(v.lang));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

/* ======================= storage ======================= */
const KEY = 'morphodeutsch_v1', KEY_SYNC = 'morphodeutsch_sync_key', KEY_THEME = 'morphodeutsch_theme', KEY_UI = 'morphodeutsch_ui_v1';
function lsGet(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v){ try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function blankDB(){ return {v:1, items:[], deleted:{}, patterns:{}, events:[], log:{}, seeded:false, settings:{size:12, newPer:5}}; }
let DB = blankDB();
let UI = {wordsFilter:'all', wordsQuery:'', size:12};
try { UI = Object.assign(UI, JSON.parse(lsGet(KEY_UI) || '{}')); } catch (e) {}
const saveUI = () => lsSet(KEY_UI, JSON.stringify(UI));

function normalize(x){
  const it = Object.assign({id:uid(), w:'', en:'', kind:'simple', affix:'', base:'', parts:[], change:'', partner:'', family:[], syn:[], ant:[],
    field:'', contrast:null, nouns:[], phrases:[], prep:[], ex:[], exEn:[], chapter:'', source:'Aspekte Beruf B2', page:'', mine:[],
    skills:{}, lastSkill:'', created:Date.now(), updatedAt:Date.now()}, x || {});
  it.srs = Object.assign({box:1, due:0, last:0, n:0, ok:0}, (x && x.srs) || {});
  ['parts','family','syn','ant','nouns','phrases','prep','ex','exEn','mine'].forEach(k => { if (!Array.isArray(it[k])) it[k] = []; });
  if (!it.skills || typeof it.skills !== 'object') it.skills = {};
  it.w = (it.w || '').trim();
  if (!it.parts.length || it.parts.join('') !== it.w) it.parts = [it.w];
  return it;
}
function seedItem(s){
  // updatedAt = 1 so any real change on another device always wins a sync merge
  return normalize(Object.assign({}, s, {id:'seed:' + s.w, source:'Aspekte Beruf B2', chapter:'', created:1, updatedAt:1}));
}
function seedDeck(force){
  let added = 0;
  for (const s of SEED) {
    const id = 'seed:' + s.w;
    if (DB.items.some(it => it.id === id || lc(it.w) === lc(s.w))) continue;
    if (DB.deleted[id] && !force) continue;
    if (force) delete DB.deleted[id];
    DB.items.push(seedItem(s)); added++;
  }
  DB.seeded = true;
  return added;
}
function load(){
  const raw = lsGet(KEY);
  if (raw) { try { DB = Object.assign(blankDB(), JSON.parse(raw)); } catch (e) { DB = blankDB(); } }
  DB.items = (DB.items || []).map(normalize);
  if (!DB.seeded) seedDeck();
  lsSet(KEY, JSON.stringify(DB));
}
function save(opts){
  if (!lsSet(KEY, JSON.stringify(DB))) toast('Could not save in this browser (storage is full or blocked).');
  updateBadges();
  if (!(opts && opts.local)) Sync.schedule();
}
const getItem = id => DB.items.find(it => it.id === id);
const touch = it => { it.updatedAt = Date.now(); };
const isNew = it => !it.srs.last;
const isDue = it => !isNew(it) && it.srs.due <= Date.now();

/* ======================= sync ======================= */
function mergeDB(L, R){
  const out = Object.assign(blankDB(), L);
  const del = Object.assign({}, (R && R.deleted) || {});
  for (const [k, v] of Object.entries(L.deleted || {})) del[k] = Math.max(del[k] || 0, v);
  const map = new Map();
  for (const it of ((R && R.items) || [])) map.set(it.id, normalize(it));
  for (const it of (L.items || [])) { const r = map.get(it.id); if (!r || (it.updatedAt || 0) >= (r.updatedAt || 0)) map.set(it.id, it); }
  out.items = Array.from(map.values()).filter(it => !(del[it.id] && del[it.id] >= (it.updatedAt || 0)));
  out.deleted = del;
  const pat = Object.assign({}, (R && R.patterns) || {});
  for (const [k, v] of Object.entries(L.patterns || {})) { const r = pat[k]; if (!r || v.n > r.n || (v.n === r.n && (v.t || 0) >= (r.t || 0))) pat[k] = v; }
  out.patterns = pat;
  const ev = new Map();
  for (const e of [...((R && R.events) || []), ...(L.events || [])]) ev.set(e.t + '|' + e.id + '|' + e.k, e);
  out.events = Array.from(ev.values()).sort((a, b) => a.t - b.t).slice(-800);
  const log = Object.assign({}, (R && R.log) || {});
  for (const [k, v] of Object.entries(L.log || {})) log[k] = Math.max(log[k] || 0, v);
  out.log = log;
  return out;
}
function signature(d){
  const items = (d.items || []).map(it => it.id + ':' + (it.updatedAt || 0)).sort().join(',');
  return [items, Object.keys(d.deleted || {}).length, (d.events || []).length,
    Object.values(d.patterns || {}).reduce((a, p) => a + (p.n || 0), 0), Object.values(d.log || {}).reduce((a, n) => a + n, 0)].join('#');
}
const docOf = d => ({items:d.items, deleted:d.deleted, patterns:d.patterns, events:d.events, log:d.log, updatedAt:new Date().toISOString()});

const Sync = (() => {
  let state = 'off', timer = null, busy = false, again = false, lastOk = 0;
  const LABEL = {ok:'Synced', saving:'Syncing…', err:'Offline', auth:'Sync key', setup:'Local only', local:'Local only'};
  function badge(s, title){
    state = s;
    const b = $('#syncBtn'); if (!b) return;
    b.hidden = !LABEL[s];
    b.textContent = LABEL[s] || '';
    b.title = title || '';
    b.className = 'sync ' + ({ok:'ok', err:'err', auth:'warn', setup:'warn'}[s] || '');
  }
  function headers(){ const h = {'content-type':'application/json'}; const k = lsGet(KEY_SYNC); if (k) h['x-sync-key'] = k; return h; }
  async function run(){
    if (location.protocol === 'file:') { badge('local', 'Open the website version to sync between devices.'); return; }
    if (busy) { again = true; return; }
    busy = true; badge('saving');
    try {
      const r = await fetch('/api/adjectives', {headers:headers(), cache:'no-store'});
      if (r.status === 401) { badge('auth', 'Tap to enter your sync key'); return; }
      if (r.status === 404) { badge('local', 'This copy has no cloud storage. Your words stay on this device.'); return; }
      if (r.status === 503) { badge('setup', 'Cloud storage is not connected yet. Your words stay on this device.'); return; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const remote = await r.json();
      const before = signature(DB);
      const merged = mergeDB(DB, remote);
      merged.seeded = DB.seeded; merged.settings = DB.settings;
      const changedHere = signature(merged) !== before;
      DB = merged; lsSet(KEY, JSON.stringify(DB));
      if (changedHere) { updateBadges(); if (!S) route(); }
      if (signature(merged) !== signature(remote)) {
        const p = await fetch('/api/adjectives', {method:'PUT', headers:headers(), body:JSON.stringify(docOf(DB))});
        if (p.status === 401) { badge('auth', 'Tap to enter your sync key'); return; }
        if (p.status === 503) { badge('setup', 'Cloud storage is not connected yet.'); return; }
        if (!p.ok) throw new Error('HTTP ' + p.status);
      }
      lastOk = Date.now();
      badge('ok', 'Saved to the cloud at ' + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}));
    } catch (e) {
      badge('err', 'The cloud could not be reached. Your words are kept on this device and sync again automatically.');
    } finally {
      busy = false;
      if (again) { again = false; schedule(600); }
    }
  }
  function schedule(ms){
    if (state === 'local' || state === 'setup') return;
    clearTimeout(timer); timer = setTimeout(run, ms == null ? 1500 : ms);
  }
  return {run, schedule, badge, get state(){ return state; }, get lastOk(){ return lastOk; }};
})();

function openSyncDialog(){
  const st = Sync.state;
  const key = lsGet(KEY_SYNC) || '';
  let body;
  if (st === 'setup') {
    body = `<p>Cloud storage is not connected on the server yet, so your words are saved on this device only.</p>
      <p class="muted small">To turn it on: in Vercel, open the <b>morphodeutsch</b> project, go to Storage, and connect a Blob store. Then redeploy.</p>`;
  } else {
    body = `<p>Your words are saved on this device. To keep laptop and phone in step, enter the sync key set on the server (<b>SYNC_KEY</b> in Vercel).</p>
      <div class="field"><label for="syncKey">Sync key</label><input id="syncKey" class="txt" type="password" autocomplete="off" value="${esc(key)}"></div>
      <div class="btn-row"><button class="btn primary" data-act="sync-save">Save and sync</button>${key ? '<button class="btn quiet" data-act="sync-forget">Forget key on this device</button>' : ''}</div>`;
  }
  openSheet(`<h2 id="sheetTitle">Sync between devices</h2>${body}`);
}

/* ======================= words: display helpers ======================= */
const KIND_LABEL = {suffix:'Suffix', prefix:'Prefix', p1:'Partizip I', p2:'Partizip II', compound:'Compound', simple:'Base word'};
const affixInfo = id => AFFIXES.find(a => a.id === id) || (id ? {id, form:'-' + id, kind:'suffix', group:'noun', meaning:'', note:'', ex:[]} : null);
function affixLabel(it){
  if (it.kind === 'p1') return 'Partizip I (+d)';
  if (it.kind === 'p2') return 'Partizip II';
  const a = affixInfo(it.affix);
  return a ? a.form : '';
}
function wordHtml(it, cls){
  const seg = G.segment(it);
  return `<span class="word ${cls || ''}">${seg.map(([t, r]) => `<span class="m-${r}">${esc(t)}</span>`).join('')}</span>`;
}
function libWordHtml(e, a){ return wordHtml({w:e.w, parts:e.parts, kind:a.kind}); }
function blk(text, role, cls){ return `<span class="blk ${role} ${cls || ''}">${esc(text)}</span>`; }
function formationText(it){
  switch (it.kind) {
    case 'suffix': return `${it.base || '…'} + ${affixLabel(it)}`;
    case 'prefix': return `${affixLabel(it)} + ${it.base || '…'}`;
    case 'p1': return `${it.base || '…'} + d (Partizip I)`;
    case 'p2': return `Partizip II of ${it.base || '…'}`;
    case 'compound': return it.parts.length > 1 ? it.parts.join(' + ') : (it.base || 'compound');
    default: return 'Base word';
  }
}
// vertical "base → + element → word" diagram
function formationDiagram(it, opts){
  const o = opts || {};
  const rows = [];
  if (it.kind === 'suffix' || it.kind === 'p1') {
    rows.push(`<div class="row">${blk(it.base || '?', 'base')}</div>`);
    const fug = G.segment(it).find(s => s[1] === 'fug');
    rows.push(`<div class="row"><span class="plus">+</span>${fug ? blk(fug[0], 'fug', 'sm') + '<span class="plus">+</span>' : ''}${blk(it.kind === 'p1' ? 'd' : affixLabel(it), 'suf')}</div>`);
  } else if (it.kind === 'prefix') {
    rows.push(`<div class="row">${blk(affixLabel(it), 'pre')}<span class="plus">+</span>${blk(it.base || '?', 'base')}</div>`);
  } else if (it.kind === 'p2') {
    rows.push(`<div class="row">${blk(it.base || '?', 'base')}</div>`);
    rows.push(`<div class="row">${G.segment(it).map(([t, r]) => blk(t, r, 'sm')).join('<span class="plus">+</span>')}</div>`);
  } else if (it.kind === 'compound') {
    rows.push(`<div class="row">${G.segment(it).map(([t, r]) => blk(t, r)).join('<span class="plus">+</span>')}</div>`);
  } else {
    rows.push(`<div class="row">${blk(it.w, 'base')}</div><div class="cap">Base word: no derivation. Its family grows outward from it.</div>`);
    return `<div class="formation">${rows.join('')}</div>`;
  }
  rows.push('<div class="down" aria-hidden="true">↓</div>');
  rows.push(`<div class="row" style="font-size:${o.big ? 38 : 30}px">${wordHtml(it)}</div>`);
  if (it.change) rows.push(`<div class="cap">Notice: ${esc(it.change)}</div>`);
  return `<div class="formation">${rows.join('')}</div>`;
}
function familyChain(it){
  const fam = uniq([...(it.base && it.kind !== 'compound' && it.kind !== 'prefix' ? [it.base] : []), ...it.family]).filter(f => lc(f) !== lc(it.w));
  if (!fam.length) return '';
  return `<span class="chain">${fam.map(f => `<span class="tag">${esc(f)}</span>`).join('')}<span class="arr">→</span>${wordHtml(it)}</span>`;
}
function nounPhrase(it, nounStr, art){
  const n = G.parseNoun(nounStr); if (!n) return '';
  const nomInf = n.g === 'n' && /en$/.test(n.sg) && !n.pl;
  const a = nomInf || art === 'def' ? 'def' : 'indef';
  const g = n.g;
  const article = G.ARTICLES[a].N[g];
  return `${article} ${G.inflect(it.w, G.ENDINGS[a].N[g])} ${n.sg}`;
}
function phrasesOf(it){
  return uniq([...it.nouns.map(n => nounPhrase(it, n)).filter(Boolean), ...it.phrases]);
}
function boxDots(it){ let h = '<span class="boxes" aria-label="Box ' + it.srs.box + ' of 6">'; for (let i = 1; i <= 6; i++) h += `<i class="${!isNew(it) && i <= it.srs.box ? 'on' : ''}"></i>`; return h + '</span>'; }
function statusPill(it){
  if (isNew(it)) return '<span class="pill new">New</span>';
  if (isDue(it)) return '<span class="pill due">Due</span>';
  const days = Math.round((today0(it.srs.due) - today0()) / DAY);
  return `<span class="pill">In ${days} day${days === 1 ? '' : 's'}</span>`;
}
function allLibraryWords(){ return AFFIXES.flatMap(a => a.ex.map(e => ({w:e.w, en:e.en, a}))); }

/* ======================= router & chrome ======================= */
const TABS = ['practice','words','add','patterns','stats'];
let currentTab = 'practice';
function route(){
  const h = (location.hash || '#practice').slice(1);
  const [tab, arg] = h.split('/');
  currentTab = TABS.includes(tab) ? tab : 'practice';
  $$('[data-tab]').forEach(a => a.classList.toggle('active', a.dataset.tab === currentTab));
  VIEWS[currentTab](arg ? decodeURIComponent(arg) : '');
  document.title = currentTab === 'practice' ? 'MorphoDeutsch' : `${currentTab[0].toUpperCase() + currentTab.slice(1)} · MorphoDeutsch`;
}
function updateBadges(){
  const n = DB.items.filter(isDue).length;
  $$('[data-due]').forEach(el => el.textContent = n ? String(n) : '');
}
const view = () => $('#view');

function openSheet(html){
  const w = $('#sheet'); w.hidden = false;
  $('.sheet', w).innerHTML = `<button class="icon-btn close" data-act="sheet-close" aria-label="Close">✕</button>${html}`;
  document.body.style.overflow = 'hidden';
  setTimeout(() => { const f = $('.sheet input, .sheet .btn.primary', w); if (f) f.focus(); }, 30);
}
function closeSheet(){ $('#sheet').hidden = true; document.body.style.overflow = ''; }

/* ======================= stats helpers ======================= */
function streak(){
  let s = 0; const d = new Date();
  if (!DB.log[dateKey(d)]) d.setDate(d.getDate() - 1);
  while (DB.log[dateKey(d)]) { s++; d.setDate(d.getDate() - 1); }
  return s;
}
function skillRate(sk){ return sk && sk.n ? sk.ok / sk.n : null; }
function weakItem(it){
  const recent = DB.events.some(e => e.id === it.id && e.t > Date.now() - 7 * DAY);
  const low = Object.values(it.skills).some(s => s.n >= 2 && s.ok / s.n < 0.6);
  return recent || low;
}

/* ======================= PRACTICE: exercise makers ======================= */
const TITLE = {intro:'New word', meaningPick:'Meaning', recall:'Recall', build:'Derivation lab', transfer:'Transfer challenge', decon:'Deconstruct',
  family:'Word family', contrast:'Discriminate', p1p2:'Partizip I or II?', ending:'Inflect', cloze:'Collocate', valency:'Preposition and case', produce:'Produce'};
const SKILL_OF = {meaningPick:'meaning', recall:'meaning', build:'form', transfer:'transfer', decon:'family', family:'family', contrast:'contrast',
  p1p2:'contrast', ending:'ending', cloze:'colloc', valency:'valency', produce:'produce'};
const SKILL_LABEL = {form:'Build the form', family:'Word family', contrast:'Contrasts', ending:'Endings', colloc:'Words in context', meaning:'Meaning',
  valency:'Preposition and case', produce:'Own sentences'};
const CAT_OF = {meaning:'direct', form:'direct', colloc:'direct', family:'family', ending:'usage', contrast:'usage', valency:'usage', produce:'usage', transfer:'transfer'};
const CAT_LABEL = {direct:'Forgot the word or its form', family:'Could not connect it to its family', usage:'Endings, contrasts and prepositions', transfer:'Could not transfer a pattern to a new word'};
const LOOP_ORDER = ['form','contrast','ending','colloc','meaning','family','valency','produce'];

function deckWords(){ return DB.items.map(it => it.w); }
function otherItems(it){ return DB.items.filter(x => x.id !== (it && it.id)); }
function distract(correct, pool, n, exclude){
  const seen = new Set([lc(correct)]), out = [];
  for (const x of shuffle(pool)) {
    const k = lc(x);
    if (!x || seen.has(k) || (exclude && exclude(x))) continue;
    seen.add(k); out.push(x);
    if (out.length >= n) break;
  }
  return out;
}
function relatedSet(it){
  const s = new Set([lc(it.w), ...it.syn.map(lc), ...it.ant.map(lc), ...it.family.map(x => lc(stripArt(x))), lc(it.partner || ''), lc(stripArt(it.base))]);
  DB.items.forEach(o => { if (o.syn.map(lc).includes(lc(it.w)) || o.ant.map(lc).includes(lc(it.w))) s.add(lc(o.w)); });
  s.add('un' + lc(it.w)); if (lc(it.w).startsWith('un')) s.add(lc(it.w).slice(2));
  return s;
}
function rootOf(it){ return fold(stripArt(it.kind === 'prefix' ? it.base : (it.base || it.w))).slice(0, 5); }

// item + library pool of German adjectives for wrong options
function adjPool(it, sameFieldOK){
  const rel = relatedSet(it);
  const deck = otherItems(it).filter(o => sameFieldOK || !it.field || !o.field || o.field !== it.field).map(o => o.w);
  const lib = allLibraryWords().map(x => x.w);
  return {deck: deck.filter(w => !rel.has(lc(w))), lib: lib.filter(w => !rel.has(lc(w)) && !deck.includes(w))};
}

const MK = {
  intro(it){ return {type:'intro', id:it.id}; },
  meaningPick(it){
    if (!it.en) return null;
    const pool = [...otherItems(it).filter(o => o.en && (!it.field || o.field !== it.field)).map(o => o.en), ...allLibraryWords().map(x => x.en)];
    const wrong = distract(it.en, pool, 3, x => lc(x).includes(lc(it.en.split(/[,;]/)[0])));
    if (wrong.length < 3) return null;
    const opts = shuffle([it.en, ...wrong]);
    return {type:'meaningPick', id:it.id, data:{opts, ans:opts.indexOf(it.en)}};
  },
  recall(it, o){
    if (!it.en) return null;
    if (o && o.typed) return {type:'recall', id:it.id, typed:true, data:{hint:0}};
    const {deck, lib} = adjPool(it);
    const wrong = distract(it.w, deck.length >= 3 ? deck : [...deck, ...lib], 3);
    if (wrong.length < 3) return null;
    const opts = shuffle([it.w, ...wrong]);
    return {type:'recall', id:it.id, typed:false, data:{opts, ans:opts.indexOf(it.w)}};
  },
  build(it){
    if (!['suffix','prefix','p1','p2','compound'].includes(it.kind) || it.parts.length < 2 || !G.partsValid(it)) return null;
    const data = buildData(it);
    return data ? {type:'build', id:it.id, data} : null;
  },
  transfer(affixId, used){
    const a = affixInfo(affixId); if (!a || !a.ex.length) return null;
    const inDeck = new Set(deckWords().map(lc));
    const cand = a.ex.filter(e => !inDeck.has(lc(e.w)) && !(used && used.has(e.w)));
    if (!cand.length) return null;
    const e = pick(cand);
    const pseudo = {w:e.w, parts:e.parts, kind:a.kind, affix:a.id, base:e.base, change:e.change || '', en:e.en};
    return {type:'transfer', id:null, data:Object.assign(buildData(pseudo, true), {e, affix:a.id, pseudo})};
  },
  decon(it){
    if (!['suffix','prefix','p1','p2'].includes(it.kind) || !it.base) return null;
    const isNoun = /^(der|die|das)\s/i.test(it.base);
    const pool = [...otherItems(it).map(o => o.base), ...AFFIXES.flatMap(a => a.ex.map(e => e.base))]
      .filter(b => b && !/\+/.test(b) && /^(der|die|das)\s/i.test(b) === isNoun);
    const wrong = distract(it.base, uniq(pool), 3, b => fold(stripArt(b)).slice(0, 5) === rootOf(it) || lc(stripArt(b)) === lc(it.w));
    if (wrong.length < 3) return null;
    const opts = shuffle([it.base, ...wrong]);
    return {type:'decon', id:it.id, data:{opts, ans:opts.indexOf(it.base)}};
  },
  family(it){
    const fam = it.family.filter(f => lc(stripArt(f)) !== lc(it.w));
    if (!fam.length) return null;
    const nouns = fam.filter(f => /^(der|die|das)\s/i.test(f));
    const correct = nouns.length ? pick(nouns) : pick(fam);
    const isNoun = /^(der|die|das)\s/i.test(correct);
    const root = rootOf(it);
    const pool = uniq([...otherItems(it).flatMap(o => [...o.family, o.base]), ...AFFIXES.flatMap(a => a.ex.map(e => e.base))])
      .filter(f => f && !/\+/.test(f) && /^(der|die|das)\s/i.test(f) === isNoun);
    const mine = new Set([...it.family, it.base].map(x => lc(stripArt(x))));
    const wrong = distract(correct, pool, 3, f => mine.has(lc(stripArt(f))) || fold(stripArt(f)).includes(root) || root.includes(fold(stripArt(f)).slice(0, 5)));
    if (wrong.length < 3) return null;
    const opts = shuffle([correct, ...wrong]);
    return {type:'family', id:it.id, data:{opts, ans:opts.indexOf(correct), noun:isNoun}};
  },
  contrast(it){
    const useAnt = it.ant.length && (!it.syn.length || Math.random() < 0.6);
    const list = useAnt ? it.ant : it.syn;
    if (!list.length) return null;
    const correct = pick(list);
    const {deck, lib} = adjPool(it);
    const wrong = distract(correct, deck.length >= 3 ? deck : [...deck, ...lib], 3, w => relatedSet(it).has(lc(w)));
    if (wrong.length < 3) return null;
    const opts = shuffle([correct, ...wrong]);
    return {type:'contrast', id:it.id, data:{opts, ans:opts.indexOf(correct), mode:useAnt ? 'ant' : 'syn'}};
  },
  p1p2(it){
    const w = it ? lc(it.w) : null;
    let pair = w ? PPAIRS.find(p => p.a === w || p.b === w || (it.partner && (p.a === lc(it.partner) || p.b === lc(it.partner)))) : pick(PPAIRS);
    if (pair) {
      const q = pick(pair.items);
      const opts = q.opts || [pair.a, pair.b];
      return {type:'p1p2', id:it ? it.id : null, data:{pair, s:q.s, en:q.en, opts, ans:q.ans === 'a' ? 0 : 1, cause:q.ans === 'a'}};
    }
    if (!it || !it.partner || !['p1','p2'].includes(it.kind)) return null;
    // generate from the word's own examples
    for (const s of shuffle(it.ex)) {
      const f = G.findForm(s, it.w); if (!f) continue;
      const mineForm = f.form, other = G.inflect(it.partner, f.ending);
      const sentence = s.slice(0, f.index) + '___' + s.slice(f.index + f.form.length);
      const otherCased = /^[A-ZÄÖÜ]/.test(mineForm) ? G.cap(other) : other;
      const opts = shuffle([mineForm, otherCased]);
      const a = it.kind === 'p1' ? it.w : it.partner, b = it.kind === 'p1' ? it.partner : it.w;
      return {type:'p1p2', id:it.id, data:{pair:{a, b, verb:it.base}, s:sentence, en:exEnFor(it, s), opts, ans:opts.indexOf(mineForm), cause:it.kind === 'p1'}};
    }
    return null;
  },
  ending(it){
    const nouns = it.nouns.map(G.parseNoun).filter(Boolean);
    if (!nouns.length) return null;
    const n = pick(nouns);
    const nomInf = n.g === 'n' && /en$/.test(n.sg) && !n.pl;
    const slots = G.phraseSlots(n).filter(s => !(nomInf && s.a !== 'def'));
    const slot = pick(slots);
    const fr = G.frame(n, slot);
    return {type:'ending', id:it.id, data:{n, slot, fr}};
  },
  cloze(it, o){
    const cands = [];
    it.ex.forEach(s => { const f = G.findForm(s, it.w); if (f) cands.push({s, f}); });
    if (!cands.length) return null;
    const c = pick(cands);
    const sentence = c.s.slice(0, c.f.index) + '___' + c.s.slice(c.f.index + c.f.form.length);
    const form = c.f.form;
    const en = exEnFor(it, c.s);
    if (o && o.typed) return {type:'cloze', id:it.id, typed:true, data:{sentence, form, en, hint:1}};
    const {deck, lib} = adjPool(it);
    const cap = /^[A-ZÄÖÜ]/.test(form);
    const shape = w => { const f2 = G.inflect(w, c.f.ending); return cap ? G.cap(f2) : f2; };
    const wrong = distract(form, (deck.length >= 3 ? deck : [...deck, ...lib]).map(shape), 3);
    if (wrong.length < 3) return null;
    const opts = shuffle([form, ...wrong]);
    return {type:'cloze', id:it.id, typed:false, data:{sentence, form, en, opts, ans:opts.indexOf(form)}};
  },
  valency(it){
    const rows = it.prep.filter(p => p.p && p.c && p.ex);
    for (const p of shuffle(rows)) {
      const f = G.findForm(p.ex, it.w);
      const from = f ? f.index : 0;
      const re = new RegExp('(^|[^A-Za-zÄÖÜäöüß])(' + p.p + ')(?=[^A-Za-zÄÖÜäöüß])', 'i');
      const tail = p.ex.slice(from);
      const m = tail.match(re);
      if (!m) continue;
      const at = from + m.index + m[1].length;
      const sentence = p.ex.slice(0, at) + '___' + p.ex.slice(at + m[2].length);
      const preps = uniq([p.p, ...shuffle(['an','auf','für','von','mit','vor','über','zu','bei','in','gegenüber']).filter(x => x !== p.p).slice(0, 5)]);
      return {type:'valency', id:it.id, data:{sentence, p:p.p, c:p.c, en:p.en || '', preps:shuffle(preps)}};
    }
    return null;
  },
  produce(it){ return {type:'produce', id:it.id, data:{prompt:pick(PROMPTS)}}; }
};
function exEnFor(it, s){ const i = it.ex.indexOf(s); return i >= 0 && it.exEn[i] ? it.exEn[i] : ''; }

// chip tray for the derivation lab
function buildData(it, noStep1){
  const seg = G.segment(it);
  const chips = seg.map(([t, r]) => ({t, r}));
  const extra = [];
  const has = t => chips.concat(extra).some(c => c.t === t);
  const baseStem = lc(stripArt(it.base || ''));
  if (it.kind === 'suffix' && baseStem && baseStem !== seg[0][0] && !baseStem.includes(' ') && !has(baseStem)) extra.push({t:baseStem, r:'base'});
  const a = affixInfo(it.affix);
  if (it.kind === 'suffix' && a && ['fähig','voll','los','reich','frei','mäßig','haft','wert'].includes(a.id) && !seg.some(s => s[1] === 'fug') && !has('s')) extra.push({t:'s', r:'fug'});
  if (it.kind === 'suffix') {
    const others = shuffle(AFFIXES.filter(x => x.kind === 'suffix' && x.id !== it.affix && !lc(it.w).endsWith(x.id) && x.group === (a ? a.group : 'noun')));
    if (others[0] && !has(others[0].id)) extra.push({t:others[0].id, r:'suf'});
  }
  if (it.kind === 'p1') { if (!has('t')) extra.push({t:'t', r:'suf'}); if (!has('ge')) extra.push({t:'ge', r:'ge'}); }
  if (it.kind === 'p2') { if (!has('d')) extra.push({t:'d', r:'suf'}); if (!has('ge')) extra.push({t:'ge', r:'ge'}); else extra.push({t:'en', r:'suf'}); }
  if (it.kind === 'prefix') { const alt = pick(['un','in','miss','ur'].filter(p => p !== seg[0][0])); if (!has(alt)) extra.push({t:alt, r:'pre'}); }
  const tray = shuffle(chips.concat(extra.slice(0, 3)));
  let step1 = null;
  if (!noStep1 && it.kind !== 'compound') {
    let correct, pool;
    if (it.kind === 'p1' || it.kind === 'p2') {
      correct = it.kind;
      pool = ['p1','p2','bar','lich','sam'].filter(x => x !== correct);
    } else if (it.kind === 'prefix') {
      correct = it.affix;
      pool = ['un','in','hoch','inter'].filter(x => x !== correct);
    } else {
      correct = it.affix;
      const blocked = new Set(['gefahrvoll']);
      const base = lc(stripArt(it.base));
      pool = AFFIXES.filter(x => x.kind === 'suffix' && x.id !== correct && !lc(it.w).endsWith(x.id) && !blocked.has(base + x.id)).map(x => x.id);
    }
    const wrong = shuffle(pool).slice(0, 3);
    const opts = shuffle([correct, ...wrong]);
    step1 = {opts, ans:opts.indexOf(correct)};
  }
  return {tray, step1, built:[], s1:null};
}
function optLabel(id){
  if (id === 'p1') return 'Partizip I (+d)';
  if (id === 'p2') return 'Partizip II (ge-…-t)';
  const a = affixInfo(id); return a ? a.form : id;
}

/* choosing an exercise for an item */
function typesForSkill(sk, it){
  switch (sk) {
    case 'form': return ['build'];
    case 'family': return shuffle(['family','decon']);
    case 'contrast': return Math.random() < 0.5 ? ['p1p2','contrast'] : ['contrast','p1p2'];
    case 'ending': return ['ending'];
    case 'colloc': return ['cloze'];
    case 'meaning': return it.srs.box <= 1 ? ['meaningPick','recall'] : ['recall','meaningPick'];
    case 'valency': return ['valency'];
    case 'produce': return ['produce'];
  }
  return [];
}
function makeFor(type, it, typed){ const f = MK[type]; return f ? f(it, {typed}) : null; }
function chooseExercise(it, opts){
  const o = opts || {};
  const box = it.srs.box, typed = box >= 3;
  const cands = [];
  for (const sk of LOOP_ORDER) {
    if (o.skip && o.skip.includes(sk)) continue;
    for (const t of typesForSkill(sk, it)) {
      const ex = makeFor(t, it, typed);
      if (ex) { cands.push({sk, ex}); break; }
    }
  }
  if (!cands.length) return makeFor('meaningPick', it) || makeFor('recall', it, false) || makeFor('produce', it);
  cands.forEach(c => {
    const s = it.skills[c.sk] || {n:0, ok:0};
    c.score = (s.ok + 1) / (s.n + 2) + (c.sk === it.lastSkill ? 0.45 : 0) + (c.sk === 'produce' && box < 4 ? 0.6 : 0)
      + LOOP_ORDER.indexOf(c.sk) * 0.012 + Math.random() * 0.08;
  });
  cands.sort((a, b) => a.score - b.score);
  return cands[0].ex;
}

/* ======================= PRACTICE: sessions ======================= */
let S = null;
const cur = () => S && S.queue[S.i];

function startReview(size){
  const now = Date.now();
  const due = DB.items.filter(it => !isNew(it) && it.srs.due <= now).sort((a, b) => a.srs.box - b.srs.box || a.srs.due - b.srs.due);
  const fresh = DB.items.filter(isNew).sort((a, b) => (a.created || 0) - (b.created || 0) || a.w.localeCompare(b.w));
  const take = due.slice(0, size);
  const room = Math.max(0, Math.min(size - take.length, (DB.settings && DB.settings.newPer) || 5));
  const newOnes = fresh.slice(0, room);
  if (!take.length && !newOnes.length) { toast('Nothing is due right now.'); return; }
  const queue = shuffle(take).map(it => Object.assign(chooseExercise(it), {graded:true}));
  // new words: intro now, first exercise a few cards later
  newOnes.forEach((it, k) => {
    const pos = Math.min(queue.length, k * 3);
    queue.splice(pos, 0, MK.intro(it));
    const ex = Object.assign(makeFor('build', it) || makeFor('meaningPick', it) || makeFor('recall', it, false) || MK.produce(it), {graded:true});
    queue.splice(Math.min(queue.length, pos + 3), 0, ex);
  });
  beginSession('review', queue);
}
function startModule(mod, arg){
  const items = DB.items.slice();
  let queue = [];
  const N = 10;
  const addFrom = (list, type) => { for (const it of shuffle(list)) { const ex = makeFor(type, it, it.srs.box >= 3); if (ex) queue.push(ex); if (queue.length >= N) break; } };
  if (mod === 'build') {
    addFrom(items, 'build');
    queue = queue.slice(0, 6);
    const used = new Set();
    const affs = shuffle(uniq(items.map(i => i.affix).filter(Boolean).concat(AFFIXES.map(a => a.id))));
    for (const a of affs) { if (queue.length >= N) break; const t = MK.transfer(a, used); if (t) { used.add(t.data.e.w); queue.push(t); } }
    queue = shuffle(queue);
  } else if (mod === 'affix') {
    addFrom(items.filter(i => i.affix === arg), 'build');
    const used = new Set();
    for (let k = 0; k < 8 && queue.length < 8; k++) { const t = MK.transfer(arg, used); if (!t) break; used.add(t.data.e.w); queue.push(t); }
    queue = shuffle(queue);
  } else if (mod === 'p1p2') {
    const deck = shuffle(items).map(it => MK.p1p2(it)).filter(Boolean).slice(0, 4);
    const seen = new Set(deck.map(e => e.data.s));
    for (let k = 0; k < 40 && deck.length < N; k++) { const e = MK.p1p2(null); if (!seen.has(e.data.s)) { seen.add(e.data.s); deck.push(e); } }
    queue = shuffle(deck);
  } else if (mod === 'ending') {
    for (let round = 0; round < 3 && queue.length < N; round++) addFrom(items, 'ending');
    queue = queue.slice(0, N);
  } else if (mod === 'contrast') addFrom(items, 'contrast');
  else if (mod === 'family') { for (const it of shuffle(items)) { const ex = makeFor(Math.random() < 0.5 ? 'family' : 'decon', it) || makeFor('family', it) || makeFor('decon', it); if (ex) queue.push(ex); if (queue.length >= N) break; } }
  else if (mod === 'colloc') addFrom(items, 'cloze');
  else if (mod === 'valency') { for (let r = 0; r < 3 && queue.length < 6; r++) addFrom(items, 'valency'); queue = queue.slice(0, 6); }
  else if (mod === 'produce') { addFrom(items, 'produce'); queue = queue.slice(0, 3); }
  else if (mod === 'word') {
    const it = getItem(arg); if (!it) return;
    const used = new Set();
    for (const sk of LOOP_ORDER) { for (const t of typesForSkill(sk, it)) { if (used.has(t)) continue; const ex = makeFor(t, it, it.srs.box >= 3); if (ex) { queue.push(ex); used.add(t); break; } } }
    queue = queue.filter(e => e.type !== 'produce').slice(0, 5).concat(queue.filter(e => e.type === 'produce').slice(0, 1));
  } else if (mod === 'extra' || mod === 'mistakes') {
    const pool = mod === 'mistakes' ? items.filter(it => arg && arg.split(',').includes(it.id)) : shuffle(items).slice(0, UI.size || 12);
    queue = pool.map(it => chooseExercise(it)).filter(Boolean);
  }
  if (!queue.length) { toast('No exercises available for this drill yet. Add more details to your words.'); return; }
  beginSession(mod, queue);
}
function beginSession(mode, queue){
  S = {mode, queue, i:0, results:[], gradedIds:new Set(), wrongIds:new Set(), usedTransfer:new Set(), started:Date.now()};
  if (location.hash !== '#practice') location.hash = '#practice'; else renderPractice();
  window.scrollTo(0, 0);
}
function endSession(){
  if (!S) return;
  S.finished = true;
  renderPractice();
}
function quitSession(){ S = null; renderPractice(); }

function nextCard(){
  if (!S) return;
  S.i++;
  if (S.i >= S.queue.length) { endSession(); return; }
  renderPractice();
  const first = $('#ans');
  if (first && !('ontouchstart' in window)) first.focus({preventScroll:true});
  else { const c = $('#exCard'); if (c) { c.setAttribute('tabindex', '-1'); c.focus({preventScroll:true}); } }
}

/* grading */
function applySrs(it, correct, sk){
  const s = it.srs, now = Date.now();
  s.n++; s.last = now;
  if (correct) { s.ok++; s.box = Math.min(6, s.box + 1); }
  else if (CAT_OF[sk] === 'direct') s.box = 1;
  else s.box = Math.max(1, s.box - 1);
  s.due = s.box === 1 ? now : today0() + INTERVAL[s.box] * DAY;
}
function nudgeRelated(it){
  const tomorrow = today0() + DAY;
  const root = rootOf(it);
  const out = [];
  DB.items.forEach(o => {
    if (o.id === it.id || isNew(o)) return;
    const sameAffix = it.affix && o.affix === it.affix && !['p1','p2'].includes(it.affix);
    const sameFamily = rootOf(o) === root || o.family.some(f => lc(stripArt(f)) === lc(it.w)) || it.family.some(f => lc(stripArt(f)) === lc(o.w));
    if ((sameAffix || sameFamily) && o.srs.due > tomorrow) { o.srs.due = tomorrow; touch(o); out.push(o.w); }
  });
  return out;
}
function finish(ex, correct, info){
  if (ex.done) return;
  ex.done = true; ex.correct = correct; ex.info = info || {};
  const it = ex.id ? getItem(ex.id) : null;
  const sk = SKILL_OF[ex.type];
  const now = Date.now();
  ex.snap = it ? JSON.stringify({srs:it.srs, skills:it.skills, lastSkill:it.lastSkill, updatedAt:it.updatedAt}) : null;
  ex.nEvents = DB.events.length;
  if (correct !== null) {
    S.results.push({type:ex.type, id:ex.id, correct, sk, follow:!!ex.follow});
    DB.log[dateKey()] = (DB.log[dateKey()] || 0) + 1;
    if (it && sk && sk !== 'transfer') {
      const s = it.skills[sk] || {n:0, ok:0, t:0};
      s.n++; if (correct) s.ok++; s.t = now; it.skills[sk] = s;
      it.lastSkill = sk;
      if (ex.graded && !S.gradedIds.has(it.id)) { S.gradedIds.add(it.id); applySrs(it, correct, sk); }
      touch(it);
    }
    const affix = ex.type === 'transfer' ? ex.data.affix : (ex.type === 'build' && it ? it.affix : null);
    if (affix) { const p = DB.patterns[affix] || {n:0, ok:0, t:0}; p.n++; if (correct) p.ok++; p.t = now; DB.patterns[affix] = p; }
    if (!correct) {
      DB.events.push({t:now, id:ex.id || ('lib:' + (ex.data && ex.data.e ? ex.data.e.w : '')), k:CAT_OF[sk] || 'usage', s:sk, a:affix || (it && it.affix) || ''});
      if (DB.events.length > 800) DB.events = DB.events.slice(-800);
      if (it) S.wrongIds.add(it.id);
      if (it && ex.graded && S.mode === 'review') {
        ex.info.nudged = nudgeRelated(it);
        queueFollowUps(it, ex);
      }
    } else if (ex.type === 'build' && it && it.affix && Math.random() < 0.6) {
      const t = MK.transfer(it.affix, S.usedTransfer);
      if (t) { S.usedTransfer.add(t.data.e.w); t.follow = true; S.queue.splice(S.i + 1 + Math.floor(Math.random() * 2), 0, t); }
    }
  }
  save();
  showFeedback(ex);
}
function queueFollowUps(it, ex){
  const tried = new Set([ex.type]);
  const order = ['recall','family','decon','ending','cloze','contrast'];
  const out = [];
  for (const t of order) {
    if (out.length >= 2) break;
    if (tried.has(t) || (t === 'recall' && ex.type === 'meaningPick')) continue;
    const e = makeFor(t, it, false);
    if (e) { e.follow = true; out.push(e); tried.add(t); if (t === 'family') tried.add('decon'); if (t === 'decon') tried.add('family'); }
  }
  out.forEach((e, k) => S.queue.splice(Math.min(S.queue.length, S.i + 2 + k * 2), 0, e));
  ex.info.followUps = out.length;
}
function overrideLast(){
  const ex = cur(); if (!ex || !ex.done || ex.correct !== false) return;
  const it = ex.id ? getItem(ex.id) : null;
  if (it && ex.snap) { Object.assign(it, JSON.parse(ex.snap)); S.gradedIds.delete(it.id); }
  DB.events = DB.events.slice(0, ex.nEvents);
  const r = S.results[S.results.length - 1]; if (r) S.results.pop();
  // remove follow-ups that were queued for this failure
  S.queue = S.queue.filter((e, k) => k <= S.i || !(e.follow && e.id === ex.id && !e.done));
  S.wrongIds.delete(ex.id);
  ex.done = false;
  finish(ex, true, Object.assign({}, ex.info, {overridden:true, nudged:[]}));
}

/* ======================= PRACTICE: rendering ======================= */
function renderPractice(){
  if (S && S.finished) return renderSummary();
  if (S) return renderSession();
  renderPracticeHome();
}
function renderPracticeHome(){
  const now = Date.now();
  const due = DB.items.filter(it => !isNew(it) && it.srs.due <= now).length;
  const fresh = DB.items.filter(isNew).length;
  const size = UI.size || 12;
  const newToday = Math.min(fresh, Math.max(0, Math.min(size - Math.min(due, size), (DB.settings && DB.settings.newPer) || 5)));
  const count = t => DB.items.filter(it => makeFor(t, it)).length;
  const lib = allLibraryWords().length;
  const MODS = [
    {id:'build', title:'Derivation lab', p:'Pick the building element, then assemble the word from blocks.', demo:`${blk('zukunft','base','sm')}${blk('s','fug','sm')}${blk('fähig','suf','sm')}`, n:`${count('build')} of your words, plus ${lib} pattern words`},
    {id:'p1p2', title:'Partizip I or II?', p:'Does it cause the feeling, or does someone feel it?', demo:`<span class="word">aufreg<span class="m-suf">end</span></span><span class="muted">or</span><span class="word">auf<span class="m-ge">ge</span>reg<span class="m-suf">t</span></span>`, n:`${PPAIRS.reduce((a, p) => a + p.items.length, 0)} sentences`},
    {id:'ending', title:'Adjective endings', p:'Add -e, -en, -er, -es or -em in real phrases.', demo:`<span class="word">für eine zukunftsfähig<span class="m-suf">e</span> Strategie</span>`, n:`${count('ending')} words with nouns`},
    {id:'contrast', title:'Opposites and near-synonyms', p:'Tell a word apart from its neighbours.', demo:`<span class="word">anspruchs<span class="m-suf">voll</span></span><span class="muted">vs</span><span class="word">anspruchs<span class="m-suf">los</span></span>`, n:`${count('contrast')} words`},
    {id:'family', title:'Word families', p:'Connect each adjective to its noun and its verb.', demo:`<span class="word">die Herausforderung</span>`, n:`${DB.items.filter(it => makeFor('family', it) || makeFor('decon', it)).length} words`},
    {id:'colloc', title:'Words in context', p:'Complete sentences taken from your examples.', demo:`<span class="word">eine ___ Strategie</span>`, n:`${count('cloze')} words with examples`},
    {id:'valency', title:'With prepositions', p:'Which preposition, and which case?', demo:`<span class="word">sicher vor + Dat.</span>`, n:`${count('valency')} words with a preposition`},
    {id:'produce', title:'Write your own', p:'Use a word in a sentence about your work or course.', demo:`<span class="word">Mein Beruf ist …</span>`, n:'Saved to each word card'}
  ];
  view().innerHTML = `
    <div class="page-head"><div><h1>Practice</h1><p class="lede">Every adjective is learned as a form, a family, a phrase and a choice, not as a lone translation.</p></div></div>
    <div class="today">
      <section class="panel today-main">
        <h2>Today's review</h2>
        <div class="today-count">
          <div><b>${due}</b><span>due for review</span></div>
          <div><b>${newToday}</b><span>new words today</span></div>
          <div><b>${streak()}</b><span>day streak</span></div>
        </div>
        <div class="size-pick">Session length
          <div class="chips">${[8,12,20].map(n => `<button class="chip ${size === n ? 'on' : ''}" data-act="size" data-n="${n}">${n}</button>`).join('')}</div>
        </div>
        <div class="btn-row">
          ${due || newToday ? `<button class="btn primary" data-act="start-review">Start review</button>` : `<span class="muted">Nothing is due. Come back tomorrow, or practise anyway.</span>`}
          <button class="btn" data-act="module" data-mod="extra">Practise anyway</button>
        </div>
        <p class="small muted" style="margin:0">Only the review moves words between boxes. Drills and extra practice train skills without changing your schedule.</p>
      </section>
      <section class="panel">
        <h2>The learning loop</h2>
        <ol class="loop">
          <li><span class="n">1</span><div><b>Deconstruct</b><span>Find the base word and the building element.</span></div></li>
          <li><span class="n">2</span><div><b>Construct</b><span>Assemble the adjective from blocks.</span></div></li>
          <li><span class="n">3</span><div><b>Discriminate</b><span>Tell it apart from opposites and look-alikes.</span></div></li>
          <li><span class="n">4</span><div><b>Inflect</b><span>Give it the right ending in a phrase.</span></div></li>
          <li><span class="n">5</span><div><b>Collocate</b><span>Use it with the nouns it goes with.</span></div></li>
          <li><span class="n">6</span><div><b>Produce</b><span>Write your own sentence with it.</span></div></li>
        </ol>
      </section>
    </div>
    <h2 style="margin-top:28px">Drills</h2>
    <div class="modules">${MODS.map(m => `<button class="module" data-act="module" data-mod="${m.id}"><h3>${m.title}</h3><div class="demo">${m.demo}</div><p>${m.p}</p><span class="avail">${m.n}</span></button>`).join('')}</div>`;
}
function renderSession(){
  const ex = cur();
  const total = S.queue.length;
  const pct = Math.round(S.i / total * 100);
  view().innerHTML = `
    <div class="progress"><span>${S.i + 1} of ${total}</span><div class="bar"><i style="width:${pct}%"></i></div><button class="btn quiet sm" data-act="quit">End session</button></div>
    <div class="session" id="sessionWrap">
      <section class="ex" id="exCard" aria-live="polite">${exHtml(ex)}</section>
      <section class="fb" id="fbCard" hidden></section>
    </div>`;
  if (ex.done) showFeedback(ex);
}
function exHead(ex){
  const it = ex.id ? getItem(ex.id) : null;
  const right = ex.follow ? '<span class="tagf">Follow-up</span>' : (it && isNew(it) && ex.type !== 'intro' ? '<span>First try</span>' : '');
  return `<div class="ex-kind"><span>${TITLE[ex.type]}</span>${right}</div>`;
}
function optsHtml(opts, ex, word){
  const cls = opts.some(o => o.length > 13) ? 'opts stack' : 'opts';
  return `<div class="${cls}">${opts.map((o, i) => `<button class="opt ${word ? 'w' : ''}" data-act="opt" data-i="${i}"><span class="k">${i + 1}</span><span>${esc(o)}</span></button>`).join('')}</div>`;
}
const umlautPad = () => `<div class="chips" style="margin-top:8px">${['ä','ö','ü','ß'].map(c => `<button class="chip" type="button" data-act="ins" data-ch="${c}" tabindex="-1">${c}</button>`).join('')}</div>`;
function sentenceHtml(s, fill, cls){
  const [a, b] = s.split('___');
  return `<div class="sentence">${esc(a)}<span class="gap ${cls || ''}">${fill ? esc(fill) : '&nbsp;'}</span>${esc(b || '')}</div>`;
}

function exHtml(ex){
  const it = ex.id ? getItem(ex.id) : null;
  const d = ex.data || {};
  switch (ex.type) {
    case 'intro': {
      const ph = phrasesOf(it).slice(0, 2);
      return `${exHead(ex)}
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><div class="bigword">${wordHtml(it)}</div>${speakBtn(it.w)}</div>
        <div class="gloss">${esc(it.en)}</div>
        ${formationDiagram(it)}
        ${familyChain(it) ? `<div class="sec"><h3>Word family</h3>${familyChain(it)}</div>` : ''}
        ${ph.length ? `<div class="sec"><h3>Goes with</h3><div class="tags">${ph.map(p => `<span class="tag">${esc(p)}</span>`).join('')}</div></div>` : ''}
        ${it.ex[0] ? `<div class="sec"><h3>Example</h3><div class="ex-de">${esc(it.ex[0])} ${speakBtn(it.ex[0])}</div>${it.exEn[0] ? `<div class="ex-en">${esc(it.exEn[0])}</div>` : ''}</div>` : ''}
        <div class="ex-actions"><span class="kbd-hint">Enter to continue</span><button class="btn primary" data-act="next">Got it</button></div>`;
    }
    case 'meaningPick':
      return `${exHead(ex)}<div class="ex-q">What does this adjective mean?</div>
        <div style="display:flex;align-items:center;gap:10px"><div class="bigword">${esc(it.w)}</div>${speakBtn(it.w)}</div>
        <div style="margin-top:12px">${optsHtml(d.opts, ex)}</div>`;
    case 'recall':
      if (ex.typed) {
        const hint = d.hint ? it.w.slice(0, d.hint) + '…' : '';
        return `${exHead(ex)}<div class="ex-q">Write the German adjective.</div>
          <div class="bigword" style="font-size:clamp(26px,5vw,38px)">${esc(it.en)}</div>
          ${hint ? `<div class="hint-line">Starts with <b>${esc(hint)}</b></div>` : ''}
          <div class="type-row"><input id="ans" class="txt" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Your answer"><button class="btn primary" data-act="type-check">Check</button></div>
          ${umlautPad()}
          <div class="ex-actions"><button class="btn quiet sm" data-act="hint">Show a letter</button><button class="btn quiet sm" data-act="give-up">I don't know</button></div>`;
      }
      return `${exHead(ex)}<div class="ex-q">Which adjective means this?</div>
        <div class="bigword" style="font-size:clamp(26px,5vw,38px)">${esc(it.en)}</div>
        <div style="margin-top:12px">${optsHtml(d.opts, ex, true)}</div>`;
    case 'build':
    case 'transfer': {
      const src = ex.type === 'transfer' ? d.pseudo : it;
      const step1Pending = !!(d.step1 && d.s1 === null);
      const elemLabel = src.kind === 'p1' ? 'Partizip I (+d)' : src.kind === 'p2' ? 'Partizip II' : affixLabel(src);
      const elemBlk = step1Pending ? '<span class="slot">?</span>' : blk(elemLabel, src.kind === 'prefix' ? 'pre' : (src.kind === 'p2' ? 'ge' : 'suf'));
      let eq;
      if (src.kind === 'prefix') eq = `${elemBlk}<span class="plus">+</span>${blk(src.base || '?', 'base')}`;
      else if (src.kind === 'compound') eq = G.segment(src).map(([t, r]) => blk(t, r)).join('<span class="plus">+</span>');
      else eq = `${blk(src.base || '?', 'base')}<span class="plus">+</span>${elemBlk}`;
      const q = ex.type === 'transfer'
        ? `Same pattern, new word. Build the adjective that means <b>${esc(src.en)}</b>.`
        : (d.step1 && d.s1 === null
          ? (src.kind === 'p1' || src.kind === 'p2' ? `Which form of <b>${esc(src.base)}</b> means <b>${esc(src.en)}</b>?` : `Which building element makes an adjective meaning <b>${esc(src.en)}</b>?`)
          : `Now assemble <b>${esc(src.en)}</b> from the blocks, in order.`);
      let body = `<div class="eq">${eq}</div>`;
      if (d.step1 && d.s1 === null) {
        body += `<div class="opts">${d.step1.opts.map((o, i) => `<button class="opt" data-act="b-step1" data-i="${i}"><span class="k">${i + 1}</span><span class="${(o === 'p1' || o === 'p2') ? '' : 'word'}">${esc(optLabel(o))}</span></button>`).join('')}</div>`;
      } else {
        const built = d.built.map(i => d.tray[i]);
        body += `<div class="build-out ${built.length ? '' : 'empty'}" data-ph="Tap the blocks in order">${built.map(c => blk(c.t, c.r, 'sm')).join('')}</div>
          <div class="tray">${d.tray.map((c, i) => `<button class="blk ${c.r} ${d.built.includes(i) ? 'used' : ''}" data-act="b-chip" data-i="${i}">${esc(c.t)}</button>`).join('')}</div>
          <div class="ex-actions"><div class="btn-row"><button class="btn quiet sm" data-act="b-undo">Undo</button><button class="btn quiet sm" data-act="b-clear">Clear</button></div>
          <button class="btn primary" data-act="b-check" ${built.length ? '' : 'disabled'}>Check</button></div>`;
      }
      return `${exHead(ex)}<div class="ex-q">${q}</div>${body}`;
    }
    case 'decon':
      return `${exHead(ex)}<div class="ex-q">Which base word is this adjective built from?</div>
        <div class="bigword">${esc(it.w)}</div><div class="gloss" style="margin-bottom:12px">${esc(it.en)}</div>${optsHtml(d.opts, ex, true)}`;
    case 'family':
      return `${exHead(ex)}<div class="ex-q">Which ${d.noun ? 'noun' : 'word'} belongs to the same family?</div>
        <div class="bigword">${esc(it.w)}</div><div class="gloss" style="margin-bottom:12px">${esc(it.en)}</div>${optsHtml(d.opts, ex, true)}`;
    case 'contrast':
      return `${exHead(ex)}<div class="ex-q">${d.mode === 'ant' ? 'Which word means the <b>opposite</b>?' : 'Which word is <b>closest in meaning</b>?'}</div>
        <div class="bigword">${esc(it.w)}</div><div class="gloss" style="margin-bottom:12px">${esc(it.en)}</div>${optsHtml(d.opts, ex, true)}`;
    case 'p1p2':
      return `${exHead(ex)}<div class="ex-q">Does the thing <b>cause</b> the feeling (-end), or does someone <b>feel</b> it (ge-…-t)?</div>
        ${sentenceHtml(d.s)}${optsHtml(d.opts, ex, true)}`;
    case 'ending': {
      const fr = d.fr;
      const stem = G.declStem(it.w);
      return `${exHead(ex)}<div class="ex-q">Add the ending.</div>
        <div class="sentence">${esc(fr.pre)} <span class="word">${esc(stem)}</span><span class="gap" style="min-width:2.2em">&nbsp;</span> ${esc(fr.post)}</div>
        <div class="endings">${['e','en','er','es','em'].map((e, i) => `<button class="blk suf" data-act="end-pick" data-e="${e}">-${e}</button>`).join('')}</div>
        <div class="ex-actions"><button class="btn quiet sm" data-act="end-hint">Hint</button><span class="kbd-hint">Keys 1–5</span></div>
        <div id="endHint" class="hint-line" hidden>${esc(G.CASE_EN[d.slot.c])}, ${esc(G.GENDER_EN[d.slot.num === 'p' ? 'p' : d.n.g])}, ${esc(G.ART_EN[d.slot.a])}</div>`;
    }
    case 'cloze':
      if (ex.typed) {
        return `${exHead(ex)}<div class="ex-q">Fill the gap with <b>${esc(it.en)}</b>, with the right ending.</div>
          ${sentenceHtml(d.sentence)}${d.en ? `<div class="hint-line">${esc(d.en)}</div>` : ''}
          <div class="hint-line">Starts with <b>${esc(d.form.slice(0, d.hint))}…</b></div>
          <div class="type-row"><input id="ans" class="txt" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Your answer"><button class="btn primary" data-act="type-check">Check</button></div>
          ${umlautPad()}
          <div class="ex-actions"><button class="btn quiet sm" data-act="hint">Show a letter</button><button class="btn quiet sm" data-act="give-up">I don't know</button></div>`;
      }
      return `${exHead(ex)}<div class="ex-q">Which word completes the sentence?</div>
        ${sentenceHtml(d.sentence)}${d.en ? `<div class="hint-line">${esc(d.en)}</div>` : `<div class="hint-line">Meaning: ${esc(it.en)}</div>`}${optsHtml(d.opts, ex, true)}`;
    case 'valency':
      return `${exHead(ex)}<div class="ex-q">Which preposition does <b>${esc(it.w)}</b> take here, and which case follows?</div>
        ${sentenceHtml(d.sentence, d.pp)}
        <div class="step-label">Preposition</div>
        <div class="chips">${d.preps.map(p => `<button class="chip ${d.pp === p ? 'on' : ''}" data-act="v-prep" data-p="${esc(p)}">${esc(p)}</button>`).join('')}</div>
        <div class="step-label">Case after it</div>
        <div class="chips">${[['A','accusative'],['D','dative'],['G','genitive']].map(([c, l]) => `<button class="chip ${d.cc === c ? 'on' : ''}" data-act="v-case" data-c="${c}">${l}</button>`).join('')}</div>
        <div class="ex-actions"><span></span><button class="btn primary" data-act="v-check" ${d.pp && d.cc ? '' : 'disabled'}>Check</button></div>`;
    case 'produce':
      return `${exHead(ex)}<div class="ex-q">Write one sentence about your work, your course or your plans that uses this word (any ending).</div>
        <div style="display:flex;align-items:center;gap:10px"><div class="bigword">${wordHtml(it)}</div>${speakBtn(it.w)}</div>
        <div class="gloss" style="margin-bottom:10px">${esc(it.en)}</div>
        <div class="hint-line">Idea: ${esc(d.prompt.en)}</div>
        <textarea id="prod" class="txt" rows="3" placeholder="Mein Beruf ist …" aria-label="Your sentence"></textarea>
        ${umlautPad()}
        <div id="prodMsg" class="hint-line" style="margin-top:8px" hidden></div>
        <div class="ex-actions"><button class="btn quiet sm" data-act="skip">Skip</button><button class="btn primary" data-act="prod-check">Save sentence</button></div>`;
  }
  return '';
}

/* feedback */
function showFeedback(ex){
  const fb = $('#fbCard'); if (!fb) return;
  const it = ex.id ? getItem(ex.id) : null;
  const d = ex.data || {}, info = ex.info || {};
  const rows = [];
  let head, headCls;
  if (ex.correct === null) { head = 'Skipped.'; headCls = 'info'; }
  else if (ex.type === 'produce') { head = 'Saved.'; headCls = 'ok'; }
  else { head = ex.correct ? (info.overridden ? 'Counted as correct.' : 'Correct.') : 'Not quite.'; headCls = ex.correct ? 'ok' : 'no'; }
  let why = '';
  switch (ex.type) {
    case 'meaningPick': rows.push(['Meaning', esc(it.en)]); break;
    case 'recall': rows.push(['Answer', wordHtml(it)]); if (!ex.correct && info.typed) rows.push(['You wrote', esc(info.typed)]); break;
    case 'build': case 'transfer': {
      const src = ex.type === 'transfer' ? d.pseudo : it;
      rows.push(['Answer', wordHtml(src)]);
      if (!ex.correct && info.built) rows.push(['You built', esc(info.built || '—')]);
      if (d.step1 && info.s1 === false) rows.push(['Element', `${esc(optLabel(d.step1.opts[d.step1.ans]))}, not ${esc(optLabel(d.step1.opts[info.picked]))}`]);
      const a = affixInfo(src.affix) || (src.kind === 'p1' ? affixInfo('p1') : src.kind === 'p2' ? affixInfo('p2') : null);
      if (a && a.meaning) rows.push(['Pattern', `${esc(a.form)} = ${esc(a.meaning)}`]);
      if (src.change) why = `Notice: ${esc(src.change)}`;
      else if (G.segment(src).some(s => s[1] === 'fug')) why = 'The linking -s joins the noun to the ending.';
      if (a && a.ex && ex.type === 'build') {
        const same = a.ex.filter(e => lc(e.w) !== lc(src.w)).slice(0, 4);
        if (same.length) rows.push(['Same pattern', `<span class="chain">${same.map(e => `<span title="${esc(e.en)}">${libWordHtml(e, a)}</span>`).join('<span class="arr">·</span>')}</span>`]);
      }
      if (ex.type === 'transfer') rows.push(['From', esc(src.base)]);
      break;
    }
    case 'decon': rows.push(['Base', esc(it.base)]); rows.push(['Built', formationDiagramInline(it)]); break;
    case 'family': rows.push(['Answer', esc(d.opts[d.ans])]); break;
    case 'contrast': rows.push([d.mode === 'ant' ? 'Opposite' : 'Near-synonym', esc(d.opts[d.ans])]);
      if (it.ant.length) rows.push(['All opposites', esc(it.ant.join(', '))]);
      if (it.syn.length) rows.push(['Similar', esc(it.syn.join(', '))]);
      break;
    case 'p1p2': {
      const full = d.s.replace('___', d.opts[d.ans]);
      rows.push(['Sentence', `${esc(full)} ${speakBtn(full)}`]);
      if (d.en) rows.push(['English', esc(d.en)]);
      why = d.cause
        ? 'The thing causes the feeling (Partizip I in -end, or a cause adjective such as langweilig, interessant). Like English -ing.'
        : 'Someone feels it or is in that state (Partizip II, ge-…-t). Like English -ed.';
      if (d.pair) rows.push(['Pair', `<span class="word">${esc(d.pair.a)}</span> / <span class="word">${esc(d.pair.b)}</span> from ${esc(d.pair.verb || '')}`]);
      break;
    }
    case 'ending': {
      const fr = d.fr;
      const full = `${fr.pre} ${G.inflect(it.w, fr.ending)} ${fr.post}`;
      rows.push(['Answer', `${esc(fr.pre)} <b>${esc(G.declStem(it.w))}<span class="m-suf">${esc(fr.ending)}</span></b> ${esc(fr.post)} ${speakBtn(full)}`]);
      rows.push(['Why', G.endingWhy(d.slot, d.slot.num === 'p' ? 'p' : d.n.g, fr).map(esc).join('; ') + `, so the ending is <b>-${esc(fr.ending)}</b>.`]);
      ex.info.table = endingTable(d.slot.a, d.slot.c, d.slot.num === 'p' ? 'p' : d.n.g, true);
      break;
    }
    case 'cloze': {
      const full = d.sentence.replace('___', d.form);
      rows.push(['Sentence', `${esc(full)} ${speakBtn(full)}`]);
      if (d.en) rows.push(['English', esc(d.en)]);
      if (!ex.correct && info.typed) rows.push(['You wrote', esc(info.typed)]);
      break;
    }
    case 'valency': {
      const full = d.sentence.replace('___', d.p);
      rows.push(['Answer', `<b>${esc(it.w)} ${esc(d.p)}</b> + ${esc(G.CASE_EN[d.c])}`]);
      rows.push(['Sentence', `${esc(full)} ${speakBtn(full)}`]);
      if (d.en) rows.push(['Meaning', esc(d.en)]);
      break;
    }
    case 'produce': {
      rows.push(['Your sentence', esc(info.text || '')]);
      rows.push(['Model', `${esc(d.prompt.model)} ${speakBtn(d.prompt.model)}`]);
      if (it.ex[0]) rows.push(['Example', esc(it.ex[0])]);
      why = 'Saved to this word’s card. Read it aloud once.';
      break;
    }
  }
  if (it && ex.type !== 'produce') {
    if (!['build','decon'].includes(ex.type) && it.kind !== 'simple') rows.push(['Built', formationDiagramInline(it)]);
    const fc = familyChain(it); if (fc && ex.type !== 'family') rows.push(['Family', fc]);
    if (ex.type === 'family') rows.push(['Family', fc]);
    const ph = phrasesOf(it)[0]; if (ph && ex.type !== 'ending') rows.push(['Phrase', esc(ph)]);
    if (it.contrast && it.contrast.note) rows.push(['Contrast', esc(it.contrast.note)]);
  }
  let extra = '';
  if (info.nudged && info.nudged.length) extra += `<div class="transfer">Related words brought forward to tomorrow for a quick check: ${info.nudged.map(w => `<b>${esc(w)}</b>`).join(', ')}. They keep their boxes.</div>`;
  if (info.followUps) extra += `<div class="transfer">Two short follow-up questions about this word come later in this session.</div>`;
  const canOverride = ex.correct === false && ['meaningPick','recall','decon','family','contrast','cloze'].includes(ex.type) && !(ex.typed);
  fb.innerHTML = `<div class="fb-head ${headCls}">${head}</div>
    <dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>
    ${info.table ? `<div class="table-wrap">${info.table}</div>` : ''}${why ? `<div class="note">${why}</div>` : ''}${extra}
    <div class="ex-actions">${canOverride ? '<button class="btn quiet sm" data-act="override">My answer also fits — count it</button>' : '<span></span>'}
      <button class="btn primary" data-act="next" id="nextBtn">${S && S.i + 1 >= S.queue.length ? 'Finish' : 'Continue'}</button></div>`;
  fb.hidden = false;
  $('#sessionWrap').classList.add('has-fb');
  const nb = $('#nextBtn');
  if (window.innerWidth < 1100) fb.scrollIntoView({behavior:'smooth', block:'nearest'});
  if (nb && !('ontouchstart' in window)) nb.focus({preventScroll:true});
}
function formationDiagramInline(it){
  if (it.kind === 'simple') return 'Base word';
  const seg = G.segment(it);
  return `<span class="chain">${it.base && it.kind !== 'compound' ? `<span class="tag">${esc(it.base)}</span><span class="arr">+</span>` : ''}${seg.filter(s => it.kind === 'compound' || s[1] !== 'base').map(([t, r]) => `<span class="word m-${r}">${esc(t)}</span>`).join('<span class="arr">+</span>')}<span class="arr">=</span>${wordHtml(it)}</span>`;
}
function endingTable(a, c, g, short){
  const cols = ['m','f','n','p'];
  const cases = ['N','A','D'];
  const art = G.ARTICLES[a];
  const GS = {m:'masc.', f:'fem.', n:'neut.', p:'plural'}, CS = {N:'nom.', A:'acc.', D:'dat.'};
  const gl = k => short ? GS[k] : G.GENDER_EN[k], cl = k => short ? CS[k] : G.CASE_EN[k];
  const cap = short ? (a === 'def' ? 'der/die/das' : a === 'indef' ? 'ein/eine' : 'no article') : G.ART_EN[a];
  return `<div class="ref"><table class="decl"><tr><th>${esc(cap)}</th>${cols.map(k => `<th>${gl(k)}</th>`).join('')}</tr>
    ${cases.map(cs => `<tr><th>${cl(cs)}</th>${cols.map(k => `<td class="${cs === c && k === g ? 'hl' : ''}">${esc(art[cs][k])} <b>-${G.ENDINGS[a][cs][k]}</b></td>`).join('')}</tr>`).join('')}</table></div>`;
}
function renderSummary(){
  const r = S.results;
  const graded = r.filter(x => x.correct !== null);
  const ok = graded.filter(x => x.correct).length;
  const pct = graded.length ? Math.round(ok / graded.length * 100) : 0;
  const cats = {};
  r.filter(x => x.correct === false).forEach(x => { const k = CAT_OF[x.sk] || 'usage'; cats[k] = (cats[k] || 0) + 1; });
  const wrong = Array.from(S.wrongIds).map(getItem).filter(Boolean);
  const mode = S.mode;
  view().innerHTML = `<div class="summary">
    <div class="panel">
      <h1>${mode === 'review' ? 'Review done' : 'Drill done'}</h1>
      <div class="score">${pct}%</div>
      <p class="muted">${ok} of ${graded.length} answers right${mode === 'review' ? `, ${S.gradedIds.size} words rescheduled` : ''}.</p>
      ${Object.keys(cats).length ? `<h2 style="margin-top:16px">What went wrong</h2><ul class="weak-list">${Object.entries(cats).map(([k, n]) => `<li><span>${esc(CAT_LABEL[k])}</span><b>${n}</b></li>`).join('')}</ul>` : ''}
      ${wrong.length ? `<h2 style="margin-top:16px">Words to revisit</h2><div class="tags">${wrong.map(it => `<button class="tag" data-act="open-word" data-id="${esc(it.id)}">${esc(it.w)}</button>`).join('')}</div>` : ''}
      <div class="btn-row" style="margin-top:18px">
        <button class="btn primary" data-act="done">Back to practice</button>
        ${wrong.length ? `<button class="btn" data-act="module" data-mod="mistakes" data-arg="${esc(wrong.map(w => w.id).join(','))}">Practise these again</button>` : ''}
      </div>
    </div></div>`;
}

/* ======================= PRACTICE: interaction ======================= */
function handleOpt(i){
  const ex = cur(); if (!ex || ex.done) return;
  const d = ex.data;
  const correct = i === d.ans;
  $$('#exCard .opt').forEach((b, k) => { b.disabled = true; if (k === d.ans) b.classList.add('right'); else if (k === i) b.classList.add('wrong'); });
  if (['p1p2','cloze'].includes(ex.type)) { const g = $('#exCard .gap'); if (g) { g.textContent = d.opts[i]; g.classList.add(correct ? 'ok' : 'no'); } }
  finish(ex, correct, {picked:i});
}
function handleStep1(i){
  const ex = cur(); const d = ex.data;
  d.picked = i; d.s1 = i === d.step1.ans;
  $$('#exCard .opt').forEach((b, k) => { b.disabled = true; if (k === d.step1.ans) b.classList.add('right'); else if (k === i) b.classList.add('wrong'); });
  setTimeout(() => { $('#exCard').innerHTML = exHtml(ex); }, d.s1 ? 350 : 1100);
}
function handleBuild(action, i){
  const ex = cur(); if (!ex || ex.done) return;
  const d = ex.data;
  if (action === 'chip') { if (!d.built.includes(i)) d.built.push(i); }
  if (action === 'undo') d.built.pop();
  if (action === 'clear') d.built = [];
  if (action === 'check') {
    const src = ex.type === 'transfer' ? d.pseudo : getItem(ex.id);
    const built = d.built.map(k => d.tray[k].t).join('');
    const ok2 = lc(built) === lc(src.w);
    const correct = ok2 && (d.step1 ? d.s1 === true : true);
    $$('#exCard button').forEach(b => b.disabled = true);
    const out = $('#exCard .build-out'); if (out) out.style.borderColor = ok2 ? 'var(--ok)' : 'var(--bad)';
    finish(ex, correct, {built, s1:d.s1, picked:d.picked});
    return;
  }
  $('#exCard').innerHTML = exHtml(ex);
}
function handleTyped(giveUp){
  const ex = cur(); if (!ex || ex.done) return;
  const it = getItem(ex.id);
  const inp = $('#ans');
  const typed = giveUp ? '' : (inp ? inp.value.trim() : '');
  if (!giveUp && !typed) { inp && inp.focus(); return; }
  const target = ex.type === 'cloze' ? ex.data.form : it.w;
  const correct = !giveUp && sameAnswer(typed, target);
  if (inp) { inp.classList.add(correct ? 'ok' : 'no'); inp.disabled = true; }
  if (ex.type === 'cloze') { const g = $('#exCard .gap'); if (g) { g.textContent = target; g.classList.add(correct ? 'ok' : 'no'); } }
  $$('#exCard button').forEach(b => b.disabled = true);
  finish(ex, correct, {typed: typed || '(no answer)', typedMode:true});
}
function handleEnding(e){
  const ex = cur(); if (!ex || ex.done) return;
  const right = ex.data.fr.ending;
  const correct = e === right;
  $$('#exCard .endings .blk').forEach(b => { b.disabled = true; if (b.dataset.e === right) b.style.background = 'var(--ok-bg)'; else if (b.dataset.e === e) b.style.background = 'var(--bad-bg)'; });
  const g = $('#exCard .gap'); if (g) { g.textContent = e; g.classList.add(correct ? 'ok' : 'no'); }
  finish(ex, correct, {picked:e});
}
function handleProduce(skip){
  const ex = cur(); if (!ex || ex.done) return;
  const it = getItem(ex.id);
  if (skip) { finish(ex, null, {}); return; }
  const text = ($('#prod').value || '').trim();
  const msg = $('#prodMsg');
  if (text.split(/\s+/).length < 3) { msg.hidden = false; msg.textContent = 'Write a full sentence (at least three words).'; return; }
  if (!G.findForm(text, it.w)) { msg.hidden = false; msg.textContent = `Use ${it.w} in the sentence (any ending: ${G.declStem(it.w)}e, ${G.declStem(it.w)}en, …).`; return; }
  it.mine.unshift({t:Date.now(), text}); it.mine = it.mine.slice(0, 20); touch(it);
  $$('#exCard button, #exCard textarea').forEach(b => b.disabled = true);
  finish(ex, true, {text});
}

/* ======================= WORDS ======================= */
function renderWords(){
  const q = fold(UI.wordsQuery || '');
  const f = UI.wordsFilter || 'all';
  const FILTERS = [['all','All'],['suffix','Suffix'],['prefix','Prefix'],['participle','Partizip'],['other','Base and compound'],['due','Due'],['weak','Needs work']];
  const match = it => {
    if (q) { const hay = fold([it.w, it.en, it.base, it.family.join(' '), it.syn.join(' '), it.ant.join(' ')].join(' ')); if (!hay.includes(q)) return false; }
    if (f === 'suffix') return it.kind === 'suffix';
    if (f === 'prefix') return it.kind === 'prefix';
    if (f === 'participle') return it.kind === 'p1' || it.kind === 'p2';
    if (f === 'other') return it.kind === 'simple' || it.kind === 'compound';
    if (f === 'due') return isDue(it) || isNew(it);
    if (f === 'weak') return weakItem(it);
    return true;
  };
  const counts = Object.fromEntries(FILTERS.map(([k]) => [k, 0]));
  const shown = DB.items.filter(match);
  const groups = {};
  shown.forEach(it => { const g = it.chapter ? 'Kapitel ' + it.chapter : 'No chapter yet'; (groups[g] = groups[g] || []).push(it); });
  const order = Object.keys(groups).sort((a, b) => { const na = parseInt(a.replace(/\D/g, '')) || 999, nb = parseInt(b.replace(/\D/g, '')) || 999; return na - nb; });
  view().innerHTML = `
    <div class="page-head"><div><h1>Words</h1><p class="lede" style="margin:0">${DB.items.length} adjectives. Tap one to see its family card.</p></div>
      <a class="btn primary" href="#add">Add an adjective</a></div>
    <div class="toolbar">
      <input class="txt search" id="wq" type="search" placeholder="Search a word, meaning or base" value="${esc(UI.wordsQuery || '')}" aria-label="Search words">
    </div>
    <div class="chips scroll" style="margin-bottom:6px">${FILTERS.map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-act="wfilter" data-f="${k}">${l}</button>`).join('')}</div>
    <div id="wlist">${shown.length ? order.map(g => `
      <div class="group"><h2>${esc(g)}</h2><span>${groups[g].length}</span></div>
      <div class="wgrid">${groups[g].sort((a, b) => a.w.localeCompare(b.w, 'de')).map(it => `
        <button class="wcard" data-act="open-word" data-id="${esc(it.id)}">
          ${wordHtml(it)}
          <span class="en">${esc(it.en || 'Meaning not added yet')}</span>
          <span class="form">${esc(KIND_LABEL[it.kind] || '')}${it.kind !== 'simple' ? ': ' + esc(formationText(it)) : ''}</span>
          <span class="foot">${boxDots(it)}${statusPill(it)}</span>
        </button>`).join('')}</div>`).join('')
      : `<div class="empty panel"><h2>No words match</h2><p>Try another search or filter, or add the adjective.</p><a class="btn primary" href="#add">Add an adjective</a></div>`}</div>`;
  const inp = $('#wq');
  inp.addEventListener('input', () => {
    UI.wordsQuery = inp.value; saveUI();
    clearTimeout(inp._t); inp._t = setTimeout(() => { const pos = inp.selectionStart; renderWords(); const n = $('#wq'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} }, 180);
  });
}
function openWord(id){
  const it = getItem(id); if (!it) return;
  const ph = phrasesOf(it);
  const skills = LOOP_ORDER.filter(k => it.skills[k]).map(k => { const s = it.skills[k]; const r = Math.round(s.ok / s.n * 100); return `<span>${SKILL_LABEL[k]}</span><span class="track"><i style="width:${r}%"></i></span><span>${s.ok}/${s.n}</span>`; }).join('');
  openSheet(`
    <div class="detail-head"><h2 id="sheetTitle" class="bigword" style="margin:0">${wordHtml(it)}</h2>${speakBtn(it.w)}${statusPill(it)}</div>
    <div class="gloss">${esc(it.en || 'Meaning not added yet')}</div>
    ${formationDiagram(it, {big:true})}
    ${familyChain(it) ? `<div class="sec"><h3>Word family</h3>${familyChain(it)}</div>` : ''}
    ${it.partner ? `<div class="sec"><h3>Participle partner</h3><span class="word">${esc(it.partner)}</span> <span class="muted small">${/end$/.test(it.partner) ? '(the cause: something does it to you)' : '(the state: someone feels it)'}</span></div>` : ''}
    ${it.ant.length || it.syn.length ? `<div class="sec"><h3>Contrasts</h3><div class="tags">${it.ant.map(a => `<span class="tag ant">≠ ${esc(a)}</span>`).join('')}${it.syn.map(a => `<span class="tag syn">≈ ${esc(a)}</span>`).join('')}</div>${it.contrast && it.contrast.note ? `<p class="small" style="margin-top:8px">${esc(it.contrast.note)}</p>` : ''}</div>` : ''}
    ${ph.length ? `<div class="sec"><h3>Goes with</h3><div class="tags">${ph.map(p => `<span class="tag">${esc(p)}</span>`).join('')}</div></div>` : ''}
    ${it.prep.length ? `<div class="sec"><h3>With a preposition</h3><ul>${it.prep.map(p => `<li><b>${esc(it.w)} ${esc(p.p)}</b> + ${esc(G.CASE_EN[p.c] || p.c)}${p.en ? ` (${esc(p.en)})` : ''}${p.ex ? `<br><span class="small">${esc(p.ex)}</span>` : ''}</li>`).join('')}</ul></div>` : ''}
    ${it.ex.length ? `<div class="sec"><h3>Examples</h3><ul>${it.ex.map((s, i) => `<li>${esc(s)} ${speakBtn(s)}${it.exEn[i] ? `<br><span class="small muted">${esc(it.exEn[i])}</span>` : ''}</li>`).join('')}</ul></div>` : ''}
    ${it.mine.length ? `<div class="sec"><h3>My sentences</h3><ul>${it.mine.map(m => `<li>${esc(m.text)}</li>`).join('')}</ul></div>` : ''}
    ${skills ? `<div class="sec"><h3>Skills</h3><div class="skill-bars">${skills}</div></div>` : ''}
    <p class="small muted" style="margin-top:14px">${esc(it.source || '')}${it.chapter ? `, Kapitel ${esc(it.chapter)}` : ''}${it.page ? `, page ${esc(it.page)}` : ''}. Box ${it.srs.box} of 6.</p>
    <div class="btn-row" style="margin-top:12px">
      <button class="btn primary" data-act="practise-word" data-id="${esc(it.id)}">Practise this word</button>
      <button class="btn" data-act="edit-word" data-id="${esc(it.id)}">Edit</button>
      <button class="btn quiet danger" data-act="delete-word" data-id="${esc(it.id)}">Delete</button>
    </div>`);
}
function confirmDelete(id){
  const it = getItem(id); if (!it) return;
  openSheet(`<h2 id="sheetTitle">Delete ${esc(it.w)}?</h2><p>Its progress and your sentences are removed on all synced devices.</p>
    <div class="btn-row"><button class="btn primary" data-act="delete-yes" data-id="${esc(id)}" style="background:var(--bad);border-color:var(--bad)">Delete</button><button class="btn" data-act="sheet-close">Keep it</button></div>`);
}

/* ======================= ADD / EDIT ======================= */
let ADD = {editId:null, dirty:new Set(), last:null};
function renderAdd(arg){
  const editing = arg ? getItem(arg) : null;
  ADD = {editId: editing ? editing.id : null, dirty:new Set(), last:null};
  const it = editing || normalize({w:''});
  const kindOpts = Object.entries(KIND_LABEL).map(([k, l]) => `<option value="${k}" ${it.kind === k ? 'selected' : ''}>${l}</option>`).join('');
  const chOpts = `<option value="">No chapter</option>` + CHAPTERS.map(c => `<option value="${c}" ${it.chapter === c ? 'selected' : ''}>Kapitel ${c}</option>`).join('');
  view().innerHTML = `
    <div class="page-head"><div><h1>${editing ? 'Edit ' + esc(it.w) : 'Add an adjective'}</h1>
      <p class="lede" style="margin:0">${editing ? 'Change anything and save.' : 'Type the adjective. Its building blocks, base word and family are suggested straight away; check them and add what you know from the book.'}</p></div></div>
    <div class="form">
      ${editing ? '' : `<details class="panel" style="margin-bottom:14px"><summary style="cursor:pointer;font-weight:700">Paste a list of adjectives at once</summary>
        <p class="small muted" style="margin-top:10px">One per line, optionally with a meaning: <b>zukunftsfähig = viable for the future</b>. Building blocks are detected for each word; meanings and example sentences you leave out are looked up afterwards. Words you already have are skipped.</p>
        <textarea id="bulk" class="txt" rows="6" placeholder="gefährlich = dangerous&#10;anspruchsvoll&#10;ungewöhnlich = unusual"></textarea>
        <div class="grid2" style="margin-top:10px;align-items:end"><div class="field" style="margin:0"><label for="bulkCh">Chapter</label><select id="bulkCh" class="txt">${chOpts}</select></div>
        <div class="btn-row" style="justify-content:flex-end"><button class="btn primary" data-act="bulk-add">Add all</button></div></div>
        <div id="bulkOut" class="small" style="margin-top:10px"></div></details>`}
      <section class="panel">
        <div class="grid2">
          <div class="field"><label for="f_w">Adjective</label><input id="f_w" class="txt" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="e.g. zukunftsfähig" value="${esc(it.w)}">${umlautPad()}</div>
          <div class="field"><label for="f_en">Meaning in English</label><input id="f_en" class="txt" autocomplete="off" placeholder="e.g. viable for the future" value="${esc(it.en)}">
            <div class="btn-row" style="margin-top:6px"><button class="btn quiet sm" type="button" data-act="suggest-meaning">Suggest a meaning</button></div><div id="meanSg" class="sg"></div></div>
        </div>
        <div id="detect" class="detect" ${it.w ? '' : 'hidden'}></div>
        <div class="grid3">
          <div class="field"><label for="f_src">Source</label><input id="f_src" class="txt" value="${esc(it.source || 'Aspekte Beruf B2')}"></div>
          <div class="field"><label for="f_ch">Chapter</label><select id="f_ch" class="txt">${chOpts}</select></div>
          <div class="field"><label for="f_page">Page</label><input id="f_page" class="txt" inputmode="numeric" value="${esc(it.page || '')}"></div>
        </div>
      </section>

      <fieldset class="panel" style="margin-top:14px"><legend>How it is built</legend>
        <div class="grid3">
          <div class="field"><label for="f_kind">Type</label><select id="f_kind" class="txt" data-dirty="kind">${kindOpts}</select></div>
          <div class="field"><label for="f_base">Base word</label><input id="f_base" class="txt" data-dirty="base" placeholder="die Zukunft / aufregen" value="${esc(it.base)}"><div class="help">Nouns with their article.</div></div>
          <div class="field" id="affixField"><label for="f_affix">Building element</label><select id="f_affix" class="txt" data-dirty="affix"></select></div>
        </div>
        <div class="grid2">
          <div class="field"><label for="f_parts">Blocks</label><input id="f_parts" class="txt" data-dirty="parts" autocapitalize="off" spellcheck="false" placeholder="zukunft | s | fähig" value="${esc(it.parts.length > 1 ? it.parts.join(' | ') : '')}"><div class="help">Split with | so the pieces spell the word exactly.</div></div>
          <div class="field"><label for="f_change">Spelling note</label><input id="f_change" class="txt" data-dirty="change" placeholder="a → ä" value="${esc(it.change)}"></div>
        </div>
      </fieldset>

      <fieldset class="panel" style="margin-top:14px"><legend>Family and contrasts</legend>
        <div class="field"><label for="f_family">Word family</label><input id="f_family" class="txt" data-dirty="family" placeholder="die Zukunft, zukünftig" value="${esc(it.family.join(', '))}"><div id="famSg" class="sg"></div><div class="help">Words built on the same root. Separate with commas.</div></div>
        <div class="grid2">
          <div class="field"><label for="f_partner">Participle partner</label><input id="f_partner" class="txt" data-dirty="partner" placeholder="aufgeregt ↔ aufregend" value="${esc(it.partner)}"><div class="help">For -end / ge-…-t pairs only.</div></div>
          <div class="field"><label for="f_contrast">Contrast note</label><input id="f_contrast" class="txt" placeholder="modern = up to date now; zukunftsfähig = …" value="${esc(it.contrast && it.contrast.note || '')}"></div>
        </div>
        <div class="grid2">
          <div class="field"><label for="f_syn">Near-synonyms</label><input id="f_syn" class="txt" placeholder="schwierig, herausfordernd" value="${esc(it.syn.join(', '))}"></div>
          <div class="field"><label for="f_ant">Opposites</label><input id="f_ant" class="txt" placeholder="anspruchslos, einfach" value="${esc(it.ant.join(', '))}"></div>
        </div>
      </fieldset>

      <fieldset class="panel" style="margin-top:14px"><legend>Using it</legend>
        <div class="grid2">
          <div class="field"><label for="f_nouns">Nouns it goes with</label><textarea id="f_nouns" class="txt" rows="3" placeholder="die Strategie, -n&#10;der Beruf, -e&#10;das Unternehmen, -">${esc(it.nouns.join('\n'))}</textarea><div class="help">One per line, with article and plural if you know it. These drive the endings drill.</div></div>
          <div class="field"><label for="f_phr">Fixed phrases</label><textarea id="f_phr" class="txt" rows="3" placeholder="sich selbstständig machen">${esc(it.phrases.join('\n'))}</textarea></div>
        </div>
        <div class="field"><span class="lbl">With a preposition</span><div id="prepRows"></div><button class="btn quiet sm" type="button" data-act="add-prep">Add a preposition</button></div>
        <div class="field"><label for="f_ex">Example sentences</label><textarea id="f_ex" class="txt" rows="3" placeholder="One per line. Leave empty and sentences are looked up when you save.">${esc(it.ex.join('\n'))}</textarea>
          <div class="btn-row" style="margin-top:6px"><button class="btn quiet sm" type="button" data-act="fetch-ex">Look up example sentences</button><span id="exNote" class="small muted"></span></div></div>
      </fieldset>
      <div class="btn-row" style="margin-top:16px;justify-content:flex-end">
        ${editing ? `<a class="btn quiet" href="#words">Cancel</a>` : ''}
        <button class="btn primary" data-act="save-word">${editing ? 'Save changes' : 'Save adjective'}</button>
      </div>
    </div>`;
  fillAffixSelect(it.kind, it.affix);
  (it.prep.length ? it.prep : []).forEach(p => addPrepRow(p));
  const w = $('#f_w');
  w.addEventListener('input', () => { clearTimeout(w._t); w._t = setTimeout(runDetect, 300); });
  $$('[data-dirty]').forEach(el => el.addEventListener('input', e => { if (e.isTrusted) ADD.dirty.add(el.dataset.dirty); if (el.id === 'f_kind') fillAffixSelect(el.value, $('#f_affix').value); renderDetect(); }));
  $('#f_kind').addEventListener('change', () => { ADD.dirty.add('kind'); fillAffixSelect($('#f_kind').value, ''); renderDetect(); });
  if (editing) { ['kind','base','affix','parts','change','family','partner'].forEach(k => ADD.dirty.add(k)); renderDetect(); }
  else setTimeout(() => w.focus(), 30);
}
function fillAffixSelect(kind, val){
  const sel = $('#f_affix'); const fld = $('#affixField');
  if (!sel) return;
  const list = AFFIXES.filter(a => a.kind === kind);
  fld.hidden = !(kind === 'suffix' || kind === 'prefix');
  const has = list.some(a => a.id === val);
  sel.innerHTML = `<option value="">Choose</option>` + list.map(a => `<option value="${esc(a.id)}" ${a.id === val ? 'selected' : ''}>${esc(a.form)}${a.meaning ? ' (' + esc(a.meaning.split(',')[0]) + ')' : ''}</option>`).join('')
    + (val && !has ? `<option value="${esc(val)}" selected>-${esc(val)}</option>` : '');
  if (kind === 'p1' || kind === 'p2') sel.value = '';
}
function setIfClean(key, id, value){ if (!ADD.dirty.has(key)) { const el = $('#' + id); if (el && value != null) el.value = value; } }
function runDetect(){
  const w = lc($('#f_w').value.trim());
  if (!w) { $('#detect').hidden = true; return; }
  const d = G.analyze(w, deckWords().filter(x => lc(x) !== w));
  ADD.last = d;
  setIfClean('kind', 'f_kind', d.kind);
  if (!ADD.dirty.has('affix')) fillAffixSelect($('#f_kind').value, d.affix);
  setIfClean('base', 'f_base', d.base);
  setIfClean('parts', 'f_parts', d.parts.length > 1 ? d.parts.join(' | ') : '');
  setIfClean('change', 'f_change', d.change || '');
  const partner = G.partnerGuess(d, w);
  setIfClean('partner', 'f_partner', partner && partner.sure ? partner.w : '');
  ADD.partnerSuggestion = partner && !partner.sure ? partner.w : '';
  const fam = G.familyGuess(d, w);
  setIfClean('family', 'f_family', fam.join(', '));
  const en = $('#f_en'); if (d.en && !en.value) en.value = d.en;
  renderDetect();
}
function draftFromForm(){
  const w = $('#f_w').value.trim();
  const partsRaw = $('#f_parts').value.split(/[|+·]/).map(s => s.trim()).filter(Boolean);
  const parts = partsRaw.length > 1 && partsRaw.join('') === w ? partsRaw : [w];
  return {w, kind:$('#f_kind').value, affix:$('#f_affix').value, base:$('#f_base').value.trim(), parts, change:$('#f_change').value.trim(), partsRaw};
}
function renderDetect(){
  const box = $('#detect'); if (!box) return;
  const d = draftFromForm();
  if (!d.w) { box.hidden = true; return; }
  box.hidden = false;
  const it = normalize(d);
  const a = ADD.last;
  const lines = [];
  if (a && a.source === 'library') lines.push('Found in the pattern library, so the blocks and base are reliable.');
  else if (a && d.kind !== 'simple') lines.push(a.sure ? 'Detected from the ending. Check the base word.' : 'This is a best guess from the spelling. Please check the type, base word and article.');
  if (d.partsRaw.length > 1 && d.partsRaw.join('') !== d.w) lines.push(`The blocks spell "${esc(d.partsRaw.join(''))}", not "${esc(d.w)}". Fix the split so they match.`);
  if (d.kind === 'suffix' && /^[A-ZÄÖÜ]/.test(d.base)) lines.push('Add the article to the base noun (der, die or das).');
  if (d.change) lines.push('Notice: ' + esc(d.change));
  const partner = $('#f_partner').value.trim();
  if (!partner && ADD.partnerSuggestion && d.kind === 'p1') lines.push(`Participle partner? The regular pattern gives <button type="button" class="tag" data-act="use-partner" data-w="${esc(ADD.partnerSuggestion)}">${esc(ADD.partnerSuggestion)}</button>. Use it only if the pair is real (like aufregend / aufgeregt).`);
  box.innerHTML = `<div class="row">${d.kind === 'simple' ? blk(d.w, 'base') : G.segment(it).map(([t, r]) => blk(t, r, 'sm')).join('<span class="plus">+</span>')}
    <span class="plus">=</span><span class="word" style="font-size:24px">${wordHtml(it)}</span></div>
    <div class="say">${esc(KIND_LABEL[d.kind])}${d.kind !== 'simple' ? ': ' + esc(formationText(it)) : ''}</div>
    ${lines.map(l => `<div class="say">${l}</div>`).join('')}`;
}
function addPrepRow(p){
  const wrap = $('#prepRows'); if (!wrap) return;
  const row = document.createElement('div');
  row.className = 'prep-row';
  const preps = ['an','auf','aus','bei','für','gegen','gegenüber','in','mit','nach','über','um','von','vor','zu'];
  row.innerHTML = `<select class="txt" aria-label="Preposition"><option value="">—</option>${preps.map(x => `<option ${p && p.p === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
    <select class="txt" aria-label="Case"><option value="A" ${p && p.c === 'A' ? 'selected' : ''}>accusative</option><option value="D" ${p && p.c === 'D' ? 'selected' : ''}>dative</option><option value="G" ${p && p.c === 'G' ? 'selected' : ''}>genitive</option></select>
    <input class="txt" placeholder="Example sentence (used for the drill)" value="${esc(p && p.ex || '')}" aria-label="Example sentence">
    <button class="icon-btn" type="button" data-act="del-prep" aria-label="Remove">✕</button>`;
  row.dataset.en = (p && p.en) || '';
  wrap.appendChild(row);
}
function readPrepRows(){
  return $$('#prepRows .prep-row').map(r => { const [ps, cs] = $$('select', r); const ex = $('input', r).value.trim(); return {p:ps.value, c:cs.value, ex, en:r.dataset.en || ''}; }).filter(p => p.p);
}
function saveWord(){
  const d = draftFromForm();
  if (!d.w) { toast('Type the adjective first.'); $('#f_w').focus(); return; }
  if (/\s/.test(d.w)) { toast('Enter a single adjective without spaces.'); return; }
  if (d.partsRaw.length > 1 && d.partsRaw.join('') !== d.w) { toast('The blocks must spell the word exactly. Fix the split or clear it.'); $('#f_parts').focus(); return; }
  const exLines = splitLines($('#f_ex').value);
  const old = ADD.editId ? getItem(ADD.editId) : null;
  const exEn = exLines.map(s => { if (!old) return ''; const i = old.ex.indexOf(s); return i >= 0 ? (old.exEn[i] || '') : ''; });
  const fields = {
    w:d.w, en:$('#f_en').value.trim(), kind:d.kind, affix:(d.kind === 'suffix' || d.kind === 'prefix') ? d.affix : (d.kind === 'p1' || d.kind === 'p2' ? d.kind : ''),
    base:d.base, parts:d.parts, change:d.change,
    family:splitList($('#f_family').value), partner:$('#f_partner').value.trim(), syn:splitList($('#f_syn').value), ant:splitList($('#f_ant').value),
    contrast: $('#f_contrast').value.trim() ? {w:'', note:$('#f_contrast').value.trim()} : null,
    nouns:splitLines($('#f_nouns').value), phrases:splitLines($('#f_phr').value), prep:readPrepRows(), ex:exLines, exEn,
    source:$('#f_src').value.trim(), chapter:$('#f_ch').value, page:$('#f_page').value.trim()
  };
  let it;
  if (old) { it = Object.assign(old, fields); it.parts = fields.parts; touch(it); }
  else {
    const dup = DB.items.find(x => lc(x.w) === lc(d.w));
    if (dup) {
      for (const [k, v] of Object.entries(fields)) {
        const cur = dup[k];
        if (Array.isArray(v)) { if (!cur.length && v.length) dup[k] = v; }
        else if (v && !cur) dup[k] = v;
      }
      touch(dup); save();
      toast(`${dup.w} was already in your list. New details were added to it.`);
      location.hash = '#words'; setTimeout(() => openWord(dup.id), 50);
      return;
    }
    it = normalize(Object.assign({id:uid(), created:Date.now()}, fields));
    DB.items.push(it);
  }
  save();
  enrich(it);
  toast(old ? 'Changes saved.' : `${it.w} saved.`);
  if (old) { location.hash = '#words'; setTimeout(() => openWord(it.id), 50); }
  else renderAdd('');
}
async function enrich(it){
  let changed = false;
  if (!it.en) { const m = await lookupMeaning(it.w); if (m) { it.en = m; changed = true; } }
  if (!it.ex.length) { const ex = await lookupExamples(it.w); if (ex.length) { it.ex = ex; it.exEn = ex.map(() => ''); changed = true; } }
  if (changed) { touch(it); save(); if (currentTab === 'words') renderWords(); }
}
async function bulkAdd(){
  const lines = splitLines($('#bulk').value.replace(/;/g, '\n'));
  const ch = $('#bulkCh').value;
  const out = $('#bulkOut');
  let added = [], skipped = [];
  for (const line of lines) {
    const [wRaw, ...rest] = line.split(/\s*[=:–—]\s*|\s+-\s+/);
    const w = lc((wRaw || '').trim()); if (!w || /\s/.test(w)) { if (w) skipped.push(w); continue; }
    if (DB.items.some(x => lc(x.w) === w)) { skipped.push(w); continue; }
    const d = G.analyze(w, deckWords());
    const p = G.partnerGuess(d, w);
    const it = normalize({id:uid(), w, en:rest.join(' ').trim() || d.en || '', kind:d.kind, affix:d.kind === 'p1' || d.kind === 'p2' ? d.kind : d.affix,
      base:d.base, parts:d.parts, change:d.change || '', partner:p && p.sure ? p.w : '', family:G.familyGuess(d, w), chapter:ch, created:Date.now()});
    DB.items.push(it); added.push(it);
  }
  save();
  out.innerHTML = `${added.length} added${skipped.length ? `, ${skipped.length} skipped (already saved or not a single word: ${esc(skipped.join(', '))})` : ''}. ${added.length ? 'Looking up missing meanings and examples in the background.' : ''}`;
  $('#bulk').value = '';
  for (const it of added) { await enrich(it); await new Promise(r => setTimeout(r, 350)); }
}

/* free lookups (same services as the Verb Meister App) */
async function lookupMeaning(word){
  try {
    const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=de|en`);
    if (!r.ok) return '';
    const data = await r.json();
    const c = [];
    if (data && data.responseData && data.responseData.translatedText) c.push({t:data.responseData.translatedText, q:data.responseData.match || 0});
    (data.matches || []).forEach(m => m && m.translation && c.push({t:m.translation.trim(), q:typeof m.match === 'number' ? m.match : 0}));
    const ok = c.filter(x => x.t && x.t.length <= 60 && lc(x.t) !== lc(word)).sort((a, b) => b.q - a.q);
    return ok.length ? ok[0].t : '';
  } catch (e) { return ''; }
}
async function meaningSuggestions(word){
  try {
    const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=de|en`);
    const data = await r.json();
    const seen = new Map();
    const push = (t, q) => { t = (t || '').trim(); if (!t || t.length > 60 || lc(t) === lc(word)) return; const k = lc(t); if (!seen.has(k) || seen.get(k).q < q) seen.set(k, {t, q}); };
    if (data.responseData) push(data.responseData.translatedText, data.responseData.match || 0);
    (data.matches || []).forEach(m => push(m.translation, typeof m.match === 'number' ? m.match : 0));
    return Array.from(seen.values()).sort((a, b) => b.q - a.q).slice(0, 5).map(x => x.t);
  } catch (e) { return null; }
}
async function lookupExamples(word){
  const stem = G.declStem(lc(word));
  const queries = [`${word} | ${stem}e | ${stem}en | ${stem}er | ${stem}es`, word];
  for (const q of queries) {
    try {
      const r = await fetch(`https://api.tatoeba.org/unstable/sentences?lang=deu&q=${encodeURIComponent(q)}&sort=relevance&limit=40`);
      if (!r.ok) continue;
      const data = await r.json();
      const seen = new Set();
      const list = (data.data || []).map(s => (s.text || '').trim()).filter(t => {
        if (t.length < 14 || t.length > 120) return false;
        const k = lc(t); if (seen.has(k)) return false; seen.add(k);
        return !!G.findForm(t, word);
      });
      list.sort((a, b) => Math.abs(a.length - 60) - Math.abs(b.length - 60));
      if (list.length) return list.slice(0, 3);
    } catch (e) {}
  }
  return [];
}

/* ======================= PATTERNS ======================= */
function renderPatterns(){
  const mine = id => DB.items.filter(it => it.affix === id);
  view().innerHTML = `
    <div class="page-head"><div><h1>Patterns</h1><p class="lede" style="margin:0">The building elements behind your adjectives. Learn the pattern once and you can build words you have never seen.</p></div></div>
    <div class="cols2">
      <section class="panel">
        <h2>Partizip I or Partizip II?</h2>
        <div class="chain" style="font-size:22px;margin:6px 0 10px"><span class="word">aufreg<span class="m-suf">end</span></span><span class="arr">vs</span><span class="word">auf<span class="m-ge">ge</span>reg<span class="m-suf">t</span></span></div>
        <p><b>-end</b>: the thing causes the feeling. Like English <b>-ing</b>: <span class="word">Der Film ist aufregend.</span></p>
        <p><b>ge-…-t</b>: the person feels it or is in that state. Like English <b>-ed</b>: <span class="word">Die Kinder sind aufgeregt.</span></p>
        <p class="small muted">Same verb, two adjectives: anstrengen gives anstrengend / angestrengt, herausfordern gives herausfordernd / herausgefordert.</p>
        <button class="btn sm" data-act="module" data-mod="p1p2">Drill it</button>
      </section>
      <section class="panel">
        <h2>The linking -s</h2>
        <div class="chain" style="font-size:22px;margin:6px 0 10px"><span class="word"><span class="m-base">zukunft</span><span class="m-fug">s</span><span class="m-suf">fähig</span></span><span class="arr">·</span><span class="word"><span class="m-base">anspruch</span><span class="m-fug">s</span><span class="m-suf">voll</span></span></div>
        <p>Before -fähig, -voll, -los, -reich and -frei, many nouns take an <b>s</b>: always after <b>-ung, -heit, -keit, -schaft, -ion, -tät</b>, and after some single nouns such as Arbeit, Zukunft, Anspruch.</p>
        <p class="small muted">No s after most short nouns: sinnvoll, wertlos, erfolgreich, fehlerfrei.</p>
        <button class="btn sm" data-act="module" data-mod="build">Drill it</button>
      </section>
    </div>
    <section class="panel" style="margin-top:14px">
      <h2>Adjective endings</h2>
      <p class="small muted">The ending depends on the article in front: a definite article already shows the case, so the adjective takes a weak ending; with no article the adjective has to show the case itself.</p>
      <div class="cols2">${endingTable('def', null, null)}${endingTable('indef', null, null)}</div>
      <div style="margin-top:12px">${endingTable('zero', null, null)}</div>
    </section>
    ${AFFIX_GROUPS.map(g => `
      <div class="pgroup"><h2>${esc(g.title)}</h2><p class="muted" style="max-width:70ch">${esc(g.blurb)}</p>
      <div class="pgrid">${AFFIXES.filter(a => a.group === g.id).map(a => {
        const my = mine(a.id); const p = DB.patterns[a.id];
        const role = a.kind === 'prefix' ? 'pre' : (a.kind === 'p2' ? 'ge' : 'suf');
        return `<article class="pcard">
          <div class="affix ${role}">${esc(a.form)}</div>
          <div class="mean">${esc(a.meaning)}</div>
          <div class="pn">${esc(a.note)}</div>
          <div class="exs">${a.ex.slice(0, 6).map(e => `<span>${libWordHtml(e, a)} <span class="muted small">${esc(e.en)}</span></span>`).join('')}</div>
          ${my.length ? `<div class="mine">Your words: ${my.map(it => `<button class="tag" data-act="open-word" data-id="${esc(it.id)}">${esc(it.w)}</button>`).join(' ')}</div>` : ''}
          ${p && p.n ? `<div class="acc">Built correctly ${p.ok} of ${p.n} times</div>` : ''}
          <div><button class="btn sm" data-act="module" data-mod="affix" data-arg="${esc(a.id)}">Drill this pattern</button></div>
        </article>`;
      }).join('')}</div></div>`).join('')}`;
}

/* ======================= STATS ======================= */
function renderStats(){
  const items = DB.items;
  const now = Date.now();
  const due = items.filter(isDue).length, fresh = items.filter(isNew).length;
  const mastered = items.filter(it => !isNew(it) && it.srs.box >= 5).length;
  const todayN = DB.log[dateKey()] || 0;
  const boxes = [1,2,3,4,5,6].map(b => items.filter(it => !isNew(it) && it.srs.box === b).length);
  const maxBox = Math.max(1, fresh, ...boxes);
  const since = now - 30 * DAY;
  const ev = DB.events.filter(e => e.t >= since);
  const cats = ['direct','family','usage','transfer'].map(k => [k, ev.filter(e => e.k === k).length]);
  const maxCat = Math.max(1, ...cats.map(c => c[1]));
  const skillAgg = LOOP_ORDER.map(k => { let n = 0, ok = 0; items.forEach(it => { const s = it.skills[k]; if (s) { n += s.n; ok += s.ok; } }); return [k, n, ok]; }).filter(x => x[1]);
  const pats = Object.entries(DB.patterns).filter(([, p]) => p.n).map(([k, p]) => [k, p.n, p.ok]).sort((a, b) => a[2] / a[1] - b[2] / b[1]);
  const recentFail = {};
  DB.events.filter(e => e.t > now - 14 * DAY && e.id && !e.id.startsWith('lib:')).forEach(e => { (recentFail[e.id] = recentFail[e.id] || []).push(e.k); });
  const revisit = Object.entries(recentFail).map(([id, ks]) => [getItem(id), ks]).filter(x => x[0]).sort((a, b) => b[1].length - a[1].length).slice(0, 10);
  const days = []; for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push([d, DB.log[dateKey(d.getTime())] || 0]); }
  const maxDay = Math.max(1, ...days.map(d => d[1]));
  const lastSync = Sync.lastOk ? new Date(Sync.lastOk).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : null;
  view().innerHTML = `
    <div class="page-head"><div><h1>Stats</h1><p class="lede" style="margin:0">Where your adjectives stand, and what kind of mistake you make most.</p></div></div>
    <div class="stat-grid">
      <div class="kpi"><b>${items.length}</b><span>adjectives</span></div>
      <div class="kpi"><b>${due}</b><span>due now</span></div>
      <div class="kpi"><b>${fresh}</b><span>not started</span></div>
      <div class="kpi"><b>${mastered}</b><span>in box 5 or 6</span></div>
      <div class="kpi"><b>${todayN}</b><span>answers today</span></div>
      <div class="kpi"><b>${streak()}</b><span>day streak</span></div>
    </div>
    <div class="cols2">
      <section class="panel"><h2>Boxes</h2>
        <div class="hbars">
          <span>Not started</span><span class="track"><i style="width:${fresh / maxBox * 100}%;background:var(--base)"></i></span><span>${fresh}</span>
          ${boxes.map((n, i) => `<span>Box ${i + 1} <span class="muted small">${['today','1 day','3 days','1 week','2 weeks','1 month'][i]}</span></span><span class="track"><i style="width:${n / maxBox * 100}%;background:var(--suf)"></i></span><span>${n}</span>`).join('')}
        </div></section>
      <section class="panel"><h2>Kinds of mistakes, last 30 days</h2>
        <div class="hbars">${cats.map(([k, n]) => `<span>${esc(CAT_LABEL[k])}</span><span class="track"><i style="width:${n / maxCat * 100}%;background:var(--pre)"></i></span><span>${n}</span>`).join('')}</div>
        <p class="small muted" style="margin-top:10px">A forgotten word goes back to box 1. A family or usage slip only moves it down one box, and related words get a quick check the next day instead of being failed with it.</p>
      </section>
    </div>
    <div class="cols2" style="margin-top:14px">
      <section class="panel"><h2>Skills</h2>
        ${skillAgg.length ? `<div class="hbars">${skillAgg.map(([k, n, ok]) => `<span>${SKILL_LABEL[k]}</span><span class="track"><i style="width:${ok / n * 100}%;background:var(--suf)"></i></span><span>${Math.round(ok / n * 100)}%</span>`).join('')}</div>` : '<p class="muted">Answer a few questions to see your skills.</p>'}
      </section>
      <section class="panel"><h2>Patterns</h2>
        ${pats.length ? `<div class="hbars">${pats.slice(0, 10).map(([k, n, ok]) => `<span class="word">${esc(optLabel(k))}</span><span class="track"><i style="width:${ok / n * 100}%;background:var(--base)"></i></span><span>${ok}/${n}</span>`).join('')}</div>` : '<p class="muted">The derivation lab records how well you build each pattern.</p>'}
      </section>
    </div>
    <div class="cols2" style="margin-top:14px">
      <section class="panel"><h2>Words to revisit</h2>
        ${revisit.length ? `<ul class="weak-list">${revisit.map(([it, ks]) => `<li><button class="tag" data-act="open-word" data-id="${esc(it.id)}">${esc(it.w)}</button><span class="muted small">${esc(uniq(ks).map(k => ({direct:'forgot', family:'family', usage:'usage', transfer:'transfer'}[k])).join(', '))}</span></li>`).join('')}</ul>` : '<p class="muted">No mistakes in the last two weeks.</p>'}
      </section>
      <section class="panel"><h2>Last 14 days</h2>
        <div class="act">${days.map(([d, n]) => `<div class="${n ? '' : 'zero'}" style="height:${Math.max(3, n / maxDay * 100)}%" title="${d.toLocaleDateString()}: ${n}"></div>`).join('')}</div>
        <div class="act-lab"><span>${days[0][0].toLocaleDateString([], {day:'numeric', month:'short'})}</span><span>today</span></div>
      </section>
    </div>
    <section class="panel" style="margin-top:14px"><h2>Your data</h2>
      <p class="small muted">Saved in this browser${Sync.state === 'ok' ? ` and in the cloud${lastSync ? ' (last sync ' + lastSync + ')' : ''}` : ''}. Export a backup now and then.</p>
      <div class="btn-row">
        <button class="btn sm" data-act="export-json">Export backup (JSON)</button>
        <button class="btn sm" data-act="export-csv">Export spreadsheet (CSV)</button>
        <button class="btn sm" data-act="import">Import JSON or CSV</button>
        <button class="btn sm" data-act="sync-open">Sync settings</button>
        <button class="btn sm quiet" data-act="reseed">Restore the starter words</button>
      </div>
      <p class="small muted" style="margin-top:10px">CSV columns: word, meaning, chapter, page, source, type, base, element, blocks, spelling_note, family, partner, synonyms, opposites, nouns, phrases, prepositions, examples. Lists inside a cell are separated by semicolons.</p>
    </section>`;
}

/* ======================= import / export ======================= */
function download(name, text, type){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type}));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
const CSV_COLS = ['word','meaning','chapter','page','source','type','base','element','blocks','spelling_note','family','partner','synonyms','opposites','nouns','phrases','prepositions','examples'];
function csvCell(v){ const s = String(v == null ? '' : v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function exportCSV(){
  const rows = [CSV_COLS.join(',')];
  DB.items.forEach(it => rows.push([it.w, it.en, it.chapter, it.page, it.source, it.kind, it.base, it.affix, it.parts.length > 1 ? it.parts.join('|') : '', it.change,
    it.family.join('; '), it.partner, it.syn.join('; '), it.ant.join('; '), it.nouns.join('; '), it.phrases.join('; '),
    it.prep.map(p => `${p.p}+${p.c}: ${p.ex}`).join('; '), it.ex.join('; ')].map(csvCell).join(',')));
  download(`morphodeutsch-${dateKey()}.csv`, '﻿' + rows.join('\n'), 'text/csv');
}
function parseCSV(text){
  const rows = []; let row = [], cell = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
function importCSV(text){
  const rows = parseCSV(text);
  if (!rows.length) return 0;
  let head = rows[0].map(h => lc(h.trim()));
  let start = 1;
  if (!head.includes('word')) { head = CSV_COLS; start = 0; }
  const col = (r, n) => { const i = head.indexOf(n); return i >= 0 ? (r[i] || '').trim() : ''; };
  const L = s => s.split(';').map(x => x.trim()).filter(Boolean);
  let n = 0;
  for (const r of rows.slice(start)) {
    const w = lc(col(r, 'word')); if (!w || /\s/.test(w)) continue;
    const d = G.analyze(w, deckWords());
    const blocks = col(r, 'blocks').split('|').map(s => s.trim()).filter(Boolean);
    const kind = col(r, 'type') || d.kind;
    const fields = {w, en:col(r, 'meaning') || d.en || '', chapter:col(r, 'chapter'), page:col(r, 'page'), source:col(r, 'source') || 'Aspekte Beruf B2',
      kind, base:col(r, 'base') || d.base, affix:col(r, 'element') || d.affix, parts:blocks.length > 1 && blocks.join('') === w ? blocks : d.parts,
      change:col(r, 'spelling_note') || d.change || '', family:L(col(r, 'family')), partner:col(r, 'partner'), syn:L(col(r, 'synonyms')), ant:L(col(r, 'opposites')),
      nouns:L(col(r, 'nouns')), phrases:L(col(r, 'phrases')), ex:L(col(r, 'examples')),
      prep:L(col(r, 'prepositions')).map(s => { const m = s.match(/^(\S+)\s*\+\s*([ADG])\s*:?\s*(.*)$/); return m ? {p:m[1], c:m[2], ex:m[3], en:''} : null; }).filter(Boolean)};
    const ex = DB.items.find(x => lc(x.w) === w);
    if (ex) { for (const [k, v] of Object.entries(fields)) { if (Array.isArray(v) ? v.length : v) ex[k] = v; } touch(ex); }
    else DB.items.push(normalize(Object.assign({id:uid(), created:Date.now()}, fields)));
    n++;
  }
  return n;
}
function importFile(file){
  const rd = new FileReader();
  rd.onload = () => {
    const text = String(rd.result || '');
    try {
      if (/\.json$/i.test(file.name) || /^\s*\{/.test(text)) {
        const doc = JSON.parse(text);
        if (!Array.isArray(doc.items)) throw new Error('no items');
        const before = DB.items.length;
        const merged = mergeDB(DB, doc); merged.seeded = DB.seeded; merged.settings = DB.settings; DB = merged;
        save(); toast(`Imported. ${DB.items.length - before} new words, existing ones updated where the file was newer.`);
      } else {
        const n = importCSV(text); save(); toast(`${n} rows imported.`);
      }
      route();
    } catch (e) { toast('That file could not be read. Use a MorphoDeutsch JSON backup or a CSV with a "word" column.'); }
  };
  rd.readAsText(file);
}

/* ======================= actions ======================= */
const ACT = {
  'speak': el => speak(el.dataset.text),
  'sheet-close': () => closeSheet(),
  'size': el => { UI.size = +el.dataset.n; saveUI(); renderPracticeHome(); },
  'start-review': () => startReview(UI.size || 12),
  'module': el => { closeSheet(); startModule(el.dataset.mod, el.dataset.arg); },
  'quit': () => { if (S && S.results.length) endSession(); else quitSession(); },
  'done': () => quitSession(),
  'next': () => nextCard(),
  'opt': el => handleOpt(+el.dataset.i),
  'b-step1': el => handleStep1(+el.dataset.i),
  'b-chip': el => handleBuild('chip', +el.dataset.i),
  'b-undo': () => handleBuild('undo'),
  'b-clear': () => handleBuild('clear'),
  'b-check': () => handleBuild('check'),
  'type-check': () => handleTyped(false),
  'give-up': () => handleTyped(true),
  'hint': () => { const ex = cur(); if (!ex || ex.done) return; const target = ex.type === 'cloze' ? ex.data.form : getItem(ex.id).w; ex.data.hint = Math.min(target.length - 1, (ex.data.hint || 0) + 1); const v = $('#ans') ? $('#ans').value : ''; $('#exCard').innerHTML = exHtml(ex); const a = $('#ans'); if (a) { a.value = v; a.focus(); } },
  'end-pick': el => handleEnding(el.dataset.e),
  'end-hint': () => { const h = $('#endHint'); if (h) h.hidden = false; },
  'v-prep': el => { const ex = cur(); if (ex.done) return; ex.data.pp = el.dataset.p; $('#exCard').innerHTML = exHtml(ex); },
  'v-case': el => { const ex = cur(); if (ex.done) return; ex.data.cc = el.dataset.c; $('#exCard').innerHTML = exHtml(ex); },
  'v-check': () => { const ex = cur(); if (ex.done) return; const d = ex.data; const ok = d.pp === d.p && d.cc === d.c; $$('#exCard button').forEach(b => b.disabled = true); finish(ex, ok, {}); },
  'prod-check': () => handleProduce(false),
  'skip': () => handleProduce(true),
  'override': () => overrideLast(),
  'ins': el => { const t = document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName) ? document.activeElement : ($('#ans') || $('#prod') || $('#f_w')); if (!t) return; const s = t.selectionStart ?? t.value.length, e = t.selectionEnd ?? t.value.length; t.value = t.value.slice(0, s) + el.dataset.ch + t.value.slice(e); t.focus(); t.setSelectionRange(s + 1, s + 1); t.dispatchEvent(new Event('input')); },
  'open-word': el => openWord(el.dataset.id),
  'practise-word': el => { closeSheet(); startModule('word', el.dataset.id); },
  'edit-word': el => { closeSheet(); location.hash = '#add/' + encodeURIComponent(el.dataset.id); },
  'delete-word': el => confirmDelete(el.dataset.id),
  'delete-yes': el => { const id = el.dataset.id; DB.items = DB.items.filter(it => it.id !== id); DB.deleted[id] = Date.now(); save(); closeSheet(); toast('Deleted.'); route(); },
  'wfilter': el => { UI.wordsFilter = el.dataset.f; saveUI(); renderWords(); },
  'save-word': () => saveWord(),
  'bulk-add': () => bulkAdd(),
  'add-prep': () => addPrepRow(null),
  'del-prep': el => el.closest('.prep-row').remove(),
  'suggest-meaning': async () => {
    const w = $('#f_w').value.trim(); const box = $('#meanSg');
    if (!w) { toast('Type the adjective first.'); return; }
    box.innerHTML = '<span class="spin"></span>';
    const list = await meaningSuggestions(w);
    if (list === null) { box.innerHTML = '<span class="small muted">The dictionary could not be reached. Type the meaning yourself.</span>'; return; }
    box.innerHTML = list.length ? list.map(t => `<button type="button" data-act="use-meaning" data-t="${esc(t)}">${esc(t)}</button>`).join('') + '<span class="small muted" style="width:100%">Machine translation: check it fits.</span>' : '<span class="small muted">No suggestion found.</span>';
  },
  'use-partner': el => { $('#f_partner').value = el.dataset.w; ADD.dirty.add('partner'); renderDetect(); },
  'use-meaning': el => { $('#f_en').value = el.dataset.t; $('#meanSg').innerHTML = ''; },
  'fetch-ex': async () => {
    const w = $('#f_w').value.trim(); if (!w) { toast('Type the adjective first.'); return; }
    const note = $('#exNote'); note.innerHTML = '<span class="spin"></span> Looking up…';
    const ex = await lookupExamples(w);
    if (ex.length) { const t = $('#f_ex'); t.value = uniq([...splitLines(t.value), ...ex]).join('\n'); note.textContent = 'Real sentences from the Tatoeba database. Edit freely.'; }
    else note.textContent = 'No sentences found. Write your own, or take one from the book.';
  },
  'export-json': () => download(`morphodeutsch-${dateKey()}.json`, JSON.stringify(docOf(DB), null, 1), 'application/json'),
  'export-csv': () => exportCSV(),
  'import': () => $('#importFile').click(),
  'sync-open': () => openSyncDialog(),
  'sync-save': () => { const k = $('#syncKey').value.trim(); if (k) lsSet(KEY_SYNC, k); closeSheet(); Sync.badge('saving'); Sync.run(); },
  'sync-forget': () => { try { localStorage.removeItem(KEY_SYNC); } catch (e) {} closeSheet(); toast('Sync key removed from this device.'); Sync.run(); },
  'reseed': () => { const n = seedDeck(true); save(); toast(n ? `${n} starter words restored.` : 'All starter words are already there.'); route(); }
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el) {
    if (el.tagName === 'A') return;
    const fn = ACT[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
    return;
  }
  if (e.target.id === 'sheet') closeSheet();
});
document.addEventListener('pointerdown', e => { if (e.target.closest('[data-act="ins"]')) e.preventDefault(); });
document.addEventListener('keydown', e => {
  if (!$('#sheet').hidden && e.key === 'Escape') { closeSheet(); return; }
  if (currentTab !== 'practice' || !S || S.finished || !$('#sheet').hidden) return;
  const ex = cur(); if (!ex) return;
  const typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '');
  if (e.key === 'Enter' && !e.shiftKey) {
    if (ex.done || ex.type === 'intro') { e.preventDefault(); nextCard(); return; }
    if (typing && document.activeElement.id === 'ans') { e.preventDefault(); handleTyped(false); return; }
    if ((ex.type === 'build' || ex.type === 'transfer') && ex.data.built && ex.data.built.length && !typing) { e.preventDefault(); handleBuild('check'); return; }
    return;
  }
  if (typing || ex.done) return;
  if (/^[1-9]$/.test(e.key)) {
    const k = +e.key - 1;
    if (ex.type === 'ending') { const b = $$('#exCard .endings .blk')[k]; if (b) b.click(); return; }
    if ((ex.type === 'build' || ex.type === 'transfer') && !(ex.data.step1 && ex.data.s1 === null)) { const b = $$('#exCard .tray .blk')[k]; if (b) b.click(); return; }
    const b = $$('#exCard .opt:not(:disabled)')[k]; if (b) b.click();
  }
  if (e.key === 'Backspace' && (ex.type === 'build' || ex.type === 'transfer')) { e.preventDefault(); handleBuild('undo'); }
});
$('#importFile').addEventListener('change', e => { const f = e.target.files[0]; if (f) importFile(f); e.target.value = ''; });
$('#syncBtn').addEventListener('click', () => { if (['auth','setup','err','local'].includes(Sync.state)) openSyncDialog(); else Sync.run(); });
$('#themeBtn').addEventListener('click', () => {
  const curT = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = curT === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next); lsSet(KEY_THEME, next);
});

const VIEWS = {practice:renderPractice, words:renderWords, add:renderAdd, patterns:renderPatterns, stats:renderStats};

/* ======================= boot ======================= */
(function boot(){
  // data self-check: every parts array must spell its word
  const bad = [];
  AFFIXES.forEach(a => a.ex.forEach(e => { if (e.parts.join('') !== e.w) bad.push(e.w); }));
  SEED.forEach(s => { if (s.parts.join('') !== s.w) bad.push(s.w); });
  if (bad.length) console.error('MorphoDeutsch: parts do not spell the word:', bad);
  load();
  window.addEventListener('hashchange', () => { if (!$('#sheet').hidden) closeSheet(); if (!location.hash.startsWith('#practice') && S && S.finished) S = null; route(); });
  route();
  updateBadges();
  Sync.run();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') Sync.schedule(300); });
  window.addEventListener('online', () => Sync.schedule(300));
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  if ('speechSynthesis' in window) speechSynthesis.getVoices();
})();
