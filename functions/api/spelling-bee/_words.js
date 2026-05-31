// Server-side only — never served to the client (the audio is, the spelling isn't)

export const POOLS = {
  easy: [
    'apple','table','happy','water','chair','green','music','river','smile','bread',
    'cloud','dance','light','paper','plant','sugar','beach','candy','house','train',
    'mouse','sweet','dream','field','grass','heart','juice','lemon','night','ocean',
    'tiger','zebra','horse','sheep','goat','duck','frog','snake','whale','shark',
    'bird','fish','bear','lion','wolf','deer','crab','seal','swan','dove',
    'money','happy','funny','sunny','rainy','windy','cloudy','foggy','snowy','stormy',
    'jump','climb','swim','sing','read','write','draw','paint','build','cook',
    'baker','dancer','singer','farmer','doctor','nurse','pilot','sailor','driver','teacher',
    'orange','banana','cherry','grape','melon','mango','peach','berry','olive','onion',
    'carrot','potato','tomato','pepper','garlic','celery','radish','turnip','squash','beans',
    'pencil','crayon','eraser','marker','ruler','folder','sticker','notebook','backpack','desk',
    'window','garden','kitchen','bedroom','bathroom','garage','attic','closet','hallway','porch',
    'circle','square','triangle','oval','heart','star','arrow','diamond','cross','spiral',
    'yellow','purple','silver','golden','copper','bronze','violet','indigo','maroon','beige',
    'monday','sunday','spring','summer','autumn','winter','morning','evening','noon','midnight',
    'pillow','blanket','mirror','candle','basket','bottle','button','ribbon','pocket','jacket',
    'cookie','muffin','waffle','pancake','pretzel','popcorn','pudding','custard','yogurt','cereal',
    'island','forest','desert','valley','meadow','jungle','canyon','prairie','swamp','glacier',
    'rocket','planet','comet','meteor','galaxy','saturn','mars','venus','pluto','orbit',
    'guitar','violin','trumpet','drum','flute','piano','banjo','harp','cello','organ',
    'puppy','kitten','bunny','pony','chick','lamb','calf','foal','cub','joey',
  ],
  medium: [
    'rhythm','island','biscuit','calendar','separate','library','science','weather','machine','picture',
    'thought','brought','language','sentence','definite','restaurant','vegetable','necessary','business','beautiful',
    'exercise','familiar','jealous','ceiling','foreign','leisure','medieval','muscle','receipt','schedule',
    'although','awkward','beginning','believe','cemetery','changeable','column','committee','conscience','convenient',
    'criticize','curiosity','decision','definitely','describe','desperate','dictionary','different','disappear','disappoint',
    'discipline','embarrass','environment','especially','exaggerate','excellent','existence','experience','explanation','fascinate',
    'favorite','february','finally','forty','fourth','friend','fulfill','generally','government','grammar',
    'grateful','guarantee','guard','guess','happened','height','humorous','identity','imagine','immediately',
    'independent','intelligent','interest','interrupt','knowledge','laboratory','length','license','lightning','listen',
    'marriage','mathematics','meant','medicine','message','millimeter','miniature','minute','mischief','mysterious',
    'neighbor','nervous','niece','ninety','noticeable','nuisance','occasion','official','opinion','opposite',
    'ordinary','original','parallel','particular','peculiar','perceive','performance','permanent','persuade','physical',
    'pleasant','possess','potatoes','practical','prejudice','preparation','presence','probably','professor','pronounce',
    'pumpkin','quantity','quarter','queue','realize','receive','recognize','reference','relevant','religious',
    'remember','resistance','ridiculous','sandwich','scissors','secretary','seize','sergeant','similar','sincerely',
    'soldier','special','stomach','strength','success','surprise','syllable','sympathy','technique','temperature',
    'thorough','tomorrow','tongue','tournament','tragedy','truly','twelfth','unusual','vacuum','vehicle',
    'vicious','village','weird','yacht','yield','abundant','adequate','ancient','anxious','approve',
    'attitude','audience','authority','available','average','behavior','benefit','category','chemical','citizen',
    'colleague','communicate','community','complete','conclusion','condition','conference','consider','continue','contribute',
    'cultural','customer','definition','democracy','department','dependent','distance','document','economy','education',
    'efficient','elaborate','election','emphasis','engineer','envelope','equipment','establish','estimate','evidence',
  ],
  hard: [
    'conscience','bureaucracy','mischievous','occurrence','embarrass','millennium','privilege','recommend','accommodate','liaison',
    'maintenance','perseverance','questionnaire','conscientious','unnecessary','parliament','pronunciation','possession','harassment','hierarchy',
    'fluorescent','guarantee','vacuum','minuscule','playwright','sergeant','threshold','withhold','irascible','idiosyncrasy',
    'abscess','accumulate','acquaintance','acquiesce','aficionado','amateur','anomaly','apparent','appropriate','archetype',
    'asphyxiate','asthma','atheist','auxiliary','bellwether','beleaguer','bourgeois','broccoli','calisthenics','camaraderie',
    'cantaloupe','caribbean','catastrophe','chauffeur','colonel','complacent','consensus','controversy','daiquiri','desiccate',
    'diaphragm','dilemma','diphtheria','disastrous','discernible','dissipate','ecstasy','efficient','exhilarate','exuberant',
    'facetious','fascism','fiery','foreseeable','forfeit','fuchsia','gauge','genealogy','grandeur','guerrilla',
    'handkerchief','harass','hemorrhage','hippopotamus','hygiene','hypocrisy','immaculate','inoculate','indict','inevitable',
    'ingenious','innocuous','intermittent','irresistible','jewelry','judgment','juxtapose','kaleidoscope','kerosene','labyrinth',
    'lieutenant','liquefy','maneuver','mayonnaise','memento','misspell','narcissism','nauseous','occasionally','omission',
    'oscillate','palette','panacea','paradigm','paraphernalia','pastime','personnel','phlegm','picturesque','plagiarize',
    'pneumonia','potpourri','precede','preliminary','prerogative','prestige','presumptuous','propaganda','quintessential','raspberry',
    'reconnaissance','rendezvous','repetition','reservoir','resuscitate','rhapsody','rhinoceros','sacrilegious','segue','silhouette',
    'simultaneous','soliloquy','sovereign','spaghetti','subtle','succinct','supersede','surveillance','susceptible','tsunami',
    'ubiquitous','unanimous','vehement','vengeance','wherewithal','zucchini','abbreviate','aberration','abhorrent','abomination',
    'abrogate','abstemious','accentuate','accessible','acclimate','accoutrement','acerbic','acrimonious','acumen','adamant',
    'admonish','adroit','aesthetic','affidavit','aggrandize','alacrity','allegiance','alleviate','ambidextrous','ambiguous',
    'ameliorate','anachronism','analogous','anathema','anesthesia','annihilate','antagonist','antithesis','apocalypse','apocryphal',
    'apoplectic','apothecary','approbation','arbitrary','archipelago','ascertain','assiduous','assuage','asymmetry','atrophy',
  ],
  impossible: [
    'onomatopoeia','worcestershire','chiaroscuro','sphygmomanometer','prestidigitation','sesquipedalian','bourgeoisie','connoisseur','rendezvous','pharaoh',
    'dachshund','scherenschnitte','appoggiatura','pococurante','logorrhea','zugzwang','schadenfreude','weltanschauung','gemutlichkeit','smorgasbord',
    'doppelganger','leitmotif','zeitgeist','gesundheit','wunderkind','verisimilitude','magniloquent','grandiloquent','perspicacious','pusillanimous',
    'sesquicentennial','antepenultimate','thaumaturgy','susurration','petrichor','defenestration','mellifluous','obsequious','surreptitious','ignominious',
    'perfunctory','sycophant','obstreperous','recalcitrant','intransigent','pulchritude','fastidious','magnanimous','sanctimonious','cantankerous',
    'circumlocution','gobbledygook','brouhaha','persiflage','badinage','raconteur','bildungsroman','weltschmerz','succedaneum','laodicean',
    'cymotrichous','guetapens','knaidel','feuilleton','stichomythia','autochthonous','esquamulose','antipyretic','chiaroscurist','guerdon',
    'ursprache','stromuhr','marocain','nunatak','gesellschaft','koinonia','serrefine','prospicience','transept','xanthosis',
    'syzygy','mnemonic','isthmus','fuchsia','gnocchi','chrysanthemum','hieroglyphics','ophthalmologist','otorhinolaryngology','electroencephalogram',
    'paterfamilias','penultimate','peripatetic','pellucid','phantasmagoria','philistine','phlegmatic','pococurantism','polyphony','postprandial',
    'prolegomenon','propinquity','prothalamion','quotidian','rapprochement','rebarbative','recondite','remunerative','reprobate','rhadamanthine',
    'risorgimento','sangfroid','saturnine','schwarmerei','sectarian','semaphore','sempiternal','sialoquent','sobriquet','solipsism',
    'soubrette','spoonerism','sprachgefuhl','staphylococci','stentorian','sternutation','stochastic','sublunary','supererogatory','svengali',
    'sybarite','tatterdemalion','tergiversation','threnody','tintinnabulation','transmogrify','triskaidekaphobia','turgescent','ultracrepidarian','usufruct',
    'vicissitude','villanelle','vituperative','voussoir','vraisemblance','widdershins','xenophobia','ratiocination','quincunx','perspicuity',
    'oneiromancy','noctilucent','nephology','myrmidon','mugwump','minatory','mendacious','maladroit','machicolation','luculent',
    'logodaedaly','limicolous','lickerish','leptodactylous','lachrymose','kakistocracy','jejune','inveigle','internecine','inspissate',
    'inimical','impecunious','illuminati','hypnopompic','hugger','hagiography','grandiloquence','floccinaucinihilipilification','fissiparous','febrifuge',
    'eudaemonic','epexegesis','ensorcell','endogenous','eleemosynary','effulgent','dipsomania','diaphanous','desuetude','deliquescent',
    'crepuscular','cynosure','consanguineous','concupiscence','circumambulate','chthonic','catafalque','callipygian','borborygmus','antediluvian',
  ],
  // Hard Mode only — every entry must be 20+ characters (enforced at pick time)
  hard_impossible: [
    'antidisestablishmentarianism','floccinaucinihilipilification','pneumonoultramicroscopicsilicovolcanoconiosis',
    'supercalifragilisticexpialidocious','hippopotomonstrosesquipedaliophobia','pseudopseudohypoparathyroidism',
    'spectrophotometrically','electroencephalographically','immunoelectrophoresis','otorhinolaryngological',
    'psychoneuroendocrinology','thyroparathyroidectomized','dichlorodifluoromethane','radioimmunoelectrophoresis',
    'esophagogastroduodenoscopy','honorificabilitudinitatibus','incomprehensibilities','counterrevolutionaries',
    'deinstitutionalization','internationalization','institutionalization','constitutionalization',
    'microspectrophotometry','electrocardiographically','overintellectualization','establishmentarianism',
    'psychophysicotherapeutics','microphotographically','phosphatidylethanolamine','electroencephalographic',
    'gastroenterologically','disproportionableness','overcommercialization','antiestablishmentarian',
    'transubstantiationalist','neuropsychopharmacology','psychopharmacological','crystallographically',
    'intellectualization','electrogalvanization','intercrystallization','pancreaticoduodenectomy',
    'choledochojejunostomy','ventriculoperitoneal','magnetoencephalography','electrophysiological',
    'pharmacotherapeutics','radiopharmaceuticals','electroencephalograph','electroencephalography',
    'compartmentalization','magnetohydrodynamics','chemotherapeutically','immunohistochemistry',
    'uncharacteristically','antidisestablishment','semiautobiographical','overenthusiastically',
    'psychotherapeutically','institutionalisation','recontextualizations','electrocardiographic',
    'methylenedioxymethamphetamine','tetrahydrocannabinol','polytetrafluoroethylene','deoxyribonucleotides',
    'carboxymethylcellulose','methylcyclopentadienyl','ethylenediaminetetraacetic','octamethylcyclotetrasiloxane',
    'llanfairpwllgwyngyll','indistinguishableness','intercontinentalism','superconductivities',
    'environmentalistically','representationalisms','professionalizations','overgeneralizations',
  ],
};

export function generateSeed() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const arr   = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join('');
}

function rngFromSeed(seed) {
  let a = 0;
  for (const c of seed) a = (Math.imul(a, 33) + c.charCodeAt(0)) >>> 0;
  a = a || 1;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(pool, n, rng) {
  const a = [...new Set(pool)]; // dedupe so a repeated pool word can't appear twice
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

// Progressive difficulty plans (both total 10 words)
const PLANS = {
  normal: [['easy', 2], ['medium', 2], ['hard', 3], ['impossible', 3]],
  hard:   [['easy', 1], ['medium', 1], ['hard', 2], ['impossible', 4], ['hard_impossible', 2]],
};

export async function getOrCreateWords(date, env, mode = 'normal') {
  mode = mode === 'hard' ? 'hard' : 'normal';
  const suffix  = mode === 'hard' ? '-hard' : '';
  const wordKey = `spelling-words${suffix}-${date}`;
  const seedKey = `spelling-seed${suffix}-${date}`;

  const existing = await env.SONGLESS_KV.get(wordKey, 'json');
  if (existing) return existing;

  let seed = await env.SONGLESS_KV.get(seedKey);
  if (!seed) {
    seed = generateSeed();
    await env.SONGLESS_KV.put(seedKey, seed, { expirationTtl: 60 * 60 * 24 * 8 });
  }

  const rng = rngFromSeed(seed);
  const words = [];
  for (const [difficulty, n] of PLANS[mode]) {
    let pool = POOLS[difficulty];
    if (difficulty === 'hard_impossible') pool = pool.filter(w => w.length >= 20); // guarantee 20+
    for (const w of pick(pool, n, rng)) words.push({ word: w.toUpperCase(), difficulty });
  }

  await env.SONGLESS_KV.put(wordKey, JSON.stringify(words), { expirationTtl: 60 * 60 * 24 * 8 });
  return words;
}

export function normalize(s) {
  return (s || '').toUpperCase().replace(/[^A-Z]/g, '');
}
