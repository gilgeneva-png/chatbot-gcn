// Passe les questions de test et affiche les articles trouvés.
const M = require("../assets/search.js");
const corpus = require("../data/corpus.json"), lex = require("../data/lexique.json"), faq = require("../data/faq.json");
const qs = require("./questions.json");
const idx = M.construireIndex(corpus, lex, faq);
let ok = 0;
qs.forEach((t, i) => {
  const r = M.rechercher(idx, t.q, { commune: t.commune, type: t.type, max: 4 });
  const got = r.resultats.map((x) => x.chunk.doc + "|" + x.chunk.art);
  const hit = got.some((g) => t.attendu.includes(g));
  if (hit) ok++;
  console.log(`\n${i + 1}. [${hit ? "OK" : "--"}] conf=${r.confiance} ${t.q.slice(0, 80)}`);
  console.log("   concepts:", r.concepts.map((c) => c.nom).join(", "));
  r.resultats.forEach((x) => console.log(`   ${t.attendu.includes(x.chunk.doc + "|" + x.chunk.art) ? "*" : " "} ${x.doc.sigle} art. ${x.chunk.art} — ${x.chunk.titre.slice(0, 50)}  (s=${x.score.toFixed(1)} c=${x.couverture.toFixed(2)})`));
});
console.log(`\n${ok}/${qs.length} questions avec au moins un article attendu dans les 4 premiers`);
