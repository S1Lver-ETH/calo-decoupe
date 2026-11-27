/* Calo Découpe — prise de cotes d'un ensemble : modèle, géométrie, débit des feuilles et lecture de la dictée.
   Fonctions pures (millimètres, degrés), sans dépendance à la page. */
(function (root) {
  'use strict';
  var C = root.Calc, RAD = Math.PI / 180;

  var TYPES = { droit: 'Droit', coude: 'Coude', te: 'Té / piquage', reduction: 'Réduction', fond: 'Fond', boite: 'Boîte à vanne' };
  var SENS = { haut: 'vers le haut', bas: 'vers le bas', gauche: 'à gauche', droite: 'à droite', avant: 'vers l’avant', arriere: 'vers l’arrière', plat: 'à plat' };
  var FERMETURES = { '': 'automatique', dos: 'de dos', ventre: 'en ventre', flanc: 'sur le flanc', dessus: 'dessus', dessous: 'dessous', gauche: 'côté gauche', droite: 'côté droit', avant: 'devant', arriere: 'derrière', angle: 'à un angle' };
  var MATIERES = { alu: 'Aluminium', isoxal: 'Isoxal', inox: 'Inox', galva: 'Acier galvanisé' };
  var V = { haut: [0, 1, 0], bas: [0, -1, 0], droite: [1, 0, 0], gauche: [-1, 0, 0], avant: [0, 0, 1], arriere: [0, 0, -1] };

  function tubeDe(dn) { return C.TUBES.filter(function (t) { return t.dn === +dn; })[0]; }
  function nombre(v, defaut, min, max) {
    v = +v;
    if (!isFinite(v) || v <= 0) return defaut;
    return Math.max(min === undefined ? 0 : min, Math.min(max === undefined ? 1e6 : max, v));
  }
  function arrondi(v) { return Math.round(v); }

  /* ---------- modèle ---------- */
  function nouveau(base, finition) {
    base = base || {};
    var dn = base.dn || 50, t = tubeDe(dn);
    return {
      id: 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      nom: '', finition: finition || 'tole', matiere: 'isoxal', epTole: 0.8,
      dn: dn, d: base.d || (t ? t.d : 60.3), coq: base.coq || (t ? t.coq : 60), e: base.e || 30,
      recouv: 30, largeur: 1000, depart: 'droite', pieces: []
    };
  }

  function piece(p) {
    p = p || {};
    var type = TYPES[p.type] ? p.type : 'droit';
    var o = { type: type, note: String(p.note || '').slice(0, 300) };
    var ferm = function () {
      o.fermeture = FERMETURES[p.fermeture] !== undefined ? p.fermeture : '';
      o.fermAngle = ((+p.fermAngle || 0) % 360 + 360) % 360;
      o.faces = +p.faces === 2 ? 2 : 1;
    };
    if (type === 'droit') {
      o.longueur = nombre(p.longueur, 1000, 1, 100000); o.mode = p.mode === 'axe' ? 'axe' : 'nette'; ferm();
    } else if (type === 'coude') {
      o.angle = nombre(p.angle, 90, 5, 180); o.sens = SENS[p.sens] ? p.sens : '';
      var n = p.sections === undefined || p.sections === '' || +p.sections < 0 ? 1 : Math.round(+p.sections);
      o.sections = isFinite(n) ? Math.min(12, n) : 1;
      o.rayon = nombre(p.rayon, 0, 1, 5000); ferm();
    } else if (type === 'te') {
      o.longueur = nombre(p.longueur, 600, 20, 100000); o.position = nombre(p.position, 0, 1, 100000);
      o.angle = nombre(p.angle, 90, 25, 90); o.sens = SENS[p.sens] && p.sens !== 'plat' ? p.sens : (p.sens === 'plat' ? 'avant' : '');
      o.dnB = tubeDe(p.dnB) ? +p.dnB : 0; o.eB = nombre(p.eB, 0, 5, 300); o.longueurB = nombre(p.longueurB, 300, 20, 100000); ferm();
    } else if (type === 'reduction') {
      o.longueur = nombre(p.longueur, 250, 20, 5000); o.dnS = tubeDe(p.dnS) ? +p.dnS : 0;
      o.forme = p.forme === 'excentree' ? 'excentree' : 'concentrique'; o.plat = p.plat === 'dessus' ? 'dessus' : 'dessous'; ferm();
    } else if (type === 'fond') {
      o.forme = p.forme === 'bombe' ? 'bombe' : 'plat';
    } else {
      o.longueur = nombre(p.longueur, 0, 20, 5000); o.largeur = nombre(p.largeur, 0, 20, 5000); o.hauteur = nombre(p.hauteur, 0, 20, 5000); ferm();
    }
    return o;
  }

  function normaliser(r) {
    var o = nouveau({}, r && r.finition === 'pvc' ? 'pvc' : 'tole');
    r = r || {};
    if (r.id) o.id = String(r.id);
    o.nom = String(r.nom || '').slice(0, 80);
    o.matiere = MATIERES[r.matiere] ? r.matiere : 'isoxal';
    o.epTole = nombre(r.epTole, 0.8, 0.4, 2);
    o.dn = r.dn === 'libre' || tubeDe(r.dn) ? r.dn : o.dn;
    var t = tubeDe(o.dn);
    o.d = o.dn === 'libre' ? nombre(r.d, 60.3, 5, 3000) : t.d;
    o.coq = nombre(r.coq, t ? t.coq : 60, 5, 3000);
    o.e = nombre(r.e, 30, 5, 300);
    o.recouv = r.recouv === 0 ? 0 : nombre(r.recouv, 30, 0, 150);
    o.largeur = nombre(r.largeur, 1000, 100, 3000);
    o.depart = V[r.depart] ? r.depart : 'droite';
    o.pieces = (Array.isArray(r.pieces) ? r.pieces : []).slice(0, 80).map(piece);
    return o;
  }

  /* ---------- vecteurs ---------- */
  function add(a, b, k) { k = k === undefined ? 1 : k; return [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]]; }
  function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norme(a) { return Math.hypot(a[0], a[1], a[2]); }
  function unit(a) { var n = norme(a) || 1; return mul(a, 1 / n); }
  /* partie de a perpendiculaire à d */
  function perp(a, d) { return add(a, d, -dot(a, d)); }

  /* direction « sens » ramenée perpendiculairement à l'axe d ; null si impossible */
  function normale(sens, d) {
    var n;
    if (sens === 'plat') n = Math.abs(d[2]) < 0.9 ? perp(V.avant, d) : perp(V.droite, d);
    else {
      n = perp(V[sens], d);
      /* « à gauche » alors qu'on va déjà vers la gauche : par rapport au sens de marche */
      if (norme(n) < 0.05 && (sens === 'gauche' || sens === 'droite') && Math.abs(d[1]) < 0.9) n = mul(unit(cross(d, V.haut)), sens === 'droite' ? 1 : -1);
    }
    return norme(n) < 0.05 ? null : unit(n);
  }
  function hautDe(d) { var u = perp(V.haut, d); if (norme(u) < 0.2) u = perp(V.arriere, d); return unit(u); }
  function nomDirection(d) {
    var mieux = null, s = -2;
    Object.keys(V).forEach(function (k) { var x = dot(d, V[k]); if (x > s) { s = x; mieux = k; } });
    return (s < 0.95 ? 'en biais ' : '') + SENS[mieux];
  }

  function section(dn, d, coq, e) { return { dn: dn, d: d, coq: coq, e: e, D: C.diametreFini(coq, e) }; }
  function rayonDe(p, s) { var t = tubeDe(s.dn); return p.rayon > 0 ? p.rayon : (t ? t.r : arrondi(1.5 * s.d)); }

  /* ---------- géométrie : chaque pièce placée à la suite de la précédente ----------
     longueur(L, D) permet à la 3D de raccourcir les longues parties droites. */
  function geometrie(r, longueur) {
    var vis = longueur || function (L) { return L; };
    var s = section(r.dn, r.d, r.coq, r.e);
    var p = [0, 0, 0], d = V[r.depart].slice(), segments = [], alertes = [];
    var alerte = function (i, t) { alertes.push({ i: i, texte: t }); };

    r.pieces.forEach(function (q, i) {
      var g = { i: i, type: q.type, q: q, s: s, p0: p.slice(), d0: d.slice() };
      if (q.type === 'droit') {
        g.L = q.longueur;
        if (q.mode === 'axe') {
          [i - 1, i + 1].forEach(function (j) {
            var v = r.pieces[j];
            if (v && v.type === 'coude' && v.angle < 180) g.L -= rayonDe(v, s) * Math.tan(v.angle / 2 * RAD);
          });
          if (g.L <= 0) { alerte(i, 'La cote axe à axe est plus courte que les coudes : longueur droite ramenée à 1 mm.'); g.L = 1; }
        }
        g.Lv = vis(g.L, s.D);
        p = add(p, d, g.Lv);
      } else if (q.type === 'coude') {
        var sens = q.sens || (Math.abs(d[1]) < 0.9 ? 'haut' : 'droite');
        var n = normale(sens, d);
        if (!q.sens) alerte(i, 'Sens du coude non précisé : compris ' + SENS[sens] + '.');
        if (!n) { sens = Math.abs(d[1]) < 0.9 ? 'haut' : 'droite'; n = normale(sens, d) || normale('avant', d); alerte(i, 'Impossible de tourner ' + SENS[q.sens] + ' depuis cette direction : tracé ' + SENS[sens] + '.'); }
        var R = rayonDe(q, s), A = q.angle * RAD;
        g.n = n; g.R = R; g.sens = sens;
        g.centre = add(p, n, R);
        p = add(add(g.centre, n, -R * Math.cos(A)), d, R * Math.sin(A));
        d = unit(add(mul(d, Math.cos(A)), n, Math.sin(A)));
        if (R < s.D / 2) alerte(i, 'Isolant plus gros que le rayon du coude : les coupes se croisent au ventre.');
      } else if (q.type === 'te') {
        g.L = q.longueur; g.Lv = vis(q.longueur, s.D);
        g.pos = q.position > 0 && q.position < q.longueur ? q.position : q.longueur / 2;
        var sb = q.sens || (Math.abs(d[1]) < 0.9 ? 'haut' : 'avant');
        var nb = normale(sb, d);
        if (!q.sens) alerte(i, 'Sens du piquage non précisé : compris ' + SENS[sb] + '.');
        if (!nb) { sb = Math.abs(d[1]) < 0.9 ? 'haut' : 'avant'; nb = normale(sb, d); alerte(i, 'Le piquage ne peut pas partir dans l’axe du tube : tracé ' + SENS[sb] + '.'); }
        var tb = tubeDe(q.dnB) || tubeDe(s.dn);
        var br = tb ? section(tb.dn, tb.d, tb.coq, q.eB || s.e) : section('libre', s.d, s.coq, q.eB || s.e);
        g.n = nb; g.sens = sb; g.branche = br;
        g.possible = br.D <= s.D + 1e-6;
        if (!g.possible) alerte(i, 'Le piquage isolé est plus gros que le tube principal.');
        p = add(p, d, g.Lv);
      } else if (q.type === 'reduction') {
        var ts = tubeDe(q.dnS);
        if (!ts) {                      /* diamètre de sortie non dit : le tube juste en dessous */
          var plus = C.TUBES.filter(function (t) { return t.d < s.d - 1; });
          ts = plus.length ? plus[plus.length - 1] : C.TUBES[0];
          alerte(i, 'Diamètre de sortie non précisé : compris DN ' + ts.dn + '.');
        }
        var s2 = section(ts.dn, ts.d, ts.coq, s.e);
        g.L = q.longueur; g.Lv = vis(q.longueur, s.D); g.s2 = s2;
        g.decalage = [0, 0, 0];
        if (q.forme === 'excentree') g.decalage = mul(hautDe(d), (q.plat === 'dessus' ? 1 : -1) * (s.D - s2.D) / 2);
        p = add(add(p, d, g.Lv), g.decalage);
        s = s2;
      } else if (q.type === 'fond') {
        if (i < r.pieces.length - 1) alerte(i, 'Un fond ferme la ligne : les pièces suivantes sont tracées à la suite.');
        g.L = 0;
      } else {
        g.L = q.longueur || Math.max(250, arrondi(s.D * 2));
        g.l = q.largeur || arrondi(s.D + 100); g.h = q.hauteur || arrondi(s.D + 100);
        g.Lv = vis(g.L, s.D);
        if (g.l < s.D || g.h < s.D) alerte(i, 'La boîte est plus petite que le tube isolé.');
        p = add(p, d, g.Lv);
      }
      g.p1 = p.slice(); g.d1 = d.slice();
      segments.push(g);
    });

    segments.forEach(function (g, i) { fermeture(g, i, segments, r, alerte); });
    return { segments: segments, alertes: alertes, p: p, d: d, s: s };
  }

  /* ---------- position de la fermeture ----------
     Résultat : g.ferm = { w: direction (monde), theta: angle autour de la pièce en degrés, faces }.
     Sur un coude, theta est compté depuis le dos ; ailleurs depuis le dessus de la pièce. */
  function fermeture(g, i, tous, r, alerte) {
    var q = g.q;
    if (q.fermeture === undefined) return;
    var pos = q.fermeture, w, theta;
    if (g.type === 'coude') {
      var A = q.angle * RAD / 2;
      var dosMilieu = add(mul(g.n, -Math.cos(A)), g.d0, Math.sin(A));
      var cote = cross(mul(g.n, -1), g.d0);
      if (pos === '' || pos === 'ventre') theta = 180;
      else if (pos === 'dos') theta = 0;
      else if (pos === 'flanc') theta = 90;
      else if (pos === 'angle') theta = q.fermAngle;
      else theta = Math.atan2(dot(V[pos === 'dessus' ? 'haut' : pos === 'dessous' ? 'bas' : pos], cote), dot(V[pos === 'dessus' ? 'haut' : pos === 'dessous' ? 'bas' : pos], dosMilieu)) / RAD;
      theta = (theta + 360) % 360;
      w = add(mul(dosMilieu, Math.cos(theta * RAD)), cote, Math.sin(theta * RAD));
    } else {
      var d = g.d0, u = hautDe(d), v = cross(d, u);
      if (pos === 'dos' || pos === 'ventre' || pos === 'flanc') {
        /* par rapport au coude voisin, sinon par rapport au dessus */
        var c = tous[i + 1] && tous[i + 1].type === 'coude' ? tous[i + 1] : (tous[i - 1] && tous[i - 1].type === 'coude' ? tous[i - 1] : null);
        var dos = u;
        if (c) dos = c === tous[i + 1] ? mul(c.n, -1) : add(mul(c.n, -Math.cos(c.q.angle * RAD)), c.d0, Math.sin(c.q.angle * RAD));
        w = pos === 'dos' ? dos : pos === 'ventre' ? mul(dos, -1) : cross(d, dos);
      } else if (pos === 'angle') w = add(mul(u, Math.cos(q.fermAngle * RAD)), v, Math.sin(q.fermAngle * RAD));
      else if (pos === '') w = Math.abs(d[1]) < 0.7 ? V.bas : V.arriere;
      else w = V[pos === 'dessus' ? 'haut' : pos === 'dessous' ? 'bas' : pos];
      var wp = perp(w, d);
      if (norme(wp) < 0.1) { alerte(i, 'Fermeture « ' + FERMETURES[pos] + ' » impossible sur une pièce orientée ainsi : placée derrière.'); wp = perp(V.arriere, d); if (norme(wp) < 0.1) wp = u; }
      w = unit(wp);
      theta = (Math.atan2(dot(w, v), dot(w, u)) / RAD + 360) % 360;
      /* DTU 45.2 : sur un tuyau horizontal, pas de recouvrement à moins de 30° du dessus */
      if (Math.abs(d[1]) < 0.3) {
        var hauts = q.faces === 2 ? [w, mul(w, -1)] : [w];
        if (hauts.some(function (x) { return x[1] > Math.cos(30 * RAD) - 1e-6; })) alerte(i, 'Fermeture sur le dessus d’un tube horizontal : le DTU 45.2 demande de rester à plus de 30° du haut.');
      }
    }
    g.ferm = { w: unit(w), theta: Math.round(theta) % 360, faces: q.faces };
  }

  /* ---------- libellés ---------- */
  function texteFermeture(g) {
    var q = g.q;
    if (q.fermeture === undefined) return '';
    var t = q.fermeture === 'angle' ? 'à ' + q.fermAngle + '°' : q.fermeture === '' ? (g.type === 'coude' ? 'en ventre (auto)' : 'auto') : FERMETURES[q.fermeture];
    return 'Fermeture ' + t + (q.faces === 2 ? ' · 2 faces' : '');
  }
  function resumePiece(g, fmt) {
    var q = g.q, f = fmt || String;
    if (g.type === 'droit') return f(g.L) + (q.mode === 'axe' ? ' net (axe à axe ' + f(q.longueur) + ')' : '');
    if (g.type === 'coude') return q.angle + '° ' + SENS[g.sens] + ' · ' + q.sections + ' section' + (q.sections > 1 ? 's' : '') + ' + 2 demies';
    if (g.type === 'te') return f(g.L) + ' · piquage ' + (g.branche.dn === 'libre' ? 'Ø ' + f(g.branche.d) : 'DN ' + g.branche.dn) + ' ' + SENS[g.sens] + ' à ' + q.angle + '°';
    if (g.type === 'reduction') return (g.s.dn === 'libre' ? 'Ø ' + f(g.s.d) : 'DN ' + g.s.dn) + ' → DN ' + g.s2.dn + ' · ' + q.forme.replace('ee', 'ée') + ' · ' + f(g.L);
    if (g.type === 'fond') return q.forme === 'bombe' ? 'bombé' : 'plat';
    return f(g.L) + ' × ' + f(g.l) + ' × ' + f(g.h);
  }

  /* ---------- débit des feuilles ---------- */
  function debit(r) {
    var geo = geometrie(r), tole = r.finition === 'tole', ep = tole ? r.epTole : 0, rc = r.recouv;
    var surface = 0, laine = 0;
    var pieces = geo.segments.map(function (g) {
      var q = g.q, D = g.s.D, Dt = D + ep, dev = Math.PI * Dt, faces = q.faces || 1;
      var feuilles = [], cotes = [];
      var feuille = function (nom, qte, largeur, longueur) {
        feuilles.push({ nom: nom, qte: qte, largeur: largeur, longueur: longueur });
        surface += qte * largeur * longueur / 1e6;
      };
      var coupe = dev / faces + rc;
      if (g.type === 'droit' || g.type === 'te') {
        var pas = Math.max(1, r.largeur - rc), nb = Math.max(1, Math.ceil((g.L - 0.01) / pas)), reste = g.L - (nb - 1) * pas + rc;
        if (nb > 1) feuille('Virole', (nb - 1) * faces, coupe, r.largeur);
        feuille(nb > 1 ? 'Dernière virole' : 'Virole', faces, coupe, reste);
        cotes.push(['Ø fini', D], ['Développé', dev / faces], ['Largeur à couper', coupe], ['Longueur', g.L]);
        laine += g.L;
        if (g.type === 'te' && g.possible) {
          var pq = C.piquage({ dInt1: g.s.coq, e1: g.s.e + ep / 2, dInt2: g.branche.coq, e2: g.branche.e + ep / 2, gamma: q.angle });
          if (pq.possible) {
            var longue = Math.max(0, q.longueurB - pq.tMin), courte = Math.max(0, q.longueurB - pq.tMax);
            feuille('Piquage', faces, pq.dev2 / faces + rc, longue + rc);
            cotes.push(['Piquage : développé', pq.dev2], ['Piquage : grande génératrice', longue], ['Piquage : petite génératrice', courte], ['Gueule de loup', pq.profondeur], ['Trou : longueur', pq.trouLongueur], ['Trou : largeur', pq.trouLargeur], ['Axe du trou depuis le début', g.pos]);
            if (courte <= 0) geo.alertes.push({ i: g.i, texte: 'Piquage trop court : il n’atteint pas la sortie de l’isolant principal.' });
            laine += q.longueurB;
          }
        }
      } else if (g.type === 'coude') {
        var c = C.coude({ dInt: g.s.coq, e: g.s.e + ep / 2, angle: q.angle, sections: q.sections, R: g.R });
        var iso = C.coude({ dInt: g.s.coq, e: g.s.e, angle: q.angle, sections: q.sections, R: g.R });
        var v = function (x) { return Math.max(0, x); };
        if (c.n > 0) feuille('Section entière', c.n * faces, c.dev / faces + rc, v(c.entiere.dos) + rc);
        feuille('Demi-section', 2 * faces, c.dev / faces + rc, v(c.demi.dos) + rc);
        cotes.push(['Angle de coupe (°)', Math.round(c.beta * 100) / 100], ['Développé', c.dev / faces], ['Largeur à couper', c.dev / faces + rc], ['Rayon à l’axe', g.R]);
        if (c.n > 0) cotes.push(['Section : dos', v(c.entiere.dos) + rc], ['Section : ventre', v(c.entiere.ventre) + rc]);
        cotes.push(['Demie : dos', v(c.demi.dos) + rc], ['Demie : ventre', v(c.demi.ventre) + rc]);
        if (c.n > 0) cotes.push(['Laine section dos / ventre', [v(iso.entiere.dos), v(iso.entiere.ventre)]]);
        cotes.push(['Laine demie dos / ventre', [v(iso.demi.dos), v(iso.demi.ventre)]]);
        laine += g.R * q.angle * RAD;
        g.calcul = c;
      } else if (g.type === 'reduction') {
        var D2t = g.s2.D + ep, ecart = Dt - D2t;
        var exc = q.forme === 'excentree';
        var petite = exc ? g.L : Math.hypot(g.L, ecart / 2), grande = exc ? Math.hypot(g.L, ecart) : petite;
        feuille('Cône', faces, dev / faces + rc, grande + rc);
        cotes.push(['Grand Ø fini', D], ['Petit Ø fini', g.s2.D], ['Grand développé', dev / faces], ['Petit développé', Math.PI * D2t / faces]);
        if (exc) cotes.push(['Génératrice côté plat', petite], ['Génératrice opposée', grande]);
        else {
          cotes.push(['Génératrice', petite]);
          if (ecart > 0.5) cotes.push(['Compas : grand rayon', petite * Dt / ecart], ['Compas : petit rayon', petite * Dt / ecart - petite], ['Angle du secteur (°)', Math.round(180 * ecart / petite * 10) / 10]);
        }
        laine += g.L;
      } else if (g.type === 'fond') {
        var disque = D + 2 * rc;
        feuille(q.forme === 'bombe' ? 'Flan de fond bombé' : 'Disque', 1, disque, disque);
        cotes.push(['Ø fini à fermer', D], ['Ø à découper (bord compris)', disque]);
      } else {
        var ceinture = faces === 2 ? g.l + g.h + 2 * rc : 2 * (g.l + g.h) + rc;
        feuille(faces === 2 ? 'Demi-ceinture' : 'Ceinture', faces, ceinture, g.L + 2 * rc);
        feuille('Flasque', 2, g.l + 2 * rc, g.h + 2 * rc);
        cotes.push(['Longueur', g.L], ['Largeur', g.l], ['Hauteur', g.h], ['Ø des trous dans les flasques', D]);
        laine += g.L;
      }
      return { g: g, titre: (g.i + 1) + ' · ' + TYPES[g.type], feuilles: feuilles, cotes: cotes };
    });
    return { geo: geo, pieces: pieces, alertes: geo.alertes, surface: surface, longueur: laine / 1000 };
  }

  /* ---------- lecture de la dictée ---------- */
  var MOTS = { zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, septante: 70, nonante: 90, cent: 100, cents: 100, mille: 1000 };
  var APRES_UN = /^(metres?|m|cm|mm|centimetres?|millimetres?|sections?|secteurs?|faces?|degres?|heures?|fermetures?)$/;

  /* notation du métier : « 60-40 » = coquille Ø intérieur 60, épaisseur 40 */
  var COQ = [16, 21, 27, 32, 34, 42, 49, 54, 60, 76, 89, 114, 140, 168, 219, 273, 324];
  var EPS = [13, 19, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 120];
  function paire(a, b) { return COQ.indexOf(+a) >= 0 && EPS.indexOf(+b) >= 0; }
  function poserCoquille(r, coq) {
    var t = C.TUBES.filter(function (x) { return x.coq === coq; })[0];
    r.coq = coq; r.dn = t ? t.dn : 'libre'; r.d = t ? t.d : coq;
  }

  function chiffres(texte) {
    var t = texte.split(/\s+/), out = [], i = 0;
    var est = function (m) { return Object.prototype.hasOwnProperty.call(MOTS, m); };
    while (i < t.length) {
      if (!est(t[i])) { out.push(t[i]); i++; continue; }
      var j = i, total = 0, courant = 0, n = 0, dernier = '';
      while (j < t.length && (est(t[j]) || (t[j] === 'et' && n && (t[j + 1] === 'un' || t[j + 1] === 'une' || t[j + 1] === 'onze')))) {
        var m = t[j];
        if (m === 'et') { j++; continue; }
        var val = MOTS[m];
        /* deux nombres à la suite qui ne forment pas un seul nombre : on s'arrête */
        if (n && val < 100 && MOTS[dernier] < 10 && !(val === 20 && courant % 100 === 4)) break;
        if (n && val < 100 && val >= 10 && MOTS[dernier] >= 10 && MOTS[dernier] < 20) break;
        /* « soixante quarante » = 60 et 40 ; « soixante quinze » et « quatre vingt dix » restent un seul nombre */
        if (n && val < 100 && val >= 10 && MOTS[dernier] >= 20 && MOTS[dernier] < 100 && !(val === 20 && courant % 100 === 4) && !(val < 20 && (courant % 100 === 60 || courant % 100 === 80))) break;
        /* « quarante un coude » : on dit « quarante et un », ce « un » est un article */
        if (n && (m === 'un' || m === 'une') && t[j - 1] !== 'et' && courant % 100 !== 80 && MOTS[dernier] >= 20 && MOTS[dernier] < 100) break;
        if (val === 1000) { total += (courant || 1) * 1000; courant = 0; }
        else if (val === 100) courant = (courant % 100 || 1) * 100 + courant - courant % 100;
        else if (val === 20 && courant % 100 === 4) courant += 76;
        else courant += val;
        dernier = m; n++; j++;
      }
      var seul = n === 1 && (t[i] === 'un' || t[i] === 'une') && !APRES_UN.test(t[j] || '');
      out.push(seul ? t[i] : String(total + courant));
      i = j;
    }
    return out.join(' ');
  }

  /* mots mal entendus par la reconnaissance vocale : [motif, mot voulu, groupe gardé devant] */
  var QTE = '((?:\\d+(?:\\.\\d+)? ?(?:metres?|m|coudes?|coquilles?)|coudes?|coquilles?|metres?)(?: de| en)?)';
  var SUITE = '(?= *(?:$|,|\\.|;|\\bet\\b|\\bpuis\\b|\\bensuite\\b|\\d|\\ben \\d))';
  var ECOUTE = [
    [/\b(?:lait|laits|laid|laids|laie|laies|lais|lene|lenne|leine|lane|lanne|laines|lainee|l aine|l haine|l ene)\b/g, 'laine', 0],
    [new RegExp('\\b' + QTE + ' (?:les|le|lai|lay|l est|lest|haine|aine|laisse)\\b' + SUITE, 'g'), 'laine', 1],
    [/\b(de|en) (?:les|le|lai|l est|haine)\b(?= *(?:$|,|\.|;|\bet\b|\bpuis\b|\d))/g, 'laine', 1],
    [/\bpe ?ve ?ce\b|\bpe ?ve ?se\b|\bpeveces?\b|\bp v c\b|\bp vc\b|\bpv c\b|\bp ?b ?c\b|\bb ?v ?c\b|\bp ?v ?s\b|\bpvcs\b|\bp w c\b|\bpwc\b/g, 'pvc', 0],
    [/(\d+) (?:codes|cous|coutes|coules|coudres|couds)\b/g, 'coudes', 1],
    [/(\d+|une?) (?:code|cou|coute|coule|coudre)\b/g, 'coude', 1],
    [/\bcoudres?\b/g, 'coude', 0],
    [/\bcodes? (?=pvc|laine|a \d|en \d|de \d)/g, 'coude ', 0],
    [/(\d+(?:\.\d+)?) (?:mettre|mettres|maitre|maitres|metro|metros)\b/g, 'metres', 1],
    [/(\d+) (?:sessions?|cessions?)\b/g, 'sections', 1],
    [/\bco ?quil+e\b/g, 'coquille', 0], [/\bco ?quil+es\b/g, 'coquilles', 0],
    [/\b(?:taules?|tolle|tol)\b/g, 'tole', 0],
    [/\b(en|de|au) (?:vendre|vente|ventres)\b/g, 'ventre', 1],
    [/\b(en|de|au) (?:do|d eau|deau|dot)\b(?! \d)/g, 'dos', 1],
    [/\b(?:picage|piquages?|piquet|piquets)\b/g, 'piquage', 0]
  ];
  var entendus = [];
  function corriger(s) {
    var notes = [];
    ECOUTE.forEach(function (r) {
      s = s.replace(r[0], function () {
        var m = arguments[0], devant = r[2] ? arguments[r[2]] : '';
        var mot = m.slice(devant.length).trim(), vers = r[1].trim();
        if (mot !== vers && notes.every(function (n) { return n[0] !== mot; })) notes.push([mot, vers]);
        return (devant ? devant + ' ' : '') + r[1];
      });
    });
    return { s: s, notes: notes };
  }

  function preparer(texte) {
    var s = ' ' + String(texte).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + ' ';
    s = s.replace(/\bp\. ?v\. ?c\.?/g, 'pvc');
    s = s.replace(/(\d),(\d)/g, '$1.$2').replace(/[’']/g, ' ').replace(/-/g, ' ').replace(/°/g, ' degres ');
    s = s.replace(/,/g, ' , ').replace(/([;!?\n:])/g, ' $1 ').replace(/\.(?!\d)/g, ' . ').replace(/[ \t]+/g, ' ');
    s = chiffres(s.replace(/\n/g, ' ; '));
    s = ' ' + s + ' ';
    s = s.replace(/(\d+) virgule (\d+)/g, '$1.$2');
    var c = corriger(s);
    s = c.s; entendus = c.notes;
    /* tournures fréquentes, dont les erreurs de la reconnaissance vocale */
    s = s.replace(/\bcoup d ?a ?plat\b|\bcoup a plat\b|\bcoude d ?aplat\b/g, 'coude a plat').replace(/\bcoud\b/g, 'coude');
    s = s.replace(/\bcoups? (?:de )?(?=en |a |\d|d |de |pvc|laine)/g, 'coude ').replace(/\bcoups\b/g, 'coudes').replace(/\bcoup\b/g, 'coude');
    s = s.replace(/\b(vers le fond|au fond)\b/g, 'vers l arriere').replace(/\bd n (\d)/g, 'dn $1').replace(/\bdn(\d)/g, 'dn $1');
    /* longueurs avec unité : notées § suivi des millimètres */
    s = s.replace(/(\d+(?:\.\d+)?) ?(?:metres?|m) et demi\b/g, function (x, a) { return '§' + Math.round((+a + 0.5) * 1000); });
    s = s.replace(/(\d+(?:\.\d+)?) ?(?:metres?|m)(?![a-z])(?: ?(\d{1,3})(?![\d.]| ?(?:degres|sections?|secteurs?|faces?|heures?|mm|cm|millim|centim|metres?|m )))?/g, function (x, a, b) {
      var v = +a * 1000;
      if (b) v += b.length === 3 ? +b : (b.length === 2 ? +b * 10 : +b * 10);
      return '§' + Math.round(v);
    });
    s = s.replace(/(\d+(?:\.\d+)?) ?(?:centimetres?|cm)\b/g, function (x, a) { return '§' + Math.round(+a * 10); });
    s = s.replace(/(\d+(?:\.\d+)?) ?(?:millimetres?|mm)\b/g, function (x, a) { return '§' + Math.round(+a); });
    return s;
  }

  var CLES = [
    ['coude', /\bcoudes?\b/g],
    ['te', /\b(?:te|tes|the|piquages?|penetrants?|derivations?)\b/g],
    ['reduction', /\b(?:reductions?|reduc|cones?)\b/g],
    ['fond', /\b(?:fonds?|bouchons?)\b/g],
    ['boite', /\b(?:boites?(?: a vannes?)?|boitiers?|coffres?)\b/g],
    ['droit', /\b(?:partie droite|longueur droite|ligne droite|section droite|une droite|droit|viroles?|manchettes?|troncons?)\b/g]
  ];
  function motsCles(s) {
    var liste = [];
    CLES.forEach(function (k) {
      k[1].lastIndex = 0;
      var m;
      while ((m = k[1].exec(s))) {
        var avant = s.slice(0, m.index);
        /* « le piquage », « longueur du piquage » : précision sur la pièce en cours, pas une nouvelle pièce */
        if (k[0] === 'te' && /\b(?:du|le|au|ce) $/.test(avant)) continue;
        if (k[0] === 'fond' && /\bplat\b/.test(m[0])) continue;
        liste.push({ type: k[0], i: m.index, fin: m.index + m[0].length });
      }
    });
    liste.sort(function (a, b) { return a.i - b.i; });
    return liste.filter(function (k, i) {
      var p = liste[i - 1];
      if (!p) return true;
      if (k.i < p.fin) return false;
      /* « té avec un piquage » = une seule pièce */
      return !(k.type === 'te' && p.type === 'te' && !/\bun |\bautre /.test(s.slice(p.fin, k.i).slice(-8)));
    });
  }

  /* extrait un motif et le retire du texte */
  function prendre(etat, re) {
    var m = etat.s.match(re);
    if (m) etat.s = etat.s.slice(0, m.index) + ' ' + etat.s.slice(m.index + m[0].length);
    return m;
  }

  function reglagesGeneraux(etat, r, dit, avecDN) {
    var m;
    var re = /(?:\b(?:tuyau|tube|en|diametre|coquille|du)\b )*(?<![§\d.])(\d{2,3}) ?(?:x |par |sur |\/ ?| )(\d{2,3})(?![\d.])/g, pm;
    while ((pm = re.exec(etat.s))) {
      if (!paire(pm[1], pm[2])) { re.lastIndex = pm.index + 1; continue; }
      poserCoquille(r, +pm[1]); r.e = +pm[2]; dit.push('Coquille ' + pm[1] + ' · épaisseur ' + pm[2]);
      etat.s = etat.s.slice(0, pm.index) + ' ' + etat.s.slice(pm.index + pm[0].length);
      break;
    }
    if ((m = etat.s.match(/\b(?:en|tuyau|tube) (\d{2,3})(\d{2})\b/)) && paire(m[1], m[2])) {
      prendre(etat, /\b(?:en|tuyau|tube) \d{4,5}\b/); poserCoquille(r, +m[1]); r.e = +m[2]; dit.push('Coquille ' + m[1] + ' · épaisseur ' + m[2]);
    }
    if (avecDN && (m = prendre(etat, /\bdn (\d+)\b/))) {
      var t = tubeDe(m[1]);
      if (t) { r.dn = t.dn; r.d = t.d; r.coq = t.coq; dit.push('Tube DN ' + t.dn); }
      else dit.push('?DN ' + m[1] + ' inconnu.');
    }
    if ((m = prendre(etat, /\b(?:epaisseur|isolant|ep|laine)(?: de| en| d)? §?(\d+)\b/))) { r.e = nombre(+m[1], r.e, 5, 300); dit.push('Épaisseur ' + r.e); }
    if ((m = prendre(etat, /\b(?:coquille|interieur)(?: de| en)? §?(\d+(?:\.\d+)?)\b/))) { r.coq = nombre(+m[1], r.coq, 5, 3000); dit.push('Coquille Ø ' + r.coq); }
    if ((m = prendre(etat, /\bdiametre(?: de| du tube)? §?(\d+(?:\.\d+)?)\b/))) { r.dn = 'libre'; r.d = nombre(+m[1], r.d, 5, 3000); r.coq = r.d; dit.push('Tube Ø ' + r.d); }
    if ((m = prendre(etat, /\brecouvrement(?: de)? §?(\d+)\b/))) { r.recouv = Math.min(150, +m[1]); dit.push('Recouvrement ' + r.recouv); }
    if ((m = prendre(etat, /\b(?:depart|on part|on demarre)(?: en)?(?: vers)?(?: la| le| l)? ?(haut|bas|gauche|droite|avant|arriere)\b/))) { r.depart = m[1]; dit.push('Départ ' + SENS[m[1]]); }
    if (prendre(etat, /\bpvc\b/)) { r.finition = 'pvc'; dit.push('Finition PVC'); }
    if ((m = prendre(etat, /\b(isoxal|inox|galva(?:nise)?|alu(?:minium)?)\b/))) {
      r.finition = 'tole'; r.matiere = m[1].indexOf('alu') === 0 ? 'alu' : m[1].indexOf('galva') === 0 ? 'galva' : m[1]; dit.push('Tôle ' + MATIERES[r.matiere]);
    }
    if (prendre(etat, /\b(?:en )?tole(?:rie)?\b/)) { if (r.finition !== 'tole') dit.push('Finition tôle'); r.finition = 'tole'; }
  }

  /* attributs dits pour une pièce de type donné : renvoie seulement ce qui a été entendu */
  function attributs(texte, type, unite, doutes) {
    var etat = { s: texte }, a = {}, m;
    var mm = function (brut) {
      if (String(brut).charAt(0) === '§') return +String(brut).slice(1);
      var v = +brut;
      if (v < 10) { doutes.push('« ' + brut + ' » sans unité : compris ' + v + ' m.'); return v * 1000; }
      return unite === 'cm' ? v * 10 : v;
    };
    var N = '(§?\\d+(?:\\.\\d+)?)';

    if ((m = prendre(etat, /\bnote\b(.*)$/))) a.note = m[1].replace(/§/g, '').trim();

    /* fermeture */
    if (prendre(etat, /\b(?:sur )?les (?:2|deux) (?:cotes|flancs)\b/)) { a.fermeture = 'flanc'; a.faces = 2; }
    if (prendre(etat, /\bdos et (?:en )?ventre\b|\bde dos (?:et )?en ventre\b/)) { a.fermeture = 'dos'; a.faces = 2; }
    if (prendre(etat, /\b(?:sur|par|aux?)(?: les)? (?:flancs|cotes)\b/)) { a.fermeture = 'flanc'; a.faces = 2; }
    if ((m = prendre(etat, /\b(1|2|une?) ?(?:faces?|fermetures|coques|demi coques|demi coquilles)\b/))) a.faces = m[1] === '2' ? 2 : 1;
    if ((m = prendre(etat, /\bfermetures?(?: a| en| de| au| sur| dans)?(?: le| la)? (\d{1,3}) ?degres?\b/))) {
      a.fermeture = 'angle'; a.fermAngle = +m[1] % 360;
      if (a.fermAngle < 10 && a.fermAngle > 0) doutes.push('Fermeture à ' + a.fermAngle + '° : vérifiez que c’est bien l’angle voulu.');
    } else if ((m = prendre(etat, /\b(?:fermetures? )?a (\d{1,2}) ?heures?\b/))) { a.fermeture = 'angle'; a.fermAngle = (+m[1] % 12) * 30; }
    else if ((m = prendre(etat, /\bfermetures?(?: (?:a|en|de|du|au|sur|dans|le|la|l|vers|cote)){0,4} (dos|ventre|flanc|cote|dessus|dessous|haut|bas|avant|devant|arriere|derriere|gauche|droite|droit|tete)\b/))) {
      var mot = m[1];
      a.fermeture = { cote: 'flanc', haut: 'dessus', bas: 'dessous', devant: 'avant', derriere: 'arriere', droit: 'droite', tete: 'dessus' }[mot] || mot;
      if (mot === 'tete') doutes.push('« Fermeture en tête » comprise comme : dessus.');
    }
    if (!a.fermeture) {
      if (prendre(etat, /\b(?:de|en|au) dos\b/)) a.fermeture = 'dos';
      else if (prendre(etat, /\b(?:de|en|au) ventre\b/)) a.fermeture = 'ventre';
    }
    prendre(etat, /\bfermetures?\b/);

    if ((m = prendre(etat, /\b(?:sans section|(\d+) ?(?:sections?|secteurs?|elements?)(?: entieres?)?)\b/))) a.sections = m[1] ? +m[1] : 0;
    if ((m = prendre(etat, new RegExp('\\brayon(?: de)? ' + N)))) a.rayon = mm(m[1]);

    if (type === 'te' || type === 'reduction') {
      var dns = [];
      while ((m = prendre(etat, /\bdn (\d+)\b/))) dns.push(+m[1]);
      if (dns.length) a[type === 'te' ? 'dnB' : 'dnS'] = dns[dns.length - 1];
    }
    if (type === 'te') {
      if ((m = prendre(etat, new RegExp('\\b(?:longueur|hauteur)(?: du| de la| de)? (?:piquage|branche|depart)(?: de| a)? ' + N)))) a.longueurB = mm(m[1]);
      else if ((m = prendre(etat, new RegExp('\\b(?:piquage|branche)(?: long| longueur)?(?: de) ' + N + '(?: de long)?')))) a.longueurB = mm(m[1]);
      if ((m = prendre(etat, new RegExp('\\b(?:position|axe)(?: du piquage)?(?: a)? ' + N)))) a.position = mm(m[1]);
      else if ((m = prendre(etat, new RegExp('\\ba ' + N + ' (?:du bord|du debut|de l entree)')))) a.position = mm(m[1]);
      if ((m = prendre(etat, new RegExp('\\b(?:epaisseur|isolant)(?: du piquage)?(?: de| en)? ' + N)))) a.eB = mm(m[1]);
    }
    if (type === 'reduction') {
      if (prendre(etat, /\bexcentr\w*/)) a.forme = 'excentree';
      if (prendre(etat, /\bconcentr\w*/)) a.forme = 'concentrique';
      if ((m = prendre(etat, /\bplat (?:en |au |vers le )?(dessus|dessous|haut|bas)\b/))) { a.forme = 'excentree'; a.plat = m[1] === 'dessus' || m[1] === 'haut' ? 'dessus' : 'dessous'; }
    }
    if (type === 'fond') {
      if (prendre(etat, /\bbombe\w*/)) a.forme = 'bombe';
      if (prendre(etat, /\bplat\b/)) a.forme = 'plat';
    }

    if (type === 'coude' || type === 'te') {
      if (type === 'coude' && prendre(etat, /\bd ?equerre\b/)) a.angle = 90;
      if ((m = prendre(etat, /\b(\d{1,3}) ?degres?\b/))) a.angle = +m[1];
      else if ((m = prendre(etat, /\b(?:coudes?|piquage|te)(?: a| de| en)? (15|30|45|60|90|120|135|180)\b/))) a.angle = +m[1];
      else if ((m = prendre(etat, /\ba (30|45|60|90)\b/))) a.angle = +m[1];
      /* sens de la pièce */
      if (prendre(etat, /\b(?:a|vers|sur)(?: la)? gauche\b/)) a.sens = 'gauche';
      else if (prendre(etat, /\b(?:a|vers|sur)(?: la)? droite\b/)) a.sens = 'droite';
      else if (prendre(etat, /\b(?:vers l avant|en avant|devant|vers moi)\b/)) a.sens = 'avant';
      else if (prendre(etat, /\b(?:vers l arriere|en arriere|arriere|derriere)\b/)) a.sens = 'arriere';
      else if (prendre(etat, /\b(?:vers le haut|monte|montant|montante|en montee|en haut|dessus)\b/)) a.sens = 'haut';
      else if (prendre(etat, /\b(?:vers le bas|descend|descendant|descendante|en descente|en chute|chute|en bas|dessous)\b/)) a.sens = 'bas';
      else if (prendre(etat, /\ben tete\b/)) { a.sens = 'haut'; doutes.push('« En tête » compris comme : vers le haut.'); }
      if (prendre(etat, /\b(?:a plat|d aplat|aplat|horizontal\w*)\b/) && !a.sens) a.sens = 'plat';
    }

    if (prendre(etat, /\b(?:axe a axe|d axe en axe|entraxes?|a l axe|axe axe)\b/)) a.mode = 'axe';
    if (prendre(etat, /\b(?:cote nette|face a face|longueur nette)\b/)) a.mode = 'nette';

    if (type === 'boite') {
      if ((m = prendre(etat, new RegExp(N + ' (?:par|x|sur) ' + N + '(?: (?:par|x|sur) ' + N + ')?')))) {
        a.longueur = mm(m[1]); a.largeur = mm(m[2]); a.hauteur = m[3] ? mm(m[3]) : a.largeur;
      }
      if ((m = prendre(etat, new RegExp('\\blargeur(?: de)? ' + N)))) a.largeur = mm(m[1]);
      if ((m = prendre(etat, new RegExp('\\bhauteur(?: de)? ' + N)))) a.hauteur = mm(m[1]);
    }
    if (type !== 'fond' && type !== 'coude' && a.longueur === undefined) {
      if ((m = prendre(etat, new RegExp('\\b(?:longueur|long|mesure|fait)(?: de| a)? ' + N)))) a.longueur = mm(m[1]);
      else if ((m = prendre(etat, /(§\d+)/))) a.longueur = mm(m[1]);
      else if ((m = prendre(etat, /(?:^| )(\d{2,6}(?:\.\d+)?|\d\.\d+)(?= |$)/))) a.longueur = mm(m[1]);
    }
    return { a: a, reste: etat.s };
  }

  /* applique la dictée à une copie du relevé */
  function interpreter(texte, releve, unite, opts) {
    var r = normaliser(JSON.parse(JSON.stringify(releve)));
    var faits = [], doutes = [];
    var dire = function (t) { if (t.charAt(0) === '?') doutes.push(t.slice(1)); else faits.push(t); };
    var recueillir = function (liste) { liste.forEach(dire); };
    var chunks = preparer(texte), notes = entendus.slice();
    chunks = chunks.split(/ (?:\.|;|!|\?|puis|ensuite|apres ca|apres cela|apres|suivi d un|suivi d une|suivi de) /);

    chunks.forEach(function (brut) {
      var s = ' ' + brut.replace(/ , /g, ' ').replace(/\s+/g, ' ').trim() + ' ';
      if (!s.trim()) return;
      var m;
      var VERBE = '(?:efface[rz]?|supprime[rz]?|annule[rz]?|enleve[rz]?|retire[rz]?)';
      if (new RegExp('\\b' + VERBE + ' (?:tout|tous|toutes les pieces|l ensemble)\\b|\\brecommence\\b').test(s)) { r.pieces = []; faits.push('Tout effacé'); return; }
      if ((m = s.match(new RegExp('\\b' + VERBE + '(?: la| le)? (?:piece|element|numero)(?: numero)? (\\d+)\\b')))) {
        if (r.pieces[+m[1] - 1]) { r.pieces.splice(+m[1] - 1, 1); faits.push('Pièce ' + m[1] + ' supprimée'); } else doutes.push('Pas de pièce ' + m[1] + '.');
        return;
      }
      if (new RegExp('\\b' + VERBE + '(?: la| le)? dernier[e]?\\b|^ ' + VERBE + ' $').test(s)) { if (r.pieces.pop()) faits.push('Dernière pièce supprimée'); return; }

      var cible = -1;
      if ((m = s.match(/^ (?:(?:modifie[rz]?|change[rz]?|corrige[rz]?|sur|pour) )?(?:la |le )?(?:piece|numero|element)(?: numero)? (\d+) /))) {
        cible = +m[1] - 1;
        s = ' ' + s.slice(m[0].length);
        if (!r.pieces[cible]) { doutes.push('Pas de pièce ' + m[1] + '.'); return; }
      }

      var cles = cible < 0 ? motsCles(s) : [];
      if (!cles.length) {
        var etatG = { s: s }, g = [];
        var dernier = cible >= 0 ? cible : r.pieces.length - 1;
        var typeD = r.pieces[dernier] ? r.pieces[dernier].type : 'droit';
        reglagesGeneraux(etatG, r, g, !(typeD === 'te' && cible >= 0) && !(typeD === 'reduction' && cible >= 0));
        recueillir(g);
        var seul = attributs(etatG.s, typeD, unite, doutes);
        var cle = Object.keys(seul.a);
        if (cle.length && r.pieces[dernier] && (cible >= 0 || !(cle.length === 1 && cle[0] === 'longueur' && typeD !== 'droit'))) {
          r.pieces[dernier] = piece(Object.assign({}, r.pieces[dernier], seul.a));
          faits.push('Pièce ' + (dernier + 1) + ' modifiée');
        } else if (seul.a.longueur) {
          r.pieces.push(piece(Object.assign({ type: 'droit' }, attributs(etatG.s, 'droit', unite, []).a)));
          faits.push('Ajouté : ' + r.pieces.length + ' · Droit');
        } else if (!g.length) doutes.push('Pas compris : « ' + brut.replace(/§/g, '').trim() + ' ».');
        return;
      }

      var preambule = { s: s.slice(0, cles[0].i) }, gp = [];
      reglagesGeneraux(preambule, r, gp, true);
      recueillir(gp);
      /* correction d'un morceau : « un coude à 45 » change la pièce du même type, « ajoute un coude » en crée une */
      if (opts && opts.corrige && cles.length === 1 && r.pieces.length === 1 && cles[0].type === r.pieces[0].type && !/\b(?:ajoute\w*|rajoute\w*|autre|encore|nouveau)\b/.test(s)) {
        var etatC = { s: s.slice(0, cles[0].i) + ' ' + s.slice(cles[0].i) }, gc = [];
        reglagesGeneraux(etatC, r, gc, cles[0].type !== 'te' && cles[0].type !== 'reduction');
        recueillir(gc);
        var luC = attributs(etatC.s, cles[0].type, unite, doutes);
        r.pieces[0] = piece(Object.assign({}, r.pieces[0], luC.a));
        faits.push('Morceau corrigé');
        return;
      }
      cles.forEach(function (k, n) {
        var bout = (n === 0 ? preambule.s + ' ' : '') + s.slice(k.i, n + 1 < cles.length ? cles[n + 1].i : s.length);
        var etat = { s: ' ' + bout.replace(/\s+/g, ' ').trim() + ' ' }, g = [];
        reglagesGeneraux(etat, r, g, k.type !== 'te' && k.type !== 'reduction');
        recueillir(g);
        var lu = attributs(etat.s, k.type, unite, doutes);
        var neuve = piece(Object.assign({ type: k.type }, lu.a));
        if (r.pieces.length >= 80) { doutes.push('80 pièces au maximum par ensemble.'); return; }
        r.pieces.push(neuve);
        faits.push('Ajouté : ' + r.pieces.length + ' · ' + TYPES[k.type]);
        if (k.type === 'droit' && lu.a.longueur === undefined) doutes.push('Pièce ' + r.pieces.length + ' : longueur non dite, 1 000 mm par défaut.');
      });
    });
    return { releve: r, faits: faits, doutes: doutes.filter(function (d, i) { return doutes.indexOf(d) === i; }), corrections: notes };
  }

  /* ---------- métré PVC / laine : « en 60-40, 4 coudes et 12 mètres » ---------- */
  var QUOI = ['pvc', 'laine', 'coudePVC', 'coudeLaine', 'coquillesPVC', 'coquilles'];
  function metre(texte, base) {
    var entrees = JSON.parse(JSON.stringify(base || [])), doutes = [];
    var dernier = entrees[entrees.length - 1];
    var cur = { coq: dernier ? dernier.coq : 0, e: dernier ? dernier.e : 0 };
    var s = preparer(texte).replace(/\b(?:un|une) (?=coudes?|coquilles?)/g, '1 '), notes = entendus.slice();
    var phrases = s.split(/ (?:\.|;|!|\?|puis|ensuite|apres ca|apres cela|apres) /);

    phrases.forEach(function (phrase) {
      var p = ' ' + phrase.replace(/\s+/g, ' ').trim() + ' ';
      if (!p.trim()) return;
      if (/\b(?:efface\w*|supprime\w*|annule\w*|enleve\w*) (?:tout|toute la liste)\b/.test(p)) { entrees = []; cur = { coq: 0, e: 0 }; return; }
      if (/\b(?:efface\w*|supprime\w*|annule\w*|enleve\w*)\b/.test(p)) { entrees.pop(); return; }

      var jetons = [], libre = function (a, b) { return jetons.every(function (j) { return b <= j.i || a >= j.fin; }); };
      var chercher = function (re, faire) {
        var m;
        while ((m = re.exec(p))) {
          var j = faire(m);
          if (!j) { re.lastIndex = m.index + 1; continue; }
          j.i = m.index; j.fin = m.index + m[0].length;
          if (libre(j.i, j.fin)) jetons.push(j);
        }
      };
      chercher(/(?<![§\d.])(\d{2,3}) ?(?:x |par |sur |\/ ?| )(\d{2,3})(?![\d.])/g, function (m) { return paire(m[1], m[2]) ? { d: { coq: +m[1], e: +m[2] } } : null; });
      chercher(/\b(?:en|tuyau) (\d{2,3})(\d{2})\b/g, function (m) { return paire(m[1], m[2]) ? { d: { coq: +m[1], e: +m[2] } } : null; });
      chercher(/\bdn (\d+)\b/g, function (m) { var t = tubeDe(m[1]); return t ? { d: { coq: t.coq } } : null; });
      chercher(/\b(?:epaisseur|ep|isolant)(?: de| en)? §?(\d{2,3})\b/g, function (m) { return { d: { e: +m[1] } }; });
      chercher(/(\d+) coudes?\b/g, function (m) { return { q: 'coude', n: +m[1] }; });
      chercher(/(\d+) coquilles?\b/g, function (m) { return { q: 'coquille', n: +m[1] }; });
      chercher(/§(\d+)/g, function (m) { return { q: 'metre', n: +m[1] / 1000 }; });
      chercher(/\b(?:a )?(15|30|45|90) ?degres?\b|\ba (45|90)\b/g, function (m) { return { angle: +(m[1] || m[2]) }; });
      chercher(/\b(?:en|diametre|tuyau)(?: de)? (\d{2,3})(?![\d.])/g, function (m) { return COQ.indexOf(+m[1]) >= 0 ? { d: { coq: +m[1] } } : null; });
      jetons.sort(function (a, b) { return a.i - b.i; });

      var quantites = jetons.filter(function (j) { return j.q; });
      var separe = function (a, b) { return /(?:,| et )/.test(p.slice(a, b)); };
      var matiere = function (t) { var v = /\bpvc\b/.test(t), l = /\blaine\b/.test(t); return v || l ? { pvc: v, laine: l } : null; };
      var courante = null, posees = 0;
      var ouvrir = function (angle) {
        if (courante && courante.coq === cur.coq && courante.e === cur.e) return courante;
        courante = { coq: cur.coq, e: cur.e, q: {}, angles: {} };
        entrees.push(courante);
        return courante;
      };
      jetons.forEach(function (j, k) {
        if (j.d) {
          if (j.pris) return;
          cur = { coq: j.d.coq || cur.coq, e: j.d.e !== undefined ? j.d.e : (j.d.coq && j.d.coq !== cur.coq ? cur.e : cur.e) };
          courante = null; posees++;
          /* diamètre dit après coup : il complète les lignes qui n'en avaient pas */
          entrees.forEach(function (x) { if (!x.coq && cur.coq) x.coq = cur.coq; if (x.coq === cur.coq && !x.e && cur.e) x.e = cur.e; });
          return;
        }
        if (!j.q) return;
        /* « 4 coudes en 60-40 » : le diamètre qui suit sans virgule appartient à cette quantité */
        for (var m = k + 1; m < jetons.length && !jetons[m].q; m++) {
          var s2 = jetons[m];
          if (s2.d && !s2.pris && !separe(j.fin, s2.i)) { cur = { coq: s2.d.coq || cur.coq, e: s2.d.e !== undefined ? s2.d.e : cur.e }; s2.pris = true; courante = null; }
        }
        var n = quantites.indexOf(j), suivante = quantites[n + 1], precedente = quantites[n - 1];
        var apres = p.slice(j.fin, suivante ? suivante.i : p.length);
        var avant = p.slice(precedente ? precedente.fin : 0, j.i).split(/,| et /).pop();
        var mat = matiere(apres) || matiere(avant) || (precedente && !matiere(p.slice(precedente.fin, j.i)) ? null : null) || { pvc: true, laine: true };
        var angle = 0;
        jetons.forEach(function (a) { if (a.angle && a.i >= j.fin && a.i < (suivante ? suivante.i : p.length)) angle = a.angle; });
        var e = ouvrir(), ajouter = function (cle, v) { e.q[cle] = Math.round(((e.q[cle] || 0) + v) * 1000) / 1000; };
        var les2 = !mat.pvc && !mat.laine;
        if (j.q === 'coude') {
          if (mat.pvc || les2) ajouter('coudePVC', j.n);
          if (mat.laine || les2) ajouter('coudeLaine', j.n);
          if (angle) e.angles[angle] = (e.angles[angle] || 0) + j.n;
        } else if (j.q === 'metre') {
          if (mat.pvc) ajouter('pvc', j.n);
          if (mat.laine) ajouter('laine', j.n);
        } else {
          var vraies = matiere(apres) || matiere(avant);
          if (vraies && vraies.pvc && !vraies.laine) ajouter('coquillesPVC', j.n); else ajouter('coquilles', j.n);
        }
        posees++;
      });
      if (!posees) doutes.push('Pas compris : « ' + phrase.replace(/§(\d+)/g, '$1 mm').trim() + ' ».');
    });
    if (entrees.some(function (x) { return !x.coq; })) doutes.push('Diamètre non dit pour une ligne : dites par exemple « en 60-40 ».');
    else if (entrees.some(function (x) { return !x.e; })) doutes.push('Épaisseur non dite pour une ligne.');
    return { entrees: entrees, doutes: doutes.filter(function (d, i) { return doutes.indexOf(d) === i; }), corrections: notes };
  }

  /* totaux rangés par diamètre puis épaisseur */
  function recapitulatif(entrees) {
    var groupes = {};
    entrees.forEach(function (x) {
      var cle = x.coq + 'x' + x.e;
      var g = groupes[cle] || (groupes[cle] = { coq: x.coq, e: x.e, q: {}, angles: {} });
      QUOI.forEach(function (k) { if (x.q[k]) g.q[k] = Math.round(((g.q[k] || 0) + x.q[k]) * 1000) / 1000; });
      Object.keys(x.angles || {}).forEach(function (a) { g.angles[a] = (g.angles[a] || 0) + x.angles[a]; });
    });
    return Object.keys(groupes).map(function (k) { return groupes[k]; }).sort(function (a, b) { return a.coq - b.coq || a.e - b.e; });
  }

  root.CoteCalc = {
    metre: metre, recapitulatif: recapitulatif, poserCoquille: poserCoquille, COQ: COQ,
    TYPES: TYPES, SENS: SENS, FERMETURES: FERMETURES, MATIERES: MATIERES,
    nouveau: nouveau, piece: piece, normaliser: normaliser, geometrie: geometrie, debit: debit,
    interpreter: interpreter, preparer: preparer, corriger: corriger, resumePiece: resumePiece, texteFermeture: texteFermeture, nomDirection: nomDirection
  };
})(this);
