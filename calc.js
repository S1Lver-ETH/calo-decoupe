/* CaloCoupe — formules de traçage (toutes les cotes en millimètres, angles en degrés).
   Fonctions pures : aucune dépendance à la page, utilisables aussi avec Node pour les tests. */
(function (root) {
  'use strict';

  var RAD = Math.PI / 180;

  /* Tubes acier : Ø extérieur, Ø intérieur courant de coquille, rayon à l'axe d'un coude 3D (EN 10253). */
  var TUBES = [
    { dn: 15,  pouce: '1/2"',   d: 21.3,  coq: 21,  r: 28 },
    { dn: 20,  pouce: '3/4"',   d: 26.9,  coq: 27,  r: 29 },
    { dn: 25,  pouce: '1"',     d: 33.7,  coq: 34,  r: 38 },
    { dn: 32,  pouce: '1"1/4',  d: 42.4,  coq: 42,  r: 48 },
    { dn: 40,  pouce: '1"1/2',  d: 48.3,  coq: 49,  r: 57 },
    { dn: 50,  pouce: '2"',     d: 60.3,  coq: 60,  r: 76 },
    { dn: 65,  pouce: '2"1/2',  d: 76.1,  coq: 76,  r: 95 },
    { dn: 80,  pouce: '3"',     d: 88.9,  coq: 89,  r: 114 },
    { dn: 100, pouce: '4"',     d: 114.3, coq: 114, r: 152 },
    { dn: 125, pouce: '5"',     d: 139.7, coq: 140, r: 190 },
    { dn: 150, pouce: '6"',     d: 168.3, coq: 168, r: 229 },
    { dn: 200, pouce: '8"',     d: 219.1, coq: 219, r: 305 },
    { dn: 250, pouce: '10"',    d: 273,   coq: 273, r: 381 },
    { dn: 300, pouce: '12"',    d: 323.9, coq: 324, r: 457 }
  ];

  /* Ø fini = Ø intérieur de la coquille + 2 × épaisseur */
  function diametreFini(dInt, e) { return dInt + 2 * e; }

  function developpe(d) { return Math.PI * d; }

  /* Partie droite : développé PVC et métré. */
  function droit(p) {
    var D = diametreFini(p.dInt, p.e);
    var dev = developpe(D);
    var feuille = dev + p.recouv;
    var out = { D: D, dev: dev, feuille: feuille };
    if (p.longueur > 0) {
      var L = p.longueur * 1000;
      var utile = p.largeur - p.recouv;
      out.coquilles = Math.ceil(L / p.longueurCoquille - 1e-9);
      out.viroles = utile > 0 ? Math.ceil(L / utile - 1e-9) : 0;
      out.surfacePVC = out.viroles * feuille * p.largeur / 1e6;
      out.volumeIsolant = Math.PI / 4 * (D * D - p.dInt * p.dInt) * L / 1e9;
    }
    return out;
  }

  /* Coude en secteurs : n sections entières + 2 demi-sections.
     Chaque joint est coupé à beta = angle / (2 × (n + 1)).
     Longueur d'une génératrice située à theta du dos : (R + r·cos theta) · tan beta (demi). */
  function coude(p) {
    var D = diametreFini(p.dInt, p.e);
    var r = D / 2;
    var n = p.sections;
    var beta = p.angle / (2 * (n + 1));
    var t = Math.tan(beta * RAD);
    var demi = { dos: (p.R + r) * t, axe: p.R * t, ventre: (p.R - r) * t };
    var entiere = { dos: 2 * demi.dos, axe: 2 * demi.axe, ventre: 2 * demi.ventre };
    return {
      D: D, r: r, R: p.R, n: n, angle: p.angle, beta: beta, tan: t,
      demi: demi, entiere: entiere,
      joints: n + 1,
      ventreNegatif: p.R - r < -1e-9,
      dev: developpe(D),
      longueurDebit: 2 * (n + 1) * p.R * t
    };
  }

  /* Rayon de tracé donnant un ventre donné sur la pièce la plus courte (la demie, ou la section entière). */
  function rayonPourVentre(p, ventre) {
    var D = diametreFini(p.dInt, p.e);
    var beta = p.angle / (2 * (p.sections + 1));
    var mult = p.sections > 0 ? 2 : 1;
    return D / 2 + ventre / (mult * Math.tan(beta * RAD));
  }

  /* Hauteur d'une pièce de coude le long de la génératrice située à theta (0 = dos, 180 = ventre). */
  function hauteurSecteur(c, theta, entiere) {
    var h = (c.R + c.r * Math.cos(theta * RAD)) * c.tan * (entiere ? 2 : 1);
    return Math.max(0, h);
  }

  /* Repères de débit sur une coquille droite, pièces tête-bêche.
     A = génératrice du dessus, B = génératrice opposée. Cotes cumulées depuis le bout d'équerre. */
  function debit(c) {
    var pieces = [], a = 0, b = 0;
    var total = c.n + 2;
    for (var i = 0; i < total; i++) {
      var full = i > 0 && i < total - 1;
      var m = full ? c.entiere : c.demi;
      var retourne = i % 2 === 1;
      a += retourne ? m.ventre : m.dos;
      b += retourne ? m.dos : m.ventre;
      pieces.push({ index: i, entiere: full, retourne: retourne, A: a, B: b });
    }
    return pieces;
  }

  /* Piquage (pénétrant) : cylindre de rayon r2 posé sur un cylindre de rayon r1,
     angle gamma entre les deux axes. phi = 0 dans le plan des axes, côté angle aigu.
     t(phi) = distance, le long de la génératrice, depuis le point de croisement des axes. */
  function distancePiquage(r1, r2, gamma, phi) {
    var s = Math.sin(gamma * RAD);
    var sp = r2 * Math.sin(phi * RAD);
    return (Math.sqrt(Math.max(0, r1 * r1 - sp * sp)) + r2 * Math.cos(phi * RAD) * Math.cos(gamma * RAD)) / s;
  }

  /* Point du trou sur le cylindre principal développé : x le long de l'axe, s sur le pourtour. */
  function pointTrou(r1, r2, gamma, phi) {
    var t = distancePiquage(r1, r2, gamma, phi);
    var x = t * Math.cos(gamma * RAD) + r2 * Math.cos(phi * RAD) * Math.sin(gamma * RAD);
    var y = r2 * Math.sin(phi * RAD);
    var s = r1 * Math.asin(Math.max(-1, Math.min(1, y / r1)));
    return { x: x, s: s };
  }

  function piquage(p) {
    var D1 = diametreFini(p.dInt1, p.e1);
    var D2 = diametreFini(p.dInt2, p.e2);
    var r1 = D1 / 2, r2 = D2 / 2;
    if (r2 > r1 + 1e-9) return { possible: false, D1: D1, D2: D2 };
    r2 = Math.min(r2, r1);
    var N = 360, i, tMax = -Infinity, tMin = Infinity, ts = [];
    for (i = 0; i <= N; i++) {
      var t = distancePiquage(r1, r2, p.gamma, i * 360 / N);
      ts.push(t);
      if (t > tMax) tMax = t;
      if (t < tMin) tMin = t;
    }
    /* y = surlongueur à laisser par rapport à la génératrice la plus courte */
    var courbe = ts.map(function (v, k) { return { phi: k * 360 / N, s: Math.PI * D2 * k / N, y: tMax - v, t: v }; });
    var trou = [], xMin = Infinity, xMax = -Infinity;
    for (i = 0; i <= N; i++) {
      var q = pointTrou(r1, r2, p.gamma, i * 360 / N);
      trou.push(q);
      if (q.x < xMin) xMin = q.x;
      if (q.x > xMax) xMax = q.x;
    }
    return {
      possible: true, D1: D1, D2: D2, r1: r1, r2: r2, gamma: p.gamma,
      dev1: developpe(D1), dev2: developpe(D2),
      tMax: tMax, tMin: tMin, profondeur: tMax - tMin,
      courbe: courbe, trou: trou,
      trouLongueur: xMax - xMin, trouXMin: xMin, trouXMax: xMax,
      trouLargeur: 2 * r1 * Math.asin(Math.min(1, r2 / r1)),
      ordonnee: function (phi) { return tMax - distancePiquage(r1, r2, p.gamma, phi); }
    };
  }

  var api = {
    TUBES: TUBES, diametreFini: diametreFini, developpe: developpe, droit: droit,
    coude: coude, rayonPourVentre: rayonPourVentre, hauteurSecteur: hauteurSecteur, debit: debit,
    distancePiquage: distancePiquage, pointTrou: pointTrou, piquage: piquage
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(this);
