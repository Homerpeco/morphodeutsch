// MorphoDeutsch — full-split test. Every word must come out exactly as listed: cut where a piece can be confirmed,
// left whole where it cannot. Run: node tests/morph-test.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import '../morph.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const Module = require('module');
const m = new Module('app');
m._compile(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8') + '\nmodule.exports = {G, AFFIXES, SEED};', path.join(ROOT, 'bundle.cjs'));
const { G, AFFIXES, SEED } = m.exports;
const MORPH = globalThis.MORPH;

let fail = 0, n = 0;
const split = (w, known) => {
  const d = G.analyze(w, known || []);
  const it = { w, kind: d.kind, parts: d.parts, affix: d.affix };
  const pieces = MORPH.deepen(G.segment(it), it.kind, { affix: it.affix });
  return { text: pieces.map(p => p.t).join('·'), pieces, roles: MORPH.roles(pieces).map(r => r[1]).join(' ') };
};
function expect(w, want, known) {
  n++;
  const got = split(w, known);
  if (got.text.replace(/·/g, '') !== w) { fail++; console.log(`FAIL ${w}: pieces do not spell the word (${got.text})`); return; }
  if (got.text !== want) { fail++; console.log(`FAIL ${w}: got ${got.text}, expected ${want}`); }
}

// stacked prefixes and full depth
const DEEP = {
  unzerbrechlich: 'un·zer·brech·lich', unverständlich: 'un·ver·ständ·lich', unabhängig: 'un·ab·häng·ig', unbeschreiblich: 'un·be·schreib·lich',
  unerträglich: 'un·er·träg·lich', unbekannt: 'un·be·kann·t', unbefristet: 'un·be·frist·et', unkompliziert: 'un·komplizier·t',
  unglaublich: 'un·glaub·lich', ungewöhnlich: 'un·gewöhn·lich', unpünktlich: 'un·pünkt·lich', unwichtig: 'un·wicht·ig', unsicher: 'un·sicher',
  unzufrieden: 'un·zufrieden', unerfahren: 'un·er·fahr·en', unverheiratet: 'un·ver·heirat·et', unbeliebt: 'un·be·lieb·t', unbewusst: 'un·be·wuss·t',
  unentschieden: 'un·ent·schied·en', unangemessen: 'un·an·ge·mess·en', ununterbrochen: 'un·unter·broch·en',
  zuverlässig: 'zu·ver·läss·ig', unzuverlässig: 'un·zu·ver·läss·ig', verantwortungsvoll: 'ver·antwort·ung·s·voll',
  abwechslungsreich: 'ab·wechsl·ung·s·reich', anspruchsvoll: 'an·spruch·s·voll', zukunftsfähig: 'zu·kunft·s·fähig', leistungsfähig: 'leist·ung·s·fähig',
  erreichbar: 'er·reich·bar', belastbar: 'be·last·bar', vergleichbar: 'ver·gleich·bar', erkennbar: 'er·kenn·bar', verfügbar: 'ver·füg·bar',
  erfolgreich: 'er·folg·reich', einflussreich: 'ein·fluss·reich', umfangreich: 'um·fang·reich', beruflich: 'be·ruf·lich',
  verständlich: 'ver·ständ·lich', unterschiedlich: 'unter·schied·lich', vorsichtig: 'vor·sicht·ig', zufällig: 'zu·fäll·ig', abhängig: 'ab·häng·ig',
  aufmerksam: 'auf·merk·sam', erholsam: 'er·hol·sam', empfehlenswert: 'emp·fehl·en·s·wert', sehenswert: 'seh·en·s·wert', lesenswert: 'les·en·s·wert',
  wirtschaftlich: 'wirt·schaft·lich', beispielhaft: 'bei·spiel·haft', vorteilhaft: 'vor·teil·haft', fortschrittlich: 'fort·schritt·lich',
  aufregend: 'auf·reg·en·d', herausfordernd: 'heraus·forder·n·d', ausdauernd: 'aus·dauer·n·d', anstrengend: 'an·streng·en·d', überzeugend: 'über·zeug·en·d',
  entscheidend: 'ent·scheid·en·d', belastend: 'be·last·en·d', abwechselnd: 'ab·wechsel·n·d', umfassend: 'um·fass·en·d', motivierend: 'motivier·en·d',
  spannend: 'spann·en·d', passend: 'pass·en·d',
  aufgeregt: 'auf·ge·reg·t', entfernt: 'ent·fern·t', überzeugt: 'über·zeug·t', verheiratet: 'ver·heirat·et', kompliziert: 'komplizier·t',
  motiviert: 'motivier·t', gestresst: 'ge·stress·t', gelangweilt: 'ge·langweil·t',
  international: 'inter·nation·al', interkulturell: 'inter·kultur·ell', hochqualifiziert: 'hoch·qualifizier·t', hochmotiviert: 'hoch·motivier·t',
  inkompetent: 'in·kompet·ent', irrelevant: 'ir·relev·ant', illegal: 'il·legal', instabil: 'in·stabil', inaktiv: 'in·aktiv',
  selbstständig: 'selbst·ständ·ig'
};
// nothing to cut, or nothing that can be confirmed: these must stay as they are
const WHOLE = {
  gefährlich: 'gefähr·lich', langweilig: 'langweil·ig', interessant: 'interess·ant', kreativ: 'kreat·iv', sicher: 'sicher', modern: 'modern', mobil: 'mobil',
  ernsthaft: 'ernst·haft', regelmäßig: 'regel·mäßig', kostenlos: 'kosten·los', fehlerfrei: 'fehler·frei', pünktlich: 'pünkt·lich', teamfähig: 'team·fähig',
  kompetent: 'kompet·ent', flexibel: 'flexibel', hilfsbereit: 'hilfsbereit', glücklich: 'glück·lich', wichtig: 'wicht·ig', möglich: 'mög·lich',
  freundlich: 'freund·lich', persönlich: 'persön·lich', täglich: 'täg·lich', ärztlich: 'ärzt·lich', ruhig: 'ruh·ig', geduldig: 'geduld·ig', fleißig: 'fleiß·ig',
  hilfreich: 'hilf·reich', zahlreich: 'zahl·reich', lehrreich: 'lehr·reich', wertvoll: 'wert·voll', sinnvoll: 'sinn·voll', respektvoll: 'respekt·voll',
  rücksichtsvoll: 'rücksicht·s·voll', arbeitslos: 'arbeit·s·los', stressfrei: 'stress·frei', praktisch: 'prakt·isch', technisch: 'techn·isch',
  kulturell: 'kultur·ell', national: 'nation·al', informativ: 'informat·iv', produktiv: 'produkt·iv', tolerant: 'toler·ant', effizient: 'effizi·ent',
  machbar: 'mach·bar', lieferbar: 'liefer·bar', sparsam: 'spar·sam', wirksam: 'wirk·sam', erblich: 'erb·lich', einsam: 'ein·sam', ehrlich: 'ehr·lich',
  bereit: 'bereit', bequem: 'bequem', besser: 'besser', genau: 'genau', gesund: 'gesund', gerade: 'gerade', gemein: 'gemein', ernst: 'ernst', erst: 'erst',
  verletzt: 'verletz·t', begeistert: 'begeister·t', erlaubt: 'erlaub·t', universal: 'univers·al', uniform: 'uniform', zufrieden: 'zufrieden'
};
for (const [w, want] of Object.entries(DEEP)) expect(w, want);
for (const [w, want] of Object.entries(WHOLE)) expect(w, want);

// roles: stacked prefixes get two shades, so do stacked endings
const r1 = split('unzerbrechlich').roles, r2 = split('verantwortungsvoll').roles, r3 = split('aufgeregt').roles;
n += 3;
if (r1 !== 'pre pre2 base suf') { fail++; console.log('FAIL roles unzerbrechlich:', r1); }
if (r2 !== 'pre base suf2 fug suf') { fail++; console.log('FAIL roles verantwortungsvoll:', r2); }
if (r3 !== 'pre ge base suf') { fail++; console.log('FAIL roles aufgeregt:', r3); }

// every library and starter word: pieces spell the word, and the first split is the same in morph.js and engine.js
for (const a of AFFIXES) for (const e of a.ex) {
  n++;
  const it = { w: e.w, kind: a.kind, parts: e.parts, affix: a.id };
  const pieces = MORPH.deepen(G.segment(it), it.kind, { affix: it.affix });
  if (pieces.map(p => p.t).join('') !== e.w) { fail++; console.log('FAIL library', e.w, pieces.map(p => p.t).join('·')); }
  if (JSON.stringify(MORPH.immediate(a.kind, e.parts)) !== JSON.stringify(G.segment(it))) { fail++; console.log('FAIL immediate differs', e.w); }
  if (pieces.some(p => p.k === 'root' && (p.t.length < 2 || !/[aeiouäöüy]/.test(p.t)))) { fail++; console.log('FAIL library root too small', e.w, pieces.map(p => p.t).join('·')); }
}
for (const s of SEED) {
  n++;
  const pieces = MORPH.deepen(G.segment(s), s.kind, { affix: s.affix });
  if (pieces.map(p => p.t).join('') !== s.w) { fail++; console.log('FAIL seed', s.w); }
  if (JSON.stringify(MORPH.immediate(s.kind, s.parts)) !== JSON.stringify(G.segment(s))) { fail++; console.log('FAIL immediate differs', s.w); }
}
// repairing an AI answer that stopped early
const fin = t => { const f = MORPH.finer(t); return f ? f.map(p => p.t).join('·') : null; };
const FIN = { zerbrechlich: 'zer·brech·lich', zerbrech: 'zer·brech', verständlich: 'ver·ständ·lich', brech: null, gewöhn: null, ernst: null, antwort: null,
  besser: null, verlust: null, team: null, kosten: null, gefähr: null, möglich: 'mög·lich', verantwortung: 'ver·antwort·ung', wirtschaft: 'wirt·schaft' };
for (const [t, want] of Object.entries(FIN)) { n++; if (fin(t) !== want) { fail++; console.log(`FAIL finer(${t}): got ${fin(t)}, expected ${want}`); } }

if (process.env.VERBOSE) for (const a of AFFIXES) console.log(a.id.padEnd(6), a.ex.map(e => MORPH.deepen(G.segment({ w: e.w, kind: a.kind, parts: e.parts }), a.kind, { affix: a.id }).map(p => p.t).join('·')).join('  '));
console.log(fail ? `${fail} of ${n} FAILED` : `all ${n} split checks passed`);
process.exit(fail ? 1 : 0);
