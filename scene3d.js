/* Calo Découpe — modèles 3D en WebGL, sans bibliothèque : tube acier, coquille de laine et PVC gris.
   Les diamètres, rayons et courbes de coupe sont ceux des calculs ; les longueurs droites sont raccourcies. */
(function (root) {
  'use strict';
  var C = root.Calc;
  var RAD = Math.PI / 180, TOUR = Math.PI * 2;
  var M = { laine: 0, tranche: 1, pvc: 2, joint: 3, acier: 4, creux: 5, collerette: 6, laine2: 7, tole: 8, tole2: 9 };

  /* ---------- texture de laine de roche ----------
     Teinte beige doré relevée sur les photos de coquilles (autour de #b0a16a).
     Image raccordable bord à bord, fabriquée une fois : amas cotonneux étirés en strates,
     voiles clairs et gris, puis fibres fines. Sert aux modèles 3D et aux dessins. */
  var laineToile = null;
  function textureLaine() {
    if (laineToile) return laineToile;
    var T = 512, toile = document.createElement('canvas');
    toile.width = toile.height = T;
    var g = toile.getContext('2d');
    var graine = 11;
    var alea = function () { graine = graine * 16807 % 2147483647; return graine / 2147483647; };
    /* bruit lissé périodique : u et w entre 0 et 1, avec répétition */
    var bruit = function (nx, ny) {
      var v = new Float32Array(nx * ny);
      for (var i = 0; i < v.length; i++) v[i] = alea();
      return function (u, w) {
        var x = u * nx, y = w * ny, ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy;
        tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
        var x0 = ((ix % nx) + nx) % nx, y0 = ((iy % ny) + ny) % ny, x1 = (x0 + 1) % nx, y1 = (y0 + 1) % ny;
        var a = v[y0 * nx + x0] + (v[y0 * nx + x1] - v[y0 * nx + x0]) * tx;
        var b = v[y1 * nx + x0] + (v[y1 * nx + x1] - v[y1 * nx + x0]) * tx;
        return a + (b - a) * ty;
      };
    };
    var lisse = function (a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    var tordreU = bruit(7, 9), tordreW = bruit(9, 12), amas = bruit(5, 13), meches = bruit(13, 38), brins = bruit(46, 120),
      voile = bruit(6, 14), grain = bruit(230, 256);
    /* fond un peu assombri : avec les voiles clairs, la teinte moyenne retombe sur #b0a16a */
    var base = [0xb0 - 8, 0xa1 - 8, 0x6a - 12], clair = [222, 208, 160], gris = [184, 176, 148];
    var image = g.createImageData(T, T), d = image.data;
    for (var y = 0; y < T; y++) {
      for (var x = 0; x < T; x++) {
        var u = x / T, w = y / T;
        var du = (tordreU(u, w) - 0.5) * 0.16, dw = (tordreW(u, w) - 0.5) * 0.09;
        var m = meches(u + du * 1.6, w + dw * 1.5);
        var n = amas(u + du, w + dw) * 0.4 + m * 0.36 + brins(u + du * 2.1, w + dw * 2) * 0.24;
        var lum = 1 + (n - 0.5) * 0.62 + (grain(u, w) - 0.5) * 0.12;
        var pale = lisse(0.54, 0.82, voile(u + du * 2, w + dw * 2) * 0.45 + meches(u - du, w - dw * 1.7) * 0.55);
        var creme = lisse(0.58, 0.8, brins(u - du * 1.4, w + dw * 1.2) * 0.5 + m * 0.5);
        var k = (y * T + x) * 4;
        for (var c = 0; c < 3; c++) {
          var col = base[c] * lum;
          col += (gris[c] - col) * pale * 0.42;
          col += (clair[c] - col) * creme * 0.38;
          d[k + c] = col;
        }
        d[k + 3] = 255;
      }
    }
    g.putImageData(image, 0, 0);
    /* fibres : fines, ondulées, plutôt couchées dans le sens des strates */
    var fibres = function (nombre, couleur, long, epais) {
      g.strokeStyle = couleur;
      for (var i = 0; i < nombre; i++) {
        var x = alea() * T, y = alea() * T, a = (alea() - 0.5) * 1.5, l = long * (0.4 + alea());
        var ex = Math.cos(a) * l, ey = Math.sin(a) * l * 0.6;
        var c1 = [ex * 0.3 + (alea() - 0.5) * l * 0.7, ey * 0.3 + (alea() - 0.5) * l * 0.6];
        var c2 = [ex * 0.7 + (alea() - 0.5) * l * 0.7, ey * 0.7 + (alea() - 0.5) * l * 0.6];
        g.lineWidth = epais * (0.5 + alea());
        /* une fibre qui dépasse un bord revient par le bord opposé */
        for (var ox = -T; ox <= T; ox += T) {
          for (var oy = -T; oy <= T; oy += T) {
            if (x + ox < -l * 2 || x + ox > T + l * 2 || y + oy < -l * 2 || y + oy > T + l * 2) continue;
            g.beginPath(); g.moveTo(x + ox, y + oy);
            g.bezierCurveTo(x + ox + c1[0], y + oy + c1[1], x + ox + c2[0], y + oy + c2[1], x + ox + ex, y + oy + ey);
            g.stroke();
          }
        }
      }
    };
    fibres(1700, 'rgba(96,78,34,0.28)', 22, 1.1);
    fibres(2100, 'rgba(228,214,160,0.34)', 24, 0.9);
    fibres(900, 'rgba(238,230,204,0.28)', 30, 0.7);
    fibres(14, 'rgba(82,66,28,0.28)', 120, 1.8);      /* quelques fentes entre strates */
    laineToile = toile;
    return toile;
  }

  /* ---------- vecteurs ---------- */
  function lin() {
    var r = [0, 0, 0];
    for (var i = 0; i < arguments.length; i += 2) {
      var k = arguments[i], v = arguments[i + 1];
      r[0] += k * v[0]; r[1] += k * v[1]; r[2] += k * v[2];
    }
    return r;
  }
  var X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1], O = [0, 0, 0];

  /* ---------- maillage ---------- */
  function Maillage() { this.v = []; this.pieces = []; this.piece = -1; this.plus = 0; }
  /* surface paramétrique : f(u, w) -> [point, normale] avec u, w entre 0 et 1 */
  Maillage.prototype.grille = function (nu, nw, f, mat) {
    var v = this.v, plus = this.plus, lignes = [], i, j;
    for (i = 0; i <= nu; i++) {
      var l = [];
      for (j = 0; j <= nw; j++) l.push(f(i / nu, j / nw));
      lignes.push(l);
    }
    function s(q) { v.push(q[0][0], q[0][1], q[0][2], q[1][0], q[1][1], q[1][2], mat + plus); }
    for (i = 0; i < nu; i++) {
      for (j = 0; j < nw; j++) {
        var a = lignes[i][j], b = lignes[i + 1][j], c = lignes[i + 1][j + 1], d = lignes[i][j + 1];
        s(a); s(b); s(c); s(a); s(c); s(d);
        this.pieces.push(this.piece, this.piece);
      }
    }
  };

  /* Un tronçon : position(r, theta, s), normale(theta), et ses deux limites s selon (r, theta). */
  function droite(o, d, a, b, s0, s1) {
    return {
      pos: function (r, t, s) { return lin(1, o, s, d, r * Math.cos(t), a, r * Math.sin(t), b); },
      nrm: function (t) { return lin(Math.cos(t), a, Math.sin(t), b); },
      debut: function () { return s0; }, fin: function () { return s1; },
      nDebut: lin(-1, d), nFin: d
    };
  }
  function peau(m, T, r, mat, opt) {
    opt = opt || {};
    var t0 = opt.t0 === undefined ? 0 : opt.t0, t1 = opt.t1 === undefined ? TOUR : opt.t1;
    var de = opt.de || T.debut, a = opt.a || T.fin;
    var n = Math.max(2, Math.ceil(96 * (t1 - t0) / TOUR));
    m.grille(n, 1, function (u, w) {
      var t = t0 + (t1 - t0) * u, s0 = de(r, t), s = s0 + (a(r, t) - s0) * w;
      var nv = T.nrm(t);
      return [T.pos(r, t, s), opt.interieur ? lin(-1, nv) : nv];
    }, mat);
  }
  /* face d'extrémité entre deux rayons */
  function bout(m, T, r1, r2, cote, mat, t0, t1, saillie) {
    var normale = cote === 'debut' ? T.nDebut : T.nFin;
    t0 = t0 === undefined ? 0 : t0; t1 = t1 === undefined ? TOUR : t1;
    var n = Math.max(2, Math.ceil(96 * (t1 - t0) / TOUR));
    m.grille(n, 3, function (u, w) {
      var t = t0 + (t1 - t0) * u, r = r1 + (r2 - r1) * w;
      var p = T.pos(r, t, T[cote](r, t));
      return [saillie ? lin(1, p, saillie, normale) : p, normale];
    }, mat);
  }
  function coquille(m, T, ri, ro, opt) {
    opt = opt || {};
    var perce = opt.perce || 0;
    peau(m, T, ro, perce + (opt.mat === undefined ? M.laine : opt.mat));
    peau(m, T, ri, perce + M.creux, { interieur: true });
    var f = 0.7, e = 0.012;                       /* fente longitudinale de la coquille */
    peau(m, T, ro * 1.002, perce + M.creux, { t0: f - e, t1: f + e });
    ['debut', 'fin'].forEach(function (c) {
      if (opt[c] === false) return;
      bout(m, T, ri, ro, c, M.tranche);
      bout(m, T, ri, ro, c, M.creux, f - e, f + e, ro * 0.004);
    });
  }
  function acier(m, T, d) {
    var re = d, ri = d * 0.86;
    peau(m, T, re, M.acier); peau(m, T, ri, M.creux, { interieur: true });
    bout(m, T, ri, re, 'debut', M.acier); bout(m, T, ri, re, 'fin', M.acier);
  }
  /* trait de joint le long d'une limite */
  function lisere(m, T, r, cote, largeur) {
    var lim = T[cote], sens = cote === 'debut' ? 1 : -1;
    var autre = function (rr, t) { return lim(rr, t) + sens * largeur; };
    peau(m, T, r, M.joint, cote === 'debut' ? { de: lim, a: autre } : { de: autre, a: lim });
  }

  /* ---------- partie droite ---------- */
  function modeleDroit(p, opt) {
    var m = new Maillage();
    var ro = p.D / 2, ri = Math.min(p.coq / 2, ro * 0.98), rs = Math.min(p.d / 2, ri * 0.97);
    var L = p.D * 3.4, g = -L / 2, dr = L / 2, ext = ro * 0.9;
    var expo = opt.pvc ? ro * 0.75 : 0, finPVC = dr - expo, rp = ro * 1.014;
    acier(m, droite(O, X, Y, Z, g - ext, dr + ext), rs);
    coquille(m, droite(O, X, Y, Z, g, dr), ri, ro);
    var s1 = -L * 0.28, s2 = L * 0.14, t0 = 55 * RAD, dt = Math.min(2.4, p.recouv / ro);
    if (opt.pvc) {
      var T = droite(O, X, Y, Z, g - ro * 0.004, finPVC);
      peau(m, T, rp, M.pvc);
      bout(m, T, ro, rp * 1.008, 'debut', M.pvc); bout(m, T, ro, rp, 'fin', M.joint);
      [s1, s2].forEach(function (s) {
        var B = droite(O, X, Y, Z, s - ro * 0.12, s);
        peau(m, B, rp * 1.007, M.pvc);
        lisere(m, B, rp * 1.009, 'fin', ro * 0.018);
      });
      lisere(m, T, rp * 1.003, 'fin', ro * 0.02);
      if (dt > 0) {
        peau(m, T, rp * 1.005, M.collerette, { t0: t0, t1: t0 + dt });
        peau(m, T, rp * 1.008, M.joint, { t0: t0 + dt - 0.01, t1: t0 + dt + 0.01 });
      }
    }
    var pt = function (x, r, t) { return [x, r * Math.cos(t), r * Math.sin(t)]; };
    var xd = dr + ext * 1.25, T_ = p.textes;
    var cotes = [
      { a: [xd, -ro, 0], b: [xd, ro, 0], ea: [dr, -ro, 0], eb: [dr, ro, 0], texte: T_.diametre },
      { p: pt(dr, (ri + ro) / 2, 150 * RAD), vers: [0.5, -1, 0.3], n: X, texte: T_.laine }
    ];
    if (opt.pvc) {
      cotes.push({ a: [s1, ro * 1.45, 0], b: [s2, ro * 1.45, 0], ea: [s1, rp, 0], eb: [s2, rp, 0], texte: T_.virole });
      cotes.push({ p: pt((s1 + s2) / 2, rp, 112 * RAD), vers: [-0.2, -1, 0.4], n: pt(0, 1, 112 * RAD), texte: T_.feuille });
      if (dt > 0) cotes.push({ p: pt(s1 - L * 0.1, rp, t0 + dt / 2), vers: [-0.8, 0.8, 0.5], n: pt(0, 1, t0 + dt / 2), texte: T_.recouv });
    }
    return { m: m, cotes: cotes, angles: [-0.62, 0.34] };
  }

  /* ---------- coude en secteurs ---------- */
  var CHOISI = 100;   /* ajouté au numéro de matière du morceau sélectionné */
  function modeleCoude(p, opt) {
    var c = p.c, m = new Maillage();
    var ro = c.D / 2, ri = Math.min(p.coq / 2, ro * 0.98), rs = Math.min(p.d / 2, ri * 0.97);
    var R = c.R, A = c.angle * RAD, b = c.beta * RAD, n = c.n + 2;
    var er = function (t) { return [Math.cos(t), Math.sin(t), 0]; };
    var et = function (t) { return [-Math.sin(t), Math.cos(t), 0]; };
    var ecart = opt.eclate ? ro * Math.max(0.8, 0.3 / Math.sin(b)) : 0;
    var Ls = Math.max(ro * 1.0, 35), ext = ro * 0.5, rp = ro * 1.014;

    function secteur(i) {
      var tau = 2 * i * b, p0 = i === 0 ? 0 : (2 * i - 1) * b, p1 = i === n - 1 ? A : (2 * i + 1) * b;
      var dec = lin(ecart, er(tau));
      var lim = function (psi) { return function (r, t) { return Math.max(0, R + r * Math.cos(t)) * Math.tan(psi - tau); }; };
      return {
        pos: function (r, t, s) { return lin(R + r * Math.cos(t), er(tau), s, et(tau), r * Math.sin(t), Z, 1, dec); },
        nrm: function (t) { return lin(Math.cos(t), er(tau), Math.sin(t), Z); },
        debut: lim(p0), fin: lim(p1), nDebut: lin(-1, et(p0)), nFin: et(p1), tau: tau
      };
    }
    function talon(fin, s0, s1) {
      var t = fin ? A : 0;
      var dec = lin(ecart, er(t), (fin ? 1 : -1) * ecart * 0.9, et(t));
      return droite(lin(R, er(t), 1, dec), et(t), er(t), Z, s0, s1);
    }

    /* tube acier : coude cintré puis deux bouts droits (retiré en vue éclatée) */
    if (!opt.eclate) {
      m.grille(64, 48, function (u, w) {
        var th = u * TOUR, t = w * A;
        return [lin(R + rs * Math.cos(th), er(t), rs * Math.sin(th), Z), lin(Math.cos(th), er(t), Math.sin(th), Z)];
      }, M.acier);
      acier(m, droite(lin(R, er(0)), et(0), er(0), Z, -Ls - ext, 0), rs);
      acier(m, droite(lin(R, er(A)), et(A), er(A), Z, 0, Ls + ext), rs);
    }

    /* bouts droits isolés */
    var expo = ro * 0.6;
    [0, 1].forEach(function (f) {
      var s0 = f ? 0 : -Ls, s1 = f ? Ls : 0;
      coquille(m, talon(f, s0, s1), ri, ro);
      if (opt.pvc) {
        var T = talon(f, f ? s0 : s0 + expo, f ? s1 - expo : s1);
        peau(m, T, rp * 1.012, M.pvc);
        bout(m, T, ro, rp * 1.012, 'debut', M.joint); bout(m, T, ro, rp * 1.012, 'fin', M.joint);
        lisere(m, T, rp * 1.016, f ? 'debut' : 'fin', ro * 0.03);
      }
    });

    /* secteurs */
    var secteurs = [];
    for (var i = 0; i < n; i++) {
      var T = secteur(i);
      secteurs.push(T);
      m.piece = i; m.plus = opt.choix === i ? CHOISI : 0;
      if (opt.pvc) {
        var r = rp * (1 + (i % 2) * 0.009);
        peau(m, T, r, M.pvc);
        lisere(m, T, r * 1.004, 'fin', ro * 0.028);
        if (i === 0) lisere(m, T, r * 1.004, 'debut', ro * 0.028);
        peau(m, T, r * 1.003, M.joint, { t0: Math.PI - 0.012, t1: Math.PI + 0.012 });
        if (opt.eclate) { coquille(m, T, ri, ro); bout(m, T, ro, r, 'debut', M.joint); bout(m, T, ro, r, 'fin', M.joint); }
      } else {
        coquille(m, T, ri, ro, { mat: i % 2 ? M.laine2 : M.laine, debut: opt.eclate, fin: opt.eclate });
        if (!opt.eclate) {
          if (i < n - 1) peau(m, T, ro * 1.004, M.creux, { de: (function (S) { return function (rr, t) { return S.fin(rr, t) - ro * 0.022; }; })(T), a: T.fin });
          /* trait entre la demi-section et la coquille droite, pour la distinguer et la toucher */
          if (i === n - 1) peau(m, T, ro * 1.004, M.creux, { de: (function (S) { return function (rr, t) { return S.fin(rr, t) - ro * 0.022; }; })(T), a: T.fin });
          if (i === 0) peau(m, T, ro * 1.004, M.creux, { de: T.debut, a: (function (S) { return function (rr, t) { return S.debut(rr, t) + ro * 0.022; }; })(T) });
        }
      }
    }

    m.piece = -1; m.plus = 0;

    var textes = p.textes, cotes = [], choisi = typeof opt.choix === 'number';
    var surf = opt.pvc ? rp * 1.01 : ro, ecartCote = ro * 0.3;
    secteurs.forEach(function (S, i) {
      if (choisi && opt.choix !== i) return;   /* un morceau choisi : lui seul est coté */
      [[0, 1, textes.dos[i]], [Math.PI, -1, textes.ventre[i]]].forEach(function (k) {
        var th = k[0], sens = k[1], dehors = lin(sens, er(S.tau));
        var s0 = S.debut(surf, th), s1 = S.fin(surf, th);
        var p0 = S.pos(surf, th, s0), p1 = S.pos(surf, th, s1);
        cotes.push({ a: lin(1, p0, ecartCote, dehors), b: lin(1, p1, ecartCote, dehors), ea: p0, eb: p1, pousse: dehors, colonne: !choisi && sens < 0, n: choisi ? null : S.nrm(th), texte: k[2] });
      });
    });
    var F = talon(1, 0, Ls), xf = Ls + ext * 1.3;
    cotes.push({ a: F.pos(ro, Math.PI, xf), b: F.pos(ro, 0, xf), ea: F.pos(ro, Math.PI, Ls), eb: F.pos(ro, 0, Ls), pousse: et(A), texte: textes.diametre });
    return { m: m, cotes: cotes, angles: [0, 0], marge: [0.37, 0.35] };
  }

  /* ---------- pénétrant ---------- */
  /* PERCE_PVC et PERCE_LAINE : surfaces du principal ajourées au droit du piquage (voir le nuanceur) */
  var PERCE_PVC = 20, PERCE_LAINE = 40;
  function modelePiquage(p, opt) {
    var q = p.p, m = new Maillage(), g = q.gamma * RAD, eclate = opt.eclate;
    var ro1 = q.r1, ro2 = q.r2;
    var ri1 = Math.min(p.coq1 / 2, ro1 * 0.98), rs1 = Math.min(p.d1 / 2, ri1 * 0.97);
    var ri2 = Math.min(p.coq2 / 2, ro2 * 0.98), rs2 = Math.min(p.d2 / 2, ri2 * 0.97);
    var rp1 = ro1 * 1.014, rp2 = ro2 * 1.014;
    var u = [Math.cos(g), Math.sin(g), 0], w = [Math.sin(g), -Math.cos(g), 0];
    var coupe = function (R) { return function (r, t) { return C.distancePiquage(R, Math.min(r, R), q.gamma, t / RAD); }; };
    var tMax = 0;
    for (var a = 0; a <= 360; a += 5) tMax = Math.max(tMax, C.distancePiquage(ro1, ro2, q.gamma, a));
    var tFin = tMax + Math.max(q.D2 * 1.15, 60);
    var x0 = Math.min(-ro1 * 1.6, q.trouXMin - ro1 * 0.8);
    var x1 = Math.max(ro1 * 1.7, q.trouXMax + ro1 * 0.95);
    var ext1 = ro1 * 0.7, ext2 = ro2 * 0.9;
    /* en vue éclatée, le piquage est sorti le long de son axe */
    var sortie = eclate ? Math.max(ro1 * 0.95, ro2 * 1.6) : 0, dec = lin(sortie, u);

    function branche(R, s1) {
      return {
        pos: function (r, t, s) { return lin(s, u, r * Math.cos(t), w, r * Math.sin(t), Z, 1, dec); },
        nrm: function (t) { return lin(Math.cos(t), w, Math.sin(t), Z); },
        debut: coupe(R), fin: function () { return s1; }, nDebut: lin(-1, u), nFin: u
      };
    }
    /* point du principal (rayon R) sur la trace d'un piquage de rayon r2 */
    var surPrincipal = function (R, r2, phi) {
      var pt = C.pointTrou(R, Math.min(r2, R), q.gamma, phi), al = pt.s / R;
      return [[pt.x, R * Math.cos(al), R * Math.sin(al)], [0, Math.cos(al), Math.sin(al)]];
    };
    var trace = function (R, r2, large, mat) {
      m.grille(160, 1, function (i, j) { return surPrincipal(R, r2 + large * j, i * 360); }, mat);
    };

    if (!eclate) {
      acier(m, droite(O, X, Y, Z, x0 - ext1, x1 + ext1), rs1);
      acier(m, droite(O, u, w, Z, 0, tFin + ext2), rs2);
    }
    coquille(m, droite(O, X, Y, Z, x0, x1), ri1, ro1, { perce: eclate ? PERCE_LAINE : 0 });
    var B = branche(ro1, tFin);
    peau(m, B, ro2, M.laine2); peau(m, B, ri2, M.creux, { interieur: true }); bout(m, B, ri2, ro2, 'fin', M.tranche);
    if (eclate) bout(m, B, ri2, ro2, 'debut', M.tranche);

    if (opt.pvc) {
      var P = droite(O, X, Y, Z, x0 - ro1 * 0.004, x1 - ro1 * 0.5);
      peau(m, P, rp1, (eclate ? PERCE_PVC : 0) + M.pvc);
      bout(m, P, ro1, rp1, 'debut', M.joint); bout(m, P, ro1, rp1, 'fin', M.joint);
      lisere(m, P, rp1 * 1.003, 'fin', ro1 * 0.025);
      var g0 = (p.fermeturePrincipal || 0) * RAD, dg = Math.min(2.4, (p.recouv || 0) / ro1), perce = eclate ? PERCE_PVC : 0;
      if (dg > 0) peau(m, P, rp1 * 1.004, perce + M.collerette, { t0: g0, t1: g0 + dg });
      peau(m, P, rp1 * 1.007, perce + M.joint, { t0: g0 + dg - 0.012, t1: g0 + dg + 0.012 });
      var Q = branche(rp1, tFin - ro2 * 0.55);
      peau(m, Q, rp2, M.pvc);
      bout(m, Q, ro2, rp2, 'fin', M.joint);
      lisere(m, Q, rp2 * 1.004, 'fin', ro2 * 0.03);
      peau(m, Q, rp2 * 1.006, M.joint, { de: Q.debut, a: function (r, t) { return Q.debut(r, t) + ro2 * 0.035; } });
      /* fermeture longitudinale à l'angle choisi : bande de recouvrement et son bord */
      var f0 = (p.fermeture || 0) * RAD, df = Math.min(2.4, (p.recouv || 0) / ro2);
      if (df > 0) peau(m, Q, rp2 * 1.008, M.collerette, { t0: f0, t1: f0 + df });
      peau(m, Q, rp2 * 1.012, M.joint, { t0: f0 + df - 0.018, t1: f0 + df + 0.018 });
      if (eclate) { bout(m, Q, ro2, rp2, 'debut', M.joint); trace(rp1 * 1.003, rp2, ro2 * 0.035, M.joint); }
    } else {
      peau(m, B, ro2 * 1.004, M.creux, { de: B.debut, a: function (r, t) { return B.debut(r, t) + ro2 * 0.035; } });
      if (eclate) trace(ro1 * 1.004, ro2, ro2 * 0.035, M.creux);
    }

    var T = p.textes, d1 = x1 + (eclate ? ro1 * 0.35 : ext1 * 1.35), c = lin(tFin + (eclate ? ro2 * 0.45 : ext2 * 1.35), u, 1, dec);
    var surB = opt.pvc ? rp2 : ro2, surP = opt.pvc ? rp1 : ro1;
    var cotes = [
      { a: [d1, -ro1, 0], b: [d1, ro1, 0], ea: [x1, -ro1, 0], eb: [x1, ro1, 0], texte: T.principal },
      { a: lin(1, c, -ro2, w), b: lin(1, c, ro2, w), ea: lin(tFin, u, -ro2, w, 1, dec), eb: lin(tFin, u, ro2, w, 1, dec), texte: T.piquage },
      { p: B.pos(surB, p.fond * RAD, coupe(surP)(surB, p.fond * RAD)), vers: [-1, 0.25, 0.4], n: B.nrm(p.fond * RAD), texte: T.gueule }
    ];
    if (opt.pvc && T.fermeture) {
      var fm = (p.fermeture || 0) * RAD + Math.min(2.4, (p.recouv || 0) / ro2), Qf = branche(rp1, tFin - ro2 * 0.55);
      var bas = Qf.debut(rp2, fm), haut = Qf.fin(rp2, fm);
      cotes.push({ p: Qf.pos(rp2 * 1.012, fm, bas + (haut - bas) * 0.62), vers: [0.9, 0.45, 0.2], n: Qf.nrm(fm), texte: T.fermeture });
    }
    if (opt.pvc && T.fermeturePrincipal) {
      var gm = (p.fermeturePrincipal || 0) * RAD + Math.min(2.4, (p.recouv || 0) / ro1), nm = [0, Math.cos(gm), Math.sin(gm)];
      cotes.push({ p: [x0 + (x1 - x0) * 0.2, rp1 * 1.007 * nm[1], rp1 * 1.007 * nm[2]], vers: [-0.5, -1, 0.3], n: nm, texte: T.fermeturePrincipal });
    }
    if (eclate && opt.pvc) {
      var h = surPrincipal(rp1, rp2, 115);
      cotes.push({ p: h[0], vers: [-0.6, -1, 0.4], n: h[1], texte: T.trou });
    }
    return { m: m, cotes: cotes, angles: [-0.55, 0.38], axe: u, trous: [rp2, ri2] };
  }

  /* ---------- rendu ---------- */
  var VS = 'attribute vec3 p; attribute vec3 n; attribute float m; uniform mat3 R; uniform vec3 c; uniform vec3 e; uniform vec2 d;' +
    'varying vec3 vN; varying vec3 vO; varying vec3 vP; varying float vM;' +
    'void main(){ vO = n; vec3 q = R*(p-c); gl_Position = vec4(q.x*e.x + d.x, q.y*e.y + d.y, -q.z*e.z, 1.0); vN = R*n; vP = p; vM = m; }';
  var FS = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n' +
    'varying vec3 vN; varying vec3 vO; varying vec3 vP; varying float vM; uniform vec3 axe; uniform vec2 trou; uniform sampler2D laine; uniform float tuile;' +
    'void main(){' +
    ' vec3 n = normalize(vN); if (n.z < 0.0) n = -n;' +
    ' vec3 col; float brillance = 0.0, durete = 30.0;' +
    ' vec3 q = vP / tuile; vec3 p3 = pow(abs(normalize(vO)), vec3(4.0)); p3 /= p3.x + p3.y + p3.z;' +
    ' vec3 fibre = texture2D(laine, q.zy).rgb*p3.x + texture2D(laine, q.xz).rgb*p3.y + texture2D(laine, q.xy).rgb*p3.z;' +
    ' float ambiante = 0.40, directe = 0.62;' +
    ' int mt = int(vM + 0.5);' +
    ' bool choisi = false; if (mt >= 100) { choisi = true; mt -= 100; }' +
    ' if (mt >= 20) {' +
    '  float rayonTrou = mt >= 40 ? trou.y : trou.x; mt = mt >= 40 ? mt - 40 : mt - 20;' +
    '  float t = dot(vP, axe);' +
    '  if (t > 0.0 && length(vP - t*axe) < rayonTrou) discard;' +
    ' }' +
    /* laine de roche : teinte unie vert olive, sans motif */
    ' if (mt == 0 || mt == 1 || mt == 7) {' +
    '  col = fibre; ambiante = 0.56; directe = 0.52;' +
    '  if (mt == 1) col *= 1.10; if (mt == 7) col *= 0.91;' +
    ' } else if (mt == 2) { col = vec3(0.77,0.79,0.82); brillance = 0.13; durete = 16.0; ambiante = 0.47; directe = 0.52; }' +
    ' else if (mt == 6) { col = vec3(0.70,0.73,0.77); brillance = 0.11; durete = 16.0; ambiante = 0.47; directe = 0.52; }' +
    /* tôle : métal clair, reflets larges et léger brossé */
    ' else if (mt == 8 || mt == 9) { col = mt == 8 ? vec3(0.70,0.73,0.76) : vec3(0.63,0.67,0.71); col *= 0.96 + 0.07*texture2D(laine, vP.xy/(tuile*3.0) + vP.zz/(tuile*5.0)).g; brillance = 0.58; durete = 12.0; ambiante = 0.42; directe = 0.50; }' +
    ' else if (mt == 3) { col = vec3(0.50,0.53,0.58); brillance = 0.15; }' +
    ' else if (mt == 4) { col = vec3(0.45,0.50,0.57); brillance = 0.55; durete = 22.0; }' +
    ' else { col = fibre*0.30; }' +
    ' vec3 l = normalize(vec3(-0.35, 0.65, 0.68));' +
    ' float d = max(dot(n,l), 0.0), d2 = max(dot(n, normalize(vec3(0.75,-0.25,0.5))), 0.0);' +
    ' vec3 res = col*(ambiante + directe*d + 0.16*d2);' +
    ' vec3 mi = normalize(l + vec3(0,0,1));' +
    ' res += brillance*(pow(max(dot(n,mi),0.0), durete) + 0.18*pow(max(dot(n,mi),0.0), 5.0));' +
    ' res *= 0.86 + 0.14*smoothstep(0.0, 0.55, n.z);' +
    ' if (choisi) res = mix(res, vec3(1.0, 0.52, 0.04), 0.46);' +
    ' gl_FragColor = vec4(res, 1.0); }';

  function rotation(lacet, tangage) {
    var cy = Math.cos(lacet), sy = Math.sin(lacet), cx = Math.cos(tangage), sx = Math.sin(tangage);
    return [[cy, 0, sy], [sx * sy, cx, -sx * cy], [-cx * sy, sx, cx * cy]];   /* tangage appliqué après le lacet */
  }
  function tourner(R, v) {
    return [R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2], R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2], R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2]];
  }

  function etiquettes(vue, modele, R, centre, ech, W, H, pan) {
    var boites = [[W - 90, 0, 90, 50]], sortie = '';   /* le coin du bouton clair / sombre reste libre */
    function proj(p) { var q = tourner(R, lin(1, p, -1, centre)); return [W / 2 + pan[0] + q[0] * ech, H / 2 + pan[1] - q[1] * ech]; }
    function dehorsDuCadre(P) { return P[0] < -10 || P[0] > W + 10 || P[1] < -10 || P[1] > H + 10; }
    function largeur(texte) { return texte.length * 6.5 + 14; }
    function placer(x, y, texte) {
      var w = largeur(texte), h = 22;
      var bx = Math.max(3, Math.min(W - w - 3, x - w / 2));
      var essais = [0, 25, -25, 50, -50, 75, -75, 100, -100], by = 0;
      for (var i = 0; i < essais.length; i++) {
        by = Math.max(3, Math.min(H - h - 3, y - h / 2 + essais[i]));
        var libre = boites.every(function (b) { return bx + w < b[0] || bx > b[0] + b[2] || by + h < b[1] || by > b[1] + b[3]; });
        if (libre) break;
      }
      boites.push([bx, by, w, h]);
      return { cx: bx + w / 2, cy: by + h / 2, svg: '<rect class="pastille" x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h + '" rx="7"/><text class="pt" x="' + (bx + w / 2).toFixed(1) + '" y="' + (by + 15).toFixed(1) + '" text-anchor="middle">' + texte + '</text>' };
    }
    var f = function (v) { return v[0].toFixed(1) + ' ' + v[1].toFixed(1); };
    var pastilles = '', rangees = [];
    modele.cotes.forEach(function (c) {
      if (c.n && tourner(R, c.n)[2] < -0.4) return;   /* face tournée vers l'arrière */
      if (c.a) {
        var A = proj(c.a), B = proj(c.b), mi = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
        if (dehorsDuCadre(mi)) return;
        var dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy) || 1, t = Math.min(7, l / 3), ux = dx / l * t, uy = dy / l * t;
        sortie += '<path class="rappel" d="M' + f(proj(c.ea)) + 'L' + f(A) + 'M' + f(proj(c.eb)) + 'L' + f(B) + '"/>' +
          '<path class="mesure" d="M' + f(A) + 'L' + f(B) +
          'M' + f([A[0] + ux - uy * 0.6, A[1] + uy + ux * 0.6]) + 'L' + f(A) + 'L' + f([A[0] + ux + uy * 0.6, A[1] + uy - ux * 0.6]) +
          'M' + f([B[0] - ux - uy * 0.6, B[1] - uy + ux * 0.6]) + 'L' + f(B) + 'L' + f([B[0] - ux + uy * 0.6, B[1] - uy - ux * 0.6]) + '"/>';
        if (c.colonne) { rangees.push({ mi: mi, texte: c.texte }); return; }
        var cx = mi[0], cy = mi[1];
        if (c.pousse) {
          var q = tourner(R, c.pousse), qx = q[0], qy = -q[1], nq = Math.hypot(qx, qy);
          if (nq > 0.15) { qx /= nq; qy /= nq; var recul = Math.abs(qx) * largeur(c.texte) / 2 + Math.abs(qy) * 11 + 5; cx += qx * recul; cy += qy * recul; }
        }
        var pl = placer(cx, cy, c.texte);
        if (Math.hypot(pl.cx - cx, pl.cy - cy) > 14) sortie += '<path class="rappel" d="M' + f(mi) + 'L' + f([pl.cx, pl.cy]) + '"/>';
        pastilles += pl.svg;
      } else {
        var P = proj(c.p), v = tourner(R, c.vers), vx = v[0], vy = -v[1], n = Math.hypot(vx, vy);
        if (dehorsDuCadre(P)) return;
        if (n < 0.2) { vx = 0; vy = -1; n = 1; }
        var dist = W < 500 ? 42 : 66;
        var b = placer(P[0] + vx / n * dist * 1.25, P[1] + vy / n * dist, c.texte);
        sortie += '<path class="mesure" d="M' + f(P) + 'L' + f([b.cx, b.cy]) + '"/><circle class="point" cx="' + P[0].toFixed(1) + '" cy="' + P[1].toFixed(1) + '" r="3.5"/>';
        pastilles += b.svg;
      }
    });
    if (rangees.length) {
      rangees.sort(function (a, b) { return a.mi[1] - b.mi[1] || a.mi[0] - b.mi[0]; });
      var gauche = Math.min.apply(null, rangees.map(function (q) { return q.mi[0]; }));
      var plusBas = Math.max.apply(null, rangees.map(function (q) { return q.mi[1]; }));
      var pas = 25, x = gauche - (W < 500 ? 46 : 80), y = Math.min(plusBas + 24, H - rangees.length * pas - 4);
      rangees.forEach(function (q, i) {
        var pl = placer(x, y + i * pas + 11, q.texte);
        sortie += '<path class="rappel" d="M' + f(q.mi) + 'L' + f([pl.cx, pl.cy]) + '"/>';
        pastilles += pl.svg;
      });
    }
    vue.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    vue.innerHTML = sortie + pastilles;
  }

  /* ---------- ensemble : les pièces d'un relevé, à la suite ----------
     opt.pvc = habillage affiché (PVC ou tôle selon le relevé) ; sinon la laine seule. */
  function plus3(a, b, k) { return [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]]; }
  function croix(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function unite(a) { var n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; }
  function repere(d) {
    var u = plus3(Y, d, -d[1]);
    if (Math.hypot(u[0], u[1], u[2]) < 0.2) u = plus3([0, 0, -1], d, d[2]);
    u = unite(u);
    return [u, croix(d, u)];
  }

  function modeleEnsemble(p, opt) {
    var m = new Maillage(), geo = p.geo, segs = geo.segments, hab = opt.pvc;
    var mat = p.tole ? M.tole : M.pvc, mat2 = p.tole ? M.tole2 : M.pvc, bande = p.tole ? M.tole2 : M.collerette;
    var cotes = [], dernier = segs.length - 1;
    var eclat = 0;
    function rayons(sec) {
      var ro = sec.D / 2, ri = Math.min(sec.coq / 2, ro * 0.98);
      return { ro: ro, ri: ri, rs: Math.min(sec.d / 2, ri * 0.97), rp: ro * 1.016 };
    }
    /* trait de fermeture : bande de recouvrement et son bord, à l'angle theta (radians) */
    function fermetures(T, r, ferm, vrai) {
      if (!ferm || !hab) return;
      for (var k = 0; k < ferm.faces; k++) {
        var th = ferm.theta * RAD + k * Math.PI, large = Math.min(0.5, vrai / r);
        peau(m, T, r * 1.006, bande, { t0: th, t1: th + large });
        peau(m, T, r * 1.012, M.joint, { t0: th + large - 0.02, t1: th + large + 0.02 });
        peau(m, T, r * 1.012, M.joint, { t0: th - 0.012, t1: th + 0.012 });
      }
    }
    /* partie droite habillée ou nue entre deux points */
    function trongon(o, d, L, sec, ferm, viroles) {
      var q = rayons(sec), f = repere(d), T = droite(o, d, f[0], f[1], 0, L);
      if (hab) {
        peau(m, T, q.rp, mat);
        bout(m, T, q.ro, q.rp * 1.004, 'debut', M.joint); bout(m, T, q.ro, q.rp * 1.004, 'fin', M.joint);
        lisere(m, T, q.rp * 1.004, 'fin', q.ro * 0.035);
        (viroles || []).forEach(function (x) {
          var B = droite(o, d, f[0], f[1], x - q.ro * 0.1, x);
          peau(m, B, q.rp * 1.008, mat2); lisere(m, B, q.rp * 1.012, 'fin', q.ro * 0.03);
        });
        fermetures(T, q.rp, ferm, p.recouv);
      } else {
        coquille(m, T, q.ri, q.ro, { debut: false, fin: false });
        peau(m, T, q.ro * 1.004, M.creux, { de: function () { return L - q.ro * 0.025; }, a: T.fin });
      }
      return T;
    }
    function acierDroit(o, d, a, b, sec) { var f = repere(d); acier(m, droite(o, d, f[0], f[1], a, b), rayons(sec).rs); }
    function extremite(o, d, sec, cote) {   /* tranche de laine visible à un bout libre */
      var q = rayons(sec), f = repere(d), T = droite(o, d, f[0], f[1], 0, 0);
      bout(m, T, q.ri, q.ro, cote, M.tranche);
    }

    segs.forEach(function (g, i) {
      var q = rayons(g.s), choisi = opt.choix === i;
      m.piece = i; m.plus = choisi ? CHOISI : 0;
      var dec = opt.eclate ? [g.d0[0] * eclat, g.d0[1] * eclat, g.d0[2] * eclat] : O;
      if (opt.eclate) eclat += q.ro * 1.1;
      var p0 = plus3(g.p0, dec, 1), milieu, normale;

      if (g.type === 'droit') {
        var vir = [], nb = Math.max(1, Math.ceil((g.L - 0.01) / Math.max(1, p.largeur - p.recouv)));
        if (nb > 1 && nb <= 40) for (var k = 1; k < nb; k++) vir.push(g.Lv * k / nb);
        trongon(p0, g.d0, g.Lv, g.s, g.ferm, vir);
        if (!opt.eclate) acierDroit(p0, g.d0, 0, g.Lv, g.s);
        var f = repere(g.d0);
        milieu = plus3(plus3(p0, g.d0, g.Lv / 2), f[0], q.rp); normale = f[0];
      } else if (g.type === 'coude') {
        var A = g.q.angle * RAD, n = g.q.sections + 2, b = A / (2 * (g.q.sections + 1)), R = g.R;
        var ex = [-g.n[0], -g.n[1], -g.n[2]], ey = g.d0, ez = croix(ex, ey), centre = plus3(g.centre, dec, 1);
        var monde = function (v) { return [v[0] * ex[0] + v[1] * ey[0] + v[2] * ez[0], v[0] * ex[1] + v[1] * ey[1] + v[2] * ez[1], v[0] * ex[2] + v[1] * ey[2] + v[2] * ez[2]]; };
        var er = function (t) { return [Math.cos(t), Math.sin(t), 0]; }, et = function (t) { return [-Math.sin(t), Math.cos(t), 0]; };
        var secteur = function (j) {
          var tau = 2 * j * b, a0 = j === 0 ? 0 : (2 * j - 1) * b, a1 = j === n - 1 ? A : (2 * j + 1) * b;
          var ecart = opt.eclate ? lin(q.ro * 0.35, er(tau)) : O;
          var lim = function (psi) { return function (r, t) { return Math.max(0, R + r * Math.cos(t)) * Math.tan(psi - tau); }; };
          return {
            pos: function (r, t, s) { return plus3(centre, monde(lin(R + r * Math.cos(t), er(tau), s, et(tau), r * Math.sin(t), Z, 1, ecart)), 1); },
            nrm: function (t) { return monde(lin(Math.cos(t), er(tau), Math.sin(t), Z)); },
            debut: lim(a0), fin: lim(a1), nDebut: monde(lin(-1, et(a0))), nFin: monde(et(a1))
          };
        };
        if (!opt.eclate) {
          m.grille(48, Math.max(8, Math.round(g.q.angle / 3)), function (u, w) {
            var th = u * TOUR, t = w * A;
            return [plus3(centre, monde(lin(R + q.rs * Math.cos(th), er(t), q.rs * Math.sin(th), Z)), 1), monde(lin(Math.cos(th), er(t), Math.sin(th), Z))];
          }, M.acier);
        }
        for (var j = 0; j < n; j++) {
          var S = secteur(j);
          if (hab) {
            var rr = q.rp * (1 + (j % 2) * 0.008);
            peau(m, S, rr, j % 2 ? mat2 : mat);
            lisere(m, S, rr * 1.004, 'fin', q.ro * 0.035);
            if (j === 0) lisere(m, S, rr * 1.004, 'debut', q.ro * 0.035);
            fermetures(S, rr, g.ferm, p.recouv);
            if (opt.eclate) { bout(m, S, q.ro, rr, 'debut', M.joint); bout(m, S, q.ro, rr, 'fin', M.joint); coquille(m, S, q.ri, q.ro); }
          } else {
            coquille(m, S, q.ri, q.ro, { mat: j % 2 ? M.laine2 : M.laine, debut: opt.eclate, fin: opt.eclate });
            if (!opt.eclate) peau(m, S, q.ro * 1.004, M.creux, { de: (function (T) { return function (x, t) { return T.fin(x, t) - q.ro * 0.025; }; })(S), a: S.fin });
          }
        }
        var dos = monde(er(A / 2));
        milieu = plus3(centre, dos, R + q.rp); normale = dos;
        if (opt.detail && p.secteurs && p.secteurs[i]) {
          var surf = hab ? q.rp * 1.01 : q.ro, recul = q.ro * 0.3, txt = p.secteurs[i];
          for (var jj = 0; jj < n; jj++) {
            var Sj = secteur(jj), tau = 2 * jj * b;
            [[0, 1, txt.dos[jj]], [Math.PI, -1, txt.ventre[jj]]].forEach(function (k) {
              var dehors = monde(lin(k[1], er(tau)));
              var a0 = Sj.pos(surf, k[0], Sj.debut(surf, k[0])), a1 = Sj.pos(surf, k[0], Sj.fin(surf, k[0]));
              cotes.push({ a: plus3(a0, dehors, recul), b: plus3(a1, dehors, recul), ea: a0, eb: a1, pousse: dehors, colonne: k[1] < 0, texte: k[2] });
            });
          }
        }
      } else if (g.type === 'te') {
        trongon(p0, g.d0, g.Lv, g.s, g.ferm, []);
        if (!opt.eclate) acierDroit(p0, g.d0, 0, g.Lv, g.s);
        var posV = g.Lv * g.pos / g.L, croisement = plus3(p0, g.d0, posV);
        var br = rayons(g.branche), gam = g.q.angle * RAD, d = g.d0, nb2 = g.n;
        var axe = unite(plus3([d[0] * Math.cos(gam), d[1] * Math.cos(gam), d[2] * Math.cos(gam)], nb2, Math.sin(gam)));
        var w = unite(plus3([d[0] * Math.sin(gam), d[1] * Math.sin(gam), d[2] * Math.sin(gam)], nb2, -Math.cos(gam))), z = croix(d, nb2);
        var r2 = Math.min(br.ro, q.ro), depart = function (R1) { return function (r, t) { return C.distancePiquage(R1, Math.min(r, R1), g.q.angle, t / RAD); }; };
        var sortie = opt.eclate ? q.ro * 0.8 : 0;
        var longB = Math.max(g.q.longueurB * g.Lv / g.L, C.distancePiquage(q.ro, r2, g.q.angle, 0) + br.ro * 0.8);
        var branche = function (R1) {
          return {
            pos: function (r, t, s) { return lin(1, croisement, s + sortie, axe, r * Math.cos(t), w, r * Math.sin(t), z); },
            nrm: function (t) { return lin(Math.cos(t), w, Math.sin(t), z); },
            debut: depart(R1), fin: function () { return longB; }, nDebut: lin(-1, axe), nFin: axe
          };
        };
        if (!opt.eclate) acier(m, droite(croisement, axe, w, z, 0, longB + br.ro * 0.6), br.rs);
        if (hab) {
          var Bp = branche(q.rp), rp2 = r2 * 1.016;
          peau(m, Bp, rp2, mat);
          bout(m, Bp, r2, rp2, 'fin', M.joint);
          peau(m, Bp, rp2 * 1.008, M.joint, { de: Bp.debut, a: function (r, t) { return Bp.debut(r, t) + br.ro * 0.05; } });
          peau(m, Bp, rp2 * 1.01, M.joint, { t0: Math.PI - 0.015, t1: Math.PI + 0.015 });
          bout(m, branche(q.ro), br.ri, r2, 'fin', M.tranche);
        } else {
          var Bl = branche(q.ro);
          peau(m, Bl, r2, M.laine2); bout(m, Bl, br.ri, r2, 'fin', M.tranche);
          peau(m, Bl, r2 * 1.004, M.creux, { de: Bl.debut, a: function (r, t) { return Bl.debut(r, t) + br.ro * 0.05; } });
        }
        milieu = lin(1, croisement, longB * 0.75 + sortie, axe, r2, w); normale = w;
      } else if (g.type === 'reduction') {
        var q2 = rayons(g.s2), dd = g.d0, f2 = repere(dd), L = g.Lv, dc = g.decalage;
        var cone = function (ra, rb, matiere, dedans) {
          m.grille(96, 2, function (u, v) {
            var t = u * TOUR, r = ra + (rb - ra) * v, dir = lin(Math.cos(t), f2[0], Math.sin(t), f2[1]);
            var c = lin(1, p0, v * L, dd, v, dc);
            var nn = unite(lin(1, dir, (ra - rb) / L, dd));
            return [plus3(c, dir, r), dedans ? lin(-1, nn) : nn];
          }, matiere);
        };
        cone(hab ? q.rp : q.ro, hab ? q2.rp : q2.ro, hab ? mat2 : M.laine);
        cone(q.ri, q2.ri, M.creux, true);
        if (hab && g.ferm) for (var h = 0; h < g.ferm.faces; h++) {
          (function (th) {
            m.grille(1, 1, function (u, v) {
              var t = th - 0.015 + 0.03 * u, r = (q.rp + (q2.rp - q.rp) * v) * 1.012, dir = lin(Math.cos(t), f2[0], Math.sin(t), f2[1]);
              return [plus3(lin(1, p0, v * L, dd, v, dc), dir, r), dir];
            }, M.joint);
          })(g.ferm.theta * RAD + h * Math.PI);
        }
        if (!opt.eclate) cone(q.rs, q2.rs, M.acier);
        milieu = lin(1, p0, L / 2, dd, 0.5, dc, (q.rp + q2.rp) / 2, f2[0]); normale = f2[0];
      } else if (g.type === 'fond') {
        var f3 = repere(g.d0), bombe = g.q.forme === 'bombe', haut = bombe ? q.ro * 0.45 : q.ro * 0.1;
        var bord = droite(p0, g.d0, f3[0], f3[1], -q.ro * 0.12, 0);
        peau(m, bord, q.rp * 1.03, hab ? mat2 : M.laine2); lisere(m, bord, q.rp * 1.036, 'debut', q.ro * 0.03);
        m.grille(96, bombe ? 10 : 1, function (u, v) {
          var t = u * TOUR, dir = lin(Math.cos(t), f3[0], Math.sin(t), f3[1]);
          if (!bombe) return [lin(1, p0, haut * 0, g.d0, q.rp * 1.03 * v, dir), g.d0];
          var a = v * Math.PI / 2, r = q.rp * 1.03 * Math.cos(a), x = haut * Math.sin(a);
          return [lin(1, p0, x, g.d0, r, dir), unite(lin(Math.cos(a) / q.rp, dir, Math.sin(a) / haut, g.d0))];
        }, hab ? mat : M.laine);
        milieu = lin(1, p0, haut, g.d0, q.ro * 0.6, f3[0]); normale = g.d0;
      } else {
        var f4 = repere(g.d0), u4 = f4[0], v4 = f4[1], demiL = g.l / 2, demiH = g.h / 2;
        var face = function (n4, a4, b4, dist, da, db, matiere) {
          var c = plus3(plus3(p0, g.d0, g.Lv / 2), n4, dist);
          m.grille(1, 1, function (s, t) { return [lin(1, c, (s - 0.5) * 2 * da, a4, (t - 0.5) * 2 * db, b4), n4]; }, matiere);
        };
        var mb = hab ? mat : M.laine, mb2 = hab ? mat2 : M.laine2, moins = function (a) { return [-a[0], -a[1], -a[2]]; };
        face(u4, g.d0, v4, demiH, g.Lv / 2, demiL, mb); face(moins(u4), g.d0, v4, demiH, g.Lv / 2, demiL, mb);
        face(v4, g.d0, u4, demiL, g.Lv / 2, demiH, mb2); face(moins(v4), g.d0, u4, demiL, g.Lv / 2, demiH, mb2);
        face(g.d0, u4, v4, g.Lv / 2, demiH, demiL, mb); face(moins(g.d0), u4, v4, g.Lv / 2, demiH, demiL, mb);
        /* arêtes et trait de fermeture */
        [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (k) {
          var o = lin(1, p0, k[0] * demiH, u4, k[1] * demiL, v4), e = droite(o, g.d0, u4, v4, 0, g.Lv);
          peau(m, e, q.ro * 0.018, M.joint);
        });
        if (hab && g.ferm) for (var h2 = 0; h2 < g.ferm.faces; h2++) {
          var th = g.ferm.theta * RAD + h2 * Math.PI, cs = Math.cos(th), sn = Math.sin(th);
          var surU = Math.abs(cs) >= Math.abs(sn), nf = surU ? lin(cs > 0 ? 1 : -1, u4) : lin(sn > 0 ? 1 : -1, v4);
          face(nf, g.d0, surU ? v4 : u4, (surU ? demiH : demiL) + q.ro * 0.012, g.Lv / 2, q.ro * 0.025, M.joint);
        }
        if (!opt.eclate) acierDroit(p0, g.d0, -q.ro * 0.3, g.Lv + q.ro * 0.3, g.s);
        milieu = lin(1, p0, g.Lv / 2, g.d0, demiH, u4); normale = u4;
      }

      var texte = (i + 1) + ' · ' + p.etiquettes[i];
      if (opt.detail && g.type === 'droit') {
        var fd = repere(g.d0), haut = fd[0], da = plus3(p0, haut, q.ro * 1.45), db = plus3(plus3(p0, g.d0, g.Lv), haut, q.ro * 1.45);
        cotes.push({ a: da, b: db, ea: plus3(p0, haut, q.rp), eb: plus3(plus3(p0, g.d0, g.Lv), haut, q.rp), pousse: haut, texte: p.etiquettes[i] });
      }
      if (!(opt.detail && (g.type === 'coude' || g.type === 'droit')) && (opt.choix === null || opt.choix === undefined || choisi)) {
        cotes.push({ p: milieu, vers: unite(lin(1, normale, 0.55, Y)), texte: choisi && g.ferm ? texte : (segs.length > 7 && !choisi ? String(i + 1) : texte) });
      }
      if ((choisi || opt.detail) && g.ferm && hab && g.type !== 'te' && g.type !== 'boite') {
        var pf, nf2;
        if (g.type === 'coude') {
          var A2 = g.q.angle * RAD / 2;
          var dm = lin(-Math.cos(A2), g.n, Math.sin(A2), g.d0), co = croix([-g.n[0], -g.n[1], -g.n[2]], g.d0);
          nf2 = lin(Math.cos(g.ferm.theta * RAD), dm, Math.sin(g.ferm.theta * RAD), co);
          pf = lin(1, g.centre, g.R, dm, q.rp * 1.02, nf2, 1, dec);
        } else {
          var fr = repere(g.d0);
          nf2 = lin(Math.cos(g.ferm.theta * RAD), fr[0], Math.sin(g.ferm.theta * RAD), fr[1]);
          pf = lin(1, p0, (g.Lv || 0) * 0.3, g.d0, q.rp * 1.02, nf2);
        }
        cotes.push({ p: pf, vers: unite(lin(1, nf2, opt.detail ? 0.35 : -0.7, Y)), n: nf2, texte: 'Fermeture' });
      }
    });

    /* bouts libres : tube qui dépasse et tranche de laine */
    m.piece = -1; m.plus = 0;
    if (dernier >= 0) {
      var a0 = segs[0], q0 = rayons(a0.s);
      if (!opt.eclate && a0.type !== 'fond') { extremite(a0.p0, a0.d0, a0.s, 'debut'); acierDroit(a0.p0, a0.d0, -q0.ro, 0, a0.s); }
      if (!opt.eclate && segs[dernier].type !== 'fond') { extremite(geo.p, geo.d, geo.s, 'fin'); acierDroit(geo.p, geo.d, 0, rayons(geo.s).ro, geo.s); }
    } else {
      var vide = p.vide, qv = rayons(vide);
      coquille(m, droite(O, X, Y, Z, -vide.D, vide.D), qv.ri, qv.ro); acier(m, droite(O, X, Y, Z, -vide.D * 1.4, vide.D * 1.4), qv.rs);
    }
    var D = segs.length ? segs[0].s.D : p.vide.D;
    if (opt.detail && segs.length) {   /* diamètre fini, au bout */
      var fin = segs[segs.length - 1].type === 'fond' ? segs[0] : null, o = fin ? fin.p0 : geo.p, dirF = fin ? fin.d0 : geo.d, rF = (fin ? fin.s.D : geo.s.D) / 2;
      var rf = repere(dirF), loin = lin(1, o, (fin ? -1 : 1) * rF * 1.25, dirF);
      cotes.push({ a: plus3(loin, rf[0], -rF), b: plus3(loin, rf[0], rF), ea: plus3(o, rf[0], -rF), eb: plus3(o, rf[0], rF), pousse: dirF, texte: 'Ø ' + p.diametre });
    }
    /* marge : les étiquettes restent au-dessus des boutons de zoom */
    return { m: m, cotes: cotes, angles: [-0.5, 0.42], marge: [0.41, 0.34], monte: 0.05, tuile: D * 1.4 };
  }

  function modeleBiblio(p, opt) {
    var tous = p.morceaux, nb = tous.length;
    if (!nb) return { m: new Maillage(), cotes: [], angles: [-0.32, 0.4], marge: [0.4, 0.36], tuile: 100 };
    var seul = typeof opt.choix === 'number' && tous[opt.choix] ? opt.choix : null;
    var liste = seul === null ? tous.map(function (x, i) { return i; }) : [seul];
    var sous = liste.map(function (i) {
      var x = modeleEnsemble(tous[i], { pvc: opt.pvc, eclate: opt.eclate, choix: null, detail: seul !== null });
      var v = x.m.v, min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
      for (var j = 0; j < v.length; j += 7) for (var k = 0; k < 3; k++) { if (v[j + k] < min[k]) min[k] = v[j + k]; if (v[j + k] > max[k]) max[k] = v[j + k]; }
      x.i = i; x.min = min; x.max = max;
      return x;
    });
    var taille = function (x) { return Math.max(x.max[0] - x.min[0], x.max[1] - x.min[1], x.max[2] - x.min[2]) || 1; };
    var reference = Math.max.apply(null, sous.map(taille));
    sous.forEach(function (x) {
      var k = reference / taille(x) * 0.92 + 0.08, v = x.m.v;
      for (var j = 0; j < v.length; j += 7) { v[j] *= k; v[j + 1] *= k; v[j + 2] *= k; }
      x.min = [x.min[0] * k, x.min[1] * k, x.min[2] * k]; x.max = [x.max[0] * k, x.max[1] * k, x.max[2] * k];
      x.k = k;
      x.cotes.forEach(function (c) { ['p', 'a', 'b', 'ea', 'eb'].forEach(function (n) { if (c[n]) c[n] = [c[n][0] * k, c[n][1] * k, c[n][2] * k]; }); });
    });
    var cw = Math.max.apply(null, sous.map(function (x) { return x.max[0] - x.min[0]; })) * 1.22;
    var ch = Math.max.apply(null, sous.map(function (x) { return x.max[1] - x.min[1] + (x.max[2] - x.min[2]) * 0.35; })) * 1.3;
    var cols = Math.ceil(Math.sqrt(sous.length * Math.max(0.35, Math.min(2.5, ch / cw))));
    cols = Math.max(1, Math.min(sous.length, cols));
    var ligs = Math.ceil(sous.length / cols), M_ = new Maillage(), cotes = [];
    sous.forEach(function (x, n) {
      var cible = [(n % cols - (cols - 1) / 2) * cw, ((ligs - 1) / 2 - Math.floor(n / cols)) * ch, 0];
      var t = [0, 1, 2].map(function (k) { return cible[k] - (x.min[k] + x.max[k]) / 2; });
      var v = x.m.v;
      for (var j = 0; j < v.length; j += 7) M_.v.push(v[j] + t[0], v[j + 1] + t[1], v[j + 2] + t[2], v[j + 3], v[j + 4], v[j + 5], v[j + 6]);
      for (var q = 0; q < x.m.pieces.length; q++) M_.pieces.push(x.i);
      if (seul === null) {
        cotes.push({ p: [cible[0], cible[1] + (x.max[1] - x.min[1]) / 2, 0], vers: [0, 1, 0.1], texte: tous[x.i].nom });
      } else {
        x.cotes.forEach(function (c) {
          var o = Object.assign({}, c);
          ['p', 'a', 'b', 'ea', 'eb'].forEach(function (k) { if (o[k]) o[k] = plus3(o[k], t, 1); });
          cotes.push(o);
        });
      }
    });
    var D = tous[liste[0]].geo.segments[0].s.D * sous[0].k;
    /* un morceau seul : de côté s'il tourne vers le haut ou le bas, de dessus s'il est « à plat » */
    var angles = [-0.28, 0.36];
    if (seul !== null) {
      var virages = tous[seul].geo.segments.filter(function (g) { return g.n; });
      angles = virages.length && virages.every(function (g) { return Math.abs(g.n[1]) < 0.4; }) ? [-0.12, 0.95] : [-0.14, 0.2];
    }
    return { m: M_, cotes: cotes, angles: angles, marge: seul === null ? [0.43, 0.36] : [0.33, 0.31], tuile: D * 1.4 };
  }

  var FABRIQUES = { droit: modeleDroit, coude: modeleCoude, piquage: modelePiquage, ensemble: modeleBiblio };

  /* reglages : pvc (affiché au départ), libre (zoom et déplacement), bouton (retour à la vue de départ) */
  var ICONE_PLEIN = '<svg viewBox="0 0 20 20"><path d="M3.5 7.5v-4h4M16.5 7.5v-4h-4M3.5 12.5v4h4M16.5 12.5v4h-4"/></svg>';
  var ICONE_FERMER = '<svg viewBox="0 0 20 20"><path d="M5 5l10 10M15 5L5 15"/></svg>';
  /* fond des vues 3D : le choix vaut pour toutes les vues et reste mémorisé ; sans choix, il suit le thème */
  var CLE_FOND = 'calo-fond-3d', vues = [], fondMemo = null;
  var ICONE_SOLEIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3 7 7M17 17l1.7 1.7M18.7 5.3 17 7M7 17l-1.7 1.7"/></svg>';
  var ICONE_LUNE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>';
  var BOUTONS_FOND = '<div class="fond-3d" role="group" aria-label="Fond de la vue 3D"><button type="button" data-fond="clair" aria-label="Fond clair">' + ICONE_SOLEIL + '</button><button type="button" data-fond="sombre" aria-label="Fond sombre">' + ICONE_LUNE + '</button></div>';
  function fondActuel() {
    var v = fondMemo;
    if (!v) { try { v = localStorage.getItem(CLE_FOND); } catch (err) { /* stockage indisponible */ } }
    return v === 'clair' || v === 'sombre' ? v : (document.documentElement.dataset.theme === 'dark' ? 'sombre' : 'clair');
  }
  function peindreFonds() {
    var f = fondActuel();
    vues.forEach(function (z) {
      z.dataset.fond = f;
      z.querySelectorAll('.fond-3d button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.fond === f)); });
    });
  }
  function choisirFond(f) {
    fondMemo = f;
    try { localStorage.setItem(CLE_FOND, f); } catch (err) { /* stockage indisponible */ }
    peindreFonds();
  }
  if (root.MutationObserver) new MutationObserver(peindreFonds).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  function creer(type, titre, avecEclate, reglages) {
    reglages = reglages || {};
    var el = document.createElement('figure');
    el.className = 'card scene' + (reglages.libre ? ' libre' : '');
    el.innerHTML = '<div class="scene-tete"><h2>' + titre + '</h2><div class="scene-choix">' +
      '<div class="bascule" role="group" aria-label="Matière affichée"><button type="button" data-pvc="1">Avec PVC</button><button type="button" data-pvc="0">Laine seule</button></div>' +
      (avecEclate ? '<button type="button" class="option" data-opt="eclate">Éclaté</button>' : '') +
      '<button type="button" class="option" data-opt="cotes">Cotes</button>' +
      (reglages.bouton ? '<button type="button" class="option" data-vue="depart">' + reglages.bouton + '</button>' : '') + '</div></div>' +
      (reglages.selection ? '<div class="scene-morceaux" role="group" aria-label="Morceau à coter"></div>' : '') +
      '<div class="scene-vue" tabindex="0" aria-label="Modèle 3D, flèches pour faire tourner"><canvas></canvas><svg aria-hidden="true"></svg>' + BOUTONS_FOND +
      (reglages.libre ? '<div class="zoom"><button type="button" data-plein aria-label="Plein écran">' + ICONE_PLEIN + '</button><button type="button" data-zoom="1.3" aria-label="Zoomer">+</button><button type="button" data-zoom="0.77" aria-label="Dézoomer">−</button></div>' : '') + '</div>' +
      (reglages.selection ? '<div class="fiche" aria-live="polite"></div>' : '') +
      '<figcaption></figcaption>';
    var zone = el.querySelector('.scene-vue'), toile = el.querySelector('canvas'), calque = el.querySelector('.scene-vue > svg'), legende = el.querySelector('figcaption');
    var opt = { pvc: reglages.pvc !== false, eclate: false, cotes: true };
    var zoom = 1, pan = [0, 0];
    var choix, vu = null;      /* morceau choisi (null = tous) et dernière projection dessinée */
    var morceaux = el.querySelector('.scene-morceaux'), fiche = el.querySelector('.fiche');
    var donnees = null, modele = null, vueLibre = null, gl = null, loc = {}, tampon = null, prevu = false;
    var centre = O, rayon = 1;

    function initGL() {
      gl = toile.getContext('webgl', { antialias: true, alpha: true, preserveDrawingBuffer: true });
      if (!gl) return false;
      var prog = gl.createProgram();
      [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]].forEach(function (s) {
        var sh = gl.createShader(s[0]);
        gl.shaderSource(sh, s[1]); gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(sh));
        gl.attachShader(prog, sh);
      });
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); gl = null; return false; }
      gl.useProgram(prog);
      ['p', 'n', 'm'].forEach(function (a) { loc[a] = gl.getAttribLocation(prog, a); gl.enableVertexAttribArray(loc[a]); });
      ['R', 'c', 'e', 'd', 'axe', 'trou', 'laine', 'tuile'].forEach(function (u) { loc[u] = gl.getUniformLocation(prog, u); });
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, textureLaine());
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.uniform1i(loc.laine, 0);
      tampon = gl.createBuffer();
      gl.enable(gl.DEPTH_TEST);
      return true;
    }

    function angles() { return vueLibre || modele.angles; }

    /* échelle qui fait tenir le modèle dans le cadre pour une orientation donnée */
    function echelle(R, W, H) {
      var v = modele.m.v, mx = 1e-6, my = 1e-6;
      for (var i = 0; i < v.length; i += 35) {
        var x = v[i] - centre[0], y = v[i + 1] - centre[1], z = v[i + 2] - centre[2];
        mx = Math.max(mx, Math.abs(R[0][0] * x + R[0][1] * y + R[0][2] * z));
        my = Math.max(my, Math.abs(R[1][0] * x + R[1][1] * y + R[1][2] * z));
      }
      var marge = modele.marge || [0.44, 0.39];
      return Math.min(W * marge[0] / mx, H * marge[1] / my);
    }

    function dessiner() {
      prevu = false;
      if (!modele) return;
      var W = zone.clientWidth, H = zone.clientHeight;
      if (!W || !H) return;
      var a = angles(), R = rotation(a[0], a[1]);
      var ech = zoom * Math.min(echelle(R, W, H), echelle(rotation(modele.angles[0], modele.angles[1]), W, H));
      var cadrage = modele.monte ? [pan[0], pan[1] - H * modele.monte] : pan;
      vu = { R: R, ech: ech, W: W, H: H };
      if (gl) {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var w = Math.round(W * dpr), h = Math.round(H * dpr);
        if (toile.width !== w || toile.height !== h) { toile.width = w; toile.height = h; }
        gl.viewport(0, 0, w, h);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.uniformMatrix3fv(loc.R, false, [R[0][0], R[1][0], R[2][0], R[0][1], R[1][1], R[2][1], R[0][2], R[1][2], R[2][2]]);
        gl.uniform3f(loc.c, centre[0], centre[1], centre[2]);
        gl.uniform3f(loc.e, 2 * ech / W, 2 * ech / H, 0.9 / rayon);
        gl.uniform2f(loc.d, 2 * cadrage[0] / W, -2 * cadrage[1] / H);
        var axe = modele.axe || X, trous = modele.trous || [0, 0];
        gl.uniform3f(loc.axe, axe[0], axe[1], axe[2]);
        gl.uniform2f(loc.trou, trous[0], trous[1]);
        gl.uniform1f(loc.tuile, modele.tuile || rayon * 0.85);
        gl.drawArrays(gl.TRIANGLES, 0, modele.m.v.length / 7);
      }
      vu.pan = cadrage;
      if (opt.cotes) etiquettes(calque, modele, R, centre, ech, W, H, cadrage);
      else calque.innerHTML = '';
    }
    function demander() { if (!prevu) { prevu = true; requestAnimationFrame(dessiner); } }

    function construire() {
      if (!donnees) return;
      if (donnees.textesPVC) donnees.textes = opt.pvc ? donnees.textesPVC : donnees.textesLaine;
      if (fiche) {
        var nb = donnees.fiches.length;
        if (reglages.depart !== undefined) { if (choix === undefined || (choix !== null && choix >= nb)) choix = reglages.depart; }
        else if (choix === undefined || (choix !== null && choix >= nb)) choix = nb > 2 ? 1 : 0;
        opt.choix = choix;
        afficherChoix();
      }
      modele = FABRIQUES[type](donnees, opt);
      var v = modele.m.v, min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9], i, k;
      for (i = 0; i < v.length; i += 7) for (k = 0; k < 3; k++) { if (v[i + k] < min[k]) min[k] = v[i + k]; if (v[i + k] > max[k]) max[k] = v[i + k]; }
      if (!v.length) { min = [-1, -1, -1]; max = [1, 1, 1]; }     /* zone vide */
      centre = lin(0.5, min, 0.5, max);
      rayon = 0.5 * Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;
      if (gl) {
        gl.bindBuffer(gl.ARRAY_BUFFER, tampon);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
        gl.vertexAttribPointer(loc.p, 3, gl.FLOAT, false, 28, 0);
        gl.vertexAttribPointer(loc.n, 3, gl.FLOAT, false, 28, 12);
        gl.vertexAttribPointer(loc.m, 1, gl.FLOAT, false, 28, 24);
      }
      el.querySelectorAll('[data-pvc]').forEach(function (b) { b.setAttribute('aria-pressed', String((b.dataset.pvc === '1') === opt.pvc)); });
      if (donnees.habillage) el.querySelector('[data-pvc="1"]').textContent = donnees.habillage;
      el.querySelectorAll('[data-opt]').forEach(function (b) { b.setAttribute('aria-pressed', String(opt[b.dataset.opt])); });
      var aide = reglages.libre ? (reglages.selection && !reglages.mot ? 'Touchez un morceau pour le sélectionner. ' : '') + 'Un doigt pour tourner, deux doigts pour zoomer et déplacer ; boutons + et −, ou ⤢ pour le plein écran ; « ' + reglages.bouton + ' » pour revenir. '
        : 'Glissez pour faire tourner, touchez deux fois pour recentrer. ';
      legende.textContent = (reglages.court ? (gl ? '' : 'La 3D n’est pas disponible sur cet appareil. ') : (gl ? aide + 'Les cotes des faces cachées sont masquées. ' : 'La 3D n’est pas disponible sur cet appareil. ')) +
        (opt.pvc ? donnees.legendePVC : donnees.legendeLaine);
      dessiner();
    }

    function afficherChoix() {
      var boutons = ['<button type="button" data-morceau="tous">Tous</button>'].concat(donnees.fiches.map(function (f, i) {
        return '<button type="button" data-morceau="' + i + '" aria-label="' + f.titre + '">' + (i + 1) + '</button>';
      }));
      morceaux.innerHTML = '<span>' + (reglages.mot || 'Morceau') + '</span>' + boutons.join('');
      morceaux.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.morceau === (choix === null ? 'tous' : String(choix)))); });
      if (choix === null) { fiche.innerHTML = '<p>' + (reglages.invite || 'Touchez un morceau du coude, ou son numéro, pour isoler ses cotes.') + '</p>'; return; }
      var f = donnees.fiches[choix];
      fiche.innerHTML = '<h3>' + f.titre + '</h3><div>' + f.cotes.map(function (c) { return '<p><span>' + c[0] + '</span><b>' + c[1] + '</b> <small>' + (c[2] !== undefined ? c[2] : f.unite) + '</small></p>'; }).join('') + '</div>';
    }
    function choisirMorceau(i) { choix = i; construire(); if (reglages.surChoix) reglages.surChoix(choix); }
    if (morceaux) {
      morceaux.addEventListener('click', function (ev) {
        var b = ev.target.closest('button'); if (!b) return;
        choisirMorceau(b.dataset.morceau === 'tous' ? null : +b.dataset.morceau);
      });
    }

    /* morceau visible au point touché : on cherche le triangle le plus proche de l'observateur */
    function morceauSous(px, py) {
      if (!vu || !modele) return -1;
      var v = modele.m.v, R = vu.R, e = vu.ech, ox = vu.W / 2 + vu.pan[0], oy = vu.H / 2 + vu.pan[1];
      var mieux = -1e18, trouve = -1, X_ = [0, 0, 0], Y_ = [0, 0, 0], Z_ = [0, 0, 0];
      for (var t = 0; t < modele.m.pieces.length; t++) {
        for (var k = 0; k < 3; k++) {
          var i = (t * 3 + k) * 7, x = v[i] - centre[0], y = v[i + 1] - centre[1], z = v[i + 2] - centre[2];
          X_[k] = ox + (R[0][0] * x + R[0][1] * y + R[0][2] * z) * e;
          Y_[k] = oy - (R[1][0] * x + R[1][1] * y + R[1][2] * z) * e;
          Z_[k] = R[2][0] * x + R[2][1] * y + R[2][2] * z;
        }
        var det = (Y_[1] - Y_[2]) * (X_[0] - X_[2]) + (X_[2] - X_[1]) * (Y_[0] - Y_[2]);
        if (Math.abs(det) < 1e-9) continue;
        var a = ((Y_[1] - Y_[2]) * (px - X_[2]) + (X_[2] - X_[1]) * (py - Y_[2])) / det;
        var b = ((Y_[2] - Y_[0]) * (px - X_[2]) + (X_[0] - X_[2]) * (py - Y_[2])) / det;
        if (a < 0 || b < 0 || a + b > 1) continue;
        var prof = a * Z_[0] + b * Z_[1] + (1 - a - b) * Z_[2];
        if (prof > mieux) { mieux = prof; trouve = modele.m.pieces[t]; }
      }
      return trouve;
    }

    el.querySelector('.scene-choix').addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.vue) { revenir(); return; }
      if (b.dataset.pvc !== undefined) opt.pvc = b.dataset.pvc === '1';
      else opt[b.dataset.opt] = !opt[b.dataset.opt];
      construire();
    });
    function revenir() { vueLibre = null; zoom = 1; pan = [0, 0]; demander(); }
    function zoomer(k) { var z = Math.max(0.5, Math.min(5, zoom * k)); pan = [pan[0] * z / zoom, pan[1] * z / zoom]; zoom = z; demander(); }

    /* un doigt (ou la souris) fait tourner ; en vue libre, deux doigts zooment et déplacent */
    var prise = null, doigts = {}, pince = null, appui = null;
    function deux() { var k = Object.keys(doigts); return k.length >= 2 ? [doigts[k[0]], doigts[k[1]]] : null; }
    zone.addEventListener('pointerdown', function (ev) {
      if (!modele || ev.target.closest('.zoom, .fond-3d')) return;
      doigts[ev.pointerId] = [ev.clientX, ev.clientY];
      appui = Object.keys(doigts).length === 1 && ev.button === 0 && !ev.shiftKey ? { id: ev.pointerId, x: ev.clientX, y: ev.clientY } : null;
      var a = angles(), d = reglages.libre && deux();
      if (d) {
        prise = null;
        pince = { l: Math.hypot(d[1][0] - d[0][0], d[1][1] - d[0][1]) || 1, m: [(d[0][0] + d[1][0]) / 2, (d[0][1] + d[1][1]) / 2] };
      } else {
        prise = { x: ev.clientX, y: ev.clientY, a: [a[0], a[1]], pan: pan.slice(), deplace: reglages.libre && (ev.shiftKey || ev.button === 2) };
      }
      try { zone.setPointerCapture(ev.pointerId); } catch (err) { /* capture facultative */ }
    });
    zone.addEventListener('pointermove', function (ev) {
      if (doigts[ev.pointerId]) doigts[ev.pointerId] = [ev.clientX, ev.clientY];
      var d = pince && deux();
      if (d) {
        var l = Math.hypot(d[1][0] - d[0][0], d[1][1] - d[0][1]) || 1, m = [(d[0][0] + d[1][0]) / 2, (d[0][1] + d[1][1]) / 2];
        pan = [pan[0] + m[0] - pince.m[0], pan[1] + m[1] - pince.m[1]];
        zoomer(l / pince.l);
        pince = { l: l, m: m };
        return;
      }
      /* tant que le doigt bouge à peine, ce n'est pas encore une rotation */
      if (appui && appui.id === ev.pointerId) {
        if (Math.hypot(ev.clientX - appui.x, ev.clientY - appui.y) < 7) return;
        appui = null;
      }
      if (!prise) return;
      if (prise.deplace) pan = [prise.pan[0] + ev.clientX - prise.x, prise.pan[1] + ev.clientY - prise.y];
      else vueLibre = [prise.a[0] + (ev.clientX - prise.x) * 0.01, Math.max(-1.35, Math.min(1.35, prise.a[1] + (ev.clientY - prise.y) * 0.008))];
      demander();
    });
    zone.addEventListener('pointerup', function (ev) {
      if (reglages.selection && appui && appui.id === ev.pointerId) {
        var cadre = zone.getBoundingClientRect(), i = morceauSous(ev.clientX - cadre.left, ev.clientY - cadre.top);
        if (i >= 0) choisirMorceau(choix === i ? null : i);
      }
    });
    ['pointerup', 'pointercancel'].forEach(function (n) { zone.addEventListener(n, function (ev) { delete doigts[ev.pointerId]; prise = null; pince = null; appui = null; }); });
    if (!reglages.selection) zone.addEventListener('dblclick', function (ev) { if (!ev.target.closest('.zoom, .fond-3d')) revenir(); });
    if (reglages.libre) {
      var boutonPlein = zone.querySelector('[data-plein]');
      var basculerPlein = function (on) {
        zone.classList.toggle('plein', on);
        document.body.classList.toggle('vue-pleine', on);
        boutonPlein.innerHTML = on ? ICONE_FERMER : ICONE_PLEIN;
        boutonPlein.setAttribute('aria-label', on ? 'Quitter le plein écran' : 'Plein écran');
        if (on) zone.focus({ preventScroll: true });
        demander();
      };
      zone.querySelector('.zoom').addEventListener('click', function (ev) {
        var b = ev.target.closest('button'); if (!b) return;
        if (b.hasAttribute('data-plein')) basculerPlein(!zone.classList.contains('plein'));
        else zoomer(+b.dataset.zoom);
      });
      document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && zone.classList.contains('plein')) basculerPlein(false); });
      zone.addEventListener('wheel', function (ev) {
        if (ev.ctrlKey || zone.classList.contains('plein')) { ev.preventDefault(); zoomer(Math.exp(-ev.deltaY * 0.004)); }
      }, { passive: false });
      zone.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
    }
    zone.addEventListener('keydown', function (ev) {
      var pas = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, -0.12], ArrowDown: [0, 0.12] }[ev.key];
      if (!pas || !modele) return;
      ev.preventDefault();
      var a = angles(); vueLibre = [a[0] + pas[0], Math.max(-1.35, Math.min(1.35, a[1] + pas[1]))];
      demander();
    });
    toile.addEventListener('webglcontextlost', function (ev) { ev.preventDefault(); });
    toile.addEventListener('webglcontextrestored', function () { initGL(); construire(); });
    if (window.ResizeObserver) new ResizeObserver(demander).observe(zone);

    vues.push(zone);
    zone.querySelector('.fond-3d').addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (b) choisirFond(b.dataset.fond);
    });
    peindreFonds();

    initGL();
    return { el: el, definir: function (d) { donnees = d; construire(); }, choisir: function (i) { choix = i; } /* pris en compte au prochain definir */ };
  }

  root.Scene3D = { creer: creer, textureLaine: textureLaine };
})(this);
