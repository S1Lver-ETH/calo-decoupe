/* Calo Découpe — interface */
(function () {
  'use strict';
  var C = window.Calc;
  var $ = function (id) { return document.getElementById(id); };
  var EPAISSEURS = [20, 25, 30, 40, 50, 60, 80, 100];
  /* publié sur claude.ai : la page ne peut ni imprimer ni télécharger seule, elle passe par l'hôte */
  var HEBERGE = !!(window.claude && window.claude.use);
  var enregistreur = HEBERGE ? window.claude.use('downloads') : null;
  var COQUILLES = [16, 21, 27, 32, 34, 42, 49, 54, 60, 76, 89, 114, 140];
  var CLE = 'calocoupe-v2';

  var DEFAUT = {
    tab: 'droit', theme: '', tube: 50, dLibre: 60.3, coq: 60, e: 30, recouv: 30,
    longueur: 10, lcoq: 1000, largeur: 1000,
    angle: 90, sections: 1, rayon: 76, rayonAuto: true,
    tube2: 25, dLibre2: 33.7, coq2: 34, e2: 30, gamma: 90, fermeture: 0, fermeture2: 180, longPrincipal: 0, unite: 'mm'
  };
  var S = Object.assign({}, DEFAUT);
  try { Object.assign(S, JSON.parse(localStorage.getItem(CLE) || '{}')); } catch (err) { /* stockage indisponible */ }
  function sauver() { try { localStorage.setItem(CLE, JSON.stringify(S)); } catch (err) { /* idem */ } }

  /* ---------- outils ---------- */
  function fmt(v, dec) {
    if (!isFinite(v)) return '–';
    var x = Number(v.toFixed(dec || 0));
    if (Object.is(x, -0)) x = 0;
    return x.toLocaleString('fr-FR', { maximumFractionDigits: dec || 0 });
  }
  /* Les calculs sont en millimètres ; seul l'affichage des cotes change d'unité. */
  function enCm() { return S.unite === 'cm'; }
  function un() { return enCm() ? 'cm' : 'mm'; }
  function lg(v, dec) { return fmt(enCm() ? v / 10 : v, (dec || 0) + (enCm() ? 1 : 0)); }
  function numLg(cle, v, dec) { return num(cle, enCm() ? v / 10 : v, (dec || 0) + (enCm() ? 1 : 0)); }
  var anciens = {};
  /* nombre qui défile jusqu'à sa nouvelle valeur */
  function num(cle, v, dec) {
    return '<span class="n" data-k="' + cle + '" data-v="' + v + '" data-d="' + (dec || 0) + '">' + fmt(v, dec) + '</span>';
  }
  function animer(racine) {
    var calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    racine.querySelectorAll('.n').forEach(function (el) {
      var k = el.dataset.k, v = +el.dataset.v, d = +el.dataset.d;
      var de = anciens[k];
      anciens[k] = v;
      if (calme || de === undefined || de === v || document.hidden) return;
      var t0 = null;
      el.textContent = fmt(de, d);
      requestAnimationFrame(function pas(t) {
        if (t0 === null) t0 = t;
        var p = Math.min(1, (t - t0) / 320), q = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(de + (v - de) * q, d);
        if (p < 1) requestAnimationFrame(pas);
      });
    });
  }
  function stat(titre, valeur, unite, aide, fort) {
    return '<div class="stat' + (fort ? ' hl' : '') + '"><span>' + titre + '</span><b>' + valeur + '</b><small>' + (unite || '') + '</small>' + (aide ? '<em>' + aide + '</em>' : '') + '</div>';
  }
  function table(entetes, lignes) {
    return '<div class="table"><table><thead><tr>' + entetes.map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>' + lignes.map(function (l) { return '<tr>' + l.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div>';
  }
  function chemin(pts, ferme) {
    return pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2); }).join('') + (ferme ? 'Z' : '');
  }
  function txt(x, y, s, ancre, cls) {
    return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="' + (ancre || 'middle') + '"' + (cls ? ' class="' + cls + '"' : '') + '>' + s + '</text>';
  }
  function svg(vb, corps, label) {
    return '<svg viewBox="' + vb + '" role="img" aria-label="' + label + '"><g class="anim">' + corps + '</g></svg>';
  }
  /* largeur des dessins à plat : plus étroite sur téléphone pour garder le texte lisible */
  var ETROIT = window.matchMedia('(max-width: 720px)');
  function largeurDessin() { return ETROIT.matches ? 360 : 640; }
  function tubeDe(dn) { return C.TUBES.filter(function (t) { return t.dn === +dn; })[0]; }

  /* ---------- modèles 3D ---------- */
  var scenes = {};
  /* la vue 3D est conservée d'un calcul à l'autre : on la replace dans la page et on la met à jour */
  function poserScene(type, titre, avecEclate, donnees, reglages) {
    if (!scenes[type]) scenes[type] = window.Scene3D.creer(type, titre, avecEclate, reglages);
    $('out-' + type).querySelector('[data-scene]').appendChild(scenes[type].el);
    scenes[type].definir(donnees);
  }

  /* ---------- remplissages des dessins : laine, PVC gris, acier, hachures ---------- */
  function textures() {
    var degrade = function (id, x2, y2, arrets) {
      return '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + x2 + '" y2="' + y2 + '">' + arrets.map(function (a) { return '<stop offset="' + a[0] + '" stop-color="' + a[1] + '"/>'; }).join('') + '</linearGradient>';
    };
    /* la même image de laine que les modèles 3D ; laine2 est un peu plus claire pour distinguer les pièces */
    var image = window.Scene3D.textureLaine().toDataURL('image/jpeg', 0.9);
    var motif = function (id, voile) {
      return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="200" height="200"><image href="' + image + '" width="200" height="200" preserveAspectRatio="none"/>' +
        (voile ? '<rect width="200" height="200" fill="#fff" opacity="' + voile + '"/>' : '') + '</pattern>';
    };
    document.body.insertAdjacentHTML('afterbegin', '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
      motif('laine') + motif('laine2', 0.17) +
      degrade('pvc', 1, 0.35, [[0, '#c2c8ce'], [0.25, '#d3d8dc'], [0.45, '#dee2e5'], [0.65, '#d1d6da'], [1, '#bdc4ca']]) +
      degrade('acier', 1, 1, [[0, '#b4bfcc'], [1, '#56657a']]) +
      '<pattern id="hachure" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)"><rect width="7" height="7" fill="rgba(90,104,122,.16)"/><path d="M0 0V7" stroke="rgba(55,68,86,.32)" stroke-width="1.5"/></pattern>' +
      '</defs></svg>');
  }

  /* ---------- feuilles PVC en gris, cotes reportées dessus ---------- */
  function pastille(x, y, s, W) {
    var w = s.length * 6.7 + 12;
    x = Math.max(w / 2 + 1, Math.min(W - w / 2 - 1, x));
    return '<rect class="pastille" x="' + (x - w / 2).toFixed(1) + '" y="' + (y - 10).toFixed(1) + '" width="' + w.toFixed(1) + '" height="20" rx="6"/><text class="pt" x="' + x.toFixed(1) + '" y="' + (y + 4.3).toFixed(1) + '" text-anchor="middle">' + s + '</text>';
  }
  function fleche(x1, y1, x2, y2, dehors) {
    var dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, t = Math.min(6, l / 3), ux = dx / l * t, uy = dy / l * t;
    return '<path class="mesure' + (dehors ? ' ext' : '') + '" d="' + chemin([[x1, y1], [x2, y2]]) +
      chemin([[x1 + ux - uy * 0.6, y1 + uy + ux * 0.6], [x1, y1], [x1 + ux + uy * 0.6, y1 + uy - ux * 0.6]]) +
      chemin([[x2 - ux - uy * 0.6, y2 - uy + ux * 0.6], [x2, y2], [x2 - ux + uy * 0.6, y2 - uy - ux * 0.6]]) + '"/>';
  }
  function dessinPVC(f, label, largeur) {
    var W = largeur || largeurDessin(), etroit = W < 500;
    var rangs = f.cotes.reduce(function (n, c) { return c.t === 'h' ? Math.max(n, c.rang + 1) : n; }, 0);
    var dehors = function (cote) { return f.cotes.some(function (c) { return c.dehors === cote; }); };
    var rangsG = f.cotes.reduce(function (n, c) { return c.dehors === 'gauche' ? Math.max(n, c.rang || 0) : n; }, 0);
    var mg = dehors('gauche') ? 56 + rangsG * 36 : 18, md = dehors('droite') ? 50 : 18, haut = f.reperes.length ? 34 : 14;
    var k = Math.min((W - mg - md) / f.w, (etroit ? 230 : 300) / Math.max(f.h, 1));
    var ox = mg + (W - mg - md - f.w * k) / 2;
    var px = function (x) { return ox + x * k; }, py = function (y) { return haut + y * k; };
    var map = function (p) { return [px(p[0]), py(p[1])]; };
    var g = '<path class="s-sheet" d="' + chemin(f.contour.map(map), true) + '"/>';
    (f.zones || []).forEach(function (z) { g += '<path class="s-zone" d="' + chemin(z.map(map), true) + '"/>'; });
    f.pointilles.forEach(function (l) { g += '<path class="s-dash" d="' + chemin(l.map(map)) + '"/>'; });
    (f.trous || []).forEach(function (t) { g += '<path class="s-wool s-trou" d="' + chemin(t.map(map), true) + '"/>'; });
    (f.guides || []).forEach(function (l) { g += '<path class="s-guide-pvc" d="' + chemin(l.map(map)) + '"/>'; });
    f.reperes.forEach(function (r) { if (!r.discret) g += txt(px(r.x), 18, r.t, 'middle', 'm'); });
    var etiq = '', places = [], diag = null, corde = '';
    /* pastille posée au-dessus d'un trait : remontée d'un cran si la place est prise */
    var auDessus = function (x, y, texte) {
      var demi = (texte.length * 6.7 + 12) / 2, cx = Math.max(demi + 1, Math.min(W - demi - 1, x));
      var pris = function (yy) { return places.some(function (q) { return Math.abs(q.x - cx) < q.demi + demi + 2 && Math.abs(q.y - yy) < 21; }); };
      while (pris(y) && y > 32) y -= 22;
      places.push({ x: cx, y: y, demi: demi });
      return pastille(cx, y, texte, W);
    };
    f.cotes.forEach(function (c) {
      if (c.t === 'v') {
        var x = px(c.x) + (c.dehors === 'gauche' ? -28 - (c.rang || 0) * 36 : c.dehors === 'droite' ? 26 : 0), y1 = py(c.y1), y2 = py(c.y2);
        if (c.dehors) {
          var ref = px(c.xRef === undefined ? c.x : c.xRef);
          g += '<path class="rappel" d="M' + x + ' ' + y1 + 'H' + ref + 'M' + x + ' ' + y2 + 'H' + ref + '"/>';
        }
        g += fleche(x, y1, x, y2, !!c.dehors);
        etiq += c.ou === 'haut' ? auDessus(x, y1 - 13, c.texte) : pastille(x, (y1 + y2) / 2, c.texte, W);
      } else if (c.t === 'z') {
        g += '<circle class="point" cx="' + px(c.x) + '" cy="' + py(c.y) + '" r="3.5"/>';
        etiq += auDessus(px(c.x), py(c.y) - 13, c.texte);
      } else if (c.t === 'point') {
        g += '<circle class="point" cx="' + px(c.x) + '" cy="' + py(c.y) + '" r="3.5"/>';
        if (c.texte) etiq += txt(px(c.x) + c.dx, py(c.y) + c.dy, c.texte, 'middle', 'sur');
      } else if (c.t === 'corde') {
        var d1 = [px(c.x1), py(c.y1)], d2 = [px(c.x2), py(c.y2)], milieu = [(d1[0] + d2[0]) / 2, (d1[1] + d2[1]) / 2];
        g += '<path class="compas" d="' + chemin([d1, d2]) + '"/><path class="compas-lien" d="' + chemin([milieu, [milieu[0] + c.dx, milieu[1] + c.dy]]) + '"/>';
        corde = pastille(milieu[0] + c.dx, milieu[1] + c.dy, c.texte, W);
      } else if (c.t === 'diag') {
        var a1 = [px(c.x1), py(c.y1)], a2 = [px(c.x2), py(c.y2)];
        g += '<path class="compas" d="' + chemin([a1, a2]) + '"/><circle class="point" cx="' + a1[0] + '" cy="' + a1[1] + '" r="3.5"/><circle class="point" cx="' + a2[0] + '" cy="' + a2[1] + '" r="3.5"/>';
        /* libellé au-dessus des cotes, relié au trait entre deux cotes verticales */
        var t = Math.min(0.5, 22.5 * (f.degre || 0) / Math.max(1e-6, Math.abs(c.x2 - c.x1)));
        var mx = a1[0] + (a2[0] - a1[0]) * t, ly = py(c.base) - 40;
        var my = py(c.hauteurA(c.x1 + (c.x2 - c.x1) * t));
        g += '<path class="compas-lien" d="' + chemin([[mx, my], [mx, ly]]) + '"/>';
        diag = { x: mx, y: ly, texte: c.texte };
      } else if (c.t === 'h') {
        var yy = py(f.h) + 20 + c.rang * 28, a = px(c.x1), b = px(c.x2), base = py(c.yRef === undefined ? f.h : c.yRef);
        g += '<path class="rappel" d="M' + a + ' ' + base + 'V' + yy + 'M' + b + ' ' + base + 'V' + yy + '"/>' + fleche(a, yy, b, yy, true);
        /* segment trop court pour sa pastille : on la décale au-dessus du trait */
        etiq += pastille((a + b) / 2, Math.abs(b - a) < c.texte.length * 6.7 + 16 && c.rang === 0 && c.chaine ? yy - 12 : yy, c.texte, W);
      } else {
        var X = px(c.x), Y = py(c.y);
        g += '<path class="mesure" d="M' + X + ' ' + Y + 'l' + c.dx + ' ' + c.dy + '"/><circle class="point" cx="' + X + '" cy="' + Y + '" r="3.5"/>';
        etiq += pastille(X + c.dx, Y + c.dy, c.texte, W);
      }
    });
    if (diag) etiq += auDessus(diag.x, diag.y, diag.texte);
    etiq += corde;
    var total = py(f.h) + (rangs ? 18 + rangs * 28 : 14);
    return svg('0 0 ' + W + ' ' + total.toFixed(0), g + etiq, label);
  }
  function rect(x0, y0, x1, y1) { return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; }

  /* feuille d'une virole droite (hauteur non à l'échelle) */
  function dessinFeuille(r) {
    var w = r.feuille, h = w * 0.5, rc = Math.min(S.recouv, h / 3);
    var f = {
      w: w, h: h, contour: rect(0, 0, w, h), reperes: [],
      zones: rc > 0 ? [rect(r.dev, 0, w, h), rect(0, 0, r.dev, rc)] : [],
      pointilles: rc > 0 ? [[[r.dev, 0], [r.dev, h]], [[0, rc], [r.dev, rc]]] : [],
      cotes: [
        { t: 'v', x: 0, y1: 0, y2: h, dehors: 'gauche', texte: lg(S.largeur) },
        { t: 'h', x1: 0, x2: r.dev, rang: 0, texte: 'Développé ' + lg(r.dev) },
        { t: 'h', x1: 0, x2: w, rang: 1, texte: 'Feuille à couper ' + lg(w) }
      ]
    };
    if (rc > 0) {
      f.cotes.push({ t: 'h', x1: r.dev, x2: w, rang: 0, texte: lg(S.recouv) });
      f.cotes.push({ t: 'rep', x: r.dev * 0.5, y: rc / 2, dx: 0, dy: 46, texte: 'recouvrement ' + lg(S.recouv) });
    }
    return dessinPVC(f, 'Feuille PVC d’une virole droite');
  }

  /* ---------- données communes ---------- */
  function resume() {
    var D = C.diametreFini(S.coq, S.e);
    $('summary').innerHTML = [
      ['Ø tube', numLg('s-d', S.tube === 'libre' ? S.dLibre : tubeDe(S.tube).d, 1) + ' ' + un()],
      ['Épaisseur', numLg('s-e', S.e, 1) + ' ' + un()],
      ['Ø fini isolé', numLg('s-D', D, 1) + ' ' + un()],
      ['Développé isolant', numLg('s-dev', C.developpe(D)) + ' ' + un()],
      ['Feuille PVC', numLg('s-pvc', C.developpe(D) + S.recouv) + ' ' + un()]
    ].map(function (x) { return '<div><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('');
    $('summary').insertAdjacentHTML('afterbegin', alerteCoquille(S.coq, S.tube === 'libre' ? S.dLibre : tubeDe(S.tube).d, 'tube'));
    animer($('summary'));
  }

  /* signale une coquille qui ne correspond pas au tube */
  function alerteCoquille(coq, d, quoi) {
    return coq > 0 && (coq < d - 1 || coq > d + 3) ? '<div class="warn mini" role="alert">Coquille Ø ' + lg(coq, 1) + ' ' + un() + (coq < d ? ' plus petite' : ' plus grande') + ' que le ' + quoi + ' Ø ' + lg(d, 1) + ' ' + un() + ' : vérifiez votre choix.</div>' : '';
  }

  /* rappel des réglages repliés */
  function recaps() {
    $('recapBase').textContent = 'Recouvrement ' + lg(S.recouv, 1) + ' ' + un();
    $('recapDroit').textContent = 'Coquille ' + lg(S.lcoq) + ' ' + un() + ' · virole ' + lg(S.largeur) + ' ' + un();
    $('recapCoude').textContent = 'Rayon ' + lg(S.rayon, 1) + ' ' + un();
  }

  /* ---------- développés ---------- */
  function dessinCoupe(d, r) {
    var k = 105 / (r.D / 2), R = r.D / 2 * k, rc = S.coq / 2 * k, rt = Math.min(d, S.coq) / 2 * k;
    var a = Math.min(300, S.recouv / (r.D / 2) * 180 / Math.PI);
    var pol = function (ang, ray) { var t = ang * Math.PI / 180; return [170 + ray * Math.sin(t), 140 - ray * Math.cos(t)]; };
    var p0 = pol(120, R + 8), p1 = pol(120 + a, R + 8);
    var g = '<circle class="s-wool" cx="170" cy="140" r="' + R + '"/>' +
      '<circle class="s-hole" cx="170" cy="140" r="' + rc + '"/>' +
      '<circle class="s-steel" cx="170" cy="140" r="' + rt + '"/>' +
      '<circle class="s-hole" cx="170" cy="140" r="' + Math.max(0, rt - Math.max(3, rt * .12)) + '"/>' +
      '<circle class="s-pvc" cx="170" cy="140" r="' + (R + 3) + '"/>' +
      (S.recouv > 0 ? '<path class="s-pvc" d="M' + p0[0] + ' ' + p0[1] + 'A' + (R + 8) + ' ' + (R + 8) + ' 0 ' + (a > 180 ? 1 : 0) + ' 1 ' + p1[0] + ' ' + p1[1] + '"/>' : '') +
      '<path class="s-dim" d="M' + (170 - R) + ' 270H' + (170 + R) + 'M' + (170 - R) + ' 140V276M' + (170 + R) + ' 140V276"/>' +
      txt(170, 288, 'Ø fini ' + lg(r.D, 1)) +
      '<path class="s-dim" d="M170 ' + (140 - rc) + 'V' + (140 - R) + '"/>' +
      txt(176, 140 - (R + rc) / 2 + 4, 'é ' + lg(S.e, 1), 'start');
    return svg('0 0 340 296', g, 'Coupe du tuyau isolé');
  }

  function rendreDroit() {
    var d = S.tube === 'libre' ? S.dLibre : tubeDe(S.tube).d;
    var r = C.droit({ dInt: S.coq, e: S.e, recouv: S.recouv, longueur: S.longueur, longueurCoquille: S.lcoq, largeur: S.largeur });
    var html = '<div class="big">' +
      stat('Feuille PVC à couper', numLg('d-f', r.feuille), un(), 'développé + ' + lg(S.recouv) + ' ' + un() + ' de recouvrement', true) +
      stat('Développé sur isolant', numLg('d-dev', r.dev, 1), un(), 'π × ' + lg(r.D, 1)) +
      stat('Développé du tube nu', numLg('d-tube', C.developpe(d), 1), un(), 'π × ' + lg(d, 1)) +
      stat('Ø fini isolé', numLg('d-D', r.D, 1), un(), lg(S.coq, 1) + ' + 2 × ' + lg(S.e, 1)) +
      '</div>';
    if (S.longueur > 0) {
      html += '<div class="big">' +
        stat('Coquilles', num('m-c', r.coquilles), 'pièces', 'de ' + lg(S.lcoq) + ' ' + un() + ', hors chutes') +
        stat('Viroles PVC', num('m-v', r.viroles), 'pièces', lg(S.largeur) + ' × ' + lg(r.feuille) + ' ' + un()) +
        stat('Surface PVC', num('m-s', r.surfacePVC, 2), 'm²', 'hors chutes') +
        stat('Volume de laine', num('m-vol', r.volumeIsolant, 3), 'm³', 'sur ' + fmt(S.longueur, 2) + ' m') +
        '</div>';
    }
    var eps = EPAISSEURS.indexOf(S.e) < 0 ? EPAISSEURS.concat(S.e).sort(function (a, b) { return a - b; }) : EPAISSEURS;
    var lignes = eps.map(function (e) {
      var D = C.diametreFini(S.coq, e);
      return '<tr class="clic' + (e === S.e ? ' on' : '') + '" data-e="' + e + '" tabindex="0"><td>' + lg(e, 1) + ' ' + un() + '</td><td>' + lg(D, 1) + '</td><td>' + lg(C.developpe(D)) + '</td><td><b>' + lg(C.developpe(D) + S.recouv) + '</b></td></tr>';
    }).join('');
    html += '<div class="grid"><div class="full" data-scene></div>' +
      '<figure class="card draw full"><h2>Feuille PVC à découper</h2>' + dessinFeuille(r) +
      '<figcaption>Cotes en ' + un() + '. Zones hachurées : recouvrements. La hauteur (largeur de la virole) n’est pas dessinée à l’échelle.</figcaption></figure>' +
      '<figure class="card draw"><h2>Coupe</h2>' + dessinCoupe(d, r) + '<figcaption>Laine de roche et, en gris, la feuille PVC avec son recouvrement.</figcaption></figure>' +
      '<div class="card"><h2>Toutes les épaisseurs pour ce tube</h2><div class="table"><table><thead><tr><th>Épaisseur</th><th>Ø fini</th><th>Développé</th><th>Feuille PVC</th></tr></thead><tbody>' + lignes + '</tbody></table></div><p class="note">Touchez une ligne pour choisir cette épaisseur. Cotes en ' + un() + '.</p></div>' +
      '</div>';
    $('out-droit').innerHTML = html;
    poserScene('droit', 'Modèle 3D : tuyau isolé', false, {
      d: d, D: r.D, coq: S.coq, recouv: S.recouv,
      textes: { diametre: 'Ø ' + lg(r.D, 1), laine: 'Laine ' + lg(S.e, 1), virole: 'Virole ' + lg(S.largeur), feuille: 'Feuille PVC ' + lg(r.feuille), recouv: 'Recouvr. ' + lg(S.recouv) },
      legendePVC: 'Cotes en ' + un() + ' ; longueurs raccourcies.', legendeLaine: 'Cotes en ' + un() + ' ; longueurs raccourcies.'
    }, { libre: true, bouton: 'Recentrer' });
  }

  /* ---------- coude ---------- */
  function dessinDebit(c, pieces) {
    var L = c.longueurDebit, W = largeurDessin(), H = 120, k = (W - 40) / L;
    var g = '', pa = 0, pb = 0, finA = -99, finB = -99;
    pieces.forEach(function (p, i) {
      var q = [[20 + pa * k, 30], [20 + p.A * k, 30], [20 + p.B * k, 30 + H], [20 + pb * k, 30 + H]];
      g += '<path class="' + (i % 2 ? 's-wool2' : 's-wool') + '" d="' + chemin(q, true) + '"/>';
      g += txt(20 + (pa + p.A + pb + p.B) / 4 * k, 30 + H / 2 + 4, pieces.length * 80 > W ? String(i + 1) : (p.entiere ? 'Section ' : 'Demi ') + (i + 1));
      if (i < pieces.length - 1) {
        /* repères omis s'ils se chevauchent : le tableau les donne tous */
        if (20 + p.A * k - finA > 46) { finA = 20 + p.A * k; g += txt(finA, 20, 'A ' + lg(p.A)); }
        if (20 + p.B * k - finB > 46) { finB = 20 + p.B * k; g += txt(finB, 30 + H + 18, 'B ' + lg(p.B)); }
      }
      pa = p.A; pb = p.B;
    });
    g += txt(20, 30 + H + 36, '0', 'start', 'm') + txt(W - 20, 30 + H + 36, 'Longueur totale ' + lg(L), 'end', 'm');
    return svg('0 0 ' + W + ' ' + (H + 72), g, 'Plan de débit sur coquille droite');
  }

  /* Développé à plat d'une pièce PVC de coude : dos au milieu, joint au ventre */
  function formePVC(c, entiere) {
    var N = 72, haut = [], bas = [], net = [], W = c.dev;
    for (var i = 0; i <= N; i++) {
      var th = -180 + 360 * i / N, h = C.hauteurSecteur(c, th, entiere), x = W * i / N;
      var yb = entiere ? -h / 2 : 0, yh = entiere ? h / 2 : h;
      bas.push([x, yb]); net.push([x, yh]); haut.push([x, yh + S.recouv]);
    }
    var fin = W + S.recouv, bordHaut = haut.slice();
    haut.push([fin, haut[N][1]]);
    bas.push([fin, bas[N][1]]);
    var contour = haut.concat(bas.slice().reverse());
    var ymin = Math.min.apply(null, contour.map(function (p) { return p[1]; }));
    var ymax = Math.max.apply(null, contour.map(function (p) { return p[1]; }));
    var norm = function (p) { return [p[0], ymax - p[1]]; };
    /* cotes verticales à reporter : ventre, quart (90°) et dos */
    var cotes = [0, N / 4, N / 2].map(function (i) {
      return { t: 'v', x: bas[i][0], y1: ymax - haut[i][1], y2: ymax - bas[i][1], dehors: i === 0 ? 'gauche' : undefined, texte: lg(haut[i][1] - bas[i][1]) };
    });
    cotes.push({ t: 'h', x1: 0, x2: W, rang: 0, texte: 'Développé ' + lg(W) });
    cotes.push({ t: 'h', x1: 0, x2: fin, rang: 1, texte: 'Largeur à couper ' + lg(fin) });
    var zones = [];
    if (S.recouv > 0) {
      var q = N * 3 / 4;
      cotes.push({ t: 'h', x1: W, x2: fin, rang: 0, texte: lg(S.recouv) });
      if (!ETROIT.matches) cotes.push({ t: 'rep', x: net[q][0], y: ymax - net[q][1] - S.recouv / 2, dx: 18, dy: -34, texte: 'recouvr. ' + lg(S.recouv) });
      zones = [bordHaut.concat(net.slice().reverse()).map(norm), [[W, haut[N][1]], [fin, haut[N][1]], [fin, bas[N][1]], [W, bas[N][1]]].map(norm)];
    }
    return {
      titre: (entiere ? 'PVC - section entiere' : 'PVC - demi-section') + ' - coude ' + fmt(c.angle) + ' deg - D ' + lg(c.D, 1) + ' ' + un(),
      w: fin, h: ymax - ymin, contour: contour.map(norm), zones: zones, cotes: cotes,
      pointilles: [net.map(norm), [[W, bas[N][1]], [W, net[N][1]]].map(norm)],
      reperes: [{ x: W / 2, t: 'dos' }, { x: W / 4, t: '90°' }, { x: 0, t: 'ventre' }, { x: W, t: 'ventre' }]
    };
  }

  /* Gabarit de coupe à enrouler sur la coquille */
  function formeCoquille(c, entiere) {
    var N = 72, haut = [], bas = [], W = c.dev;
    var hmax = C.hauteurSecteur(c, 0, entiere);
    for (var i = 0; i <= N; i++) {
      var th = -180 + 360 * i / N, h = C.hauteurSecteur(c, th, entiere), x = W * i / N;
      haut.push([x, entiere ? hmax / 2 - h / 2 : hmax - h]);
      bas.push([x, entiere ? hmax / 2 + h / 2 : hmax]);
    }
    return {
      titre: (entiere ? 'Coquille - section entiere' : 'Coquille - demi-section') + ' - coude ' + fmt(c.angle) + ' deg - D ' + lg(c.D, 1) + ' ' + un(),
      w: W, h: hmax, contour: haut.concat(bas.reverse()), pointilles: [],
      reperes: [{ x: W / 2, t: 'dos' }, { x: 0, t: 'ventre' }, { x: W, t: 'ventre' }]
    };
  }

  var gabarits = {};
  function boutons(id) {
    return '<div class="actions"><button type="button" class="btn primary" data-print="' + id + '">Imprimer le gabarit 1:1</button><button type="button" class="btn" data-svg="' + id + '">Télécharger en SVG</button></div>';
  }

  function rendreCoude() {
    var out = $('out-coude');
    if (!(S.rayon > 0 && S.angle >= 5 && S.angle <= 180)) { out.innerHTML = '<div class="warn">Indiquez un angle entre 5 et 180° et un rayon positif.</div>'; return; }
    var c = C.coude({ dInt: S.coq, e: S.e, angle: S.angle, sections: S.sections, R: S.rayon });
    var html = '';
    if (c.ventreNegatif) {
      var Rm = Math.ceil(C.rayonPourVentre({ dInt: S.coq, e: S.e, angle: S.angle, sections: S.sections }, 5));
      html += '<div class="warn" role="alert"><b>Les coupes se croisent à l’intérieur du coude.</b> L’isolant (rayon ' + lg(c.r, 1) + ' ' + un() + ') est plus gros que le rayon du coude (' + lg(c.R, 1) + ' ' + un() + '). Le ventre est ramené à 0 : taillez en pointe et ajustez à l’intérieur. Sinon, tracez avec un rayon plus grand et contrôlez l’ajustement sur le tube.<br><button type="button" class="btn" data-rayon="' + Rm + '">Tracer avec un rayon de ' + lg(Rm) + ' ' + un() + ' (ventre ≈ ' + lg(5) + ' ' + un() + ')</button></div>';
    }
    html += '<div class="big">' +
      stat('Angle de coupe', num('c-b', c.beta, 2), '°', 'par rapport à la coupe d’équerre', true) +
      stat('Pièces', String(c.n + 2), '', c.n + ' entière' + (c.n > 1 ? 's' : '') + ' + 2 demies, ' + c.joints + ' joint' + (c.joints > 1 ? 's' : '')) +
      stat('Ø fini isolé', numLg('c-D', c.D, 1), un(), 'développé ' + lg(c.dev) + ' ' + un()) +
      (c.ventreNegatif ? '' : stat('Coquille consommée', numLg('c-L', c.longueurDebit), un(), 'par coude, pièces tête-bêche')) +
      '</div>';

    var carte = function (titre, qte, m, cle) {
      return '<div class="card"><div class="piece"><h2>' + titre + '</h2><span class="tag">× ' + qte + '</span></div><div class="cotes">' +
        ['dos', 'axe', 'ventre'].map(function (n) {
          return '<div><span>' + n.charAt(0).toUpperCase() + n.slice(1) + ' (' + un() + ')</span><b>' + numLg(cle + n, Math.max(0, m[n])) + '</b></div>';
        }).join('') + '</div></div>';
    };
    html += '<div class="grid">' + (c.n > 0 ? carte('Coquille : section entière', c.n, c.entiere, 'ce-') : '') + carte('Coquille : demi-section', 2, c.demi, 'cd-') + '</div>';
    var morceaux = [];
    for (var m = 0; m < c.n + 2; m++) morceaux.push(m > 0 && m < c.n + 1);
    var cote = function (ent, angle, plus) { return lg(C.hauteurSecteur(c, angle, ent) + plus); };
    html += '<div class="grid"><div class="full" data-scene></div>' +
      '<div class="card full"><h2>Cotes de chaque morceau</h2>' +
      table(['Morceau', 'Laine dos', 'Laine ventre', 'PVC dos', 'PVC ventre'], morceaux.map(function (ent, i) {
        return [(i + 1) + ' · ' + (ent ? 'section' : 'demie'), '<b>' + cote(ent, 0, 0) + '</b>', '<b>' + cote(ent, 180, 0) + '</b>', cote(ent, 0, S.recouv), cote(ent, 180, S.recouv)];
      })) + '<p class="note">Cotes en ' + un() + '. Les cotes PVC comprennent ' + lg(S.recouv) + ' ' + un() + ' de recouvrement.</p></div>';

    var angles = [0, 30, 60, 90, 120, 150, 180];
    html += '<div class="card full"><h2>Points de traçage autour de la coquille</h2>' +
      table(['Depuis le dos', 'Sur le pourtour', 'Demie', 'Entière'], angles.map(function (a) {
        return [a + '°' + (a === 0 ? ' (dos)' : a === 180 ? ' (ventre)' : ''), lg(c.dev * a / 360), lg(C.hauteurSecteur(c, a, false)), c.n ? '<b>' + lg(C.hauteurSecteur(c, a, true)) + '</b>' : '–'];
      })) + '<p class="note">Cotes en ' + un() + '. Reportez chaque distance à gauche et à droite du dos, puis la longueur sur la génératrice. Reliez les points à la règle souple.</p></div></div>';

    if (!c.ventreNegatif) {
      var p = C.debit(c);
      html += '<div class="grid"><figure class="card draw full"><h2>Débit sur une coquille droite</h2>' + dessinDebit(c, p) +
        '<figcaption>Tracez deux génératrices opposées (A dessus, B dessous). Depuis un bout d’équerre, reportez les repères (cotes cumulées), joignez A à B, coupez, puis tournez d’un demi-tour une pièce sur deux. Prévoyez l’épaisseur du trait de scie ou de lame si nécessaire.</figcaption>' +
        table(['Coupe', 'Repère A', 'Repère B'], p.slice(0, -1).map(function (x, i) { return ['Coupe ' + (i + 1), lg(x.A), lg(x.B)]; }).concat([['Fin (équerre)', lg(c.longueurDebit), lg(c.longueurDebit)]])) +
        '</figure></div>';
    }

    gabarits = {};
    html += '<div class="grid">';
    (c.n > 0 ? [true, false] : [false]).forEach(function (ent) {
      var id = ent ? 'pvc-e' : 'pvc-d', idc = ent ? 'coq-e' : 'coq-d';
      var f = formePVC(c, ent);
      gabarits[id] = f;
      gabarits[idc] = formeCoquille(c, ent);
      var hd = C.hauteurSecteur(c, 0, ent), hv = C.hauteurSecteur(c, 180, ent);
      html += '<figure class="card draw full"><div class="piece"><h2>PVC : ' + (ent ? 'section entière' : 'demi-section') + '</h2><span class="tag">× ' + (ent ? c.n : 2) + '</span></div>' +
        dessinPVC(f, 'Pièce PVC à plat avec ses cotes') +
        '<div class="cotes"><div><span>Largeur à couper (' + un() + ')</span><b>' + numLg(id + 'w', f.w) + '</b></div><div><span>Au dos, recouvr. compris (' + un() + ')</span><b>' + numLg(id + 'd', hd + S.recouv) + '</b></div><div><span>Au ventre, recouvr. compris (' + un() + ')</span><b>' + numLg(id + 'v', hv + S.recouv) + '</b></div></div>' +
        '<figcaption>Cotes en ' + un() + ', recouvrement compris. Bord du dessin : coupe. Zones hachurées : recouvrement' + (ent ? ' (bord courbe et joint longitudinal).' : ' ; le bord droit rejoint la virole de la partie droite, qui vient le recouvrir.') + '</figcaption>' +
        boutons(id) + '</figure>';
    });
    html += '</div><div class="card"><h2>Gabarits de coupe à enrouler sur la coquille</h2><p class="note">Imprimez à 100 % (taille réelle), vérifiez la règle de ' + lg(100) + ' ' + un() + ', assemblez les feuilles puis enroulez autour de la coquille.</p><div class="actions">' +
      (c.n > 0 ? '<button type="button" class="btn" data-print="coq-e">Imprimer : section entière</button>' : '') +
      '<button type="button" class="btn" data-print="coq-d">Imprimer : demi-section</button></div></div>';
    out.innerHTML = html;

    var textes = function (plus) {
      var court = ETROIT.matches;
      return {
        dos: morceaux.map(function (ent, i) { return (i + 1) + ' · ' + (court ? 'D ' : 'Dos ') + cote(ent, 0, plus); }),
        ventre: morceaux.map(function (ent, i) { return (i + 1) + ' · ' + (court ? 'V ' : 'Ventre ') + cote(ent, 180, plus); }),
        diametre: 'Ø ' + lg(c.D, 1)
      };
    };
    poserScene('coude', 'Le coude vu de côté, en 3D', true, {
      c: c, coq: S.coq, d: S.tube === 'libre' ? S.dLibre : tubeDe(S.tube).d,
      fiches: morceaux.map(function (ent, i) {
        return {
          titre: 'Morceau ' + (i + 1) + ' · ' + (ent ? 'section entière' : 'demi-section'), unite: un(),
          cotes: [['Laine dos', cote(ent, 0, 0)], ['Laine ventre', cote(ent, 180, 0)], ['PVC dos', cote(ent, 0, S.recouv)], ['PVC ventre', cote(ent, 180, S.recouv)]]
        };
      }),
      textesPVC: textes(S.recouv), textesLaine: textes(0),
      legendePVC: 'Cotes PVC en ' + un() + ', recouvrement compris.', legendeLaine: 'Cotes de coupe des coquilles en ' + un() + ', sur l’extérieur de l’isolant.'
    }, { pvc: false, libre: true, selection: true, bouton: 'Vue de côté' });
  }

  /* ---------- piquage ---------- */
  /* Le bord bas du gabarit est la coupe qui vient en appui sur le principal.
     depart = angle autour du piquage où le gabarit s'ouvre et se referme (0° = axe du principal).
     pvc = true ajoute le recouvrement longitudinal ; pvc = false donne le gabarit de la coquille. */
  function formePiquage(p, pvc, depart) {
    var rc = pvc ? S.recouv : 0, N = 360;
    var coupe = [];
    for (var i = 0; i <= N; i++) coupe.push([p.dev2 * i / N, p.ordonnee(depart + 360 * i / N)]);
    var base = -Math.max(70, S.recouv + 40);
    var fin = p.dev2 + rc, yFin = coupe[N][1];
    var pts = [[0, base], [fin, base], [fin, yFin]].concat(coupe.slice().reverse());
    var norm = function (q) { return [q[0], q[1] - base]; };
    var zero = -base;
    var reperes = C.reperesPiquage(p, depart);
    var cotes = [];
    reperes.forEach(function (q, i) {
      if (i === reperes.length - 1) return;                    /* même cote qu'au bord gauche */
      if (q.zero) cotes.push({ t: 'z', x: q.x, y: zero, texte: '0' });
      else cotes.push({ t: 'v', x: q.x, y1: zero, y2: zero + q.y, ou: q.bord ? undefined : 'haut', dehors: q.bord ? 'gauche' : undefined, texte: lg(q.y) });
    });
    /* cotes intermédiaires tous les 45° quand la place le permet */
    if (!ETROIT.matches) {
      for (var a = 45; a < 720; a += 90) {
        var t = a - depart;
        if (t > 20 && t < 340 && p.ordonnee(a) >= 1) cotes.push({ t: 'v', x: p.dev2 * t / 360, y1: zero, y2: zero + p.ordonnee(a), ou: 'haut', texte: lg(p.ordonnee(a)) });
      }
    }
    /* trait de compas : du premier zéro au fond de gueule de loup le plus proche */
    var paire = null;
    reperes.forEach(function (z) {
      if (!z.zero) return;
      reperes.forEach(function (c) {
        if (c.creux && (!paire || Math.abs(c.x - z.x) < Math.abs(paire[1].x - paire[0].x) - 0.01)) paire = [z, c];
      });
    });
    if (paire && p.profondeur >= 1) {
      cotes.push({ t: 'diag', base: zero, hauteurA: function (x) { var q = paire[0], r = paire[1]; return zero + q.y + (r.y - q.y) * (x - q.x) / (r.x - q.x); }, x1: paire[0].x, y1: zero + paire[0].y, x2: paire[1].x, y2: zero + paire[1].y,
        texte: 'compas ' + lg(Math.hypot(paire[1].x - paire[0].x, paire[1].y - paire[0].y)) });
    }
    /* chaîne de cotes le long du développé */
    reperes.slice(1).forEach(function (q) { cotes.push({ t: 'h', x1: q.x - q.pas, x2: q.x, rang: 0, chaine: true, texte: lg(q.pas) }); });
    cotes.push({ t: 'h', x1: 0, x2: p.dev2, rang: 1, texte: 'Développé ' + lg(p.dev2) });
    var zones = [], pointilles = [];
    if (rc > 0) {
      cotes.push({ t: 'h', x1: p.dev2, x2: fin, rang: 1, texte: lg(rc) });
      cotes.push({ t: 'h', x1: 0, x2: fin, rang: 2, texte: 'Largeur à couper ' + lg(fin) });
      zones = [[[p.dev2, base], [fin, base], [fin, yFin], [p.dev2, yFin]].map(norm)];
      pointilles = [[[p.dev2, base], [p.dev2, yFin]].map(norm)];
    }
    return {
      zones: zones, cotes: cotes, guides: [[[0, 0], [p.dev2, 0]].map(norm)],
      degre: p.dev2 / 360,
      titre: (pvc ? 'PVC' : 'Coquille') + ' - piquage D ' + lg(p.D2, 1) + ' sur D ' + lg(p.D1, 1) + ' ' + un() + ' a ' + fmt(p.gamma) + ' deg - ouverture ' + fmt(depart) + ' deg',
      w: fin, h: p.profondeur - base, contour: pts.map(norm), pointilles: pointilles,
      /* un repère trop près d'un bord n'est pas écrit : il se confondrait avec celui du bord */
      reperes: reperes.slice().sort(function (a, b) { return (b.bord * 2 + b.creux) - (a.bord * 2 + a.creux); }).reduce(function (gardes, q) {
        if (gardes.every(function (g) { return Math.abs(g.x - q.x) > p.dev2 * 0.075; })) gardes.push({ x: q.x, t: q.angle + '°' });
        return gardes;
      }, [])
    };
  }

  /* partie du gabarit qui change avec le curseur de fermeture */
  var piquageCourant = null;
  function contenuGabarit() {
    var p = piquageCourant.p, f = formePiquage(p, true, S.fermeture);
    gabarits.piq = f;
    var z = C.zeroAuCreux(p);
    var tuile = function (titre, v, aide) { return '<div><span>' + titre + '</span><b>' + lg(v) + ' <small>' + un() + '</small></b><em>' + aide + '</em></div>'; };
    var points = C.reperesPiquage(p, S.fermeture);
    return dessinPVC(f, 'Gabarit PVC du piquage avec ses cotes') +
      '<figcaption>Cotes en ' + un() + '. Trait mixte : trait d’équerre, d’où partent les descentes. Bord du dessin : coupe du PVC, ajustée sur le principal.' + (S.recouv > 0 ? ' Bande hachurée : recouvrement de fermeture.' : '') + ' Trait de couleur : ouverture de compas. Le haut du gabarit est une réserve de longueur à adapter.</figcaption>' +
      '<div class="compas-bloc"><div class="piece"><h3>Au compas</h3><div class="bascule onglets" role="group" aria-label="Unité des cotes">' +
      ['mm', 'cm'].map(function (u) { return '<button type="button" data-unite="' + u + '" aria-pressed="' + (u === un()) + '">' + (u === 'mm' ? 'Millimètres' : 'Centimètres') + '</button>'; }).join('') +
      '</div></div><p class="note">Du point à 0 au fond de la gueule de loup (à ' + z.angle + '° l’un de l’autre) :</p><div class="cotes">' +
      tuile('Sur le trait d’équerre', z.axe, 'le long du développé') +
      tuile('Descente', z.profondeur, 'gueule de loup') +
      tuile('Ouverture du compas', z.compas, 'en ligne droite') +
      '</div>' +
      table(['Point', 'Depuis le bord', 'Descente', 'Compas depuis le précédent'], points.map(function (q, i) {
        return [q.angle + '°' + (q.zero ? ' · zéro' : q.creux ? ' · fond' : ''), lg(q.x), lg(q.y), i ? '<b>' + lg(q.compas) + '</b>' : '–'];
      })) + '<p class="note">Le compas se prend en ligne droite d’un point de coupe au suivant, sur la feuille à plat. Reliez ensuite les points à la règle souple en suivant la courbe.</p></div>';
  }

  function donneesScenePiquage() {
    var d = piquageCourant;
    d.scene.fermeture = S.fermeture;
    d.scene.fermeturePrincipal = S.fermeture2;
    d.scene.textes.fermeture = 'Fermeture piquage ' + S.fermeture + '°';
    d.scene.textes.fermeturePrincipal = 'Fermeture principal ' + S.fermeture2 + '°';
    return d.scene;
  }

  /* Virole PVC du principal développée, avec le trou du piquage */
  function formePrincipal(p, depart) {
    var rc = S.recouv, G = C.gabaritPrincipal(p, depart, S.longPrincipal, rc);
    var fin = G.dev + rc, L = G.L, uc = G.uc, demi = G.demiLargeur;
    var modulo = function (u) { return ((u % G.dev) + G.dev) % G.dev; };
    var uniques = function (liste, max) {
      return liste.filter(function (x) { return x >= -0.01 && x <= max + 0.01; }).sort(function (a, b) { return a - b; })
        .filter(function (x, i, t) { return !i || x - t[i - 1] > 0.6; });
    };
    var cotes = [];
    /* chaîne le long du développé : bords du trou et axe */
    var us = uniques([0, G.dev, modulo(uc - demi), uc, modulo(uc + demi)], G.dev);
    us.slice(1).forEach(function (u, i) { cotes.push({ t: 'h', x1: us[i], x2: u, rang: 0, chaine: true, texte: lg(u - us[i]) }); });
    cotes.push({ t: 'h', x1: 0, x2: G.dev, rang: 1, texte: 'Développé ' + lg(G.dev) });
    if (rc > 0) {
      cotes.push({ t: 'h', x1: G.dev, x2: fin, rang: 1, texte: lg(rc) });
      cotes.push({ t: 'h', x1: 0, x2: fin, rang: 2, texte: 'Largeur à couper ' + lg(fin) });
    }
    /* chaîne le long du tube : haut et bas du trou, croisement des axes */
    var vs = uniques([0, G.haut, G.origine, G.bas, L], L);
    vs.slice(1).forEach(function (v, i) { cotes.push({ t: 'v', x: 0, y1: vs[i], y2: v, dehors: 'gauche', rang: 0, texte: lg(v - vs[i]) }); });
    cotes.push({ t: 'v', x: 0, y1: 0, y2: L, dehors: 'gauche', rang: 1, texte: lg(L) });
    /* points de traçage autour du trou */
    var cy = (G.haut + G.bas) / 2;
    G.points.slice(0, 8).forEach(function (q) {
      var principal = q.angle % 90 === 0;
      var dx = q.s, dy = q.v - cy, n = Math.hypot(dx, dy) || 1;
      cotes.push({ t: 'point', x: q.u, y: q.v, dx: dx / n * 17, dy: dy / n * 14 + 4, texte: principal || !ETROIT.matches ? q.angle + '°' : '' });
    });
    /* compas : du haut du trou à son côté, sur la moitié visible en entier */
    var sens = uc + demi <= G.dev ? 1 : -1, cote90 = G.points[sens > 0 ? 2 : 6];
    if (uc + sens * demi >= 0 && uc + sens * demi <= G.dev) {
      cotes.push({ t: 'corde', x1: uc, y1: G.haut, x2: uc + sens * demi, y2: cote90.v, dx: sens * 46, dy: -30, texte: 'compas ' + lg(G.compasHaut) });
    }
    var traits = [[[0, G.origine], [G.dev, G.origine]], [[uc, 0], [uc, L]]].filter(function (l) { return l[0][1] >= 0 && l[0][1] <= L; });
    var reperes = [];
    [0, 90, 180, 270].forEach(function (a) { reperes.push({ x: modulo((a - depart) / 360 * G.dev), t: a + '°' }); });
    if (reperes.every(function (q) { return q.x > G.dev * 0.07 && q.x < G.dev * 0.93; })) reperes.push({ x: 0, t: depart + '°' }, { x: G.dev, t: depart + '°' });
    else reperes.push({ x: G.dev, t: depart + '°' });
    var pointilles = rc > 0 ? [[[G.dev, 0], [G.dev, L]]] : [];
    return {
      zones: rc > 0 ? [rect(G.dev, 0, fin, L)] : [], cotes: cotes, trous: G.trous, guides: traits, pointilles: pointilles, reperes: reperes,
      titre: 'PVC - principal D ' + lg(p.D1, 1) + ' pour piquage D ' + lg(p.D2, 1) + ' ' + un() + ' a ' + fmt(p.gamma) + ' deg - ouverture ' + fmt(depart) + ' deg',
      w: fin, h: L, contour: rect(0, 0, fin, L), G: G
    };
  }

  function contenuPrincipal() {
    var p = piquageCourant.p, f = formePrincipal(p, S.fermeture2), G = f.G;
    /* le gabarit imprimé porte aussi les deux axes de traçage */
    gabarits.princ = { titre: f.titre, w: f.w, h: f.h, contour: f.contour, trous: f.trous, pointilles: f.pointilles.concat(f.guides), reperes: f.reperes };
    var tuile = function (titre, v, aide) { return '<div><span>' + titre + '</span><b>' + lg(v) + ' <small>' + un() + '</small></b><em>' + aide + '</em></div>'; };
    var oblique = p.gamma < 90;
    return dessinPVC(f, 'Gabarit PVC du principal avec ses cotes') +
      '<figcaption>Cotes en ' + un() + '. Traits mixtes : axe du trou et croisement des axes. Trou à découper : en couleur laine.' + (S.recouv > 0 ? ' Bande hachurée : recouvrement de fermeture.' : '') + ' Trait de couleur : ouverture de compas. Haut du gabarit : côté 0° du piquage.</figcaption>' +
      '<div class="compas-bloc"><div class="piece"><h3>Au compas</h3><div class="bascule onglets" role="group" aria-label="Unité des cotes">' +
      ['mm', 'cm'].map(function (u) { return '<button type="button" data-unite="' + u + '" aria-pressed="' + (u === un()) + '">' + (u === 'mm' ? 'Millimètres' : 'Centimètres') + '</button>'; }).join('') +
      '</div></div><div class="cotes">' +
      tuile('Longueur du trou', p.trouLongueur, 'dans l’axe du tube') +
      tuile('Largeur du trou', p.trouLargeur, 'sur le développé') +
      tuile(oblique ? 'Compas haut → côté' : 'Compas bout → côté', G.compasHaut, 'en ligne droite') +
      (oblique ? tuile('Compas côté → bas', G.compasBas, 'en ligne droite') : '') +
      '</div>' +
      table(['Point', 'Depuis le bord gauche', 'Depuis le haut', 'Compas depuis le précédent'], G.points.map(function (q, i) {
        return [q.angle + '°', lg(q.u), lg(q.v), i ? '<b>' + lg(q.compas) + '</b>' : '–'];
      })) + '<p class="note">Reportez chaque point depuis les bords, ou de proche en proche au compas, puis reliez à la règle souple.</p></div>';
  }

  /* déplacement d'un curseur : seuls les gabarits et le modèle 3D sont redessinés */
  var majPrevue = false;
  function redessinerGabarits() {
    if (majPrevue) return;
    majPrevue = true;
    setTimeout(function () {
      majPrevue = false;
      if (!piquageCourant || !$('gabarit-piquage')) return;
      $('gabarit-piquage').innerHTML = contenuGabarit();
      $('gabarit-principal').innerHTML = contenuPrincipal();
      if (scenes.piquage) scenes.piquage.definir(donneesScenePiquage());
      sauver();
    }, 30);
  }
  function fermetureChangee(cle, valeur) {
    S[cle] = valeur;
    var curseur = $(cle);
    if (!curseur) return;
    if (+curseur.value !== valeur) curseur.value = valeur;
    var zone = curseur.parentNode;
    zone.querySelector('output').textContent = valeur + '°';
    zone.querySelectorAll('[data-depart]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.depart === valeur)); });
    redessinerGabarits();
  }

  /* en-tête d'un gabarit : titre, curseur de fermeture et angles courants */
  function enTeteGabarit(titre, cle, angles) {
    return '<div class="gab-tete"><h2>' + titre + '</h2><div class="curseur"><label for="' + cle + '">Fermeture du PVC à <output for="' + cle + '">' + S[cle] + '°</output></label>' +
      '<input type="range" id="' + cle + '" min="0" max="355" step="5" value="' + S[cle] + '">' +
      '<div class="seg" role="group" aria-label="Angles courants">' + angles.map(function (a) { return '<button type="button" data-cle="' + cle + '" data-depart="' + a + '" aria-pressed="' + (a === S[cle]) + '">' + a + '°</button>'; }).join('') + '</div></div></div>';
  }

  function dessinPiquage(p) {
    var g_ = p.gamma * Math.PI / 180, r1 = p.r1, r2 = p.r2;
    var haut = (r1 / Math.sin(g_)) + r2 * 2.2;
    var demiL = Math.max(r1 * 2, (haut / Math.tan(g_)) + r2 * 2);
    var d = [Math.cos(g_), Math.sin(g_)], n = [Math.sin(g_), -Math.cos(g_)];
    var bout = function (side) { return [d[0] * (haut + r2 * .3) + n[0] * side, d[1] * (haut + r2 * .3) + n[1] * side]; };
    /* vue de côté : projection de la courbe d'intersection */
    var courbe = [];
    for (var a = 180; a >= 0; a -= 3) {
      var t = C.distancePiquage(r1, r2, p.gamma, a), s = r2 * Math.cos(a * Math.PI / 180);
      courbe.push([d[0] * t + n[0] * s, d[1] * t + n[1] * s]);
    }
    var branche = courbe.concat([bout(r2), bout(-r2)]);
    var princ = [[-demiL, -r1], [demiL, -r1], [demiL, r1], [-demiL, r1]];
    var tous = branche.concat(princ);
    var xs = tous.map(function (q) { return q[0]; }), ys = tous.map(function (q) { return q[1]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var k = Math.min(360 / (x1 - x0), 260 / (y1 - y0));
    var map = function (q) { return [20 + (360 - (x1 - x0) * k) / 2 + (q[0] - x0) * k, 20 + (y1 - q[1]) * k]; };
    var g = '<path class="s-wool2" d="' + chemin(princ.map(map), true) + '"/>' +
      '<path class="s-wool" d="' + chemin(branche.map(map), true) + '"/>' +
      '<path class="s-cut" d="' + chemin(courbe.map(map)) + '"/>' +
      '<path class="s-axis" d="' + chemin([[-demiL, 0], [demiL, 0]].map(map)) + '"/>' +
      '<path class="s-axis" d="' + chemin([[0, 0], bout(0)].map(map)) + '"/>';
    var q1 = map([demiL * .92, -r1 * .55]), q2 = map([d[0] * haut, d[1] * haut]);
    g += txt(q1[0], q1[1], 'Ø ' + lg(p.D1), 'end') + txt(q2[0], q2[1], 'Ø ' + lg(p.D2));
    return svg('0 0 400 300', g, 'Vue de côté du piquage');
  }

  function rendrePiquage() {
    var out = $('out-piquage');
    if (!(S.gamma >= 25 && S.gamma <= 90 && S.e2 > 0 && S.coq2 > 0)) { out.innerHTML = '<div class="warn">Indiquez un angle entre 25 et 90°, un diamètre et une épaisseur.</div>'; return; }
    var p = C.piquage({ dInt1: S.coq, e1: S.e, dInt2: S.coq2, e2: S.e2, gamma: S.gamma });
    gabarits = {};
    if (!p.possible) {
      out.innerHTML = '<div class="warn" role="alert"><b>Le piquage isolé (Ø ' + lg(p.D2, 1) + ' ' + un() + ') est plus gros que le principal (Ø ' + lg(p.D1, 1) + ' ' + un() + ').</b> Choisissez en haut de page le plus gros des deux comme tube principal, ou réduisez le piquage.</div>';
      return;
    }
    gabarits.piqc = formePiquage(p, false, 0);
    ['fermeture', 'fermeture2'].forEach(function (k) { S[k] = Math.max(0, Math.min(355, Math.round(S[k] || 0))); });
    piquageCourant = {
      p: p,
      scene: {
        p: p, fond: C.zeroAuCreux(p).angle, coq1: S.coq, coq2: S.coq2, d1: S.tube === 'libre' ? S.dLibre : tubeDe(S.tube).d, d2: S.tube2 === 'libre' ? S.dLibre2 : tubeDe(S.tube2).d, recouv: S.recouv,
        textes: { principal: 'Ø ' + lg(p.D1, 1), piquage: 'Ø ' + lg(p.D2, 1), gueule: 'Gueule de loup ' + lg(p.profondeur), trou: 'Trou ' + lg(p.trouLongueur) + ' × ' + lg(p.trouLargeur) },
        legendePVC: 'Cotes en ' + un() + ' ; longueurs raccourcies.', legendeLaine: 'Cotes en ' + un() + '. La coquille du piquage vient en appui sur celle du principal.'
      }
    };
    var html = '<div class="big">' +
      stat('Profondeur de gueule de loup', numLg('p-p', p.profondeur), un(), 'entre la génératrice la plus courte et la plus longue', true) +
      stat('Feuille PVC piquage', numLg('p-w', p.dev2 + S.recouv), un(), 'développé ' + lg(p.dev2) + ' + recouvrement') +
      stat('Trou : longueur', numLg('p-tl', p.trouLongueur), un(), 'dans l’axe du principal') +
      stat('Trou : largeur développée', numLg('p-tw', p.trouLargeur), un(), 'sur le pourtour du principal') +
      '</div>';
    if (Math.abs(p.D1 - p.D2) < 1) html += '<div class="warn">Diamètres isolés égaux : la gueule de loup devient une coupe en V' + (p.gamma === 90 ? ' à 45°' : '') + '.</div>';
    var angles = [0, 30, 60, 90, 120, 150, 180];
    html += '<div class="grid"><div class="full" data-scene></div></div>';
    html += '<div class="grid"><figure class="card draw"><h2>Vue de côté</h2>' + dessinPiquage(p) + '<figcaption>La découpe vient en appui sur l’extérieur de l’isolant principal.</figcaption></figure>' +
      '<div class="card"><h2>Cotes de traçage du piquage</h2>' +
      table(['Génératrice', 'Sur le pourtour', 'À ajouter', 'Depuis le croisement des axes'], angles.map(function (a) {
        return [a + '°', lg(p.dev2 * a / 360), '<b>' + lg(p.ordonnee(a)) + '</b>', lg(C.distancePiquage(p.r1, p.r2, p.gamma, a))];
      })) +
      '<p class="note">Cotes en ' + un() + '. 0° = génératrice dans l’axe du tube principal' + (p.gamma < 90 ? ', côté angle aigu' : '') + '. Tracez un trait d’équerre à la longueur de la génératrice la plus courte, puis ajoutez la cote « À ajouter » vers l’appui. L’autre moitié (180° à 360°) est symétrique.</p></div></div>';
    html += '<div class="grid"><figure class="card draw full">' + enTeteGabarit('Gabarit PVC du piquage', 'fermeture', [0, 45, 90, 180, 270]) +
      '<div id="gabarit-piquage">' + contenuGabarit() + '</div>' +
      '<div class="actions"><button type="button" class="btn primary" data-print="piq">Imprimer le gabarit PVC 1:1</button><button type="button" class="btn" data-print="piqc">Imprimer le gabarit coquille</button><button type="button" class="btn" data-svg="piq">Télécharger en SVG</button></div></figure>' +
      '<figure class="card draw full">' + enTeteGabarit('Gabarit PVC du principal', 'fermeture2', [0, 90, 180, 270]) +
      '<label class="field longueur-piece"><span>Longueur de la pièce</span><span class="unit"><input id="longPrincipal" type="number" min="0" step="10" inputmode="numeric" placeholder="auto" value="' + (S.longPrincipal > 0 ? S.longPrincipal : '') + '"></span></label>' +
      '<div id="gabarit-principal">' + contenuPrincipal() + '</div>' + boutons('princ') + '</figure></div>';
    var d2 = S.tube2 === 'libre' ? S.dLibre2 : tubeDe(S.tube2).d;
    out.innerHTML = alerteCoquille(S.coq2, d2, 'piquage') + html;
    poserScene('piquage', 'Modèle 3D : le pénétrant', true, donneesScenePiquage(), { libre: true, bouton: 'Recentrer' });
  }

  /* ---------- gabarits 1:1 ---------- */
  function svgReel(f, vx, vy, vw, vh, extra) {
    var m = 0.35;
    var corps = '<path d="' + chemin(f.contour, true) + '" fill="none" stroke="#000" stroke-width="' + m + '"/>';
    f.pointilles.forEach(function (l) { corps += '<path d="' + chemin(l) + '" fill="none" stroke="#000" stroke-width="' + m + '" stroke-dasharray="3 2"/>'; });
    (f.trous || []).forEach(function (t) { corps += '<path d="' + chemin(t, true) + '" fill="none" stroke="#000" stroke-width="' + m + '"/>'; });
    f.reperes.forEach(function (r) {
      corps += '<path d="M' + r.x + ' 0V' + f.h + '" stroke="#999" stroke-width="0.2" stroke-dasharray="1 2" fill="none"/>' +
        '<text x="' + r.x + '" y="-2" font-size="4" text-anchor="middle" font-family="sans-serif">' + r.t + '</text>';
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + vw + 'mm" height="' + vh + 'mm" viewBox="' + vx + ' ' + vy + ' ' + vw + ' ' + vh + '">' + corps + (extra || '') + '</svg>';
  }

  function imprimer(id) {
    var f = gabarits[id];
    if (!f) return;
    var PW = 188, PH = 240, REC = 10, MG = 8;
    var W = f.w + 2 * MG, H = f.h + 2 * MG;
    var cols = Math.max(1, Math.ceil((W - REC) / (PW - REC))), ligs = Math.max(1, Math.ceil((H - REC) / (PH - REC)));
    var pages = '';
    for (var l = 0; l < ligs; l++) {
      for (var c = 0; c < cols; c++) {
        var vx = -MG + c * (PW - REC), vy = -MG + l * (PH - REC);
        var cadre = '<rect x="' + vx + '" y="' + vy + '" width="' + PW + '" height="' + PH + '" fill="none" stroke="#777" stroke-width="0.2"/>' +
          '<path d="M' + (vx + PW - REC) + ' ' + vy + 'v' + PH + 'M' + vx + ' ' + (vy + PH - REC) + 'h' + PW + '" fill="none" stroke="#bbb" stroke-width="0.2" stroke-dasharray="2 2"/>';
        pages += '<div class="page"><svg xmlns="http://www.w3.org/2000/svg" width="188mm" height="22mm" viewBox="0 0 188 22" font-family="sans-serif" font-size="3.6">' +
          '<text x="0" y="5">Calo Découpe - ' + f.titre + '</text><text x="0" y="11">Feuille ligne ' + (l + 1) + '/' + ligs + ', colonne ' + (c + 1) + '/' + cols + ' - recouvrir 10 mm (trait gris)</text>' +
          '<path d="M0 17h100M0 14.5v5M100 14.5v5" stroke="#000" stroke-width="0.35" fill="none"/><text x="104" y="18.5">100 mm : a verifier au metre</text></svg>' +
          svgReel(f, vx, vy, PW, PH, cadre) + '</div>';
      }
    }
    if (ligs * cols > 12 && !window.confirm('Ce gabarit demande ' + (ligs * cols) + ' feuilles A4. Continuer ?')) return;
    $('print').innerHTML = pages;
    document.body.classList.add('gabarit');
    window.print();
  }
  window.addEventListener('afterprint', function () { document.body.classList.remove('gabarit'); });

  function avertir(message) {
    var bulle = document.createElement('div');
    bulle.className = 'toast';
    bulle.setAttribute('role', 'status');
    bulle.textContent = message;
    document.body.appendChild(bulle);
    setTimeout(function () { bulle.remove(); }, 4500);
  }

  /* gabarit à taille réelle en SVG, avec une règle de 100 mm pour contrôler l'échelle */
  function telecharger(id) {
    var f = gabarits[id];
    if (!f) return;
    var y = f.h + 16;
    var regle = '<text x="0" y="' + (y - 5) + '" font-size="4" font-family="sans-serif">Imprimer a 100 % - la regle doit mesurer 100 mm</text>' +
      '<path d="M0 ' + y + 'h100M0 ' + (y - 2.5) + 'v5M100 ' + (y - 2.5) + 'v5" stroke="#000" stroke-width="0.35" fill="none"/>';
    var contenu = svgReel(f, -8, -8, +(Math.max(f.w, 110) + 16).toFixed(2), +(f.h + 30).toFixed(2), regle);
    var fichier = 'gabarit-' + id + '.svg';
    if (HEBERGE) {
      enregistreur.then(function (d) {
        if (!d) { avertir('Le téléchargement n’est pas disponible dans cette vue.'); return null; }
        return d.save({ filename: fichier, data: contenu }).catch(function (err) {
          if (!err || err.code !== 'declined') avertir('Le fichier n’a pas pu être enregistré. Réessayez dans un instant.');
        });
      });
      return;
    }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([contenu], { type: 'image/svg+xml' }));
    a.download = fichier;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* une fois publié, les boutons d'impression deviennent des téléchargements */
  function adapterBoutons() {
    if (!HEBERGE) return;
    document.querySelectorAll('main [data-print]').forEach(function (b) {
      var double_ = b.parentNode.querySelector('[data-svg="' + b.dataset.print + '"]');
      if (double_) { b.hidden = true; double_.classList.add('primary'); double_.textContent = 'Télécharger le gabarit 1:1'; }
      else b.textContent = b.textContent.replace('Imprimer', 'Télécharger');
    });
    document.querySelectorAll('main p.note').forEach(function (p) {
      p.textContent = p.textContent.replace('Imprimez à 100 %', 'Téléchargez, imprimez à 100 %');
    });
  }

  /* ---------- rendu & événements ---------- */
  var RENDUS = { droit: rendreDroit, coude: rendreCoude, piquage: rendrePiquage, cote: function () { window.Cote.rendre(); }, memo: function () {} };

  function presser(zone, valeur) {
    $(zone).querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.v === +valeur)); });
  }

  function synchroniser(source) {
    var champs = { dLibre: 'dLibre', e: 'e', recouv: 'recouv', coq: 'coq', longueur: 'longueur', lcoq: 'lcoq', largeur: 'largeur', angle: 'angle', rayon: 'rayon', dLibre2: 'dLibre2', coq2: 'coq2', e2: 'e2', gamma: 'gamma' };
    Object.keys(champs).forEach(function (id) { if ($(id) !== source) $(id).value = S[champs[id]]; });
    $('tube').value = S.tube; $('tube2').value = S.tube2;
    $('fieldLibre').hidden = S.tube !== 'libre';
    $('fieldLibre2').hidden = S.tube2 !== 'libre';
    presser('chipsE', S.e); presser('chipsC', S.coq); presser('chipsE2', S.e2); presser('chipsC2', S.coq2);
    presser('segAngle', S.angle); presser('segSec', S.sections); presser('segGamma', S.gamma);
    recaps();
    $('rayonAuto').hidden = S.rayonAuto || S.tube === 'libre';
  }

  function rendre() {
    var onglet = RENDUS[S.tab] ? S.tab : 'droit';
    $('base').hidden = onglet === 'memo' || onglet === 'cote';
    /* la page Cote a ses propres réglages, enregistrés avec chaque relevé */
    var valide = onglet === 'cote' || (S.coq > 0 && S.e > 0 && S.recouv >= 0);
    if (valide) {
      if (onglet !== 'cote') resume();
      RENDUS[onglet](); adapterBoutons();
      if (window.Widgets && $('out-' + onglet)) window.Widgets.organiser($('out-' + onglet), onglet);
      animer($('p-' + onglet));
    }
    else { $('summary').innerHTML = '<div><span>Saisie incomplète</span><b>Indiquez le diamètre et l’épaisseur.</b></div>'; var o = $('out-' + onglet); if (o) o.innerHTML = ''; }
  }

  function maj(source) {
    if (S.rayonAuto && S.tube !== 'libre') S.rayon = tubeDe(S.tube).r;
    synchroniser(source); rendre(); sauver();
  }

  function placerPill() {
    var b = document.querySelector('.tabs [aria-selected="true"]'), pill = document.querySelector('.pill');
    if (b) { pill.style.width = b.offsetWidth + 'px'; pill.style.transform = 'translateX(' + b.offsetLeft + 'px)'; }
  }

  function onglet(nom, defiler) {
    if (!RENDUS[nom]) nom = 'droit';
    if (nom !== 'cote' && window.Cote) window.Cote.quitter();
    S.tab = nom;
    document.querySelectorAll('.tabs button').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === nom)); });
    document.querySelectorAll('.panel').forEach(function (p) { p.classList.toggle('active', p.id === 'p-' + nom); });
    placerPill(); maj();
    if (location.hash !== '#' + nom) { try { history.replaceState(null, '', '#' + nom); } catch (err) { /* cadre isolé */ } }
    if (defiler) window.scrollTo({ top: 0 });
  }

  function boutonUnite() {
    var b = $('unite');
    b.textContent = un();
    b.setAttribute('aria-label', 'Cotes en ' + (enCm() ? 'centimètres, passer en millimètres' : 'millimètres, passer en centimètres'));
    b.title = b.getAttribute('aria-label');
  }
  function changerUnite(u) {
    if (u === S.unite) return;
    S.unite = u;
    anciens = {};
    boutonUnite(); maj();
  }

  function init() {
    textures();
    var options = C.TUBES.map(function (t) { return '<option value="' + t.dn + '">DN ' + t.dn + ' · ' + t.pouce + ' · Ø ' + fmt(t.d, 1) + '</option>'; }).join('') + '<option value="libre">Autre diamètre…</option>';
    $('tube').innerHTML = options; $('tube2').innerHTML = options;
    var boutonsDe = function (zone, valeurs, suffixe) {
      $(zone).innerHTML = valeurs.map(function (v) { return '<button type="button" data-v="' + v + '">' + v + (suffixe || '') + '</button>'; }).join('');
    };
    boutonsDe('chipsE', EPAISSEURS); boutonsDe('chipsE2', EPAISSEURS);
    boutonsDe('chipsC', COQUILLES); boutonsDe('chipsC2', COQUILLES);
    boutonsDe('segAngle', [30, 45, 60, 90], '°');
    boutonsDe('segSec', [0, 1, 2, 3, 4, 5]);
    boutonsDe('segGamma', [45, 60, 90], '°');

    var choisir = function (zone, cle) {
      $(zone).addEventListener('click', function (ev) {
        var b = ev.target.closest('button'); if (!b) return;
        S[cle] = +b.dataset.v; maj();
      });
    };
    choisir('chipsC', 'coq'); choisir('chipsE2', 'e2'); choisir('chipsC2', 'coq2');
    choisir('chipsE', 'e'); choisir('segAngle', 'angle'); choisir('segSec', 'sections'); choisir('segGamma', 'gamma');

    ['dLibre', 'e', 'recouv', 'coq', 'longueur', 'lcoq', 'largeur', 'angle', 'rayon', 'dLibre2', 'coq2', 'e2', 'gamma'].forEach(function (id) {
      $(id).addEventListener('input', function () {
        var v = parseFloat(this.value);
        S[id] = isFinite(v) ? v : 0;
        if (id === 'rayon') S.rayonAuto = false;
        if (id === 'dLibre') S.coq = S.dLibre;
        if (id === 'dLibre2') S.coq2 = S.dLibre2;
        maj(this);
      });
    });
    $('tube').addEventListener('change', function () {
      if (this.value === 'libre') { S.tube = 'libre'; S.rayonAuto = false; S.coq = S.dLibre; }
      else { S.tube = +this.value; S.coq = tubeDe(S.tube).coq; S.rayonAuto = true; }
      maj();
    });
    $('tube2').addEventListener('change', function () {
      if (this.value === 'libre') { S.tube2 = 'libre'; S.coq2 = S.dLibre2; }
      else { S.tube2 = +this.value; S.coq2 = tubeDe(S.tube2).coq; }
      maj();
    });
    $('rayonAuto').addEventListener('click', function () { S.rayonAuto = true; maj(); });

    document.querySelector('.tabs').addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (b) onglet(b.dataset.tab, true);
    });
    $('out-piquage').addEventListener('input', function (ev) {
      if (ev.target.type === 'range') fermetureChangee(ev.target.id, +ev.target.value);
      else if (ev.target.id === 'longPrincipal') { S.longPrincipal = Math.max(0, parseFloat(ev.target.value) || 0); redessinerGabarits(); }
    });
    document.querySelector('main').addEventListener('click', function (ev) {
      var el = ev.target.closest('[data-print],[data-svg],[data-rayon],[data-depart],button[data-unite],tr[data-e]');
      if (!el) return;
      if (el.dataset.depart !== undefined) fermetureChangee(el.dataset.cle, +el.dataset.depart);
      else if (el.dataset.unite) changerUnite(el.dataset.unite);
      else if (el.dataset.print) (HEBERGE ? telecharger : imprimer)(el.dataset.print);
      else if (el.dataset.svg) telecharger(el.dataset.svg);
      else if (el.dataset.rayon) { S.rayon = +el.dataset.rayon; S.rayonAuto = false; maj(); }
      else { S.e = +el.dataset.e; maj(); }
    });
    document.querySelector('main').addEventListener('keydown', function (ev) {
      var tr = ev.target.closest('tr[data-e]');
      if (tr && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); S.e = +tr.dataset.e; maj(); }
    });

    var sombre = window.matchMedia('(prefers-color-scheme: dark)').matches;
    /* sans choix de l'utilisateur, on garde le thème déjà posé par la page hôte, sinon celui de l'appareil */
    var appliquer = function () {
      var racine = document.documentElement;
      if (S.theme) racine.dataset.theme = S.theme;
      else if (!racine.dataset.theme) racine.dataset.theme = sombre ? 'dark' : 'light';
    };
    appliquer();
    $('theme').addEventListener('click', function () {
      S.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; appliquer(); sauver();
    });

    if (S.unite !== 'cm') S.unite = 'mm';
    boutonUnite();
    $('unite').addEventListener('click', function () { changerUnite(enCm() ? 'mm' : 'cm'); });

    window.addEventListener('resize', placerPill);
    ETROIT.addEventListener('change', function () { rendre(); });
    window.addEventListener('hashchange', function () { onglet(location.hash.slice(1), true); });
    onglet(location.hash.slice(1) || S.tab);
  }

  /* outils partagés avec la page Cote */
  window.Outils = {
    lg: lg, un: un, avertir: avertir, dessinPVC: dessinPVC,
    base: function () { return { dn: tubeDe(S.tube) ? S.tube : 50, coq: tubeDe(S.tube) ? S.coq : 60, e: S.e }; },
    gabarit: function (id, forme) { gabarits[id] = forme; (HEBERGE ? telecharger : imprimer)(id); }
  };

  init();
})();
