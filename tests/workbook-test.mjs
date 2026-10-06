// MorphoDeutsch — workbook test (Wortbildung der Adjektive).
// 1. Data: every item has a rule, its pieces spell the word, the element matches the last or first piece, one gap, a usable noun.
// 2. Answer key: every item is answered through the checker right (also in capitals, with ae/oe/ue/ss, as a whole phrase),
//    with every accepted alternative, with every look-alike word, without its ending, and with nonsense.
// 3. The page: every sheet is filled in through the real inputs; second try, wrong twice, show the answer, check all,
//    resume after a reload, repeat the missed ones, mixed review order, one-element sheets, count it, add to my words,
//    feedback rows complete, no sideways scrolling on a phone, sync merge.
//
// Run:  node tests/workbook-test.mjs        (needs Playwright with Chromium, like the answer-key audit)
// Optional: DICT=/path/to/dictionary-de/index.dic lists phrase words the spelling dictionary does not know.
import http from 'http';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const ok = (cond, msg) => { if (!cond) { failures++; console.log('  FAIL', msg); } return !!cond; };

/* ---------- 1. data ---------- */
const ctx = {console};
vm.createContext(ctx);
vm.runInContext(['data.js', 'engine.js', 'wb-data.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n') + '\nthis.G = G; this.WB_SETS = WB_SETS; this.WB_ELEMS = WB_ELEMS;', ctx);
const { WB_SETS, WB_ELEMS } = ctx;
const LAST = {ig:['ig'], lich:['lich'], isch:['isch'], bar:['bar'], abel:['abel'], 'fähig':['fähig'], sam:['sam'], haft:['haft'], 'mäßig':['mäßig'], 'gemäß':['gemäß'],
  al:['al','ial'], ell:['ell','iell'], iv:['iv'], 'ös':['ös','iös'], los:['los'], voll:['voll'], wert:['wert']};
const FIRST = {un:['un'], in:['in','im','il','ir'], miss:['miss'], de:['de','des'], non:['non']};
const GROUPS = ['suffix', 'pairs', 'prefix', 'bonus'];
console.log('Data');
ok(WB_SETS.length >= 12, 'at least 12 sheets');
ok(new Set(WB_SETS.map(s => s.id)).size === WB_SETS.length, 'sheet ids are unique');
let nItems = 0;
for (const s of WB_SETS) {
  ok(GROUPS.includes(s.group), `${s.id}: group`);
  ok(s.title && s.task && /^(B2|C1)$/.test(s.level), `${s.id}: title, task, level`);
  ok(s.example && s.items.length >= 8, `${s.id}: example and at least 8 items`);
  ok(s.els.every(e => WB_ELEMS[e]), `${s.id}: every listed element has a rule`);
  ok(new Set(s.items.map(i => i.w)).size === s.items.length, `${s.id}: no word twice`);
  ok(!s.items.some(i => i.w === s.example.w), `${s.id}: the example is not also an item`);
  for (const it of [s.example, ...s.items]) {
    const at = `${s.id}/${it.w}`;
    if (it !== s.example) nItems++;
    const el = WB_ELEMS[it.el];
    if (!ok(el, `${at}: element ${it.el} has a rule`)) continue;
    ok(el.form && el.mean && el.mean.length > 2 && ['sig', 'joint'].every(k => el[k] && el[k].length > 10), `${at}: rule has meaning, signal and joint`);
    ok(s.els.includes(it.el), `${at}: element is in the sheet's list`);
    ok(it.parts.join('') === it.w, `${at}: pieces spell the word`);
    ok(it.parts.length >= 2, `${at}: at least two pieces`);
    ok(it.en && it.en.length > 2, `${at}: English meaning`);
    if (el.kind === 'suffix') ok(LAST[it.el] && LAST[it.el].includes(it.parts[it.parts.length - 1]), `${at}: last piece is ${it.el}`);
    if (el.kind === 'prefix') ok(FIRST[it.el] && FIRST[it.el].includes(it.parts[0]), `${at}: first piece is ${it.el}`);
    if (it.k === 'T') {
      ok(it.s.split('___').length === 2, `${at}: exactly one gap`);
      ok(it.a === it.w && it.cue && /[.!?]$/.test(it.cue) && /[.!?]$/.test(it.s), `${at}: cue and sentence`);
    } else {
      const m = /^(der|die|das|pl) (\S.*)$/.exec(it.noun || '');
      ok(m, `${at}: noun with article`);
      ok(['indef', 'def', 'zero'].includes(it.art), `${at}: article type`);
      ok(!(m && m[1] === 'pl' && it.art === 'indef'), `${at}: no "ein" before a plural`);
      if (it.k === 'N') ok(it.from, `${at}: base word`);
      if (it.k === 'O') {
        ok(it.pos && it.pos !== it.w, `${at}: the word to negate`);
        if (el.kind === 'prefix') ok(it.w.endsWith(it.parts.slice(1).join('')), `${at}: prefix + rest`);
        if (el.kind === 'suffix') ok(/^(der|die|das) /.test(it.base || ''), `${at}: base noun for the -los word`);
      }
    }
    const alts = it.alts || [], traps = Object.keys(it.traps || {});
    ok(!alts.includes(it.w) && new Set(alts).size === alts.length, `${at}: alternatives`);
    ok(!traps.some(t => t === it.w || alts.includes(t)), `${at}: a look-alike is not also a right answer`);
    ok(traps.every(t => it.traps[t] && it.traps[t].length > 12), `${at}: look-alikes are explained`);
    ok(!(it.note && it.tip && it.note === it.tip), `${at}: note and tip differ`);
  }
}
for (const [id, e] of Object.entries(WB_ELEMS)) ok(WB_SETS.some(s => s.items.some(i => i.el === id)), `rule ${id} is used by an item`);
console.log(`  ${WB_SETS.length} sheets, ${nItems} items, ${Object.keys(WB_ELEMS).length} rules`);

/* ---------- browser ---------- */
let pw;
try { pw = await import('playwright'); } catch { pw = await import(process.env.PLAYWRIGHT || '/home/claude/.npm-global/lib/node_modules/playwright/index.js'); }
const chromium = pw.chromium || pw.default.chromium;
const exe = process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
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
  const c = await browser.newContext(Object.assign({serviceWorkers:'block', viewport:{width:1280, height:900}}, opts || {}));
  const p = await c.newPage();
  p.on('pageerror', e => pageErrors.push(e.message));
  await p.route(/fonts\.g|mymemory|tatoeba/, r => r.abort());
  return p;
}
const go = async (p, hash) => { await p.goto(BASE + '#' + hash); await p.waitForFunction(h => location.hash === '#' + h && !!document.querySelector('#view').firstElementChild, hash); };
const inp = id => `.wb-in[data-id="${id}"]`;
const row = id => `.wb-row[data-id="${id}"]`;
const typeIn = async (p, id, v) => { await p.fill(inp(id), v); await p.press(inp(id), 'Enter'); };

/* ---------- 2. answer key, through the checker ---------- */
console.log('Answer key');
const p = await newPage();
await go(p, 'workbook');
const key = await p.evaluate(() => {
  const fail = [], review = [];
  let n = 0;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const tr = s => s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  const J = (it, v) => { n++; return wbJudge(it, v); };
  for (const s of WB_SETS) for (const it of [s.example, ...s.items]) {
    const f = wbFrame(it), at = `${s.id}/${it.w}`, a = f.answer;
    const R = (v, what) => { const j = J(it, v); if (j.k !== 'right') fail.push(`${at}: ${what} "${v}" judged ${j.k}`); };
    R(a, 'answer'); R(a.toUpperCase(), 'capitals'); R(cap(a), 'capital letter'); R(tr(a), 'ae/oe/ue/ss'); R('  „' + a + '“. ', 'quotes and spaces');
    R(wbPhrase(it), 'whole phrase'); R(wbPhrase(it).toLowerCase(), 'whole phrase, lower case');
    for (const alt of it.alts || []) { R(wbInfl(alt, f.ending), 'alternative'); R(tr(wbInfl(alt, f.ending)), 'alternative ae/oe/ue'); }
    // the answer must fit its frame: the ending computed from the noun and article
    if (!f.sentence) {
      const want = G.ENDINGS[it.art].N[f.g];
      if (!a.endsWith(want)) fail.push(`${at}: ${a} does not end in -${want}`);
      if (it.k === 'O' && !wbInfl(it.pos, f.ending).endsWith(want)) fail.push(`${at}: the given word has the wrong ending`);
    }
    // without or with another ending: "right adjective, check the ending"
    for (const e of ['', 'e', 'en', 'er', 'es', 'em']) {
      const v = wbInfl(it.w, e);
      if (v === a || (it.alts || []).some(x => wbInfl(x, f.ending) === v)) continue;
      const j = J(it, v);
      if (j.k !== 'ending') fail.push(`${at}: "${v}" judged ${j.k}, expected ending`);
    }
    // look-alikes are caught as such, with every ending
    for (const t of Object.keys(it.traps || {})) for (const e of ['', f.ending]) {
      const j = J(it, wbInfl(t, e));
      if (j.k !== 'trap' || j.lemma !== t) fail.push(`${at}: look-alike "${wbInfl(t, e)}" judged ${j.k}`);
    }
    // never right: nonsense, the base word, the word to negate, another item's answer
    for (const v of ['xyz', 'quatsch', it.w + 'x', 'x' + a, a.slice(0, -1) + (a.endsWith('q') ? 'z' : 'q'), it.parts[0], it.pos || '', it.from || '']) {
      if (!v || !v.trim()) continue;
      const j = J(it, v);
      if (j.k === 'right') fail.push(`${at}: "${v}" must not be right`);
    }
    if (J(it, '   ').k !== 'empty') fail.push(`${at}: blank must be empty`);
    if (it.k === 'O') { const j = J(it, wbInfl(it.pos, f.ending)); if (j.k !== 'same') fail.push(`${at}: the given word judged ${j.k}, expected same`); }
    // pointers never give the word away
    for (const v of [it.w, 'quatsch', ...(Object.keys(it.traps || {}))]) {
      const j = wbJudge(it, v); if (j.k === 'right' || j.k === 'empty') continue;
      const txt = wbPointer(it, j).replace(/<[^>]+>/g, '').toLowerCase();
      if (txt.includes(a.toLowerCase()) || (a !== it.w && txt.includes(it.w.toLowerCase()) && j.k !== 'ending')) fail.push(`${at}: the pointer for "${v}" shows the answer: ${txt}`);
      if (!txt || txt.length < 12) fail.push(`${at}: empty pointer for "${v}"`);
    }
    // the feedback of every item is complete
    const html = wbFbHtml(it, {st:'wrong', typed:['quatsch'], j:{k:'wrong'}});
    for (const lab of ['Rule', 'Signal', 'Joint', 'Ending']) if (!html.includes(`<dt>${lab}</dt>`)) fail.push(`${at}: feedback has no ${lab} row`);
    if (/<dd>\s*<\/dd>|undefined|\bNaN\b|\[object/.test(html)) fail.push(`${at}: feedback has an empty or broken row`);
    const seg = wbSegs(it);
    if (seg.map(x => x[0]).join('') !== it.w) fail.push(`${at}: coloured pieces do not spell the word`);
    const tmp = document.createElement('div'); tmp.innerHTML = wbWordHtml(it, f.ending);
    if (tmp.textContent !== a) fail.push(`${at}: the coloured answer reads "${tmp.textContent}", not "${a}"`);
    if (!wbSiblings(it).length) review.push(`${at}: no other word with ${it.el}`);
    // a wrong suffix or prefix from the same sheet is named, not just "wrong"
    for (const o of s.items) {
      if (o === it || o.el === it.el || wbElem(o).kind !== wbElem(it).kind || wbElem(it).kind === 'first') continue;
      const swap = wbElem(it).kind === 'suffix' ? it.parts.slice(0, -1).join('') + o.parts[o.parts.length - 1] : o.parts[0] + it.parts.slice(1).join('');
      if ((it.alts || []).includes(swap) || (it.traps || {})[swap] || swap === it.w) continue;
      const j = J(it, swap);
      if (!['elem', 'pre', 'joint', 'needsuffix', 'same'].includes(j.k)) fail.push(`${at}: "${swap}" judged ${j.k}`);
    }
  }
  // two items of one sheet never share a visible prompt with different answers
  for (const s of WB_SETS) {
    const seen = new Map();
    for (const it of s.items) {
      const f = wbFrame(it);
      const sig = [it.k, it.from || it.pos || it.cue, f.pre, f.post, s.cueEn ? it.en : ''].join('|');
      if (seen.has(sig)) fail.push(`${s.id}: ${it.w} and ${seen.get(sig)} have the same prompt`);
      seen.set(sig, it.w);
    }
  }
  return {n, fail, review};
});
key.fail.slice(0, 60).forEach(f => ok(false, f));
console.log(`  ${key.n} answers judged`);
if (key.review.length) console.log('  For review:\n    ' + key.review.join('\n    '));

/* ---------- 3. the page ---------- */
console.log('Sheets, filled in through the page');
const sets = await p.evaluate(() => WB_SETS.map(s => ({id:s.id, n:s.items.length})));
ok((await p.$$('.wb-card')).length === sets.length, 'one card per sheet on the workbook page');
let typed = 0;
for (const s of sets) {
  await go(p, 'workbook/' + s.id);
  const ids = await p.evaluate(() => WBS.ids.slice());
  ok(ids.length === s.n && (await p.$$('.wb-in')).length === s.n, `${s.id}: ${s.n} gaps`);
  ok((await p.$$('.wb-row.example')).length === 1, `${s.id}: example row`);
  const answers = await p.evaluate(() => Object.fromEntries(WBS.ids.map(id => [id, wbFrame(wbItem(id)).answer])));
  for (const id of ids) { await typeIn(p, id, answers[id]); typed++; }
  const st = await p.evaluate(() => ({rows:WBS.ids.map(id => WBS.rows[id].st), rec:WBS.ids.map(id => (wbRec(id) || {}).r), n:document.querySelectorAll('.wb-row.is-right').length, open:document.querySelectorAll('.wb-in').length, sum:!!document.querySelector('.wb-summary'), pct:(document.querySelector('.wb-summary .score') || {}).textContent}));
  ok(st.rows.every(x => x === 'right') && st.rec.every(x => x === 1), `${s.id}: every right answer is marked right and recorded`);
  ok(st.n === s.n && st.open === 0 && st.sum && st.pct === '100%', `${s.id}: sheet done, 100%`);
  const fb = await p.evaluate(() => Array.from(document.querySelectorAll('.wb-row:not(.example)')).filter(li => !['Rule', 'Signal', 'Joint', 'Ending'].every(l => Array.from(li.querySelectorAll('dt')).some(d => d.textContent === l))).length);
  ok(fb === 0, `${s.id}: every line has rule, signal, joint and ending`);
}
console.log(`  ${typed} answers typed`);
const after = await p.evaluate(() => { const c = wbCounts(wbAll()); return {c, log:DB.log[dateKey()], saved:JSON.parse(localStorage.getItem('morphodeutsch_v1')).wb}; });
ok(after.c.learning === typed && after.c.new === 0 && after.c.missed === 0, 'all items count as right once');
ok(after.log >= typed, 'answers are counted in the daily log');
ok(after.saved && Object.keys(after.saved.it).length === typed, 'progress is saved with the rest of the data');

console.log('Scenarios');
// second pass on one sheet: right again → known
await go(p, 'workbook/wetter');
let ids = await p.evaluate(() => WBS.ids.slice());
ok(await p.evaluate(() => WBS.ids.every(id => WBS.rows[id].st === 'open')), 'a finished sheet starts fresh the next time');
let ans = await p.evaluate(() => Object.fromEntries(WBS.ids.map(id => { const it = wbItem(id); return [id, {a:wbFrame(it).answer, w:it.w, trap:Object.keys(it.traps || {})[0] || ''}]; })));
// 1: wrong ending, then right → "second try"
await typeIn(p, ids[0], ans[ids[0]].w);
ok(await p.evaluate(id => WBS.rows[id].st === 'open' && /Right adjective/.test(WBS.rows[id].ptr), ids[0]), 'no ending: a pointer, the line stays open');
ok(await p.locator(row(ids[0]) + ' .wb-msg').count() === 1 && !(await p.locator(row(ids[0])).innerText()).includes(ans[ids[0]].a), 'the pointer is shown and the answer is not');
ok(await p.evaluate(id => document.activeElement && document.activeElement.dataset.id === id, ids[0]), 'focus stays in the gap for the second try');
await typeIn(p, ids[0], ans[ids[0]].a);
ok(await p.evaluate(id => WBS.rows[id].st === 'help' && wbRec(id).r === 2 && wbStatus(id) === 'learning', ids[0]), 'right at the second try is recorded as such');
ok(await p.locator(row(ids[0]) + ' .wb-verdict').innerText() === 'Right at the second try', 'verdict label');
// 2: wrong twice → wrong, answer shown, typed answers listed
await typeIn(p, ids[1], 'quatsch'); await typeIn(p, ids[1], 'unsinn');
ok(await p.evaluate(id => WBS.rows[id].st === 'wrong' && wbRec(id).r === 0 && wbStatus(id) === 'missed', ids[1]), 'wrong twice is recorded as missed');
let txt = await p.locator(row(ids[1])).innerText();
ok(txt.includes(ans[ids[1]].a) && txt.includes('quatsch') && txt.includes('unsinn') && txt.includes('Not right'), 'the answer and both attempts are shown');
ok(await p.locator(row(ids[1]) + ' details').getAttribute('open') !== null, 'the rule opens by itself after a wrong answer');
// 3: right at once → known (second time in a row)
await typeIn(p, ids[2], ans[ids[2]].a.toUpperCase());
ok(await p.evaluate(id => wbStatus(id) === 'known' && wbRec(id).s === 2, ids[2]), 'right twice in a row = known');
// 4: show the answer
await p.fill(inp(ids[3]), 'xx'); await p.press(inp(ids[3]), 'Enter');
await p.click(row(ids[3]) + ' [data-act="wb-reveal"]');
ok(await p.evaluate(id => WBS.rows[id].st === 'wrong' && wbRec(id).r === 0, ids[3]), 'show the answer counts as missed');
// 5: an empty gap is not checked
await p.focus(inp(ids[4])); await p.press(inp(ids[4]), 'Enter');
ok(await p.evaluate(id => WBS.rows[id].st === 'open' && WBS.rows[id].tries === 0, ids[4]), 'Enter in an empty gap does nothing');
// a held Enter key does not use up the second try
await p.fill(inp(ids[4]), 'quatsch');
await p.evaluate(id => { const el = document.querySelector(`.wb-in[data-id="${id}"]`); el.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true})); document.querySelector(`.wb-in[data-id="${id}"]`).dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true, repeat:true})); }, ids[4]);
ok(await p.evaluate(id => WBS.rows[id].st === 'open' && WBS.rows[id].tries === 1, ids[4]), 'a held Enter key counts once');
// resume: values and states survive a reload
await p.fill(inp(ids[5]), 'halbfert');
await p.waitForTimeout(600);
await p.reload(); await p.waitForFunction(() => typeof WBS !== 'undefined' && WBS && document.querySelector('.wb-list'));
const res = await p.evaluate(a => ({same:JSON.stringify(WBS.ids) === JSON.stringify(a.ids), st:a.ids.slice(0, 5).map(id => WBS.rows[id].st), v:document.querySelector(`.wb-in[data-id="${a.ids[5]}"]`).value, ptr:!!document.querySelector(`.wb-row[data-id="${a.ids[4]}"] .wb-msg`)}), {ids});
ok(res.same && res.st.join() === 'help,wrong,right,wrong,open' && res.v === 'halbfert' && res.ptr, 'a sheet in progress is resumed after a reload, with what was typed');
// check all: fills are judged, empty gaps stay open
ans = await p.evaluate(() => Object.fromEntries(WBS.ids.map(id => [id, wbFrame(wbItem(id)).answer])));
await p.fill(inp(ids[5]), ans[ids[5]]); await p.fill(inp(ids[6]), 'quatsch'); await p.fill(inp(ids[4]), ans[ids[4]]);
await p.click('[data-act="wb-check-all"]');
ok(await p.evaluate(a => WBS.rows[a[5]].st === 'right' && WBS.rows[a[6]].st === 'open' && WBS.rows[a[6]].tries === 1 && WBS.rows[a[4]].st === 'help' && WBS.rows[a[7]].st === 'open' && WBS.rows[a[7]].tries === 0, ids), 'check all judges the filled gaps and leaves the empty ones');
// show the remaining answers needs two taps
await p.click('[data-act="wb-reveal-all"]');
ok(await p.evaluate(() => WBS.ids.some(id => WBS.rows[id].st === 'open')), 'one tap on "Show the remaining answers" does not reveal them');
await p.click('[data-act="wb-reveal-all"]');
ok(await p.evaluate(() => WBS.ids.every(id => WBS.rows[id].st !== 'open')) && await p.locator('.wb-summary').count() === 1, 'the second tap does');
// count it: a wrong typed answer can be counted, and the record is put back
ok(await p.locator(row(ids[1]) + ' [data-act="wb-count"]').count() === 1 && await p.locator(row(ids[3]) + ' [data-act="wb-count"]').count() === 1, '"count it" is offered where something was typed');
ok(await p.locator(row(ids[7]) + ' [data-act="wb-count"]').count() === 0, '"count it" is not offered for a line that was only shown');
await p.click(row(ids[1]) + ' [data-act="wb-count"]');
ok(await p.evaluate(id => WBS.rows[id].st === 'right' && WBS.rows[id].over && wbRec(id).r === 1 && wbRec(id).s === 2, ids[1]), 'counted as right, streak restored');
// repeat the missed ones
const missed = await p.evaluate(() => WBS.ids.filter(id => WBS.rows[id].st !== 'right'));
await p.click('[data-act="wb-retry"]');
ok(await p.evaluate(m => WBS.ids.length === m.length && WBS.ids.every(id => m.includes(id)) && WBS.ids.every(id => WBS.rows[id].st === 'open'), missed), 'the repeat sheet holds exactly the lines not right at once');
// mixed review: missed items come first
await p.evaluate(() => { UI.wbSize = 8; saveUI(); delete WBST.sheets.review; });
await go(p, 'workbook/review');
const rv = await p.evaluate(() => ({n:WBS.ids.length, missed:WBS.ids.filter(id => wbStatus(id) === 'missed').length, allMissed:wbReviewPool().filter(it => wbStatus(it.id) === 'missed').length, bonus:WBS.ids.some(id => wbSet(wbItem(id).set).group === 'bonus'), src:document.querySelectorAll('.wb-src').length}));
ok(rv.n === 8 && rv.missed === Math.min(8, rv.allMissed) && rv.missed > 0, `mixed review takes the missed items first (${rv.missed} of ${rv.allMissed})`);
ok(!rv.bonus && rv.src === 8, 'mixed review leaves the bonus sheet out and names each line\'s sheet');
// one element
await go(p, 'workbook/el-isch');
ok(await p.evaluate(() => WBS.ids.length === 16 && WBS.ids.every(id => wbItem(id).el === 'isch')), 'a one-element sheet holds 16 items of that element');
await p.goto(BASE + '#workbook/nonsense');
await p.waitForFunction(() => location.hash === '#workbook' && document.querySelector('.wb-card'));
ok(await p.locator('.wb-card').count() === sets.length, 'an unknown sheet address goes back to the workbook');
// rule sheet
await go(p, 'workbook/gegen');
await p.click('.wb-els .wb-el');
ok(await p.locator('#sheet:not([hidden]) .affix').count() === 1 && /Signal/.test(await p.locator('#sheet').innerText()), 'tapping an element opens its rule');
await p.keyboard.press('Escape');
// add to my words
ids = await p.evaluate(() => WBS.ids.slice());
const w0 = await p.evaluate(id => wbItem(id).w, ids[0]);
await typeIn(p, ids[0], await p.evaluate(id => wbFrame(wbItem(id)).answer, ids[0]));
await p.click(row(ids[0]) + ' summary'); await p.click(row(ids[0]) + ' [data-act="wb-add"]');
const added = await p.evaluate(w => { const it = DB.items.find(x => x.w === w); return it ? {parts:it.parts.join(''), kind:it.kind, en:it.en, src:it.source, seg:G.segment(it).map(x => x[0]).join('')} : null; }, w0);
ok(added && added.parts === w0 && added.seg === w0 && added.en && /Workbook/.test(added.src), `"Add to my words" puts ${w0} into the deck`);
await go(p, 'words');
ok((await p.locator('#view').innerText()).includes(w0), 'the added word is on the Words page');
await go(p, 'practice');
ok(await p.locator('a.wb-card[href="#workbook"]').count() === 1, 'the Practice page links to the workbook');

// sync: workbook progress merges per item, newest answer wins; a document from an old version loses nothing
const mg = await p.evaluate(() => {
  const L = {items:[], deleted:{}, patterns:{}, events:[], log:{}, wb:{it:{a:{n:2, ok:1, s:0, r:0, t:200}, b:{n:1, ok:1, s:1, r:1, t:100}}}};
  const R = {items:[], deleted:{}, patterns:{}, events:[], log:{}, wb:{it:{a:{n:1, ok:1, s:1, r:1, t:100}, b:{n:3, ok:3, s:3, r:1, t:300}, c:{n:1, ok:0, s:0, r:0, t:50}}}};
  const m = mergeDB(L, R), old = mergeDB(L, {items:[], deleted:{}, patterns:{}, events:[], log:{}}), none = mergeDB({items:[]}, {items:[]});
  return {a:m.wb.it.a.t, b:m.wb.it.b.n, c:!!m.wb.it.c, old:Object.keys(old.wb.it).length, none:JSON.stringify(none.wb), doc:!!docOf(DB).wb, sig:signature(L) !== signature(R), same:signature(m) === signature(mergeDB(R, L))};
});
ok(mg.a === 200 && mg.b === 3 && mg.c && mg.old === 2 && mg.none === '{"it":{}}' && mg.doc && mg.sig && mg.same, 'sync merge keeps the newest answer per item, in both directions');

// phone: nothing scrolls sideways, on the home page and on every sheet, open and answered
const m = await newPage({viewport:{width:360, height:740}, hasTouch:true, isMobile:true});
await go(m, 'workbook');
const wide = async () => m.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
ok(await wide() <= 0, 'phone: workbook home does not scroll sideways');
for (const s of sets) {
  await go(m, 'workbook/' + s.id);
  ok(await wide() <= 0, `phone: sheet ${s.id} does not scroll sideways`);
  const id3 = await m.evaluate(() => WBS.ids.slice(0, 3));
  await m.fill(inp(id3[0]), await m.evaluate(id => wbFrame(wbItem(id)).answer, id3[0])); await m.press(inp(id3[0]), 'Enter');
  await m.fill(inp(id3[1]), 'quatsch'); await m.press(inp(id3[1]), 'Enter');
  await m.fill(inp(id3[2]), 'quatsch'); await m.press(inp(id3[2]), 'Enter'); await m.fill(inp(id3[2]), 'unsinn'); await m.press(inp(id3[2]), 'Enter');
  ok(await wide() <= 0, `phone: sheet ${s.id} with feedback does not scroll sideways`);
  const small = await m.evaluate(() => Array.from(document.querySelectorAll('.wb-in')).filter(el => el.getBoundingClientRect().width < 100 || el.getBoundingClientRect().height < 40).length);
  ok(small === 0, `phone: sheet ${s.id}: every gap is big enough to type in`);
}
await m.tap(inp(await m.evaluate(() => WBS.ids.find(id => WBS.rows[id].st === 'open' && WBS.rows[id].tries === 0))));
ok(await m.locator('.wb-row:focus-within .wb-pad .chip').count() === 4, 'phone: the ä ö ü ß keys appear under the gap in use');
const padId = await m.evaluate(() => document.activeElement.dataset.id);
await m.fill(inp(padId), 'gr'); await m.tap('.wb-row:focus-within .wb-pad .chip[data-ch="ü"]'); await m.keyboard.type('n');
ok(await m.evaluate(id => document.querySelector(`.wb-in[data-id="${id}"]`).value === 'grün' && WBS.rows[id].v === 'grün' && document.activeElement.dataset.id === id, padId), 'phone: an umlaut key types into the gap and keeps the cursor there');
await m.tap(`.wb-row[data-id="${padId}"] [data-act="wb-check"]`);
ok(await m.evaluate(id => WBS.rows[id].tries === 1, padId), 'phone: the Check button of a line works');
ok(await m.locator('nav.bottom a[data-tab="workbook"].active').count() === 1, 'phone: Workbook is in the bottom bar');

ok(pageErrors.length === 0, 'no script errors on the page: ' + pageErrors.slice(0, 3).join(' | '));

/* ---------- optional: spelling dictionary ---------- */
if (process.env.DICT && fs.existsSync(process.env.DICT)) {
  const words = new Set(fs.readFileSync(process.env.DICT, 'utf8').split('\n').slice(1).map(l => l.split('/')[0].trim().toLocaleLowerCase('de-DE')));
  const lemmas = WB_SETS.flatMap(s => [s.example, ...s.items]).flatMap(it => [it.w, ...(it.alts || [])]);
  const unknown = Array.from(new Set(lemmas)).filter(w => !words.has(w));
  console.log(`Spelling dictionary: ${unknown.length} adjectives not listed as a headword (compounds and derived words often are not):\n  ${unknown.join(', ')}`);
}

await browser.close(); server.close();
console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL WORKBOOK CHECKS PASSED');
process.exit(failures ? 1 : 0);
