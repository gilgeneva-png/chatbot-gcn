/* Onde nocturne : cercles concentriques en relief, entre ronds dans l'eau,
   onde sonore vue de dessus et sable sur une peau de tambour.
   Respire doucement ; OndeNocturne.caillou() lance une ondulation depuis le centre. */
(function () {
  "use strict";
  const canvas = document.getElementById("onde");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const reduit = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sombreMQ = window.matchMedia && matchMedia("(prefers-color-scheme: dark)");

  let W = 0, H = 0, DPR = 1, cx = 0, cy = 0, S = 30, anneaux = [];
  const caillous = [];
  let t = 0, dernier = 0, visible = true, raf = 0;

  // pseudo-aléatoire stable
  let graine = 7;
  const alea = () => { graine = (graine * 16807) % 2147483647; return (graine - 1) / 2147483646; };

  // champ de "matière" lisse (somme de sinus)
  const PH = Array.from({ length: 12 }, () => alea() * Math.PI * 2);
  function champ(x, y, k) {
    const p = PH;
    return (Math.sin(x * 1.7 + p[k] ) * Math.cos(y * 1.3 + p[k + 1]) +
            Math.sin(x * 0.6 - y * 0.9 + p[k + 2]) * 0.8 +
            Math.cos(x * 2.9 + y * 2.3 + p[k + 3]) * 0.35) / 2.15;
  }

  const TEINTES = [
    [43, 168, 182],   // turquoise
    [196, 32, 46],    // rouge
    [196, 176, 120],  // ocre
    [226, 196, 204],  // rose pâle
  ];

  function sombre() {
    const a = document.documentElement.getAttribute("data-theme");
    if (a === "dark") return true;
    if (a === "light") return false;
    return !!(sombreMQ && sombreMQ.matches);
  }

  function couleur(u, v, nuit) {
    const m = champ(u, v, 0);           // ombres
    const c = champ(u * 1.4, v * 1.4, 4); // taches de couleur
    const z = champ(u * 0.8 + 3, v * 0.8, 8);
    let r, g, b;
    // base : blanc nacré -> gris -> presque noir
    const sh = Math.max(0, Math.min(1, (m + 0.15) * 1.25));
    const clair = nuit ? [62, 60, 64] : [238, 236, 232];
    const fonce = nuit ? [12, 12, 14] : [44, 40, 44];
    r = clair[0] + (fonce[0] - clair[0]) * sh * sh;
    g = clair[1] + (fonce[1] - clair[1]) * sh * sh;
    b = clair[2] + (fonce[2] - clair[2]) * sh * sh;
    // reflet mauve dans les zones moyennes
    const mv = Math.max(0, 1 - Math.abs(sh - 0.45) * 3) * 0.35;
    r += (150 - r) * mv; g += (128 - g) * mv; b += (140 - b) * mv;
    // taches de couleur, rares
    if (c > 0.42) {
      const k = Math.floor(((z + 1) / 2) * TEINTES.length) % TEINTES.length;
      const f = Math.min(1, (c - 0.42) * 3.2);
      const tt = TEINTES[k];
      r += (tt[0] - r) * f; g += (tt[1] - g) * f; b += (tt[2] - b) * f;
    }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }

  function preparer() {
    const rect = canvas.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    W = Math.max(1, rect.width); H = Math.max(1, rect.height);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cx = W * 0.5; cy = H * 0.56;
    S = Math.max(16, Math.min(34, Math.max(W, H) / 46));
    graine = 7;
    const rMax = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + S * 2;
    anneaux = [];
    for (let i = 1; i * S < rMax; i++) {
      // coupures : aucune près du centre, de plus en plus loin du centre
      const coupures = [];
      const n = i < 4 ? 0 : (alea() < 0.75 ? 1 + (alea() < 0.35 ? 1 : 0) : 0);
      for (let j = 0; j < n; j++) coupures.push([alea() * Math.PI * 2, 0.08 + alea() * 0.28]);
      anneaux.push({ i, r: i * S, coupures });
    }
  }

  function dansCoupure(a, coupures) {
    for (const [d, l] of coupures) {
      let x = (a - d) % (Math.PI * 2);
      if (x < 0) x += Math.PI * 2;
      if (x < l) return true;
    }
    return false;
  }

  function dessiner() {
    const nuit = sombre();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = nuit ? "#0b0b0b" : "#f6f6f5";
    ctx.fillRect(0, 0, W, H);
    const lw = S * 0.6;
    const pas = Math.PI * 2 / 96;
    const rot = t * 0.03;
    ctx.lineCap = "round";

    for (const an of anneaux) {
      // respiration + ondulations des cailloux
      let d = Math.sin(an.r * 0.045 - t * 0.9) * S * 0.06;
      for (const c of caillous) {
        const age = t - c.t0;
        const front = age * S * 7;
        const ecart = (an.r - front) / (S * 2.2);
        d += Math.exp(-ecart * ecart) * S * 0.42 * Math.exp(-age * 0.55) * Math.sin(ecart * 2.4);
      }
      const r = an.r + d;
      if (r <= 2) continue;
      // tracé par segments colorés
      let debut = null;
      for (let a = 0; a <= Math.PI * 2 + 1e-6; a += pas) {
        const coupe = dansCoupure(a, an.coupures);
        if (!coupe) {
          const a2 = a + pas;
          const u = Math.cos(a + rot) * r / 260, v = Math.sin(a + rot) * r / 260;
          ctx.strokeStyle = couleur(u + t * 0.01, v, nuit);
          ctx.lineWidth = lw;
          ctx.beginPath();
          ctx.arc(cx, cy, r, a, a2 + 0.01);
          ctx.stroke();
          if (debut === null) debut = a;
        }
      }
      // relief : creux sombre à l'extérieur, reflet clair à l'intérieur
      ctx.lineWidth = lw * 0.16;
      ctx.strokeStyle = nuit ? "rgba(0,0,0,.55)" : "rgba(0,0,0,.10)";
      arcsHorsCoupures(r + lw * 0.42, an.coupures);
      ctx.strokeStyle = nuit ? "rgba(255,255,255,.10)" : "rgba(255,255,255,.85)";
      arcsHorsCoupures(r - lw * 0.30, an.coupures);
    }
    // disque central
    ctx.fillStyle = nuit ? "#202022" : "#f3f2ef";
    ctx.beginPath(); ctx.arc(cx, cy, S * 0.55, 0, Math.PI * 2); ctx.fill();
  }

  function arcsHorsCoupures(r, coupures) {
    if (!coupures.length) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); return; }
    const segs = coupures.map(([d, l]) => [d, d + l]).sort((x, y) => x[0] - y[0]);
    for (let k = 0; k < segs.length; k++) {
      const fin = segs[k][1], suivant = segs[(k + 1) % segs.length][0] + (k + 1 === segs.length ? Math.PI * 2 : 0);
      if (suivant > fin) { ctx.beginPath(); ctx.arc(cx, cy, r, fin, suivant); ctx.stroke(); }
    }
  }

  function boucle(ms) {
    raf = 0;
    if (!visible || document.hidden) return;
    if (ms - dernier >= 33) { // ~30 images/s
      t += Math.min(0.1, (ms - dernier) / 1000 || 0.033);
      dernier = ms;
      for (let i = caillous.length - 1; i >= 0; i--) if (t - caillous[i].t0 > 7) caillous.splice(i, 1);
      dessiner();
    }
    raf = requestAnimationFrame(boucle);
  }
  function relancer() { if (!reduit && !raf && visible && !document.hidden) { dernier = performance.now(); raf = requestAnimationFrame(boucle); } }

  preparer(); dessiner();
  window.addEventListener("resize", () => { preparer(); dessiner(); });
  if (sombreMQ && sombreMQ.addEventListener) sombreMQ.addEventListener("change", dessiner);
  document.addEventListener("visibilitychange", relancer);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((e) => { visible = e[0].isIntersecting; relancer(); }).observe(canvas);
  }
  relancer();

  window.OndeNocturne = {
    caillou() {
      if (reduit) return;
      caillous.push({ t0: t });
      relancer();
    },
  };
})();
