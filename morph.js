/* MorphoDeutsch — full morpheme split (shared by the app and by /api/enrich).
   Takes a word's first split (un + zerbrechlich) down to its smallest pieces (un · zer · brech · lich).
   Rule: cut only what can be confirmed. A prefix or an inner noun ending is split off only when what is left is a
   known verb stem, a known ablaut stem (spruch → sprechen) or a known root. Anything else stays whole, so nothing
   is over-cut (Ernte, ernst, besser, Gefahr stay as they are).
   Plain script: sets a global MORPH. In Node, `import './morph.js'` has the same effect. */
(function (scope) {
  'use strict';
  const lc = s => String(s == null ? '' : s).toLocaleLowerCase('de-DE');
  const VOWEL = /[aeiouäöüy]/;
  const deUmlaut = s => {
    const i = Math.max(s.lastIndexOf('ä'), s.lastIndexOf('ö'), s.lastIndexOf('ü'));
    return i < 0 ? '' : s.slice(0, i) + ({'ä':'a', 'ö':'o', 'ü':'u'})[s[i]] + s.slice(i + 1);
  };

  // common base verbs (no prefixed verbs: the prefix is what gets split off)
  const VERBS = new Set(`achten ahnen ändern antworten arbeiten ärgern atmen äußern backen bauen beben beißen bergen bessern beten betteln
    biegen bieten bilden binden bitten blasen bleiben blenden blicken blühen bluten bohren brauchen brechen breiten bremsen brennen
    bringen buchen danken dauern decken dehnen denken deuten dichten dienen drängen drehen dringen drohen drucken drücken dulden
    ebnen ehren eifern eignen eilen enden erben ernten essen fahren fallen fällen fälschen fangen färben fassen fehlen feiern fertigen
    festigen feuern finden fliegen fliehen fließen folgen fordern fördern formen forschen fragen freuen frieren fügen fühlen führen
    füllen fürchten geben gehen gelten genießen gießen glänzen glauben gleichen gleiten graben greifen grenzen gründen grüßen gucken
    haften halten handeln hängen härten hassen hauen heben heilen heiraten heißen heizen helfen hemmen hindern hoffen holen
    hören hüten irren jagen kämpfen kaufen kehren kennen klagen klären kleben kleiden klingen klopfen kochen kommen können kosten
    kräftigen kränken kriegen kümmern kürzen lachen laden lagern lähmen landen lassen lasten laufen lauten läuten leben leeren legen
    lehnen lehren leiden leihen leisten leiten lenken lernen lesen leuchten lieben liefern liegen lindern loben lockern lohnen lösen
    lügen machen mahnen malen meiden meinen melden merken messen mieten mindern mischen mögen mühen münden mustern nähen nähern
    nähren nehmen neigen nennen nutzen nützen öffnen opfern ordnen packen passen pflegen planen prüfen putzen quälen rächen rasen rasten
    raten rauben rauchen räumen rechnen reden regeln regen reichen reifen reinigen reisen reißen reiten reizen rennen retten richten
    riechen ringen rollen rücken rufen ruhen rühmen rühren rüsten sagen sammeln sättigen säubern schaden schaffen schalten schämen
    schärfen schätzen schauen scheiden scheinen schenken scheuen schicken schieben schießen schildern schlafen schlagen schließen
    schmecken schmücken schneiden schonen schöpfen schränken schreiben schreien schreiten schulden schulen schützen schwächen schwanken
    schweigen schwimmen schwören sehen sehnen senden senken setzen sichern siegen singen sinken sitzen sorgen spalten spannen
    sparen sperren spiegeln spielen spotten sprechen springen spüren stammen stärken starten stauen staunen stechen stecken stehen
    stehlen steigen stellen sterben steuern stiften stillen stimmen stopfen stören stoßen strafen streben strecken streichen streiten
    stürzen stützen suchen tadeln tasten tauchen tauschen täuschen teilen toben tönen töten tragen trauen trauern träumen treffen treiben
    trennen treten trinken trocknen trösten trüben tun üben wachen wachsen wagen wählen wahren währen walten wandeln wandern wärmen warnen
    warten waschen wechseln wecken wehren weichen weigern weihen weinen weisen weiten wenden werben werfen werten wetten wickeln
    widmen wiegen winken wirken wissen wohnen wundern wünschen würdigen zahlen zählen zähmen zeichnen zeigen zerren zeugen ziehen
    zielen zieren zögern zünden zürnen zweifeln zwingen`.split(/\s+/).filter(Boolean));

  // stems that changed their vowel or shape: the form inside the word → the verb it belongs to
  const STEMS = {
    spruch:'sprechen', sprüch:'sprechen', sprach:'sprechen', sproch:'sprechen', kunft:'kommen', künft:'kommen',
    stand:'stehen', ständ:'stehen', gang:'gehen', gäng:'gehen', zug:'ziehen', züg:'ziehen', zog:'ziehen',
    schluss:'schließen', schlüss:'schließen', schloss:'schließen', sicht:'sehen', nahm:'nehmen', nomm:'nehmen',
    griff:'greifen', schrift:'schreiben', schrieb:'schreiben', fluss:'fließen', flüss:'fließen', wuchs:'wachsen',
    tat:'tun', tät:'tun', tan:'tun', gab:'geben', bruch:'brechen', brüch:'brechen', broch:'brechen',
    wurf:'werfen', würf:'werfen', worf:'werfen', schnitt:'schneiden', schuss:'schießen', sprung:'springen',
    klang:'klingen', zwang:'zwingen', band:'binden', bund:'binden', bünd:'binden', fund:'finden',
    trieb:'treiben', stieg:'steigen', ritt:'reiten', biss:'beißen', riss:'reißen', schritt:'schreiten',
    schub:'schieben', flug:'fliegen', flüg:'fliegen', flucht:'fliehen', kann:'kennen', kannt:'kennen',
    nannt:'nennen', brannt:'brennen', wandt:'wenden', sandt:'senden', dacht:'denken', bracht:'bringen',
    wuss:'wissen', wusst:'wissen', fahrt:'fahren', lag:'liegen', satz:'setzen', sätz:'setzen',
    hilf:'helfen', schied:'scheiden', blieb:'bleiben', bot:'bieten', wies:'weisen', hob:'heben',
    troff:'treffen', trag:'tragen', wahl:'wählen', druck:'drucken', blick:'blicken'
  };
  // noun and adjective roots that a prefix or a noun ending is built on, with the word to show for them
  const ROOTS = {
    fern:'fern', nah:'nah', frei:'frei', klar:'klar', sicher:'sicher', gesund:'gesund', krank:'krank', fremd:'fremd',
    eigen:'eigen', gleich:'gleich', neu:'neu', alt:'alt', jung:'jung', groß:'groß', klein:'klein', lang:'lang', kurz:'kurz',
    tief:'tief', weit:'weit', breit:'breit', eng:'eng', schwer:'schwer', leicht:'leicht', stark:'stark', schwach:'schwach',
    hart:'hart', weich:'weich', warm:'warm', kalt:'kalt', kühl:'kühl', hell:'hell', laut:'laut', leise:'leise', still:'still',
    schnell:'schnell', früh:'früh', spät:'spät', arm:'arm', schön:'schön', wahr:'wahr', falsch:'falsch', echt:'echt',
    treu:'treu', rein:'rein', fein:'fein', grob:'grob', fest:'fest', offen:'offen', streng:'streng', fair:'fair', genau:'genau',
    freund:'der Freund', feind:'der Feind', wirt:'der Wirt', gesell:'der Geselle', wissen:'das Wissen',
    frist:'die Frist', punkt:'der Punkt', glück:'das Glück', sinn:'der Sinn', wert:'der Wert', zweck:'der Zweck',
    grund:'der Grund', mensch:'der Mensch', kind:'das Kind', welt:'die Welt', mut:'der Mut', kraft:'die Kraft',
    ruh:'die Ruhe', müh:'die Mühe', sorg:'die Sorge', zahl:'die Zahl', arbeit:'die Arbeit', antwort:'die Antwort',
    heirat:'die Heirat', dank:'der Dank', teil:'der Teil', ruf:'der Ruf', schuld:'die Schuld', pflicht:'die Pflicht',
    schutz:'der Schutz', nutz:'der Nutzen', schad:'der Schaden', last:'die Last', spiel:'das Spiel', folg:'die Folge',
    stimm:'die Stimme', richt:'richten', lehr:'die Lehre', hoff:'hoffen', lieb:'die Liebe', ehr:'die Ehre'
  };

  const PRE = ['zusammen','zurück','heraus','herein','hinaus','hinein','herum','herab','hinab','vorbei','voraus','wieder','wider',
    'durch','unter','über','fort','fest','teil','nach','miss','auf','aus','bei','ein','emp','ent','her','hin','mit','vor','weg','zer','ver',
    'ab','an','be','er','um','zu'].sort((a, b) => b.length - a.length);
  const INSEP = ['miss','emp','ent','zer','ver','be','er','über','unter','hinter','wider'];
  const ADJ_SUF = ['fähig','würdig','mäßig','voll','los','reich','frei','wert','haft','lich','isch','bar','sam','ig','ell','al','iv','ant','ent'];
  const NOUN_SUF = ['schaft','heit','keit','ung'];
  const FUG_NOUN_END = /(ung|heit|keit|schaft|ion|tät|ität|ling|sicht)$/;
  const FUG_NOUNS = new Set(['arbeit','zukunft','anspruch','leistung','liebe','geburt','hilfe','geschäft','verkehr','wirtschaft']);

  // short English glosses for the pieces, shown under the blocks
  const GLOSS = {
    prefix:{un:'not', in:'not', il:'not', ir:'not', im:'not', hoch:'highly', inter:'between', zer:'apart, to pieces', ver:'change, away, wrongly',
      be:'acts on something', ent:'away, un-', emp:'away, un-', er:'result, reaching', miss:'wrongly', ab:'off, away', an:'on, at', auf:'up, open',
      aus:'out', bei:'with, by', durch:'through', ein:'in, into', fort:'onward, away', her:'towards here', hin:'towards there', mit:'with',
      nach:'after', um:'around', vor:'before, ahead', weg:'away', zu:'to, towards', 'zurück':'back', zusammen:'together', heraus:'out of',
      herein:'into', hinaus:'out', hinein:'into', herum:'around', 'über':'over', unter:'under', wider:'against', wieder:'again', fest:'firm', teil:'part'},
    suffix:{lich:'-ly, -able', bar:'can be done', ig:'having', isch:'relating to', sam:'tending to', los:'without', voll:'full of',
      reich:'rich in', frei:'free of', 'fähig':'able to', 'mäßig':'according to', haft:'like, having', wert:'worth', 'würdig':'worthy of',
      ell:'relating to', al:'relating to', iv:'having the quality', ant:'adjective of -anz', ent:'adjective of -enz',
      ung:'noun: action or result', heit:'noun: state', keit:'noun: state', schaft:'noun: group or state',
      d:'Partizip I', end:'Partizip I'},
    ge:{ge:'Partizip II'}, linking:{s:'linking -s', es:'linking -es', n:'linking -n', en:'linking -en', e:'linking -e', er:'linking -er'}
  };
  function glossOf(piece){
    if (piece.gloss) return piece.gloss;
    if (piece.k === 'root') return piece.lemma || '';
    return (GLOSS[piece.k] || {})[lc(piece.t)] || '';
  }

  // the word a stem belongs to, or null when it cannot be confirmed
  function lemmaOf(stem){
    const s = lc(stem);
    if (s.length < 2) return null;
    const cands = [s];
    const d = deUmlaut(s); if (d) cands.push(d);
    for (const c of cands) {
      if (STEMS[c]) return STEMS[c];
      if (ROOTS[c]) return ROOTS[c];
      if (VERBS.has(c + 'en')) return c + 'en';
      if (/(el|er)$/.test(c) && VERBS.has(c + 'n')) return c + 'n';                       // wechsel → wechseln, forder → fordern
      if (/[^aeiouäöü][lr]$/.test(c)) { const e = c.slice(0, -1) + 'e' + c.slice(-1) + 'n'; if (VERBS.has(e)) return e; }   // wechsl → wechseln
      if (c.length >= 2 && VERBS.has(c + 'n')) return c + 'n';
    }
    return null;
  }
  const confirmed = pieces => pieces.some(p => p.k === 'root' && p.lemma);

  // prefixes in front of a stem: only when the rest is confirmed (zu·ver·läss, ab·wechsl, an·spruch)
  function prefixSplit(stem, depth){
    const s = lc(stem), d = depth || 0;
    const whole = lemmaOf(s);
    if (whole) return [{t:stem, k:'root', lemma:whole}];
    if (d < 3) for (const p of PRE) {
      if (!s.startsWith(p)) continue;
      const rest = stem.slice(p.length);
      if (rest.length < 3 || !VOWEL.test(lc(rest))) continue;
      const sub = prefixSplit(rest, d + 1);
      if (confirmed(sub)) return [{t:stem.slice(0, p.length), k:'prefix'}, ...sub];
    }
    return [{t:stem, k:'root'}];
  }
  // an infinitive: stem + (e)n. The ending is always split; prefixes only when confirmed.
  function infinitivePieces(inf){
    const m = /^(.+?)(en|n)$/.exec(inf);
    if (!m || m[1].length < 2) return prefixSplit(inf);
    const stem = /(el|er)n$/.test(lc(inf)) ? inf.slice(0, -1) : (lc(inf).endsWith('en') ? inf.slice(0, -2) : inf.slice(0, -1));
    return [...prefixSplit(stem), {t:inf.slice(stem.length), k:'suffix', gloss:'infinitive ending'}];
  }
  // the stem in front of an adjective ending: inner noun endings (verantwort·ung, gesund·heit, wirt·schaft) and prefixes
  function stemPieces(stem, opts){
    const s = lc(stem);
    if (opts && opts.infinitive && /(en|eln|ern)$/.test(s)) return infinitivePieces(stem);
    for (const ns of NOUN_SUF) {
      if (!s.endsWith(ns) || s.length - ns.length < 3) continue;
      const rest = stem.slice(0, -ns.length);
      let sub = prefixSplit(rest);
      if (!confirmed(sub) && (ns === 'heit' || ns === 'keit')) { const a = splitAdjective(rest); if (a) { const st = prefixSplit(a.stem); if (confirmed(st)) sub = [...st, ...(a.fug ? [{t:a.fug, k:'linking'}] : []), {t:a.suf, k:'suffix'}]; } }
      if (confirmed(sub)) return [...sub, {t:stem.slice(-ns.length), k:'suffix'}];
    }
    return prefixSplit(stem);
  }
  // stem + (linking s) + adjective ending, with the same rules as the app's own detector
  function splitAdjective(word){
    const w = lc(word);
    for (const s of ADJ_SUF) {
      if (!w.endsWith(s) || w.length - s.length < 2) continue;
      if (['ell','al','iv','ant','ent','ig','isch'].includes(s) && w.length < 6) continue;
      let stem = word.slice(0, -s.length), fug = '';
      if (['fähig','voll','los','reich','frei','wert','würdig','mäßig'].includes(s) && lc(stem).endsWith('s') && stem.length > 3) {
        const noS = lc(stem.slice(0, -1));
        if (FUG_NOUN_END.test(noS) || FUG_NOUNS.has(noS) || ((s === 'wert' || s === 'würdig') && /en$/.test(noS))) { fug = stem.slice(-1); stem = stem.slice(0, -1); }
      }
      return {stem, fug, suf:word.slice(-s.length)};
    }
    return null;
  }
  // a whole adjective that sits inside a longer word (after un-, or as the last part of a compound)
  function adjectivePieces(adj){
    const w = lc(adj);
    // Partizip II: -iert, (prefix)ge…t, inseparable prefix … t / et / en. Only when the stem is confirmed (except -iert).
    if (/iert$/.test(w) && w.length > 6) return [{t:adj.slice(0, -1), k:'root'}, {t:adj.slice(-1), k:'suffix', gloss:'Partizip II'}];
    let m = /^([a-zäöüß]*?)ge([a-zäöüß]{2,}?)(et|en|t)$/.exec(w);
    if (m && (!m[1] || PRE.includes(m[1])) && lemmaOf(m[2])) {
      const out = [];
      if (m[1]) out.push({t:adj.slice(0, m[1].length), k:'prefix'});
      out.push({t:adj.slice(m[1].length, m[1].length + 2), k:'ge'});
      out.push({t:adj.slice(m[1].length + 2, w.length - m[3].length), k:'root', lemma:lemmaOf(m[2])});
      out.push({t:adj.slice(-m[3].length), k:'suffix', gloss:'Partizip II'});
      return out;
    }
    m = /^(.{4,}?)(et|en|t)$/.exec(w);
    if (m && INSEP.some(p => w.startsWith(p))) {
      for (const end of ['et', 'en', 't']) {
        if (!w.endsWith(end)) continue;
        const stem = adj.slice(0, -end.length);
        const sub = prefixSplit(stem);
        if (sub.length > 1 && confirmed(sub)) return [...sub, {t:adj.slice(-end.length), k:'suffix', gloss:'Partizip II'}];
      }
    }
    const a = splitAdjective(adj);
    if (a) return [...stemPieces(a.stem, {infinitive: !!a.fug && /^(wert|würdig)$/.test(lc(a.suf))}), ...(a.fug ? [{t:a.fug, k:'linking'}] : []), {t:a.suf, k:'suffix'}];
    return [{t:adj, k:'root', ...(lemmaOf(adj) ? {lemma:lemmaOf(adj)} : {})}];
  }

  // the first split of a word, as [text, role] pairs (same rules as the app's engine)
  function immediate(kind, parts){
    const n = parts.length;
    if (kind === 'suffix') {
      if (n === 1) return [[parts[0], 'base']];
      if (n === 2) return [[parts[0], 'base'], [parts[1], 'suf']];
      return parts.map((p, i) => [p, i === n - 1 ? 'suf' : (i === n - 2 && /^(s|es|n|en|e|er)$/.test(p) ? 'fug' : 'base')]);
    }
    if (kind === 'prefix') return parts.map((p, i) => [p, i === 0 ? 'pre' : 'base']);
    if (kind === 'p1') return parts.map((p, i) => [p, i === n - 1 && n > 1 ? 'suf' : 'base']);
    if (kind === 'p2') {
      const gi = parts.indexOf('ge');
      return parts.map((p, i) => {
        if (i === gi) return [p, 'ge'];
        if (i === n - 1 && n > 1) return [p, 'suf'];
        if (gi > 0 && i < gi) return [p, 'pre'];
        return [p, 'base'];
      });
    }
    if (kind === 'compound') return parts.map((p, i) => [p, i === n - 1 && n > 1 ? 'suf' : 'base']);
    return [[parts.join(''), 'base']];
  }
  const KIND_OF_ROLE = {pre:'prefix', base:'root', fug:'linking', suf:'suffix', ge:'ge'};

  // first split → every piece. segs = [[text, role]] from immediate(); kind = suffix | prefix | p1 | p2 | compound | simple
  function deepen(segs, kind, opts){
    const o = opts || {};
    const out = [];
    const n = segs.length;
    const hasFug = segs.some(s => s[1] === 'fug');
    segs.forEach(([t, role], i) => {
      if (kind === 'compound') {
        if (i === n - 1 && n > 1) { const sub = adjectivePieces(t); out.push(...(sub.length > 1 && (confirmed(sub) || splitAdjective(t)) ? sub : [{t, k:'root'}])); }
        else out.push({t, k:'root'});
        return;
      }
      if (role !== 'base') {
        const piece = {t, k:KIND_OF_ROLE[role] || 'root'};
        if (role === 'suf' && (kind === 'p1' || kind === 'p2')) piece.gloss = kind === 'p1' ? 'Partizip I' : 'Partizip II';
        out.push(piece); return;
      }
      if (kind === 'prefix') out.push(...adjectivePieces(t));
      else if (kind === 'p1') out.push(...infinitivePieces(t));
      else if (kind === 'suffix') out.push(...stemPieces(t, {infinitive: hasFug && /^(wert|würdig)$/.test(lc(o.affix || ''))}));
      else if (kind === 'p2') out.push(...prefixSplit(t));
      else out.push({t, k:'root'});
    });
    return out;
  }
  // pieces → [text, role] for colouring. Stacked prefixes and endings alternate between two shades.
  function roles(pieces){
    const nSuf = pieces.filter(p => p.k === 'suffix').length;
    let pi = 0, si = 0;
    return pieces.map(p => {
      if (p.k === 'prefix') return [p.t, pi++ % 2 ? 'pre2' : 'pre'];
      if (p.k === 'suffix') { const fromEnd = nSuf - 1 - si++; return [p.t, fromEnd % 2 ? 'suf2' : 'suf']; }
      if (p.k === 'linking') return [p.t, 'fug'];
      if (p.k === 'ge') return [p.t, 'ge'];
      return [p.t, 'base'];
    });
  }
  // a piece that should be a root but still contains a confirmed prefix or ending → its finer pieces (or null)
  function finer(text){
    const sub = adjectivePieces(text);
    if (sub.length > 1 && confirmed(sub)) return sub;
    const st = stemPieces(text);
    return st.length > 1 && confirmed(st) ? st : null;
  }
  // does a "root" look as if it still holds a prefix or an ending? (used to ask the AI once more; never to cut by itself)
  function looksUnsplit(text){
    const s = lc(text);
    if (lemmaOf(s)) return '';
    for (const p of ['zer','ver','ent','emp','miss','be','er','un']) if (s.startsWith(p) && !s.startsWith('unter') && s.length - p.length >= 3 && VOWEL.test(s.slice(p.length))) return `starts with the prefix ${p}-`;
    for (const x of [...ADJ_SUF, ...NOUN_SUF]) if (s.endsWith(x) && s.length - x.length >= 3 && VOWEL.test(s.slice(0, -x.length))) return `ends with the suffix -${x}`;
    return '';
  }

  scope.MORPH = {VERBS, STEMS, ROOTS, PRE, lemmaOf, prefixSplit, stemPieces, splitAdjective, adjectivePieces, immediate, deepen, roles, finer, looksUnsplit, glossOf, confirmed};
})(typeof globalThis !== 'undefined' ? globalThis : this);
