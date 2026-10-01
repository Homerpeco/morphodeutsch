// MorphoDeutsch — answer-key audit (regression test).
// Every exercise type, for every word (starter deck, an AI-analysed word, words added through the Add form, and the
// pattern-library words used in transfer challenges), is answered RIGHT and WRONG through the real page, and the verdict
// is checked. Static checks make sure no question has two right answers. Scenario tests replay the bugs that were reported
// (correct build marked wrong after step 1, double taps carried over to the next card).
//
// Run:  node tests/answer-key-audit.mjs
// Needs Playwright with Chromium. Optional: DICT=/path/to/dictionary-de/index.dic to list distractors that are real words.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VARIANTS = +(process.env.VARIANTS || 6);
let pw;
try { pw = await import('playwright'); } catch { pw = await import(process.env.PLAYWRIGHT || '/home/claude/.npm-global/lib/node_modules/playwright/index.js'); }
const chromium = pw.chromium || pw.default.chromium;
const exe = process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
const { normalize } = await import(path.join(ROOT, 'api/_enrich.js'));
const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixture-entfernt.json'), 'utf8'));
const dict = process.env.DICT && fs.existsSync(process.env.DICT)
  ? fs.readFileSync(process.env.DICT, 'utf8').split('\n').slice(1).map(l => l.split('/')[0].trim().toLocaleLowerCase('de-DE')).filter(Boolean)
  : null;

// ---------- static server ----------
const MIME = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.webmanifest':'application/manifest+json'};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('{}'); return; }
  res.writeHead(200, {'content-type': MIME[path.extname(f)] || 'application/octet-stream'});
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch(exe ? {executablePath: exe} : {});
const pageErrors = [];
async function newPage(opts){
  const ctx = await browser.newContext(Object.assign({serviceWorkers:'block', viewport:{width:1280, height:900}}, opts || {}));
  const p = await ctx.newPage();
  p.on('pageerror', e => pageErrors.push(e.message));
  await p.route(/fonts\.g|mymemory|tatoeba/, r => r.abort());
  await p.route('**/api/enrich', r => r.fulfill({status:200, contentType:'application/json', body:JSON.stringify({ok:true, model:'fixture', section:'all', data:normalize(JSON.parse(JSON.stringify(fixture)), 'entfernt')})}));
  return p;
}
let failures = 0;
const ok = (cond, msg) => { if (!cond) { failures++; console.log('  FAIL', msg); } return cond; };

// ---------- words a learner adds through the Add form ----------
const USER_WORDS = [
  {w:'zuverlässig', en:'reliable, dependable', family:'die Zuverlässigkeit, sich verlassen', syn:'verlässlich', ant:'unzuverlässig', nouns:'der Mitarbeiter, -\ndie Lösung, -en', ex:'Sie ist eine sehr zuverlässige Kollegin.\nWir suchen einen zuverlässigen Partner.'},
  {w:'belastbar', en:'resilient, able to cope with pressure', family:'belasten, die Belastung', syn:'', ant:'empfindlich', nouns:'die Mitarbeiterin, -nen', ex:'Für diese Stelle muss man sehr belastbar sein.'},
  {w:'teamfähig', en:'able to work in a team', family:'das Team', syn:'', ant:'', nouns:'der Bewerber, -', ex:'Wir suchen einen teamfähigen Bewerber.'},
  {w:'kompetent', en:'competent', family:'die Kompetenz', syn:'fähig', ant:'inkompetent', nouns:'die Beratung, -en', ex:'Die Beratung war sehr kompetent.'},
  {w:'unbefristet', en:'permanent, open-ended (contract)', family:'die Frist, befristet', syn:'', ant:'befristet', nouns:'der Vertrag, ¨-e\ndie Stelle, -n', ex:'Sie hat einen unbefristeten Vertrag bekommen.'},
  {w:'hilfsbereit', en:'helpful, willing to help', family:'die Hilfe, helfen', syn:'', ant:'', nouns:'der Kollege, -n', ex:'Meine Kollegen sind sehr hilfsbereit.'},
  {w:'verantwortungsvoll', en:'responsible', family:'die Verantwortung, verantworten', syn:'', ant:'verantwortungslos', nouns:'die Aufgabe, -n\ndie Position, -en', ex:'Das ist eine verantwortungsvolle Aufgabe.'},
  {w:'motiviert', en:'motivated', family:'die Motivation, motivieren', syn:'', ant:'unmotiviert', nouns:'das Team, -s', ex:'Das Team ist hoch motiviert.'},
  {w:'überzeugend', en:'convincing', family:'überzeugen, die Überzeugung', syn:'', ant:'', nouns:'das Argument, -e', ex:'Ihre Argumente waren sehr überzeugend.'},
  {w:'abwechslungsreich', en:'varied, full of variety', family:'die Abwechslung, abwechseln', syn:'vielseitig', ant:'eintönig, langweilig', nouns:'die Tätigkeit, -en\ndie Arbeit, -en', ex:'Ich suche eine abwechslungsreiche Tätigkeit.'},
  {w:'regelmäßig', en:'regular', family:'die Regel', syn:'', ant:'unregelmäßig', nouns:'das Treffen, -\ndie Pause, -n', ex:'Wir haben regelmäßige Teamtreffen.'},
  {w:'flexibel', en:'flexible', family:'die Flexibilität', syn:'', ant:'unflexibel', nouns:'die Arbeitszeit, -en', ex:'Wir bieten flexible Arbeitszeiten.'},
  {w:'pünktlich', en:'punctual, on time', family:'der Punkt, die Pünktlichkeit', syn:'', ant:'unpünktlich', nouns:'die Lieferung, -en', ex:'Die Lieferung war pünktlich.'},
  {w:'kostenlos', en:'free of charge', family:'die Kosten', syn:'kostenfrei, gratis', ant:'kostenpflichtig', nouns:'die Beratung, -en\ndas Angebot, -e', ex:'Die Beratung ist kostenlos.'},
  {w:'erfahren', en:'experienced', family:'die Erfahrung', syn:'', ant:'unerfahren', nouns:'der Kollege, -n', ex:'Sie ist eine erfahrene Projektleiterin.'},
  {w:'empfehlenswert', en:'worth recommending', family:'empfehlen, die Empfehlung', syn:'', ant:'', nouns:'das Seminar, -e', ex:'Das Seminar ist sehr empfehlenswert.'},
  {w:'ernsthaft', en:'serious, earnest', family:'der Ernst', syn:'ernst', ant:'', nouns:'das Problem, -e', ex:'Wir haben ein ernsthaftes Problem.'},
  {w:'fehlerfrei', en:'error-free, flawless', family:'der Fehler', syn:'fehlerlos', ant:'fehlerhaft', nouns:'der Text, -e', ex:'Der Text ist fehlerfrei.'},
  {w:'wirtschaftlich', en:'economic; economical', family:'die Wirtschaft', syn:'', ant:'unwirtschaftlich', nouns:'die Lage, -n', ex:'Die wirtschaftliche Lage ist schwierig.'},
  {w:'erreichbar', en:'reachable, available', family:'erreichen', syn:'', ant:'unerreichbar', nouns:'der Ansprechpartner, -', ex:'Ich bin telefonisch erreichbar.'}
];

async function seedDeck(p){
  await p.goto(BASE + 'index.html#practice');
  await p.waitForFunction(() => typeof DB !== 'undefined' && DB.items.length >= 17);
  // the AI-analysed word, saved through the review screen
  await p.goto(BASE + 'index.html#add'); await p.waitForSelector('#f_w');
  await p.fill('#f_w', 'entfernt'); await p.waitForTimeout(400);
  await p.click('[data-act="ai-add"]'); await p.waitForSelector('.rv-meaning', {timeout:5000});
  await p.click('[data-act="rv-save"]'); await p.waitForFunction(() => DB.items.some(i => i.w === 'entfernt'));
  await p.waitForSelector('#sheet:not([hidden]) .mgroup', {timeout:4000});   // the saved word card opens
  await p.evaluate(() => closeSheet());
  // words typed into the Add form, the way a learner does it
  for (const u of USER_WORDS) {
    await p.goto(BASE + 'index.html#add'); await p.waitForSelector('#f_w');
    await p.fill('#f_w', u.w); await p.waitForTimeout(380);
    await p.fill('#f_en', u.en); await p.fill('#f_family', u.family); await p.fill('#f_syn', u.syn); await p.fill('#f_ant', u.ant);
    await p.fill('#f_nouns', u.nouns); await p.fill('#f_ex', u.ex);
    await p.click('[data-act="save-word"]');
    await p.waitForFunction(w => DB.items.some(i => i.w === w), u.w);
  }
  await p.goto(BASE + 'index.html#practice'); await p.waitForTimeout(100);
  return p.evaluate(() => DB.items.map(i => `${i.w} [${i.kind}${i.affix ? ' ' + i.affix : ''}${i.base ? ' ← ' + i.base : ''}] ${i.parts.join('|')}`));
}

// ---------- the in-page audit ----------
async function inPageAudit(opts){
  const out = {runs:0, statics:0, fail:[], review:[], avail:{}, samples:[]};
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const L = s => lc(stripArt(s || ''));
  const allSyn = it => new Set([...(it.syn || []), ...(it.meanings || []).flatMap(m => m.syn || [])].map(L));
  const allAnt = it => new Set([...(it.ant || []), ...(it.meanings || []).flatMap(m => m.ant || [])].map(L));
  const famSet = it => new Set([...(it.family || []), it.base, ...(it.familyTyped || []).map(f => f.w)].filter(Boolean).map(L));
  const DICT = opts.dict ? new Set(opts.dict) : null;
  const KNOWN = knownWordSet();
  const real = w => KNOWN.has(w) || (DICT && DICT.has(w));
  const clone = x => JSON.parse(JSON.stringify(x));
  const F = (ctx, msg) => out.fail.push(`${ctx}: ${msg}`);
  if (location.hash !== '#practice') { location.hash = '#practice'; await sleep(60); }

  const head = () => { const fb = $('#fbCard'); if (!fb || fb.hidden) return null; const h = $('.fb-head', fb); return h ? h.textContent.trim() : null; };
  const q = sel => $('#exCard ' + sel);
  function tap(sel){ const el = q(sel); if (!el) throw new Error('missing element ' + sel); el.click(); }
  function start(ex){ beginSession('audit', [ex]); S.lockUntil = 0; }
  async function waitFor(fn, ms){ const t = Date.now(); while (Date.now() - t < (ms || 2500)) { if (fn()) return true; await sleep(15); } return false; }
  function solve(tray, target){
    const t = lc(target);
    const dfs = (pos, used) => {
      if (pos === t.length) return used.slice();
      for (let i = 0; i < tray.length; i++) {
        if (used.includes(i)) continue;
        const c = lc(tray[i].t);
        if (c && t.startsWith(c, pos)) { used.push(i); const r = dfs(pos + c.length, used); if (r) return r; used.pop(); }
      }
      return null;
    };
    return dfs(0, []);
  }
  function spellable(tray){
    const words = new Set(), n = tray.length;
    const rec = (s, used) => { if (used.length >= 2) words.add(lc(s)); if (used.length === n) return; for (let i = 0; i < n; i++) if (!used.includes(i)) { used.push(i); rec(s + tray[i].t, used); used.pop(); } };
    rec('', []); return words;
  }
  const OR_END = {def:{N:{m:'e',f:'e',n:'e',p:'en'},A:{m:'en',f:'e',n:'e',p:'en'},D:{m:'en',f:'en',n:'en',p:'en'}},
    indef:{N:{m:'er',f:'e',n:'es'},A:{m:'en',f:'e',n:'es'},D:{m:'en',f:'en',n:'en'}}, zero:{N:{p:'e'},A:{p:'e'},D:{p:'en'}}};
  const OR_ART = {def:{N:{m:'der',f:'die',n:'das',p:'die'},A:{m:'den',f:'die',n:'das',p:'die'},D:{m:'dem',f:'der',n:'dem',p:'den'}},
    indef:{N:{m:'ein',f:'eine',n:'ein'},A:{m:'einen',f:'eine',n:'ein'},D:{m:'einem',f:'einer',n:'einem'}}, zero:{N:{p:''},A:{p:''},D:{p:''}}};

  // ----- static checks: one right answer, no second right answer among the wrong ones -----
  function staticCheck(ex, ctx){
    out.statics++;
    const it = ex.id ? getItem(ex.id) : null, d = ex.data || {};
    const choose = ['meaningPick','recall','decon','family','contrast','p1p2','cloze','sense'].includes(ex.type) && !ex.typed;
    if (choose) {
      if (!Array.isArray(d.opts) || d.opts.length < 2) return F(ctx, 'fewer than two options');
      const lo = d.opts.map(o => lc(String(o).trim()));
      if (new Set(lo).size !== lo.length) F(ctx, 'duplicate options: ' + d.opts.join(' | '));
      if (!(d.ans >= 0 && d.ans < d.opts.length)) return F(ctx, 'answer index out of range');
      const right = d.opts[d.ans], wrongs = d.opts.filter((_, i) => i !== d.ans);
      switch (ex.type) {
        case 'meaningPick':
          if (right !== it.en) F(ctx, 'marked answer is not the meaning');
          wrongs.forEach(w => { if (glossOverlap(w, it.en)) F(ctx, `wrong option "${w}" says the same as "${it.en}"`); });
          break;
        case 'recall':
          if (right !== it.w) F(ctx, 'marked answer is not the word');
          wrongs.forEach(w => { const g = glossOf(w); if (glossOverlap(g, it.en)) F(ctx, `wrong option ${w} (${g}) means "${it.en}" too`); if (allSyn(it).has(L(w))) F(ctx, `wrong option ${w} is a listed synonym`); });
          break;
        case 'decon':
          if (right !== it.base) F(ctx, 'marked answer is not the base word');
          wrongs.forEach(w => { if (famSet(it).has(L(w))) F(ctx, `wrong option ${w} belongs to the family`); });
          break;
        case 'family':
          if (!it.family.includes(right)) F(ctx, 'marked answer is not in the family');
          wrongs.forEach(w => { if (famSet(it).has(L(w))) F(ctx, `wrong option ${w} belongs to the family`); });
          break;
        case 'contrast': {
          const list = d.mode === 'ant' ? allAnt(it) : allSyn(it);
          if (!list.has(L(right))) F(ctx, `marked answer ${right} is not a listed ${d.mode === 'ant' ? 'opposite' : 'synonym'}`);
          const gr = glossOf(right);
          wrongs.forEach(w => {
            if (allAnt(it).has(L(w)) || allSyn(it).has(L(w))) F(ctx, `wrong option ${w} is itself a listed synonym/opposite`);
            if (gr && glossOverlap(glossOf(w), gr)) F(ctx, `wrong option ${w} (${glossOf(w)}) means the same as ${right} (${gr})`);
          });
          break;
        }
        case 'cloze':
          if (right !== d.form) F(ctx, 'marked answer is not the form in the sentence');
          if (!it.ex.includes(d.sentence.replace('___', d.form))) F(ctx, 'sentence + answer is not one of the examples');
          wrongs.forEach(w => { [...allSyn(it)].forEach(s => { if (lc(w).startsWith(lc(G.declStem(s))) && s.length > 3) F(ctx, `wrong option ${w} is a form of the synonym ${s}`); }); });
          break;
        case 'p1p2':
          if (!/___/.test(d.s)) F(ctx, 'sentence has no gap');
          break;
        case 'sense': {
          const m = it.meanings.find(x => x.gloss === right);
          if (!m || !(m.examples || []).some(e => e.de === d.s)) F(ctx, 'example does not belong to the marked meaning');
          if (it.meanings.filter(x => (x.examples || []).some(e => e.de === d.s)).length > 1) F(ctx, 'example sits under two meanings');
          break;
        }
      }
    }
    if (ex.type === 'build' || ex.type === 'transfer') {
      const src = ex.type === 'transfer' ? d.pseudo : it;
      if (!solve(d.tray, src.w)) F(ctx, 'the word cannot be built from the blocks');
      const ants = antonymSet(src);
      spellable(d.tray).forEach(w => {
        if (w === lc(src.w) || ants.has(w)) return;
        if (allSyn(src).has(w)) F(ctx, `the blocks also spell the synonym ${w}`);
        else if (real(w)) out.review.push(`${src.w}: blocks also spell the real word ${w}`);
      });
      if (d.step1) {
        const lo = d.step1.opts;
        if (new Set(lo).size !== lo.length) F(ctx, 'duplicate step-1 options');
        const right = lo[d.step1.ans];
        const expect = (src.kind === 'p1' || src.kind === 'p2') ? src.kind : src.affix;
        if (right !== expect) F(ctx, `step 1 marks ${right}, expected ${expect}`);
        lo.forEach((o, i) => {
          if (i === d.step1.ans || o === 'p1' || o === 'p2') return;
          if (synonymElements(expect).has(o)) F(ctx, `step 1 offers ${o}, which can mean the same as ${expect}`);
          const forms = formsWith(src, o, src.kind === 'prefix' ? 'prefix' : 'suffix');
          forms.forEach(f => {
            if (ants.has(f)) return;
            if (allSyn(src).has(f) || KNOWN.has(f)) F(ctx, `step 1 offers ${o}: ${f} is a known word`);
            else if (DICT && DICT.has(f)) out.review.push(`${src.w}: step-1 option ${o} makes the real word ${f}`);
          });
        });
      }
    }
    if (ex.type === 'ending') {
      const s = d.slot, gk = s.num === 'p' ? 'p' : d.n.g;
      const exp = OR_END[s.a] && OR_END[s.a][s.c] ? OR_END[s.a][s.c][gk] : undefined;
      if (exp === undefined) F(ctx, `unexpected slot ${JSON.stringify(s)}`);
      else if (d.fr.ending !== exp) F(ctx, `ending ${d.fr.ending}, grammar says ${exp} (${s.a} ${s.c} ${gk})`);
      const art = OR_ART[s.a][s.c][gk];
      if (art && !d.fr.pre.endsWith(' ' + art)) F(ctx, `article in "${d.fr.pre}" should be ${art}`);
      if (s.c === 'D' && s.num === 'p' && !/[ns]$/.test(d.fr.noun)) F(ctx, `dative plural noun ${d.fr.noun} should end in -n`);
      if (out.samples.length < 400) out.samples.push(`${d.fr.pre} ${G.inflect(it.w, d.fr.ending)} ${d.fr.post}`);
    }
    if (ex.type === 'valency') {
      if (new Set(d.preps).size !== d.preps.length || !d.preps.includes(d.p)) F(ctx, 'preposition options broken');
      if (d.sentence.split('___').length !== 2) F(ctx, 'sentence must have exactly one gap');
      if (!['A','D','G'].includes(d.c)) F(ctx, 'unknown case ' + d.c);
      if (d.contr && CONTRACTIONS[lc(d.contr)][0] !== d.p) F(ctx, `contraction ${d.contr} does not contain ${d.p}`);
    }
    if (ex.type === 'match') {
      if (new Set(d.left).size !== d.left.length || new Set(d.right.map(lc)).size !== d.right.length) F(ctx, 'duplicate match entries');
    }
    if (ex.type === 'translate' && !G.findForm(d.de, it.w)) F(ctx, 'model sentence does not use the word');
  }

  // ----- the same question answered through the page -----
  async function answer(ex0, plan){
    const ex = clone(ex0);
    out.runs++;
    start(ex);
    const d = ex.data, it = ex.id ? getItem(ex.id) : null;
    switch (ex.type) {
      case 'build': case 'transfer': {
        const src = ex.type === 'transfer' ? d.pseudo : it;
        if (d.step1) {
          const i = plan.s1 === 'right' ? d.step1.ans : d.step1.opts.findIndex((_, k) => k !== d.step1.ans);
          tap(`.opt[data-i="${i}"]`);
          if (i === d.step1.ans) { if (!await waitFor(() => q('.tray'))) return 'no step 2 after the right element'; }
          else {
            await sleep(plan.watch ? 1300 : 0);
            if (q('.tray')) return 'moved on to step 2 by itself after a wrong element';
            if (!q('#s1note')) return 'no explanation after a wrong element';
            S.lockUntil = 0; tap('[data-act="b-step2"]');
            if (!q('.tray') || !q('#s1note')) return 'step 2 does not keep the step-1 note';
          }
          S.lockUntil = 0;
        }
        const seq = solve(d.tray, src.w);
        let use = seq;
        if (plan.build === 'wrong') { use = seq.slice().reverse(); if (use.map(k => d.tray[k].t).join('') === lc(src.w) || seq.length < 2) use = seq.slice(0, -1); }
        for (const k of use) $$('#exCard .tray .blk')[k].click();
        tap('[data-act="b-check"]');
        break;
      }
      case 'recall': case 'cloze':
        if (ex.typed) {
          const target = ex.type === 'cloze' ? d.form : it.w;
          if (plan.giveUp) { tap('[data-act="give-up"]'); break; }
          const v = plan.text != null ? plan.text : target;
          q('#ans').value = v; tap('[data-act="type-check"]');
          if (plan.expectRetry) return (!ex.done && q('#altMsg') && !q('#altMsg').hidden) ? 'RETRY' : 'accepted or rejected a synonym instead of asking again';
          break;
        }
        // fall through
      case 'meaningPick': case 'decon': case 'family': case 'contrast': case 'p1p2': case 'sense':
        tap(`.opt[data-i="${plan.pick}"]`); break;
      case 'ending': tap(`.endings .blk[data-e="${plan.pick}"]`); break;
      case 'valency':
        tap(`[data-act="v-prep"][data-p="${plan.p}"]`); tap(`[data-act="v-case"][data-c="${plan.c}"]`); tap('[data-act="v-check"]'); break;
      case 'match': {
        const order = d.left.map((w, i) => i);
        if (plan.mistake) {
          tap(`[data-act="m-left"][data-i="0"]`);
          const bad = d.right.findIndex(g => g !== d.key[d.left[0]]);
          tap(`[data-act="m-right"][data-i="${bad}"]`); await sleep(500);
        }
        for (const i of order) { tap(`[data-act="m-left"][data-i="${i}"]`); tap(`[data-act="m-right"][data-i="${d.right.indexOf(d.key[d.left[i]])}"]`); }
        break;
      }
      case 'translate': tap('[data-act="tr-show"]'); tap(`[data-act="tr-grade"][data-ok="${plan.ok ? 1 : 0}"]`); break;
      case 'produce': q('#prod').value = plan.text; tap('[data-act="prod-check"]'); break;
    }
    return head();
  }
  async function expect(ex, plan, want, ctx){
    let got;
    try { got = await answer(ex, plan); } catch (e) { got = 'ERROR ' + e.message; }
    if (got !== want) F(ctx, `${JSON.stringify(plan)} → "${got}", expected "${want}"`);
  }

  const TYPES = ['meaningPick','recall','recall*','build','decon','family','contrast','p1p2','ending','cloze','cloze*','valency','sense','match','translate','produce'];
  for (const it of DB.items.slice()) {
    for (const T of TYPES) {
      const type = T.replace('*', ''), typed = T.endsWith('*');
      for (let v = 0; v < opts.variants; v++) {
        const ex = makeFor(type, it, typed);
        if (!ex) break;
        out.avail[T] = (out.avail[T] || 0) + (v === 0 ? 1 : 0);
        const ctx = `${it.w} / ${T} #${v}`;
        staticCheck(ex, ctx);
        if (v > 1 && type !== 'build') continue;          // answer the first two variants through the page (all builds)
        const d = ex.data;
        switch (type) {
          case 'meaningPick': case 'decon': case 'family': case 'contrast': case 'p1p2': case 'sense':
            await expect(ex, {pick:d.ans}, 'Correct.', ctx);
            for (let i = 0; i < d.opts.length; i++) if (i !== d.ans) await expect(ex, {pick:i}, 'Not quite.', ctx);
            break;
          case 'recall': case 'cloze':
            if (!typed) {
              await expect(ex, {pick:d.ans}, 'Correct.', ctx);
              for (let i = 0; i < d.opts.length; i++) if (i !== d.ans) await expect(ex, {pick:i}, 'Not quite.', ctx);
            } else {
              const target = type === 'cloze' ? d.form : it.w;
              const tr = target.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
              for (const t of [target, ' ' + target.toUpperCase() + ' ', target + '.', target + '!', '„' + target + '“', tr]) await expect(ex, {text:t}, 'Correct.', ctx);
              await expect(ex, {text:target + 'x'}, 'Not quite.', ctx);
              await expect(ex, {giveUp:true}, 'Not quite.', ctx);
              if (type === 'recall') {
                const syn = [...allSyn(it)].find(s => !/\s/.test(s) && lc(s) !== lc(it.w));
                if (syn) await expect(ex, {text:syn, expectRetry:true}, 'RETRY', ctx);
              }
            }
            break;
          case 'build': {
            const watch = v === 0;
            await expect(ex, {s1:'right', build:'right'}, 'Correct.', ctx);
            if (d.step1) {
              await expect(ex, {s1:'wrong', build:'right', watch}, 'Half right.', ctx);
              await expect(ex, {s1:'wrong', build:'wrong'}, 'Not quite.', ctx);
            }
            await expect(ex, {s1:'right', build:'wrong'}, 'Not quite.', ctx);
            break;
          }
          case 'ending':
            await expect(ex, {pick:d.fr.ending}, 'Correct.', ctx);
            for (const e of ['e','en','er','es','em']) if (e !== d.fr.ending) await expect(ex, {pick:e}, 'Not quite.', ctx);
            break;
          case 'valency': {
            await expect(ex, {p:d.p, c:d.c}, 'Correct.', ctx);
            const otherP = d.preps.find(p => p !== d.p);
            await expect(ex, {p:otherP, c:d.c}, 'Not quite.', ctx);
            await expect(ex, {p:d.p, c:d.c === 'A' ? 'D' : 'A'}, 'Not quite.', ctx);
            break;
          }
          case 'match':
            await expect(ex, {}, 'Correct.', ctx);
            await expect(ex, {mistake:true}, 'Not quite.', ctx);
            break;
          case 'translate':
            await expect(ex, {ok:true}, 'Correct.', ctx);
            await expect(ex, {ok:false}, 'Not quite.', ctx);
            break;
          case 'produce':
            await expect(ex, {text:`Für mich ist das wirklich ${it.w}.`}, 'Saved.', ctx);
            break;
        }
      }
    }
  }
  // transfer challenges: every pattern-library word that is not in the deck
  for (const a of AFFIXES) {
    const used = new Set();
    for (let k = 0; k < 40; k++) {
      const ex = MK.transfer(a.id, used); if (!ex) break;
      used.add(ex.data.e.w);
      const ctx = `transfer ${ex.data.e.w} (${a.id})`;
      out.avail.transfer = (out.avail.transfer || 0) + 1;
      staticCheck(ex, ctx);
      await expect(ex, {build:'right'}, 'Correct.', ctx);
      await expect(ex, {build:'wrong'}, 'Not quite.', ctx);
    }
  }
  // every possible step-1 option and extra block per word (the options are random, so collect them all)
  for (const it of DB.items) {
    if (!MK.build(it)) continue;
    const seen = new Set();
    for (let k = 0; k < 80; k++) { const ex = MK.build(it); (ex.data.step1 ? ex.data.step1.opts : []).forEach(o => seen.add(o)); staticCheck(ex, `${it.w} / build pool`); }
    out.avail['step1:' + it.w] = Array.from(seen).join(' ');
  }
  quitSession();
  return out;
}

// ---------- scenario tests: the reported bug and double taps ----------
async function scenarios(){
  console.log('\nScenarios (phone size, real taps)');
  const p = await newPage({viewport:{width:390, height:844}, hasTouch:true, isMobile:true, deviceScaleFactor:2});
  await p.goto(BASE + 'index.html#practice'); await p.waitForFunction(() => typeof DB !== 'undefined' && DB.items.length >= 17);
  const shots = process.env.SHOTS;

  // 1. the reported case: anspruchsvoll, wrong element in step 1, then a correct build
  await p.evaluate(() => { const it = DB.items.find(i => i.w === 'anspruchsvoll'); let ex; do { ex = MK.build(it); } while (!ex.data.step1.opts.includes('lich')); beginSession('build', [ex]); });
  await p.waitForTimeout(500);
  const lichIdx = await p.evaluate(() => cur().data.step1.opts.indexOf('lich'));
  await p.tap(`#exCard .opt[data-i="${lichIdx}"]`);
  await p.waitForTimeout(1600);
  ok(!(await p.$('#exCard .tray')), 'after a wrong element the card must wait (no auto-advance)');
  const note = await p.textContent('#s1note').catch(() => '');
  ok(/-lich/.test(note) && /-voll/.test(note), 'step-1 note names both elements: ' + note);
  ok(await p.$eval(`#exCard .opt[data-i="${lichIdx}"]`, b => b.classList.contains('wrong')), 'chosen element is marked wrong');
  if (shots) await p.screenshot({path: shots + '/s1-wrong.png'});
  await p.tap('[data-act="b-step2"]'); await p.waitForTimeout(500);
  ok(await p.$('#exCard .tray') && await p.$('#s1note'), 'step 2 shows the blocks and keeps the note');
  for (const t of ['anspruch', 's', 'voll']) { await p.tap(`#exCard .tray .blk:not(.used):text-is("${t}")`); await p.waitForTimeout(60); }
  await p.tap('[data-act="b-check"]');
  const h1 = await p.textContent('#fbCard .fb-head');
  ok(h1.trim() === 'Half right.', 'correct build after a wrong element = Half right. (got ' + h1 + ')');
  const fbTxt = await p.textContent('#fbCard');
  ok(/Step 1/.test(fbTxt) && /You chose -lich/.test(fbTxt) && /Step 2/.test(fbTxt) && /built the word correctly/.test(fbTxt), 'feedback explains both steps');
  if (shots) await p.screenshot({path: shots + '/s1-half.png'});
  await p.tap('[data-act="override"]');
  ok((await p.textContent('#fbCard .fb-head')).trim() === 'Counted as correct.', 'mis-tap override counts it');

  // 2. double tap on Continue must not answer the next card
  await p.evaluate(() => { const its = DB.items.filter(i => MK.meaningPick(i)).slice(0, 3); beginSession('extra', its.map(i => MK.meaningPick(i))); });
  await p.waitForTimeout(500);
  await p.tap('#exCard .opt[data-i="0"]');
  await p.waitForTimeout(800);                          // the feedback scrolls into view
  await p.tap('#nextBtn');
  // second tap of the double tap: land on the first option of the new card
  const ob = await (await p.waitForSelector('#exCard .opt[data-i="0"]', {timeout:2000})).boundingBox();
  await p.touchscreen.tap(ob.x + ob.width / 2, ob.y + ob.height / 2);
  await p.waitForTimeout(80);
  const st = await p.evaluate(() => ({i:S.i, done:!!cur().done, marked:$$('#exCard .opt.right, #exCard .opt.wrong').length}));
  ok(st.i === 1 && !st.done && st.marked === 0, 'a tap right after Continue is ignored: ' + JSON.stringify(st));
  await p.waitForTimeout(500);
  await p.tap('#exCard .opt[data-i="0"]');
  ok(await p.evaluate(() => !!cur().done), 'a deliberate tap a moment later works');
  // a real double tap (dblclick) on Continue moves on exactly one card
  await p.waitForTimeout(800);
  await p.dblclick('#nextBtn');
  await p.waitForTimeout(80);
  ok(await p.evaluate(() => S.i === 2 && !cur().done), 'double tap on Continue moves on exactly one card');

  // 3. double tap on a step-1 option counts once
  await p.evaluate(() => { const it = DB.items.find(i => i.w === 'gefährlich'); beginSession('build', [MK.build(it)]); });
  await p.waitForTimeout(500);
  const ans = await p.evaluate(() => cur().data.step1.ans);
  await p.dblclick(`#exCard .opt[data-i="${ans}"]`);
  await p.waitForTimeout(700);
  ok(await p.evaluate(() => cur().data.s1 === true && !!$('#exCard .tray') && cur().data.built.length === 0), 'double tap on the element: counted once, no block added');

  // 4. leaving during the step-1 pause causes no error
  await p.evaluate(() => { const it = DB.items.find(i => i.w === 'gefährlich'); beginSession('build', [MK.build(it)]); });
  await p.waitForTimeout(500);
  await p.tap(`#exCard .opt[data-i="${await p.evaluate(() => cur().data.step1.ans)}"]`);
  await p.tap('[data-act="quit"]');
  await p.waitForTimeout(700);

  // 5. review: half right moves the word down one box, a real build mistake sends it to box 1
  const srs = await p.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const it = DB.items.find(i => i.w === 'anspruchsvoll');
    const run = async (s1Right, buildRight) => {
      it.srs.box = 3; it.srs.due = Date.now() - 1000; it.srs.n = 2;
      let ex; do { ex = MK.build(it); } while (!ex.data.step1);
      beginSession('review', [Object.assign(ex, {graded:true})]); S.lockUntil = 0;
      const d = ex.data;
      $(`#exCard .opt[data-i="${s1Right ? d.step1.ans : (d.step1.ans + 1) % d.step1.opts.length}"]`).click();
      if (s1Right) await sleep(520); else { S.lockUntil = 0; $('[data-act="b-step2"]').click(); }
      S.lockUntil = 0;
      const order = buildRight ? ['anspruch','s','voll'] : ['voll','s','anspruch'];
      for (const t of order) { const i = d.tray.findIndex((c, k) => c.t === t && !d.built.includes(k)); $$('#exCard .tray .blk')[i].click(); }
      $('#exCard [data-act="b-check"]').click();
      const r = {head:$('#fbCard .fb-head').textContent, box:it.srs.box, k:DB.events[DB.events.length - 1].k};
      nextCard();
      r.summary = $('.summary') ? $('.summary').textContent : '';
      return r;
    };
    return {half: await run(false, true), wrong: await run(true, false)};
  });
  ok(srs.half.head === 'Half right.' && srs.half.box === 2 && srs.half.k === 'element' && /Chose the wrong building element/.test(srs.half.summary), 'review: half right → box 3 to 2, listed as element mistake ' + JSON.stringify({...srs.half, summary:undefined}));
  ok(srs.wrong.head === 'Not quite.' && srs.wrong.box === 1, 'review: wrong build → box 1 ' + JSON.stringify({...srs.wrong, summary:undefined}));

  // 6. keyboard: Enter twice / held key moves on exactly one card
  const k = await newPage();
  await k.goto(BASE + 'index.html#practice'); await k.waitForFunction(() => typeof DB !== 'undefined' && DB.items.length >= 17);
  await k.evaluate(() => { const its = DB.items.filter(i => MK.meaningPick(i)); beginSession('extra', [MK.meaningPick(its[0]), MK.intro(its[1]), MK.meaningPick(its[2])]); });
  await k.waitForTimeout(500);
  await k.keyboard.press('1');
  await k.keyboard.press('Enter'); await k.keyboard.press('Enter');
  ok(await k.evaluate(() => S.i === 1 && cur().type === 'intro'), 'Enter pressed twice does not skip the new word card');
  await k.waitForTimeout(500);
  await k.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', repeat:true, bubbles:true})));
  ok(await k.evaluate(() => S.i === 1), 'a held-down Enter (key repeat) is ignored');
  await k.keyboard.press('Enter'); await k.waitForTimeout(500);
  await k.keyboard.press('2');
  ok(await k.evaluate(() => S.i === 2 && !!cur().done), 'number keys answer after the pause');
}

// ---------- run ----------
const p = await newPage();
console.log('Building the test deck (starter words, AI-analysed word, words from the Add form)…');
const deck = await seedDeck(p);
console.log(`  ${deck.length} words`);
if (process.env.VERBOSE) deck.forEach(l => console.log('   ', l));
console.log(`Answering every exercise right and wrong (${VARIANTS} variants per word and type)…`);
const t0 = Date.now();
const res = await p.evaluate(inPageAudit, {variants:VARIANTS, dict});
console.log(`  ${res.statics} questions checked, ${res.runs} answered through the page in ${Math.round((Date.now() - t0) / 1000)} s`);
console.log('  exercise types available:', Object.entries(res.avail).filter(([k]) => !k.startsWith('step1:')).map(([k, v]) => `${k} ${v}`).join(', '));
if (process.env.VERBOSE) Object.entries(res.avail).filter(([k]) => k.startsWith('step1:')).forEach(([k, v]) => console.log('   ', k.slice(6), '→', v));
const fails = Array.from(new Set(res.fail));
fails.forEach(f => console.log('  FAIL', f));
failures += fails.length;
const review = Array.from(new Set(res.review));
if (review.length) { console.log(`  For review (${review.length}): distractors that are real words but not listed as related`); review.forEach(r => console.log('   ', r)); }
if (process.env.SAMPLES) Array.from(new Set(res.samples)).sort().forEach(s => console.log('   ', s));
await scenarios();
if (pageErrors.length) { console.log('  FAIL page errors:', Array.from(new Set(pageErrors)).join(' | ')); failures += pageErrors.length; }
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL CHECKS PASSED');
await browser.close(); server.close();
process.exit(failures ? 1 : 0);
