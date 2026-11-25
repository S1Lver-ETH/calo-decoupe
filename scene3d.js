/* Calo Découpe — modèles 3D en WebGL, sans bibliothèque : tube acier, coquille de laine et PVC gris.
   Les diamètres, rayons et courbes de coupe sont ceux des calculs ; les longueurs droites sont raccourcies. */
(function (root) {
  'use strict';
  var C = root.Calc;
  var RAD = Math.PI / 180, TOUR = Math.PI * 2;
  var M = { laine: 0, tranche: 1, pvc: 2, joint: 3, acier: 4, creux: 5, collerette: 6, laine2: 7 };

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
    var boites = [], sortie = '';
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

  var FABRIQUES = { droit: modeleDroit, coude: modeleCoude, piquage: modelePiquage };

  /* reglages : pvc (affiché au départ), libre (zoom et déplacement), bouton (retour à la vue de départ) */
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
      '<div class="scene-vue" tabindex="0" aria-label="Modèle 3D, flèches pour faire tourner"><canvas></canvas><svg aria-hidden="true"></svg>' +
      (reglages.libre ? '<div class="zoom"><button type="button" data-zoom="1.25" aria-label="Zoomer">+</button><button type="button" data-zoom="0.8" aria-label="Dézoomer">−</button></div>' : '') + '</div>' +
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
        gl.uniform2f(loc.d, 2 * pan[0] / W, -2 * pan[1] / H);
        var axe = modele.axe || X, trous = modele.trous || [0, 0];
        gl.uniform3f(loc.axe, axe[0], axe[1], axe[2]);
        gl.uniform2f(loc.trou, trous[0], trous[1]);
        gl.uniform1f(loc.tuile, rayon * 0.85);
        gl.drawArrays(gl.TRIANGLES, 0, modele.m.v.length / 7);
      }
      if (opt.cotes) etiquettes(calque, modele, R, centre, ech, W, H, pan);
      else calque.innerHTML = '';
    }
    function demander() { if (!prevu) { prevu = true; requestAnimationFrame(dessiner); } }

    function construire() {
      if (!donnees) return;
      if (donnees.textesPVC) donnees.textes = opt.pvc ? donnees.textesPVC : donnees.textesLaine;
      if (fiche) {
        var nb = donnees.fiches.length;
        if (choix === undefined || (choix !== null && choix >= nb)) choix = nb > 2 ? 1 : 0;
        opt.choix = choix;
        afficherChoix();
      }
      modele = FABRIQUES[type](donnees, opt);
      var v = modele.m.v, min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9], i, k;
      for (i = 0; i < v.length; i += 7) for (k = 0; k < 3; k++) { if (v[i + k] < min[k]) min[k] = v[i + k]; if (v[i + k] > max[k]) max[k] = v[i + k]; }
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
      el.querySelectorAll('[data-opt]').forEach(function (b) { b.setAttribute('aria-pressed', String(opt[b.dataset.opt])); });
      var aide = reglages.libre ? 'Touchez un morceau pour le sélectionner. Glissez pour tourner ; + et − ou deux doigts pour zoomer ; deux doigts ou Maj + glisser pour déplacer ; « ' + reglages.bouton + ' » pour revenir. '
        : 'Glissez pour faire tourner, touchez deux fois pour recentrer. ';
      legende.textContent = (gl ? aide + 'Les cotes des faces cachées sont masquées. ' : 'La 3D n’est pas disponible sur cet appareil. ') +
        (opt.pvc ? donnees.legendePVC : donnees.legendeLaine);
      dessiner();
    }

    function afficherChoix() {
      var boutons = ['<button type="button" data-morceau="tous">Tous</button>'].concat(donnees.fiches.map(function (f, i) {
        return '<button type="button" data-morceau="' + i + '" aria-label="' + f.titre + '">' + (i + 1) + '</button>';
      }));
      morceaux.innerHTML = '<span>Morceau</span>' + boutons.join('');
      morceaux.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.morceau === (choix === null ? 'tous' : String(choix)))); });
      if (choix === null) { fiche.innerHTML = '<p>Touchez un morceau du coude, ou son numéro, pour isoler ses cotes.</p>'; return; }
      var f = donnees.fiches[choix];
      fiche.innerHTML = '<h3>' + f.titre + '</h3><div>' + f.cotes.map(function (c) { return '<p><span>' + c[0] + '</span><b>' + c[1] + '</b> <small>' + f.unite + '</small></p>'; }).join('') + '</div>';
    }
    function choisirMorceau(i) { choix = i; construire(); }
    if (morceaux) {
      morceaux.addEventListener('click', function (ev) {
        var b = ev.target.closest('button'); if (!b) return;
        choisirMorceau(b.dataset.morceau === 'tous' ? null : +b.dataset.morceau);
      });
    }

    /* morceau visible au point touché : on cherche le triangle le plus proche de l'observateur */
    function morceauSous(px, py) {
      if (!vu || !modele) return -1;
      var v = modele.m.v, R = vu.R, e = vu.ech, ox = vu.W / 2 + pan[0], oy = vu.H / 2 + pan[1];
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
      if (!modele || ev.target.closest('.zoom')) return;
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
    if (!reglages.selection) zone.addEventListener('dblclick', function (ev) { if (!ev.target.closest('.zoom')) revenir(); });
    if (reglages.libre) {
      zone.querySelector('.zoom').addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (b) zoomer(+b.dataset.zoom); });
      zone.addEventListener('wheel', function (ev) { if (ev.ctrlKey) { ev.preventDefault(); zoomer(Math.exp(-ev.deltaY * 0.004)); } }, { passive: false });
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

    initGL();
    return { el: el, definir: function (d) { donnees = d; construire(); } };
  }

  root.Scene3D = { creer: creer, textureLaine: textureLaine };
})(this);
