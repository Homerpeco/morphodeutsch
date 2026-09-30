/* MorphoDeutsch — grammar engine (no DOM).
   Declension, noun forms, morpheme segmentation, word-formation detection. */

const G = (() => {
  const lc = s => (s || '').toLocaleLowerCase('de-DE');
  const cap = s => s ? s.charAt(0).toLocaleUpperCase('de-DE') + s.slice(1) : s;
  const fold = s => lc(s).replace(/ä/g,'a').replace(/ö/g,'o').replace(/ü/g,'u').replace(/ß/g,'ss');

  /* ---------- adjective declension ---------- */
  // endings[articleType][case][gender]  gender: m f n p
  const ENDINGS = {
    def:   { N:{m:'e', f:'e', n:'e', p:'en'}, A:{m:'en', f:'e', n:'e', p:'en'}, D:{m:'en', f:'en', n:'en', p:'en'}, G:{m:'en', f:'en', n:'en', p:'en'} },
    indef: { N:{m:'er', f:'e', n:'es', p:'en'}, A:{m:'en', f:'e', n:'es', p:'en'}, D:{m:'en', f:'en', n:'en', p:'en'}, G:{m:'en', f:'en', n:'en', p:'en'} },
    zero:  { N:{m:'er', f:'e', n:'es', p:'e'}, A:{m:'en', f:'e', n:'es', p:'e'}, D:{m:'em', f:'er', n:'em', p:'en'}, G:{m:'en', f:'er', n:'en', p:'er'} }
  };
  const ARTICLES = {
    def:   { N:{m:'der', f:'die', n:'das', p:'die'}, A:{m:'den', f:'die', n:'das', p:'die'}, D:{m:'dem', f:'der', n:'dem', p:'den'} },
    indef: { N:{m:'ein', f:'eine', n:'ein', p:'keine'}, A:{m:'einen', f:'eine', n:'ein', p:'keine'}, D:{m:'einem', f:'einer', n:'einem', p:'keinen'} },
    zero:  { N:{m:'', f:'', n:'', p:''}, A:{m:'', f:'', n:'', p:''}, D:{m:'', f:'', n:'', p:''} }
  };
  const GENDER_EN = {m:'masculine', f:'feminine', n:'neuter', p:'plural'};
  const CASE_EN = {N:'nominative', A:'accusative', D:'dative', G:'genitive'};
  const ART_EN = {def:'definite article', indef:'indefinite article', zero:'no article'};

  // stem used before an ending: dunkel → dunkl-, teuer → teur-, hoch → hoh-
  function declStem(adj){
    const w = adj || '';
    if (lc(w) === 'hoch') return w.slice(0, -1) + 'h';
    if (/[^e]el$/.test(w) && w.length > 4) return w.slice(0, -2) + 'l';
    if (/(au|eu)er$/.test(w)) return w.slice(0, -2) + 'r';
    return w;
  }
  function inflect(adj, ending){ return declStem(adj) + ending; }

  /* ---------- nouns ---------- */
  const WEAK_FORCE = {Herr:'Herrn', Nachbar:'Nachbarn', Bauer:'Bauern', Mensch:'Menschen', Held:'Helden', Fürst:'Fürsten',
    Graf:'Grafen', Prinz:'Prinzen', Architekt:'Architekten', Soldat:'Soldaten', Kandidat:'Kandidaten', Diplomat:'Diplomaten',
    Automat:'Automaten', Bürokrat:'Bürokraten', Demokrat:'Demokraten', Pirat:'Piraten', Akrobat:'Akrobaten', Kamerad:'Kameraden',
    Chirurg:'Chirurgen', Bär:'Bären', Narr:'Narren'};
  const STRONG_KEEP = new Set(['Käse','Moment','Kontinent','Zement','Akzent','Advent','Proviant','Argument','Mist','Zwist','Twist','Kompromiss']);
  function weakForm(sg){
    if (WEAK_FORCE[sg]) return WEAK_FORCE[sg];
    if (STRONG_KEEP.has(sg)) return null;
    if (/e$/.test(sg)) return sg + 'n';
    if (/(ent|ant|ist|oge|graf|soph|nom)$/.test(sg) && sg.length > 5) return sg + 'en';
    return null;
  }
  function umlautLast(s){
    const m = s.match(/^(.*?)(au|a|o|u)([^aeiouäöü]*)$/i);
    if (!m) return s;
    const map = {au:'äu', a:'ä', o:'ö', u:'ü', Au:'Äu', A:'Ä', O:'Ö', U:'Ü'};
    return m[1] + (map[m[2]] || m[2]) + m[3];
  }
  // "die Strategie, -n" | "der Vortrag, ¨-e" | "die Firma, Firmen" | "das Arbeiten"
  function parseNoun(str){
    const raw = (str || '').trim();
    const m = raw.match(/^(der|die|das)\s+([^,(]+?)\s*(?:[,(]\s*(?:Pl\.?\s*)?([^)]*?)\s*\)?)?$/i);
    if (!m) return null;
    const g = {der:'m', die:'f', das:'n'}[lc(m[1])];
    const sg = m[2].trim();
    let pl = null;
    const p = (m[3] || '').trim();
    if (p) {
      if (p === '-' || p === '–') pl = sg;
      else if (/^¨?-/.test(p)) {
        const um = p.startsWith('¨');
        const suf = p.replace(/^¨?-/, '');
        pl = (um ? umlautLast(sg) : sg) + suf;
      } else if (/^[A-ZÄÖÜ]/.test(p)) pl = p;
      else if (/^(n|en|e|er|s|nen)$/.test(p)) pl = sg + p;
    }
    return { g, sg, pl, weak: g === 'm' ? weakForm(sg) : null, raw };
  }
  function nounForm(n, c, num){
    if (num === 'p') {
      if (!n.pl) return null;
      if (c === 'D' && !/[ns]$/.test(n.pl)) return n.pl + 'n';
      return n.pl;
    }
    if (n.g === 'm' && n.weak && (c === 'A' || c === 'D')) return n.weak;
    return n.sg;
  }
  // all (case, articleType, number) combos usable for this noun
  function phraseSlots(n){
    const out = [];
    for (const c of ['N','A','D']) {
      out.push({c, a:'def', num:'s'});
      out.push({c, a:'indef', num:'s'});
      if (n.pl) { out.push({c, a:'def', num:'p'}); out.push({c, a:'zero', num:'p'}); }
    }
    return out;
  }
  // frame: returns {pre, post, label} for the gap "pre ___ post"
  function frame(n, slot){
    const gk = slot.num === 'p' ? 'p' : n.g;
    const art = ARTICLES[slot.a][slot.c][gk];
    const noun = nounForm(n, slot.c, slot.num);
    const ending = ENDINGS[slot.a][slot.c][gk];
    let lead;
    if (slot.c === 'N') lead = slot.num === 'p' ? 'Das sind' : 'Das ist';
    else if (slot.c === 'A') lead = 'für';
    else lead = 'mit';
    const pre = [lead, art].filter(Boolean).join(' ');
    const post = noun + (slot.c === 'N' ? '.' : '');
    return { pre, post, ending, art, gk, noun };
  }
  function endingWhy(slot, gk, fr){
    const why = [];
    if (slot.c === 'A') why.push('für takes the accusative');
    else if (slot.c === 'D') why.push('mit takes the dative');
    else why.push('after "Das ist / Das sind" the noun is nominative');
    if (slot.a === 'zero') why.push('no article, so the adjective carries the case signal itself');
    else why.push(`${fr.art}: ${ART_EN[slot.a]}, ${GENDER_EN[gk]}`);
    return why;
  }

  /* ---------- morphemes ---------- */
  // roles: base | fug | suf | pre | ge
  function segment(it){
    const parts = (it.parts && it.parts.length) ? it.parts : [it.w];
    const k = it.kind;
    const n = parts.length;
    if (k === 'suffix') {
      if (n === 1) return [[parts[0], 'base']];
      if (n === 2) return [[parts[0], 'base'], [parts[1], 'suf']];
      return parts.map((p, i) => [p, i === n - 1 ? 'suf' : (i === n - 2 && /^(s|es|n|en|e|er)$/.test(p) ? 'fug' : 'base')]);
    }
    if (k === 'prefix') return parts.map((p, i) => [p, i === 0 ? 'pre' : 'base']);
    if (k === 'p1') return parts.map((p, i) => [p, i === n - 1 && n > 1 ? 'suf' : 'base']);
    if (k === 'p2') {
      const gi = parts.indexOf('ge');
      return parts.map((p, i) => {
        if (i === gi) return [p, 'ge'];
        if (i === n - 1 && n > 1) return [p, 'suf'];
        if (gi > 0 && i < gi) return [p, 'pre'];
        return [p, 'base'];
      });
    }
    if (k === 'compound') return parts.map((p, i) => [p, i === n - 1 && n > 1 ? 'suf' : 'base']);
    return [[parts.join(''), 'base']];
  }
  function partsValid(it){ return it.parts && it.parts.join('') === it.w; }

  /* ---------- verbs ---------- */
  const SEP = ['auseinander','zusammen','entgegen','gegenüber','herunter','hinunter','herüber','hinüber','herauf','heraus','herein',
    'hinauf','hinaus','hinein','zurück','weiter','vorbei','voraus','herum','fest','teil','los','weg','her','hin','ab','an','auf',
    'aus','bei','ein','mit','nach','vor','zu','fort','heim','nieder'].sort((a,b) => b.length - a.length);
  const INSEP = ['miss','emp','ent','er','ge','ver','zer','be','über','unter','hinter','durch','wider'];
  const STRONG_P2 = {entscheiden:'entschieden', betreffen:'betroffen', verbinden:'verbunden', erfahren:'erfahren',
    begeistern:'begeistert', verlieren:'verloren', vergessen:'vergessen', bekommen:'bekommen', anerkennen:'anerkannt',
    überwinden:'überwunden', gewinnen:'gewonnen', schreiben:'geschrieben', treiben:'getrieben', spannen:'gespannt',
    bringen:'gebracht', denken:'gedacht', kennen:'gekannt', brennen:'gebrannt', rennen:'gerannt', nennen:'genannt',
    verstehen:'verstanden', bestehen:'bestanden', entstehen:'entstanden', erschrecken:'erschrocken', halten:'gehalten',
    geben:'gegeben', nehmen:'genommen', sehen:'gesehen', lesen:'gelesen', fahren:'gefahren', laufen:'gelaufen'};
  function splitSep(inf){
    for (const p of SEP) if (inf.startsWith(p) && inf.length - p.length >= 4) return [p, inf.slice(p.length)];
    return [null, inf];
  }
  function weakStem(inf){
    if (/[eo]ln$|ern$/.test(inf)) return inf.slice(0, -1);
    if (/en$/.test(inf)) return inf.slice(0, -2);
    if (/n$/.test(inf)) return inf.slice(0, -1);
    return inf;
  }
  // best guess for Partizip II; {w, parts, sure}
  function partizip2(verbRaw){
    const inf = lc((verbRaw || '').replace(/^sich\s+/i, '').trim());
    if (!inf) return null;
    if (STRONG_P2[inf]) {
      const w = STRONG_P2[inf];
      return {w, parts:[w], sure:true};
    }
    if (/ieren$/.test(inf)) { const st = inf.slice(0, -2); return {w: st + 't', parts:[st, 't'], sure:true}; }
    const [sep, rest] = splitSep(inf);
    if (sep && STRONG_P2[rest]) {
      const w = sep + STRONG_P2[rest];
      return {w, parts:[w], sure:true};
    }
    const insep = INSEP.find(p => rest.startsWith(p) && rest.length - p.length >= 3);
    const stem = weakStem(rest);
    const suf = /(d|t|chn|ffn|dm|gn|tm)$/.test(stem) ? 'et' : 't';
    if (insep) {
      const w = (sep || '') + stem + suf;
      return {w, parts: sep ? [sep, stem, suf] : [stem, suf], sure:false};
    }
    const w = (sep || '') + 'ge' + stem + suf;
    return {w, parts: sep ? [sep, 'ge', stem, suf] : ['ge', stem, suf], sure:false};
  }
  function partizip1(verbRaw){
    const inf = lc((verbRaw || '').replace(/^sich\s+/i, '').trim());
    return inf ? {w: inf + 'd', parts:[inf, 'd']} : null;
  }

  /* ---------- word-formation detection ---------- */
  const SUFFIX_ORDER = ['fähig','würdig','mäßig','voll','los','reich','frei','wert','haft','lich','isch','bar','sam','ig','ell','al','iv','ant','ent'];
  const FUG_NOUN_END = /(ung|heit|keit|schaft|ion|tät|ität|ling|sicht)$/;
  const FUG_NOUNS = new Set(['arbeit','zukunft','anspruch','leistung','liebe','geburt','hilfe','geschäft','verkehr','wirtschaft']);
  const FEM_END = /(ung|heit|keit|schaft|ion|tät|ik|ie|ur|enz|anz|e|in)$/;
  const MASC_END = /(ling|ismus|or)$/;
  const NEUT_END = /(chen|lein|ment|um|nis)$/;
  function guessArticle(noun){
    const l = lc(noun);
    if (NEUT_END.test(l)) return 'das';
    if (MASC_END.test(l)) return 'der';
    if (FEM_END.test(l)) return 'die';
    return '';
  }
  function deUmlaut(s){
    const i = Math.max(s.lastIndexOf('ä'), s.lastIndexOf('ö'), s.lastIndexOf('ü'));
    if (i < 0) return null;
    const map = {'ä':'a','ö':'o','ü':'u'};
    return {s: s.slice(0, i) + map[s[i]] + s.slice(i + 1), change: `${map[s[i]]} → ${s[i]}`};
  }

  // lookup in library + seed first, then rules. Returns a draft item (partial).
  function analyze(wordRaw, known){
    const w = lc((wordRaw || '').trim());
    if (!w) return null;
    // 1) exact entry in the affix library or starter deck
    for (const a of AFFIXES) for (const e of a.ex) if (e.w === w)
      return {kind:a.kind, affix:a.id, base:e.base, parts:e.parts.slice(), change:e.change || '', en:e.en, source:'library', sure:true};
    const seed = SEED.find(s => s.w === w);
    if (seed) return {kind:seed.kind, affix:seed.affix, base:seed.base, parts:seed.parts.slice(), change:seed.change || '', en:seed.en, source:'library', sure:true};
    const knownWords = new Set([...(known || []), ...AFFIXES.flatMap(a => a.ex.map(e => e.w)), ...SEED.map(s => s.w)]);

    // 2) prefixes
    if (w.startsWith('inter') && w.length > 9) return {kind:'prefix', affix:'inter', base:w.slice(5), parts:['inter', w.slice(5)], sure:true};
    if (w.startsWith('hoch') && w.length > 8) return {kind:'prefix', affix:'hoch', base:w.slice(4), parts:['hoch', w.slice(4)], sure:true};
    if (w.startsWith('un') && !w.startsWith('unter') && w.length > 6) {
      const rest = w.slice(2);
      const inner = analyzeCore(rest, knownWords);
      return {kind:'prefix', affix:'un', base:rest, parts:['un', rest], sure: knownWords.has(rest)};
    }
    for (const [pre, rest] of [['in', w.slice(2)], ['il', w.slice(2)], ['ir', w.slice(2)], ['im', w.slice(2)]])
      if (w.startsWith(pre) && knownWords.has(rest)) return {kind:'prefix', affix:'in', base:rest, parts:[pre, rest], sure:true};
    return analyzeCore(w, knownWords) || {kind:'simple', affix:'', base:'', parts:[w], sure:false};
  }

  function analyzeCore(w, knownWords){
    // Partizip II of -ieren verbs
    if (/iert$/.test(w) && w.length > 6) return {kind:'p2', affix:'p2', base: w.slice(0, -1) + 'en', parts:[w.slice(0, -1), 't'], sure:true};
    // Partizip I: infinitive + d
    if (/(en|ern|eln)d$/.test(w) && w.length > 6) {
      const inf = w.slice(0, -1);
      return {kind:'p1', affix:'p1', base:inf, parts:[inf, 'd'], sure:true};
    }
    // suffixes
    for (const s of SUFFIX_ORDER) {
      if (!w.endsWith(s) || w.length - s.length < 2) continue;
      if (['ell','al','iv','ant','ent','ig','isch'].includes(s) && w.length < 6) continue;
      let stem = w.slice(0, -s.length);
      let fug = '';
      const aff = s;
      if (['fähig','voll','los','reich','frei','wert','würdig','mäßig'].includes(s) && stem.endsWith('s') && stem.length > 3) {
        const noS = stem.slice(0, -1);
        if (FUG_NOUN_END.test(noS) || FUG_NOUNS.has(noS) || ((s === 'wert' || s === 'würdig') && /en$/.test(noS))) { fug = 's'; stem = noS; }
      }
      const parts = fug ? [stem, fug, s] : [stem, s];
      let base = '', change = '';
      if (['bar','sam'].includes(s)) base = stem + (/(el|er)$/.test(stem) ? 'n' : 'en');
      else if ((s === 'wert' || s === 'würdig') && fug) base = stem;
      else if (['iv'].includes(s)) base = 'die ' + cap(stem) + 'ion';
      else if (s === 'ant') base = 'die ' + cap(stem) + 'anz';
      else if (s === 'ent') base = 'die ' + cap(stem) + 'enz';
      else if (['isch','ell','al'].includes(s)) base = '';
      else {
        let noun = stem;
        if (['lich','ig'].includes(s)) {
          const du = deUmlaut(stem);
          if (du) { noun = du.s; change = du.change; }
        }
        const art = guessArticle(noun);
        base = (art ? art + ' ' : '') + cap(noun);
      }
      return {kind:'suffix', affix:aff, base, parts, change, sure:false};
    }
    // Partizip II with ge-
    const pm = w.match(/^([a-zäöü]*?)ge([a-zäöü]{3,}?)(et|t)$/);
    if (pm && (!pm[1] || SEP.includes(pm[1]))) {
      const stem = pm[2];
      const base = (pm[1] || '') + stem + (/(el|er)$/.test(stem) ? 'n' : 'en');
      const parts = [pm[1], 'ge', stem, pm[3]].filter(Boolean);
      return {kind:'p2', affix:'p2', base, parts, sure:false};
    }
    // Partizip II of inseparable verbs: ent-fern-t, be-geister-t, ver-ärger-t (no ge-)
    const im = w.match(/^(be|emp|ent|er|ver|zer|miss|über|unter|hinter|wider)([a-zäöü]{3,}?)(et|t)$/);
    if (im && im[2].length >= 4 - (im[3] === 'et' ? 1 : 0)) {
      const stem = im[1] + im[2];
      const base = stem + (/(el|er)$/.test(stem) ? 'n' : 'en');
      return {kind:'p2', affix:'p2', base, parts:[stem, im[3]], sure:false};
    }
    return null;
  }

  // family suggestions from a draft analysis
  function knownPair(w){
    const l = lc(w);
    const p = (typeof PPAIRS !== 'undefined' ? PPAIRS : []).find(x => x.a === l || x.b === l);
    return p ? (p.a === l ? p.b : p.a) : '';
  }
  function familyGuess(d, w){
    const out = [];
    if (d.base && d.kind !== 'compound') out.push(d.base);
    const kp = knownPair(w); if (kp) out.push(kp);
    for (const a of AFFIXES) for (const e of a.ex)
      if (e.w !== w && d.base && e.base === d.base && !out.includes(e.w)) out.push(e.w);
    return out;
  }
  // {w, sure}: sure only for known pairs; otherwise a suggestion the learner confirms
  function partnerGuess(d, w){
    const kp = knownPair(w || ''); if (kp) return {w:kp, sure:true};
    if (d.kind === 'p1') { const p = partizip2(d.base); return p ? {w:p.w, sure:false} : null; }
    return null;
  }

  /* ---------- finding the adjective inside a sentence ---------- */
  const END_SET = ['', 'e', 'en', 'er', 'es', 'em'];
  function findForm(sentence, adj){
    const stem = lc(declStem(adj));
    const plain = lc(adj);
    const re = /[A-Za-zÄÖÜäöüß-]+/g;
    let m;
    while ((m = re.exec(sentence))) {
      const tok = m[0], l = lc(tok);
      let ending = null;
      if (l === plain) ending = '';
      else if (l.startsWith(stem)) { const r = l.slice(stem.length); if (END_SET.includes(r) && r) ending = r; }
      if (ending !== null) return {index:m.index, form:tok, ending};
    }
    return null;
  }

  return { lc, cap, fold, ENDINGS, ARTICLES, GENDER_EN, CASE_EN, ART_EN, declStem, inflect, parseNoun, nounForm, phraseSlots, frame,
    endingWhy, segment, partsValid, partizip1, partizip2, analyze, familyGuess, partnerGuess, guessArticle, findForm, umlautLast, weakForm };
})();
