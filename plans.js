/* Calo Découpe — tôlerie : vues 2D cotées des morceaux et feuilles à plat avec leurs découpes.
   g est une pièce issue de CoteCalc.debit(relevé).geo.segments ; toutes les cotes sont en millimètres. */
(function (root) {
  'use strict';
  var C = root.Calc, RAD = Math.PI / 180;

  function chemin(pts, ferme) { return pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2); }).join('') + (ferme ? 'Z' : ''); }
  function rect(x0, y0, x1, y1) { return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function angleDe(x, y) { return (Math.atan2(y, x) / RAD + 360) % 360; }

  /* ---------- vue 2D ---------- */
  var L2 = 340;
  function pastille(x, y, s, large) {
    var w = s.length * 6.7 + 12, W = large || L2;
    x = Math.max(w / 2 + 1, Math.min(W - w / 2 - 1, x));
    return '<rect class="pastille" x="' + (x - w / 2).toFixed(1) + '" y="' + (y - 10).toFixed(1) + '" width="' + w.toFixed(1) + '" height="20" rx="6"/><text class="pt" x="' + x.toFixed(1) + '" y="' + (y + 4.3).toFixed(1) + '" text-anchor="middle">' + s + '</text>';
  }
  /* ligne de cote entre a et b, décalée de d pixels selon la normale n */
  function cote(a, b, n, d, texte) {
    var A = [a[0] + n[0] * d, a[1] + n[1] * d], B = [b[0] + n[0] * d, b[1] + n[1] * d];
    var dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy) || 1, t = Math.min(6, l / 3), ux = dx / l * t, uy = dy / l * t;
    return '<path class="rappel" d="' + chemin([a, A]) + chemin([b, B]) + '"/><path class="mesure" d="' + chemin([A, B]) +
      chemin([[A[0] + ux - uy * 0.6, A[1] + uy + ux * 0.6], A, [A[0] + ux + uy * 0.6, A[1] + uy - ux * 0.6]]) +
      chemin([[B[0] - ux - uy * 0.6, B[1] - uy + ux * 0.6], B, [B[0] - ux + uy * 0.6, B[1] - uy - ux * 0.6]]) + '"/>' +
      pastille((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, texte);
  }
  function forme(pts, cls) { return '<path class="' + (cls || 's-sheet') + '" d="' + chemin(pts, true) + '"/>'; }
  function trait(pts, cls) { return '<path class="' + cls + '" d="' + chemin(pts) + '"/>'; }
  function dessin(h, corps, label) { return '<svg viewBox="0 0 ' + L2 + ' ' + h.toFixed(0) + '" role="img" aria-label="' + label + '">' + corps + '</svg>'; }

  function vue2d(g, r, lg) {
    var q = g.q, D = g.s.D, tole = r.finition === 'tole';
    if (g.type === 'coude') return coude2d(g, lg);
    if (g.type === 'droit') {
      var w = 250, h = Math.max(54, Math.min(110, D / g.L * w)), x = 66, y = 34;
      var haut = g.ferm ? g.ferm.w[1] : 0, yf = haut > 0.5 ? y + 3 : haut < -0.5 ? y + h - 3 : y + h / 2;
      var corps = forme(rect(x, y, x + w, y + h));
      var pas = Math.max(1, r.largeur - r.recouv), nb = Math.max(1, Math.ceil((g.L - 0.01) / pas));
      for (var i = 1; i < nb && i < 30; i++) corps += trait([[x + w * i * pas / g.L, y], [x + w * i * pas / g.L, y + h]], 'mesure');
      corps += trait([[x, yf], [x + w, yf]], 's-ferm');
      corps += cote([x, y + h], [x + w, y + h], [0, 1], 24, lg(g.L)) + cote([x, y], [x, y + h], [-1, 0], 28, 'Ø ' + lg(D));
      return dessin(y + h + 46, corps, 'Partie droite cotée');
    }
    if (g.type === 'te') {
      var gam = q.angle * RAD, r1 = D / 2, r2 = Math.min(g.branche.D / 2, r1), lb = q.longueurB;
      var d = [Math.cos(gam), Math.sin(gam)], n = [Math.sin(gam), -Math.cos(gam)];
      var Lm = Math.max(g.L, r2 * 3), x0 = -g.pos * Lm / g.L, x1 = x0 + Lm;
      var courbe = [];
      for (var a = 180; a >= 0; a -= 4) { var t = C.distancePiquage(r1, r2, q.angle, a), s = r2 * Math.cos(a * RAD); courbe.push([d[0] * t + n[0] * s, d[1] * t + n[1] * s]); }
      var bout = function (c) { return [d[0] * lb + n[0] * c, d[1] * lb + n[1] * c]; };
      var tous = courbe.concat([bout(r2), bout(-r2), [x0, -r1], [x1, r1]]);
      var xs = tous.map(function (p) { return p[0]; }), ys = tous.map(function (p) { return p[1]; });
      var mx = Math.min.apply(null, xs), Mx = Math.max.apply(null, xs), my = Math.min.apply(null, ys), My = Math.max.apply(null, ys);
      var k = Math.min(210 / (Mx - mx), 200 / (My - my)), ox = 66 + (210 - (Mx - mx) * k) / 2;
      var M = function (p) { return [ox + (p[0] - mx) * k, 34 + (My - p[1]) * k]; };
      var c2 = forme(rect(x0, -r1, x1, r1).map(M)) + forme(courbe.concat([bout(r2), bout(-r2)]).map(M), 's-sheet s-deux');
      c2 += trait(courbe.map(M), 'mesure') + trait([[x0, 0], [x1, 0]].map(M), 's-axis') + trait([[0, 0], bout(0)].map(M), 's-axis');
      c2 += cote(M([x0, -r1]), M([x1, -r1]), [0, 1], 22, lg(g.L)) + cote(M([x0, -r1]), M([0, -r1]), [0, 1], 48, 'axe ' + lg(g.pos));
      c2 += cote(M([x0, -r1]), M([x0, r1]), [-1, 0], 28, 'Ø ' + lg(D));
      c2 += cote(M(bout(r2)), M(bout(-r2)), [d[0], -d[1]], 20, 'Ø ' + lg(g.branche.D));
      c2 += cote(M([0, 0]), M(bout(0)), [1, 0], M([x1, 0])[0] - M([0, 0])[0] + 14 > 40 ? Math.min(80, r2 * k + 30) : 40, lg(lb));
      return dessin(M([0, -r1])[1] + 70, c2, 'Té coté');
    }
    if (g.type === 'reduction') {
      var D2 = g.s2.D, kk = 120 / D, h1 = D * kk, h2 = D2 * kk, w2 = Math.max(90, Math.min(200, g.L * kk)), X = 70 + (200 - w2) / 2, Y = 34;
      var plat = q.forme === 'excentree' ? q.plat : '';
      var y2 = plat === 'dessous' ? Y + h1 - h2 : plat === 'dessus' ? Y : Y + (h1 - h2) / 2;
      var c3 = forme([[X, Y], [X + w2, y2], [X + w2, y2 + h2], [X, Y + h1]]);
      c3 += cote([X, Y + h1], [X + w2, Y + h1], [0, 1], 24, lg(g.L)) + cote([X, Y], [X, Y + h1], [-1, 0], 30, 'Ø ' + lg(D)) + cote([X + w2, y2], [X + w2, y2 + h2], [1, 0], 32, 'Ø ' + lg(D2));
      return dessin(Y + h1 + 46, c3, 'Réduction cotée');
    }
    if (g.type === 'fond') {
      var H = 120, X4 = 120, Y4 = 20, prof = q.forme === 'bombe' ? 34 : 6;
      var arc = [[X4 + 26, Y4]];
      if (q.forme === 'bombe') for (var j = 0; j <= 24; j++) { var an = -Math.PI / 2 + Math.PI * j / 24; arc.push([X4 + 26 + prof * Math.cos(an), Y4 + H / 2 + H / 2 * Math.sin(an)]); }
      else arc.push([X4 + 26 + prof, Y4], [X4 + 26 + prof, Y4 + H]);
      arc.push([X4 + 26, Y4 + H], [X4, Y4 + H], [X4, Y4]);
      var c4 = forme(arc) + trait([[X4 + 26, Y4], [X4 + 26, Y4 + H]], 'mesure') + cote([X4, Y4], [X4, Y4 + H], [-1, 0], 34, 'Ø ' + lg(D));
      return dessin(Y4 + H + 20, c4, 'Fond coté');
    }
    var k5 = Math.min(150 / g.L, 80 / g.l, 130 / g.h), fw = Math.max(50, g.L * k5), sw = Math.max(40, g.l * k5), hh = Math.max(50, g.h * k5);
    var ax = 62, bx = ax + fw + 46, by = 24;
    var c5 = forme(rect(ax, by, ax + fw, by + hh)) + forme(rect(bx, by, bx + sw, by + hh), 's-sheet s-deux') +
      '<circle class="mesure" cx="' + (bx + sw / 2) + '" cy="' + (by + hh / 2) + '" r="' + Math.min(sw, hh, D * k5) / 2 + '" stroke-dasharray="4 3"/>';
    c5 += cote([ax, by + hh], [ax + fw, by + hh], [0, 1], 24, lg(g.L)) + cote([ax, by], [ax, by + hh], [-1, 0], 28, lg(g.h)) + cote([bx, by + hh], [bx + sw, by + hh], [0, 1], 24, lg(g.l));
    return dessin(by + hh + 46, c5, 'Boîte à vanne cotée');
  }

  function coude2d(g, lg) {
    var c = g.calcul, q = g.q, n = c.n + 2, A = q.angle * RAD, b = c.beta * RAD, R = c.R, ra = c.r;
    var sect = [];
    for (var j = 0; j < n; j++) {
      var tau = 2 * j * b, p0 = j === 0 ? 0 : (2 * j - 1) * b, p1 = j === n - 1 ? A : (2 * j + 1) * b;
      (function (tau, p0, p1) {
        var pt = function (rad, psi) { var m = R + rad, s = Math.max(0, m) * Math.tan(psi - tau); return [m * Math.cos(tau) - s * Math.sin(tau), m * Math.sin(tau) + s * Math.cos(tau)]; };
        var vi = Math.max(-R, -ra);
        sect.push({ tau: tau, dos0: pt(ra, p0), dos1: pt(ra, p1), ven0: pt(vi, p0), ven1: pt(vi, p1), axe0: pt(0, p0), axe1: pt(0, p1), num: pt(ra * 0.35, (p0 + p1) / 2), entiere: j > 0 && j < n - 1 });
      })(tau, p0, p1);
    }
    var tous = [];
    sect.forEach(function (s) { tous.push(s.dos0, s.dos1, s.ven0, s.ven1); });
    var xs = tous.map(function (p) { return p[0]; }), ys = tous.map(function (p) { return p[1]; });
    var mx = Math.min.apply(null, xs), Mx = Math.max.apply(null, xs), my = Math.min.apply(null, ys), My = Math.max.apply(null, ys);
    var k = Math.min(190 / (Mx - mx || 1), 220 / (My - my || 1)), ox = 76 + (190 - (Mx - mx) * k) / 2;
    var M = function (p) { return [ox + (p[0] - mx) * k, 26 + (My - p[1]) * k]; };
    var corps = '', etiq = '', ventres = [];
    sect.forEach(function (s, i) {
      corps += forme([s.dos0, s.dos1, s.ven1, s.ven0].map(M), 's-sheet' + (i % 2 ? ' s-deux' : ''));
      var th = g.ferm ? g.ferm.theta : 180;
      var bord = th === 0 ? [s.dos0, s.dos1] : th === 180 ? [s.ven0, s.ven1] : [s.axe0, s.axe1];
      corps += trait(bord.map(M), 's-ferm');
      var dos = c[s.entiere ? 'entiere' : 'demi'];
      var md = M([(s.dos0[0] + s.dos1[0]) / 2, (s.dos0[1] + s.dos1[1]) / 2]), dir = [Math.cos(s.tau), -Math.sin(s.tau)];
      etiq += pastille(md[0] + dir[0] * 26, md[1] + dir[1] * 18, 'D ' + lg(Math.max(0, dos.dos)));
      ventres.push({ de: M([(s.ven0[0] + s.ven1[0]) / 2, (s.ven0[1] + s.ven1[1]) / 2]), texte: 'V ' + lg(Math.max(0, dos.ventre)) });
      var num = M(s.num);
      etiq += '<text class="num" x="' + num[0].toFixed(1) + '" y="' + (num[1] + 4).toFixed(1) + '" text-anchor="middle">' + (s.entiere ? '' : '½ ') + (i + 1) + '</text>';
    });
    /* les cotes de ventre en colonne à gauche, reliées à leur bord */
    var bas = M([0, my])[1] + 8, pas = 23, hauteur = Math.max(bas + 14, 26 + pas * n + 10);
    ventres.forEach(function (v, i) {
      var y = hauteur - 14 - (ventres.length - 1 - i) * pas;
      var yy = hauteur - 14 - i * pas;
      corps += trait([v.de, [62, yy]], 'rappel');
      etiq += pastille(36, yy, v.texte);
    });
    /* Ø à l'extrémité de départ */
    var d0 = M(sect[0].dos0), v0 = M(sect[0].ven0);
    corps += cote(v0, d0, [0, 1], 24, 'Ø ' + lg(g.s.D));
    return dessin(Math.max(hauteur, d0[1] + 46), corps + etiq, 'Coude coté, vu de côté');
  }

  /* ---------- tôle à plat ---------- */
  function aPlat(g, r, lg) {
    var q = g.q, ep = r.finition === 'tole' ? r.epTole : 0, rc = r.recouv, D = g.s.D, Dt = D + ep, faces = q.faces || 1, dev = Math.PI * Dt, sortie = [];
    var nomFace = function (k) { return faces === 2 ? ' · face ' + (k + 1) : ''; };
    var zonesDe = function (w, h, W) { return rc > 0 ? [rect(W, 0, w, h)] : []; };
    var poser = function (titre, qte, f, aide) { f.titre = (r.finition === 'tole' ? 'Tole' : 'PVC') + ' - ' + titre.replace(/[éè]/g, 'e').replace(/·/g, '-') + ' - D ' + Math.round(D) + ' mm'; sortie.push({ titre: titre, qte: qte, forme: f, aide: aide || '' }); };

    if (g.type === 'coude') {
      var c = g.calcul;
      (c.n > 0 ? [false, true] : [false]).forEach(function (ent) {
        for (var k = 0; k < faces; k++) {
          var depart = g.ferm.theta + k * 180, N = 72, W = dev / faces, haut = [], bas = [], hMax = 0, hs = [];
          for (var i = 0; i <= N; i++) { var h = C.hauteurSecteur(c, depart + 360 / faces * i / N, ent); hs.push(h); if (h > hMax) hMax = h; }
          for (var j = 0; j <= N; j++) {
            var x = W * j / N, y0 = ent ? (hMax - hs[j]) / 2 : hMax - hs[j], y1 = ent ? (hMax + hs[j]) / 2 : hMax;
            haut.push([x, y0]); bas.push([x, y1 + rc]);
          }
          var fin = W + rc;
          var contour = haut.concat([[fin, haut[N][1]], [fin, bas[N][1]]], bas.slice().reverse());
          var cotes = [], pas = faces === 2 ? 2 : 4;
          for (var m = 0; m <= pas; m++) {
            var idx = Math.round(N * m / pas);
            if (m === pas) continue;
            cotes.push({ t: 'v', x: haut[idx][0], y1: haut[idx][1], y2: bas[idx][1], dehors: m === 0 ? 'gauche' : undefined, texte: lg(bas[idx][1] - haut[idx][1]) });
          }
          cotes.push({ t: 'h', x1: 0, x2: W, rang: 0, texte: 'Développé ' + lg(W) });
          if (rc > 0) cotes.push({ t: 'h', x1: W, x2: fin, rang: 0, texte: lg(rc) });
          cotes.push({ t: 'h', x1: 0, x2: fin, rang: 1, texte: 'Largeur à couper ' + lg(fin) });
          var reperes = [0, 90, 180, 270, 360].map(function (a) { return { a: a % 360, x: ((a - depart) % 360 + 360) % 360 / (360 / faces) * W }; })
            .filter(function (p, i, t) { return p.x <= W + 0.1 && t.findIndex(function (o) { return o.a === p.a; }) === i; })
            .map(function (p) { return { x: p.x, t: p.a === 0 ? 'dos' : p.a === 180 ? 'ventre' : p.a + '°' }; });
          if (faces === 1 && !reperes.some(function (p) { return Math.abs(p.x - W) < 1; })) {
            var th = ((depart % 360) + 360) % 360;
            reperes.push({ x: W, t: th === 0 ? 'dos' : th === 180 ? 'ventre' : Math.round(th) + '°' });
          }
          var raccord = haut.map(function (p, i) { return [p[0], bas[i][1] - rc]; });
          var zones = rc > 0 ? [raccord.concat(bas.slice().reverse()), [[W, haut[N][1]], [fin, haut[N][1]], [fin, bas[N][1]], [W, bas[N][1]]]] : [];
          poser((ent ? 'Section' : 'Demi-section') + nomFace(k), ent ? c.n : 2,
            { w: fin, h: hMax + rc, contour: contour, zones: zones, pointilles: rc > 0 ? [raccord, [[W, haut[N][1]], [W, bas[N][1]]]] : [], reperes: reperes, cotes: cotes },
            'Cotes à couper, recouvrements compris (' + lg(rc) + '). Bandes hachurées : recouvrements.');
        }
      });
    } else if (g.type === 'droit') {
      var step = Math.max(1, r.largeur - rc), nb = Math.max(1, Math.ceil((g.L - 0.01) / step)), reste = g.L - (nb - 1) * step + rc;
      var virole = function (titre, qte, h) {
        var W = dev / faces, w = W + rc;
        poser(titre, qte, {
          w: w, h: h, contour: rect(0, 0, w, h), zones: rc > 0 ? [rect(W, 0, w, h), rect(0, 0, W, Math.min(rc, h))] : [],
          pointilles: rc > 0 ? [[[W, 0], [W, h]], [[0, Math.min(rc, h)], [W, Math.min(rc, h)]]] : [], reperes: [],
          cotes: [{ t: 'v', x: 0, y1: 0, y2: h, dehors: 'gauche', texte: lg(h) }, { t: 'h', x1: 0, x2: W, rang: 0, texte: 'Développé ' + lg(W) }, { t: 'h', x1: 0, x2: w, rang: 1, texte: 'Largeur à couper ' + lg(w) }]
        }, 'Découpe d’équerre. Bandes hachurées : recouvrements de ' + lg(rc) + '.');
      };
      if (nb > 1) virole('Virole', (nb - 1) * faces, r.largeur);
      virole(nb > 1 ? 'Dernière virole' : 'Virole', faces, reste);
    } else if (g.type === 'te') {
      if (!g.possible) return sortie;
      var pq = C.piquage({ dInt1: g.s.coq, e1: g.s.e + ep / 2, dInt2: g.branche.coq, e2: g.branche.e + ep / 2, gamma: q.angle });
      var nbDir = g.n, w0 = g.ferm.w, depM = angleDe(dot(w0, nbDir), dot(w0, cross(g.d0, nbDir)));
      var G = C.gabaritPrincipal(pq, depM, g.L, rc), L = G.L;
      var decal = Math.max(-G.haut, Math.min(L - G.bas, L - g.pos - G.origine));
      var trous = G.trous.map(function (t) { return t.map(function (p) { return [p[0], p[1] + decal]; }); });
      var fin2 = G.dev + rc, haut2 = G.haut + decal, bas2 = G.bas + decal;
      poser('Tube principal avec le trou', 1, {
        w: fin2, h: L, contour: rect(0, 0, fin2, L), trous: trous, zones: rc > 0 ? [rect(G.dev, 0, fin2, L)] : [], pointilles: rc > 0 ? [[[G.dev, 0], [G.dev, L]]] : [], reperes: [],
        cotes: [{ t: 'v', x: 0, y1: 0, y2: haut2, dehors: 'gauche', texte: lg(haut2) }, { t: 'v', x: 0, y1: haut2, y2: bas2, dehors: 'gauche', texte: lg(bas2 - haut2) }, { t: 'v', x: 0, y1: bas2, y2: L, dehors: 'gauche', texte: lg(L - bas2) },
          { t: 'h', x1: 0, x2: G.dev, rang: 0, texte: 'Développé ' + lg(G.dev) }, { t: 'h', x1: 0, x2: fin2, rang: 1, texte: 'Largeur à couper ' + lg(fin2) }]
      }, 'Trou à découper : ' + lg(pq.trouLongueur) + ' × ' + lg(pq.trouLargeur) + '. Bas de la feuille = début du té.' + (faces === 2 ? ' Pour 2 faces, recouper en deux au milieu.' : ''));
      var N2 = 72, W2 = pq.dev2, f2 = W2 + rc, pts = [], th0 = q.fermeture === 'angle' ? q.fermAngle : 180, hm = 0;
      for (var i2 = 0; i2 <= N2; i2++) { var t = th0 + 360 * i2 / N2, gen = Math.max(0, q.longueurB - C.distancePiquage(pq.r1, pq.r2, q.angle, t)) + rc; pts.push([W2 * i2 / N2, gen]); if (gen > hm) hm = gen; }
      var cot2 = [0, 18, 36, 54].map(function (i, k) { return { t: 'v', x: pts[i][0], y1: 0, y2: pts[i][1], dehors: k === 0 ? 'gauche' : undefined, texte: lg(pts[i][1]) }; });
      cot2.push({ t: 'h', x1: 0, x2: W2, rang: 0, texte: 'Développé ' + lg(W2) }, { t: 'h', x1: 0, x2: f2, rang: 1, texte: 'Largeur à couper ' + lg(f2) });
      poser('Piquage (gueule de loup)', 1, {
        w: f2, h: hm, contour: [[0, 0], [f2, 0], [f2, pts[N2][1]]].concat(pts.slice().reverse()), zones: rc > 0 ? [[[W2, 0], [f2, 0], [f2, pts[N2][1]], [W2, pts[N2][1]]]] : [],
        pointilles: rc > 0 ? [[[W2, 0], [W2, pts[N2][1]]]] : [], reperes: [0, 90, 180, 270].map(function (a) { return { x: ((a - th0 + 360) % 360) / 360 * W2, t: a + '°' }; }), cotes: cot2
      }, 'Haut d’équerre, bas en courbe. Cotes avec ' + lg(rc) + ' de bord à rabattre sur le principal.');
    } else if (g.type === 'reduction') {
      for (var kf = 0; kf < faces; kf++) poser('Cône' + nomFace(kf), 1, cone(g, Dt, g.s2.D + ep, rc, faces, kf, lg), 'Développement tracé par triangles. Ajouter ' + lg(rc) + ' en bout pour l’emboîtement.');
    } else if (g.type === 'fond') {
      var ray = D / 2 + rc, cercle = function (rr) { var t = []; for (var i = 0; i <= 72; i++) t.push([ray + rr * Math.cos(i * 5 * RAD), ray + rr * Math.sin(i * 5 * RAD)]); return t; };
      poser(q.forme === 'bombe' ? 'Flan du fond bombé' : 'Disque de fond', 1, {
        w: 2 * ray, h: 2 * ray, contour: cercle(ray), zones: [], pointilles: [cercle(D / 2)], reperes: [],
        cotes: [{ t: 'h', x1: rc, x2: rc + D, rang: 0, texte: 'Ø fini ' + lg(D) }, { t: 'h', x1: 0, x2: 2 * ray, rang: 1, texte: 'Ø à couper ' + lg(2 * ray) }]
      }, q.forme === 'bombe' ? 'Flan à bomber ; ajuster après essai.' : 'En pointillé : le pli du bord.');
    } else {
      var l = g.l, h5 = g.h, LL = g.L, H = LL + 2 * rc;
      var dev5 = faces === 2 ? l + h5 : 2 * (l + h5), w5 = dev5 + (faces === 2 ? 2 * rc : rc);
      var plis = faces === 2 ? [rc + h5 / 2, rc + h5 / 2 + l, rc + h5 + l] : [l, l + h5, 2 * l + h5, dev5];
      var faceX = faces === 2 ? [rc, rc + h5 / 2, rc + h5 / 2 + l, rc + h5 + l] : [0, l, l + h5, 2 * l + h5, dev5];
      var cot5 = [{ t: 'v', x: 0, y1: 0, y2: H, dehors: 'gauche', texte: lg(H) }];
      for (var s5 = 1; s5 < faceX.length; s5++) cot5.push({ t: 'h', x1: faceX[s5 - 1], x2: faceX[s5], rang: 0, texte: lg(faceX[s5] - faceX[s5 - 1]) });
      cot5.push({ t: 'h', x1: 0, x2: w5, rang: 1, texte: 'Largeur à couper ' + lg(w5) });
      poser(faces === 2 ? 'Demi-ceinture' : 'Ceinture', faces, {
        w: w5, h: H, contour: rect(0, 0, w5, H), zones: rc > 0 ? [rect(0, 0, w5, rc), rect(0, H - rc, w5, H)] : [],
        pointilles: plis.map(function (x) { return [[x, 0], [x, H]]; }).concat(rc > 0 ? [[[0, rc], [w5, rc]], [[0, H - rc], [w5, H - rc]]] : []), reperes: [], cotes: cot5
      }, 'Pointillés : les plis.');
      var fw = l + 2 * rc, fh = h5 + 2 * rc, trou = [];
      for (var a5 = 0; a5 <= 72; a5++) trou.push([fw / 2 + D / 2 * Math.cos(a5 * 5 * RAD), fh / 2 + D / 2 * Math.sin(a5 * 5 * RAD)]);
      poser('Flasque avec passage du tube', 2, {
        w: fw, h: fh, contour: rect(0, 0, fw, fh), trous: [trou], zones: [], pointilles: [rect(rc, rc, fw - rc, fh - rc).concat([[rc, rc]]), [[fw / 2, 0], [fw / 2, fh]]], reperes: [],
        cotes: [{ t: 'v', x: 0, y1: 0, y2: fh, dehors: 'gauche', texte: lg(fh) }, { t: 'h', x1: 0, x2: fw, rang: 0, texte: lg(fw) }, { t: 'h', x1: fw / 2 - D / 2, x2: fw / 2 + D / 2, rang: 1, texte: 'Trou Ø ' + lg(D) }]
      }, 'Couper en deux sur le trait central pour passer le tube.');
    }
    return sortie;
  }

  /* Développé d'un cône (concentrique ou excentré) : les triangles sont reportés un à un à plat. */
  function cone(g, D1, D2, rc, faces, k, lg) {
    var r1 = D1 / 2, r2 = D2 / 2, L = g.L, excentre = g.q.forme === 'excentree';
    var dec = excentre ? (g.q.plat === 'dessus' ? 1 : -1) * (r1 - r2) : 0;
    /* angle compté depuis le dessus */
    var th0 = (g.ferm.theta + k * 180) * RAD, N = 120 / faces;
    var A = function (t) { return [0, r1 * Math.cos(t), r1 * Math.sin(t)]; };
    var B = function (t) { return [L, dec + r2 * Math.cos(t), r2 * Math.sin(t)]; };
    var dist = function (p, q) { return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
    /* point à distance da de a et db de b, du côté demandé */
    var tri = function (a, b, da, db, sens) {
      var dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1e-9;
      var x = (da * da - db * db + d * d) / (2 * d), y = Math.sqrt(Math.max(0, da * da - x * x)) * sens;
      return [a[0] + dx / d * x - dy / d * y, a[1] + dy / d * x + dx / d * y];
    };
    var a2 = [[0, 0]], b2 = [[0, dist(A(th0), B(th0))]], longs = [b2[0][1]];
    for (var i = 1; i <= N; i++) {
      var t0 = th0 + 2 * Math.PI / faces * (i - 1) / N, t1 = th0 + 2 * Math.PI / faces * i / N;
      var a = tri(a2[i - 1], b2[i - 1], dist(A(t1), A(t0)), dist(A(t1), B(t0)), -1);
      var b = tri(a, b2[i - 1], dist(A(t1), B(t1)), dist(B(t1), B(t0)), 1);
      a2.push(a); b2.push(b); longs.push(dist(A(t1), B(t1)));
    }
    /* redressé pour que la génératrice du milieu soit verticale */
    var m = N >> 1, ang = Math.atan2(b2[m][0] - a2[m][0], b2[m][1] - a2[m][1]);
    var tourne = function (p) { var c = Math.cos(ang), s = Math.sin(ang); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; };
    a2 = a2.map(tourne); b2 = b2.map(tourne);
    if (a2[N][0] < a2[0][0]) { var miroir = function (p) { return [-p[0], p[1]]; }; a2 = a2.map(miroir); b2 = b2.map(miroir); }
    /* recouvrement le long de la dernière génératrice */
    var ux = b2[N][0] - a2[N][0], uy = b2[N][1] - a2[N][1], n = Math.hypot(ux, uy) || 1, nx = uy / n, ny = -ux / n;
    if (nx * (a2[N][0] - a2[N - 1][0]) + ny * (a2[N][1] - a2[N - 1][1]) < 0) { nx = -nx; ny = -ny; }
    var ea = [a2[N][0] + nx * rc, a2[N][1] + ny * rc], eb = [b2[N][0] + nx * rc, b2[N][1] + ny * rc];
    var contour = a2.concat([ea, eb], b2.slice().reverse());
    var xs = contour.map(function (p) { return p[0]; }), ys = contour.map(function (p) { return p[1]; });
    var mx = Math.min.apply(null, xs), my = Math.min.apply(null, ys), w = Math.max.apply(null, xs) - mx, h = Math.max.apply(null, ys) - my;
    var T = function (p) { return [p[0] - mx, p[1] - my]; };
    var reps = [0, m, N].map(function (i, j) {
      var p = T([(a2[i][0] + b2[i][0]) / 2, (a2[i][1] + b2[i][1]) / 2]);
      return { t: 'rep', x: p[0], y: p[1], dx: j === 0 ? 34 : j === 2 ? -34 : 0, dy: j === 1 ? 0 : -18, texte: lg(longs[i]) };
    });
    reps.push({ t: 'h', x1: 0, x2: w, rang: 0, texte: 'Largeur ' + lg(w) }, { t: 'v', x: 0, y1: 0, y2: h, dehors: 'gauche', texte: lg(h) });
    return {
      w: w, h: h, contour: contour.map(T), zones: rc > 0 ? [[a2[N], ea, eb, b2[N]].map(T)] : [], pointilles: rc > 0 ? [[a2[N], b2[N]].map(T)] : [], reperes: [], cotes: reps,
      arcs: { grand: longueurDe(a2), petit: longueurDe(b2), generatrices: longs }
    };
  }
  function longueurDe(l) { var s = 0; for (var i = 1; i < l.length; i++) s += Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]); return s; }

  root.Plans = { vue2d: vue2d, aPlat: aPlat };
})(this);
