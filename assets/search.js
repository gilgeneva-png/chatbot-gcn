/* Moteur de recherche documentaire du chatbot GCN.
   Recherche par mots-clés pondérée (BM25), enrichie par un lexique du jargon
   de la nuit, filtrée par commune et par type d'établissement.
   Fonctionne dans le navigateur et sous Node (pour les tests). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MoteurGCN = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const STOP = new Set((
    "a à au aux avec ce ces cet cette ceci cela ça dans de des du elle elles en et eux il ils je j la le les leur leurs " +
    "lui ma mais me même mes moi mon ne nos notre nous on ou où par pas pour qu que qui sa se ses son sur ta te tes toi " +
    "ton tu un une vos votre vous y est sont suis es être été ai as avons avez ont avoir fait faire faut peut peux puis " +
    "pouvons pouvez peuvent dois doit devons devez doivent veux veut voudrais voulons voulez veulent si oui non plus moins " +
    "très trop tout tous toute toutes quel quelle quels quelles quoi comment combien quand pourquoi alors donc car comme " +
    "aussi encore déjà là ici chez sans sous entre vers lorsque dont lequel laquelle lesquels lesquelles autre autres " +
    "c d l m n s t ok bien vraiment souvent toujours parfois mon ma mes notre nos leur cas lieu chose choses truc trucs " +
    "gens personne personnes quelqu quelque quelques ceux celles celui celle ont avez dit disent dire " +
    "possede possedent mettre mets met laisser laisse changer change cause meme memes aucun aucune raison besoin " +
    "regulierement passe passent vrai fort forte forts quoi chose genre etc svp merci bonjour salut question savoir " +
    "particulier particuliere particulieres particuliers preuve preuves soupcon soupcons fais font faites dedans " +
    "minimum maximum ok avoir veulent voudraient aimerai aimerais aimerions souhaite souhaitons droit droits"
  ).split(/\s+/));

  function sansAccents(s) {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function normaliser(s) {
    return sansAccents(String(s).toLowerCase())
      .replace(/[’`]/g, "'")
      .replace(/\b(l|d|j|qu|n|s|t|m|c|jusqu|lorsqu|puisqu)'/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  const SUFFIXES = [
    "issements", "issement", "ements", "ement", "ations", "ation", "atrices", "atrice", "ateurs", "ateur",
    "ments", "ment", "ances", "ance", "ences", "ence", "ites", "ite", "iques", "ique", "euses", "euse",
    "eurs", "eur", "ives", "ive", "ifs", "if", "ions", "ion", "ees", "ee", "es", "er", "ez", "ent",
    "ait", "ant", "e", "s", "x",
  ];

  function racine(mot) {
    let m = mot;
    if (m.length <= 3 || /^\d/.test(m)) return m;
    if (m.endsWith("aux") && m.length > 5) return m.slice(0, -3) + "al";
    for (const suf of SUFFIXES) {
      if (m.endsWith(suf) && m.length - suf.length >= 3) { m = m.slice(0, -suf.length); break; }
    }
    if (m.endsWith("e") && m.length > 4) m = m.slice(0, -1);
    return m;
  }

  function mots(s) {
    return normaliser(s).split(" ").filter((w) => w && !STOP.has(w));
  }

  function racines(s) {
    return mots(s).map(racine);
  }

  /* ---------- Index ---------- */

  const K1 = 1.3, B = 0.72;
  const POIDS = { titre: 2.6, texte: 1, ctx: 0.4 };

  function construireIndex(corpus, lexique, faq) {
    const docs = {};
    for (const d of corpus.docs) docs[d.id] = d;
    const chunks = corpus.chunks.map((c, i) => {
      const tf = new Map();
      const ajouter = (txt, w) => {
        for (const r of racines(txt)) tf.set(r, (tf.get(r) || 0) + w);
      };
      ajouter(c.titre, POIDS.titre);
      ajouter(c.text, POIDS.texte);
      ajouter(c.ctx, POIDS.ctx);
      let len = 0;
      for (const v of tf.values()) len += v;
      const enTitre = new Set(racines(c.titre));
      return Object.assign({}, c, { i, tf, len, enTitre });
    });
    const df = new Map();
    for (const c of chunks) for (const r of c.tf.keys()) df.set(r, (df.get(r) || 0) + 1);
    const avg = chunks.reduce((s, c) => s + c.len, 0) / chunks.length;

    // Lexique : chaque groupe relie des mots de tous les jours aux termes des textes.
    const groupes = (lexique.groupes || []).map((g) => ({
      nom: g.nom,
      declencheurs: g.declencheurs.map((t) => " " + normaliser(t) + " "),
      termes: [...new Set(g.termes.flatMap(racines))],
      type: g.type || null,
    }));

    const faqIndex = (faq && faq.entrees ? faq.entrees : []).map((f) => ({
      f, r: new Set(racines(f.question + " " + (f.mots_cles || []).join(" "))),
    }));

    return { docs, chunks, df, avg, N: chunks.length, groupes, faqIndex, types: lexique.types || {} };
  }

  function idf(index, r) {
    const n = index.df.get(r) || 0;
    return Math.log(1 + (index.N - n + 0.5) / (n + 0.5));
  }

  /* ---------- Analyse de la question ---------- */

  function analyser(index, question) {
    const q = " " + normaliser(question) + " ";
    let reste = q;
    const concepts = [];
    let typeDetecte = null;
    for (const g of index.groupes) {
      const hit = g.declencheurs.find((t) => q.includes(t));
      if (hit && g.type) {
        // le type d'établissement oriente la recherche sans compter comme sujet
        if (!typeDetecte) typeDetecte = g.type;
        for (const t of g.declencheurs) reste = reste.split(t).join(" ");
        continue;
      }
      if (hit) {
        concepts.push({ nom: g.nom, termes: g.termes, poids: 0.8, lexique: true });
        // retire les mots déclencheurs pour éviter de les compter deux fois
        for (const t of g.declencheurs) reste = reste.split(t).join(" ");
      }
    }
    const vus = new Set(concepts.flatMap((c) => c.termes));
    for (const w of mots(reste)) {
      const r = racine(w);
      if (r.length < 2 || vus.has(r)) continue;
      vus.add(r);
      if (!index.df.has(r)) continue; // mot absent de tous les textes
      concepts.push({ nom: w, termes: [r], poids: 1, lexique: false });
    }
    concepts.typeDetecte = typeDetecte;
    return concepts;
  }

  /* ---------- Recherche ---------- */

  function rechercher(index, question, options) {
    const opt = Object.assign({ commune: "geneve", type: "bar", max: 4, parDoc: 2 }, options || {});
    const concepts = analyser(index, question);
    const typeChoisi = concepts.typeDetecte || opt.type;
    const typeInfo = index.types[typeChoisi] || { termes: [] };
    const typeRac = [...new Set((typeInfo.termes || []).flatMap(racines))];

    const resultats = [];
    for (const c of index.chunks) {
      const d = index.docs[c.doc];
      if (d.commune && d.commune !== opt.commune) continue;
      let score = 0, couverts = 0;
      const trouves = new Set();
      for (const con of concepts) {
        let best = 0;
        for (const r of con.termes) {
          const tf = c.tf.get(r);
          if (!tf) continue;
          const s = idf(index, r) * (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * c.len / index.avg));
          const s2 = c.enTitre.has(r) ? s * 1.5 : s;
          if (s2 > best) best = s2;
          trouves.add(r);
        }
        if (best > 0) { score += best * con.poids; couverts++; }
      }
      if (!score) continue;
      for (const r of typeRac) if (c.tf.has(r)) score += 0.35 * idf(index, r);
      // les textes communaux de la commune choisie sont prioritaires sur leur sujet
      if (d.commune) score *= 1.12;
      const couverture = concepts.length ? couverts / concepts.length : 0;
      // la couverture des concepts compte autant que la force du score
      const final = score * (0.45 + 0.55 * couverture);
      resultats.push({ chunk: c, doc: d, score: final, brut: score, couverture, trouves: [...trouves] });
    }
    resultats.sort((a, b) => b.score - a.score);

    // un seul extrait par article, et pas plus de N articles par texte
    const choisis = [], parArticle = new Set(), parDoc = {};
    for (const r of resultats) {
      const kA = r.chunk.doc + "|" + r.chunk.art;
      if (parArticle.has(kA)) continue;
      if ((parDoc[r.chunk.doc] || 0) >= opt.parDoc) continue;
      parArticle.add(kA);
      parDoc[r.chunk.doc] = (parDoc[r.chunk.doc] || 0) + 1;
      choisis.push(r);
      if (choisis.length >= opt.max) break;
    }

    // niveau de confiance
    const top = choisis[0];
    let confiance = "aucune";
    if (top) {
      if (top.couverture >= 0.66 && top.brut >= 6) confiance = "bonne";
      else if (top.couverture >= 0.45 && top.brut >= 4) confiance = "partielle";
      else confiance = "faible";
    }
    if (!concepts.length) confiance = "aucune";

    // réponses déjà validées par l'équipe
    const qr = new Set(racines(question));
    const faq = index.faqIndex
      .filter((x) => !x.f.commune || x.f.commune === opt.commune)
      .map((x) => {
        let n = 0;
        for (const r of qr) if (x.r.has(r)) n++;
        return { entree: x.f, score: qr.size ? n / Math.max(qr.size, 3) : 0 };
      })
      .filter((x) => x.score >= 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);

    return { concepts, resultats: choisis, confiance, faq, type: typeChoisi };
  }

  return { construireIndex, rechercher, normaliser, racine, racines, analyser };
});
