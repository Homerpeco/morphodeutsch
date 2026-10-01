/* MorphoDeutsch — AI analysis review.
   The AI suggests; the learner decides. Nothing is saved until "Save to my words".
   Loaded after app.js and uses its globals (DB, save, openSheet, toast, esc, G, …). */
'use strict';

let REV = null; // {word, itemId, base:{chapter,source,page}, data, model, busy, existing:[{de,en,on}]}

const REGEN_LABEL = {relations:'Synonyms and opposites', examples:'Examples', collocations:'Collocations and nouns', family:'Word family', grammar:'Grammar', formation:'Building blocks'};
const TYPE_LABEL = {direct:'direct family', derived:'derived form', compound:'compound', semantic:'related in meaning'};
const REG_LABEL = {common:'common', formal:'formal', informal:'informal', literary:'literary', technical:'technical', 'context-dependent':'depends on context'};

function aiHeaders(){ const h = {'content-type':'application/json'}; const k = lsGet(KEY_SYNC); if (k) h['x-sync-key'] = k; return h; }

// one call to /api/enrich; returns {data, model} or throws {msg, kind}
async function aiRequest(word, section, draft){
  if (location.protocol === 'file:') throw {kind:'local', msg:'AI analysis works on the website version of MorphoDeutsch.'};
  let r;
  try {
    r = await fetch('/api/enrich', {method:'POST', headers:aiHeaders(), body:JSON.stringify({word, section, draft})});
  } catch (e) { throw {kind:'net', msg:'The server could not be reached. Check your connection and try again.'}; }
  let j = {};
  try { j = await r.json(); } catch (e) {}
  if (r.ok && j.ok) return j;
  if (r.status === 404) throw {kind:'local', msg:'This copy of the app has no AI endpoint. Use morphodeutsch.vercel.app.'};
  if (r.status === 401) throw {kind:'auth', msg:'Enter your sync key first: the AI uses the same key, so nobody else can use your Gemini quota.'};
  if (r.status === 503 && /ai not configured/.test(j.error || '')) throw {kind:'setup', msg:'The AI is not set up on the server yet. In Vercel, open the morphodeutsch project, add the environment variable GEMINI_API_KEY (your Google AI Studio key) and redeploy.'};
  if (r.status === 503) throw {kind:'setup', msg:'Set the SYNC_KEY on the server first (Vercel → morphodeutsch → Environment Variables).'};
  if (r.status === 429) throw {kind:'quota', msg:`Gemini's quota is used up for the moment. Try again in about ${j.retryAfter || 60} seconds.`};
  throw {kind:'fail', msg:(j.error || 'The AI analysis failed') + '. Try again in a moment.'};
}

/* ---------- prepare / merge ---------- */
function prepFormation(f, currentKind){ f.on = f.kind !== 'simple' || currentKind === 'simple' || !currentKind; return f; }
function prepMeaning(m){
  m.on = true;
  m.collocations = m.collocations.map(t => typeof t === 'string' ? {t, on:true} : t);
  m.nouns = m.nouns.map(t => typeof t === 'string' ? {t, on:true} : t);
  m.synonyms.forEach(s => { if (s.on == null) s.on = s.confidence !== 'low'; });
  m.antonyms.forEach(s => { if (s.on == null) s.on = s.confidence !== 'low'; });
  m.prepositions.forEach(p => { if (p.on == null) p.on = true; });
  m.examples.forEach(e => { if (e.on == null) e.on = !e.check; });
  return m;
}
function prepare(d, item){
  prepFormation(d.formation, item && item.kind);
  d.meanings.forEach(prepMeaning);
  d.family.forEach(f => { f.on = f.confidence !== 'low'; });
  d.partner.on = !!d.partner.w;
  d.grammar.on = !!(d.grammar.predicative || d.grammar.attributive || d.grammar.notes.length);
  return d;
}
function draftForServer(){
  const d = REV.data;
  const on = a => a.filter(x => x.on);
  return {word:d.word, formation:d.formation,
    meanings:d.meanings.map(m => ({id:m.id, gloss:m.gloss, register:m.register,
      synonyms:m.synonyms.map(s => ({w:s.w})), antonyms:m.antonyms.map(s => ({w:s.w})),
      examples:m.examples.map(e => ({de:e.de})), collocations:m.collocations.map(c => c.t), nouns:m.nouns.map(n => n.t)})),
    family:d.family.map(f => ({w:f.w, type:f.type}))};
}
function mergeSection(sec, fresh){
  const d = REV.data;
  if (sec === 'formation') { d.formation = prepFormation(fresh.formation, 'simple'); return; }
  if (sec === 'family') { fresh.family.forEach(f => { f.on = f.confidence !== 'low'; }); d.family = fresh.family; return; }
  if (sec === 'grammar') { d.grammar = fresh.grammar; d.grammar.on = true; return; }
  for (const m of d.meanings) {
    const n = fresh.meanings.find(x => x.id === m.id) || fresh.meanings[d.meanings.indexOf(m)];
    if (!n) continue;
    prepMeaning(n);
    if (sec === 'relations') { m.synonyms = n.synonyms; m.antonyms = n.antonyms; }
    if (sec === 'examples') { m.examples = [...m.examples.filter(e => e.own || e.edited), ...n.examples]; }
    if (sec === 'collocations') { m.collocations = n.collocations; m.nouns = n.nouns; }
  }
}

/* ---------- start ---------- */
async function startEnrich(word, opts){
  const w = lc((word || '').trim());
  if (!w || /\s/.test(w)) { toast('Type a single adjective first.'); return; }
  const item = opts && opts.itemId ? getItem(opts.itemId) : DB.items.find(x => lc(x.w) === w);
  REV = {word:w, itemId:item ? item.id : null, base:(opts && opts.base) || null, data:null, model:'', busy:'all',
    existing:item ? item.ex.map((de, i) => ({de, en:item.exEn[i] || '', on:true})) : []};
  openSheet(reviewLoading(w));
  try {
    const out = await aiRequest(w, 'all');
    if (!REV || REV.word !== w) return;
    REV.data = prepare(out.data, item); REV.model = out.model; REV.busy = '';
    renderReview();
  } catch (e) {
    if (!REV || REV.word !== w) return;
    REV.busy = '';
    reviewError(e);
  }
}
function reviewLoading(w){
  return `<h2 id="sheetTitle">Analysing <span class="word">${esc(w)}</span></h2>
    <p class="muted"><span class="spin"></span> Finding its meanings, word family, building blocks and examples. This usually takes 10 to 25 seconds.</p>
    <p class="small muted">You will see everything before anything is saved.</p>`;
}
function reviewError(e){
  const w = REV.word;
  $('.sheet').innerHTML = `<button class="icon-btn close" data-act="sheet-close" aria-label="Close">✕</button>
    <h2 id="sheetTitle">No analysis for <span class="word">${esc(w)}</span></h2>
    <p>${esc(e.msg || 'The analysis failed.')}</p>
    <div class="btn-row">${e.kind === 'auth' ? '<button class="btn primary" data-act="sync-open">Enter sync key</button>' : ''}
      ${['net','quota','fail'].includes(e.kind) ? `<button class="btn primary" data-act="rv-retry">Try again</button>` : ''}
      <button class="btn" data-act="sheet-close">Close</button></div>`;
}

/* ---------- render ---------- */
const flag = c => c === 'low' ? '<span class="rv-flag low" title="The AI is unsure. Check before keeping it.">unsure</span>' : (c === 'medium' ? '<span class="rv-flag mid" title="Probably right. Worth a quick check.">check</span>' : '');
function chip(path, text, on, extra, cls){ return `<button type="button" class="rv-chip ${on ? 'on' : ''} ${cls || ''}" data-tog="${path}" aria-pressed="${on}">${esc(text)}${extra || ''}</button>`; }
function addBox(path, ph){ return `<span class="rv-addbox"><input class="rv-add" data-add="${path}" placeholder="${esc(ph)}" aria-label="${esc(ph)}"><button type="button" class="btn quiet sm" data-act="rv-add" data-path="${path}">Add</button></span>`; }
function regenBtn(sec){ const b = REV.busy === sec; return `<button type="button" class="btn quiet sm" data-act="rv-regen" data-sec="${sec}" ${REV.busy ? 'disabled' : ''}>${b ? '<span class="spin"></span> Working…' : 'Regenerate'}</button>`; }

function renderReview(){
  const d = REV.data;
  const sheet = $('.sheet');
  const keepScroll = (sheet.closest('.sheet-wrap').scrollTop || 0) + sheet.scrollTop;
  const f = d.formation;
  const fItem = normalize({w:d.word, kind:f.kind, parts:f.parts});
  const kinds = Object.entries(KIND_LABEL).map(([k, l]) => `<option value="${k}" ${f.kind === k ? 'selected' : ''}>${l}</option>`).join('');
  const item = REV.itemId ? getItem(REV.itemId) : null;
  const mOpts = sel => `<option value="">all meanings</option>` + d.meanings.map((m, i) => `<option value="${esc(m.id)}" ${sel === m.id ? 'selected' : ''}>${i + 1}. ${esc(m.gloss.slice(0, 30))}</option>`).join('');
  sheet.innerHTML = `<button class="icon-btn close" data-act="sheet-close" aria-label="Close">✕</button>
    <div class="detail-head"><h2 id="sheetTitle" class="bigword" style="margin:0">${wordHtml(fItem)}</h2>${speakBtn(d.word)}</div>
    <p class="small muted" style="margin-top:4px">AI suggestions${REV.model ? ' (' + esc(REV.model) + ')' : ''}${item ? ' for a word you already have' : ''}. Tap to switch items off or on, edit any text, then save. Nothing is stored until you do.
      <button class="btn quiet sm" data-act="rv-restart" ${REV.busy ? 'disabled' : ''}>Analyse again</button></p>
    ${!d.isAdjective ? '<div class="rv-warn">The AI thinks this may not be an adjective, or it is misspelled. Check the word.</div>' : ''}
    ${d.uncertain.length ? `<div class="rv-warn"><b>Please confirm</b><ul>${d.uncertain.map(u => `<li>${esc(u)}</li>`).join('')}</ul></div>` : ''}

    <section class="rv-sec">
      <div class="rv-head"><h3>Meanings</h3><span class="small muted">${d.meanings.length} found</span></div>
      <div class="rv-tools"><span class="small muted">Regenerate for all meanings:</span>
        ${['relations','examples','collocations'].map(s => `<button type="button" class="btn quiet sm" data-act="rv-regen" data-sec="${s}" ${REV.busy ? 'disabled' : ''}>${REV.busy === s ? '<span class="spin"></span> ' : ''}${REGEN_LABEL[s]}</button>`).join('')}</div>
      ${d.meanings.map((m, i) => `
        <div class="rv-meaning ${m.on ? '' : 'off'}">
          <div class="rv-mhead">
            <label class="rv-check"><input type="checkbox" data-on="meanings.${i}" ${m.on ? 'checked' : ''}><span class="rv-num">${i + 1}</span></label>
            <input class="txt rv-gloss" data-rv="meanings.${i}.gloss" value="${esc(m.gloss)}" aria-label="Meaning ${i + 1}">
            <span class="pill">${esc(REG_LABEL[m.register] || m.register)}</span>
          </div>
          ${m.note ? `<p class="small muted rv-note">${esc(m.note)}</p>` : ''}
          <div class="rv-sub">Collocations</div>
          <div class="rv-chips">${m.collocations.map((c, j) => chip(`meanings.${i}.collocations.${j}`, c.t, c.on)).join('')}${addBox(`meanings.${i}.collocations`, 'Add a collocation')}</div>
          <div class="rv-sub">Near-synonyms <span class="muted">for this meaning</span></div>
          <div class="rv-chips">${m.synonyms.map((s, j) => chip(`meanings.${i}.synonyms.${j}`, '≈ ' + s.w, s.on, flag(s.confidence), 'syn')).join('') || '<span class="small muted">none</span>'}${addBox(`meanings.${i}.synonyms`, 'Add')}</div>
          <div class="rv-sub">Opposites</div>
          <div class="rv-chips">${m.antonyms.map((s, j) => chip(`meanings.${i}.antonyms.${j}`, '≠ ' + s.w, s.on, flag(s.confidence), 'ant')).join('') || '<span class="small muted">none</span>'}${addBox(`meanings.${i}.antonyms`, 'Add')}</div>
          <div class="rv-sub">Typical nouns <span class="muted">(used for the endings drill)</span></div>
          <div class="rv-chips">${m.nouns.map((n, j) => chip(`meanings.${i}.nouns.${j}`, n.t, n.on)).join('') || '<span class="small muted">none</span>'}${addBox(`meanings.${i}.nouns`, 'der Ort, -e')}</div>
          ${m.prepositions.length ? `<div class="rv-sub">With a preposition</div><div class="rv-chips">${m.prepositions.map((p, j) => chip(`meanings.${i}.prepositions.${j}`, `${p.pattern || (d.word + ' ' + p.p + ' + ' + G.CASE_EN[p.c])}`, p.on)).join('')}</div>` : ''}
          <div class="rv-sub">Examples</div>
          ${m.examples.map((e, j) => `
            <div class="rv-ex ${e.on ? '' : 'off'}">
              <label class="rv-check"><input type="checkbox" data-on="meanings.${i}.examples.${j}" ${e.on ? 'checked' : ''} aria-label="Keep this example"></label>
              <div class="rv-exfields">
                <textarea class="txt" rows="2" data-rv="meanings.${i}.examples.${j}.de" aria-label="German sentence">${esc(e.de)}</textarea>
                <input class="txt rv-en" data-rv="meanings.${i}.examples.${j}.en" value="${esc(e.en)}" placeholder="English translation" aria-label="English translation">
                <div class="small muted">${esc(e.own ? 'your own' : (e.edited ? 'edited by you' : e.context))}${e.check ? ' · <span class="rv-flag low">the word is not used as an adjective here</span>' : ''}</div>
              </div>
            </div>`).join('')}
          <div class="rv-own">
            <textarea class="txt" rows="2" id="own-de-${i}" placeholder="Add your own German example"></textarea>
            <input class="txt rv-en" id="own-en-${i}" placeholder="English (optional)">
            <button type="button" class="btn sm" data-act="rv-own" data-i="${i}">Add example</button>
          </div>
        </div>`).join('')}
    </section>

    <section class="rv-sec">
      <div class="rv-head"><h3>Word family</h3>${regenBtn('family')}</div>
      <p class="small muted">Only real relatives count as family. "Related in meaning" words are shown on the card but not drilled as family.</p>
      ${d.family.map((x, i) => `
        <div class="rv-fam ${x.on ? '' : 'off'}">
          <label class="rv-check"><input type="checkbox" data-on="family.${i}" ${x.on ? 'checked' : ''} aria-label="Keep ${esc(x.w)}"></label>
          <input class="txt" data-rv="family.${i}.w" value="${esc(x.w)}" aria-label="Word">
          <select class="txt" data-rv="family.${i}.type" aria-label="Relation">${Object.entries(TYPE_LABEL).map(([k, l]) => `<option value="${k}" ${x.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <input class="txt" data-rv="family.${i}.gloss" value="${esc(x.gloss)}" placeholder="English" aria-label="English meaning">
          <select class="txt" data-rv="family.${i}.meaning" aria-label="Meaning">${mOpts(x.meaning)}</select>
          <span>${flag(x.confidence)}${x.note ? `<span class="small muted"> ${esc(x.note)}</span>` : ''}</span>
        </div>`).join('') || '<p class="muted">No family members suggested.</p>'}
      <div class="rv-addfam">${addBox('family', 'Add a family word, e.g. die Entfernung')}</div>
    </section>

    <section class="rv-sec">
      <div class="rv-head"><h3>How it is built</h3>${regenBtn('formation')}</div>
      <label class="rv-row"><input type="checkbox" data-on="formation" ${f.on ? 'checked' : ''}> Use this analysis${item ? ' (replaces the current one)' : ''} ${flag(f.confidence)}</label>
      <div class="rv-blocks">${G.segment(fItem).map(([t, r]) => blk(t, r, 'sm')).join('<span class="plus">+</span>')}</div>
      ${f.explanation ? `<p class="small">${esc(f.explanation)}</p>` : ''}
      <div class="grid3">
        <div class="field"><label>Type</label><select class="txt" data-rv="formation.kind">${kinds}</select></div>
        <div class="field"><label>Base word</label><input class="txt" data-rv="formation.base" value="${esc(f.base)}"></div>
        <div class="field"><label>Blocks</label><input class="txt" data-rv="formation.parts" value="${esc(f.parts.join(' | '))}" autocapitalize="off" spellcheck="false"></div>
      </div>
      ${['p1','p2'].includes(f.kind) || d.partner.w ? `<label class="rv-row"><input type="checkbox" data-on="partner" ${d.partner.on ? 'checked' : ''}> Participle partner <input class="txt rv-inline" data-rv="partner.w" value="${esc(d.partner.w)}" placeholder="none"></label>${d.partner.note ? `<p class="small muted">${esc(d.partner.note)}</p>` : ''}` : ''}
    </section>

    <section class="rv-sec">
      <div class="rv-head"><h3>Grammar</h3>${regenBtn('grammar')}</div>
      <label class="rv-row"><input type="checkbox" data-on="grammar" ${d.grammar.on ? 'checked' : ''}> Keep on the word card</label>
      <div class="grid2">
        <div class="field"><label>Predicative</label><input class="txt" data-rv="grammar.predicative" value="${esc(d.grammar.predicative)}"></div>
        <div class="field"><label>Attributive</label><input class="txt" data-rv="grammar.attributive" value="${esc(d.grammar.attributive)}"></div>
      </div>
      <div class="field"><label>Comparison</label><input class="txt" data-rv="grammar.comparison" value="${esc(d.grammar.comparison)}"></div>
      <div class="field"><label>Notes <span class="muted small">(one per line)</span></label><textarea class="txt" rows="3" data-rv="grammar.notes">${esc(d.grammar.notes.join('\n'))}</textarea></div>
    </section>

    ${REV.existing.length ? `<section class="rv-sec"><div class="rv-head"><h3>Your current examples</h3></div>
      <p class="small muted">Untick any that should go, for example sentences where the word is really a verb.</p>
      ${REV.existing.map((e, i) => `<label class="rv-row ${e.on ? '' : 'off'}"><input type="checkbox" data-exist="${i}" ${e.on ? 'checked' : ''}> ${esc(e.de)}</label>`).join('')}</section>` : ''}

    <div class="rv-foot">
      <span style="flex:1"></span>
      <button class="btn" data-act="sheet-close">Cancel</button>
      <button class="btn primary" data-act="rv-save" ${REV.busy ? 'disabled' : ''}>Save to my words</button>
    </div>`;
  const wrap = sheet.closest('.sheet-wrap');
  if (window.innerWidth <= 760) sheet.scrollTop = keepScroll; else wrap.scrollTop = keepScroll;
}

/* ---------- editing ---------- */
function rvGet(path){ return path.split('.').reduce((o, k) => (o == null ? o : o[/^\d+$/.test(k) ? +k : k]), REV.data); }
function rvSet(path, v){
  const ks = path.split('.'); const last = ks.pop();
  const o = ks.reduce((a, k) => a[/^\d+$/.test(k) ? +k : k], REV.data);
  o[/^\d+$/.test(last) ? +last : last] = v;
}
document.addEventListener('input', e => {
  if (!REV || !REV.data) return;
  const el = e.target;
  if (el.dataset.rv) {
    const p = el.dataset.rv;
    if (p === 'formation.parts') rvSet(p, el.value.split(/[|+·]/).map(s => lc(s.trim())).filter(Boolean));
    else if (p === 'grammar.notes') rvSet(p, el.value.split('\n').map(s => s.trim()).filter(Boolean));
    else rvSet(p, el.value);
    const em = p.match(/^meanings\.(\d+)\.examples\.(\d+)\./);
    if (em) { const ex = REV.data.meanings[+em[1]].examples[+em[2]]; if (ex) ex.edited = true; }
    if (p.startsWith('formation.')) { const b = $('.rv-blocks'); if (b) { const f = REV.data.formation; const ok = f.parts.join('') === REV.data.word; b.innerHTML = ok ? G.segment(normalize({w:REV.data.word, kind:f.kind, parts:f.parts})).map(([t, r]) => blk(t, r, 'sm')).join('<span class="plus">+</span>') : '<span class="rv-flag low">The blocks must spell the word exactly</span>'; } }
  }
});
document.addEventListener('change', e => {
  if (!REV || !REV.data) return;
  const el = e.target;
  if (el.dataset.on) {
    const target = rvGet(el.dataset.on);
    if (target) target.on = el.checked;
    const row = el.closest('.rv-meaning, .rv-ex, .rv-fam, .rv-row');
    if (row && !row.classList.contains('rv-row')) row.classList.toggle('off', !el.checked);
  }
  if (el.dataset.exist != null) { REV.existing[+el.dataset.exist].on = el.checked; el.closest('.rv-row').classList.toggle('off', !el.checked); }
  if (el.dataset.rv === 'formation.kind') renderReview();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('rv-add')) { e.preventDefault(); rvAdd(e.target.dataset.add); }
});
function rvAdd(path){
  const inp = $(`.rv-add[data-add="${path}"]`); if (!inp) return;
  const v = inp.value.trim(); if (!v) { inp.focus(); return; }
  const list = rvGet(path);
  if (/synonyms|antonyms/.test(path)) list.push({w:v, note:'', confidence:'high', on:true});
  else if (path === 'family') list.push({w:v, type:'direct', gloss:'', meaning:'', confidence:'high', note:'', on:true});
  else list.push({t:v, on:true});
  renderReview();
  const again = $(`.rv-add[data-add="${path}"]`); if (again) again.focus();
}

Object.assign(ACT, {
  'rv-tog': null,
  'rv-add': el => rvAdd(el.dataset.path),
  'rv-own': el => {
    const i = +el.dataset.i; const de = $('#own-de-' + i).value.trim(); const en = $('#own-en-' + i).value.trim();
    if (!de) { $('#own-de-' + i).focus(); return; }
    REV.data.meanings[i].examples.push({de, en, context:'everyday', own:true, on:true, check:!G.findForm(de, REV.data.word)});
    renderReview();
  },
  'rv-regen': async el => {
    const sec = el.dataset.sec; if (REV.busy) return;
    REV.busy = sec; renderReview();
    try {
      const out = await aiRequest(REV.data.word, sec, draftForServer());
      mergeSection(sec, out.data);
      REV.busy = ''; renderReview(); toast(`${REGEN_LABEL[sec]}: new suggestions.`);
    } catch (e) { REV.busy = ''; renderReview(); toast(e.msg || 'Regeneration failed.'); }
  },
  'rv-restart': () => { if (REV) startEnrich(REV.word, {itemId:REV.itemId, base:REV.base}); },
  'rv-retry': () => { if (REV) startEnrich(REV.word, {itemId:REV.itemId, base:REV.base}); },
  'rv-save': () => saveReview(),
  'ai-add': () => {
    const w = $('#f_w').value.trim();
    startEnrich(w, {base:{chapter:$('#f_ch').value, source:$('#f_src').value.trim(), page:$('#f_page').value.trim(), en:$('#f_en').value.trim()}});
  },
  'ai-word': el => { const it = getItem(el.dataset.id); if (it) startEnrich(it.w, {itemId:it.id}); }
});
// chip toggles (buttons with data-tog)
document.addEventListener('click', e => {
  const b = e.target.closest('[data-tog]'); if (!b || !REV || !REV.data) return;
  const t = rvGet(b.dataset.tog); if (!t) return;
  t.on = !t.on; b.classList.toggle('on', t.on); b.setAttribute('aria-pressed', String(t.on));
});

/* ---------- save ---------- */
function saveReview(){
  const d = REV.data; const w = d.word;
  const on = a => a.filter(x => x.on);
  const ms = on(d.meanings).filter(m => m.gloss.trim());
  if (!ms.length) { toast('Keep at least one meaning.'); return; }
  const meanings = ms.map(m => ({
    id:m.id, gloss:m.gloss.trim(), register:m.register, note:m.note,
    collocations:on(m.collocations).map(c => c.t.trim()).filter(Boolean),
    syn:on(m.synonyms).map(s => s.w.trim()).filter(Boolean),
    ant:on(m.antonyms).map(s => s.w.trim()).filter(Boolean),
    nouns:on(m.nouns).map(n => n.t.trim()).filter(n => G.parseNoun(n) || /\S/.test(n)),
    prep:on(m.prepositions).map(p => ({p:p.p, c:p.c, en:p.pattern || '', ex:p.de, exEn:p.en})),
    examples:on(m.examples).filter(e => e.de.trim()).map(e => ({de:e.de.trim(), en:(e.en || '').trim(), ctx:e.context}))
  }));
  const fam = on(d.family).filter(f => f.w.trim()).map(f => ({w:f.w.trim(), type:f.type, gloss:f.gloss, m:f.meaning}));
  const kept = REV.existing.filter(e => e.on);
  const exPairs = [];
  const seen = new Set();
  [...kept, ...meanings.flatMap(m => m.examples)].forEach(e => { const k = lc(e.de); if (!seen.has(k)) { seen.add(k); exPairs.push(e); } });
  const prepSeen = new Set();
  const fields = {
    w, en:ms.map(m => m.gloss.trim()).join('; '), meanings, familyTyped:fam,
    family:fam.filter(f => f.type !== 'semantic').map(f => f.w),
    syn:uniq(meanings.flatMap(m => m.syn)), ant:uniq(meanings.flatMap(m => m.ant)),
    nouns:uniq(meanings.flatMap(m => m.nouns)), phrases:uniq(meanings.flatMap(m => m.collocations)),
    prep:meanings.flatMap(m => m.prep).filter(p => { const k = p.p + p.c; if (prepSeen.has(k)) return false; prepSeen.add(k); return true; }),
    ex:exPairs.map(e => e.de), exEn:exPairs.map(e => e.en || ''),
    grammar:d.grammar.on ? {predicative:d.grammar.predicative, attributive:d.grammar.attributive, comparison:d.grammar.comparison, notes:d.grammar.notes} : null,
    aiAt:Date.now(), aiModel:REV.model
  };
  const f = d.formation;
  if (f.on) {
    const partsOk = f.parts.join('') === w;
    Object.assign(fields, {kind:f.kind, base:f.base, affix:(f.kind === 'p1' || f.kind === 'p2') ? f.kind : (f.kind === 'simple' || f.kind === 'compound' ? '' : f.affix), parts:partsOk ? f.parts : [w], change:f.change});
  }
  if (d.partner.on && d.partner.w) fields.partner = d.partner.w; else if (!d.partner.on && REV.itemId) fields.partner = '';
  let it = REV.itemId ? getItem(REV.itemId) : DB.items.find(x => lc(x.w) === w);
  if (it) { Object.assign(it, fields); if (!f.on && it.parts.join('') !== it.w) it.parts = [it.w]; touch(it); }
  else {
    const b = REV.base || {};
    it = normalize(Object.assign({id:uid(), created:Date.now(), source:b.source || 'Aspekte Beruf B2', chapter:b.chapter || '', page:b.page || ''}, fields));
    if (!f.on) { const dd = G.analyze(w, analyzeKnown(w)); Object.assign(it, {kind:dd.kind, affix:dd.affix, base:dd.base, parts:dd.parts, change:dd.change || ''}); }
    DB.items.push(it);
  }
  save();
  const id = it.id;
  REV = null;
  closeSheet();
  toast(`${w} saved with ${meanings.length} meaning${meanings.length === 1 ? '' : 's'} and ${fam.length} family word${fam.length === 1 ? '' : 's'}.`);
  if (location.hash !== '#words') location.hash = '#words'; else route();
  setTimeout(() => openWord(id), 80);
}
