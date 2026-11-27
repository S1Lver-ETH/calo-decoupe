/* Calo Découpe — esquisse à main levée d'un ensemble, remise au propre en « bâtons ».
   Un trait droit = une partie droite ; une courbe ou un angle = un coude (quart de cercle = 90°) ;
   un demi-cercle = deux coudes à 90° avec une partie droite entre les deux.
   Fonctions pures : points en pixels, y vers le haut, angles en degrés. */
(function (root) {
  'use strict';
  var RAD = Math.PI / 180;

  function dist(a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]); }
  function longueur(p) { var L = 0; for (var i = 1; i < p.length; i++) L += dist(p[i - 1], p[i]); return L; }
  function cap(a, b) { return Math.atan2(b[1] - a[1], b[0] - a[0]) / RAD; }
  /* ramène x près de ref, à 360° près */
  function pres(x, ref) { while (x - ref > 180) x -= 360; while (x - ref <= -180) x += 360; return x; }

  function reechantillonner(p, h) {
    var out = [p[0].slice()], reste = 0;
    for (var i = 1; i < p.length; i++) {
      var a = p[i - 1], b = p[i], d = dist(a, b);
      if (!d) continue;
      var t = h - reste;
      while (t <= d) { out.push([a[0] + (b[0] - a[0]) * t / d, a[1] + (b[1] - a[1]) * t / d]); t += h; }
      reste = d - (t - h);
    }
    var fin = p[p.length - 1];
    if (dist(out[out.length - 1], fin) > h * 0.35) out.push(fin.slice());
    return out;
  }
  function lisser(p, passes) {
    for (var k = 0; k < passes; k++) {
      var q = p.map(function (x) { return x.slice(); });
      for (var i = 1; i < p.length - 1; i++) { q[i][0] = (p[i - 1][0] + 2 * p[i][0] + p[i + 1][0]) / 4; q[i][1] = (p[i - 1][1] + 2 * p[i][1] + p[i + 1][1]) / 4; }
      p = q;
    }
    return p;
  }
  /* écart du point c à la droite (a, b) */
  function ecartSigne(a, b, c) {
    var L = dist(a, b) || 1;
    return ((b[0] - a[0]) * (a[1] - c[1]) - (a[0] - c[0]) * (b[1] - a[1])) / L;
  }

  /* cap de la droite des moindres carrés passant par p[a..b], orienté de a vers b */
  function axe(p, a, b) {
    var mx = 0, my = 0, m = b - a + 1, sxx = 0, syy = 0, sxy = 0;
    for (var i = a; i <= b; i++) { mx += p[i][0]; my += p[i][1]; }
    mx /= m; my /= m;
    for (i = a; i <= b; i++) { var dx = p[i][0] - mx, dy = p[i][1] - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
    var t = 0.5 * Math.atan2(2 * sxy, sxx - syy), u = [Math.cos(t), Math.sin(t)];
    if (u[0] * (p[b][0] - p[a][0]) + u[1] * (p[b][1] - p[a][1]) < 0) t += Math.PI;
    return t / RAD;
  }

  /* direction ramenée sur 45° si elle en est proche, sinon sur 15° */
  function caler(x) {
    var a45 = Math.round(x / 45) * 45;
    return Math.abs(x - a45) <= 12 ? a45 : Math.round(x / 15) * 15;
  }
  /* un virage de plus de 105° devient deux coudes (ou plus), avec une partie droite entre eux */
  function decouper(d) {
    var a = Math.abs(d), s = d < 0 ? -1 : 1, l = [];
    if (a <= 105) return [d];
    if (a <= 210 && (a / 2) % 15 === 0) return [s * a / 2, s * a / 2];
    while (a > 105) { l.push(s * 90); a -= 90; }
    if (a >= 15) l.push(s * a); else l[l.length - 1] += s * a;
    return l;
  }

  /* points : [[x, y], …] (y vers le haut). Renvoie null si le trait est trop court. */
  function reconnaitre(points) {
    var brut = (points || []).filter(function (p, i, t) { return !i || dist(t[i - 1], p) > 0.01; });
    var L = brut.length > 1 ? longueur(brut) : 0;
    if (L < 30) return null;
    var h = Math.max(2, L / 120);
    /* lissage sur environ 1,5 % de la longueur : efface le tremblement du doigt, garde les coins */
    var sigma = 0.015 * L / h, p = lisser(reechantillonner(brut, h), Math.max(2, Math.min(12, Math.round(2 * sigma * sigma)))), n = p.length;

    /* 1. parties droites : le plus long d'abord, assez droit et assez long */
    var minDroit = Math.max(24, 0.12 * L), fin = [];
    for (var i = 0; i < n - 1; i++) {
      var j = i + 1;
      for (var jj = i + 2; jj < n; jj++) {
        var c = dist(p[i], p[jj]), tol = Math.max(1.6, 0.02 * c), pire = 0, somme = 0;
        for (var k = i + 1; k < jj; k++) { var e = ecartSigne(p[i], p[jj], p[k]); somme += e; pire = Math.max(pire, Math.abs(e)); }
        if (pire > 3 * tol) break;
        if (pire > tol) continue;
        /* une courbe douce reste dans la tolérance, mais tous ses points penchent du même côté */
        if (Math.abs(somme / (jj - i - 1)) > Math.max(0.35, 0.004 * c)) continue;
        /* … et ses deux moitiés, ajustées au mieux, n'ont pas le même cap */
        if (jj - i >= 8) { var mi = (i + jj) >> 1; if (Math.abs(pres(axe(p, i, mi) - axe(p, mi, jj), 0)) > 4) continue; }
        j = jj;
      }
      fin[i] = j;
    }
    var cand = [];
    for (i = 0; i < n - 1; i++) cand.push({ i: i, j: fin[i], L: dist(p[i], p[fin[i]]) });
    cand.sort(function (a, b) { return b.L - a.L; });
    var droits = [];
    cand.forEach(function (c) {
      if (c.L < minDroit) return;
      if (droits.some(function (d) { return c.i < d.j && c.j > d.i; })) return;
      droits.push(c);
    });
    droits.sort(function (a, b) { return a.i - b.i; });

    /* caps des cordes, déroulés */
    var th = [];
    for (i = 0; i < n - 1; i++) th.push(i ? pres(cap(p[i], p[i + 1]), th[i - 1]) : cap(p[0], p[1]));
    var tangente = function (a, b) { var s = 0, m = 0; for (var x = Math.max(0, a); x <= Math.min(th.length - 1, b); x++) { s += th[x]; m++; } return m ? s / m : th[0]; };

    /* 2. éléments dans l'ordre : droits et virages */
    var el = [], pos = 0;
    var virage = function (a, b, avant, apres) {
      if (b - a < 1 && avant === null) return;
      var cin = avant !== null ? avant.cap : tangente(a, a + 2), cout = apres !== null ? apres.cap : tangente(b - 3, b - 1);
      var cum = th[Math.min(b - 1, th.length - 1)] - th[Math.max(0, a)];
      /* une baïonnette dessinée d'un seul geste : deux virages opposés */
      var rel = [], mx = -1e9, mn = 1e9, imx = a, imn = a;
      for (var x = a; x < b && x < th.length; x++) { var v = th[x] - th[a]; rel.push(v); if (v > mx) { mx = v; imx = x; } if (v < mn) { mn = v; imn = x; } }
      var finV = rel.length ? rel[rel.length - 1] : 0, coupe = null;
      if (mx > 15 && mx - finV > 15) coupe = imx; else if (mn < -15 && finV - mn > 15) coupe = imn;
      var arcs = [];
      if (coupe !== null && coupe > a && coupe < b - 1) {
        var milieu = th[coupe];
        arcs.push({ d: pres(milieu - cin, th[coupe] - th[a]), A: (coupe - a) * h });
        arcs.push({ d: pres(cout - milieu, th[Math.min(b - 1, th.length - 1)] - th[coupe]), A: (b - coupe) * h });
      } else arcs.push({ d: pres(cout - cin, cum), A: Math.max(1, b - a) * h });
      arcs.forEach(function (x) { el.push({ type: 'virage', d: x.d, A: x.A }); });
    };
    droits.forEach(function (d, k) {
      d.cap = cap(p[d.i], p[d.j]);
      if (k === 0) d.cap = pres(d.cap, th[d.i]);
      else d.cap = pres(d.cap, droits[k - 1].cap + (th[d.i] - th[droits[k - 1].j - 1]));
      virage(pos, d.i, k ? droits[k - 1] : null, d);
      el.push({ type: 'droit', L: d.L, cap: d.cap });
      pos = d.j;
    });
    if (!droits.length) virage(0, n - 1, null, null);
    else if (n - 1 - pos >= 1) virage(pos, n - 1, droits[droits.length - 1], null);

    /* un petit bout « droit » au milieu d'une même courbe en fait partie */
    for (var z = 1; z < el.length - 1; z++) {
      var v1 = el[z - 1], dr = el[z], v2 = el[z + 1];
      if (dr.type !== 'droit' || v1.type !== 'virage' || v2.type !== 'virage' || v1.d * v2.d <= 0) continue;
      /* rayon de la courbe d'ensemble, comme si le bout droit en faisait partie */
      var rayon = (v1.A + dr.L + v2.A) / ((Math.abs(v1.d) + Math.abs(v2.d)) * RAD);
      if (dr.L >= 0.5 * rayon) continue;
      el.splice(z - 1, 3, { type: 'virage', d: v1.d + v2.d, A: v1.A + dr.L + v2.A });
      z = 0;
    }
    /* pareil pour un tout petit bout droit qui commence ou finit une grande courbe */
    var bout = function (d, v) { return d && v && d.type === 'droit' && v.type === 'virage' && d.L < 0.3 * (v.A + d.L) / (Math.abs(v.d) * RAD); };
    if (el.length > 1 && bout(el[0], el[1])) { el[1].A += el[0].L; el.shift(); }
    if (el.length > 1 && bout(el[el.length - 1], el[el.length - 2])) { el[el.length - 2].A += el[el.length - 1].L; el.pop(); }
    /* virages minuscules aux bouts : bavures du trait */
    while (el.length && el[0].type === 'virage' && Math.abs(el[0].d) < 15) el.shift();
    while (el.length && el[el.length - 1].type === 'virage' && Math.abs(el[el.length - 1].d) < 15) el.pop();
    if (!el.length) el.push({ type: 'droit', L: dist(p[0], p[n - 1]), cap: cap(p[0], p[n - 1]) });

    /* 3. directions calées : la première sur l'horizontale ou la verticale, les autres sur 15° */
    var cap0 = el[0].type === 'droit' ? el[0].cap : tangente(0, 2);
    var brutCap = cap0, depart = Math.round(cap0 / 90) * 90, cale = depart;
    var batons = [{ L: 0, droit: false, estime: true }], coudes = [];
    el.forEach(function (e) {
      var b = batons[batons.length - 1];
      if (e.type === 'droit') { b.L += e.L; b.droit = true; return; }
      brutCap += e.d;
      var cible = depart + caler(brutCap - depart), d = cible - cale;
      /* moins de 20° dessinés : un trait pas tout à fait droit, pas un coude */
      if (Math.abs(d) < 15 || Math.abs(e.d) < 20) { brutCap -= e.d; b.L += e.A; return; }
      var R = e.A / (Math.abs(e.d) * RAD);
      cale = cible;
      decouper(d).forEach(function (phi, m, tous) {
        var jambe = R * Math.tan(Math.abs(phi) / 2 * RAD);
        batons[batons.length - 1].L += jambe;
        coudes.push({ angle: Math.abs(phi), tourne: phi > 0 ? 1 : -1 });
        batons.push({ L: jambe, droit: m < tous.length - 1, estime: true });
      });
    });

    /* 4. tracé propre : coins successifs */
    var coins = [p[0].slice()], a = depart;
    batons.forEach(function (b, i) {
      b.cap = a;
      var c = coins[coins.length - 1];
      coins.push([c[0] + b.L * Math.cos(a * RAD), c[1] + b.L * Math.sin(a * RAD)]);
      if (coudes[i]) a += coudes[i].tourne * coudes[i].angle;
    });
    return { depart: depart, batons: batons, coudes: coudes, coins: coins, taille: L, lisse: p };
  }

  /* ---------- vers les pièces de la prise de cotes ---------- */
  var AXES = { haut: [0, 1], bas: [0, -1], droite: [1, 0], gauche: [-1, 0] };
  function nomAxe(a) { a = ((Math.round(a) % 360) + 360) % 360; return { 0: 'droite', 90: 'haut', 180: 'gauche', 270: 'bas' }[a]; }
  /* le mot de sens qui fait tourner le coude du bon côté, vu de face */
  function sensCoude(capDeg, tourne) {
    var d = [Math.cos(capDeg * RAD), Math.sin(capDeg * RAD)], n = [Math.cos((capDeg + 90 * tourne) * RAD), Math.sin((capDeg + 90 * tourne) * RAD)];
    var mieux = null, best = 0.05;
    Object.keys(AXES).forEach(function (k) {
      var v = AXES[k], pd = v[0] * d[0] + v[1] * d[1], q = [v[0] - pd * d[0], v[1] - pd * d[1]], nq = Math.hypot(q[0], q[1]);
      if (nq > best && q[0] * n[0] + q[1] * n[1] > 0) { best = nq; mieux = k; }
    });
    return mieux;
  }
  /* liste des pièces, chacune reliée à son bâton ou à son coude */
  function pieces(res) {
    var l = [];
    res.batons.forEach(function (b, i) {
      if (b.droit) l.push({ type: 'droit', baton: i });
      var c = res.coudes[i];
      if (c) l.push({ type: 'coude', coude: i, angle: c.angle, sens: sensCoude(b.cap, c.tourne) });
    });
    return l;
  }
  function departDe(res) { return nomAxe(res.depart); }

  /* ---------- dessin propre en SVG (repère de l'écran, y vers le bas) ---------- */
  function f(v) { return Math.round(v * 10) / 10; }
  /* cadre (facultatif) : [largeur, hauteur, marge] ; le dessin propre y est ramené s'il en dépasse */
  function trace(res, cadre) {
    var c = res.coins.map(function (q) { return [q[0], -q[1]]; });
    if (cadre) {
      var W = cadre[0], H = cadre[1], m = cadre[2];
      var x0 = Math.min.apply(null, c.map(function (q) { return q[0]; })), x1 = Math.max.apply(null, c.map(function (q) { return q[0]; }));
      var y0 = Math.min.apply(null, c.map(function (q) { return q[1]; })), y1 = Math.max.apply(null, c.map(function (q) { return q[1]; }));
      var k = Math.min(1, (W - 2 * m) / Math.max(1, x1 - x0), (H - 2 * m) / Math.max(1, y1 - y0));
      /* réduit autour de son centre, puis poussé juste ce qu'il faut pour rentrer */
      var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      var dx = cx - cx * k, dy = cy - cy * k;
      dx += Math.max(0, m - (x0 * k + dx)) - Math.max(0, x1 * k + dx - (W - m));
      dy += Math.max(0, m - (y0 * k + dy)) - Math.max(0, y1 * k + dy - (H - m));
      c = c.map(function (q) { return [q[0] * k + dx, q[1] * k + dy]; });
    }
    var d = 'M' + f(c[0][0]) + ' ' + f(c[0][1]), poses = [];
    for (var i = 1; i < c.length - 1; i++) {
      var A = c[i - 1], B = c[i], C = c[i + 1];
      var la = dist(A, B), lc = dist(B, C), co = res.coudes[i - 1];
      var u = [(B[0] - A[0]) / (la || 1), (B[1] - A[1]) / (la || 1)], v = [(C[0] - B[0]) / (lc || 1), (C[1] - B[1]) / (lc || 1)];
      var demi = Math.tan(co.angle / 2 * RAD), t = Math.min(0.45 * la, 0.45 * lc, 26 * demi);
      if (co.angle > 150) t = Math.min(0.45 * la, 0.45 * lc);
      var r = demi > 1e-6 ? t / demi : 0;
      var T1 = [B[0] - u[0] * t, B[1] - u[1] * t], T2 = [B[0] + v[0] * t, B[1] + v[1] * t];
      var sweep = u[0] * v[1] - u[1] * v[0] > 0 ? 1 : 0;
      d += 'L' + f(T1[0]) + ' ' + f(T1[1]) + 'A' + f(r) + ' ' + f(r) + ' 0 0 ' + sweep + ' ' + f(T2[0]) + ' ' + f(T2[1]);
      /* étiquette du coude : du côté du dos */
      var bis = [u[0] - v[0], u[1] - v[1]], nb = Math.hypot(bis[0], bis[1]) || 1;
      poses.push({ coude: i - 1, x: B[0] + bis[0] / nb * 22, y: B[1] + bis[1] / nb * 22 });
    }
    d += 'L' + f(c[c.length - 1][0]) + ' ' + f(c[c.length - 1][1]);
    res.batons.forEach(function (b, i) {
      var A = c[i], B = c[i + 1], m = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], L = dist(A, B) || 1;
      var nrm = [-(B[1] - A[1]) / L, (B[0] - A[0]) / L];
      /* l'étiquette du bâton va du côté opposé au coude suivant (ou précédent) */
      var co = res.coudes[i] || res.coudes[i - 1], s = co ? -co.tourne : 1;
      poses.push({ baton: i, x: m[0] + nrm[0] * 20 * s, y: m[1] + nrm[1] * 20 * s, L: L });
    });
    return { d: d, poses: poses, coins: c };
  }

  root.Croquis = { reconnaitre: reconnaitre, pieces: pieces, departDe: departDe, sensCoude: sensCoude, trace: trace, decouper: decouper, caler: caler };
})(this);
