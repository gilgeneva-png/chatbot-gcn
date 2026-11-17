/* Interface du guide juridique de la nuit (GCN). */
(function () {
  "use strict";
  const CFG = window.CONFIG_GCN || {};
  const M = window.MoteurGCN;
  const $ = (s, el) => (el || document).querySelector(s);

  const el = {
    avis: $("#avis-commune"),
    fil: $("#fil"), accueil: $("#accueil"), saisie: $("#saisie"), question: $("#question"),
    chargement: $("#chargement"), liste: $("#liste-textes"),
  };
  const NOMS_COMMUNES = { geneve: "Genève", carouge: "Carouge", lancy: "Lancy", vernier: "Vernier", autre: "Autre commune" };
  const valeur = (nom) => (document.querySelector(`input[name="${nom}"]:checked`) || {}).value;
  let index = null;

  /* ---------- Préférences (mémorisées sur l'appareil) ---------- */
  function lirePref(k) { try { return localStorage.getItem("gcn-" + k); } catch (e) { return null; } }
  function ecrirePref(k, v) { try { localStorage.setItem("gcn-" + k, v); } catch (e) { /* stockage indisponible */ } }
  for (const k of ["commune", "type"]) {
    const v = lirePref(k);
    const cible = v && document.querySelector(`input[name="${k}"][value="${v}"]`);
    if (cible) cible.checked = true;
    document.querySelectorAll(`input[name="${k}"]`).forEach((inp) =>
      inp.addEventListener("change", () => { ecrirePref(k, valeur(k)); majAvis(); }));
  }
  function majAvis() { el.avis.hidden = valeur("commune") !== "autre"; }

  /* Titres en vague : chaque lettre légèrement décalée, comme posée sur une onde */
  function vague(h) {
    const txt = h.textContent;
    h.setAttribute("aria-label", txt);
    h.textContent = "";
    let i = 0;
    txt.split(" ").forEach((motTxt, k) => {
      if (k) h.appendChild(document.createTextNode(" "));
      const mot = document.createElement("span");
      mot.className = "mot";
      mot.setAttribute("aria-hidden", "true");
      for (const ch of motTxt) {
        const s = document.createElement("span");
        s.className = "l";
        s.textContent = ch;
        const y = Math.sin(i * 0.55) * 0.06, rz = Math.cos(i * 0.55) * 2.2;
        s.style.transform = `translateY(${y.toFixed(3)}em) rotate(${rz.toFixed(2)}deg)`;
        mot.appendChild(s);
        i++;
      }
      i++;
      h.appendChild(mot);
    });
  }
  document.querySelectorAll(".titre-vague").forEach(vague);
  majAvis();

  /* ---------- Chargement ---------- */
  el.saisie.querySelector("button").disabled = true;
  Promise.all(["data/corpus.json", "data/lexique.json", "data/faq.json"].map((u) =>
    fetch(u, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(u); return r.json(); })
  )).then(([corpus, lexique, faq]) => {
    index = M.construireIndex(corpus, lexique, faq);
    el.chargement.textContent = `${corpus.docs.length} textes, ${corpus.chunks.length} passages · ${CFG.VERSION || ""}`;
    el.saisie.querySelector("button").disabled = false;
    remplirListe(corpus.docs);
  }).catch(() => {
    el.chargement.textContent = "Les textes n'ont pas pu être chargés. Rechargez la page.";
  });

  function remplirListe(docs) {
    const ordre = { "fédéral": 0, "cantonal": 1, "communal": 2 };
    docs.slice().sort((a, b) => ordre[a.niveau] - ordre[b.niveau]).forEach((d) => {
      const li = document.createElement("li");
      const lieu = d.commune ? NOMS_COMMUNES[d.commune] : d.niveau;
      li.innerHTML = `<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.sigle)} · ${esc(d.ref)}</a><span>${esc(d.titre)} — ${esc(lieu)}${d.version ? ", " + esc(d.version) : ""}</span>`;
      el.liste.appendChild(li);
    });
  }

  /* ---------- Questions ---------- */
  document.querySelectorAll(".exemple").forEach((b) =>
    b.addEventListener("click", () => { el.question.value = b.textContent; envoyerQuestion(); }));
  el.saisie.addEventListener("submit", (e) => { e.preventDefault(); envoyerQuestion(); });
  const ajuster = () => { el.question.style.height = "auto"; el.question.style.height = el.question.scrollHeight + "px"; };
  el.question.addEventListener("input", ajuster);
  el.question.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyerQuestion(); }
  });

  function envoyerQuestion() {
    const q = el.question.value.trim();
    if (!q || !index) return;
    el.accueil.hidden = true;
    el.question.value = "";
    ajuster();
    const commune = valeur("commune");
    const r = M.rechercher(index, q, { commune, type: valeur("type"), max: 4 });
    const echange = document.createElement("section");
    echange.className = "echange";
    const titre = document.createElement("h2");
    titre.className = "question-titre points";
    titre.textContent = q;
    echange.appendChild(titre);
    echange.appendChild(rendreReponse(q, r, commune));
    el.fil.prepend(echange);
    if (window.OndeNocturne) window.OndeNocturne.caillou();
    titre.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const STATUTS = {
    bonne: "Voici les articles qui se rapportent le plus à votre question. Vérifiez qu'ils correspondent bien à votre situation.",
    partielle: "J'ai trouvé des articles proches, mais ils ne répondent peut-être pas exactement à votre question.",
    faible: "Je n'ai pas trouvé d'article qui réponde clairement à votre question. Voici les passages les plus proches, à prendre avec prudence.",
    aucune: "Je n'ai trouvé aucun article sur ce sujet dans les textes du guide.",
  };

  function rendreReponse(q, r, commune) {
    const bloc = document.createElement("div");
    bloc.className = "reponse";

    const statut = document.createElement("p");
    statut.className = "statut" + (r.confiance === "faible" || r.confiance === "aucune" ? " faible" : "");
    statut.textContent = STATUTS[r.confiance];
    bloc.appendChild(statut);

    const sujets = r.concepts.map((c) => c.nom).slice(0, 6).join(", ");
    const ctx = document.createElement("p");
    ctx.className = "contexte";
    const typeLabel = (index.types[r.type] || {}).label || "";
    ctx.textContent = `${typeLabel} · ${NOMS_COMMUNES[commune]}${sujets ? " · sujets repérés : " + sujets : ""}`;
    bloc.appendChild(ctx);

    for (const f of r.faq) bloc.appendChild(carteFaq(f.entree));

    if (r.confiance !== "aucune") {
      r.resultats.forEach((x, i) => bloc.appendChild(carteArticle(x, i)));
    }

    // relais vers l'équipe, toujours proposé
    const relais = document.createElement("div");
    relais.className = "relais";
    const faible = r.confiance === "faible" || r.confiance === "aucune";
    relais.innerHTML = `<p>${faible ? "L'association peut chercher la réponse pour vous." : "Ces articles ne répondent pas à votre question ?"}</p>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bouton-texte";
    btn.textContent = "Transmettre à l'association";
    btn.addEventListener("click", () => {
      btn.disabled = true;
      relais.after(formulaire(q, r, commune, () => { btn.disabled = false; }));
    });
    relais.appendChild(btn);
    bloc.appendChild(relais);
    return bloc;
  }

  function carteFaq(f) {
    const c = document.createElement("article");
    c.className = "faq";
    c.innerHTML = `<p class="etiquette">Réponse validée par l'association${f.date ? " · " + esc(f.date) : ""}</p>
      <h3 class="article-titre">${esc(f.question)}</h3>
      <p class="article-texte">${esc(f.reponse)}</p>
      ${f.sources && f.sources.length ? `<p class="article-source">Sources : ${esc(f.sources.join(" ; "))}</p>` : ""}`;
    return c;
  }

  function carteArticle(x, i) {
    const d = x.doc, c = x.chunk;
    const art = /^Annexe/.test(c.art) ? c.art : "art. " + c.art;
    const partie = c.nparts > 1 ? ` (partie ${c.part}/${c.nparts})` : "";
    const carte = document.createElement("article");
    carte.className = "article";
    const lieu = d.commune ? `règlement communal, ${NOMS_COMMUNES[d.commune]}` : d.niveau;
    carte.innerHTML = `<p class="etiquette">${i === 0 ? "Article le plus proche" : "Voir aussi"}</p>
      <h3 class="article-titre"><span class="num">${esc(d.sigle)}, ${esc(art)}</span>${c.titre ? " · " + esc(c.titre) : ""}${esc(partie)}</h3>
      <p class="article-source">${esc(d.titre)} (${esc(d.ref)}, ${esc(lieu)})</p>
      <p class="article-texte">${surligner(c.text, x.trouves)}</p>
      <div class="article-pied">
        <a class="lien" href="${esc(d.url)}" target="_blank" rel="noopener">Texte officiel</a>
        <span class="version">${esc(capital(d.version || "version non datée"))}</span>
      </div>`;
    const texte = $(".article-texte", carte);
    if (c.text.length > 520) {
      texte.classList.add("replie");
      const b = document.createElement("button");
      b.type = "button"; b.className = "lien"; b.textContent = "Lire tout le passage";
      b.addEventListener("click", () => {
        const ouvert = texte.classList.toggle("replie");
        b.textContent = ouvert ? "Lire tout le passage" : "Réduire";
      });
      $(".article-pied", carte).prepend(b);
    }
    return carte;
  }

  function surligner(texte, racinesTrouvees) {
    const set = new Set(racinesTrouvees);
    return texte.split(/([A-Za-zÀ-ÖØ-öø-ÿ0-9’'-]+)/).map((part, i) => {
      if (i % 2 === 0) return esc(part);
      const n = M.normaliser(part).split(" ").filter(Boolean);
      const hit = n.length && n.some((w) => w.length > 2 && set.has(M.racine(w)));
      return hit ? `<mark>${esc(part)}</mark>` : esc(part);
    }).join("");
  }

  /* ---------- Formulaire de relais ---------- */
  function formulaire(q, r, commune, onFerme) {
    const f = document.getElementById("tpl-formulaire").content.firstElementChild.cloneNode(true);
    f.question.value = q;
    const nomPref = lirePref("nom"), mailPref = lirePref("email");
    if (nomPref) f.nom.value = nomPref;
    if (mailPref) f.email.value = mailPref;
    const etat = $(".etat-envoi", f);
    $(".annuler", f).addEventListener("click", () => { f.remove(); onFerme(); });
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      if (f.site.value) return; // robot
      if (!CFG.ENVOI_URL) {
        etat.textContent = "L'envoi n'est pas encore activé sur cette version de démonstration.";
        return;
      }
      const envoi = {
        date: new Date().toISOString(),
        commune: NOMS_COMMUNES[commune],
        type: (index.types[r.type] || {}).label || r.type,
        question: f.question.value.trim(),
        nom: f.nom.value.trim(),
        email: f.email.value.trim(),
        articles_proposes: r.resultats.map((x) => `${x.doc.sigle} art. ${x.chunk.art}`).join(" ; "),
        confiance: r.confiance,
        version: CFG.VERSION || "",
      };
      ecrirePref("nom", envoi.nom); ecrirePref("email", envoi.email);
      const bouton = f.querySelector("button[type=submit]");
      bouton.disabled = true;
      etat.textContent = "Envoi…";
      fetch(CFG.ENVOI_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(envoi) })
        .then(() => {
          f.innerHTML = `<h3 class="formulaire-titre">Question transmise</h3><p class="note">L'association vous répondra à ${esc(envoi.email)}. Merci.</p>`;
        })
        .catch(() => {
          bouton.disabled = false;
          etat.textContent = "L'envoi a échoué. Vérifiez votre connexion et réessayez.";
        });
    });
    return f;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }
  function capital(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
})();
