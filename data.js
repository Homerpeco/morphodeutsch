/* MorphoDeutsch — built-in data.
   AFFIXES: the word-building library (patterns + transfer words).
   SEED:    starter deck (Aspekte Beruf B2, Beruf & Arbeit).
   PPAIRS:  Partizip I vs Partizip II contrast sentences.
   PROMPTS: ideas for the "Write your own" step.
   Every `parts` array must join to exactly the word (checked at load time). */

const AFFIXES = [
  // ---------- suffixes that attach to nouns ----------
  { id:'fähig', form:'-fähig', kind:'suffix', group:'noun', meaning:'able to, fit for, capable of',
    note:'After nouns ending in -ung, -heit, -keit or -schaft, and after Arbeit, Zukunft, Leistung, a linking -s appears. Verb stems attach directly (lernfähig).',
    ex:[
      {w:'leistungsfähig', parts:['leistung','s','fähig'], base:'die Leistung', en:'efficient, high-performing'},
      {w:'kritikfähig', parts:['kritik','fähig'], base:'die Kritik', en:'able to take criticism'},
      {w:'teamfähig', parts:['team','fähig'], base:'das Team', en:'able to work in a team'},
      {w:'arbeitsfähig', parts:['arbeit','s','fähig'], base:'die Arbeit', en:'fit for work'},
      {w:'lernfähig', parts:['lern','fähig'], base:'lernen', en:'able to learn'},
      {w:'konkurrenzfähig', parts:['konkurrenz','fähig'], base:'die Konkurrenz', en:'competitive'},
      {w:'zahlungsfähig', parts:['zahlung','s','fähig'], base:'die Zahlung', en:'solvent, able to pay'},
      {w:'kompromissfähig', parts:['kompromiss','fähig'], base:'der Kompromiss', en:'willing to compromise'},
      {w:'zukunftsfähig', parts:['zukunft','s','fähig'], base:'die Zukunft', en:'viable for the future'}
    ]},
  { id:'voll', form:'-voll', kind:'suffix', group:'noun', meaning:'full of, with a lot of',
    note:'Linking -s after -ung and -sicht (verantwortungsvoll, rücksichtsvoll) and after Anspruch. The opposite is often -los.',
    ex:[
      {w:'wertvoll', parts:['wert','voll'], base:'der Wert', en:'valuable'},
      {w:'sinnvoll', parts:['sinn','voll'], base:'der Sinn', en:'meaningful, sensible'},
      {w:'verantwortungsvoll', parts:['verantwortung','s','voll'], base:'die Verantwortung', en:'responsible (a task, a person)'},
      {w:'respektvoll', parts:['respekt','voll'], base:'der Respekt', en:'respectful'},
      {w:'rücksichtsvoll', parts:['rücksicht','s','voll'], base:'die Rücksicht', en:'considerate'},
      {w:'humorvoll', parts:['humor','voll'], base:'der Humor', en:'humorous'},
      {w:'hoffnungsvoll', parts:['hoffnung','s','voll'], base:'die Hoffnung', en:'hopeful'},
      {w:'anspruchsvoll', parts:['anspruch','s','voll'], base:'der Anspruch', en:'demanding'}
    ]},
  { id:'los', form:'-los', kind:'suffix', group:'noun', meaning:'without (English -less)',
    note:'Same linking -s rules as -voll: arbeitslos, hoffnungslos, anspruchslos.',
    ex:[
      {w:'arbeitslos', parts:['arbeit','s','los'], base:'die Arbeit', en:'unemployed'},
      {w:'erfolglos', parts:['erfolg','los'], base:'der Erfolg', en:'unsuccessful'},
      {w:'kostenlos', parts:['kosten','los'], base:'die Kosten', en:'free of charge'},
      {w:'sinnlos', parts:['sinn','los'], base:'der Sinn', en:'pointless'},
      {w:'hoffnungslos', parts:['hoffnung','s','los'], base:'die Hoffnung', en:'hopeless'},
      {w:'wertlos', parts:['wert','los'], base:'der Wert', en:'worthless'},
      {w:'rücksichtslos', parts:['rücksicht','s','los'], base:'die Rücksicht', en:'inconsiderate, reckless'},
      {w:'anspruchslos', parts:['anspruch','s','los'], base:'der Anspruch', en:'undemanding, modest'}
    ]},
  { id:'reich', form:'-reich', kind:'suffix', group:'noun', meaning:'rich in, with plenty of',
    note:'A final -e of the noun is dropped (die Hilfe → hilfreich).',
    ex:[
      {w:'erfolgreich', parts:['erfolg','reich'], base:'der Erfolg', en:'successful'},
      {w:'abwechslungsreich', parts:['abwechslung','s','reich'], base:'die Abwechslung', en:'varied'},
      {w:'hilfreich', parts:['hilf','reich'], base:'die Hilfe', en:'helpful'},
      {w:'lehrreich', parts:['lehr','reich'], base:'die Lehre', en:'instructive'},
      {w:'einflussreich', parts:['einfluss','reich'], base:'der Einfluss', en:'influential'},
      {w:'umfangreich', parts:['umfang','reich'], base:'der Umfang', en:'extensive'},
      {w:'zahlreich', parts:['zahl','reich'], base:'die Zahl', en:'numerous'}
    ]},
  { id:'frei', form:'-frei', kind:'suffix', group:'noun', meaning:'free of, without (something unwanted)',
    note:'Positive "without": fehlerfrei is praise, fehlerlos sounds literary.',
    ex:[
      {w:'fehlerfrei', parts:['fehler','frei'], base:'der Fehler', en:'error-free'},
      {w:'stressfrei', parts:['stress','frei'], base:'der Stress', en:'stress-free'},
      {w:'barrierefrei', parts:['barriere','frei'], base:'die Barriere', en:'accessible, step-free'},
      {w:'kostenfrei', parts:['kosten','frei'], base:'die Kosten', en:'free of charge'},
      {w:'arbeitsfrei', parts:['arbeit','s','frei'], base:'die Arbeit', en:'work-free (a day off)'},
      {w:'rauchfrei', parts:['rauch','frei'], base:'der Rauch', en:'smoke-free'}
    ]},
  { id:'lich', form:'-lich', kind:'suffix', group:'noun', meaning:'relating to, in the manner of',
    note:'Very often with an umlaut: a → ä, o → ö, u → ü (die Gefahr → gefährlich, der Mund → mündlich).',
    ex:[
      {w:'beruflich', parts:['beruf','lich'], base:'der Beruf', en:'professional, work-related'},
      {w:'täglich', parts:['täg','lich'], base:'der Tag', en:'daily', change:'a → ä'},
      {w:'jährlich', parts:['jähr','lich'], base:'das Jahr', en:'annual', change:'a → ä'},
      {w:'ärztlich', parts:['ärzt','lich'], base:'der Arzt', en:'medical (from a doctor)', change:'a → ä'},
      {w:'mündlich', parts:['münd','lich'], base:'der Mund', en:'oral, spoken', change:'u → ü'},
      {w:'schriftlich', parts:['schrift','lich'], base:'die Schrift', en:'written, in writing'},
      {w:'persönlich', parts:['persön','lich'], base:'die Person', en:'personal, in person', change:'o → ö'},
      {w:'wirtschaftlich', parts:['wirtschaft','lich'], base:'die Wirtschaft', en:'economic'},
      {w:'freundlich', parts:['freund','lich'], base:'der Freund', en:'friendly'},
      {w:'gefährlich', parts:['gefähr','lich'], base:'die Gefahr', en:'dangerous', change:'a → ä'}
    ]},
  { id:'ig', form:'-ig', kind:'suffix', group:'noun', meaning:'having, full of',
    note:'A final -e of the noun is dropped (die Ruhe → ruhig). Sometimes with an umlaut (die Zukunft → zukünftig).',
    ex:[
      {w:'ruhig', parts:['ruh','ig'], base:'die Ruhe', en:'quiet, calm'},
      {w:'vorsichtig', parts:['vorsicht','ig'], base:'die Vorsicht', en:'careful'},
      {w:'geduldig', parts:['geduld','ig'], base:'die Geduld', en:'patient'},
      {w:'zukünftig', parts:['zukünft','ig'], base:'die Zukunft', en:'future', change:'u → ü'},
      {w:'fleißig', parts:['fleiß','ig'], base:'der Fleiß', en:'hard-working'},
      {w:'eilig', parts:['eil','ig'], base:'die Eile', en:'urgent, in a hurry'},
      {w:'mutig', parts:['mut','ig'], base:'der Mut', en:'brave'},
      {w:'langweilig', parts:['langweil','ig'], base:'die Langeweile', en:'boring'}
    ]},
  { id:'haft', form:'-haft', kind:'suffix', group:'noun', meaning:'having the character of, like',
    note:'Mostly from nouns: fehlerhaft, vorteilhaft, dauerhaft.',
    ex:[
      {w:'fehlerhaft', parts:['fehler','haft'], base:'der Fehler', en:'faulty'},
      {w:'vorteilhaft', parts:['vorteil','haft'], base:'der Vorteil', en:'advantageous'},
      {w:'zweifelhaft', parts:['zweifel','haft'], base:'der Zweifel', en:'doubtful'},
      {w:'dauerhaft', parts:['dauer','haft'], base:'die Dauer', en:'lasting, permanent'},
      {w:'ernsthaft', parts:['ernst','haft'], base:'der Ernst', en:'serious'},
      {w:'beispielhaft', parts:['beispiel','haft'], base:'das Beispiel', en:'exemplary'},
      {w:'meisterhaft', parts:['meister','haft'], base:'der Meister', en:'masterly'}
    ]},
  { id:'mäßig', form:'-mäßig', kind:'suffix', group:'noun', meaning:'according to, in line with',
    note:'regelmäßig = according to the rule, so "regular".',
    ex:[
      {w:'regelmäßig', parts:['regel','mäßig'], base:'die Regel', en:'regular'},
      {w:'planmäßig', parts:['plan','mäßig'], base:'der Plan', en:'as scheduled'},
      {w:'zweckmäßig', parts:['zweck','mäßig'], base:'der Zweck', en:'appropriate, practical'},
      {w:'verhältnismäßig', parts:['verhältnis','mäßig'], base:'das Verhältnis', en:'proportionate; relatively'}
    ]},
  // ---------- suffixes that attach to verbs ----------
  { id:'bar', form:'-bar', kind:'suffix', group:'verb', meaning:'can be done (English -able)',
    note:'Verb stem + -bar: machen → machbar. un- in front gives the negative: unvergleichbar.',
    ex:[
      {w:'machbar', parts:['mach','bar'], base:'machen', en:'feasible, doable'},
      {w:'erreichbar', parts:['erreich','bar'], base:'erreichen', en:'reachable, available'},
      {w:'vergleichbar', parts:['vergleich','bar'], base:'vergleichen', en:'comparable'},
      {w:'belastbar', parts:['belast','bar'], base:'belasten', en:'resilient, able to handle pressure'},
      {w:'erkennbar', parts:['erkenn','bar'], base:'erkennen', en:'recognisable'},
      {w:'lieferbar', parts:['liefer','bar'], base:'liefern', en:'available for delivery'},
      {w:'verfügbar', parts:['verfüg','bar'], base:'verfügen', en:'available'}
    ]},
  { id:'sam', form:'-sam', kind:'suffix', group:'verb', meaning:'tending to, having the quality of',
    note:'Mostly verb stem + -sam: sparen → sparsam.',
    ex:[
      {w:'sparsam', parts:['spar','sam'], base:'sparen', en:'thrifty, economical'},
      {w:'wirksam', parts:['wirk','sam'], base:'wirken', en:'effective'},
      {w:'aufmerksam', parts:['aufmerk','sam'], base:'aufmerken', en:'attentive'},
      {w:'erholsam', parts:['erhol','sam'], base:'sich erholen', en:'restful'},
      {w:'biegsam', parts:['bieg','sam'], base:'biegen', en:'flexible, bendable'}
    ]},
  { id:'wert', form:'-wert', kind:'suffix', group:'verb', meaning:'worth doing',
    note:'Infinitive + linking -s + -wert: lesen → lesenswert.',
    ex:[
      {w:'empfehlenswert', parts:['empfehlen','s','wert'], base:'empfehlen', en:'worth recommending'},
      {w:'lesenswert', parts:['lesen','s','wert'], base:'lesen', en:'worth reading'},
      {w:'sehenswert', parts:['sehen','s','wert'], base:'sehen', en:'worth seeing'},
      {w:'lobenswert', parts:['loben','s','wert'], base:'loben', en:'praiseworthy'},
      {w:'wünschenswert', parts:['wünschen','s','wert'], base:'wünschen', en:'desirable'}
    ]},
  // ---------- suffixes of foreign-origin words ----------
  { id:'isch', form:'-isch', kind:'suffix', group:'foreign', meaning:'relating to, typical of',
    note:'Very common with foreign-origin nouns: die Technik → technisch, die Praxis → praktisch.',
    ex:[
      {w:'praktisch', parts:['prakt','isch'], base:'die Praxis', en:'practical'},
      {w:'technisch', parts:['techn','isch'], base:'die Technik', en:'technical'},
      {w:'typisch', parts:['typ','isch'], base:'der Typ', en:'typical'},
      {w:'kritisch', parts:['krit','isch'], base:'die Kritik', en:'critical'},
      {w:'politisch', parts:['polit','isch'], base:'die Politik', en:'political'},
      {w:'telefonisch', parts:['telefon','isch'], base:'das Telefon', en:'by phone'},
      {w:'logisch', parts:['log','isch'], base:'die Logik', en:'logical'},
      {w:'chaotisch', parts:['chaot','isch'], base:'das Chaos', en:'chaotic'}
    ]},
  { id:'ell', form:'-ell', kind:'suffix', group:'foreign', meaning:'relating to',
    note:'die Kultur → kulturell, die Tradition → traditionell.',
    ex:[
      {w:'kulturell', parts:['kultur','ell'], base:'die Kultur', en:'cultural'},
      {w:'finanziell', parts:['finanzi','ell'], base:'die Finanzen', en:'financial'},
      {w:'professionell', parts:['profession','ell'], base:'die Profession', en:'professional'},
      {w:'traditionell', parts:['tradition','ell'], base:'die Tradition', en:'traditional'},
      {w:'industriell', parts:['industri','ell'], base:'die Industrie', en:'industrial'},
      {w:'strukturell', parts:['struktur','ell'], base:'die Struktur', en:'structural'}
    ]},
  { id:'al', form:'-al', kind:'suffix', group:'foreign', meaning:'relating to',
    note:'die Nation → national, die Region → regional.',
    ex:[
      {w:'national', parts:['nation','al'], base:'die Nation', en:'national'},
      {w:'regional', parts:['region','al'], base:'die Region', en:'regional'},
      {w:'zentral', parts:['zentr','al'], base:'das Zentrum', en:'central'},
      {w:'formal', parts:['form','al'], base:'die Form', en:'formal'}
    ]},
  { id:'iv', form:'-iv', kind:'suffix', group:'foreign', meaning:'having the quality of (nouns in -ion ↔ adjectives in -iv)',
    note:'Swap -ion for -iv: die Innovation → innovativ, die Produktion → produktiv.',
    ex:[
      {w:'innovativ', parts:['innovat','iv'], base:'die Innovation', en:'innovative'},
      {w:'informativ', parts:['informat','iv'], base:'die Information', en:'informative'},
      {w:'produktiv', parts:['produkt','iv'], base:'die Produktion', en:'productive'},
      {w:'kommunikativ', parts:['kommunikat','iv'], base:'die Kommunikation', en:'communicative'},
      {w:'attraktiv', parts:['attrakt','iv'], base:'die Attraktion', en:'attractive'},
      {w:'aktiv', parts:['akt','iv'], base:'die Aktion', en:'active'},
      {w:'kreativ', parts:['kreat','iv'], base:'die Kreation', en:'creative'}
    ]},
  { id:'ant', form:'-ant', kind:'suffix', group:'foreign', meaning:'adjective partner of nouns in -anz',
    note:'Swap -anz for -ant: die Toleranz → tolerant, die Relevanz → relevant.',
    ex:[
      {w:'tolerant', parts:['toler','ant'], base:'die Toleranz', en:'tolerant'},
      {w:'relevant', parts:['relev','ant'], base:'die Relevanz', en:'relevant'},
      {w:'arrogant', parts:['arrog','ant'], base:'die Arroganz', en:'arrogant'},
      {w:'elegant', parts:['eleg','ant'], base:'die Eleganz', en:'elegant'},
      {w:'dominant', parts:['domin','ant'], base:'die Dominanz', en:'dominant'},
      {w:'interessant', parts:['interess','ant'], base:'das Interesse', en:'interesting'}
    ]},
  { id:'ent', form:'-ent', kind:'suffix', group:'foreign', meaning:'adjective partner of nouns in -enz',
    note:'Swap -enz for -ent: die Kompetenz → kompetent, die Effizienz → effizient.',
    ex:[
      {w:'kompetent', parts:['kompet','ent'], base:'die Kompetenz', en:'competent'},
      {w:'effizient', parts:['effizi','ent'], base:'die Effizienz', en:'efficient'},
      {w:'intelligent', parts:['intellig','ent'], base:'die Intelligenz', en:'intelligent'},
      {w:'konsequent', parts:['konsequ','ent'], base:'die Konsequenz', en:'consistent, rigorous'},
      {w:'transparent', parts:['transpar','ent'], base:'die Transparenz', en:'transparent'}
    ]},
  // ---------- participles ----------
  { id:'p1', form:'Partizip I', kind:'p1', group:'participle', meaning:'infinitive + d: something that causes an effect or is happening (English -ing)',
    note:'Always infinitive + d, also for verbs in -ern and -eln: herausfordern → herausfordernd, abwechseln → abwechselnd.',
    ex:[
      {w:'überzeugend', parts:['überzeugen','d'], base:'überzeugen', en:'convincing'},
      {w:'spannend', parts:['spannen','d'], base:'spannen', en:'exciting, gripping'},
      {w:'entscheidend', parts:['entscheiden','d'], base:'entscheiden', en:'decisive, crucial'},
      {w:'passend', parts:['passen','d'], base:'passen', en:'suitable'},
      {w:'motivierend', parts:['motivieren','d'], base:'motivieren', en:'motivating'},
      {w:'belastend', parts:['belasten','d'], base:'belasten', en:'stressful, burdensome'},
      {w:'abwechselnd', parts:['abwechseln','d'], base:'abwechseln', en:'alternating, in turns'},
      {w:'aufregend', parts:['aufregen','d'], base:'aufregen', en:'exciting'},
      {w:'anstrengend', parts:['anstrengen','d'], base:'anstrengen', en:'exhausting'},
      {w:'herausfordernd', parts:['herausfordern','d'], base:'herausfordern', en:'challenging'}
    ]},
  { id:'p2', form:'Partizip II', kind:'p2', group:'participle', meaning:'the state someone or something is in, often as a result (English -ed)',
    note:'ge-…-t for regular verbs. No ge- after be-, ver-, er-, über- and for verbs in -ieren. Separable verbs put ge- after the prefix: auf-ge-regt.',
    ex:[
      {w:'aufgeregt', parts:['auf','ge','reg','t'], base:'aufregen', en:'excited, nervous'},
      {w:'gelangweilt', parts:['ge','langweil','t'], base:'langweilen', en:'bored'},
      {w:'motiviert', parts:['motivier','t'], base:'motivieren', en:'motivated'},
      {w:'qualifiziert', parts:['qualifizier','t'], base:'qualifizieren', en:'qualified'},
      {w:'begeistert', parts:['begeister','t'], base:'begeistern', en:'enthusiastic'},
      {w:'überzeugt', parts:['überzeug','t'], base:'überzeugen', en:'convinced'},
      {w:'gestresst', parts:['ge','stress','t'], base:'stressen', en:'stressed'},
      {w:'verheiratet', parts:['verheirat','et'], base:'verheiraten', en:'married'},
      {w:'kompliziert', parts:['komplizier','t'], base:'komplizieren', en:'complicated'}
    ]},
  // ---------- prefixes ----------
  { id:'un', form:'un-', kind:'prefix', group:'prefix', meaning:'not, the opposite of',
    note:'The most common way to negate a German adjective: sicher → unsicher.',
    ex:[
      {w:'unsicher', parts:['un','sicher'], base:'sicher', en:'unsure, unsafe'},
      {w:'unabhängig', parts:['un','abhängig'], base:'abhängig', en:'independent'},
      {w:'unzufrieden', parts:['un','zufrieden'], base:'zufrieden', en:'dissatisfied'},
      {w:'unbekannt', parts:['un','bekannt'], base:'bekannt', en:'unknown'},
      {w:'unwichtig', parts:['un','wichtig'], base:'wichtig', en:'unimportant'},
      {w:'unpünktlich', parts:['un','pünktlich'], base:'pünktlich', en:'unpunctual'},
      {w:'unkompliziert', parts:['un','kompliziert'], base:'kompliziert', en:'uncomplicated, easy-going'},
      {w:'ungewöhnlich', parts:['un','gewöhnlich'], base:'gewöhnlich', en:'unusual'}
    ]},
  { id:'in', form:'in- / il- / ir-', kind:'prefix', group:'prefix', meaning:'not (with foreign-origin adjectives)',
    note:'in- becomes il- before l and ir- before r: illegal, irrelevant.',
    ex:[
      {w:'inkompetent', parts:['in','kompetent'], base:'kompetent', en:'incompetent'},
      {w:'intolerant', parts:['in','tolerant'], base:'tolerant', en:'intolerant'},
      {w:'inaktiv', parts:['in','aktiv'], base:'aktiv', en:'inactive'},
      {w:'illegal', parts:['il','legal'], base:'legal', en:'illegal'},
      {w:'irrelevant', parts:['ir','relevant'], base:'relevant', en:'irrelevant'},
      {w:'instabil', parts:['in','stabil'], base:'stabil', en:'unstable'}
    ]},
  { id:'hoch', form:'hoch-', kind:'prefix', group:'prefix', meaning:'highly, very',
    note:'Common in job ads: hochqualifiziert, hochmotiviert.',
    ex:[
      {w:'hochmodern', parts:['hoch','modern'], base:'modern', en:'ultra-modern'},
      {w:'hochqualifiziert', parts:['hoch','qualifiziert'], base:'qualifiziert', en:'highly qualified'},
      {w:'hochmotiviert', parts:['hoch','motiviert'], base:'motiviert', en:'highly motivated'},
      {w:'hochaktuell', parts:['hoch','aktuell'], base:'aktuell', en:'highly topical'}
    ]},
  { id:'inter', form:'inter-', kind:'prefix', group:'prefix', meaning:'between, across',
    note:'Latin prefix, mostly on foreign-origin adjectives.',
    ex:[
      {w:'interkulturell', parts:['inter','kulturell'], base:'kulturell', en:'intercultural'},
      {w:'interdisziplinär', parts:['inter','disziplinär'], base:'disziplinär', en:'interdisciplinary'},
      {w:'interaktiv', parts:['inter','aktiv'], base:'aktiv', en:'interactive'},
      {w:'international', parts:['inter','national'], base:'national', en:'international'}
    ]}
];

const AFFIX_GROUPS = [
  {id:'noun', title:'Suffixes on nouns', blurb:'Take a noun, add the ending, get an adjective. Watch for the linking -s and umlauts.'},
  {id:'verb', title:'Suffixes on verbs', blurb:'Take a verb stem (or the whole infinitive for -wert).'},
  {id:'foreign', title:'Foreign-origin suffixes', blurb:'Latin and French endings. Many come in noun–adjective pairs: -ion/-iv, -anz/-ant, -enz/-ent.'},
  {id:'participle', title:'Participles as adjectives', blurb:'Partizip I says what something does to you; Partizip II says what state you are in.'},
  {id:'prefix', title:'Prefixes', blurb:'Put something in front to negate or intensify an adjective.'}
];

/* Starter deck — the Beruf & Arbeit adjectives from Aspekte Beruf B2.
   kind: suffix | prefix | p1 | p2 | compound | simple
   field groups near-meaning words so they are never used as each other's wrong answers. */
const SEED = [
  { w:'aufregend', en:'exciting', kind:'p1', affix:'p1', base:'aufregen', parts:['aufregen','d'], partner:'aufgeregt',
    family:['aufregen','sich aufregen','die Aufregung','aufgeregt'], syn:['spannend'], ant:['langweilig'], field:'feeling',
    nouns:['die Reise, -n','der Tag, -e','die Zeit, -en'],
    ex:['Die ersten Wochen im neuen Job waren aufregend.','Wir haben eine aufregende Zeit hinter uns.'],
    exEn:['The first weeks in the new job were exciting.','We have an exciting time behind us.'] },
  { w:'anstrengend', en:'exhausting, strenuous', kind:'p1', affix:'p1', base:'anstrengen', parts:['anstrengen','d'], partner:'angestrengt',
    family:['anstrengen','sich anstrengen','die Anstrengung','angestrengt'], syn:['ermüdend','mühsam'], ant:['erholsam','entspannend'], field:'difficulty',
    nouns:['die Arbeit, -en','der Tag, -e','die Schicht, -en'],
    ex:['Die Arbeit auf der Baustelle ist körperlich anstrengend.','Nach einer anstrengenden Schicht bin ich todmüde.'],
    exEn:['Work on the building site is physically exhausting.','After an exhausting shift I am dead tired.'] },
  { w:'langweilig', en:'boring', kind:'suffix', affix:'ig', base:'die Langeweile', parts:['langweil','ig'], partner:'gelangweilt',
    change:'Lang(e)weil(e): both e are dropped',
    family:['die Langeweile','sich langweilen','gelangweilt'], syn:['eintönig','öde'], ant:['spannend','interessant','aufregend'], field:'feeling',
    nouns:['der Vortrag, ¨-e','die Besprechung, -en','der Job, -s'],
    ex:['Die Besprechung war so langweilig, dass ich fast eingeschlafen bin.','Routinearbeit finde ich auf Dauer langweilig.'],
    exEn:['The meeting was so boring that I almost fell asleep.','In the long run I find routine work boring.'] },
  { w:'herausfordernd', en:'challenging', kind:'p1', affix:'p1', base:'herausfordern', parts:['herausfordern','d'], partner:'herausgefordert',
    family:['herausfordern','die Herausforderung','herausgefordert'], syn:['anspruchsvoll','schwierig'], ant:['leicht','einfach'], field:'difficulty',
    nouns:['die Aufgabe, -n','die Situation, -en','das Projekt, -e'],
    ex:['Die neue Stelle ist herausfordernd, aber sie macht mir Spaß.','Das war eine herausfordernde Situation für das ganze Team.'],
    exEn:['The new position is challenging, but I enjoy it.','That was a challenging situation for the whole team.'] },
  { w:'ungewöhnlich', en:'unusual', kind:'prefix', affix:'un', base:'gewöhnlich', parts:['un','gewöhnlich'],
    family:['gewöhnlich','sich gewöhnen (an)','die Gewohnheit'], syn:['untypisch','selten'], ant:['gewöhnlich','üblich','normal'], field:'novelty',
    nouns:['die Idee, -n','der Arbeitsplatz, ¨-e','der Lebenslauf, ¨-e'],
    ex:['Sie hat einen ungewöhnlichen Lebenslauf.','Es ist ungewöhnlich, dass der Chef selbst anruft.'],
    exEn:['She has an unusual CV.','It is unusual for the boss to call in person.'] },
  { w:'interessant', en:'interesting', kind:'suffix', affix:'ant', base:'das Interesse', parts:['interess','ant'], partner:'interessiert',
    family:['das Interesse','sich interessieren (für)','interessiert (an)'], syn:['spannend'], ant:['langweilig','uninteressant'], field:'feeling',
    nouns:['das Angebot, -e','die Stelle, -n','die Aufgabe, -n'],
    ex:['Das Stellenangebot klingt interessant.','Wir haben ein interessantes Angebot bekommen.'],
    exEn:['The job offer sounds interesting.','We have received an interesting offer.'] },
  { w:'sicher', en:'safe, secure; sure, certain', kind:'simple', affix:'', base:'', parts:['sicher'],
    family:['die Sicherheit','sichern','versichern','die Versicherung','unsicher'], syn:['gewiss'], ant:['unsicher','gefährlich'], field:'safety',
    nouns:['der Arbeitsplatz, ¨-e','das Einkommen, -','die Stelle, -n'],
    prep:[{p:'vor', c:'D', en:'safe from', ex:'Auf diesem Server sind die Daten sicher vor Hackern.'}],
    ex:['Ein sicherer Arbeitsplatz ist mir wichtiger als ein hohes Gehalt.','Bist du sicher, dass das Meeting heute ist?'],
    exEn:['A secure job matters more to me than a high salary.','Are you sure the meeting is today?'] },
  { w:'modern', en:'modern, up to date', kind:'simple', affix:'', base:'', parts:['modern'],
    family:['die Moderne','modernisieren','die Modernisierung'], syn:['zeitgemäß','aktuell'], ant:['altmodisch','veraltet'], field:'time',
    contrast:{w:'zukunftsfähig', note:'modern = up to date now; zukunftsfähig = able to work and last in the future'},
    nouns:['das Büro, -s','die Technik, -en','das Unternehmen, -'],
    ex:['Das Büro ist hell und modern eingerichtet.','Die Firma arbeitet mit moderner Technik.'],
    exEn:['The office is bright and modern.','The company works with modern technology.'] },
  { w:'mobil', en:'mobile; able to work from anywhere', kind:'simple', affix:'', base:'', parts:['mobil'],
    family:['die Mobilität','mobilisieren','das Mobiltelefon'], syn:['flexibel','beweglich'], ant:['ortsgebunden','unbeweglich'], field:'workstyle',
    nouns:['das Arbeiten','das Gerät, -e','der Pflegedienst, -e'],
    ex:['Zwei Tage pro Woche ist mobiles Arbeiten möglich.','Für diesen Job muss man mobil sein und viel reisen.'],
    exEn:['Remote working is possible two days a week.','For this job you have to be mobile and travel a lot.'] },
  { w:'gefährlich', en:'dangerous', kind:'suffix', affix:'lich', base:'die Gefahr', parts:['gefähr','lich'], change:'a → ä',
    family:['die Gefahr','gefährden','die Gefährdung','ungefährlich'], syn:['riskant'], ant:['ungefährlich','sicher','harmlos'], field:'safety',
    nouns:['die Situation, -en','der Beruf, -e','die Arbeit, -en'],
    prep:[{p:'für', c:'A', en:'dangerous for', ex:'Schichtarbeit kann gefährlich für die Gesundheit sein.'}],
    ex:['Die Arbeit mit Chemikalien ist gefährlich.','Feuerwehrmann ist ein gefährlicher Beruf.'],
    exEn:['Working with chemicals is dangerous.','Firefighter is a dangerous job.'] },
  { w:'kompliziert', en:'complicated', kind:'p2', affix:'p2', base:'komplizieren', parts:['komplizier','t'],
    family:['komplizieren','die Komplikation','unkompliziert'], syn:['schwierig','umständlich'], ant:['einfach','unkompliziert'], field:'difficulty',
    nouns:['das Verfahren, -','der Prozess, -e','die Situation, -en'],
    ex:['Das Antragsverfahren ist ziemlich kompliziert.','Sie hat mir einen komplizierten Prozess einfach erklärt.'],
    exEn:['The application procedure is quite complicated.','She explained a complicated process to me simply.'] },
  { w:'anspruchsvoll', en:'demanding; sophisticated', kind:'suffix', affix:'voll', base:'der Anspruch', parts:['anspruch','s','voll'],
    family:['der Anspruch','beanspruchen','anspruchslos'], syn:['herausfordernd','schwierig'], ant:['anspruchslos','einfach'], field:'difficulty',
    nouns:['die Tätigkeit, -en','das Projekt, -e','der Kunde, -n'],
    ex:['Die Tätigkeit ist anspruchsvoll, aber gut bezahlt.','Heute hatte ich einen sehr anspruchsvollen Kunden.'],
    exEn:['The work is demanding but well paid.','Today I had a very demanding customer.'] },
  { w:'zukunftsfähig', en:'viable for the future, future-proof', kind:'suffix', affix:'fähig', base:'die Zukunft', parts:['zukunft','s','fähig'],
    family:['die Zukunft','zukünftig'], syn:['nachhaltig'], ant:['veraltet'], field:'time',
    contrast:{w:'modern', note:'modern = up to date now; zukunftsfähig = able to work and last in the future'},
    nouns:['die Strategie, -n','der Beruf, -e','das Unternehmen, -'],
    ex:['Wir brauchen eine zukunftsfähige Strategie.','Die Pflege gilt als zukunftsfähiger Beruf.'],
    exEn:['We need a strategy that is fit for the future.','Nursing is considered a job with a future.'] },
  { w:'ausdauernd', en:'persevering, with stamina', kind:'p1', affix:'p1', base:'ausdauern', parts:['ausdauern','d'],
    change:'Formed from the verb ausdauern. die Ausdauer is a related noun, not the base.',
    family:['ausdauern','die Ausdauer'], syn:['beharrlich','hartnäckig'], ant:[], field:'character',
    nouns:['der Läufer, -','die Mitarbeiterin, -nen','das Training, -s'],
    ex:['Für diesen Beruf muss man ausdauernd und belastbar sein.','Sie ist eine sehr ausdauernde Mitarbeiterin.'],
    exEn:['For this job you have to be persevering and resilient.','She is a very persevering employee.'] },
  { w:'kreativ', en:'creative', kind:'suffix', affix:'iv', base:'die Kreation', parts:['kreat','iv'],
    family:['die Kreativität','kreieren','die Kreation'], syn:['einfallsreich','fantasievoll'], ant:['einfallslos','fantasielos'], field:'character',
    nouns:['die Lösung, -en','die Idee, -n','der Beruf, -e'],
    ex:['Wir suchen eine kreative Lösung für das Problem.','In der Werbebranche muss man kreativ sein.'],
    exEn:['We are looking for a creative solution to the problem.','In advertising you have to be creative.'] },
  { w:'selbstständig', en:'independent; self-employed', kind:'compound', affix:'', base:'selbst + ständig', parts:['selbst','ständig'],
    change:'Also spelled selbständig. sich selbstständig machen = to start your own business.',
    family:['die Selbstständigkeit','sich selbstständig machen'], syn:['eigenständig','unabhängig'], ant:['unselbstständig','abhängig'], field:'workstyle',
    nouns:['das Arbeiten','die Tätigkeit, -en','der Unternehmer, -'],
    ex:['Selbstständiges Arbeiten ist mir sehr wichtig.','Nach zehn Jahren hat er sich selbstständig gemacht.'],
    exEn:['Working independently is very important to me.','After ten years he started his own business.'] },
  { w:'international', en:'international', kind:'prefix', affix:'inter', base:'national', parts:['inter','national'],
    family:['die Nation','national','die Internationalität'], syn:['weltweit'], ant:['national','regional','lokal'], field:'scope',
    nouns:['das Team, -s','die Firma, Firmen','das Unternehmen, -'],
    ex:['Ich arbeite in einem internationalen Team.','Die Firma ist international tätig.'],
    exEn:['I work in an international team.','The company operates internationally.'] }
];

/* Partizip I (cause, -ing) vs Partizip II (state, -ed).
   a = Partizip I form, b = Partizip II form; ans = 'a' | 'b'.
   opts overrides the two options when the gap needs an ending. */
const PPAIRS = [
  {a:'aufregend', b:'aufgeregt', verb:'aufregen', items:[
    {s:'Der erste Arbeitstag war sehr ___.', ans:'a', en:'The first day at work was very exciting.'},
    {s:'Vor dem Vorstellungsgespräch war ich total ___.', ans:'b', en:'Before the job interview I was really nervous.'},
    {s:'Wir haben eine ___ Reise gemacht.', opts:['aufregende','aufgeregte'], ans:'a', en:'We went on an exciting trip.'},
    {s:'Die ___ Kinder konnten nicht einschlafen.', opts:['aufregenden','aufgeregten'], ans:'b', en:'The excited children could not fall asleep.'}]},
  {a:'anstrengend', b:'angestrengt', verb:'anstrengen', items:[
    {s:'Zwölf Stunden am Stück zu arbeiten ist ___.', ans:'a', en:'Working twelve hours straight is exhausting.'},
    {s:'Sie dachte lange und ___ über das Problem nach.', ans:'b', en:'She thought long and hard about the problem.'},
    {s:'Er hatte einen ___ Gesichtsausdruck.', opts:['anstrengenden','angestrengten'], ans:'b', en:'He had a strained look on his face.'}]},
  {a:'herausfordernd', b:'herausgefordert', verb:'herausfordern', items:[
    {s:'Die neue Aufgabe ist ziemlich ___.', ans:'a', en:'The new task is quite challenging.'},
    {s:'In meinem neuen Job fühle ich mich positiv ___.', ans:'b', en:'In my new job I feel challenged in a good way.'}]},
  {a:'langweilig', b:'gelangweilt', verb:'langweilen', items:[
    {s:'Der Vortrag war leider ___.', ans:'a', en:'Unfortunately the talk was boring.'},
    {s:'Die Zuhörer schauten ___ auf ihre Handys.', ans:'b', en:'The audience looked at their phones, bored.'}]},
  {a:'spannend', b:'gespannt', verb:'spannen', items:[
    {s:'Das neue Projekt ist wirklich ___.', ans:'a', en:'The new project is really exciting.'},
    {s:'Ich bin ___, wie die Kunden reagieren.', ans:'b', en:'I am curious to see how the customers react.'}]},
  {a:'überraschend', b:'überrascht', verb:'überraschen', items:[
    {s:'Die Kündigung kam für alle ___.', ans:'a', en:'The dismissal came as a surprise to everyone.'},
    {s:'Wir waren ___, wie schnell alles ging.', ans:'b', en:'We were surprised how fast everything went.'}]},
  {a:'enttäuschend', b:'enttäuscht', verb:'enttäuschen', items:[
    {s:'Die Verkaufszahlen waren ___.', ans:'a', en:'The sales figures were disappointing.'},
    {s:'Der Chef war ___ von den Ergebnissen.', ans:'b', en:'The boss was disappointed with the results.'}]},
  {a:'entspannend', b:'entspannt', verb:'entspannen', items:[
    {s:'Ein Spaziergang in der Mittagspause ist sehr ___.', ans:'a', en:'A walk during the lunch break is very relaxing.'},
    {s:'Nach dem Urlaub kam sie ganz ___ ins Büro zurück.', ans:'b', en:'After her holiday she came back to the office completely relaxed.'}]},
  {a:'überzeugend', b:'überzeugt', verb:'überzeugen', items:[
    {s:'Ihre Präsentation war sehr ___.', ans:'a', en:'Her presentation was very convincing.'},
    {s:'Ich bin ___, dass wir das Projekt rechtzeitig schaffen.', ans:'b', en:'I am convinced that we will finish the project in time.'}]},
  {a:'frustrierend', b:'frustriert', verb:'frustrieren', items:[
    {s:'Die ständigen Verzögerungen sind ___.', ans:'a', en:'The constant delays are frustrating.'},
    {s:'Viele Mitarbeiter sind ___, weil sich nichts ändert.', ans:'b', en:'Many employees are frustrated because nothing changes.'}]},
  {a:'beeindruckend', b:'beeindruckt', verb:'beeindrucken', items:[
    {s:'Die Ergebnisse des Teams sind ___.', ans:'a', en:'The team’s results are impressive.'},
    {s:'Die Kunden waren von der Qualität ___.', ans:'b', en:'The customers were impressed by the quality.'}]},
  {a:'motivierend', b:'motiviert', verb:'motivieren', items:[
    {s:'Ehrliches Lob ist sehr ___.', ans:'a', en:'Honest praise is very motivating.'},
    {s:'Die neue Kollegin ist hoch ___.', ans:'b', en:'The new colleague is highly motivated.'}]},
  {a:'verwirrend', b:'verwirrt', verb:'verwirren', items:[
    {s:'Die Anleitung ist ziemlich ___.', ans:'a', en:'The instructions are quite confusing.'},
    {s:'Nach seiner Erklärung war ich noch mehr ___.', ans:'b', en:'After his explanation I was even more confused.'}]},
  {a:'belastend', b:'belastet', verb:'belasten', items:[
    {s:'Der ständige Zeitdruck ist sehr ___.', ans:'a', en:'The constant time pressure is very stressful.'},
    {s:'Viele Pflegekräfte fühlen sich stark ___.', ans:'b', en:'Many care workers feel heavily burdened.'}]},
  {a:'beunruhigend', b:'beunruhigt', verb:'beunruhigen', items:[
    {s:'Die Gerüchte über einen Stellenabbau sind ___.', ans:'a', en:'The rumours about job cuts are worrying.'},
    {s:'Die Belegschaft ist wegen der Gerüchte ___.', ans:'b', en:'The staff are worried because of the rumours.'}]},
  {a:'interessant', b:'interessiert', verb:'interessieren', items:[
    {s:'Die Stellenanzeige klingt ___.', ans:'a', en:'The job ad sounds interesting.'},
    {s:'Ich bin sehr ___ an dieser Stelle.', ans:'b', en:'I am very interested in this position.'}]},
  {a:'faszinierend', b:'fasziniert', verb:'faszinieren', items:[
    {s:'Die neue Technik ist ___.', ans:'a', en:'The new technology is fascinating.'},
    {s:'Die Besucher waren ___ von den Robotern.', ans:'b', en:'The visitors were fascinated by the robots.'}]}
];

const PROMPTS = [
  {en:'Describe your future job.', model:'Mein zukünftiger Beruf soll interessant, kreativ und zukunftsfähig sein.'},
  {en:'Describe the hardest task you had this week.', model:'Die Präsentation am Montag war anstrengend, aber sehr lehrreich.'},
  {en:'Describe your ideal workplace.', model:'Ich wünsche mir einen modernen Arbeitsplatz in einem internationalen Team.'},
  {en:'Describe a colleague or teacher you admire.', model:'Meine Kollegin ist geduldig, ausdauernd und sehr kompetent.'},
  {en:'Describe your German course.', model:'Der Kurs ist anspruchsvoll, aber nie langweilig.'},
  {en:'Say what kind of company you would like to work for.', model:'Ich möchte für ein zukunftsfähiges Unternehmen mit flexiblen Arbeitszeiten arbeiten.'},
  {en:'Describe a situation at work that surprised you.', model:'Eine ungewöhnliche Anfrage eines Kunden hat mich überrascht.'}
];

const CHAPTERS = ['1','2','3','4','5','6','7','8','9','10'];
